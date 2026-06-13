"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  async function handle() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <button
      type="button"
      onClick={handle}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-sm font-medium text-destructive transition-colors active:bg-accent"
    >
      <LogOut className="h-5 w-5 shrink-0" />
      <span>로그아웃</span>
    </button>
  );
}
