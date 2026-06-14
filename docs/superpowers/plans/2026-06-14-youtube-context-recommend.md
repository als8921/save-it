# YouTube 컨텍스트 추천 위젯 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 유튜브 영상 시청 중, 익스텐션이 저장해 둔 유튜브 영상 소수(기본 3개)를 우측 하단 플로팅 위젯으로 추천한다.

**Architecture:** 유튜브 전용 content script 엔트리포인트를 신설하고(`*://www.youtube.com/*`, `*://m.youtube.com/*`), shadow root에 추천 위젯을 마운트한다. 추천 선별·URL 판별은 `lib/youtube.ts` 순수 함수로 분리해 단위 테스트한다. 데이터는 기존 패턴대로 content script가 Supabase를 직접 호출한다. 스키마 변경 없음.

**Tech Stack:** WXT, React 19, Supabase JS, Tailwind CSS 4(shadow DOM 주입), vitest(신규).

---

## File Structure

| 파일 | 책임 |
|------|------|
| `extension/vitest.config.ts` (신규) | vitest 설정 — `lib/**/*.test.ts` 대상, node 환경 |
| `extension/package.json` (수정) | `vitest` devDependency + `test` 스크립트 |
| `extension/lib/youtube.ts` (신규) | 순수 함수: `isYouTubeLink`, `isYouTubeWatchUrl`, `extractVideoId`, `pickYouTubeRecommendations` |
| `extension/lib/youtube.test.ts` (신규) | 위 함수들의 단위 테스트 |
| `extension/entrypoints/youtube.content/index.tsx` (신규) | 유튜브 전용 content script — shadow root에 위젯 마운트 |
| `extension/entrypoints/youtube.content/YouTubeRecommendWidget.tsx` (신규) | 추천 위젯 UI + 상태 머신 + 데이터 조회 |

---

## Task 1: vitest 테스트 인프라

**Files:**
- Create: `extension/vitest.config.ts`
- Modify: `extension/package.json`

- [ ] **Step 1: vitest 설치**

Run (in `extension/`):
```bash
npm install -D vitest
```
Expected: `package.json` devDependencies에 `vitest` 추가, 설치 성공.

- [ ] **Step 2: vitest 설정 파일 작성**

