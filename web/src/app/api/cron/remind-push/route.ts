import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { pickDailyRemindCandidates } from "@/lib/remind/picker";
import { sendToSubscription, type SubscriptionRow } from "@/lib/push/send";
import { deriveScheduleTimes } from "@/lib/remind/schedule";
import {
  buildReminderNotification,
  fetchRecentHeroLinkIds,
  recordHeroSent,
} from "@/lib/remind/notification";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date();

  const { data: prefs } = await supabase
    .from("user_reminder_prefs")
    .select("user_id, daily_time, daily_count, timezone")
    .eq("daily_enabled", true);

  // 사용자별 파생 시각 목록 중 하나라도 현재 로컬 시각 ±30분이면 발송 대상
  const userIds: string[] = [];
  for (const row of prefs ?? []) {
    const times = deriveScheduleTimes(
      row.daily_time as string,
      (row.daily_count as number) ?? 1
    );
    const localNow = formatLocalTime(now, row.timezone as string);
    const localSec = timeStringToSeconds(localNow);
    const hit = times.some(
      (t) => Math.abs(timeStringToSeconds(t) - localSec) <= 1800
    );
    if (hit) userIds.push(row.user_id as string);
  }

  let sent = 0;
  let skipped = 0;
  let removed = 0;

  for (const userId of userIds) {
    try {
      const candidates = await pickDailyRemindCandidates(userId, supabase);
      const recentHeroes = await fetchRecentHeroLinkIds(supabase, userId);
      const notif = buildReminderNotification(candidates, recentHeroes);
      if (!notif) {
        skipped++;
        continue;
      }

      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("user_id", userId);

      if (!subs || subs.length === 0) {
        skipped++;
        continue;
      }

      for (const row of subs) {
        const outcome = await sendToSubscription(
          supabase,
          row as SubscriptionRow,
          notif.payload
        );
        if (outcome.delivered) sent++;
        if (outcome.removed) removed++;
      }

      await recordHeroSent(supabase, userId, notif.hero.link.id);
    } catch (err) {
      console.error(`[cron] user ${userId} failed:`, err);
    }
  }

  return NextResponse.json({ sent, skipped, removed });
}

function timeStringToSeconds(t: string): number {
  const [h, m, s] = t.split(":").map((x) => parseInt(x, 10));
  return h * 3600 + m * 60 + (s ?? 0);
}

function formatLocalTime(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}
