import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/shell/app-header";
import { ParaCard } from "@/components/library/para-card";
import { UnassignedCard } from "@/components/library/unassigned-card";
import { QuickAddFab } from "@/components/actions/quick-add-fab";
import { PARA_ORDER } from "@/lib/para";
import type { Folder } from "@/lib/types";

export default async function LibraryHome() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: folders }, { data: links }] = await Promise.all([
    supabase.from("folders").select("*"),
    supabase.from("links").select("folder_id"),
  ]);

  const folderList = (folders ?? []) as Folder[];
  const linkList = (links ?? []) as { folder_id: string }[];

  const folderToCategory = new Map(
    folderList.map((f) => [f.id, f.para_category])
  );
  const linkCountByCategory = new Map<string, number>();
  for (const l of linkList) {
    const cat = folderToCategory.get(l.folder_id);
    const key = cat ?? "unassigned";
    linkCountByCategory.set(key, (linkCountByCategory.get(key) ?? 0) + 1);
  }

  const folderCountByCategory = new Map<string, number>();
  for (const f of folderList) {
    const key = f.para_category ?? "unassigned";
    folderCountByCategory.set(key, (folderCountByCategory.get(key) ?? 0) + 1);
  }

  return (
    <>
      <AppHeader
        title="라이브러리"
      />
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {PARA_ORDER.map((category) => (
            <ParaCard
              key={category}
              category={category}
              folderCount={folderCountByCategory.get(category) ?? 0}
              linkCount={linkCountByCategory.get(category) ?? 0}
            />
          ))}
        </div>
        <UnassignedCard
          linkCount={linkCountByCategory.get("unassigned") ?? 0}
        />
      </div>
      {user && <QuickAddFab userId={user.id} />}
    </>
  );
}
