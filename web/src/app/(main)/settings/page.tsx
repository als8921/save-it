import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/shell/app-header";
import { SignOutButton } from "@/components/actions/sign-out-button";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <AppHeader title="설정" />
      <div className="space-y-4 p-4">
        <section className="space-y-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            계정
          </h2>
          <div className="rounded-xl border bg-card px-4 py-3">
            <div className="text-xs text-muted-foreground">이메일</div>
            <div className="mt-0.5 text-sm font-medium">{user?.email}</div>
          </div>
          <SignOutButton />
        </section>
      </div>
    </>
  );
}
