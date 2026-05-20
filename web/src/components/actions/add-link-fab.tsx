"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { AddLinkModal } from "./add-link-modal";

interface AddLinkFabProps {
  folderId: string;
  userId: string;
}

export function AddLinkFab({ folderId, userId }: AddLinkFabProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="새 링크 추가"
        className="fixed right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-para-project-fg)] text-white shadow-lg active:scale-95 transition-transform"
        style={{ bottom: `calc(env(safe-area-inset-bottom) + 80px)` }}
      >
        <Plus className="h-6 w-6" />
      </button>
      <AddLinkModal
        open={open}
        onOpenChange={setOpen}
        folderId={folderId}
        userId={userId}
      />
    </>
  );
}
