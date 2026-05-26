import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Link, Folder, ParaCategory } from "@/lib/types";
import { calcDailyScore } from "./scoring";
import {
  REMIND_TTL_HOURS,
  FATIGUE_WINDOW_DAYS,
  DEFAULT_MAX_ITEMS,
  REMIND_MODE_DAILY,
  REMIND_CHANNEL_DASHBOARD,
} from "./constants";

export interface RemindCandidate {
  link: Link;
  folder: Pick<Folder, "id" | "name" | "para_category">;
  score: number;
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

interface JoinedRow {
  id: string;
  user_id: string;
  folder_id: string | null;
  url: string;
  title: string;
  description: string | null;
  priority: number;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
  folders:
    | { id: string; name: string; para_category: ParaCategory | null }
    | { id: string; name: string; para_category: ParaCategory | null }[]
    | null;
}

function pickFolder(
  raw: JoinedRow["folders"]
): { id: string; name: string; para_category: ParaCategory | null } | null {
  if (raw === null) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

function rowToCandidate(row: JoinedRow, now: Date): RemindCandidate {
  const link: Link = {
    id: row.id,
    user_id: row.user_id,
    folder_id: row.folder_id,
    url: row.url,
    title: row.title,
    description: row.description,
    priority: row.priority,
    is_read: row.is_read,
    created_at: row.created_at,
    read_at: row.read_at,
  };
  const folder = pickFolder(row.folders) ?? {
    id: "",
    name: "미지정",
    para_category: null as ParaCategory | null,
  };
  return {
    link,
    folder,
    score: calcDailyScore({
      priority: row.priority,
      paraCategory: folder.para_category,
      createdAt: new Date(row.created_at),
      now,
    }),
  };
}

async function resolveLimit(supabase: Supabase, userId: string): Promise<number> {
  const { data } = await supabase
    .from("user_reminder_prefs")
    .select("max_items_per_reminder")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.max_items_per_reminder ?? DEFAULT_MAX_ITEMS;
}

async function readRecentBatchLinkIds(
  supabase: Supabase,
  userId: string
): Promise<string[]> {
  const since = new Date(
    Date.now() - REMIND_TTL_HOURS * 60 * 60 * 1000
  ).toISOString();
  const { data } = await supabase
    .from("link_reminders")
    .select("link_id")
    .eq("user_id", userId)
    .eq("mode", REMIND_MODE_DAILY)
    .eq("channel", REMIND_CHANNEL_DASHBOARD)
    .gte("sent_at", since)
    .order("sent_at", { ascending: false });

  if (!data || data.length === 0) return [];
  const seen = new Set<string>();
  for (const row of data) {
    seen.add(row.link_id as string);
  }
  return [...seen];
}

async function fetchLinksByIds(
  supabase: Supabase,
  userId: string,
  linkIds: string[]
): Promise<JoinedRow[]> {
  if (linkIds.length === 0) return [];
  const { data } = await supabase
    .from("links")
    .select(
      "id, user_id, folder_id, url, title, description, priority, is_read, created_at, read_at, folders ( id, name, para_category )"
    )
    .eq("user_id", userId)
    .in("id", linkIds);
  return (data ?? []) as unknown as JoinedRow[];
}

async function selectFreshCandidates(
  supabase: Supabase,
  userId: string
): Promise<JoinedRow[]> {
  const since = new Date(
    Date.now() - FATIGUE_WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  // 최근 7일 내에 sent된 link_id (피로 필터)
  const { data: fatigueRows } = await supabase
    .from("link_reminders")
    .select("link_id")
    .eq("user_id", userId)
    .eq("mode", REMIND_MODE_DAILY)
    .eq("channel", REMIND_CHANNEL_DASHBOARD)
    .gte("sent_at", since);
  const excludeIds = new Set<string>(
    (fatigueRows ?? []).map((r) => r.link_id as string)
  );

  const query = supabase
    .from("links")
    .select(
      "id, user_id, folder_id, url, title, description, priority, is_read, created_at, read_at, folders ( id, name, para_category )"
    )
    .eq("user_id", userId)
    .eq("is_read", false);

  // archive 제외는 클라이언트 사이드 필터 (Supabase 조인 컬럼 비교가 어렵기 때문)
  const { data } = await query;
  const rows = (data ?? []) as unknown as JoinedRow[];
  return rows.filter((r) => {
    if (excludeIds.has(r.id)) return false;
    const cat = pickFolder(r.folders)?.para_category ?? null;
    if (cat === "archive") return false;
    return true;
  });
}

async function recordSent(
  supabase: Supabase,
  userId: string,
  linkIds: string[]
): Promise<void> {
  if (linkIds.length === 0) return;
  const rows = linkIds.map((link_id) => ({
    link_id,
    user_id: userId,
    mode: REMIND_MODE_DAILY,
    channel: REMIND_CHANNEL_DASHBOARD,
  }));
  const { error } = await supabase.from("link_reminders").insert(rows);
  if (error) {
    console.error("[remind] recordSent failed:", error.message);
  }
}

export async function pickDailyRemindCandidates(
  userId: string
): Promise<RemindCandidate[]> {
  const supabase = await createClient();
  const limit = await resolveLimit(supabase, userId);
  const now = new Date();

  // 1. TTL hit?
  const cachedIds = await readRecentBatchLinkIds(supabase, userId);
  if (cachedIds.length > 0) {
    const rows = await fetchLinksByIds(supabase, userId, cachedIds);
    return rows
      .map((r) => rowToCandidate(r, now))
      .filter((c) => c.folder.para_category !== "archive")
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // 2. miss → 후보 SELECT + 필터
  const fresh = await selectFreshCandidates(supabase, userId);
  if (fresh.length === 0) return [];

  // 3. score + sort + take(limit)
  const scored = fresh
    .map((r) => rowToCandidate(r, now))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // 4. record send
  await recordSent(
    supabase,
    userId,
    scored.map((s) => s.link.id)
  );

  return scored;
}
