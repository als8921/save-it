# 리마인드: "다시 볼 시간" 모드 스코어링 & 추천 API 설계

> 작성일: 2026-05-26
> 관련 문서: `docs/REMIND_STRATEGY.md`, `docs/ERD.md`, `docs/PRD.md`
> 관련 마이그레이션: `web/supabase/migrations/00004_reminders.sql`

---

## 1. 배경과 목적

`REMIND_STRATEGY.md`는 MVP/v1/v2 전 범위를 다루지만, 한 번에 다 만들 수 없다.
이 스펙은 그중 **점수 기반 후보 산출 로직과 그것을 노출하는 백엔드 API** 한
조각만 다룬다. 이 조각이 이후 모든 리마인드 채널(대시보드 / 익스텐션 /
이메일 다이제스트 / Vercel Cron)의 공용 토대가 된다.

### 1.1 이번에 만드는 것 (스코프)

- `REMIND_STRATEGY.md §2.3` 의 **"다시 볼 시간" 모드** 단 1종
- 점수 계산(필터 + 가중치 합) — TypeScript 서버 코드
- `GET /api/reminders/today` Route Handler
- 메인 페이지(`web/src/app/(main)/page.tsx`)에 SWR로 결과를 표시하는 클라이언트 섹션
- TTL 4시간 묶음 캐싱 (`link_reminders` 활용)

### 1.2 이번에 만들지 않는 것 (의도적 제외)

- 다른 모드 (`priority` / `weekly` / `resurface` / `youtube_ctx` / `domain_ctx`)
- Vercel Cron 일일 다이제스트 — 단, 추후 도입을 막지 않도록 함수 시그니처는
  cron이 그대로 호출 가능한 형태로 설계
- 이메일/푸시 채널
- 스누즈, "왜 보여주는가" 라벨, 일괄 액션 같은 UX 디테일
- 가중치 자동 튜닝, A/B 실험
- 묶음 ID(batch_id) 도입 — 같은 4시간 윈도우 = 한 묶음으로 충분

---

## 2. 점수 공식

### 2.1 필터 (하드 컷)

후보 SELECT 단계에서 다음 조건을 모두 만족해야 한다.

1. `links.is_read = false`
2. 소속 folder의 `para_category != 'archive'` (null = 미지정은 통과)
3. 최근 7일 내에 `link_reminders.sent_at`이 존재하지 않음
   (`mode='daily' AND channel='dashboard'` 기준)

조건 3은 `REMIND_STRATEGY §2.2`의 `-w5 * (피로 감점)`을 단순한 하드 컷으로
구현한 것이다. 점수 항목을 줄여 디버깅을 쉽게 한다.

### 2.2 점수식

필터를 통과한 링크에 대해:

```
score = 0.4 * priority_norm
      + 0.3 * para_weight
      + 0.3 * age_decay
```

세 항목 모두 0~1 범위이며 가중치 합 = 1.0이라 `score` 자체도 0~1.

| 변수 | 매핑 |
|------|------|
| `priority_norm` | `clamp(priority, 0, 2) / 2` → 0(보통) / 0.5(중요) / 1.0(매우) |
| `para_weight` | project=1.0, area=0.7, resource=0.5, null(미지정)=0.5 |
| `age_decay` | Gaussian: `exp(-((days - 7)² / (2 * 10²)))` |

`days`는 `floor((now - links.created_at).totalDays)`.

`age_decay` 곡선 감 잡기:

| days | age_decay |
|------|-----------|
| 0    | 0.78 |
| 3    | 0.92 |
| 7    | 1.00 (피크) |
| 14   | 0.78 |
| 21   | 0.37 |
| 30   | 0.07 |
| 60   | ≈ 0 |

저장 직후 며칠과 1~2주 전 저장이 가장 유리하고, 한 달 이상 묵힌 링크는
사실상 0에 수렴한다. (오래된 자료는 별도 `resurface` 모드의 영역.)

### 2.3 정렬과 상위 N개

`score` 내림차순으로 정렬 후 상위 N개를 선택한다. N의 결정 순서:

1. (이번 스펙에서는 API에 limit 인자 없음 — 단순화)
2. `user_reminder_prefs.max_items_per_reminder` (기본 5)
3. prefs 행이 없을 때 fallback = 5

---

## 3. API 명세

### 3.1 엔드포인트

```
GET /api/reminders/today
```

