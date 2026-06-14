# 매일 리마인드 알림 대표 링크 + 횟수 선택 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매일 똑같던 `"N개가 있어요"` 알림을 그날의 대표 링크 1개(실제 제목) 중심으로 바꾸고, 사용자가 하루 알림 횟수(1/2/3회)를 고를 수 있게 한다.

**Architecture:** 알림 본문 생성과 대표 링크 선정은 순수 함수(`notification.ts`)로 분리해 단위 테스트한다. 하루 시각 파생도 순수 함수(`schedule.ts`)로 분리한다. cron 라우트는 이 함수들을 호출하고, 대표 링크 이력은 기존 `link_reminders` 테이블에 `channel='push'`로 기록해 연속 중복을 방지한다. 횟수는 `user_reminder_prefs.daily_count` 컬럼(신규)에 저장하고 설정 화면에서 편집한다.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase (Postgres + RLS), web-push, vitest, Tailwind.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `web/src/lib/remind/constants.ts` (수정) | 신규 상수 추가 |
| `web/src/lib/remind/schedule.ts` (신규) | `deriveScheduleTimes` — 횟수→시각 목록 (순수) |
| `web/src/lib/remind/schedule.test.ts` (신규) | schedule 단위 테스트 |
| `web/src/lib/remind/notification.ts` (신규) | 대표 선정·payload 빌더(순수) + 대표 이력 DB 헬퍼 |
| `web/src/lib/remind/notification.test.ts` (신규) | 빌더 단위 테스트 |
| `web/src/app/api/cron/remind-push/route.ts` (수정) | 다중 시각 매칭 + 대표 링크 payload + 이력 기록 |
| `web/supabase/migrations/20260614120000_daily_count.sql` (신규) | `daily_count` 컬럼 |
| `web/src/app/api/reminders/prefs/route.ts` (신규) | 횟수 저장 API (PATCH) |
| `web/src/components/settings/reminder-frequency.tsx` (신규) | 횟수 선택 UI |
| `web/src/app/(main)/settings/page.tsx` (수정) | prefs 조회 + 컴포넌트 배치 |

> 참고: GitHub Actions cron(`.github/workflows/remind-push.yml`), `send.ts`, `vapid.ts`, `sw.js`, 구독 관리, 테스트 알림(`/api/push/test`)은 변경하지 않는다. 모든 명령은 `web/` 디렉터리 기준으로 실행한다.

---

### Task 1: 상수 추가

**Files:**
- Modify: `web/src/lib/remind/constants.ts`

- [ ] **Step 1: 상수 추가**

`web/src/lib/remind/constants.ts` 파일 맨 끝에 아래를 추가한다 (기존 `REMIND_CHANNEL_DASHBOARD` 줄 다음):

```ts
export const REMIND_CHANNEL_PUSH = "push" as const;

// 대표(hero) 링크 연속 중복 방지: 최근 N일간 대표였던 링크는 제외
export const HERO_COOLDOWN_DAYS = 3;

// 하루 알림 횟수별 프리셋 시각 (로컬 시각, 정각). 아침은 user의 daily_time 사용.
export const DAILY_PRESET_AFTERNOON = "13:00:00" as const;
export const DAILY_PRESET_EVENING = "21:00:00" as const;
```

- [ ] **Step 2: 타입 체크**

Run: `npm run lint`
Expected: 에러 없음 (미사용 변수 경고가 나올 수 있으나 다음 태스크에서 사용)

- [ ] **Step 3: 커밋**

```bash
git add web/src/lib/remind/constants.ts
git commit -m "feat(remind): 대표 링크·알림 횟수용 상수 추가"
```

---

### Task 2: 시각 파생 함수 `deriveScheduleTimes`

**Files:**
- Create: `web/src/lib/remind/schedule.ts`
- Test: `web/src/lib/remind/schedule.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`web/src/lib/remind/schedule.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { deriveScheduleTimes } from "./schedule";

