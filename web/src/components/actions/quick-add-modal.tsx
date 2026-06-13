"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import {
  Check,
  ChevronDown,
  ChevronUp,
  FolderPlus,
  Loader2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PARA_ORDER, PARA_TOKENS, UNASSIGNED_TOKEN } from "@/lib/para";
import type { Folder, ParaCategory } from "@/lib/types";

type ParaTab = ParaCategory | "unassigned";

interface QuickAddModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

const PRIORITY_OPTIONS = [
  { value: 0, label: "보통" },
  { value: 1, label: "중요" },
  { value: 2, label: "매우" },
];

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function QuickAddModal({ open, onOpenChange, userId }: QuickAddModalProps) {
  const router = useRouter();
  const supabase = createClient();

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const titleDirtyRef = useRef(false);
  const [metaLoading, setMetaLoading] = useState(false);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  const [folders, setFolders] = useState<Folder[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [selectedPara, setSelectedPara] = useState<ParaTab>("project");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  const [duplicate, setDuplicate] = useState<{ id: string; folder_id: string | null } | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function resetAll() {
    setUrl("");
    setTitle("");
    titleDirtyRef.current = false;
    setMetaLoading(false);
    setDescription("");
    setPriority(0);
    setShowDetails(false);
    setFolders([]);
    setFoldersLoading(false);
    setSelectedPara("project");
    setSelectedFolderId(null);
    setShowNewFolder(false);
    setNewFolderName("");
    setCreatingFolder(false);
    setDuplicate(null);
    setError("");
    setSubmitting(false);
  }

  // 열릴 때: 클립보드 URL 읽기 + 폴더 목록 로드
  useEffect(() => {
    if (!open) return;
    void loadFolders();
    if (typeof navigator === "undefined" || !navigator.clipboard?.readText) return;
    navigator.clipboard
      .readText()
      .then((text) => {
        const trimmed = text.trim();
        if (trimmed && isHttpUrl(trimmed)) {
          setUrl(trimmed);
        }
      })
      .catch(() => {
        /* ignore permission/api errors */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // URL 입력 시 메타데이터(제목) 자동 채우기
  useEffect(() => {
    if (!open) return;
    if (!url || !isHttpUrl(url)) return;
    const target = url;
    let cancelled = false;
    const handle = setTimeout(() => {
      if (cancelled) return;
      setMetaLoading(true);
      fetch(`/api/metadata?url=${encodeURIComponent(target)}`)
        .then(async (r) => {
          const data = await r.json().catch(() => null);
          if (cancelled) return;
          if (data?.ok && data.title) {
            if (!titleDirtyRef.current) setTitle(data.title);
          }
        })
        .catch(() => {
          /* ignore */
        })
        .finally(() => {
          if (!cancelled) setMetaLoading(false);
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(handle);
      setMetaLoading(false);
    };
  }, [url, open]);

  async function loadFolders() {
    setFoldersLoading(true);
    const { data, error: fetchError } = await supabase
      .from("folders")
      .select("*")
      .order("created_at", { ascending: true });
    setFoldersLoading(false);
    if (fetchError) {
      setError(fetchError.message);
      return;
    }
    setFolders((data ?? []) as Folder[]);
  }

  async function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    setCreatingFolder(true);
    setError("");
    const para = selectedPara === "unassigned" ? null : selectedPara;
    const { data, error: insertError } = await supabase
      .from("folders")
      .insert({ user_id: userId, name, para_category: para })
      .select("*")
      .single();
    setCreatingFolder(false);
    if (insertError) {
      setError(
        insertError.code === "23505"
          ? "이미 같은 이름의 폴더가 있어요"
          : insertError.message
      );
      return;
    }
    const created = data as Folder;
    setFolders((prev) => [...prev, created]);
    setSelectedFolderId(created.id);
    setShowNewFolder(false);
    setNewFolderName("");
  }

  async function handleSave() {
    if (!url.trim() || !isHttpUrl(url.trim())) {
      setError("올바른 URL을 입력하세요");
      return;
    }
    if (selectedPara !== "unassigned" && !selectedFolderId) {
      setError("폴더를 선택하세요");
      return;
    }
    setSubmitting(true);
    setError("");
    setDuplicate(null);

    const { data: existing } = await supabase
      .from("links")
      .select("id, folder_id")
      .eq("url", url.trim())
      .maybeSingle();
    if (existing) {
      setDuplicate(existing as { id: string; folder_id: string | null });
      setSubmitting(false);
      return;
    }

    const folderIdToSave =
      selectedPara === "unassigned" ? null : selectedFolderId;
    const { error: insertError } = await supabase.from("links").insert({
      user_id: userId,
      folder_id: folderIdToSave,
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
    onOpenChange(false);
    resetAll();
    router.refresh();
  }

  const filteredFolders = folders.filter((f) =>
    selectedPara === "unassigned"
      ? f.para_category === null
      : f.para_category === selectedPara
  );

  const paraChips: { key: ParaTab; letter: string; label: string; fg: string; bg: string }[] = [
    ...PARA_ORDER.map((cat) => ({
      key: cat as ParaTab,
      letter: PARA_TOKENS[cat].letter,
      label: PARA_TOKENS[cat].label,
      fg: PARA_TOKENS[cat].fg,
      bg: PARA_TOKENS[cat].bg,
    })),
    {
      key: "unassigned" as ParaTab,
      letter: "·",
      label: UNASSIGNED_TOKEN.label,
      fg: UNASSIGNED_TOKEN.fg,
      bg: UNASSIGNED_TOKEN.bg,
    },
  ];

  const canSave =
    !submitting &&
    !!url.trim() &&
    isHttpUrl(url.trim()) &&
    (selectedPara === "unassigned" || !!selectedFolderId);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) setTimeout(resetAll, 200);
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92svh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-background shadow-2xl sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[88vh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4">
            <Dialog.Title className="text-lg font-semibold">
              새 링크 저장
            </Dialog.Title>
            <Dialog.Close
              render={
                <button
                  type="button"
                  aria-label="닫기"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent"
                >
                  <X className="h-5 w-5" />
                </button>
              }
            />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5 pb-[calc(env(safe-area-inset-bottom)+8px)]">
              {/* URL */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  링크 주소
                </label>
                <Input
                  autoFocus
                  type="url"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setDuplicate(null);
                  }}
                  placeholder="https://..."
                  required
                  className="h-11 text-sm"
                />
              </div>

              {/* Title */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground">
                    제목
                  </label>
                  {metaLoading && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      가져오는 중…
                    </span>
                  )}
                </div>
                <Input
                  value={title}
                  onChange={(e) => {
                    titleDirtyRef.current = true;
                    setTitle(e.target.value);
                  }}
                  placeholder={
                    metaLoading ? "페이지 제목 가져오는 중…" : "제목 (비워두면 URL)"
                  }
                  className="h-11 text-sm"
                />
              </div>

              {/* Folder */}
              <div className="space-y-2.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  저장할 폴더
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {paraChips.map((chip) => {
                    const active = selectedPara === chip.key;
                    return (
                      <button
                        key={chip.key}
                        type="button"
                        onClick={() => {
                          setSelectedPara(chip.key);
                          setSelectedFolderId(null);
                          setShowNewFolder(false);
                        }}
                        title={chip.label}
                        className={cn(
                          "flex flex-col items-center justify-center gap-0.5 rounded-xl border border-transparent py-2 transition-colors cursor-pointer",
                          active ? "" : "bg-muted/60 hover:bg-accent"
                        )}
                        style={
                          active
                            ? { backgroundColor: chip.bg, borderColor: chip.fg }
                            : undefined
                        }
                      >
                        <span
                          className="text-sm font-bold leading-none"
                          style={{ color: active ? chip.fg : "var(--muted-foreground)" }}
                        >
                          {chip.letter}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] leading-none tracking-tight",
                            active ? "" : "text-muted-foreground"
                          )}
                          style={active ? { color: chip.fg } : undefined}
                        >
                          {chip.key === "unassigned" ? "미지정" : chip.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {selectedPara === "unassigned" ? (
                  <p className="rounded-xl bg-muted/50 px-3.5 py-3 text-xs text-muted-foreground">
                    폴더 없이 미지정으로 저장돼요
                  </p>
                ) : (
                  <div className="max-h-[210px] space-y-1 overflow-y-auto rounded-xl bg-muted/50 p-2">
                    {foldersLoading ? (
                      <p className="px-2 py-3 text-xs italic text-muted-foreground">
                        불러오는 중…
                      </p>
                    ) : (
                      <>
                        {filteredFolders.length === 0 && !showNewFolder && (
                          <p className="px-2 py-3 text-xs italic text-muted-foreground">
                            이 카테고리에 폴더가 없어요
                          </p>
                        )}
                        {filteredFolders.map((folder) => {
                          const selected = selectedFolderId === folder.id;
                          return (
                            <button
                              key={folder.id}
                              type="button"
                              onClick={() => setSelectedFolderId(folder.id)}
                              className={cn(
                                "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors cursor-pointer",
                                selected
                                  ? "bg-primary text-primary-foreground"
                                  : "hover:bg-accent"
                              )}
                            >
                              <span className="flex-1 truncate font-medium">
                                {folder.name}
                              </span>
                              {selected && <Check className="h-4 w-4 shrink-0" />}
                            </button>
                          );
                        })}
                        {showNewFolder ? (
                          <div className="flex gap-1.5 p-1">
                            <Input
                              value={newFolderName}
                              onChange={(e) => setNewFolderName(e.target.value)}
                              placeholder="새 폴더 이름"
                              autoFocus
                              className="h-9 text-sm"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  void handleCreateFolder();
                                }
                                if (e.key === "Escape") {
                                  setShowNewFolder(false);
                                  setNewFolderName("");
                                }
                              }}
                            />
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => void handleCreateFolder()}
                              disabled={creatingFolder || !newFolderName.trim()}
                            >
                              {creatingFolder ? "…" : "생성"}
                            </Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowNewFolder(true)}
                            className="flex w-full items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
                          >
                            <FolderPlus className="h-4 w-4" />
                            <span>새 폴더 만들기</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Details */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowDetails((v) => !v)}
                  className="flex w-full items-center justify-between rounded-lg py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <span>메모 · 우선순위</span>
                  {showDetails ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                {showDetails && (
                  <div className="mt-2.5 space-y-2.5">
                    <Input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="메모 (선택)"
                      className="h-11 text-sm"
                    />
                    <div className="flex gap-1.5">
                      {PRIORITY_OPTIONS.map((opt) => (
                        <button
                          type="button"
                          key={opt.value}
                          onClick={() => setPriority(opt.value)}
                          className={cn(
                            "flex-1 rounded-lg py-2.5 text-xs font-medium transition-colors",
                            priority === opt.value
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted/60 text-muted-foreground hover:bg-accent"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {duplicate && (
                <p className="border-l-2 border-amber-500 pl-2 text-xs text-amber-700">
                  이미 저장된 URL이에요.{" "}
                  <a
                    href={
                      duplicate.folder_id
                        ? `/folder/${duplicate.folder_id}`
                        : `/category/unassigned`
                    }
                    className="underline"
                  >
                    {duplicate.folder_id ? "해당 폴더 열기" : "미지정 보기"}
                  </a>
                </p>
              )}
              {error && (
                <p className="border-l-2 border-destructive pl-2 text-xs text-destructive">
                  {error}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="border-t px-6 py-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
              <Button
                type="submit"
                disabled={!canSave}
                className="h-12 w-full text-sm font-semibold"
              >
                {submitting ? "저장 중…" : "저장"}
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
