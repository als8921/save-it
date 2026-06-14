# 매일 리마인드 알림 — 대표 링크 1개 중심으로 개편

작성일: 2026-06-14

## 배경 / 문제

현재 매일 푸시 알림은 항상 동일한 문구를 보낸다:

```
제목: "오늘 다시 볼 링크"
본문: "{N}개가 있어요"
```

매일 똑같은 문구라 사용자가 무시하게 된다. (`web/src/app/api/cron/remind-push/route.ts`)

## 목표

알림이 **매일 신선하게** 느껴지도록, 단순 개수 대신 **그날의 대표 링크 1개**(실제 제목)를
주인공으로 내세운다. 콘텐츠가 매일 바뀌므로 자연스럽게 다양해진다.

추가 목표:
- 사용자가 **하루 알림 횟수(1/2/3회)** 를 직접 고를 수 있게 한다. (프리셋 시각)

비목표:
- "왜 지금 봐야 하는지" 이유 문구 — **사용하지 않음** (논의 후 제외)
- LLM/AI 문구 생성 — 도입하지 않음 (비용·지연·프라이버시, 앱에 AI 의존성 없음)
- 시각 직접 지정(임의 시각 N개) — **하지 않음**, 프리셋만
- 테스트 알림(`/api/push/test`) 변경 — 그대로 둠

## 알림 형태

- **제목(굵게):** 고정 헤드라인 `다시 볼 링크가 있어요!`
- **본문:** `{대표 링크 제목} 외 {N-1}개`
  - 제목이 없으면 URL host로 폴백 (예: `github.com`)
  - 과도하게 길면 적당히 트림 (약 60자, 이모지 안전)
  - 대표 외 남은 게 없으면(`N == 1`) `외 …` 부분 생략 → `{대표 링크 제목}`
- **탭(url):** `/today` — 전체 목록으로 이동 (변경 없음)

예시:
```
다시 볼 링크가 있어요!
React 서버 컴포넌트 가이드 외 4개
```

## 대표 링크 선정

기존 `pickDailyRemindCandidates()`(`web/src/lib/remind/picker.ts`)로 후보를 점수순으로 받아온 뒤,
그중 **최고 점수 1개를 대표(hero)** 로 고른다.

### 연속 중복 방지 (확정)

인기 링크가 며칠 연속 주인공이 되는 것을 막는다.

1. 최근 `HERO_COOLDOWN_DAYS`(기본 3일)간 **대표로 보낸 링크 id**를 조회
   - `link_reminders` 에서 `user_id` + `channel='push'` + `sent_at >= now - 3일`
2. 후보(점수 내림차순)를 순회하며 **위 목록에 없는 첫 링크**를 대표로 선택
3. 모든 후보가 최근 대표였다면(작은 보관함) → 그냥 최고 점수 후보로 폴백

### 대표 이력 기록

대표 링크를 보낸 뒤 `link_reminders` 에 한 행을 추가한다:
- `channel = 'push'`, `mode = 'daily'`, `link_id = hero.id`, `user_id`

> 후보 전체는 picker 내부에서 이미 `channel='dashboard'`로 기록된다.
> 대표만 `channel='push'`로 별도 기록하므로 연속 중복 방지 조회가 깔끔하다.
> `reminder_channel` enum에 `'push'`가 이미 있어 **DB 마이그레이션 불필요**.

## 하루 알림 횟수 (1/2/3회)

사용자가 하루에 알림을 몇 번 받을지 고른다. 시각은 **프리셋**(직접 지정 안 함).

### 프리셋 매핑

기존 `daily_time`(사용자가 고른 아침 시각)을 1번째 슬롯으로 유지하고, 횟수에 따라
프리셋 슬롯을 더한다.

| 횟수 | 시각 |
|---|---|
| 1회 | `daily_time` (아침) |
| 2회 | `daily_time`, `21:00` (저녁) |
| 3회 | `daily_time`, `13:00` (점심), `21:00` (저녁) |

- 점심/저녁 프리셋 시각은 상수(`DAILY_PRESET_AFTERNOON`, `DAILY_PRESET_EVENING`).
- 모두 **로컬 시각**이며 cron이 사용자 timezone 기준으로 매칭하므로 TZ별로 자연 동작.
- 모두 **정각**으로 둔다 (시간당 cron + ±30분 윈도우에서 각 시각이 정확히 한 틱에만 매칭).
- `deriveScheduleTimes(daily_time, daily_count)` 순수 함수로 시각 목록 생성. 중복 시각은 dedupe.

### 스키마 변경 (마이그레이션 필요)

```sql
alter table user_reminder_prefs
  add column daily_count smallint not null default 1
  check (daily_count between 1 and 3);
```

> ⚠️ 대표 링크 개편 자체는 마이그레이션이 필요 없지만, **이 횟수 기능 때문에 마이그레이션 1건이 추가**된다.

