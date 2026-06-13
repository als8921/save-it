# 링크/폴더 삭제·수정(이동·이름변경) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** web와 extension에서 저장한 링크(삭제/수정/이동)와 폴더(삭제/수정)를 ⋮ 케밥 메뉴로 관리할 수 있게 한다.

**Architecture:** 순수 프론트엔드 작업. Supabase RLS의 update/delete 정책과 folder→link `on delete cascade`가 이미 존재하므로 DB 변경 없음. web은 브라우저 supabase 클라이언트로 mutate 후 `router.refresh()`, extension은 mutate 후 로컬 state 직접 갱신(각 플랫폼 기존 패턴 유지). 공통 순수 로직은 `web/src/lib/library.ts`로 분리해 vitest로 단위 테스트한다.

**Tech Stack:** Next.js(App Router) + base-ui(`Menu`/`AlertDialog`/`Dialog`) + Supabase JS / WXT extension(React 19) + lucide-react / vitest

---

## 파일 구조

### Web (신규)
- `web/src/lib/library.ts` — 순수 헬퍼(삭제 메시지, PARA 옵션, 폴더 이동 옵션, 중복에러 판별)
- `web/src/lib/library.test.ts` — 위 헬퍼 단위 테스트
- `web/src/components/actions/confirm-delete-dialog.tsx` — 재사용 삭제 확인(AlertDialog)
- `web/src/components/actions/edit-link-modal.tsx` — 링크 제목/메모/우선도 수정
- `web/src/components/actions/move-link-modal.tsx` — 링크 폴더 이동
- `web/src/components/actions/edit-folder-modal.tsx` — 폴더 이름/PARA 수정
- `web/src/components/library/link-actions-menu.tsx` — 링크 ⋮ 메뉴(수정/이동/삭제)
- `web/src/components/library/folder-actions-menu.tsx` — 폴더 ⋮ 메뉴(수정/삭제)

### Web (수정)
- `web/src/components/library/link-card.tsx` — ⋮ 오버레이 버튼 추가
- `web/src/components/library/folder-card.tsx` — ⋮ 추가
- `web/src/components/library/folder-accordion-item.tsx` — ⋮ 추가
- `web/src/app/(main)/folder/[id]/page.tsx` — 헤더 `right`에 폴더 ⋮ 추가

### Extension (신규)
- `extension/components/ui/menu.tsx` — 경량 케밥 드롭다운

### Extension (수정)
- `extension/entrypoints/popup/BrowseView.tsx` — 링크/폴더 ⋮ 액션 + mutate + 로컬 state 갱신

---

## Task 1: 공통 순수 헬퍼 + 테스트

**Files:**
- Create: `web/src/lib/library.ts`
- Test: `web/src/lib/library.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`web/src/lib/library.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  folderDeleteMessage,
  PARA_OPTIONS,
  paraParamToCategory,
  categoryToParaParam,
  folderMoveOptions,
  isDuplicateNameError,
} from "./library";

describe("folderDeleteMessage", () => {
  it("링크가 없으면 단순 확인 문구", () => {
    expect(folderDeleteMessage(0)).toBe("이 폴더를 삭제할까요?");
  });
  it("링크가 있으면 개수를 포함해 경고", () => {
    expect(folderDeleteMessage(3)).toBe(
      "이 폴더와 안에 있는 링크 3개가 함께 삭제됩니다. 삭제할까요?",
    );
  });
});

describe("PARA_OPTIONS", () => {
  it("PARA 4개 + 미지정 순서로 구성", () => {
    expect(PARA_OPTIONS.map((o) => o.value)).toEqual([
      "project",
      "area",
      "resource",
      "archive",
      "unassigned",
    ]);
  });
});

describe("para 변환", () => {
  it("unassigned <-> null", () => {
    expect(paraParamToCategory("unassigned")).toBeNull();
    expect(paraParamToCategory("project")).toBe("project");
    expect(categoryToParaParam(null)).toBe("unassigned");
    expect(categoryToParaParam("area")).toBe("area");
  });
});

