"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Link as LinkRow } from "@/lib/types";

interface EditLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  link: LinkRow;
}

export function EditLinkModal({ open, onOpenChange, link }: EditLinkModalProps) {
  const router = useRouter();
  const [title, setTitle] = useState(link.title);
  const [description, setDescription] = useState(link.description ?? "");
  const [priority, setPriority] = useState(link.priority ?? 0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("links")
      .update({
        title: title.trim() || link.url,
        description: description.trim() || null,
        priority,
      })
      .eq("id", link.id);
    setSubmitting(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[90svh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-background p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] shadow-xl">
          <div className="flex items-center justify-between pb-3">
            <Dialog.Title className="text-base font-semibold">링크 수정</Dialog.Title>
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
            <p className="truncate rounded-md bg-muted px-3 py-2 text-xs font-mono text-muted-foreground">
              {link.url}
            </p>
            <Input
              autoFocus
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
            {error && (
              <p className="border-l-2 border-destructive pl-2 text-xs text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "저장 중…" : "저장"}
            </Button>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
