import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/shell/bottom-nav";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="relative mx-auto flex h-svh w-full max-w-md flex-col overflow-hidden">
      <main
        className="flex-1 overflow-y-auto"
        style={{
          paddingBottom: `calc(env(safe-area-inset-bottom) + 64px)`,
        }}
      >
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
