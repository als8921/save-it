import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { pickDailyRemindCandidates } from "@/lib/remind/picker";
import { sendToSubscription } from "@/lib/push/send";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // 현재 UTC time 기준 ±30분 윈도우 안의 daily_time을 가진 사용자 select.
  // wraparound (자정 근처) 보정은 v1.5 — 받아들임.
  const nowUtcTime = new Date().toISOString().slice(11, 19); // HH:MM:SS

  const { data: prefs } = await supabase
    .from("user_reminder_prefs")
    .select("user_id, daily_time")
    .eq("daily_enabled", true);

  const userIds: string[] = [];
  for (const row of prefs ?? []) {
    const diffSec = Math.abs(
      timeStringToSeconds(row.daily_time as string) -
        timeStringToSeconds(nowUtcTime)
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
        const outcome = await sendToSubscription(supabase, row as {
          id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
        }, payload);
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
