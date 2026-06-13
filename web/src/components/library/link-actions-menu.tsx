"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Menu } from "@base-ui/react/menu";
import { MoreVertical } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { EditLinkModal } from "@/components/actions/edit-link-modal";
import { MoveLinkModal } from "@/components/actions/move-link-modal";
import { ConfirmDeleteDialog } from "@/components/actions/confirm-delete-dialog";
import type { Link as LinkRow } from "@/lib/types";

interface LinkActionsMenuProps {
  link: LinkRow;
}

export function LinkActionsMenu({ link }: LinkActionsMenuProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function handleDelete() {
    const supabase = createClient();
    const { error } = await supabase.from("links").delete().eq("id", link.id);
    if (error) throw error;
    router.refresh();
  }

  return (
    <>
      <Menu.Root>
        <Menu.Trigger
          render={
            <button
              type="button"
              aria-label="링크 메뉴"
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
                onClick={() => setMoveOpen(true)}
                className="cursor-pointer rounded-md px-3 py-2 outline-none data-highlighted:bg-accent"
              >
                이동
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

      <EditLinkModal open={editOpen} onOpenChange={setEditOpen} link={link} />
      <MoveLinkModal open={moveOpen} onOpenChange={setMoveOpen} link={link} />
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="링크 삭제"
        message="이 링크를 삭제할까요?"
        onConfirm={handleDelete}
      />
    </>
  );
}