- 인증: Supabase 쿠키 세션. `auth.getUser()`로 확인. 미인증이면 401.
- 쿼리 파라미터: 없음

### 3.2 응답

**200 OK**
```json
{
  "items": [
    {
      "link": {
        "id": "uuid",
        "user_id": "uuid",
        "folder_id": "uuid | null",
        "url": "...",
        "title": "...",
        "description": "...",
        "priority": 0,
        "is_read": false,
        "created_at": "ISO",
        "read_at": null
      },
      "folder": {
        "id": "uuid",
        "name": "...",
        "para_category": "project | area | resource | null"
      },
      "score": 0.7325
    }
  ]
}
```

**401 Unauthorized**
```json
{ "error": "unauthorized" }
```

후보가 0개일 때는 `200 { "items": [] }`을 반환한다 (에러 아님).

---

## 4. 데이터 흐름과 TTL 묶음

`pickDailyRemindCandidates(userId)` 의 내부 동작:

```
1. Supabase server client 생성 (createClient(), RLS 컨텍스트)
2. TTL 캐시 체크
   SELECT link_id, sent_at
   FROM link_reminders
   WHERE user_id = $1
     AND mode = 'daily'
     AND channel = 'dashboard'
     AND sent_at >= now() - interval '4 hours'
   ORDER BY sent_at DESC

   ➤ rows > 0 일 때 (캐시 HIT):
     - distinct link_id 추출
     - 그 링크들을 links + folders 조인하여 다시 조회
     - 점수도 재계산해서 score 필드 채움 (UI 일관성)
     - 정렬 후 limit 적용해 반환
     - link_reminders insert는 하지 않음

3. 캐시 MISS:
   3a. 후보 SELECT
       SELECT links.*, folders.para_category, folders.name, folders.id AS folder_id
       FROM links
       LEFT JOIN folders ON folders.id = links.folder_id
       WHERE links.user_id = $1
         AND links.is_read = false
         AND (folders.para_category IS DISTINCT FROM 'archive')
         AND NOT EXISTS (
           SELECT 1 FROM link_reminders lr
           WHERE lr.link_id = links.id
             AND lr.mode = 'daily'
             AND lr.channel = 'dashboard'
             AND lr.sent_at >= now() - interval '7 days'
         )

   3b. JS에서 score 계산 → 정렬 → 상위 N개

   3c. 선택된 N개에 대해 link_reminders 일괄 insert
       (channel='dashboard', mode='daily', sent_at=now())

   3d. 반환
```

### 4.1 묶음 식별

별도 `batch_id` 컬럼은 두지 않는다. "같은 user + mode + channel + 최근
4시간 윈도우" 안의 모든 sent 행 = 한 묶음으로 간주한다.

이 정의는 동시 요청이 둘 다 캐시 미스가 되어 두 묶음이 4시간 윈도우 안에
모두 들어가는 경우(§7.4)에도, distinct link_id를 취해 자연스럽게 하나로
합쳐진다.

### 4.2 4시간 TTL의 의미

- 같은 사용자가 같은 모드의 묶음을 4시간 안에 두 번 보면 같은 5개를 본다.
- 4시간이 지나면 다음 호출에서 새 묶음이 산출된다.
- 결과적으로 하루 평균 묶음 수는 4~6묶음이고, 각 묶음은 link_reminders에
  ≤ `max_items_per_reminder` 행을 남긴다. KPI 집계에 충분한 해상도.

---

## 5. 모듈 구조

```
web/src/lib/remind/
  constants.ts      # 가중치, TTL, 피크값
  scoring.ts        # 순수 함수 calcDailyScore (DB 의존 없음 → 단위 테스트 가능)
  picker.ts         # server-only. pickDailyRemindCandidates(userId)

web/src/app/api/reminders/today/route.ts
  # GET handler:
  #   1) createClient() + auth.getUser() → 미인증 401
  #   2) pickDailyRemindCandidates(user.id)
  #   3) NextResponse.json({ items })

web/src/components/today/today-reminder-section.tsx (client component)
  # SWR로 GET /api/reminders/today
  # 로딩 / 빈 상태 / 에러 / 결과 4가지 UI 분기

# 메인 페이지에서 mount:
web/src/app/(main)/page.tsx
  ... 기존 콘텐츠 ...
  <TodayReminderSection />
```

