import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendToSubscription } from "@/lib/push/send";
import { pickDailyRemindCandidates } from "@/lib/remind/picker";
import { buildReminderNotification } from "@/lib/remind/notification";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", user.id);

  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0, removed: 0 });
  }

  // 실제 매일 알림과 동일한 대표 링크 미리보기로 발송.
  // 테스트이므로 발송 이력·쿨다운에 영향을 주지 않도록 record:false + 최근 대표 무시.
  const candidates = await pickDailyRemindCandidates(user.id, supabase, {
    record: false,
  });
  const notif = buildReminderNotification(candidates, []);
  const payload = notif?.payload ?? {
    title: "save-it",
    body: "저장한 링크가 아직 없어요. 링크를 저장해 보세요!",
    url: "/today",
  };

  let sent = 0;
  let removed = 0;
  for (const row of subs) {
    const outcome = await sendToSubscription(supabase, row, payload);
    if (outcome.delivered) sent++;
    if (outcome.removed) removed++;
  }

  return NextResponse.json({ sent, removed });
}
