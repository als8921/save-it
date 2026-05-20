import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/shell/app-header";
import { BackButton } from "@/components/shell/back-button";
import { FolderAccordionItem } from "@/components/library/folder-accordion-item";
import { AddFolderModal } from "@/components/actions/add-folder-modal";
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

  const folderQuery = supabase
    .from("folders")
    .select("*")
    .order("created_at", { ascending: true });

  const { data: foldersData } = await (isUnassigned
    ? folderQuery.is("para_category", null)
    : folderQuery.eq("para_category", para));
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
              id={f.id}
              name={f.name}
              links={linksByFolder.get(f.id) ?? []}
            />
          ))
        )}
        <AddFolderModal
          category={isUnassigned ? null : para}
          userId={user.id}
        />
      </div>
    </>
  );
}