### 5.1 `constants.ts`

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
  unassigned: 0.5, // folder.para_category IS NULL
  // archive: 필터에서 컷
} as const;

export const AGE_PEAK_DAYS = 7;
export const AGE_SIGMA_DAYS = 10;

export const FATIGUE_WINDOW_DAYS = 7;   // 최근 N일 내 sent_at 있으면 제외
export const REMIND_TTL_HOURS = 4;      // 같은 묶음 재사용 윈도우

export const DEFAULT_MAX_ITEMS = 5;     // prefs 행 없을 때 fallback
```

### 5.2 `scoring.ts`

```ts
import type { ParaCategory } from "@/lib/types";
import {
  REMIND_WEIGHTS,
  PARA_WEIGHT,
  AGE_PEAK_DAYS,
  AGE_SIGMA_DAYS,
} from "./constants";

export interface ScoreInput {
  priority: number;                  // 0|1|2 (clamp됨)
  paraCategory: ParaCategory | null; // archive는 호출 전에 컷
  createdAt: Date;
  now: Date;
}

export function calcDailyScore(input: ScoreInput): number {
  const priorityNorm = Math.max(0, Math.min(2, input.priority)) / 2;

  const paraKey =
    input.paraCategory === null ? "unassigned" : input.paraCategory;
  const paraWeight = PARA_WEIGHT[paraKey] ?? PARA_WEIGHT.unassigned;

  const days =
    (input.now.getTime() - input.createdAt.getTime()) /
    (1000 * 60 * 60 * 24);
  const ageDecay = Math.exp(
    -Math.pow(days - AGE_PEAK_DAYS, 2) / (2 * Math.pow(AGE_SIGMA_DAYS, 2)),
  );

  return (
    REMIND_WEIGHTS.priority * priorityNorm +
    REMIND_WEIGHTS.para * paraWeight +
    REMIND_WEIGHTS.age * ageDecay
  );
}
```

### 5.3 `picker.ts`

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Link, Folder } from "@/lib/types";
import { calcDailyScore } from "./scoring";
import {
  REMIND_TTL_HOURS,
  FATIGUE_WINDOW_DAYS,
  DEFAULT_MAX_ITEMS,
} from "./constants";

export interface RemindCandidate {
  link: Link;
  folder: Pick<Folder, "id" | "name" | "para_category">;
  score: number;
}

export async function pickDailyRemindCandidates(
  userId: string,
): Promise<RemindCandidate[]> {
  const supabase = await createClient();
  const limit = await resolveLimit(supabase, userId);

  // 1. TTL hit?
  const hit = await readRecentBatch(supabase, userId);
  if (hit.length > 0) return rebuildBatch(supabase, hit, limit);

  // 2. miss → 후보 SELECT
  const candidates = await selectCandidates(supabase, userId);
  if (candidates.length === 0) return [];

  // 3. score + sort + take(limit)
  const now = new Date();
  const scored = candidates
    .map(c => ({
      link: c.link,
      folder: c.folder,
      score: calcDailyScore({
        priority: c.link.priority,
        paraCategory: c.folder.para_category,
        createdAt: new Date(c.link.created_at),
        now,
      }),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // 4. record send (insert link_reminders)
  await recordSent(supabase, userId, scored.map(s => s.link.id));

  return scored;
}
```

> 내부 helper(`resolveLimit`, `readRecentBatch`, `rebuildBatch`,
> `selectCandidates`, `recordSent`)의 구체 SQL은 구현 플랜에서 다룬다.
> 이 helper들은 모두 `mode='daily'`, `channel='dashboard'` 를 내부 상수로
> hardcode한다. v1에서 다른 모드/채널이 추가될 때 이 hardcode를 인자로
> 승격한다 (§8 참고).

### 5.4 `route.ts`

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pickDailyRemindCandidates } from "@/lib/remind/picker";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const items = await pickDailyRemindCandidates(user.id);
  return NextResponse.json({ items });
}
```

### 5.5 `today-reminder-section.tsx`

```tsx
"use client";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
});

