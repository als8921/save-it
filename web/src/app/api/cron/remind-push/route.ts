import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { pickDailyRemindCandidates } from "@/lib/remind/picker";
import { sendToSubscription, type SubscriptionRow } from "@/lib/push/send";

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

  // 각 사용자의 timezone 기준 현재 시각과 daily_time을 비교 (±30분 윈도우).
  // wraparound (자정 근처) 보정은 v1.5 — 받아들임.
  const now = new Date();

  const { data: prefs } = await supabase
    .from("user_reminder_prefs")
    .select("user_id, daily_time, timezone")
    .eq("daily_enabled", true);

  const userIds: string[] = [];
  for (const row of prefs ?? []) {
    const localNow = formatLocalTime(now, row.timezone as string);
    const diffSec = Math.abs(
      timeStringToSeconds(row.daily_time as string) -
        timeStringToSeconds(localNow)
    );
    if (diffSec <= 1800) userIds.push(row.user_id as string);
  }

  let sent = 0;
  let skipped = 0;
  let removed = 0;

  for (const userId of userIds) {
    try {
      const candidates = await pickDailyRemindCandidates(userId, supabase);
      if (candidates.length === 0) {
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

      const payload = {
        title: "오늘 다시 볼 링크",
        body: `${candidates.length}개가 있어요`,
        url: "/today",
      };

      for (const row of subs) {
        const outcome = await sendToSubscription(
          supabase,
          row as SubscriptionRow,
          payload
        );
        if (outcome.delivered) sent++;
        if (outcome.removed) removed++;
      }
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
