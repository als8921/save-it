# "다시 볼 시간" 리마인드 스코어링 & API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** save-it 메인 페이지에 "오늘 다시 볼 링크" 섹션을 노출한다. 점수
기반으로 미열람 링크 중 상위 N개를 산출하는 백엔드 API와, SWR로 그 결과를
페치하는 클라이언트 컴포넌트를 만든다.

**Architecture:** `web/src/lib/remind/` 에 순수 점수 함수(scoring.ts), DB
의존 picker(picker.ts), 가중치/상수(constants.ts) 3파일을 둔다. Route
handler(`/api/reminders/today`)가 picker를 호출하고, 메인 페이지 클라이언트
섹션이 SWR로 그 엔드포인트를 호출한다. `link_reminders`의 4시간 sent_at
윈도우로 묶음 캐싱.

**Tech Stack:** Next.js 16 (App Router) / React 19 / TypeScript /
`@supabase/ssr` / SWR (신규) / Vitest (신규).

**관련 스펙:** `docs/superpowers/specs/2026-05-26-remind-daily-scoring-design.md`

---

## File Structure

| 파일 | 책임 | 상태 |
|------|------|------|
| `web/package.json` | swr, vitest 의존성 + test 스크립트 추가 | 수정 |
| `web/vitest.config.ts` | vitest 설정 | 신규 |
| `web/src/lib/remind/constants.ts` | 가중치, TTL, peak/sigma 등 모든 튜닝 상수 | 신규 |
| `web/src/lib/remind/scoring.ts` | DB 의존 없는 순수 함수 `calcDailyScore` | 신규 |
| `web/src/lib/remind/scoring.test.ts` | `calcDailyScore` 단위 테스트 | 신규 |
| `web/src/lib/remind/picker.ts` | server-only. `pickDailyRemindCandidates(userId)` | 신규 |
| `web/src/app/api/reminders/today/route.ts` | GET handler — 인증 + picker 호출 | 신규 |
| `web/src/components/today/today-reminder-section.tsx` | 클라이언트 컴포넌트. SWR로 페치 후 표시 | 신규 |
| `web/src/app/(main)/page.tsx` | TodayReminderSection 마운트 | 수정 |

스펙의 모든 결정은 `constants.ts` 한 파일에 집중시킨다 (가중치 튜닝 = 한 곳만 수정).

---

### Task 1: 의존성 + 테스트 인프라 추가

**Files:**
- Modify: `web/package.json`
- Create: `web/vitest.config.ts`

- [ ] **Step 1: web 디렉토리에서 의존성 설치**

Run (from repo root):
```bash
cd web && npm install --save swr && npm install --save-dev vitest @vitest/coverage-v8
```

Expected: `package.json` `dependencies`에 `swr`, `devDependencies`에
`vitest`, `@vitest/coverage-v8`가 추가됨.

- [ ] **Step 2: `web/package.json` 의 scripts 섹션에 test 추가**

Edit `web/package.json` — `scripts` 객체에 다음 두 줄 추가:
```json
"test": "vitest run",
"test:watch": "vitest"
```

전체 scripts 블록 예시:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 3: vitest 설정 파일 생성**

Create `web/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
```

- [ ] **Step 4: 설치/설정이 동작하는지 확인**

Run (from `web/`):
```bash
npm test
```

Expected: `No test files found` 같은 메시지로 종료 (테스트 파일이 아직 없으므로 정상).

- [ ] **Step 5: Commit**

```bash
git add web/package.json web/package-lock.json web/vitest.config.ts
git commit -m "chore(web): add swr and vitest"
```

---

### Task 2: `constants.ts` 작성

**Files:**
- Create: `web/src/lib/remind/constants.ts`

- [ ] **Step 1: 상수 파일 작성**

