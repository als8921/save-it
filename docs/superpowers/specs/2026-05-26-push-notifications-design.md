# PWA 푸시 알림: 일일 다이제스트 설계

> 작성일: 2026-05-26
> 관련 문서: `docs/REMIND_STRATEGY.md`, `docs/superpowers/specs/2026-05-20-web-pwa-mobile-shell-design.md`, `docs/superpowers/specs/2026-05-26-remind-daily-scoring-design.md`
> 종속: `web/supabase/migrations/00004_reminders.sql` (user_reminder_prefs)

---

## 1. 배경과 목적

이미 동작하는 `/today` 추천 페이지(이전 스펙)에 **Push 채널**을 추가한다.
사용자가 앱을 직접 열지 않아도 매일 정해진 시각에 "오늘 다시 볼 링크가
있어요"를 알려서 재방문을 만든다.

iOS Safari PWA(16.4+)는 홈 화면에 추가 후에만 Web Push를 지원하므로,
설치 안내 UX를 함께 둔다.

### 1.1 스코프 (만드는 것)

- Service Worker (`public/sw.js`) — push 수신 + notificationclick
- VAPID 키 기반 Web Push (`web-push` 라이브러리)
- `push_subscriptions` 테이블 (디바이스별 endpoint)
- API: `POST /api/push/subscribe`, `DELETE /api/push/subscribe`,
  `GET /api/cron/remind-push`, `POST /api/push/test`
- 설정 페이지의 알림 토글 + **"지금 테스트 알림 보내기" 버튼**
- Vercel Cron: hourly로 돌며 사용자 daily_time과 매칭해 발송

### 1.2 스코프 외 (의도적 제외)

- 알림 콘텐츠 다양화 (단일 1줄 요약만)
- 사용자별 timezone 정확 매칭 (v1.5에서 도입)
- 이벤트 기반 트리거 (새 링크 N일 뒤 등)
- iOS 외 다른 플랫폼별 fine-tuning
- 알림 클릭 외 다른 액션 (action buttons)
- A/B 실험, CTR 자동 튜닝
- 발송 결과 KPI 집계 (push_sent_at 같은 새 컬럼은 추가하지 않음 — 추후)

---

## 2. 아키텍처

```
┌──────────────────────── 브라우저 ────────────────────────┐
│                                                          │
│  /settings — PushToggle                                  │
│   └─ ON: Notification.requestPermission()                │
│         → navigator.serviceWorker.register('/sw.js')     │
│         → reg.pushManager.subscribe(VAPID)               │
│         → POST /api/push/subscribe { endpoint, keys }    │
│   └─ OFF: pushManager.unsubscribe()                      │
│         → DELETE /api/push/subscribe { endpoint }        │
│                                                          │
│  Service Worker (/sw.js)                                 │
│   ├─ push event   → showNotification(title, body, url)   │
│   └─ notificationclick → clients.openWindow(url)         │
│                                                          │
└──────────────────────────────────────────────────────────┘
                          ↑
                          │ Web Push Protocol
                          │
┌─────────────────────── 백엔드 ───────────────────────────┐
│                                                          │
│  POST /api/push/subscribe  — RLS, push_subscriptions     │
│       insert (user_id, endpoint, p256dh, auth)           │
│                                                          │
│  DELETE /api/push/subscribe — endpoint 기준 본인 row 삭제│
│                                                          │
│  GET /api/cron/remind-push                               │
│   ├─ Bearer 검증 (CRON_SECRET)                            │
│   ├─ 현재 UTC 시각과 daily_time 매칭(±30분) 유저 SELECT  │
│   ├─ 각 유저:                                            │
│   │   ├─ pickDailyRemindCandidates(userId) — 재활용      │
│   │   ├─ 후보 0개 → skip                                 │
│   │   ├─ 후보 N개 → web-push.sendNotification(...)       │
│   │   ├─ 응답 410/404 → push_subscriptions row 삭제      │
│   │   └─ 응답 2xx   → last_success_at 갱신               │
│   └─ 응답: { sent: <count> }                             │
│                                                          │
└──────────────────────────────────────────────────────────┘
                          ↑
                          │ schedule: "0 * * * *"
                          │
                  ┌─── Vercel Cron ───┐
                  │  vercel.json       │
                  └────────────────────┘
```

---

## 3. 데이터 모델

### 3.1 신규 테이블: `push_subscriptions`

```sql
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  last_success_at timestamptz,
  unique (user_id, endpoint)
);

create index idx_push_subscriptions_user on push_subscriptions(user_id);
```

`endpoint`는 push service 측 URL(Apple/Google). `p256dh`/`auth`는 payload
암호화에 쓰이는 클라이언트 키. 디바이스가 바뀌면 endpoint도 바뀜.

