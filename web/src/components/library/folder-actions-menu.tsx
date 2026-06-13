"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Menu } from "@base-ui/react/menu";
import { MoreVertical } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { EditFolderModal } from "@/components/actions/edit-folder-modal";
import { ConfirmDeleteDialog } from "@/components/actions/confirm-delete-dialog";
import { folderDeleteMessage } from "@/lib/library";
import type { Folder } from "@/lib/types";

interface FolderActionsMenuProps {
  folder: Folder;
  linkCount: number;
  /** 삭제 후 폴더 상세에서 목록으로 돌아가야 할 때 사용 */
  redirectAfterDelete?: string;
}

export function FolderActionsMenu({
  folder,
  linkCount,
  redirectAfterDelete,
}: FolderActionsMenuProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function handleDelete() {
    const supabase = createClient();
    const { error } = await supabase.from("folders").delete().eq("id", folder.id);
    if (error) throw error;
    if (redirectAfterDelete) router.push(redirectAfterDelete);
    else router.refresh();
  }

  return (
    <>
      <Menu.Root>
        <Menu.Trigger
          render={
            <button
              type="button"
              aria-label="폴더 메뉴"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          }
        />
        <Menu.Portal>
          <Menu.Positioner sideOffset={4} align="end" className="z-50">
            <Menu.Popup className="min-w-32 rounded-lg border bg-popover p-1 text-sm shadow-md outline-none">
              <Menu.Item
                onClick={() => setEditOpen(true)}
                className="cursor-pointer rounded-md px-3 py-2 outline-none data-highlighted:bg-accent"
              >
                수정
              </Menu.Item>
              <Menu.Item
                onClick={() => setDeleteOpen(true)}
                className="cursor-pointer rounded-md px-3 py-2 text-destructive outline-none data-highlighted:bg-destructive/10"
              >
                삭제
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      {editOpen && (
        <EditFolderModal open={editOpen} onOpenChange={setEditOpen} folder={folder} />
      )}
      {deleteOpen && (
        <ConfirmDeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="폴더 삭제"
          message={folderDeleteMessage(linkCount)}
          onConfirm={handleDelete}
        />
      )}
    </>
  );
}
