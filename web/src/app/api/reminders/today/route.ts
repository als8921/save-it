import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pickDailyRemindCandidates } from "@/lib/remind/picker";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const items = await pickDailyRemindCandidates(user.id);
  return NextResponse.json({ items });
}