### 3.2 RLS

```sql
alter table push_subscriptions enable row level security;

create policy "Users can view own subscriptions" on push_subscriptions
  for select using (auth.uid() = user_id);
create policy "Users can insert own subscriptions" on push_subscriptions
  for insert with check (auth.uid() = user_id);
create policy "Users can delete own subscriptions" on push_subscriptions
  for delete using (auth.uid() = user_id);
```

UPDATE 정책은 두지 않는다 — `last_success_at` 갱신은 service role(cron)
에서만 수행. 클라이언트가 임의로 갱신할 일이 없음.

### 3.3 기존 테이블 확장 없음

`link_reminders`에 push_sent_at 같은 컬럼은 v1 범위에서 추가하지 않는다.
KPI 집계가 필요해지면 v1.5에서 도입.

---

## 4. API 명세

### 4.1 `POST /api/push/subscribe`

- 인증: 쿠키 세션 (`auth.getUser()`).
- Body: `{ endpoint: string, keys: { p256dh: string, auth: string } }`
- 동작: 같은 user_id + endpoint가 이미 있으면 무시(`onConflict do nothing`),
  없으면 insert.
- 응답: `200 { ok: true }` / `401 { error: "unauthorized" }` / `400 { error: "bad_request" }`

### 4.2 `DELETE /api/push/subscribe`

- 인증: 쿠키 세션.
- Body: `{ endpoint: string }`
- 동작: 본인 user_id + endpoint row 삭제. row가 없어도 200.
- 응답: `200 { ok: true }` / `401` / `400`

### 4.3 `GET /api/cron/remind-push`

- 인증: `Authorization: Bearer $CRON_SECRET` 헤더. 일치하지 않으면 401.
- 동작: §6.2 발송 루프 실행.
- 응답: `200 { sent: <number>, skipped: <number>, removed: <number> }`

### 4.4 `POST /api/push/test` (개발/수동 검증용)

- 인증: 쿠키 세션 (`auth.getUser()`). 미인증이면 401.
- Body: 없음.
- 동작:
  1. 호출자의 `push_subscriptions` 모든 row select
  2. 각 row에 고정 payload로 web-push 발송
     `{ title: "save-it 테스트", body: "알림이 잘 도착하나요?", url: "/today" }`
  3. 410/404 응답 → row 삭제 (cron과 동일)
- 응답: `200 { sent: <number>, removed: <number> }` / `401`
- Cron이 doli수 없는 시각이거나, 후보가 0개여서 일일 다이제스트가 skip
  되는 상황에서도 SW/VAPID/subscription 흐름을 즉시 검증할 수 있다.
- Rate limit: 서버 측에서 두지 않는다. UI 측 throttle(클릭 후 5초간
  disable)만 둠. 악용 가능성이 낮고(본인 디바이스로만 발송) MVP에선
  과잉 설계.

### 4.4 Vercel Cron 설정 (`web/vercel.json`)

```json
{
  "crons": [
    { "path": "/api/cron/remind-push", "schedule": "0 * * * *" }
  ]
}
```

---

## 5. Service Worker

위치: `web/public/sw.js`. Next.js의 `public/` 는 그대로 정적 서빙되므로
별도 빌드 설정 불필요.

```js
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = { title: "save-it", body: "", url: "/today" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch (_) {}

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: payload.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/today";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(url));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});
```

iOS 제약 대응:
- `silent: true` 사용하지 않음 — iOS는 silent push 불가
- 항상 `showNotification` 호출 — payload 누락 시에도 fallback 텍스트

---

## 6. 발송 로직

### 6.1 모듈 구조

```
web/src/lib/push/
  ├ vapid.ts        # env에서 VAPID 키 로드, web-push.setVapidDetails(...)
  ├ subscribe.ts    # subscribe/unsubscribe DB 헬퍼 (RLS 인지)
  └ send.ts         # web-push.sendNotification 래퍼, 410/404 시 row 삭제
```

`web/src/app/api/cron/remind-push/route.ts` 는 위 3개 모듈을 조합한다.

### 6.2 Cron 발송 루프