export function TodayReminderSection() {
  const { data, error, isLoading } = useSWR<{ items: RemindCandidate[] }>(
    "/api/reminders/today",
    fetcher,
  );

  if (isLoading) return <LoadingSkeleton />;
  if (error)    return <ErrorState />;
  if (!data || data.items.length === 0) return <EmptyState />;

  return (
    <section>
      <h2>오늘 다시 볼 링크</h2>
      <ul>
        {data.items.map(c => <RemindCard key={c.link.id} candidate={c} />)}
      </ul>
    </section>
  );
}
```

`RemindCard`는 기존 `LinkCard` 컴포넌트를 재사용하거나 가벼운 래퍼를 둔다.
디테일은 구현 플랜에서.

---

## 6. 의존성 / 환경

- `swr` 신규 의존성 추가 (`web/package.json`)
- 기존 `@supabase/ssr` 그대로 사용
- Next.js 16.2.4 / React 19.2.4 그대로
- DB 마이그레이션 변경 없음 (`00004_reminders.sql` 그대로 사용)

---

## 7. 엣지 케이스

| 상황 | 처리 |
|------|------|
| 후보 0개 | picker가 `[]` 반환, route handler가 `{ items: [] }`, 클라이언트는 빈 상태 UI |
| 폴더 없는 링크 (`folder_id = null`) | scoring에서 `paraCategory=null → "unassigned" → 0.5` (Resources와 동일 정책) |
| Archive 폴더의 링크 | SELECT 단계에서 컷 |
| `user_reminder_prefs` 행 없음 | `resolveLimit`가 `DEFAULT_MAX_ITEMS = 5` 사용 |
| 미인증 호출 | route handler에서 401, picker는 호출 안 됨 |
| `priority` 가 0/1/2 외 값 | `scoring.ts`의 `clamp(0, 2)` |
| 캐시 hit 후 일부 link 삭제됨 | `link_reminders.link_id` FK cascade로 자동 정리 → 부분 결과로 반환 |
| 동시 요청 race (둘 다 캐시 미스) | 두 묶음이 다 insert되지만 다음 hit 시 `distinct link_id` + limit 적용으로 자연 흡수 |
| API fetch 실패 (네트워크/500) | SWR이 `error` 반환 → 클라이언트가 fallback UI (재시도 버튼은 v1) |

---

## 8. v1으로 가는 길 (확장 지점)

이 설계는 다음 항목이 자연스럽게 얹히도록 한다.

| v1 항목 | 본 설계의 어떤 부분이 그대로 쓰이는가 |
|---------|--------------------------------------|
| Vercel Cron 일일 다이제스트 | `pickDailyRemindCandidates(userId)` 함수 그대로 호출. service role 클라이언트로 RLS 우회. cron이 채널을 `email`로 바꿔 insert하도록 picker에 채널 인자 추가 (1줄 변경) |
| 이메일 다이제스트 발송 | cron job이 picker 결과 받아 Resend 등으로 발송 |
| 다른 모드 (`priority`, `resurface`) | `scoring.ts`에 `calcXxxScore`를 추가, picker에 mode 분기 추가. 가중치 상수만 다름 |
| 컨텍스트 매칭 (`youtube_ctx`) | 호스트 필터를 추가한 별도 picker. 같은 모듈 구조 재사용 |
| 스누즈 | `link_reminders.snoozed_until`을 필터 조건에 추가 (`OR snoozed_until > now()`) |
| 가중치 튜닝 | `constants.ts` 한 곳만 수정 |

---

## 9. 미해결 / 후속 결정

- **묶음 식별 강화**: A/B 실험을 시작하면 `batch_id` 컬럼이 필요해진다.
  스키마 마이그레이션 + picker insert 변경 + KPI 집계 수정의 묶음 작업.
- **race condition 강화**: 트래픽이 본격적으로 커진 뒤, `link_reminders`에
  `(user_id, mode, channel, link_id, sent_at::date)` 같은 unique index 또는
  Postgres advisory lock 도입 검토.
- **타임존**: 현재 picker는 server now()를 그대로 쓴다. cron이 붙는 시점에
  `user_reminder_prefs.timezone` 기준으로 "오늘"을 정의해야 함.

---

## 10. 검증 계획 (구현 후)

설계와 별개로 구현 후 확인할 것.

1. `scoring.ts` 단위 테스트 — 표 §2.2의 age_decay 값 검증, 세 항목 합산
2. `picker.ts` 통합 테스트 — 시나리오: 0개 / 1개 / TTL hit / 동시성
3. RLS 통합 — 다른 사용자의 link가 절대 노출되지 않음
4. 메인 페이지 수동 확인 — 빈/로딩/에러/정상 4상태