describe("folderMoveOptions", () => {
  it("맨 앞에 미지정(null), 이후 폴더들", () => {
    const opts = folderMoveOptions([
      { id: "a", name: "독서" },
      { id: "b", name: "업무" },
    ]);
    expect(opts).toEqual([
      { id: null, label: "미지정" },
      { id: "a", label: "독서" },
      { id: "b", label: "업무" },
    ]);
  });
});

describe("isDuplicateNameError", () => {
  it("23505만 중복으로 판별", () => {
    expect(isDuplicateNameError("23505")).toBe(true);
    expect(isDuplicateNameError("23503")).toBe(false);
    expect(isDuplicateNameError(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd web && npm test -- library`
Expected: FAIL — `./library` 모듈을 찾을 수 없음.

- [ ] **Step 3: 최소 구현 작성**

`web/src/lib/library.ts`:

```ts
import type { ParaCategory } from "./types";
import { PARA_ORDER, PARA_TOKENS, UNASSIGNED_TOKEN } from "./para";

export function folderDeleteMessage(linkCount: number): string {
  if (linkCount === 0) return "이 폴더를 삭제할까요?";
  return `이 폴더와 안에 있는 링크 ${linkCount}개가 함께 삭제됩니다. 삭제할까요?`;
}

export type ParaParam = ParaCategory | "unassigned";

export interface ParaOption {
  value: ParaParam;
  label: string;
}

export const PARA_OPTIONS: ParaOption[] = [
  ...PARA_ORDER.map((c) => ({ value: c, label: PARA_TOKENS[c].label })),
  { value: "unassigned" as const, label: UNASSIGNED_TOKEN.label },
];

export function paraParamToCategory(value: ParaParam): ParaCategory | null {
  return value === "unassigned" ? null : value;
}

export function categoryToParaParam(category: ParaCategory | null): ParaParam {
  return category ?? "unassigned";
}

export interface FolderMoveOption {
  id: string | null;
  label: string;
}

export function folderMoveOptions(
  folders: { id: string; name: string }[],
): FolderMoveOption[] {
  return [
    { id: null, label: UNASSIGNED_TOKEN.label },
    ...folders.map((f) => ({ id: f.id, label: f.name })),
  ];
}

export function isDuplicateNameError(code: string | undefined): boolean {
  return code === "23505";
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd web && npm test -- library`
Expected: PASS (모든 케이스).

- [ ] **Step 5: 커밋**

```bash
git add web/src/lib/library.ts web/src/lib/library.test.ts
git commit -m "feat(web): 라이브러리 액션 공통 헬퍼 추가"
```

---

## Task 2: 재사용 삭제 확인 다이얼로그 (web)

**Files:**
- Create: `web/src/components/actions/confirm-delete-dialog.tsx`

base-ui `AlertDialog` parts: `Root`, `Trigger`, `Portal`, `Backdrop`, `Popup`, `Title`, `Description`, `Close`.

- [ ] **Step 1: 컴포넌트 작성**

`web/src/components/actions/confirm-delete-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Button } from "@/components/ui/button";

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  onConfirm: () => Promise<void> | void;
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  message,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-background p-5 shadow-xl sm:max-w-sm">
          <AlertDialog.Title className="text-base font-semibold">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
            {message}
          </AlertDialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Close
              render={<Button variant="outline" disabled={busy} />}
            >
              취소
            </AlertDialog.Close>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={handleConfirm}
            >
              {busy ? "삭제 중…" : "삭제"}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
```

- [ ] **Step 2: 타입/빌드 확인**

Run: `cd web && npx tsc --noEmit`
Expected: 새 파일 관련 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add web/src/components/actions/confirm-delete-dialog.tsx
git commit -m "feat(web): 재사용 삭제 확인 다이얼로그 추가"
```

---

## Task 3: 링크 수정 모달 (web)

**Files:**
- Create: `web/src/components/actions/edit-link-modal.tsx`

`add-link-modal.tsx`의 폼 구조를 기준으로 하되 URL은 읽기 전용으로 표시하고, 저장 시 `update`.

- [ ] **Step 1: 컴포넌트 작성**

`web/src/components/actions/edit-link-modal.tsx`:

```tsx
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
```

- [ ] **Step 2: 타입 확인**

Run: `cd web && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add web/src/components/actions/edit-link-modal.tsx
git commit -m "feat(web): 링크 수정 모달 추가"
```

---

## Task 4: 링크 이동 모달 (web)

**Files:**
- Create: `web/src/components/actions/move-link-modal.tsx`

모달 open 시 사용자 폴더 목록을 조회하고, `folderMoveOptions`로 미지정 포함 목록을 만든다. 선택 즉시 `update({ folder_id })`.

- [ ] **Step 1: 컴포넌트 작성**

`web/src/components/actions/move-link-modal.tsx`:

```tsx
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | "null" | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const supabase = createClient();
    supabase
      .from("folders")
      .select("id, name")
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setFolders((data ?? []) as { id: string; name: string }[]);
        setLoading(false);
      });
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
          {loading ? (
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
```

- [ ] **Step 2: 타입 확인**

Run: `cd web && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add web/src/components/actions/move-link-modal.tsx
git commit -m "feat(web): 링크 폴더 이동 모달 추가"
```

---

## Task 5: 링크 ⋮ 메뉴 + LinkCard 통합 (web)

**Files:**
- Create: `web/src/components/library/link-actions-menu.tsx`
- Modify: `web/src/components/library/link-card.tsx`

base-ui `Menu` parts: `Root`, `Trigger`, `Portal`, `Positioner`, `Popup`, `Item`.

- [ ] **Step 1: 메뉴 컴포넌트 작성**

`web/src/components/library/link-actions-menu.tsx`:

```tsx
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
```

- [ ] **Step 2: LinkCard에 ⋮ 오버레이 추가**

`web/src/components/library/link-card.tsx`를 수정한다. import에 메뉴 추가:

```tsx
import { LinkActionsMenu } from "./link-actions-menu";
```

`<a>`의 마지막 자식인 `<ExternalLink .../>` 줄을 다음으로 교체한다(아이콘을 메뉴 옆에 유지):

```tsx
      <div className="flex shrink-0 items-center gap-0.5">
        <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        <LinkActionsMenu link={link} />
      </div>
```

> 메뉴 트리거 버튼은 자체 `onClick`에서 `preventDefault`/`stopPropagation`을 호출하므로 `<a>`의 내비게이션·`markAsRead`가 발생하지 않는다.

- [ ] **Step 3: 타입/린트 확인**

Run: `cd web && npx tsc --noEmit && npm run lint`
Expected: 에러 없음.

- [ ] **Step 4: 수동 검증**

Run: `cd web && npm run dev`
확인: 폴더 상세/카테고리 페이지에서 링크 카드의 ⋮ 클릭 → 수정/이동/삭제 동작. ⋮ 클릭 시 링크가 열리지 않음.

- [ ] **Step 5: 커밋**

```bash
git add web/src/components/library/link-actions-menu.tsx web/src/components/library/link-card.tsx
git commit -m "feat(web): 링크 카드에 수정/이동/삭제 메뉴 추가"
```

---

## Task 6: 폴더 수정 모달 (web)

**Files:**
- Create: `web/src/components/actions/edit-folder-modal.tsx`

이름 + PARA 분류를 한 모달에서 수정. 중복 이름은 `isDuplicateNameError`로 친절 메시지.

- [ ] **Step 1: 컴포넌트 작성**

`web/src/components/actions/edit-folder-modal.tsx`:

```tsx
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
```

- [ ] **Step 2: 타입 확인**

Run: `cd web && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add web/src/components/actions/edit-folder-modal.tsx
git commit -m "feat(web): 폴더 수정 모달 추가"
```

---

## Task 7: 폴더 ⋮ 메뉴 + 통합 (web)

**Files:**
- Create: `web/src/components/library/folder-actions-menu.tsx`
- Modify: `web/src/components/library/folder-card.tsx`
- Modify: `web/src/components/library/folder-accordion-item.tsx`
- Modify: `web/src/app/(main)/folder/[id]/page.tsx`

`folderDeleteMessage(linkCount)`로 삭제 경고. `linkCount`는 사용처에서 prop으로 전달.

- [ ] **Step 1: 메뉴 컴포넌트 작성**

`web/src/components/library/folder-actions-menu.tsx`:

```tsx
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

      <EditFolderModal open={editOpen} onOpenChange={setEditOpen} folder={folder} />
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="폴더 삭제"
        message={folderDeleteMessage(linkCount)}
        onConfirm={handleDelete}
      />
    </>
  );
}
```

- [ ] **Step 2: FolderCard 통합**

`web/src/components/library/folder-card.tsx`를 다음으로 교체한다(서버 `Link`를 유지하면서 ⋮를 형제로 둠):

```tsx
import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { FolderActionsMenu } from "./folder-actions-menu";
import type { Folder } from "@/lib/types";

interface FolderCardProps {
  folder: Folder;
  linkCount: number;
}

export function FolderCard({ folder, linkCount }: FolderCardProps) {
  return (
    <div className="group flex items-stretch overflow-hidden rounded-xl border bg-card">
      <Link
        href={`/folder/${folder.id}`}
        className="flex flex-1 items-center gap-3 px-4 py-3 transition-colors active:bg-accent"
      >
        <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-sm font-medium">{folder.name}</span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {linkCount}
        </span>
      </Link>
      <div className="flex items-center pr-1">
        <FolderActionsMenu folder={folder} linkCount={linkCount} />
      </div>
    </div>
  );
}
```

> `FolderCard`의 props가 `{ id, name, linkCount }`에서 `{ folder, linkCount }`로 바뀐다. 사용처가 있으면 함께 수정해야 한다.

- [ ] **Step 3: FolderCard 사용처 점검 및 수정**

Run: `cd web && grep -rn "FolderCard" src/`
각 사용처에서 `<FolderCard id=... name=... linkCount=... />`를 `<FolderCard folder={folder} linkCount={...} />`로 바꾼다(해당 줄에서 `folder` 객체가 있어야 함 — 없으면 상위에서 `folder` 전체를 전달하도록 조정). 사용처가 0건이면 이 단계는 건너뛴다.

- [ ] **Step 4: FolderAccordionItem 통합**

`web/src/components/library/folder-accordion-item.tsx`를 수정한다.

import 추가:

```tsx
import { FolderActionsMenu } from "./folder-actions-menu";
import type { Folder, Link as LinkRow } from "@/lib/types";
```

props 인터페이스를 교체한다:

```tsx
interface FolderAccordionItemProps {
  folder: Folder;
  links: LinkRow[];
}

export function FolderAccordionItem({ folder, links }: FolderAccordionItemProps) {
  const [expanded, setExpanded] = useState(false);
  const { id, name } = folder;
```

그리고 우측 `ArrowUpRight` `<Link>` 바로 뒤(같은 `flex items-stretch` div 안)에 메뉴를 추가한다:

```tsx
        <div className="flex items-center border-l px-0.5">
          <FolderActionsMenu folder={folder} linkCount={links.length} />
        </div>
```

> 기존 본문에서 `id`/`name`은 그대로 사용되므로 위 구조분해로 호환된다.

- [ ] **Step 5: FolderAccordionItem 사용처 수정**

Run: `cd web && grep -rn "FolderAccordionItem" src/`
사용처에서 `<FolderAccordionItem id={f.id} name={f.name} links={...} />`를 `<FolderAccordionItem folder={f} links={...} />`로 바꾼다.

- [ ] **Step 6: 폴더 상세 헤더에 메뉴 추가**

`web/src/app/(main)/folder/[id]/page.tsx`의 `AppHeader`에서 `right={<ParaBadge ... />}`를 폴더 메뉴로 교체한다. import 추가:

```tsx
import { FolderActionsMenu } from "@/components/library/folder-actions-menu";
```

`AppHeader`의 `right` prop을 다음으로 교체:

```tsx
        right={
          <FolderActionsMenu
            folder={folder}
            linkCount={links.length}
            redirectAfterDelete={backHref}
          />
        }
```

> `ParaBadge` import가 더 이상 쓰이지 않으면 제거한다(lint 에러 방지). PARA 분류는 폴더 수정 모달에서 확인·변경 가능하다.

- [ ] **Step 7: 타입/린트 확인**

Run: `cd web && npx tsc --noEmit && npm run lint`
Expected: 에러 없음.

- [ ] **Step 8: 수동 검증**

Run: `cd web && npm run dev`
확인:
- 카테고리 페이지 폴더 카드 ⋮ → 수정/삭제.
- 폴더 상세 헤더 ⋮ → 수정/삭제(삭제 시 카테고리로 이동).
- 링크 있는 폴더 삭제 시 "링크 N개가 함께 삭제됩니다" 경고.

- [ ] **Step 9: 커밋**

```bash
git add web/src/components/library/folder-actions-menu.tsx web/src/components/library/folder-card.tsx web/src/components/library/folder-accordion-item.tsx "web/src/app/(main)/folder/[id]/page.tsx"
git commit -m "feat(web): 폴더 수정/삭제 메뉴를 목록과 상세 헤더에 추가"
```

---

## Task 8: 경량 케밥 메뉴 (extension)

**Files:**
- Create: `extension/components/ui/menu.tsx`

extension엔 메뉴 프리미티브가 없으므로 외부 클릭 시 닫히는 경량 드롭다운을 직접 만든다. (WXT/React 19 환경, `browser`/`useState` 등은 자동 import.)

- [ ] **Step 1: 컴포넌트 작성**

`extension/components/ui/menu.tsx`:

```tsx
import { MoreVertical } from "lucide-react";
import { cn } from "../../lib/utils";

export interface KebabMenuItem {
  label: string;
  onClick: () => void;
  destructive?: boolean;
}

interface KebabMenuProps {
  items: KebabMenuItem[];
  label?: string;
}

export function KebabMenu({ items, label = "메뉴" }: KebabMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-28 rounded-lg border bg-card p-1 text-xs shadow-md">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                item.onClick();
              }}
              className={cn(
                "block w-full rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-accent cursor-pointer",
                item.destructive && "text-destructive hover:bg-destructive/10",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 빌드 확인**

Run: `cd extension && npm run build`
Expected: 빌드 성공(타입 에러 없음).

- [ ] **Step 3: 커밋**

```bash
git add extension/components/ui/menu.tsx
git commit -m "feat(extension): 경량 케밥 메뉴 컴포넌트 추가"
```

---

## Task 9: 링크 수정/이동/삭제 (extension BrowseView)

**Files:**
- Modify: `extension/entrypoints/popup/BrowseView.tsx`

이미 로드된 `folders`/`links` state를 재사용. mutate 후 로컬 state 직접 갱신. 인라인 편집 폼 + 이동 select + 삭제 확인을 한 패널로 처리하는 `LinkActions` 내부 컴포넌트를 추가한다.

- [ ] **Step 1: import 보강**

`extension/entrypoints/popup/BrowseView.tsx` 상단 import에 추가한다:

```tsx
import type { ReactNode } from "react";
import { KebabMenu } from "../../components/ui/menu";
```

- [ ] **Step 2: 링크 mutate 핸들러 추가**

`BrowseView` 함수 본문 안(`openLink` 근처)에 다음 핸들러들을 추가한다:

```tsx
  async function updateLink(
    id: string,
    patch: { title?: string; description?: string | null; priority?: number; folder_id?: string | null },
  ) {
    const prev = links;
    setLinks((cur) => cur.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    const { error } = await supabase.from("links").update(patch).eq("id", id);
    if (error) {
      setLinks(prev); // 롤백
      setError(error.message);
    }
  }

  async function deleteLink(id: string) {
    const prev = links;
    setLinks((cur) => cur.filter((l) => l.id !== id));
    const { error } = await supabase.from("links").delete().eq("id", id);
    if (error) {
      setLinks(prev);
      setError(error.message);
    }
  }
```

- [ ] **Step 3: LinkRow에 메뉴/액션 상태 연결**

`LinkRow` 컴포넌트 시그니처와 호출부를 바꾼다. 먼저 `LinkRow`에 `menu` 슬롯을 추가한다(파일 하단 `function LinkRow(...)`):

```tsx
function LinkRow({
  title,
  host,
  isRead,
  priority,
  onClick,
  menu,
}: {
  title: string;
  host: string;
  isRead: boolean;
  priority: number;
  onClick: () => void;
  menu?: ReactNode;
}) {
  const dots = Math.min(2, priority);
  return (
    <div
      className={cn(
        "group flex w-full items-center gap-2 rounded-lg border bg-card px-2.5 py-2 transition-colors",
        isRead && "opacity-70",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium">{title}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            {dots > 0 && (
              <span className="flex gap-0.5" aria-label={`우선도 ${dots}`}>
                {Array.from({ length: dots }).map((_, i) => (
                  <span key={i} className="h-1 w-1 rounded-full bg-foreground" />
                ))}
              </span>
            )}
            {host && <span className="truncate font-mono">{host}</span>}
          </div>
        </div>
        <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
      {menu}
    </div>
  );
}
```

> 기존 `LinkRow`는 통째로 `<button>`이었으나, 메뉴 버튼 중첩을 피하기 위해 본문만 버튼으로 바꾸고 메뉴를 형제로 둔다.

- [ ] **Step 4: 링크 이동 대상 폴더 목록 계산 + 메뉴 렌더 헬퍼 추가**

`BrowseView` 본문에 메뉴 빌더를 추가한다(이동은 간단히 `window.prompt` 대신, 펼친 폴더 목록을 활용한 선택 UI 대신 — 일관성을 위해 KebabMenu 항목으로 "미지정으로 이동" + 각 폴더명을 동적 항목으로 제공):

```tsx
  function linkMenuItems(link: Link) {
    const moveTargets = [
      { id: null as string | null, name: "미지정" },
      ...folders
        .filter((f) => f.id !== link.folder_id)
        .map((f) => ({ id: f.id as string | null, name: f.name })),
    ].filter((t) => t.id !== (link.folder_id ?? null));

    return [
      {
        label: "수정",
        onClick: () => setEditingLinkId(link.id),
      },
      ...moveTargets.map((t) => ({
        label: `→ ${t.name}`,
        onClick: () => updateLink(link.id, { folder_id: t.id }),
      })),
      {
        label: "삭제",
        destructive: true,
        onClick: () => {
          if (confirm("이 링크를 삭제할까요?")) deleteLink(link.id);
        },
      },
    ];
  }
```

그리고 편집 중인 링크 id를 추적할 state를 `BrowseView` 상단 state 묶음에 추가한다:

```tsx
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
```

- [ ] **Step 5: 인라인 링크 편집 폼 컴포넌트 추가**

파일 하단(같은 파일 내)에 `LinkEditForm`을 추가한다:

```tsx
function LinkEditForm({
  link,
  onSave,
  onCancel,
}: {
  link: Link;
  onSave: (patch: { title: string; description: string | null; priority: number }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(link.title);
  const [priority, setPriority] = useState(link.priority ?? 0);
  return (
    <div className="space-y-2 rounded-lg border bg-card/60 p-2">
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목"
        className="h-8 text-xs"
      />
      <div className="flex gap-1">
        {[
          { v: 0, label: "보통" },
          { v: 1, label: "중요" },
          { v: 2, label: "매우" },
        ].map((opt) => (
          <button
            key={opt.v}
            type="button"
            onClick={() => setPriority(opt.v)}
            className={cn(
              "flex-1 rounded border py-1 text-[10px]",
              priority === opt.v
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="flex gap-1">
        <Button
          type="button"
          size="sm"
          className="flex-1"
          onClick={() =>
            onSave({ title: title.trim() || link.url, description: link.description, priority })
          }
        >
          저장
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          취소
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: LinkRow 호출부 2곳을 편집 분기 + 메뉴와 함께 교체**

`BrowseView`에는 `LinkRow` 사용처가 두 군데(미지정 목록, 폴더 펼침 목록) 있다. 각 `<LinkRow ... />`를 다음 패턴으로 감싼다(예시는 미지정 목록 — 폴더 목록도 동일하게 적용):

```tsx
                  <li key={link.id}>
                    {editingLinkId === link.id ? (
                      <LinkEditForm
                        link={link}
                        onCancel={() => setEditingLinkId(null)}
                        onSave={(patch) => {
                          updateLink(link.id, patch);
                          setEditingLinkId(null);
                        }}
                      />
                    ) : (
                      <LinkRow
                        title={link.title}
                        host={host(link.url)}
                        isRead={link.is_read}
                        priority={link.priority ?? 0}
                        onClick={() => openLink(link)}
                        menu={<KebabMenu items={linkMenuItems(link)} label="링크 메뉴" />}
                      />
                    )}
                  </li>
```

> 두 사용처 모두 같은 형태로 바꾼다.

- [ ] **Step 7: 빌드/수동 검증**

Run: `cd extension && npm run build`
Expected: 빌드 성공.
그 후 `npm run dev`로 확장 로드 → 링크 ⋮에서 수정(인라인 폼)/→폴더이동/삭제 동작, 갱신이 즉시 반영되는지 확인.

- [ ] **Step 8: 커밋**

```bash
git add extension/entrypoints/popup/BrowseView.tsx
git commit -m "feat(extension): 링크 수정/이동/삭제 액션 추가"
```

---

## Task 10: 폴더 수정/삭제 (extension BrowseView)

**Files:**
- Modify: `extension/entrypoints/popup/BrowseView.tsx`

폴더 헤더에 ⋮ 추가. 수정은 이름 인라인 + PARA 이동, 삭제는 링크 수 경고. mutate 후 로컬 state 갱신(폴더 삭제 시 소속 링크도 state에서 제거).

- [ ] **Step 1: 폴더 mutate 핸들러 추가**

`BrowseView` 본문에 추가한다:

```tsx
  async function updateFolder(
    id: string,
    patch: { name?: string; para_category?: ParaCategory | null },
  ) {
    const { data, error } = await supabase
      .from("folders")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      setError(
        error.code === "23505" ? "이미 같은 이름의 폴더가 있어요" : error.message,
      );
      return false;
    }
    setFolders((cur) => cur.map((f) => (f.id === id ? (data as Folder) : f)));
    return true;
  }

  async function deleteFolder(id: string) {
    const prevFolders = folders;
    const prevLinks = links;
    setFolders((cur) => cur.filter((f) => f.id !== id));
    setLinks((cur) => cur.filter((l) => l.folder_id !== id));
    const { error } = await supabase.from("folders").delete().eq("id", id);
    if (error) {
      setFolders(prevFolders);
      setLinks(prevLinks);
      setError(error.message);
    }
  }
```

- [ ] **Step 2: 편집 중 폴더 state + 메뉴 빌더 추가**

state 추가:

```tsx
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
```

메뉴 빌더 추가:

```tsx
  function folderMenuItems(folder: Folder, linkCount: number) {
    return [
      { label: "수정", onClick: () => setEditingFolderId(folder.id) },
      {
        label: "삭제",
        destructive: true,
        onClick: () => {
          const msg =
            linkCount === 0
              ? "이 폴더를 삭제할까요?"
              : `이 폴더와 링크 ${linkCount}개가 함께 삭제됩니다. 삭제할까요?`;
          if (confirm(msg)) deleteFolder(folder.id);
        },
      },
    ];
  }
```

- [ ] **Step 3: 폴더 인라인 수정 폼 컴포넌트 추가**

파일 하단에 추가한다(`PARA_ORDER`, `PARA_TOKENS`는 이미 import됨):

```tsx
function FolderEditForm({
  folder,
  onSave,
  onCancel,
}: {
  folder: Folder;
  onSave: (patch: { name: string; para_category: ParaCategory | null }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(folder.name);
  const [para, setPara] = useState<ParaCategory | "unassigned">(
    folder.para_category ?? "unassigned",
  );
  const options: { value: ParaCategory | "unassigned"; label: string }[] = [
    ...PARA_ORDER.map((c) => ({ value: c, label: PARA_TOKENS[c].label })),
    { value: "unassigned", label: "미지정" },
  ];
  return (
    <div className="space-y-2 p-2">
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="폴더 이름"
        className="h-8 text-xs"
      />
      <div className="grid grid-cols-3 gap-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setPara(opt.value)}
            className={cn(
              "rounded border py-1 text-[10px]",
              para === opt.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="flex gap-1">
        <Button
          type="button"
          size="sm"
          className="flex-1"
          disabled={!name.trim()}
          onClick={() =>
            onSave({
              name: name.trim(),
              para_category: para === "unassigned" ? null : para,
            })
          }
        >
          저장
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          취소
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 폴더 헤더에 메뉴/편집 분기 연결**

`visibleFolders.map(...)` 내부에서, 폴더 행(`<div className="group flex items-stretch">`) 영역을 편집 분기로 감싼다. `isOpen` 토글 버튼이 들어있는 `<div className="group flex items-stretch">...</div>` 전체를 다음으로 교체한다:

```tsx
                    {editingFolderId === folder.id ? (
                      <FolderEditForm
                        folder={folder}
                        onCancel={() => setEditingFolderId(null)}
                        onSave={async (patch) => {
                          const ok = await updateFolder(folder.id, patch);
                          if (ok) setEditingFolderId(null);
                        }}
                      />
                    ) : (
                      <div className="group flex items-stretch">
                        <button
                          type="button"
                          onClick={() => toggleFolder(folder.id)}
                          aria-expanded={isOpen}
                          className="flex flex-1 items-center gap-2 px-3 py-2.5 text-left transition-colors active:bg-accent cursor-pointer"
                        >
                          {isOpen ? (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          )}
                          {isUnassigned ? (
                            <Inbox className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          ) : (
                            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          )}
                          <span className="flex-1 truncate text-xs font-medium">
                            {folder.name}
                          </span>
                          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                            {folderLinks.length}
                          </span>
                        </button>
                        {onAddLinkToFolder && (
                          <button
                            type="button"
                            onClick={() => onAddLinkToFolder(folder.id)}
                            aria-label={`${folder.name}에 링크 추가`}
                            title="이 폴더에 링크 추가"
                            className="flex w-8 items-center justify-center border-l text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:text-foreground active:bg-accent cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <div className="flex items-center border-l px-0.5">
                          <KebabMenu
                            items={folderMenuItems(folder, folderLinks.length)}
                            label="폴더 메뉴"
                          />
                        </div>
                      </div>
                    )}
```

> 기존 폴더 행 마크업을 그대로 옮기고 ⋮만 추가한 형태다. `isOpen && (...)` 펼침 블록은 그대로 둔다.

- [ ] **Step 5: 빌드/수동 검증**

Run: `cd extension && npm run build`
Expected: 빌드 성공.
`npm run dev`로 확인: 폴더 ⋮ → 수정(이름+PARA 인라인 폼)/삭제. 링크 있는 폴더 삭제 시 개수 경고, 삭제 후 목록과 소속 링크가 사라지는지 확인.

- [ ] **Step 6: 커밋**

```bash
git add extension/entrypoints/popup/BrowseView.tsx
git commit -m "feat(extension): 폴더 수정/삭제 액션 추가"
```

---

## 최종 검증

- [ ] **web 전체 점검**

Run: `cd web && npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: 모두 통과.

- [ ] **extension 빌드**

Run: `cd extension && npm run build`
Expected: 통과.

- [ ] **수동 시나리오(양 플랫폼)**
  - 링크: 수정(제목/메모/우선도), 다른 폴더로 이동, 미지정으로 이동, 삭제.
  - 폴더: 이름 변경, PARA 분류 변경(중복 이름 시 친절 메시지), 링크 포함 폴더 삭제(경고+cascade).