```
1. 인증: Authorization Bearer $CRON_SECRET. 불일치 → 401.

2. 매칭 유저 SELECT (service role client 사용 — RLS 우회):
   SELECT user_id FROM user_reminder_prefs
   WHERE daily_enabled = true
     AND ABS(EXTRACT(EPOCH FROM (daily_time - <current UTC time>::time))) <= 1800

   현재는 timezone 정밀 매칭 X — 사용자 디바이스 timezone과 무관하게 UTC
   기준 ±30분. user_reminder_prefs.timezone 컬럼은 존재하나 v1에서는 무시.

   주의 — 시각 wraparound: daily_time이 00:30이고 현재 UTC가 23:59면 위
   abs 차이가 1410초가 아니라 86940초로 계산된다. v1은 받아들임 (자정
   근처에 daily_time을 설정한 사용자는 첫 cron 사이클에서 발송 누락
   가능). v1.5에서 `LEAST(abs(diff), 86400 - abs(diff))` 로 보정.

3. 각 user_id에 대해:
   a. pickDailyRemindCandidates(userId) 호출
      — 이 함수는 RLS 컨텍스트에서 만든 거라 service role로 호출하려면
      userId 인자만 받아도 RLS bypass됨. 이미 그렇게 만들어져 있음.
   b. 후보 길이 == 0 → skipped++ → continue
   c. push_subscriptions에서 그 user의 모든 row select
   d. 각 row에 대해:
      payload = { title: "오늘 다시 볼 링크", body: `${N}개가 있어요`, url: "/today" }
      try web-push.sendNotification(subscription, JSON.stringify(payload))
        - 응답 2xx → last_success_at = now() 업데이트
        - 응답 410 / 404 → push_subscriptions에서 row 삭제 → removed++
        - 그 외 에러 → console.error, 그러나 row 보존
      sent++

4. 응답 { sent, skipped, removed }
```

### 6.3 채널 인자 — picker는 그대로

`pickDailyRemindCandidates`는 현재 `channel='dashboard'`로 link_reminders
insert를 하는데, push 발송 시점에도 이 함수를 그대로 호출한다. 즉
대시보드 노출과 push 알림이 같은 묶음 데이터를 공유.

이는 합리적인 단순화이다 — 사용자가 푸시를 받고 /today 페이지를 열면,
같은 묶음이 보임. 4시간 TTL 안에서 동일.

다른 채널 분리 집계가 필요해지면 picker에 `channel` 인자를 승격하면 됨
(이전 스펙 §8에 명시된 v1 확장).

---

## 7. 권한 UX

### 7.1 설정 페이지 토글 (`/settings`)

```
┌────────────────────────────────────────┐
│  알림                                  │
│                                        │
│  매일 09:00 푸시 알림      [ OFF ▢▣ ]│
│                                        │
│  iOS는 홈 화면에 추가 후에만           │
│  알림을 받을 수 있어요.                │
│                                        │
│  [  지금 테스트 알림 보내기  ]         │
│  (토글이 ON일 때만 활성)               │
└────────────────────────────────────────┘
```

테스트 버튼:
- 토글이 ON이고 권한이 'granted'일 때만 활성
- 클릭 시 `POST /api/push/test` → 자기 디바이스로 즉시 알림
- 클릭 직후 5초간 비활성 (중복 클릭 방지)
- 결과 toast (성공: "알림을 보냈어요" / 실패: "잠시 후 다시 시도")

- 토글 ON 클릭 (user gesture 안):
  1. `Notification.requestPermission()` → granted 확인
  2. `navigator.serviceWorker.register('/sw.js')`
  3. `applicationServerKey`로 `NEXT_PUBLIC_VAPID_PUBLIC_KEY`를 base64url
     → `Uint8Array` 변환해 전달. 변환 헬퍼는 `web/src/lib/push/`에 둠.
  4. `reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`
  5. `POST /api/push/subscribe`
  6. UI 상태 ON

- 토글 OFF:
  1. 기존 subscription 가져와서 `subscription.unsubscribe()`
  2. `DELETE /api/push/subscribe`
  3. UI 상태 OFF

- 권한이 이미 denied인 경우 토글은 비활성화 + 안내 "브라우저 설정에서 허용 후 다시 시도".

### 7.2 토글 컴포넌트 위치

`web/src/components/settings/push-toggle.tsx` (client component).
`/settings/page.tsx` 의 적당한 위치에 import해서 마운트.

---

## 8. 의존성 / 환경

### 8.1 신규 의존성

```
npm install web-push
```

`@types/web-push` 가 필요하면 함께 — TypeScript 사용 중이므로 추가.

### 8.2 환경 변수 (Vercel + .env.local)

| 변수 | 용도 | 노출 |
|------|------|------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | 클라가 `pushManager.subscribe`에 사용 | 공개 |
| `VAPID_PRIVATE_KEY` | 서버에서 push 서명 | 서버 전용 |
| `VAPID_SUBJECT` | `mailto:owner@example.com` | 서버 전용 |
| `CRON_SECRET` | `/api/cron/remind-push` Bearer 검증 | 서버 전용 |
| `SUPABASE_SERVICE_ROLE_KEY` | cron에서 RLS 우회 select에 사용 | 서버 전용 |

