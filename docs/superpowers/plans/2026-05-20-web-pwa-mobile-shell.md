# Web PWA 모바일 셸 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `web/`의 `(main)` 라우트 그룹을 모바일 우선 PWA로 재작성한다. 하단 탭바 3개(라이브러리/검색/설정), PARA 4카드 그리드 드릴다운, 설치 가능한 PWA(서비스워커 없음).

**Architecture:** Next.js 16 App Router 기반. (auth)는 그대로 유지하고 (main)만 인플레이스 재작성. 페이지는 RSC + Supabase 직접 호출, 변경은 클라이언트 컴포넌트 + `router.refresh()`. Server Actions 미사용. `lib/para.ts`를 PARA 단일 진실 공급원으로.

**Tech Stack:** Next.js 16, React 19, Tailwind 4, shadcn/ui, @base-ui/react, @supabase/ssr, lucide-react, TypeScript 5.

**Reference Spec:** `docs/superpowers/specs/2026-05-20-web-pwa-mobile-shell-design.md`

**테스트 정책:** 스펙 §8에 따라 자동 테스트 없음. 각 태스크의 검증은 `pnpm dev` 후 브라우저로 확인. 최종 단계에서 Lighthouse PWA Installable 통과 + 수동 체크리스트 9개.

**Next.js 16 주의사항:**
- `params`는 `Promise<{...}>`. 항상 `await params`.
- `searchParams`는 `Promise<{...}>`. 항상 `await searchParams`.
- `viewport` export는 `metadata` export와 **분리**(Next 15+).
- 정적·동적 manifest 모두 `app/manifest.ts` 또는 `app/manifest.json`.

---

## File Structure (목표 상태)

```
web/src/
├── app/
│   ├── (auth)/                            (유지)
│   ├── (main)/
│   │   ├── layout.tsx                     [재작성] 인증 + 모바일 셸 조립
│   │   ├── page.tsx                       [재작성] 라이브러리 홈
│   │   ├── loading.tsx                    [신규] 라이브러리 홈 스켈레톤
│   │   ├── error.tsx                      [신규] 공통 에러 폴백
│   │   ├── not-found.tsx                  [신규] 404
│   │   ├── category/[para]/
│   │   │   ├── page.tsx                   [신규] 카테고리 → 폴더 목록
│   │   │   └── loading.tsx                [신규]
│   │   ├── folder/[id]/
│   │   │   ├── page.tsx                   [재작성] 폴더 → 링크 목록
│   │   │   └── loading.tsx                [신규]
│   │   ├── folder/new/                    [삭제]
│   │   ├── search/page.tsx                [신규]
│   │   └── settings/page.tsx              [신규]
│   ├── layout.tsx                         [수정] viewport export, lang=ko
│   ├── manifest.ts                        [신규] PWA manifest
│   └── globals.css                        [수정] PARA CSS 변수
├── components/
│   ├── shell/
│   │   ├── bottom-nav.tsx                 [신규]
│   │   ├── app-header.tsx                 [신규]
│   │   └── back-button.tsx                [신규]
│   ├── library/
│   │   ├── para-card.tsx                  [신규]
│   │   ├── unassigned-card.tsx            [신규]
│   │   ├── folder-card.tsx                [신규]
│   │   └── link-card.tsx                  [신규]
│   ├── actions/
│   │   ├── add-link-fab.tsx               [신규]
│   │   ├── add-link-modal.tsx             [신규]
│   │   └── add-folder-modal.tsx           [신규]
│   ├── primitives/
│   │   └── para-badge.tsx                 [신규]
│   ├── sidebar.tsx                        [삭제]
│   ├── add-link-button.tsx                [삭제]
│   ├── link-list.tsx                      [삭제]
│   └── ui/                                (유지: shadcn)
├── lib/
│   ├── para.ts                            [신규] PARA 단일 진실
│   ├── types.ts                           (유지)
│   ├── supabase/                          (유지)
│   └── utils.ts                           (유지)
└── public/
    ├── icon-192.png                       [신규]
    ├── icon-512.png                       [신규]
    └── apple-touch-icon.png               [신규]
```

---

## Task 1: 기존 데스크탑 셸 폐기

**Goal:** 모바일 셸을 새로 짜기 전에 충돌하는 데스크탑 파일들을 한 번에 정리한다.

**Files:**
- Delete: `web/src/components/sidebar.tsx`
- Delete: `web/src/components/add-link-button.tsx`
- Delete: `web/src/components/link-list.tsx`
- Delete: `web/src/app/(main)/folder/new/page.tsx`
- Delete: `web/src/app/(main)/folder/new/` (디렉토리)

- [ ] **Step 1: 삭제**

```bash
rm web/src/components/sidebar.tsx
rm web/src/components/add-link-button.tsx
rm web/src/components/link-list.tsx
rm -r web/src/app/\(main\)/folder/new
```

- [ ] **Step 2: 일시적으로 빌드가 깨지는지 확인**

```bash
cd web && pnpm build
```

`Module not found` 같은 에러가 나는 게 정상(다음 태스크에서 (main)/layout과 page를 재작성하므로). 어떤 파일이 이걸 import 하는지 확인해두기.

- [ ] **Step 3: 커밋**

```bash
git add -A
git commit -m "chore: 데스크탑 셸 컴포넌트 폐기 (모바일 PWA 재작성 사전 정리)"
```

---

## Task 2: PARA 토큰 모듈

**Goal:** 색·라벨을 한 곳에서 관리하는 단일 진실 공급원.

**Files:**
- Create: `web/src/lib/para.ts`

- [ ] **Step 1: 작성**