describe("deriveScheduleTimes", () => {
  it("count 1 → 아침만", () => {
    expect(deriveScheduleTimes("09:00:00", 1)).toEqual(["09:00:00"]);
  });

  it("count 2 → 아침 + 저녁", () => {
    expect(deriveScheduleTimes("09:00:00", 2)).toEqual(["09:00:00", "21:00:00"]);
  });

  it("count 3 → 아침 + 점심 + 저녁 (정렬)", () => {
    expect(deriveScheduleTimes("09:00:00", 3)).toEqual([
      "09:00:00",
      "13:00:00",
      "21:00:00",
    ]);
  });

  it("HH:MM 을 HH:MM:SS 로 정규화", () => {
    expect(deriveScheduleTimes("9:00", 1)).toEqual(["09:00:00"]);
  });

  it("daily_time 이 프리셋과 겹치면 dedupe", () => {
    expect(deriveScheduleTimes("21:00:00", 2)).toEqual(["21:00:00"]);
  });

  it("count 가 범위를 벗어나면 1로 취급", () => {
    expect(deriveScheduleTimes("09:00:00", 0)).toEqual(["09:00:00"]);
    expect(deriveScheduleTimes("09:00:00", 5)).toEqual(["09:00:00"]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- schedule`
Expected: FAIL — `deriveScheduleTimes is not a function` / 모듈 없음

- [ ] **Step 3: 구현**

`web/src/lib/remind/schedule.ts`:

```ts
import { DAILY_PRESET_AFTERNOON, DAILY_PRESET_EVENING } from "./constants";

function normalizeTime(t: string): string {
  const [h = "0", m = "0", s = "0"] = t.split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}:${s.padStart(2, "0")}`;
}

/**
 * 하루 알림 횟수(1~3)에 따른 발송 시각 목록을 만든다.
 * 아침 = 사용자의 daily_time, 점심/저녁 = 프리셋. 중복은 제거하고 정렬한다.
 */
export function deriveScheduleTimes(dailyTime: string, dailyCount: number): string[] {
  const count = Number.isInteger(dailyCount) && dailyCount >= 1 && dailyCount <= 3
    ? dailyCount
    : 1;
  const slots = [normalizeTime(dailyTime)];
  if (count >= 3) slots.push(DAILY_PRESET_AFTERNOON);
  if (count >= 2) slots.push(DAILY_PRESET_EVENING);
  return [...new Set(slots)].sort();
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- schedule`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add web/src/lib/remind/schedule.ts web/src/lib/remind/schedule.test.ts
git commit -m "feat(remind): 하루 횟수별 발송 시각 파생 함수 추가"
```

---

### Task 3: 알림 빌더 `buildReminderNotification` (순수)

**Files:**
- Create: `web/src/lib/remind/notification.ts`
- Test: `web/src/lib/remind/notification.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`web/src/lib/remind/notification.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildReminderNotification } from "./notification";
import type { RemindCandidate } from "./picker";

function cand(
  id: string,
  title: string,
  score: number,
  url = "https://example.com/x"
): RemindCandidate {
  return {
    link: {
      id,
      user_id: "u",
      folder_id: null,
      url,
      title,
      description: null,
      priority: 0,
      is_read: false,
      created_at: "2026-06-01T00:00:00Z",
      read_at: null,
    },
    folder: { id: "f", name: "폴더", para_category: null },
    score,
  };
}

describe("buildReminderNotification", () => {
  it("후보가 없으면 null", () => {
    expect(buildReminderNotification([], [])).toBeNull();
  });

  it("최고 점수 후보를 대표로 선택", () => {
    const n = buildReminderNotification([cand("a", "A", 0.9), cand("b", "B", 0.5)], []);
    expect(n?.hero.link.id).toBe("a");
    expect(n?.payload.title).toBe("A");
  });

  it("최근 대표는 건너뛰고 다음 후보 선택", () => {
    const n = buildReminderNotification([cand("a", "A", 0.9), cand("b", "B", 0.5)], ["a"]);
    expect(n?.hero.link.id).toBe("b");
  });

  it("모든 후보가 최근 대표면 최고 점수로 폴백", () => {
    const n = buildReminderNotification(
      [cand("a", "A", 0.9), cand("b", "B", 0.5)],
      ["a", "b"]
    );
    expect(n?.hero.link.id).toBe("a");
  });

  it("본문에 남은 개수 표기", () => {
    const n = buildReminderNotification(
      [cand("a", "A", 0.9), cand("b", "B", 0.5), cand("c", "C", 0.1)],
      []
    );
    expect(n?.payload.body).toBe("저장한 링크 · 외 2개");
  });

  it("후보 1개면 개수 생략", () => {
    const n = buildReminderNotification([cand("a", "A", 0.9)], []);
    expect(n?.payload.body).toBe("저장한 링크");
  });

  it("제목이 비면 host 로 폴백", () => {
    const n = buildReminderNotification(
      [cand("a", "", 0.9, "https://news.ycombinator.com/item?id=1")],
      []
    );
    expect(n?.payload.title).toBe("news.ycombinator.com");
  });

  it("긴 제목은 60자로 트림", () => {
    const long = "가".repeat(80);
    const n = buildReminderNotification([cand("a", long, 0.9)], []);
    expect(n?.payload.title.length).toBe(60);
    expect(n?.payload.title.endsWith("…")).toBe(true);
  });

  it("url 은 항상 /today", () => {
    const n = buildReminderNotification([cand("a", "A", 0.9)], []);
    expect(n?.payload.url).toBe("/today");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- notification`
Expected: FAIL — 모듈/함수 없음

- [ ] **Step 3: 구현 (빌더 부분)**

`web/src/lib/remind/notification.ts`:

```ts
import type { RemindCandidate } from "./picker";

export interface ReminderPayload {
  title: string;
  body: string;
  url: string;
}

export interface ReminderNotification {
  hero: RemindCandidate;
  payload: ReminderPayload;
}

const TITLE_MAX = 60;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname || "저장한 링크";
  } catch {
    return "저장한 링크";
  }
}

function heroTitle(c: RemindCandidate): string {
  const raw = c.link.title?.trim();
  const base = raw && raw.length > 0 ? raw : hostOf(c.link.url);
  return base.length > TITLE_MAX ? base.slice(0, TITLE_MAX - 1) + "…" : base;
}

/**
 * 후보(점수 내림차순)에서 최근 대표가 아닌 첫 링크를 대표로 골라 알림 payload 를 만든다.
 * 모두 최근 대표면 최고 점수로 폴백. 후보가 없으면 null.
 */
export function buildReminderNotification(
  candidates: RemindCandidate[],
  recentHeroLinkIds: string[]
): ReminderNotification | null {
  if (candidates.length === 0) return null;
  const recent = new Set(recentHeroLinkIds);
  const hero = candidates.find((c) => !recent.has(c.link.id)) ?? candidates[0];
  const rest = candidates.length - 1;
  const body = rest > 0 ? `저장한 링크 · 외 ${rest}개` : "저장한 링크";
  return { hero, payload: { title: heroTitle(hero), body, url: "/today" } };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- notification`
Expected: PASS (9 tests)

> 참고: `notification.ts` 는 `import type` 만 쓰므로 vitest 에서 `server-only`(picker) 가 실행되지 않는다. `"server-only"` 를 이 파일에 넣지 말 것.

- [ ] **Step 5: 커밋**

```bash
git add web/src/lib/remind/notification.ts web/src/lib/remind/notification.test.ts
git commit -m "feat(remind): 대표 링크 알림 빌더 추가"
```

---

### Task 4: 대표 이력 DB 헬퍼

**Files:**
- Modify: `web/src/lib/remind/notification.ts`

- [ ] **Step 1: 헬퍼 추가**

`web/src/lib/remind/notification.ts` 의 import 줄을 아래로 교체한다:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RemindCandidate } from "./picker";
import {
  HERO_COOLDOWN_DAYS,
  REMIND_CHANNEL_PUSH,
  REMIND_MODE_DAILY,
} from "./constants";
```

그리고 파일 맨 끝에 아래 두 함수를 추가한다:

```ts
/** 최근 HERO_COOLDOWN_DAYS 일간 대표(channel='push')로 보낸 link_id 목록 */
export async function fetchRecentHeroLinkIds(
  supabase: SupabaseClient,
  userId: string
): Promise<string[]> {
  const since = new Date(
    Date.now() - HERO_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const { data } = await supabase
    .from("link_reminders")
    .select("link_id")
    .eq("user_id", userId)
    .eq("channel", REMIND_CHANNEL_PUSH)
    .gte("sent_at", since);
  return (data ?? []).map((r) => r.link_id as string);
}

/** 대표 링크 발송 이력을 channel='push' 로 기록 */
export async function recordHeroSent(
  supabase: SupabaseClient,
  userId: string,
  linkId: string
): Promise<void> {
  const { error } = await supabase.from("link_reminders").insert({
    link_id: linkId,
    user_id: userId,
    channel: REMIND_CHANNEL_PUSH,
    mode: REMIND_MODE_DAILY,
  });
  if (error) {
    console.error("[remind] recordHeroSent failed:", error.message);
  }
}
```

- [ ] **Step 2: 기존 테스트가 여전히 통과하는지 확인**

Run: `npm test -- notification`
Expected: PASS (9 tests) — 헬퍼는 순수 빌더 테스트에 영향 없음

- [ ] **Step 3: 타입 체크**

Run: `npm run lint`
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add web/src/lib/remind/notification.ts
git commit -m "feat(remind): 대표 링크 발송 이력 조회·기록 헬퍼 추가"
```

---

### Task 5: cron 라우트 연결 (다중 시각 + 대표 링크)

**Files:**
- Modify: `web/src/app/api/cron/remind-push/route.ts`

- [ ] **Step 1: 라우트 전체 교체**

`web/src/app/api/cron/remind-push/route.ts` 전체를 아래로 교체한다:

```ts
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { pickDailyRemindCandidates } from "@/lib/remind/picker";
import { sendToSubscription, type SubscriptionRow } from "@/lib/push/send";
import { deriveScheduleTimes } from "@/lib/remind/schedule";
import {
  buildReminderNotification,
  fetchRecentHeroLinkIds,
  recordHeroSent,
} from "@/lib/remind/notification";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date();

  const { data: prefs } = await supabase
    .from("user_reminder_prefs")
    .select("user_id, daily_time, daily_count, timezone")
    .eq("daily_enabled", true);

  // 사용자별 파생 시각 목록 중 하나라도 현재 로컬 시각 ±30분이면 발송 대상
  const userIds: string[] = [];
  for (const row of prefs ?? []) {
    const times = deriveScheduleTimes(
      row.daily_time as string,
      (row.daily_count as number) ?? 1
    );
    const localNow = formatLocalTime(now, row.timezone as string);
    const localSec = timeStringToSeconds(localNow);
    const hit = times.some(
      (t) => Math.abs(timeStringToSeconds(t) - localSec) <= 1800
    );
    if (hit) userIds.push(row.user_id as string);
  }

  let sent = 0;
  let skipped = 0;
  let removed = 0;

  for (const userId of userIds) {
    try {
      const candidates = await pickDailyRemindCandidates(userId, supabase);
      const recentHeroes = await fetchRecentHeroLinkIds(supabase, userId);
      const notif = buildReminderNotification(candidates, recentHeroes);
      if (!notif) {
        skipped++;
        continue;
      }

      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("user_id", userId);

      if (!subs || subs.length === 0) {
        skipped++;
        continue;
      }

      for (const row of subs) {
        const outcome = await sendToSubscription(
          supabase,
          row as SubscriptionRow,
          notif.payload
        );
        if (outcome.delivered) sent++;
        if (outcome.removed) removed++;
      }

      await recordHeroSent(supabase, userId, notif.hero.link.id);
    } catch (err) {
      console.error(`[cron] user ${userId} failed:`, err);
    }
  }

  return NextResponse.json({ sent, skipped, removed });
}

function timeStringToSeconds(t: string): number {
  const [h, m, s] = t.split(":").map((x) => parseInt(x, 10));
  return h * 3600 + m * 60 + (s ?? 0);
}

function formatLocalTime(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}
```

- [ ] **Step 2: 타입 체크 + 빌드**

Run: `npm run lint`
Expected: 에러 없음

> 참고: 이 시점에서 `daily_count` 컬럼이 아직 DB 에 없지만, 코드는 `?? 1` 폴백으로 안전하다. 컬럼은 Task 6 에서 추가한다. (Supabase 타입이 select 컬럼명을 검증하지 않으면 lint 통과)

- [ ] **Step 3: 커밋**

```bash
git add web/src/app/api/cron/remind-push/route.ts
git commit -m "feat(remind): cron 다중 시각 매칭·대표 링크 알림 적용"
```

---

### Task 6: `daily_count` 마이그레이션

**Files:**
- Create: `web/supabase/migrations/20260614120000_daily_count.sql`

- [ ] **Step 1: 마이그레이션 파일 작성**

`web/supabase/migrations/20260614120000_daily_count.sql`:

```sql
-- 하루 알림 횟수 (1~3). 1=아침, 2=아침+저녁, 3=아침+점심+저녁
alter table user_reminder_prefs
  add column daily_count smallint not null default 1
  check (daily_count between 1 and 3);
```

- [ ] **Step 2: 마이그레이션 적용**

로컬 Supabase 를 쓰는 경우:

Run: `npx supabase db push`
Expected: 마이그레이션 적용 성공

원격 프로젝트만 쓰는 경우, Supabase MCP `apply_migration` 으로 위 SQL 을 `daily_count` 이름으로 적용한다. 적용 후:

Run: `npx supabase migration list`
Expected: `20260614120000` 항목이 applied 로 표시

- [ ] **Step 3: 커밋**

```bash
git add web/supabase/migrations/20260614120000_daily_count.sql
git commit -m "feat(remind): user_reminder_prefs.daily_count 컬럼 추가"
```

---

### Task 7: 횟수 저장 API (PATCH)

**Files:**
- Create: `web/src/app/api/reminders/prefs/route.ts`

- [ ] **Step 1: 라우트 작성**

`web/src/app/api/reminders/prefs/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { daily_count?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const count = Number(body.daily_count);
  if (!Number.isInteger(count) || count < 1 || count > 3) {
    return NextResponse.json({ error: "invalid_daily_count" }, { status: 400 });
  }

  const { error } = await supabase
    .from("user_reminder_prefs")
    .update({ daily_count: count })
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, daily_count: count });
}
```

- [ ] **Step 2: 타입 체크**

Run: `npm run lint`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add web/src/app/api/reminders/prefs/route.ts
git commit -m "feat(remind): 알림 횟수 저장 API(PATCH) 추가"
```

---

### Task 8: 설정 화면 횟수 선택 UI

**Files:**
- Create: `web/src/components/settings/reminder-frequency.tsx`
- Modify: `web/src/app/(main)/settings/page.tsx`

- [ ] **Step 1: 컴포넌트 작성**

`web/src/components/settings/reminder-frequency.tsx`:

```tsx
"use client";

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: 1, label: "하루 1번", hint: "아침" },
  { value: 2, label: "하루 2번", hint: "아침·저녁" },
  { value: 3, label: "하루 3번", hint: "아침·점심·저녁" },
] as const;

export function ReminderFrequency({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);
  const [saving, setSaving] = useState(false);

  async function select(value: number) {
    if (value === count || saving) return;
    const prev = count;
    setCount(value);
    setSaving(true);
    try {
      const res = await fetch("/api/reminders/prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daily_count: value }),
      });
      if (!res.ok) setCount(prev);
    } catch {
      setCount(prev);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-2">
      <h2 className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        알림 횟수
      </h2>
      <div className="overflow-hidden rounded-2xl border bg-card">
        {OPTIONS.map((opt, i) => {
          const active = count === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => select(opt.value)}
              disabled={saving}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-3.5 text-sm transition-colors active:bg-accent disabled:opacity-60",
                i > 0 && "border-t border-border"
              )}
            >
              <CalendarClock
                className={cn(
                  "h-5 w-5 shrink-0",
                  active
                    ? "text-[color:var(--color-para-project-fg)]"
                    : "text-muted-foreground"
                )}
              />
              <span className="flex-1 text-left font-medium">{opt.label}</span>
              <span className="text-xs text-muted-foreground">{opt.hint}</span>
              <span
                className={cn(
                  "text-sm",
                  active
                    ? "text-[color:var(--color-para-project-fg)]"
                    : "opacity-0"
                )}
                aria-hidden
              >
                ✓
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: 설정 페이지에 prefs 조회 + 컴포넌트 배치**

`web/src/app/(main)/settings/page.tsx` 전체를 아래로 교체한다:

```tsx
import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/actions/sign-out-button";
import { PushToggle } from "@/components/settings/push-toggle";
import { ReminderFrequency } from "@/components/settings/reminder-frequency";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: prefs } = await supabase
    .from("user_reminder_prefs")
    .select("daily_count")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();

  return (
    <div
      className="space-y-6 p-4"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)" }}
    >
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">설정</h1>
        <p className="text-sm text-muted-foreground">알림과 계정을 관리해요.</p>
      </header>

      <PushToggle />

      <ReminderFrequency initialCount={prefs?.daily_count ?? 1} />

      <section className="space-y-2">
        <h2 className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          계정
        </h2>
        <div className="divide-y divide-border overflow-hidden rounded-2xl border bg-card">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Mail className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <div className="text-sm font-medium">이메일</div>
              <div className="truncate text-xs text-muted-foreground">
                {user?.email}
              </div>
            </div>
          </div>
          <SignOutButton />
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: 타입 체크 + 빌드**

Run: `npm run lint && npm run build`
Expected: 에러 없음, 빌드 성공

- [ ] **Step 4: 커밋**

```bash
git add web/src/components/settings/reminder-frequency.tsx web/src/app/\(main\)/settings/page.tsx
git commit -m "feat(remind): 설정 화면에 알림 횟수 선택 UI 추가"
```

---

### Task 9: 최종 검증

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 테스트**

Run: `npm test`
Expected: 모든 테스트 PASS (기존 + schedule 6 + notification 9)

- [ ] **Step 2: lint + build**

Run: `npm run lint && npm run build`
Expected: 에러 없음, 빌드 성공

- [ ] **Step 3: 수동 확인 체크리스트 (가능하면)**

- 설정 화면에서 횟수 1/2/3 전환 → 네트워크 탭에 `PATCH /api/reminders/prefs` 200, DB `daily_count` 갱신
- `workflow_dispatch` 로 GitHub Actions "Hourly Push Reminder" 수동 실행 → 응답 JSON `{ sent, skipped, removed }`
- (구독된 기기에서) 매칭 시각에 알림 제목이 실제 링크 제목으로 오는지

- [ ] **Step 4: 브랜치 정리**

`superpowers:finishing-a-development-branch` 스킬로 머지/PR 여부를 결정한다.

---

## 검증 노트

- **연속 중복 방지 동작:** 같은 날 2·3번째 발송 시 `fetchRecentHeroLinkIds` 가 직전 대표를 포함하므로 `buildReminderNotification` 이 다른 후보를 고른다. 후보가 1개뿐이면 폴백으로 같은 링크가 다시 나올 수 있음(의도된 동작).
- **마이그레이션 의존:** Task 5(cron)는 `?? 1` 폴백으로 Task 6 이전에도 깨지지 않지만, 실제 다중 발송은 Task 6 적용 후부터 동작한다.
- **테스트 알림 경로(`/api/push/test`)는 변경하지 않음** — 기존 "테스트 알림이 잘 오나" 확인 용도 유지.
