"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  PARA_OPTIONS,
  categoryToParaParam,
  paraParamToCategory,
  isDuplicateNameError,
  type ParaParam,
} from "@/lib/library";
import type { Folder } from "@/lib/types";

interface EditFolderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: Folder;
}

export function EditFolderModal({ open, onOpenChange, folder }: EditFolderModalProps) {
  const router = useRouter();
  const [name, setName] = useState(folder.name);
  const [para, setPara] = useState<ParaParam>(categoryToParaParam(folder.para_category));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError("");
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("folders")
      .update({ name: name.trim(), para_category: paraParamToCategory(para) })
      .eq("id", folder.id);
    setSubmitting(false);
    if (updateError) {
      setError(
        isDuplicateNameError(updateError.code)
          ? "이미 같은 이름의 폴더가 있어요"
          : updateError.message,
      );
      return;
    }
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[90svh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-background p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] shadow-xl sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-sm sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
          <div className="flex items-center justify-between pb-3">
            <Dialog.Title className="text-base font-semibold">폴더 수정</Dialog.Title>
            <Dialog.Close
              render={
                <button
                  type="button"
                  aria-label="닫기"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
                >
                  <X className="h-4 w-4" />
                </button>
              }
            />
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="폴더 이름"
              required
            />
            <div className="grid grid-cols-3 gap-1.5">
              {PARA_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setPara(opt.value)}
                  className={`rounded-md border py-2 text-xs ${
                    para === opt.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {error && (
              <p className="border-l-2 border-destructive pl-2 text-xs text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={submitting || !name.trim()} className="w-full">
              {submitting ? "저장 중…" : "저장"}
            </Button>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
