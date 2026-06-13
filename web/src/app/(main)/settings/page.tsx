import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/actions/sign-out-button";
import { PushToggle } from "@/components/settings/push-toggle";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div
      className="space-y-6 p-4"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)" }}
    >
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">설정</h1>
        <p className="text-sm text-muted-foreground">알림과 계정을 관리해요.</p>
      </header>

      <PushToggle />

      <section className="space-y-2">
        <h2 className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          계정
        </h2>
        <div className="divide-y divide-border overflow-hidden rounded-2xl border bg-card">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Mail className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <div className="text-sm font-medium">이메일</div>
              <div className="truncate text-xs text-muted-foreground">
                {user?.email}
              </div>
            </div>
          </div>
          <SignOutButton />
        </div>
      </section>
    </div>
  );
}
