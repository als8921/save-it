import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendToSubscription } from "@/lib/push/send";

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

  let sent = 0;
  let removed = 0;
  for (const row of subs) {
    const outcome = await sendToSubscription(supabase, row, {
      title: "save-it 테스트",
      body: "알림이 잘 도착하나요?",
      url: "/today",
    });
    if (outcome.delivered) sent++;
    if (outcome.removed) removed++;
  }

  return NextResponse.json({ sent, removed });
}