Create `web/src/lib/remind/constants.ts`:
```ts
export const REMIND_WEIGHTS = {
  priority: 0.4,
  para: 0.3,
  age: 0.3,
} as const;

export const PARA_WEIGHT = {
  project: 1.0,
  area: 0.7,
  resource: 0.5,
  unassigned: 0.5,
} as const;

export const AGE_PEAK_DAYS = 7;
export const AGE_SIGMA_DAYS = 10;

export const FATIGUE_WINDOW_DAYS = 7;
export const REMIND_TTL_HOURS = 4;

export const DEFAULT_MAX_ITEMS = 5;

export const REMIND_MODE_DAILY = "daily" as const;
export const REMIND_CHANNEL_DASHBOARD = "dashboard" as const;
```

- [ ] **Step 2: TS 컴파일 확인**

Run (from `web/`):
```bash
npx tsc --noEmit
```

Expected: 에러 없음.

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/remind/constants.ts
git commit -m "feat(remind): add scoring constants"
```

---

### Task 3: `scoring.ts` TDD

**Files:**
- Create: `web/src/lib/remind/scoring.test.ts`
- Create: `web/src/lib/remind/scoring.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `web/src/lib/remind/scoring.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { calcDailyScore } from "./scoring";

const baseDate = new Date("2026-05-26T12:00:00Z");
const daysAgo = (n: number) =>
  new Date(baseDate.getTime() - n * 24 * 60 * 60 * 1000);

describe("calcDailyScore", () => {
  it("returns 0~1 range", () => {
    const score = calcDailyScore({
      priority: 0,
      paraCategory: "resource",
      createdAt: daysAgo(7),
      now: baseDate,
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("maximizes when priority=2, para=project, days=7", () => {
    const score = calcDailyScore({
      priority: 2,
      paraCategory: "project",
      createdAt: daysAgo(7),
      now: baseDate,
    });
    // 0.4*1 + 0.3*1 + 0.3*1 = 1.0
    expect(score).toBeCloseTo(1.0, 4);
  });

  it("priority normalization: 0/1/2 -> 0/0.5/1", () => {
    const args = {
      paraCategory: "project" as const,
      createdAt: daysAgo(7),
      now: baseDate,
    };
    const p0 = calcDailyScore({ ...args, priority: 0 });
    const p1 = calcDailyScore({ ...args, priority: 1 });
    const p2 = calcDailyScore({ ...args, priority: 2 });
    // age=peak, para=project (1.0): score = 0.4*pn + 0.3 + 0.3
    expect(p0).toBeCloseTo(0.6, 4);
    expect(p1).toBeCloseTo(0.8, 4);
    expect(p2).toBeCloseTo(1.0, 4);
  });

  it("clamps priority below 0 and above 2", () => {
    const args = {
      paraCategory: "project" as const,
      createdAt: daysAgo(7),
      now: baseDate,
    };
    const low = calcDailyScore({ ...args, priority: -5 });
    const high = calcDailyScore({ ...args, priority: 10 });
    expect(low).toBeCloseTo(0.6, 4);  // same as priority=0
    expect(high).toBeCloseTo(1.0, 4); // same as priority=2
  });

  it("treats null para_category as unassigned (0.5)", () => {
    const score = calcDailyScore({
      priority: 0,
      paraCategory: null,
      createdAt: daysAgo(7),
      now: baseDate,
    });
    // 0.4*0 + 0.3*0.5 + 0.3*1 = 0.45
    expect(score).toBeCloseTo(0.45, 4);
  });

  it("age decay peaks at 7 days", () => {
    const args = {
      priority: 2,
      paraCategory: "project" as const,
      now: baseDate,
    };
    const at0  = calcDailyScore({ ...args, createdAt: daysAgo(0)  });
    const at7  = calcDailyScore({ ...args, createdAt: daysAgo(7)  });
    const at14 = calcDailyScore({ ...args, createdAt: daysAgo(14) });
    const at30 = calcDailyScore({ ...args, createdAt: daysAgo(30) });

    expect(at7).toBeGreaterThan(at0);
    expect(at7).toBeGreaterThan(at14);
    expect(at14).toBeGreaterThan(at30);
    // at7 is exact peak: 0.4*1 + 0.3*1 + 0.3*1 = 1.0
    expect(at7).toBeCloseTo(1.0, 4);
  });

  it("age decay matches Gaussian shape", () => {
    const onlyAge = (days: number) =>
      calcDailyScore({
        priority: 0,
        paraCategory: null, // 0.5
        createdAt: daysAgo(days),
        now: baseDate,
      });
    // score = 0 + 0.15 + 0.3 * age_decay
    // days=0  -> age_decay = exp(-49/200) ≈ 0.7827
    // days=7  -> 1.0
    // days=30 -> exp(-529/200) ≈ 0.0716
    expect(onlyAge(0) - 0.15).toBeCloseTo(0.3 * 0.7827, 3);
    expect(onlyAge(7) - 0.15).toBeCloseTo(0.3 * 1.0, 3);
    expect(onlyAge(30) - 0.15).toBeCloseTo(0.3 * 0.0716, 3);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run (from `web/`):
```bash
npm test
```

Expected: `Cannot find module './scoring'` 또는 import 오류로 모든 테스트 실패.

- [ ] **Step 3: scoring.ts 구현**

Create `web/src/lib/remind/scoring.ts`:
```ts
import type { ParaCategory } from "@/lib/types";
import {
  REMIND_WEIGHTS,
  PARA_WEIGHT,
  AGE_PEAK_DAYS,
  AGE_SIGMA_DAYS,
} from "./constants";