### cron 매칭 변경

현재는 단일 `daily_time` ±30분만 검사한다. 이를 **파생 시각 목록 중 하나라도** ±30분이면
발송하도록 변경한다 (`web/src/app/api/cron/remind-push/route.ts`).

```ts
const times = deriveScheduleTimes(row.daily_time, row.daily_count);
const localNow = formatLocalTime(now, row.timezone);
const hit = times.some(
  (t) => Math.abs(timeStringToSeconds(t) - timeStringToSeconds(localNow)) <= 1800
);
if (hit) userIds.push(row.user_id);
```

하루 여러 번 발송돼도 **대표 링크 연속 중복 방지**(최근 3일 hero 제외)가 그대로 적용되어
같은 날 2·3번째 알림도 다른 대표 링크가 나온다.

### 설정 UI

설정 화면에 **횟수 선택(1/2/3회)** 컨트롤 추가 → `user_reminder_prefs.daily_count` 저장.
저장 API/액션은 기존 prefs 갱신 경로를 따른다.

## 변경 범위

| 파일 | 변경 |
|---|---|
| `web/src/lib/remind/notification.ts` (신규) | 대표 선정 + payload 빌더 + 대표 이력 기록. 순수 로직 위주, 테스트 대상 |
| `web/src/lib/remind/schedule.ts` (신규) | `deriveScheduleTimes(daily_time, daily_count)` 순수 함수 |
| `web/src/app/api/cron/remind-push/route.ts` | payload 생성 교체 + 다중 시각 매칭 |
| `web/src/lib/remind/constants.ts` | `HERO_COOLDOWN_DAYS`, `REMIND_CHANNEL_PUSH`, `DAILY_PRESET_AFTERNOON/EVENING` 추가 |
| `web/supabase/migrations/*_daily_count.sql` (신규) | `user_reminder_prefs.daily_count` 컬럼 추가 |
| 설정 화면 컴포넌트 | 횟수(1/2/3회) 선택 UI + prefs 저장 |
| (테스트) `web/src/lib/remind/*.test.ts` (신규) | 빌더/선정/시각 파생 단위 테스트 |

`send.ts`, `vapid.ts`, service worker(`sw.js`), 구독 관리, 테스트 알림은 **변경 없음**.
sw.js는 이미 `{title, body, url}` payload를 그대로 렌더하므로 호환됨.

## 핵심 인터페이스 (초안)

```ts
// notification.ts
interface ReminderNotification {
  hero: RemindCandidate;        // 대표 링크
  payload: { title: string; body: string; url: string };
}

// 후보 + 최근 대표 id 목록을 받아 알림을 구성 (순수 함수, 테스트 용이)
function buildReminderNotification(
  candidates: RemindCandidate[],
  recentHeroLinkIds: string[]
): ReminderNotification | null   // 후보 0개면 null

// 최근 대표 link id 조회 / 대표 기록 (Supabase 의존)
async function fetchRecentHeroLinkIds(supabase, userId): Promise<string[]>
async function recordHeroSent(supabase, userId, linkId): Promise<void>
```

cron 흐름:
```
candidates = pickDailyRemindCandidates(userId, supabase)   // 변경 없음
recent     = fetchRecentHeroLinkIds(supabase, userId)
notif      = buildReminderNotification(candidates, recent) // 순수
if (!notif) skip
subs 로 notif.payload 발송 (기존 sendToSubscription 재사용)
recordHeroSent(supabase, userId, notif.hero.link.id)
```

## 엣지 케이스

- 후보 0개 → 발송 skip (현행과 동일)
- 대표 제목 빈 문자열/null → host 폴백, host도 없으면 `"저장한 링크"`
- 후보 1개 → 본문 `저장한 링크`
- 제목 길이 초과 → 약 60자 트림 + `…`
- 모든 후보가 최근 대표 → 최고 점수 후보로 폴백 (알림이 사라지지 않게)
- `daily_time`이 프리셋 시각(13:00/21:00)과 겹침 → `deriveScheduleTimes`에서 dedupe
- 같은 날 2·3번째 발송 → hero 쿨다운으로 다른 대표 링크 (후보 0개면 skip)

## 테스트 전략

`buildReminderNotification`는 순수 함수라 단위 테스트로 커버:
- 최고 점수 후보가 대표로 선택되는지
- 최근 대표는 건너뛰고 다음 후보가 선택되는지
- 모든 후보가 최근 대표면 폴백되는지
- 본문 개수 표기(`외 N개` / 생략)
- 제목 없음 → host 폴백 / 길이 트림
- 후보 0개 → null

`deriveScheduleTimes`도 순수 함수로 커버:
- 1/2/3회 각각의 시각 목록
- `daily_time`이 프리셋과 겹칠 때 dedupe
- 시각 문자열 포맷
