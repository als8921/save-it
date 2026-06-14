import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { daily_count?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const count = Number(body.daily_count);
  if (!Number.isInteger(count) || count < 1 || count > 3) {
    return NextResponse.json({ error: "invalid_daily_count" }, { status: 400 });
  }

  const { error } = await supabase
    .from("user_reminder_prefs")
    .update({ daily_count: count })
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, daily_count: count });
}
