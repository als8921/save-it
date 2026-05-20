"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface AddLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId: string;
  userId: string;
}

export function AddLinkModal({ open, onOpenChange, folderId, userId }: AddLinkModalProps) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState<{ id: string; folder_id: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setSubmitting(true);
    setError("");
    setDuplicate(null);

    const supabase = createClient();

    const { data: existing } = await supabase
      .from("links")
      .select("id, folder_id")
      .eq("url", url.trim())
      .maybeSingle();

    if (existing) {
      setDuplicate(existing);
      setSubmitting(false);
      return;
    }

    const { error: insertError } = await supabase.from("links").insert({
      user_id: userId,
      folder_id: folderId,
      url: url.trim(),
      title: title.trim() || url.trim(),
      description: description.trim() || null,
      priority,
    });
    setSubmitting(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setUrl("");
    setTitle("");
    setDescription("");
    setPriority(0);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 max-h-[90svh] overflow-y-auto rounded-t-2xl bg-background p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] shadow-xl">
          <div className="flex items-center justify-between pb-3">
            <Dialog.Title className="text-base font-semibold">새 링크</Dialog.Title>
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
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              required
            />
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목 (비워두면 URL이 제목)"
            />
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="메모 (선택)"
            />
            <div className="flex gap-1.5">
              {[
                { v: 0, label: "보통" },
                { v: 1, label: "중요" },
                { v: 2, label: "매우" },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.v}
                  onClick={() => setPriority(opt.v)}
                  className={`flex-1 rounded-md border py-2 text-xs ${
                    priority === opt.v
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {duplicate && (
              <p className="border-l-2 border-amber-500 pl-2 text-xs text-amber-700">
                이미 저장된 URL이에요.{" "}
                <a
                  href={`/folder/${duplicate.folder_id}`}
                  className="underline"
                >
                  해당 폴더 열기
                </a>
              </p>
            )}
            {error && (
              <p className="border-l-2 border-destructive pl-2 text-xs text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={submitting || !url.trim()} className="w-full">
              {submitting ? "저장 중…" : "저장"}
            </Button>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
