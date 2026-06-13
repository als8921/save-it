"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { folderMoveOptions } from "@/lib/library";
import type { Link as LinkRow } from "@/lib/types";

interface MoveLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  link: LinkRow;
}

export function MoveLinkModal({ open, onOpenChange, link }: MoveLinkModalProps) {
  const router = useRouter();
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | "null" | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const supabase = createClient();
    supabase
      .from("folders")
      .select("id, name")
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setError(error.message);
        else setFolders((data ?? []) as { id: string; name: string }[]);
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [open]);

  async function moveTo(folderId: string | null) {
    setSavingId(folderId ?? "null");
    setError("");
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("links")
      .update({ folder_id: folderId })
      .eq("id", link.id);
    setSavingId(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    onOpenChange(false);
    router.refresh();
  }

  const options = folderMoveOptions(folders);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[80svh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-background p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] shadow-xl">
          <div className="flex items-center justify-between pb-3">
            <Dialog.Title className="text-base font-semibold">폴더 이동</Dialog.Title>
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
          {!loaded ? (
            <p className="py-6 text-center text-sm text-muted-foreground">불러오는 중…</p>
          ) : (
            <ul className="space-y-1">
              {options.map((opt) => {
                const current = (link.folder_id ?? null) === opt.id;
                const saving = savingId === (opt.id ?? "null");
                return (
                  <li key={opt.id ?? "null"}>
                    <button
                      type="button"
                      disabled={current || saving}
                      onClick={() => moveTo(opt.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg border bg-card px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent disabled:opacity-60",
                      )}
                    >
                      <span className="flex-1 truncate">{opt.label}</span>
                      {current && <Check className="h-4 w-4 text-primary" />}
                      {saving && <span className="text-xs text-muted-foreground">이동 중…</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {error && (
            <p className="mt-3 border-l-2 border-destructive pl-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