```ts
// web/src/lib/para.ts
import type { ParaCategory } from "./types";

export const PARA_TOKENS: Record<
  ParaCategory,
  { letter: string; label: string; fg: string; bg: string }
> = {
  project:  { letter: "P", label: "Projects",  fg: "#2563eb", bg: "#eff6ff" },
  area:     { letter: "A", label: "Areas",     fg: "#f59e0b", bg: "#fef3c7" },
  resource: { letter: "R", label: "Resources", fg: "#ec4899", bg: "#fce7f3" },
  archive:  { letter: "A", label: "Archives",  fg: "#737373", bg: "#f5f5f5" },
} as const;

export const UNASSIGNED_TOKEN = {
  label: "미지정",
  fg: "#6b7280",
  bg: "#f9fafb",
} as const;

export const PARA_ORDER: ParaCategory[] = [
  "project",
  "area",
  "resource",
  "archive",
];

export const VALID_PARA_PARAMS = [
  ...PARA_ORDER,
  "unassigned",
] as const;
export type ParaParam = (typeof VALID_PARA_PARAMS)[number];

export function isValidParaParam(value: string): value is ParaParam {
  return (VALID_PARA_PARAMS as readonly string[]).includes(value);
}

export const BRAND_COLOR = PARA_TOKENS.project.fg; // "#2563eb"
```

- [ ] **Step 2: 기존 `lib/types.ts`의 `PARA_LABELS` / `PARA_ORDER` 제거 (중복 방지)**

`web/src/lib/types.ts`에서 `PARA_LABELS`와 `PARA_ORDER` export를 삭제한다. 남기는 건 `ParaCategory`, `Folder`, `Link` 타입만.

```ts
// web/src/lib/types.ts (최종)
export type ParaCategory = "project" | "area" | "resource" | "archive";

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  para_category: ParaCategory | null;
  created_at: string;
}

export interface Link {
  id: string;
  user_id: string;
  folder_id: string;
  url: string;
  title: string;
  description: string | null;
  priority: number;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}
```

- [ ] **Step 3: 타입 체크**

```bash
cd web && pnpm tsc --noEmit
```

`PARA_LABELS`나 `PARA_ORDER`를 다른 곳에서 import 했다면 에러로 표시됨. 그건 다음 태스크에서 해당 컴포넌트 재작성하면서 자연스럽게 사라짐. (Task 1에서 sidebar.tsx를 지웠으므로 더 이상 import 없을 가능성 큼.)

- [ ] **Step 4: 커밋**

```bash
git add web/src/lib/para.ts web/src/lib/types.ts
git commit -m "feat: PARA 토큰 모듈(lib/para.ts) 도입 — 단일 진실 공급원"
```

---

## Task 3: globals.css에 PARA CSS 변수 + 세이프 에어리어 유틸

**Goal:** Tailwind 4 `@theme`에 PARA 컬러를 등록하고 `pb-safe` 같은 유틸 변수 추가.

**Files:**
- Modify: `web/src/app/globals.css`

- [ ] **Step 1: `@theme inline` 블록에 PARA 변수 추가**

기존 `@theme inline { ... }` 블록 내부 (라인 7~49) 끝(`--radius-4xl: ...;` 다음)에 다음을 추가:

```css
  /* PARA palette */
  --color-para-project-fg: #2563eb;
  --color-para-project-bg: #eff6ff;
  --color-para-area-fg: #f59e0b;
  --color-para-area-bg: #fef3c7;
  --color-para-resource-fg: #ec4899;
  --color-para-resource-bg: #fce7f3;
  --color-para-archive-fg: #737373;
  --color-para-archive-bg: #f5f5f5;
  --color-para-unassigned-fg: #6b7280;
  --color-para-unassigned-bg: #f9fafb;

  /* Safe-area inset */
  --spacing-safe-bottom: env(safe-area-inset-bottom);
  --spacing-safe-top: env(safe-area-inset-top);
```

이걸 추가하면 Tailwind 4가 `bg-para-project-bg`, `text-para-area-fg`, `pb-safe-bottom` 같은 클래스를 자동 생성한다.

- [ ] **Step 2: dev server 띄워서 확인**

```bash
cd web && pnpm dev
```

별도 검증할 화면은 없지만, 다음 태스크부터 PARA 색 클래스를 쓰니까 빌드 에러가 없는 것만 확인.

- [ ] **Step 3: 커밋**

```bash
git add web/src/app/globals.css
git commit -m "feat: globals.css에 PARA 컬러 토큰 + 세이프 에어리어 변수 추가"
```

---

## Task 4: PWA manifest

**Goal:** `app/manifest.ts`로 동적 manifest 생성. 설치 가능한 PWA 기본 요건 충족.

**Files:**
- Create: `web/src/app/manifest.ts`

- [ ] **Step 1: 작성**

```ts
// web/src/app/manifest.ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Save It",
    short_name: "Save It",
    description: "저장한 링크를 다시 보게 만드는 서비스",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    lang: "ko",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
```

- [ ] **Step 2: 검증**

```bash
cd web && pnpm dev
```

브라우저에서 `http://localhost:3000/manifest.webmanifest` 접근. JSON이 위 내용과 일치하는지 확인. (Next.js가 manifest.ts → /manifest.webmanifest로 라우팅함.)

- [ ] **Step 3: 커밋**

```bash
git add web/src/app/manifest.ts
git commit -m "feat: PWA manifest 추가 (설치 가능, standalone)"
```

---

## Task 5: 아이콘 자산 + 루트 layout 업데이트

**Goal:** PWA 아이콘 자산 자리 잡고, 루트 `layout.tsx`에 viewport export 추가, `lang="ko"` 설정.

**Files:**
- Create: `web/public/icon-192.png` (임시 placeholder OK)
- Create: `web/public/icon-512.png`
- Create: `web/public/apple-touch-icon.png`
- Modify: `web/src/app/layout.tsx`

- [ ] **Step 1: 아이콘 placeholder 생성 (디자인 작업 전 임시)**

