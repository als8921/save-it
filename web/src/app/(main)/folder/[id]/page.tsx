import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { LinkList } from "@/components/link-list";
import { AddLinkButton } from "@/components/add-link-button";
import { PARA_LABELS } from "@/lib/types";
import type { ParaCategory } from "@/lib/types";

export default async function FolderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: folder } = await supabase
    .from("folders")
    .select("*")
    .eq("id", id)
    .single();

  if (!folder) {
    notFound();
  }

  const { data: links } = await supabase
    .from("links")
    .select("*")
    .eq("folder_id", id)
    .order("created_at", { ascending: false });

  const categoryLabel = folder.para_category
    ? PARA_LABELS[folder.para_category as ParaCategory]
    : null;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div>
          {categoryLabel && (
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {categoryLabel}
            </p>
          )}
          <h1 className="text-xl font-semibold">{folder.name}</h1>
        </div>
        <AddLinkButton folderId={id} />
      </header>

      <div className="flex-1 overflow-auto p-6">
        <LinkList links={links ?? []} />
      </div>
    </div>
  );
}