export interface ScoreInput {
  priority: number;
  paraCategory: ParaCategory | null;
  createdAt: Date;
  now: Date;
}

export function calcDailyScore(input: ScoreInput): number {
  const priorityNorm =
    Math.max(0, Math.min(2, input.priority)) / 2;

  const paraKey =
    input.paraCategory === null ? "unassigned" : input.paraCategory;
  const paraWeight =
    (PARA_WEIGHT as Record<string, number>)[paraKey] ?? PARA_WEIGHT.unassigned;

  const days =
    (input.now.getTime() - input.createdAt.getTime()) /
    (1000 * 60 * 60 * 24);
  const ageDecay = Math.exp(
    -Math.pow(days - AGE_PEAK_DAYS, 2) / (2 * Math.pow(AGE_SIGMA_DAYS, 2))
  );

  return (
    REMIND_WEIGHTS.priority * priorityNorm +
    REMIND_WEIGHTS.para * paraWeight +
    REMIND_WEIGHTS.age * ageDecay
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run (from `web/`):
```bash
npm test
```

Expected: `7 passed`.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/remind/scoring.ts web/src/lib/remind/scoring.test.ts
git commit -m "feat(remind): add daily scoring pure function with tests"
```

---

### Task 4: `picker.ts` 작성

**Files:**
- Create: `web/src/lib/remind/picker.ts`

이 파일은 DB에 의존하므로 vitest 단위 테스트 대신 Task 8의 수동 검증으로
확인한다. 코드는 작은 helper 단위로 쪼개 가독성 유지.

- [ ] **Step 1: picker.ts 작성**

Create `web/src/lib/remind/picker.ts`:
```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Link, Folder, ParaCategory } from "@/lib/types";
import { calcDailyScore } from "./scoring";
import {
  REMIND_TTL_HOURS,
  FATIGUE_WINDOW_DAYS,
  DEFAULT_MAX_ITEMS,
  REMIND_MODE_DAILY,
  REMIND_CHANNEL_DASHBOARD,
} from "./constants";

export interface RemindCandidate {
  link: Link;
  folder: Pick<Folder, "id" | "name" | "para_category">;
  score: number;
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

interface JoinedRow {
  id: string;
  user_id: string;
  folder_id: string | null;
  url: string;
  title: string;
  description: string | null;
  priority: number;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
  folders:
    | { id: string; name: string; para_category: ParaCategory | null }
    | { id: string; name: string; para_category: ParaCategory | null }[]
    | null;
}

function pickFolder(
  raw: JoinedRow["folders"]
): { id: string; name: string; para_category: ParaCategory | null } | null {
  if (raw === null) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

function rowToCandidate(row: JoinedRow, now: Date): RemindCandidate {
  const link: Link = {
    id: row.id,
    user_id: row.user_id,
    folder_id: row.folder_id,
    url: row.url,
    title: row.title,
    description: row.description,
    priority: row.priority,
    is_read: row.is_read,
    created_at: row.created_at,
    read_at: row.read_at,
  };
  const folder = pickFolder(row.folders) ?? {
    id: "",
    name: "미지정",
    para_category: null as ParaCategory | null,
  };
  return {
    link,
    folder,
    score: calcDailyScore({
      priority: row.priority,
      paraCategory: folder.para_category,
      createdAt: new Date(row.created_at),
      now,
    }),
  };
}

async function resolveLimit(supabase: Supabase, userId: string): Promise<number> {
  const { data } = await supabase
    .from("user_reminder_prefs")
    .select("max_items_per_reminder")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.max_items_per_reminder ?? DEFAULT_MAX_ITEMS;
}

async function readRecentBatchLinkIds(
  supabase: Supabase,
  userId: string
): Promise<string[]> {
  const since = new Date(
    Date.now() - REMIND_TTL_HOURS * 60 * 60 * 1000
  ).toISOString();
  const { data } = await supabase
    .from("link_reminders")
    .select("link_id, sent_at")
    .eq("user_id", userId)
    .eq("mode", REMIND_MODE_DAILY)
    .eq("channel", REMIND_CHANNEL_DASHBOARD)
    .gte("sent_at", since)
    .order("sent_at", { ascending: false });

  if (!data || data.length === 0) return [];
  const seen = new Set<string>();
  for (const row of data) {
    seen.add(row.link_id as string);
  }
  return [...seen];
}

async function fetchLinksByIds(
  supabase: Supabase,
  userId: string,
  linkIds: string[]
): Promise<JoinedRow[]> {
  if (linkIds.length === 0) return [];
  const { data } = await supabase
    .from("links")
    .select(
      "id, user_id, folder_id, url, title, description, priority, is_read, created_at, read_at, folders ( id, name, para_category )"
    )
    .eq("user_id", userId)
    .in("id", linkIds);
  return (data ?? []) as unknown as JoinedRow[];
}

async function selectFreshCandidates(
  supabase: Supabase,
  userId: string
): Promise<JoinedRow[]> {
  const since = new Date(
    Date.now() - FATIGUE_WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  // 최근 7일 내에 sent된 link_id (피로 필터)
  const { data: fatigueRows } = await supabase
    .from("link_reminders")
    .select("link_id")
    .eq("user_id", userId)
    .eq("mode", REMIND_MODE_DAILY)
    .eq("channel", REMIND_CHANNEL_DASHBOARD)
    .gte("sent_at", since);
  const excludeIds = new Set<string>(
    (fatigueRows ?? []).map((r) => r.link_id as string)
  );

  let query = supabase
    .from("links")
    .select(
      "id, user_id, folder_id, url, title, description, priority, is_read, created_at, read_at, folders ( id, name, para_category )"
    )
    .eq("user_id", userId)
    .eq("is_read", false);

  // archive 제외는 클라이언트 사이드 필터 (Supabase 조인 컬럼 비교가 어렵기 때문)
  const { data } = await query;
  const rows = (data ?? []) as unknown as JoinedRow[];
  return rows.filter((r) => {
    if (excludeIds.has(r.id)) return false;
    const cat = pickFolder(r.folders)?.para_category ?? null;
    if (cat === "archive") return false;
    return true;
  });
}

async function recordSent(
  supabase: Supabase,
  userId: string,
  linkIds: string[]
): Promise<void> {
  if (linkIds.length === 0) return;
  const rows = linkIds.map((link_id) => ({
    link_id,
    user_id: userId,
    mode: REMIND_MODE_DAILY,
    channel: REMIND_CHANNEL_DASHBOARD,
  }));
  await supabase.from("link_reminders").insert(rows);
}

export async function pickDailyRemindCandidates(
  userId: string
): Promise<RemindCandidate[]> {
  const supabase = await createClient();
  const limit = await resolveLimit(supabase, userId);
  const now = new Date();

  // 1. TTL hit?
  const cachedIds = await readRecentBatchLinkIds(supabase, userId);
  if (cachedIds.length > 0) {
    const rows = await fetchLinksByIds(supabase, userId, cachedIds);
    return rows
      .map((r) => rowToCandidate(r, now))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // 2. miss → 후보 SELECT + 필터
  const fresh = await selectFreshCandidates(supabase, userId);
  if (fresh.length === 0) return [];

  // 3. score + sort + take(limit)
  const scored = fresh
    .map((r) => rowToCandidate(r, now))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // 4. record send
  await recordSent(
    supabase,
    userId,
    scored.map((s) => s.link.id)
  );

  return scored;
}
```

- [ ] **Step 2: TS 컴파일 확인**

Run (from `web/`):
```bash
npx tsc --noEmit
```

Expected: 에러 없음. (`server-only` import는 next에 내장됨.)

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/remind/picker.ts
git commit -m "feat(remind): add pickDailyRemindCandidates with 4h TTL"
```

---

### Task 5: `/api/reminders/today` Route Handler

**Files:**
- Create: `web/src/app/api/reminders/today/route.ts`

- [ ] **Step 1: route 작성**

Create `web/src/app/api/reminders/today/route.ts`:
```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pickDailyRemindCandidates } from "@/lib/remind/picker";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const items = await pickDailyRemindCandidates(user.id);
  return NextResponse.json({ items });
}
```

- [ ] **Step 2: 빌드 확인**

Run (from `web/`):
```bash
npx tsc --noEmit
```

Expected: 에러 없음.

- [ ] **Step 3: dev 서버 미인증 호출로 401 확인**

Run (from `web/`):
```bash
npm run dev
```

다른 터미널에서:
```bash
curl -i http://localhost:3000/api/reminders/today
```

Expected: `HTTP/1.1 401 Unauthorized` 와 body `{"error":"unauthorized"}`.

확인 후 `Ctrl+C`로 dev 서버 종료.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/api/reminders/today/route.ts
git commit -m "feat(api): add GET /api/reminders/today"
```

---

### Task 6: 클라이언트 섹션 컴포넌트

**Files:**
- Create: `web/src/components/today/today-reminder-section.tsx`

- [ ] **Step 1: 컴포넌트 작성**

Create `web/src/components/today/today-reminder-section.tsx`:
```tsx
"use client";

import useSWR from "swr";
import type { RemindCandidate } from "@/lib/remind/picker";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetch failed: ${res.status}`);
  }
  return res.json() as Promise<{ items: RemindCandidate[] }>;
};

export function TodayReminderSection() {
  const { data, error, isLoading } = useSWR(
    "/api/reminders/today",
    fetcher
  );

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground px-1">
        오늘 다시 볼 링크
      </h2>

      {isLoading && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-16 rounded-md border border-border bg-card animate-pulse"
            />
          ))}
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">
          리마인드 목록을 불러오지 못했어요.
        </div>
      )}

      {!isLoading && !error && data && data.items.length === 0 && (
        <div className="rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">
          오늘 다시 볼 링크가 없어요.
        </div>
      )}

      {!isLoading && !error && data && data.items.length > 0 && (
        <ul className="space-y-2">
          {data.items.map((c) => (
            <li
              key={c.link.id}
              className="rounded-md border border-border bg-card p-3"
            >
              <a
                href={c.link.url}
                target="_blank"
                rel="noreferrer"
                className="block"
              >
                <div className="text-sm font-medium line-clamp-1">
                  {c.link.title}
                </div>
                <div className="mt-1 text-xs text-muted-foreground line-clamp-1">
                  {c.folder.name} · {c.link.url}
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 2: TS 컴파일 확인**

Run (from `web/`):
```bash
npx tsc --noEmit
```

Expected: 에러 없음.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/today/today-reminder-section.tsx
git commit -m "feat(web): add TodayReminderSection client component"
```

---

### Task 7: 메인 페이지에 마운트

**Files:**
- Modify: `web/src/app/(main)/page.tsx`

- [ ] **Step 1: 파일 상단 import 추가**

Edit `web/src/app/(main)/page.tsx` — import 블록에 다음 한 줄 추가:
```ts
import { TodayReminderSection } from "@/components/today/today-reminder-section";
```

- [ ] **Step 2: JSX 안에 섹션 마운트**

Edit `web/src/app/(main)/page.tsx` — `<div className="p-4 space-y-3">` 안의
**가장 처음**, PARA 그리드 위에 다음 JSX 추가:
```tsx
<TodayReminderSection />
```

수정 후 해당 JSX 구간:
```tsx
<div className="p-4 space-y-3">
  <TodayReminderSection />
  <div className="grid grid-cols-2 gap-3">
    {PARA_ORDER.map((category) => (
      <ParaCard ... />
    ))}
  </div>
  <UnassignedCard ... />
</div>
```

- [ ] **Step 3: TS 컴파일 + 린트 확인**

Run (from `web/`):
```bash
npx tsc --noEmit && npm run lint
```

Expected: 에러 없음.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/\(main\)/page.tsx
git commit -m "feat(web): mount TodayReminderSection on library home"
```

---

### Task 8: 수동 End-to-End 검증

이 태스크는 **코드 변경 없음**. 실제로 동작하는지 눈으로 확인.

- [ ] **Step 1: dev 서버 기동**

Run (from `web/`):
```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속.

- [ ] **Step 2: 로그인 후 메인 페이지 확인**

기존 계정으로 로그인 → 라이브러리 홈으로 진입.

확인 사항:
- 페이지 상단(PARA 그리드 위)에 "오늘 다시 볼 링크" 섹션이 보인다.
- 미열람 링크가 있다면 카드 형태로 나타난다 (제목 + 폴더명 + URL).
- 미열람 링크가 없다면 "오늘 다시 볼 링크가 없어요." 빈 상태가 보인다.

- [ ] **Step 3: link_reminders 행이 생겼는지 확인**

Supabase SQL Editor 또는 psql에서:
```sql
SELECT id, link_id, mode, channel, sent_at
FROM link_reminders
WHERE user_id = '<your-user-uuid>'
ORDER BY sent_at DESC
LIMIT 10;
```

Expected: 방금 메인 페이지를 연 직후 `mode='daily'`, `channel='dashboard'`,
`sent_at` ≈ 현재 시각인 행이 추가되어 있음 (캐시 미스 케이스).

- [ ] **Step 4: 4시간 TTL 동작 확인**

브라우저에서 메인 페이지 새로고침 → 같은 5개(또는 max_items만큼)가 같은
순서로 표시됨. 그 다음 위 SQL을 다시 실행:

Expected: `link_reminders` 행 수가 **증가하지 않음**. (캐시 hit이므로 insert
안 됨.)

- [ ] **Step 5: 401 동작 확인**

브라우저 시크릿 창에서 미인증으로 `http://localhost:3000/api/reminders/today`
직접 호출.

Expected: `{"error":"unauthorized"}` 응답 + Network 탭에서 401 상태 코드.

- [ ] **Step 6: 빈 상태 확인 (테스트 계정)**

미열람 링크가 0개인 신규 테스트 계정으로 로그인 → 메인 페이지.

Expected: 섹션에 "오늘 다시 볼 링크가 없어요." 빈 상태 메시지.

- [ ] **Step 7: dev 서버 종료 및 확인 결과 정리**

`Ctrl+C` 로 dev 서버 종료.

위 6개 항목 중 하나라도 실패하면, 어느 단계에서 어떤 동작이 보였는지 메모
후 picker / route / component 중 해당 책임 모듈로 돌아간다. 모두 통과하면
플랜 완료.

---

## 작업 후 점검

이 플랜은 **스펙 §10 검증 계획** 의 1, 3, 4 항목을 다룬다 (단위 테스트
Task 3 / RLS는 createClient + auth.getUser로 자동 보장 / 수동 4상태 Task 8).

스펙 §10의 2 (picker 통합 테스트)는 별도 후속 작업이다. 통합 테스트
프레임 도입은 다음 리마인드 모드(`priority`, `resurface`) 추가 시점에 함께
설계하는 것이 효율적이다 — 모드 분기 패턴이 굳어진 후에 테스트 골격을
짜야 중복이 없다.