Create `extension/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: test 스크립트 추가**

In `extension/package.json`, `scripts`에 추가(기존 dev/build/zip 유지):
```json
"test": "vitest run"
```

- [ ] **Step 4: 빈 상태로 동작 확인**

Run (in `extension/`):
```bash
npm test
```
Expected: "No test files found" 경고와 함께 종료(에러 아님). vitest가 설치·구동됨을 확인.

- [ ] **Step 5: Commit**

```bash
git add extension/package.json extension/package-lock.json extension/vitest.config.ts
git commit -m "chore(extension): vitest 테스트 러너 추가"
```

---

## Task 2: URL 판별/추출 순수 함수

**Files:**
- Create: `extension/lib/youtube.ts`
- Test: `extension/lib/youtube.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `extension/lib/youtube.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { isYouTubeLink, isYouTubeWatchUrl, extractVideoId } from "./youtube";

describe("isYouTubeLink", () => {
  it("youtube 호스트를 인식한다", () => {
    expect(isYouTubeLink("https://www.youtube.com/watch?v=abc")).toBe(true);
    expect(isYouTubeLink("https://youtu.be/abc")).toBe(true);
    expect(isYouTubeLink("https://m.youtube.com/watch?v=abc")).toBe(true);
    expect(isYouTubeLink("https://youtube.com/shorts/abc")).toBe(true);
  });
  it("비유튜브 링크는 거른다", () => {
    expect(isYouTubeLink("https://vimeo.com/123")).toBe(false);
    expect(isYouTubeLink("https://example.com/youtube.com")).toBe(false);
    expect(isYouTubeLink("not a url")).toBe(false);
  });
});

describe("extractVideoId", () => {
  it("watch URL에서 추출", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s")).toBe("dQw4w9WgXcQ");
  });
  it("youtu.be 단축 URL에서 추출", () => {
    expect(extractVideoId("https://youtu.be/dQw4w9WgXcQ?si=x")).toBe("dQw4w9WgXcQ");
  });
  it("shorts URL에서 추출", () => {
    expect(extractVideoId("https://www.youtube.com/shorts/abc123")).toBe("abc123");
  });
  it("영상이 아니면 null", () => {
    expect(extractVideoId("https://www.youtube.com/")).toBe(null);
    expect(extractVideoId("https://www.youtube.com/results?search_query=x")).toBe(null);
    expect(extractVideoId("nope")).toBe(null);
  });
});

describe("isYouTubeWatchUrl", () => {
  it("youtube 도메인의 watch/shorts는 true", () => {
    expect(isYouTubeWatchUrl("https://www.youtube.com/watch?v=abc")).toBe(true);
    expect(isYouTubeWatchUrl("https://m.youtube.com/watch?v=abc")).toBe(true);
    expect(isYouTubeWatchUrl("https://www.youtube.com/shorts/abc")).toBe(true);
  });
  it("watch가 아니면 false", () => {
    expect(isYouTubeWatchUrl("https://www.youtube.com/")).toBe(false);
    expect(isYouTubeWatchUrl("https://youtu.be/abc")).toBe(false);
    expect(isYouTubeWatchUrl("https://vimeo.com/watch?v=abc")).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run (in `extension/`):
```bash
npm test
```
Expected: FAIL — `./youtube` 모듈/내보내기 없음.

- [ ] **Step 3: 최소 구현 작성**

Create `extension/lib/youtube.ts`:
```ts
import type { Link } from "./types";

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** 저장 링크가 유튜브 영상 호스트인지 (youtube.com / m.youtube.com / youtu.be) */
export function isYouTubeLink(url: string): boolean {
  const host = hostOf(url);
  return host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be";
}

/** 영상 id 추출. watch?v= / youtu.be/ID / shorts/ID 처리. 실패 시 null */
export function extractVideoId(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.host.replace(/^www\./, "");
  if (host === "youtu.be") {
    return u.pathname.slice(1).split("/")[0] || null;
  }
  if (host === "youtube.com" || host === "m.youtube.com") {
    if (u.pathname === "/watch") {
      return u.searchParams.get("v");
    }
    if (u.pathname.startsWith("/shorts/")) {
      return u.pathname.slice("/shorts/".length).split("/")[0] || null;
    }
  }
  return null;
}

/** 현재 보고 있는 페이지가 유튜브 영상 시청 페이지(watch/shorts)인지 */
export function isYouTubeWatchUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.host.replace(/^www\./, "");
    if (host !== "youtube.com" && host !== "m.youtube.com") return false;
    return u.pathname === "/watch"
      ? u.searchParams.has("v")
      : u.pathname.startsWith("/shorts/");
  } catch {
    return false;
  }
}
```
참고: `Link` import는 Task 3에서 쓰인다(지금은 type-only import라 미사용 경고가 날 수 있으나 다음 태스크에서 즉시 사용). 경고가 거슬리면 Task 3까지 한 번에 진행해도 된다.

- [ ] **Step 4: 테스트 통과 확인**

Run (in `extension/`):
```bash
npm test
```
Expected: PASS (isYouTubeLink / extractVideoId / isYouTubeWatchUrl 그룹 통과).

- [ ] **Step 5: Commit**

```bash
git add extension/lib/youtube.ts extension/lib/youtube.test.ts
git commit -m "feat(extension): 유튜브 URL 판별·영상 id 추출 함수 추가"
```

---

## Task 3: 추천 선별 함수

**Files:**
- Modify: `extension/lib/youtube.ts`
- Test: `extension/lib/youtube.test.ts`

- [ ] **Step 1: 실패하는 테스트 추가**

Append to `extension/lib/youtube.test.ts`:
```ts
import { pickYouTubeRecommendations } from "./youtube";
import type { Link } from "./types";