VAPID 키 생성:
```bash
npx web-push generate-vapid-keys
```

키 한 번 생성해서 Vercel env에 등록.

---

## 9. 엣지 케이스

| 상황 | 처리 |
|------|------|
| 토글 ON 후 권한 거부 | requestPermission 결과 != 'granted' → 토글 ON 실패, UI 그대로. DB row 없음. |
| 권한 'denied' (영구 차단) | 토글 disabled, 안내 메시지 표시 |
| Service Worker 등록 실패 | 토글 ON 실패, 에러 toast |
| 같은 디바이스에서 토글 OFF→ON 반복 | endpoint 같으면 `unique (user_id, endpoint)` + `onConflict do nothing` → 중복 row 생기지 않음 |
| 같은 사용자 다중 디바이스 | endpoint별 row → cron이 모든 row에 발송 |
| endpoint 만료 (410 Gone / 404) | send.ts가 자동으로 row 삭제 |
| 다른 에러 (5xx 등) | row 보존, console.error 로그. 다음 cron tick에 재시도. |
| iOS, PWA 설치 안 한 상태 | 토글 ON 시도 시 `requestPermission`이 'denied'/'default' 반환 — 안내 |
| 사용자 timezone vs UTC daily_time | v1은 UTC 기준 ±30분 매칭. 사용자가 일부러 daily_time을 UTC로 입력하지 않으면 시간이 안 맞을 수 있음 — v1.5에서 timezone 정밀 매칭 도입 |
| Cron 중복 호출 (Vercel 재시도 등) | 한 시간에 두 번 도는 케이스. ±30분 매칭이므로 같은 cron 시각에 두 번 발송될 수 있음. v1에선 받아들임 (드물고 무해). |
| 후보 0개 | push 안 보냄, skipped++ |
| picker 내부 에러 | 그 user만 try/catch로 격리, 다른 user에 계속 |

---

## 10. v1.5 → v2 확장 지점

| 항목 | 추가될 위치 |
|------|-------------|
| timezone 정밀 매칭 | `/api/cron/remind-push` 쿼리에 `timezone`을 합산해서 매칭 |
| iOS 설치 가이드 UI | 설정 페이지 또는 /today 상단 onboarding 카드 |
| push CTR 집계 | `link_reminders` 에 `channel='push'` row 추가하는 방향 (picker에 channel 인자 승격) 또는 별도 `push_events` 테이블 |
| 다양한 알림 콘텐츠 | send.ts payload 빌더 모듈화 |
| Action buttons | sw.js의 showNotification options 확장 |

---

## 11. 검증 계획

구현 후 확인 항목.

### 자동
- TypeScript clean, lint clean, build 성공
- `/api/cron/remind-push` 단위 테스트 (mock supabase + mock web-push)
  - Bearer 없음 → 401
  - 매칭 유저 0명 → `{ sent: 0, skipped: 0, removed: 0 }`
  - 후보 0개 유저 → skip
  - 410 응답 → row 삭제

### 수동 (Android Chrome 또는 PC Chrome 우선)
- 설정 토글 ON → 권한 prompt → 허용 → DB row 생성 확인
- **"지금 테스트 알림 보내기" 버튼 클릭** → 즉시 알림 노출 확인
- 수동 cron 호출: `curl -H "Authorization: Bearer $CRON_SECRET" .../api/cron/remind-push`
- 시스템 알림 노출 확인
- 알림 클릭 → /today 페이지로 이동
- 설정 토글 OFF → DB row 삭제 확인 + 테스트 버튼 비활성
- 권한 거부 케이스 — disabled UI 확인

### iOS (별도)
- iOS 16.4+ Safari로 사이트 열기
- "공유 → 홈 화면에 추가"로 PWA 설치
- 설치된 PWA 열고 → /settings 토글 ON → 권한 허용
- 수동 cron 호출 → iOS 알림 센터에 노출 확인
- 알림 탭 → PWA 다시 열림 + /today 진입

---

## 12. 미해결 / 후속 결정

- **timezone 처리** — UTC 매칭이 한국 사용자에게 어떻게 보일지. daily_time
  필드의 의미(로컬 시각 vs UTC)를 명확히 해야 함. 현재 default `'09:00'`이
  로컬 의미라면 즉시 v1.5 작업 필요.
- **알림 클릭 KPI** — `notificationclick`에서 별도 추적이 필요한지. 지금은
  /today 진입 → 카드 클릭 흐름으로 기존 link_reminders.open_count로 흡수.
  push로 들어온 세션을 구분하려면 URL에 `?from=push` 같은 마커 필요.
- **iOS 설치 안내 UX 강화** — 토글 옆 한 줄 안내가 충분한가, 별도
  가이드 시트가 필요한가.