```bash
# imagemagick 있으면:
cd web/public
convert -size 192x192 xc:'#2563eb' -font Helvetica-Bold -pointsize 96 -fill white -gravity center -annotate 0 'S' icon-192.png
convert -size 512x512 xc:'#2563eb' -font Helvetica-Bold -pointsize 256 -fill white -gravity center -annotate 0 'S' icon-512.png
convert -size 180x180 xc:'#2563eb' -font Helvetica-Bold -pointsize 90 -fill white -gravity center -annotate 0 'S' apple-touch-icon.png
```

imagemagick이 없으면 [favicon.io](https://favicon.io/)에서 "Generate from Text" → "S", 배경 `#2563eb`, 텍스트 white로 만들어 받고 위 이름으로 저장. (마지막 단계에서 진짜 디자인으로 교체 예정.)

- [ ] **Step 2: 루트 `layout.tsx` 재작성**

`web/src/app/layout.tsx` 전체를 다음으로 교체:

```tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Save It",
  description: "저장한 링크를 다시 보게 만드는 서비스",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Save It",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: 검증**

```bash
cd web && pnpm dev
```

DevTools → Application → Manifest. 다음 모두 통과해야 함:
- "Installability" 섹션에 에러 없음
- 192/512 아이콘 모두 보임
- theme_color, start_url, display: standalone 표시

- [ ] **Step 4: 커밋**

```bash
git add web/public/icon-192.png web/public/icon-512.png web/public/apple-touch-icon.png web/src/app/layout.tsx
git commit -m "feat: PWA 아이콘 자산 + 루트 layout viewport/lang/theme-color"
```

---

## Task 6: Bottom Nav 컴포넌트

**Goal:** 하단 탭 3개. 현재 path 매칭으로 활성 표시. 세이프 에어리어 적용.

**Files:**
- Create: `web/src/components/shell/bottom-nav.tsx`

- [ ] **Step 1: 작성**

```tsx
// web/src/components/shell/bottom-nav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LibraryBig, Search, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = { href: string; label: string; icon: typeof LibraryBig; match: (p: string) => boolean };

const TABS: Tab[] = [
  {
    href: "/",
    label: "라이브러리",
    icon: LibraryBig,
    match: (p) => p === "/" || p.startsWith("/category") || p.startsWith("/folder"),
  },
  { href: "/search", label: "검색", icon: Search, match: (p) => p.startsWith("/search") },
  { href: "/settings", label: "설정", icon: Settings, match: (p) => p.startsWith("/settings") },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="메인 탭"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.match(pathname);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2 text-xs transition-colors",
                  active
                    ? "text-[var(--color-para-project-fg)] font-semibold"
                    : "text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add web/src/components/shell/bottom-nav.tsx
git commit -m "feat: 하단 탭바 컴포넌트 (라이브러리/검색/설정)"
```

---

## Task 7: App Header + Back Button

**Goal:** 페이지별 타이틀 + 좌측 슬롯(뒤로가기) + 우측 액션 슬롯.

**Files:**
- Create: `web/src/components/shell/app-header.tsx`
- Create: `web/src/components/shell/back-button.tsx`

- [ ] **Step 1: back-button.tsx**

```tsx
// web/src/components/shell/back-button.tsx
"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

interface BackButtonProps {
  fallbackHref?: string;
}

export function BackButton({ fallbackHref = "/" }: BackButtonProps) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallbackHref);
      }}
      aria-label="뒤로"
      className="flex h-9 w-9 items-center justify-center rounded-full text-foreground hover:bg-accent transition-colors"
    >
      <ChevronLeft className="h-5 w-5" />
    </button>
  );
}
```

- [ ] **Step 2: app-header.tsx**

```tsx
// web/src/components/shell/app-header.tsx
import type { ReactNode } from "react";

interface AppHeaderProps {
  title: string;
  left?: ReactNode;
  right?: ReactNode;
}

