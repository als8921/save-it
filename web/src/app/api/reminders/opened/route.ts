import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  REMIND_TTL_HOURS,
  REMIND_MODE_DAILY,
  REMIND_CHANNEL_DASHBOARD,
} from "@/lib/remind/constants";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    linkId?: unknown;
  } | null;
  const linkId = body?.linkId;
  if (typeof linkId !== "string" || linkId.length === 0) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const since = new Date(
    Date.now() - REMIND_TTL_HOURS * 60 * 60 * 1000
  ).toISOString();

  const { data: row } = await supabase
    .from("link_reminders")
    .select("id, opened_at, open_count")
    .eq("user_id", user.id)
    .eq("link_id", linkId)
    .eq("mode", REMIND_MODE_DAILY)
    .eq("channel", REMIND_CHANNEL_DASHBOARD)
    .gte("sent_at", since)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ ok: false });
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("link_reminders")
    .update({
      opened_at: row.opened_at ?? nowIso,
      open_count: row.open_count + 1,
    })
    .eq("id", row.id);

  if (error) {
    console.error("[remind] opened update failed:", error.message);
  }

  return NextResponse.json({ ok: true });
}
