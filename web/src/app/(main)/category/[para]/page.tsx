import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/shell/app-header";
import { BackButton } from "@/components/shell/back-button";
import { FolderAccordionItem } from "@/components/library/folder-accordion-item";
import { LinkCard } from "@/components/library/link-card";
import { AddFolderModal } from "@/components/actions/add-folder-modal";
import { QuickAddFab } from "@/components/actions/quick-add-fab";
import {
  PARA_TOKENS,
  UNASSIGNED_TOKEN,
  isValidParaParam,
} from "@/lib/para";
import type { Folder, Link } from "@/lib/types";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ para: string }>;
}) {
  const { para } = await params;
  if (!isValidParaParam(para)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const isUnassigned = para === "unassigned";
  const title = isUnassigned ? UNASSIGNED_TOKEN.label : PARA_TOKENS[para].label;

  if (isUnassigned) {
    const { data: linksData } = await supabase
      .from("links")
      .select("*")
      .is("folder_id", null)
      .order("created_at", { ascending: false });
    const links = (linksData ?? []) as Link[];

    return (
      <>
        <AppHeader title={title} left={<BackButton fallbackHref="/" />} />
        <div className="space-y-2 p-4">
          {links.length === 0 ? (
            <p className="py-8 text-center text-sm italic text-muted-foreground">
              저장된 링크가 없어요
            </p>
          ) : (
            links.map((l) => <LinkCard key={l.id} link={l} />)
          )}
        </div>
        <QuickAddFab userId={user.id} />
      </>
    );
  }

  const { data: foldersData } = await supabase
    .from("folders")
    .select("*")
    .eq("para_category", para)
    .order("created_at", { ascending: true });
  const folders = (foldersData ?? []) as Folder[];

  const folderIds = folders.map((f) => f.id);
  const linksByFolder = new Map<string, Link[]>();
  if (folderIds.length > 0) {
    const { data: links } = await supabase
      .from("links")
      .select("*")
      .in("folder_id", folderIds)
      .order("created_at", { ascending: false });
    for (const l of (links ?? []) as Link[]) {
      if (!l.folder_id) continue;
      const arr = linksByFolder.get(l.folder_id) ?? [];
      arr.push(l);
      linksByFolder.set(l.folder_id, arr);
    }
  }

  return (
    <>
      <AppHeader title={title} left={<BackButton fallbackHref="/" />} />
      <div className="space-y-2 p-4">
        {folders.length === 0 ? (
          <p className="py-8 text-center text-sm italic text-muted-foreground">
            아직 폴더가 없어요
          </p>
        ) : (
          folders.map((f) => (
            <FolderAccordionItem
              key={f.id}
              folder={f}
              links={linksByFolder.get(f.id) ?? []}
            />
          ))
        )}
        <AddFolderModal category={para} userId={user.id} />
      </div>
    </>
  );
}
