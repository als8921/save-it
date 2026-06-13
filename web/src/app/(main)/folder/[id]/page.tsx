import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/shell/app-header";
import { BackButton } from "@/components/shell/back-button";
import { LinkCard } from "@/components/library/link-card";
import { FolderActionsMenu } from "@/components/library/folder-actions-menu";
import { AddLinkFab } from "@/components/actions/add-link-fab";
import type { Folder, Link } from "@/lib/types";

export default async function FolderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: folderData, error: folderError } = await supabase
    .from("folders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (folderError || !folderData) notFound();
  const folder = folderData as Folder;

  const { data: linksData } = await supabase
    .from("links")
    .select("*")
    .eq("folder_id", id)
    .order("created_at", { ascending: false });
  const links = (linksData ?? []) as Link[];

  const backHref = `/category/${folder.para_category ?? "unassigned"}`;

  return (
    <>
      <AppHeader
        title={folder.name}
        left={<BackButton fallbackHref={backHref} />}
        right={
          <FolderActionsMenu
            folder={folder}
            linkCount={links.length}
            redirectAfterDelete={backHref}
          />
        }
      />
      <div className="space-y-2 p-4">
        {links.length === 0 ? (
          <p className="py-8 text-center text-sm italic text-muted-foreground">
            이 폴더는 비어 있어요
          </p>
        ) : (
          links.map((l) => <LinkCard key={l.id} link={l} />)
        )}
      </div>
      <AddLinkFab folderId={folder.id} userId={user.id} />
    </>
  );
}