function mk(partial: Partial<Link> & { id: string; url?: string }): Link {
  return {
    id: partial.id,
    user_id: "u",
    folder_id: null,
    url: partial.url ?? `https://www.youtube.com/watch?v=${partial.id}`,
    title: partial.title ?? "t",
    description: null,
    priority: partial.priority ?? 0,
    is_read: partial.is_read ?? false,
    created_at: partial.created_at ?? "2026-01-01T00:00:00Z",
    read_at: null,
  };
}

describe("pickYouTubeRecommendations", () => {
  it("비유튜브 링크를 거른다", () => {
    const links = [mk({ id: "a" }), mk({ id: "b", url: "https://vimeo.com/1" })];
    expect(pickYouTubeRecommendations(links, null).map((l) => l.id)).toEqual(["a"]);
  });
  it("현재 보는 영상을 제외한다", () => {
    const links = [
      mk({ id: "a", url: "https://youtu.be/CUR" }),
      mk({ id: "b", url: "https://www.youtube.com/watch?v=OTHER" }),
    ];
    expect(pickYouTubeRecommendations(links, "CUR").map((l) => l.id)).toEqual(["b"]);
  });
  it("미열람 → 우선도 → 최신 순으로 정렬한다", () => {
    const links = [
      mk({ id: "read", is_read: true, priority: 2, url: "https://youtu.be/read" }),
      mk({ id: "low", priority: 0, created_at: "2026-01-01T00:00:00Z", url: "https://youtu.be/low" }),
      mk({ id: "high", priority: 2, created_at: "2026-01-01T00:00:00Z", url: "https://youtu.be/high" }),
      mk({ id: "newer", priority: 0, created_at: "2026-02-01T00:00:00Z", url: "https://youtu.be/newer" }),
    ];
    expect(pickYouTubeRecommendations(links, null, 10).map((l) => l.id)).toEqual([
      "high",
      "newer",
      "low",
      "read",
    ]);
  });
  it("limit만큼만 반환한다", () => {
    const links = ["a", "b", "c", "d"].map((id) => mk({ id, url: `https://youtu.be/${id}` }));
    expect(pickYouTubeRecommendations(links, null, 3)).toHaveLength(3);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run (in `extension/`):
```bash
npm test
```
Expected: FAIL — `pickYouTubeRecommendations`가 export되지 않음.

- [ ] **Step 3: 함수 구현 추가**

Append to `extension/lib/youtube.ts`:
```ts
/**
 * 저장 링크 중 유튜브 영상만 골라 추천 순서로 정렬해 상위 limit개 반환.
 * 정렬: 미열람 우선 → priority 내림차순 → 최신 저장순.
 * currentVideoId가 주어지면 그 영상은 제외(지금 보고 있는 영상).
 * 제네릭이라 folders 조인 등 Link 확장 타입도 그대로 보존한다.
 */
export function pickYouTubeRecommendations<T extends Link>(
  links: T[],
  currentVideoId: string | null,
  limit = 3,
): T[] {
  return links
    .filter((l) => isYouTubeLink(l.url))
    .filter((l) => (currentVideoId ? extractVideoId(l.url) !== currentVideoId : true))
    .sort((a, b) => {
      if (a.is_read !== b.is_read) return a.is_read ? 1 : -1;
      const pa = a.priority ?? 0;
      const pb = b.priority ?? 0;
      if (pa !== pb) return pb - pa;
      return b.created_at.localeCompare(a.created_at);
    })
    .slice(0, limit);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run (in `extension/`):
```bash
npm test
```
Expected: PASS (전체 테스트 그룹 통과).

- [ ] **Step 5: Commit**

```bash
git add extension/lib/youtube.ts extension/lib/youtube.test.ts
git commit -m "feat(extension): 유튜브 추천 선별 함수 추가"
```

---

## Task 4: 유튜브 전용 content script + 위젯 스켈레톤

이 태스크는 빈 위젯을 유튜브에 마운트해 "watch 페이지에서만, 풀스크린이 아닐 때만 보임"을 확인한다. 데이터/UI는 다음 태스크에서 채운다.

**Files:**
- Create: `extension/entrypoints/youtube.content/index.tsx`
- Create: `extension/entrypoints/youtube.content/YouTubeRecommendWidget.tsx`

- [ ] **Step 1: content script 엔트리포인트 작성**

Create `extension/entrypoints/youtube.content/index.tsx`:
```tsx
import "../../lib/styles/globals.css";
import ReactDOM from "react-dom/client";
import { YouTubeRecommendWidget } from "./YouTubeRecommendWidget";

export default defineContentScript({
  matches: ["*://www.youtube.com/*", "*://m.youtube.com/*"],
  cssInjectionMode: "ui",

  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: "save-it-youtube-recommend",
      position: "inline",
      anchor: "body",
      onMount: (container) => {
        const root = ReactDOM.createRoot(container);
        root.render(<YouTubeRecommendWidget />);
        return root;
      },
      onRemove: (root) => root?.unmount(),
    });
    ui.mount();
  },
});
```

- [ ] **Step 2: 위젯 스켈레톤 작성(watch 감지 + 풀스크린 숨김)**

Create `extension/entrypoints/youtube.content/YouTubeRecommendWidget.tsx`:
```tsx
import { useEffect, useRef, useState } from "react";
import { isYouTubeWatchUrl } from "../../lib/youtube";

export function YouTubeRecommendWidget() {
  const [url, setUrl] = useState(location.href);
  const urlRef = useRef(url);
  const [fullscreen, setFullscreen] = useState(false);

  // SPA 내비게이션 감지: yt-navigate-finish 이벤트 + location 폴링(보조)
  useEffect(() => {
    const update = () => {
      urlRef.current = location.href;
      setUrl(location.href);
    };
    update();
    document.addEventListener("yt-navigate-finish", update);
    const iv = window.setInterval(() => {
      if (location.href !== urlRef.current) update();
    }, 1000);
    return () => {
      document.removeEventListener("yt-navigate-finish", update);
      clearInterval(iv);
    };
  }, []);

  // 풀스크린(영상 전체화면)일 때는 숨긴다
  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const isWatch = isYouTubeWatchUrl(url);
  if (!isWatch || fullscreen) return null;

  return (
    <div
      className="fixed font-sans"
      style={{ bottom: 20, right: 20, zIndex: 2147483647 }}
    >
      <div className="rounded-full border border-border bg-card px-3 py-1.5 text-[12px] font-semibold text-foreground">
        Save It · 추천 (준비 중)
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 빌드 확인**

Run (in `extension/`):
```bash
npm run build
```
Expected: 빌드 성공. 출력에 `youtube.content` 관련 content script가 포함됨(에러 없음).

- [ ] **Step 4: 수동 확인(로드 후)**

`chrome://extensions` → 확장 새로고침(또는 `.output/chrome-mv3` 재로드) 후:
- `https://www.youtube.com/watch?v=...` → 우측 하단에 "Save It · 추천 (준비 중)" pill 보임.
- `https://www.youtube.com/` (홈) → 보이지 않음.
- 영상 전체화면 진입 → 사라지고, 해제하면 다시 보임.
- 영상 A→B로 이동(클릭) → 여전히 보임(내비게이션 감지 동작).

- [ ] **Step 5: Commit**

```bash
git add extension/entrypoints/youtube.content/index.tsx extension/entrypoints/youtube.content/YouTubeRecommendWidget.tsx
git commit -m "feat(extension): 유튜브 추천용 content script 스켈레톤 추가"
```

---

## Task 5: 데이터 조회 + 추천 연결

위젯이 로그인 상태에서 저장된 유튜브 링크(folders 조인)를 한 번 불러오고, 영상 변경 시 추천 목록을 재선별한다. 아직 UI는 pill에 개수만 표시한다.

**Files:**
- Modify: `extension/entrypoints/youtube.content/YouTubeRecommendWidget.tsx`

- [ ] **Step 1: 데이터 타입·조회·추천 계산 추가**

Replace the entire contents of `extension/entrypoints/youtube.content/YouTubeRecommendWidget.tsx` with:
```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/useAuth";
import {
  extractVideoId,
  isYouTubeWatchUrl,
  pickYouTubeRecommendations,
} from "../../lib/youtube";
import type { Link, ParaCategory } from "../../lib/types";

export type YtLink = Link & {
  folders: { name: string; para_category: ParaCategory | null } | null;
};

const SELECT =
  "id, user_id, folder_id, url, title, description, priority, is_read, created_at, read_at, folders(name, para_category)";

export function YouTubeRecommendWidget() {
  const auth = useAuth();
  const [url, setUrl] = useState(location.href);
  const urlRef = useRef(url);
  const [fullscreen, setFullscreen] = useState(false);
  const [allYt, setAllYt] = useState<YtLink[] | null>(null);

  // SPA 내비게이션 감지
  useEffect(() => {
    const update = () => {
      urlRef.current = location.href;
      setUrl(location.href);
    };
    update();
    document.addEventListener("yt-navigate-finish", update);
    const iv = window.setInterval(() => {
      if (location.href !== urlRef.current) update();
    }, 1000);
    return () => {
      document.removeEventListener("yt-navigate-finish", update);
      clearInterval(iv);
    };
  }, []);

  // 풀스크린 숨김
  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  // 저장된 유튜브 링크 1회 로드(위젯 수명 동안 캐시)
  useEffect(() => {
    if (auth.status !== "authenticated") return;
    let active = true;
    supabase
      .from("links")
      .select(SELECT)
      .or("url.ilike.%youtube.com%,url.ilike.%youtu.be%")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.warn("[save-it] youtube 추천 조회 실패:", error.message);
          return;
        }
        setAllYt((data ?? []) as unknown as YtLink[]);
      });
    return () => {
      active = false;
    };
  }, [auth.status]);

  const isWatch = isYouTubeWatchUrl(url);
  const currentVideoId = isWatch ? extractVideoId(url) : null;
  const recs = useMemo(
    () => (allYt ? pickYouTubeRecommendations(allYt, currentVideoId, 3) : []),
    [allYt, currentVideoId],
  );

  if (auth.status !== "authenticated") return null;
  if (!isWatch || fullscreen) return null;
  if (recs.length === 0) return null;

  return (
    <div
      className="fixed font-sans"
      style={{ bottom: 20, right: 20, zIndex: 2147483647 }}
    >
      <div className="rounded-full border border-border bg-card px-3 py-1.5 text-[12px] font-semibold text-foreground">
        저장한 영상 {recs.length}
      </div>
    </div>
  );
}
```

참고: `ParaCategory` 타입을 `lib/types`에서 import한다(이미 존재). `folders(name, para_category)` 조인은 web 검색 페이지와 동일한 패턴이다.

- [ ] **Step 2: 빌드 확인**

Run (in `extension/`):
```bash
npm run build
```
Expected: 빌드 성공, 타입 에러 없음.

- [ ] **Step 3: 수동 확인**

확장 재로드 후, 저장된 유튜브 영상이 1개 이상 있는 계정으로:
- watch 페이지에서 우측 하단 pill에 "저장한 영상 N"이 실제 개수로 표시.
- 저장된 유튜브 영상이 0개면 위젯이 보이지 않음.
- 로그아웃 상태면 위젯이 보이지 않음.
- 현재 보는 영상은 개수에서 제외됨(같은 영상을 저장해 두고 확인).

- [ ] **Step 4: Commit**

```bash
git add extension/entrypoints/youtube.content/YouTubeRecommendWidget.tsx
git commit -m "feat(extension): 유튜브 추천 데이터 조회·선별 연결"
```

---

## Task 6: 위젯 UI(펼침/접힘 + 카드)

pill ↔ 펼친 패널 상태 머신과 카드(썸네일·제목·PARA·미열람) 렌더, 카드 클릭 시 새 탭 열기 + 읽음 처리.

**Files:**
- Modify: `extension/entrypoints/youtube.content/YouTubeRecommendWidget.tsx`

- [ ] **Step 1: 상태 머신·UI 추가(전체 교체)**

Replace the entire contents of `extension/entrypoints/youtube.content/YouTubeRecommendWidget.tsx` with:
```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Play } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/useAuth";
import { PARA_TOKENS } from "../../lib/para";
import {
  extractVideoId,
  isYouTubeWatchUrl,
  pickYouTubeRecommendations,
} from "../../lib/youtube";
import type { Link, ParaCategory } from "../../lib/types";

export type YtLink = Link & {
  folders: { name: string; para_category: ParaCategory | null } | null;
};

const SELECT =
  "id, user_id, folder_id, url, title, description, priority, is_read, created_at, read_at, folders(name, para_category)";
const AUTO_COLLAPSE_MS = 5000;
const BRAND = "var(--color-para-project-fg)";

export function YouTubeRecommendWidget() {
  const auth = useAuth();
  const [url, setUrl] = useState(location.href);
  const urlRef = useRef(url);
  const [fullscreen, setFullscreen] = useState(false);
  const [allYt, setAllYt] = useState<YtLink[] | null>(null);

  const [mode, setMode] = useState<"expanded" | "collapsed">("collapsed");
  const suppressedRef = useRef(false); // 수동으로 접으면 세션 동안 자동 펼침 억제
  const timerRef = useRef<number | null>(null);

  // SPA 내비게이션 감지
  useEffect(() => {
    const update = () => {
      urlRef.current = location.href;
      setUrl(location.href);
    };
    update();
    document.addEventListener("yt-navigate-finish", update);
    const iv = window.setInterval(() => {
      if (location.href !== urlRef.current) update();
    }, 1000);
    return () => {
      document.removeEventListener("yt-navigate-finish", update);
      clearInterval(iv);
    };
  }, []);

  // 풀스크린 숨김
  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  // 저장된 유튜브 링크 1회 로드
  useEffect(() => {
    if (auth.status !== "authenticated") return;
    let active = true;
    supabase
      .from("links")
      .select(SELECT)
      .or("url.ilike.%youtube.com%,url.ilike.%youtu.be%")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.warn("[save-it] youtube 추천 조회 실패:", error.message);
          return;
        }
        setAllYt((data ?? []) as unknown as YtLink[]);
      });
    return () => {
      active = false;
    };
  }, [auth.status]);

  const isWatch = isYouTubeWatchUrl(url);
  const currentVideoId = isWatch ? extractVideoId(url) : null;
  const recs = useMemo(
    () => (allYt ? pickYouTubeRecommendations(allYt, currentVideoId, 3) : []),
    [allYt, currentVideoId],
  );

  function cancelAutoCollapse() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  // 영상이 바뀌고 추천이 있으면: 억제 안 됐을 때 자동 펼침 → 5초 후 접힘
  useEffect(() => {
    if (!isWatch || recs.length === 0) return;
    if (suppressedRef.current) {
      setMode("collapsed");
      return;
    }
    setMode("expanded");
    cancelAutoCollapse();
    timerRef.current = window.setTimeout(
      () => setMode("collapsed"),
      AUTO_COLLAPSE_MS,
    );
    return cancelAutoCollapse;
  }, [currentVideoId, recs.length, isWatch]);

  function collapse() {
    cancelAutoCollapse();
    suppressedRef.current = true;
    setMode("collapsed");
  }

  function expand() {
    cancelAutoCollapse();
    setMode("expanded");
  }

  function openLink(link: YtLink) {
    window.open(link.url, "_blank", "noopener,noreferrer");
    if (link.is_read) return;
    const readAt = new Date().toISOString();
    setAllYt((prev) =>
      prev
        ? prev.map((l) =>
            l.id === link.id ? { ...l, is_read: true, read_at: readAt } : l,
          )
        : prev,
    );
    supabase
      .from("links")
      .update({ is_read: true, read_at: readAt })
      .eq("id", link.id)
      .then(({ error }) => {
        if (error) console.warn("[save-it] 읽음 처리 실패:", error.message);
      });
  }

  if (auth.status !== "authenticated") return null;
  if (!isWatch || fullscreen) return null;
  if (recs.length === 0) return null;

  return (
    <div
      className="fixed font-sans"
      style={{ bottom: 20, right: 20, zIndex: 2147483647 }}
    >
      {mode === "collapsed" ? (
        <button
          type="button"
          onClick={expand}
          className="flex items-center gap-1.5 rounded-full border border-border bg-card py-1.5 pl-2 pr-3 text-[12px] font-semibold text-foreground shadow-lg transition-colors hover:bg-accent"
        >
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full"
            style={{ backgroundColor: BRAND }}
          >
            <Play className="h-3 w-3 text-white" />
          </span>
          저장한 영상 {recs.length}
        </button>
      ) : (
        <div
          onMouseEnter={cancelAutoCollapse}
          className="w-[300px] overflow-hidden rounded-2xl border border-border bg-background text-foreground shadow-xl motion-safe:animate-in"
        >
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <span className="text-[12px] font-semibold">저장한 유튜브 영상</span>
            <span className="text-[11px] text-muted-foreground">{recs.length}</span>
            <span className="flex-1" />
            <button
              type="button"
              onClick={collapse}
              aria-label="접기"
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
          <ul className="max-h-[280px] divide-y divide-border overflow-y-auto">
            {recs.map((link) => (
              <li key={link.id}>
                <RecCard link={link} onOpen={() => openLink(link)} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RecCard({ link, onOpen }: { link: YtLink; onOpen: () => void }) {
  const videoId = extractVideoId(link.url);
  const para = link.folders?.para_category ?? null;
  const token = para ? PARA_TOKENS[para] : null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-accent"
    >
      <Thumb videoId={videoId} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium">{link.title}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          {token ? (
            <span
              className="flex h-3.5 w-3.5 items-center justify-center rounded-sm text-[8px] font-bold text-white"
              style={{ backgroundColor: token.fg }}
            >
              {token.letter}
            </span>
          ) : (
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-muted text-[8px] font-bold text-muted-foreground">
              ·
            </span>
          )}
          {link.folders?.name && <span className="truncate">{link.folders.name}</span>}
          {!link.is_read && (
            <span
              className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: "var(--color-para-project-fg)" }}
              aria-label="안 읽음"
            />
          )}
        </div>
      </div>
    </button>
  );
}

function Thumb({ videoId }: { videoId: string | null }) {
  const [err, setErr] = useState(false);
  if (!videoId || err) {
    return (
      <div className="flex h-9 w-16 shrink-0 items-center justify-center rounded bg-muted">
        <Play className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }
  return (
    <img
      src={`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`}
      alt=""
      className="h-9 w-16 shrink-0 rounded object-cover"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setErr(true)}
    />
  );
}
```

- [ ] **Step 2: 빌드 확인**

Run (in `extension/`):
```bash
npm run build
```
Expected: 빌드 성공, 타입 에러 없음.

- [ ] **Step 3: 수동 확인**

확장 재로드 후 watch 페이지에서:
- 진입 시 패널이 자동으로 펼쳐지고 약 5초 뒤 pill로 접힌다.
- 펼친 상태에서 패널에 마우스를 올리면 자동 접힘이 멈춘다.
- pill 클릭 → 펼침, 헤더 접기 버튼 클릭 → 접힘.
- 한 번 수동으로 접은 뒤 다른 영상으로 이동하면 자동으로 펼쳐지지 않고 pill만 보인다(세션 억제).
- 카드 클릭 → 새 탭으로 영상 열림, 미열람 점이 사라진다(읽음 처리).
- 썸네일이 보이고, 폴더 PARA 글자 배지가 표시된다.

- [ ] **Step 4: Commit**

```bash
git add extension/entrypoints/youtube.content/YouTubeRecommendWidget.tsx
git commit -m "feat(extension): 유튜브 추천 위젯 UI·펼침 상태 머신 구현"
```

---

## Task 7: 마무리(reduced-motion · 빌드 · 테스트 최종 확인)

**Files:**
- Modify: `extension/entrypoints/youtube.content/YouTubeRecommendWidget.tsx` (필요 시)

- [ ] **Step 1: reduced-motion 확인**

`YouTubeRecommendWidget.tsx`의 펼친 패널 className에 이미 `motion-safe:animate-in`을 사용했는지 확인한다. 만약 `animate-in` 유틸이 빌드에서 정의되지 않아 경고가 나면, 해당 클래스를 제거하고 애니메이션 없이 둔다(동작에는 영향 없음). reduced-motion 사용자는 `motion-safe:` 접두어로 이미 애니메이션이 비활성화된다.

- [ ] **Step 2: 전체 테스트 통과 확인**

Run (in `extension/`):
```bash
npm test
```
Expected: PASS — `lib/youtube.test.ts` 전체 통과.

- [ ] **Step 3: 프로덕션 빌드 확인**

Run (in `extension/`):
```bash
npm run build
```
Expected: 빌드 성공. content script 2개(`content`, `youtube.content`)가 모두 포함됨.

- [ ] **Step 4: 전체 수동 시나리오 점검**

저장된 유튜브 영상이 여러 개인 계정으로:
1. 유튜브 영상 진입 → 우측 하단 패널 자동 펼침(최대 3개) → 5초 후 pill.
2. 영상 A→B 이동 → 추천 갱신, B가 추천에 있으면 빠짐.
3. 풀스크린 토글 → 숨김/복귀.
4. 카드 클릭 → 새 탭 + 읽음 처리.
5. 비유튜브 페이지/홈/검색 → 위젯 없음.
6. 기존 Save It 위젯(우측 상단)과 겹치지 않음.

- [ ] **Step 5: 최종 Commit(변경이 있었다면)**

```bash
git add extension/entrypoints/youtube.content/YouTubeRecommendWidget.tsx
git commit -m "fix(extension): 유튜브 추천 위젯 마무리 다듬기"
```

---

## 자체 점검 결과

- **스펙 커버리지:** §2 아키텍처(Task 4), §3 순수 함수(Task 2·3), §4 데이터 흐름·SPA 감지(Task 4·5), §5 UI·상태 머신(Task 6), §6 에러 처리(Task 5·6의 console.warn·폴백), §7 테스트(Task 2·3) — 모두 태스크에 매핑됨.
- **플레이스홀더:** 없음. 모든 코드 단계에 실제 코드 포함.
- **타입 일관성:** `YtLink`, `pickYouTubeRecommendations<T extends Link>`, `extractVideoId`, `isYouTubeWatchUrl` 시그니처가 태스크 간 일치.
- **알려진 한계:** 링크 목록은 위젯 수명 동안 캐시(영상 이동마다 재조회 안 함) — 스펙 §4의 v1 단순화 의도와 일치. 새로 저장한 영상은 페이지 새로고침 후 반영.
```
