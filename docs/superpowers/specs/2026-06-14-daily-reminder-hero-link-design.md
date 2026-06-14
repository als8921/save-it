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

비목표:
- "왜 지금 봐야 하는지" 이유 문구 — **사용하지 않음** (논의 후 제외)
- LLM/AI 문구 생성 — 도입하지 않음 (비용·지연·프라이버시, 앱에 AI 의존성 없음)
- 테스트 알림(`/api/push/test`) 변경 — 그대로 둠

## 알림 형태

- **제목(굵게):** 대표 링크의 실제 제목 (예: `React 서버 컴포넌트 가이드`)
  - 제목이 없으면 URL host로 폴백 (예: `github.com`)
  - 과도하게 길면 적당히 트림 (약 60자)
- **본문:** 남은 개수 표시 — `저장한 링크 · 외 {N-1}개`
  - 대표 외 남은 게 없으면(`N == 1`) `외 …` 부분 생략 → `저장한 링크`
- **탭(url):** `/today` — 전체 목록으로 이동 (변경 없음)

예시:
```
React 서버 컴포넌트 가이드
저장한 링크 · 외 4개
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

## 변경 범위

| 파일 | 변경 |
|---|---|
| `web/src/lib/remind/notification.ts` (신규) | 대표 선정 + payload 빌더 + 대표 이력 기록. 순수 로직 위주, 테스트 대상 |
| `web/src/app/api/cron/remind-push/route.ts` | payload 생성 부분을 신규 빌더 호출로 교체 |
| `web/src/lib/remind/constants.ts` | `HERO_COOLDOWN_DAYS`, `REMIND_CHANNEL_PUSH` 추가 |
| (테스트) `web/src/lib/remind/notification.test.ts` (신규) | 빌더/선정 로직 단위 테스트 |

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

## 테스트 전략

`buildReminderNotification`는 순수 함수라 단위 테스트로 커버:
- 최고 점수 후보가 대표로 선택되는지
- 최근 대표는 건너뛰고 다음 후보가 선택되는지
- 모든 후보가 최근 대표면 폴백되는지
- 본문 개수 표기(`외 N개` / 생략)
- 제목 없음 → host 폴백 / 길이 트림
- 후보 0개 → null