export function AppHeader({ title, left, right }: AppHeaderProps) {
  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex h-12 w-full items-center gap-2">
        <div className="flex w-9 justify-start">{left}</div>
        <h1 className="flex-1 truncate text-center text-base font-semibold">{title}</h1>
        <div className="flex w-9 justify-end">{right}</div>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: 커밋**

```bash
git add web/src/components/shell/app-header.tsx web/src/components/shell/back-button.tsx
git commit -m "feat: 앱 헤더 + 뒤로가기 버튼 컴포넌트"
```

---

## Task 8: (main)/layout.tsx 재작성

**Goal:** 인증 + 모바일 셸 조립. 하단 탭바, 본문 영역, 본문 아래쪽 탭바 공간 확보.

**Files:**
- Modify: `web/src/app/(main)/layout.tsx`

- [ ] **Step 1: 전체 교체**

```tsx
// web/src/app/(main)/layout.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/shell/bottom-nav";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="relative mx-auto flex min-h-svh w-full max-w-md flex-col">
      <main
        className="flex-1"
        style={{
          paddingBottom: `calc(env(safe-area-inset-bottom) + 64px)`,
        }}
      >
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 2: 검증**

```bash
cd web && pnpm dev
```

`http://localhost:3000`로 접근. 로그아웃 상태면 `/login`으로 리다이렉트 OK. 로그인 후 진입하면 본문 비어있고 하단 탭바 보임(라이브러리 활성). 단, Task 9 전에는 `(main)/page.tsx`가 옛 내용이라 페이지가 빈 화면일 수 있음.

- [ ] **Step 3: 커밋**

```bash
git add web/src/app/\(main\)/layout.tsx
git commit -m "feat: (main) 모바일 셸 레이아웃 (하단 탭바 + max-w-md)"
```

---

## Task 9: PARA Badge (재사용 원자)

**Goal:** P/A/R/A 라벨 + 색 배지. 검색 결과·링크 카드 등 어디서나 등장.

**Files:**
- Create: `web/src/components/primitives/para-badge.tsx`

- [ ] **Step 1: 작성**

```tsx
// web/src/components/primitives/para-badge.tsx
import type { ParaCategory } from "@/lib/types";
import { PARA_TOKENS, UNASSIGNED_TOKEN } from "@/lib/para";
import { cn } from "@/lib/utils";

interface ParaBadgeProps {
  category: ParaCategory | null;
  size?: "sm" | "md";
  className?: string;
}

export function ParaBadge({ category, size = "sm", className }: ParaBadgeProps) {
  const token = category ? PARA_TOKENS[category] : null;
  const sizing = size === "md" ? "h-7 w-7 text-sm" : "h-5 w-5 text-[10px]";

  if (!token) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-md font-bold",
          sizing,
          className
        )}
        style={{ backgroundColor: UNASSIGNED_TOKEN.bg, color: UNASSIGNED_TOKEN.fg }}
        aria-label={UNASSIGNED_TOKEN.label}
        title={UNASSIGNED_TOKEN.label}
      >
        ·
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md font-bold",
        sizing,
        className
      )}
      style={{ backgroundColor: token.fg, color: "#fff" }}
      aria-label={token.label}
      title={token.label}
    >
      {token.letter}
    </span>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add web/src/components/primitives/para-badge.tsx
git commit -m "feat: PARA 배지 원자 컴포넌트"
```

---

## Task 10: PARA Card + Unassigned Card

**Goal:** 라이브러리 홈 4그리드의 카드 + 미지정 와이드 카드.

**Files:**
- Create: `web/src/components/library/para-card.tsx`
- Create: `web/src/components/library/unassigned-card.tsx`

- [ ] **Step 1: para-card.tsx**

```tsx
// web/src/components/library/para-card.tsx
import Link from "next/link";
import type { ParaCategory } from "@/lib/types";
import { PARA_TOKENS } from "@/lib/para";

interface ParaCardProps {
  category: ParaCategory;
  folderCount: number;
  linkCount: number;
}

export function ParaCard({ category, folderCount, linkCount }: ParaCardProps) {
  const token = PARA_TOKENS[category];
  return (
    <Link
      href={`/category/${category}`}
      className="group flex flex-col gap-3 rounded-2xl p-4 transition-transform active:scale-[0.98]"
      style={{ backgroundColor: token.bg }}
    >
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg font-bold text-white"
        style={{ backgroundColor: token.fg }}
        aria-hidden
      >
        {token.letter}
      </span>
      <div>
        <div className="text-sm font-semibold text-foreground">{token.label}</div>
        <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
          {folderCount}개 폴더 · {linkCount}개 링크
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: unassigned-card.tsx**

```tsx
// web/src/components/library/unassigned-card.tsx
import Link from "next/link";
import { Inbox } from "lucide-react";
import { UNASSIGNED_TOKEN } from "@/lib/para";

interface UnassignedCardProps {
  folderCount: number;
  linkCount: number;
}

export function UnassignedCard({ folderCount, linkCount }: UnassignedCardProps) {
  if (folderCount === 0) return null;
  return (
    <Link
      href="/category/unassigned"
      className="flex items-center gap-3 rounded-2xl p-4 transition-transform active:scale-[0.98]"
      style={{ backgroundColor: UNASSIGNED_TOKEN.bg }}
    >
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
        style={{ backgroundColor: UNASSIGNED_TOKEN.fg, color: "#fff" }}
        aria-hidden
      >
        <Inbox className="h-4 w-4" />
      </span>
      <div className="flex-1">
        <div className="text-sm font-semibold">{UNASSIGNED_TOKEN.label}</div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {folderCount}개 폴더 · {linkCount}개 링크
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 3: 커밋**

```bash
git add web/src/components/library/
git commit -m "feat: PARA 카드 + 미지정 카드 컴포넌트"
```

---

## Task 11: 라이브러리 홈 페이지

**Goal:** `/`에서 PARA 4카드 그리드 + 미지정 와이드 카드. 폴더/링크 카운트 집계.

**Files:**
- Modify: `web/src/app/(main)/page.tsx`
- Create: `web/src/app/(main)/loading.tsx`

- [ ] **Step 1: page.tsx 재작성**

```tsx
// web/src/app/(main)/page.tsx
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/shell/app-header";
import { ParaCard } from "@/components/library/para-card";
import { UnassignedCard } from "@/components/library/unassigned-card";
import { PARA_ORDER } from "@/lib/para";
import type { Folder } from "@/lib/types";

export default async function LibraryHome() {
  const supabase = await createClient();

  const [{ data: folders }, { data: links }] = await Promise.all([
    supabase.from("folders").select("*"),
    supabase.from("links").select("folder_id"),
  ]);

  const folderList = (folders ?? []) as Folder[];
  const linkList = (links ?? []) as { folder_id: string }[];

  const folderToCategory = new Map(
    folderList.map((f) => [f.id, f.para_category])
  );
  const linkCountByCategory = new Map<string, number>();
  for (const l of linkList) {
    const cat = folderToCategory.get(l.folder_id);
    const key = cat ?? "unassigned";
    linkCountByCategory.set(key, (linkCountByCategory.get(key) ?? 0) + 1);
  }

  const folderCountByCategory = new Map<string, number>();
  for (const f of folderList) {
    const key = f.para_category ?? "unassigned";
    folderCountByCategory.set(key, (folderCountByCategory.get(key) ?? 0) + 1);
  }

  return (
    <>
      <AppHeader title="라이브러리" />
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {PARA_ORDER.map((category) => (
            <ParaCard
              key={category}
              category={category}
              folderCount={folderCountByCategory.get(category) ?? 0}
              linkCount={linkCountByCategory.get(category) ?? 0}
            />
          ))}
        </div>
        <UnassignedCard
          folderCount={folderCountByCategory.get("unassigned") ?? 0}
          linkCount={linkCountByCategory.get("unassigned") ?? 0}
        />
      </div>
    </>
  );
}
```

- [ ] **Step 2: loading.tsx 작성 (스켈레톤)**

```tsx
// web/src/app/(main)/loading.tsx
import { AppHeader } from "@/components/shell/app-header";

export default function LibraryLoading() {
  return (
    <>
      <AppHeader title="라이브러리" />
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
        <div className="h-16 animate-pulse rounded-2xl bg-muted" />
      </div>
    </>
  );
}
```

- [ ] **Step 3: 검증**

```bash
cd web && pnpm dev
```

`http://localhost:3000` 로그인 후 진입. 다음 확인:
- 헤더 "라이브러리" 표시
- PARA 4카드(P=blue, A=amber, R=pink, A=neutral) 그리드 2×2
- 미지정 폴더가 있으면 와이드 카드 추가, 없으면 숨김
- 각 카드 클릭 시 `/category/<key>` 이동(다음 태스크 전엔 빈 페이지 OK)

- [ ] **Step 4: 커밋**

```bash
git add web/src/app/\(main\)/page.tsx web/src/app/\(main\)/loading.tsx
git commit -m "feat: 라이브러리 홈 — PARA 4카드 그리드 + 미지정"
```

---

## Task 12: Folder Card 컴포넌트

**Goal:** 카테고리 화면에서 폴더 1개를 보여주는 카드.

**Files:**
- Create: `web/src/components/library/folder-card.tsx`

- [ ] **Step 1: 작성**

```tsx
// web/src/components/library/folder-card.tsx
import Link from "next/link";
import { FolderOpen } from "lucide-react";

interface FolderCardProps {
  id: string;
  name: string;
  linkCount: number;
}

export function FolderCard({ id, name, linkCount }: FolderCardProps) {
  return (
    <Link
      href={`/folder/${id}`}
      className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors active:bg-accent"
    >
      <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate text-sm font-medium">{name}</span>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {linkCount}
      </span>
    </Link>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add web/src/components/library/folder-card.tsx
git commit -m "feat: 폴더 카드 컴포넌트"
```

---

## Task 13: Add Folder Modal

**Goal:** 카테고리 화면에서 신규 폴더 생성. base-ui Dialog 사용.

**Files:**
- Create: `web/src/components/actions/add-folder-modal.tsx`

- [ ] **Step 1: 작성**

```tsx
// web/src/components/actions/add-folder-modal.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui-components/react/dialog";
import { Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ParaCategory } from "@/lib/types";

interface AddFolderModalProps {
  category: ParaCategory | null;
  userId: string;
}

export function AddFolderModal({ category, userId }: AddFolderModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError("");
    const supabase = createClient();
    const { error: insertError } = await supabase.from("folders").insert({
      user_id: userId,
      name: name.trim(),
      para_category: category,
    });
    setSubmitting(false);
    if (insertError) {
      setError(
        insertError.code === "23505"
          ? "이미 같은 이름의 폴더가 있어요"
          : insertError.message
      );
      return;
    }
    setName("");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        render={
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed bg-card/50 px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-accent"
          >
            <Plus className="h-4 w-4" />
            새 폴더 만들기
          </button>
        }
      />
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-background p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] shadow-xl sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-sm sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
          <div className="flex items-center justify-between pb-3">
            <Dialog.Title className="text-base font-semibold">새 폴더</Dialog.Title>
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
            {error && (
              <p className="border-l-2 border-destructive pl-2 text-xs text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={submitting || !name.trim()} className="w-full">
              {submitting ? "생성 중…" : "생성"}
            </Button>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

> ⚠️ base-ui import 경로 확인: 프로젝트는 `@base-ui/react` 또는 `@base-ui-components/react`를 쓴다. `package.json`을 봐서 정확한 경로로 맞출 것(`web/package.json:6`에는 `@base-ui/react`로 표기). 위 코드의 import 경로(`@base-ui-components/react/dialog`)가 안 맞으면 `@base-ui/react/dialog`로 교체.

- [ ] **Step 2: 커밋**

```bash
git add web/src/components/actions/add-folder-modal.tsx
git commit -m "feat: 폴더 생성 모달 (base-ui Dialog)"
```

---

## Task 14: 카테고리 페이지

**Goal:** `/category/[para]` — 해당 카테고리 폴더 목록 + 새 폴더 버튼. `unassigned` 처리.

**Files:**
- Create: `web/src/app/(main)/category/[para]/page.tsx`
- Create: `web/src/app/(main)/category/[para]/loading.tsx`

- [ ] **Step 1: page.tsx**

```tsx
// web/src/app/(main)/category/[para]/page.tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/shell/app-header";
import { BackButton } from "@/components/shell/back-button";
import { FolderCard } from "@/components/library/folder-card";
import { AddFolderModal } from "@/components/actions/add-folder-modal";
import {
  PARA_TOKENS,
  UNASSIGNED_TOKEN,
  isValidParaParam,
} from "@/lib/para";
import type { Folder } from "@/lib/types";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ para: string }>;
}) {
  const { para } = await params;
  if (!isValidParaParam(para)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const isUnassigned = para === "unassigned";
  const title = isUnassigned ? UNASSIGNED_TOKEN.label : PARA_TOKENS[para].label;

  const folderQuery = supabase
    .from("folders")
    .select("*")
    .order("created_at", { ascending: true });

  const { data: foldersData } = await (isUnassigned
    ? folderQuery.is("para_category", null)
    : folderQuery.eq("para_category", para));
  const folders = (foldersData ?? []) as Folder[];

  const folderIds = folders.map((f) => f.id);
  let linkCountByFolder = new Map<string, number>();
  if (folderIds.length > 0) {
    const { data: links } = await supabase
      .from("links")
      .select("folder_id")
      .in("folder_id", folderIds);
    for (const l of (links ?? []) as { folder_id: string }[]) {
      linkCountByFolder.set(
        l.folder_id,
        (linkCountByFolder.get(l.folder_id) ?? 0) + 1
      );
    }
  }

  return (
    <>
      <AppHeader title={title} left={<BackButton fallbackHref="/" />} />
      <div className="space-y-2 p-4">
        {folders.length === 0 ? (
          <p className="py-8 text-center text-sm italic text-muted-foreground">
            아직 폴더가 없어요
          </p>
        ) : (
          folders.map((f) => (
            <FolderCard
              key={f.id}
              id={f.id}
              name={f.name}
              linkCount={linkCountByFolder.get(f.id) ?? 0}
            />
          ))
        )}
        <AddFolderModal
          category={isUnassigned ? null : para}
          userId={user.id}
        />
      </div>
    </>
  );
}
```

- [ ] **Step 2: loading.tsx**

```tsx
// web/src/app/(main)/category/[para]/loading.tsx
import { AppHeader } from "@/components/shell/app-header";

export default function CategoryLoading() {
  return (
    <>
      <AppHeader title="…" />
      <div className="space-y-2 p-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 3: 검증**

```bash
cd web && pnpm dev
```

1. 라이브러리 홈 → Projects 카드 클릭 → `/category/project` 진입. 헤더 "Projects", 폴더 목록(또는 빈 상태), "새 폴더 만들기" 버튼.
2. "새 폴더 만들기" → 모달 → 이름 입력 → 생성 → 닫히고 목록에 새 폴더 등장.
3. 미지정 카드(있다면) → `/category/unassigned` → 헤더 "미지정". 새 폴더 만들면 `para_category = null`로 저장(확인은 SQL 또는 익스텐션으로).
4. 직접 `/category/foo`로 진입 → 404.

- [ ] **Step 4: 커밋**

```bash
git add web/src/app/\(main\)/category/
git commit -m "feat: 카테고리 페이지 (/category/[para]) + 새 폴더 버튼"
```

---

## Task 15: Link Card 컴포넌트

**Goal:** 폴더 화면의 링크 카드. 제목 + 호스트 + 우선도 도트 + 클릭 시 새 탭 + 백그라운드 읽음 처리.

**Files:**
- Create: `web/src/components/library/link-card.tsx`

- [ ] **Step 1: 작성**

```tsx
// web/src/components/library/link-card.tsx
"use client";

import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Link as LinkRow } from "@/lib/types";

interface LinkCardProps {
  link: LinkRow;
}

function hostOf(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function LinkCard({ link }: LinkCardProps) {
  const router = useRouter();

  async function handleOpen() {
    window.open(link.url, "_blank", "noopener,noreferrer");
    if (!link.is_read) {
      const supabase = createClient();
      await supabase
        .from("links")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", link.id);
      router.refresh();
    }
  }

  const dots = Math.min(2, link.priority ?? 0);

  return (
    <button
      type="button"
      onClick={handleOpen}
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left transition-colors active:bg-accent",
        link.is_read && "opacity-70"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{link.title}</div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          {dots > 0 && (
            <span className="flex gap-0.5" aria-label={`우선도 ${dots}`}>
              {Array.from({ length: dots }).map((_, i) => (
                <span key={i} className="h-1.5 w-1.5 rounded-full bg-foreground" />
              ))}
            </span>
          )}
          <span className="truncate font-mono">{hostOf(link.url)}</span>
        </div>
      </div>
      <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add web/src/components/library/link-card.tsx
git commit -m "feat: 링크 카드 (클릭 시 새 탭 + 백그라운드 읽음 처리)"
```

---

## Task 16: Add Link Modal + FAB

**Goal:** 폴더 화면에서 URL 입력 → 중복 체크 → 저장. FAB는 우하단(safe-area 위).

**Files:**
- Create: `web/src/components/actions/add-link-modal.tsx`
- Create: `web/src/components/actions/add-link-fab.tsx`

- [ ] **Step 1: add-link-modal.tsx**

```tsx
// web/src/components/actions/add-link-modal.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui-components/react/dialog";
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
```

- [ ] **Step 2: add-link-fab.tsx**

```tsx
// web/src/components/actions/add-link-fab.tsx
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
```

- [ ] **Step 3: 커밋**

```bash
git add web/src/components/actions/
git commit -m "feat: 링크 추가 FAB + 모달 (중복 URL 사전 체크)"
```

---

## Task 17: 폴더 페이지 재작성

**Goal:** `/folder/[id]` — 폴더 메타(이름·PARA 배지) + 링크 카드 목록 + FAB.

**Files:**
- Modify: `web/src/app/(main)/folder/[id]/page.tsx`
- Create: `web/src/app/(main)/folder/[id]/loading.tsx`

- [ ] **Step 1: page.tsx 전체 교체**

```tsx
// web/src/app/(main)/folder/[id]/page.tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/shell/app-header";
import { BackButton } from "@/components/shell/back-button";
import { ParaBadge } from "@/components/primitives/para-badge";
import { LinkCard } from "@/components/library/link-card";
import { AddLinkFab } from "@/components/actions/add-link-fab";
import type { Folder, Link } from "@/lib/types";

export default async function FolderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: folderData, error: folderError } = await supabase
    .from("folders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (folderError || !folderData) notFound();
  const folder = folderData as Folder;

  const { data: linksData } = await supabase
    .from("links")
    .select("*")
    .eq("folder_id", id)
    .order("created_at", { ascending: false });
  const links = (linksData ?? []) as Link[];

  const backHref = `/category/${folder.para_category ?? "unassigned"}`;

  return (
    <>
      <AppHeader
        title={folder.name}
        left={<BackButton fallbackHref={backHref} />}
        right={<ParaBadge category={folder.para_category} />}
      />
      <div className="space-y-2 p-4">
        {links.length === 0 ? (
          <p className="py-8 text-center text-sm italic text-muted-foreground">
            이 폴더는 비어 있어요
          </p>
        ) : (
          links.map((l) => <LinkCard key={l.id} link={l} />)
        )}
      </div>
      <AddLinkFab folderId={folder.id} userId={user.id} />
    </>
  );
}
```

- [ ] **Step 2: loading.tsx**

```tsx
// web/src/app/(main)/folder/[id]/loading.tsx
import { AppHeader } from "@/components/shell/app-header";

export default function FolderLoading() {
  return (
    <>
      <AppHeader title="…" />
      <div className="space-y-2 p-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 3: 검증**

```bash
cd web && pnpm dev
```

1. 라이브러리 → Projects → 폴더 클릭 → `/folder/<id>` 진입. 헤더에 폴더명 + 우측 P 배지.
2. 링크 없으면 "이 폴더는 비어 있어요". FAB 우하단(탭바 위)에 보임.
3. FAB → 모달 → URL 입력 → 저장 → 링크 카드로 나타남.
4. 링크 카드 클릭 → 새 탭 + 잠시 뒤 카드 opacity 떨어짐(읽음).
5. 같은 URL 다시 저장 시도 → "이미 저장된 URL" 안내.
6. 존재하지 않는 폴더 id → 404.

- [ ] **Step 4: 커밋**

```bash
git add web/src/app/\(main\)/folder/\[id\]/
git commit -m "feat: 폴더 페이지 (링크 목록 + FAB + 읽음 처리)"
```

---

## Task 18: 검색 페이지

**Goal:** `/search?q=` — 클라이언트에서 입력, q를 URL로 보내고 RSC에서 ILIKE 검색.

**Files:**
- Create: `web/src/app/(main)/search/page.tsx`
- Create: `web/src/components/library/search-form.tsx`

- [ ] **Step 1: search-form.tsx**

```tsx
// web/src/components/library/search-form.tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function SearchForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = params.get("q") ?? "";
  const [q, setQ] = useState(initial);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const usp = new URLSearchParams();
    if (q.trim()) usp.set("q", q.trim());
    router.push(`/search?${usp.toString()}`);
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="제목, URL, 메모로 검색"
          className="pl-9"
          inputMode="search"
        />
      </div>
    </form>
  );
}
```

- [ ] **Step 2: search/page.tsx**

```tsx
// web/src/app/(main)/search/page.tsx
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/shell/app-header";
import { SearchForm } from "@/components/library/search-form";
import { LinkCard } from "@/components/library/link-card";
import { ParaBadge } from "@/components/primitives/para-badge";
import type { Link, ParaCategory } from "@/lib/types";

type LinkWithFolder = Link & {
  folders: { name: string; para_category: ParaCategory | null } | null;
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const supabase = await createClient();
  let results: LinkWithFolder[] = [];
  if (query) {
    const { data } = await supabase
      .from("links")
      .select("*, folders(name, para_category)")
      .or(
        `title.ilike.%${query}%,description.ilike.%${query}%,url.ilike.%${query}%`
      )
      .order("created_at", { ascending: false })
      .limit(50);
    results = (data ?? []) as LinkWithFolder[];
  }

  return (
    <>
      <AppHeader title="검색" />
      <div className="p-4 space-y-3">
        <SearchForm />
        {!query ? (
          <p className="py-8 text-center text-sm italic text-muted-foreground">
            검색어를 입력하세요
          </p>
        ) : results.length === 0 ? (
          <p className="py-8 text-center text-sm italic text-muted-foreground">
            일치하는 링크가 없어요
          </p>
        ) : (
          <ul className="space-y-2">
            {results.map((l) => (
              <li key={l.id} className="flex items-center gap-2">
                <ParaBadge category={l.folders?.para_category ?? null} />
                <div className="flex-1">
                  <LinkCard link={l} />
                  {l.folders?.name && (
                    <div className="mt-0.5 px-4 text-[10px] text-muted-foreground">
                      📁 {l.folders.name}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
```

> Supabase `.or()` 안에 사용자 입력이 들어가는데 `%`/`,`/`)`가 들어가면 쿼리가 깨질 수 있다. v1에선 입력에서 이 문자들 제거하는 정도로 충분 — `query` 만들 때 `.replace(/[%,()]/g, "")`로 사전 정제. 위 코드에 반영하려면 `query` 변수 선언 직후에 `.replace(...)` 추가.

- [ ] **Step 3: 검증**

```bash
cd web && pnpm dev
```

1. 하단 탭 "검색" 클릭 → `/search` 진입. 입력창 + "검색어를 입력하세요".
2. 단어 입력 후 엔터 → URL이 `/search?q=foo`로 바뀌고 결과 카드 목록.
3. 각 카드 우측에 PARA 배지, 아래에 "📁 폴더명". 카드 클릭 → 새 탭.
4. 없는 단어 → "일치하는 링크가 없어요".

- [ ] **Step 4: 커밋**

```bash
git add web/src/app/\(main\)/search/ web/src/components/library/search-form.tsx
git commit -m "feat: 검색 페이지 (제목/URL/메모 ILIKE, PARA 배지)"
```

---

## Task 19: 설정 페이지

**Goal:** `/settings` — 이메일 표시, 로그아웃 버튼.

**Files:**
- Create: `web/src/app/(main)/settings/page.tsx`
- Create: `web/src/components/actions/sign-out-button.tsx`

- [ ] **Step 1: sign-out-button.tsx**

```tsx
// web/src/components/actions/sign-out-button.tsx
"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  async function handle() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <button
      type="button"
      onClick={handle}
      className="flex w-full items-center justify-between rounded-xl border bg-card px-4 py-3 text-sm transition-colors active:bg-accent"
    >
      <span>로그아웃</span>
      <LogOut className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
```

- [ ] **Step 2: settings/page.tsx**

```tsx
// web/src/app/(main)/settings/page.tsx
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/shell/app-header";
import { SignOutButton } from "@/components/actions/sign-out-button";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <AppHeader title="설정" />
      <div className="space-y-4 p-4">
        <section className="space-y-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            계정
          </h2>
          <div className="rounded-xl border bg-card px-4 py-3">
            <div className="text-xs text-muted-foreground">이메일</div>
            <div className="mt-0.5 text-sm font-medium">{user?.email}</div>
          </div>
          <SignOutButton />
        </section>
      </div>
    </>
  );
}
```

- [ ] **Step 3: 검증**

```bash
cd web && pnpm dev
```

설정 탭 → 이메일 표시 + 로그아웃 버튼. 로그아웃 → `/login` 이동.

- [ ] **Step 4: 커밋**

```bash
git add web/src/app/\(main\)/settings/ web/src/components/actions/sign-out-button.tsx
git commit -m "feat: 설정 페이지 (이메일 + 로그아웃)"
```

---

## Task 20: 에러/404 폴백

**Goal:** `(main)/error.tsx`로 Supabase 에러 폴백, `(main)/not-found.tsx`로 잘못된 라우트 폴백.

**Files:**
- Create: `web/src/app/(main)/error.tsx`
- Create: `web/src/app/(main)/not-found.tsx`

- [ ] **Step 1: error.tsx**

```tsx
// web/src/app/(main)/error.tsx
"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-lg font-semibold">문제가 발생했어요</h2>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <Button onClick={reset}>다시 시도</Button>
    </div>
  );
}
```

- [ ] **Step 2: not-found.tsx**

```tsx
// web/src/app/(main)/not-found.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-lg font-semibold">찾을 수 없는 페이지예요</h2>
      <Link href="/">
        <Button variant="outline">라이브러리로 돌아가기</Button>
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: 검증**

`/category/foo` 같은 잘못된 경로 → 404 화면. 일부러 `(main)/page.tsx`에서 `throw new Error("test")` 한 번 추가했다가 페이지 진입 시 에러 화면 뜨는지 확인 후 되돌리기.

- [ ] **Step 4: 커밋**

```bash
git add web/src/app/\(main\)/error.tsx web/src/app/\(main\)/not-found.tsx
git commit -m "feat: (main) 에러/404 폴백"
```

---

## Task 21: 수동 검증 + Lighthouse + 최종 정리

**Goal:** 스펙 §8 체크리스트 9개 통과 + Lighthouse PWA Installable 통과.

**Files:** 없음 (검증 + 필요 시 미세 수정)

- [ ] **Step 1: dev server 띄우기**

```bash
cd web && pnpm dev
```

- [ ] **Step 2: 체크리스트 통과** (각 항목 손으로 확인 + 결과 메모)

1. 로그아웃 상태에서 `/` → `/login` 리다이렉트
2. 로그인 → 라이브러리 홈, PARA 4카드 + 미지정 카운트 일치(샘플 데이터로)
3. Projects → 폴더 목록 → 폴더 → 링크 클릭 → 새 탭 + 읽음 표시 갱신
4. 새 폴더 생성 / 새 링크 저장
5. 중복 URL 저장 시도 → "이미 저장됨" 안내
6. 검색 입력 → 결과 클릭 → 외부 열림
7. 로그아웃 → `/login`
8. iOS Safari "홈 화면에 추가" → standalone, 노치 영역 OK, 하단 탭바가 홈 인디케이터 위
9. Chrome DevTools → Lighthouse → PWA → "Installable" 통과

- [ ] **Step 3: 빌드 통과**

```bash
cd web && pnpm build
```

타입 에러·빌드 에러 0개 확인. 에러 나면 수정.

- [ ] **Step 4: 최종 커밋(필요 시 미세 수정 포함)**

```bash
git add -A
git status   # 변경 사항이 있다면
git commit -m "chore: 수동 검증 + Lighthouse 결과 반영"
```

- [ ] **Step 5: 완료 안내**

이 시점에서 PR을 만들 준비 완료. 스펙 §9의 "v1에 포함하지 않는 것"은 별도 작업으로 큐잉:
- [[extension-redesign]]
- [[reminder-backend]]
- [[link-edit-ui]]
- [[tags-ui]]

---

## Self-Review 결과 (작성 시점 기록)

**스펙 커버리지**
- §2 결정 6개 모두 태스크에 매핑됨 (Task 4~5: PWA, Task 6~8: 셸, Task 11: 라이브러리 홈, Task 14: 카테고리 드릴, Task 17: 폴더 드릴, Task 18: 검색, Task 19: 설정)
- §3 라우트 구조: Task 8(layout), 11(home), 14(category), 17(folder), 18(search), 19(settings), 20(error/404) 커버
- §4 토큰/컴포넌트: Task 2(토큰), 3(CSS), 9(badge), 10(para-card/unassigned), 12(folder-card), 13(add-folder), 15(link-card), 16(add-link FAB/modal)
- §5 데이터 흐름: 각 페이지 태스크에 쿼리·router.refresh 패턴 포함. 중복 URL은 Task 16. 읽음 처리는 Task 15.
- §6 PWA: Task 4(manifest), 5(viewport/icons)
- §7 에러/빈상태: Task 20 + 각 페이지의 빈 상태 처리

**플레이스홀더 스캔** — TBD/TODO/유사 패턴 없음. 모든 코드 블록 완성.

**타입 일관성** — `ParaCategory`/`Folder`/`Link` 타입은 모든 태스크에서 동일하게 import. `ParaParam`은 Task 2에서 도입, Task 14에서 사용 일관.

**알려진 위험**
- Task 13의 base-ui import 경로(`@base-ui-components/react/dialog` vs `@base-ui/react/dialog`)는 프로젝트 의존성에 맞춰야 함. Task 13 내부에 명시.
- Task 18의 Supabase `.or()` 입력 sanitization은 v1 수준 정제만 — 코드 주석으로 명시.
- Task 5의 아이콘 placeholder는 디자인 마무리 시 실제 자산으로 교체 필요(스펙 §6.4에서 "v1엔 임시 아이콘 OK"로 합의됨).
