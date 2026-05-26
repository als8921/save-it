# PWA 푸시 알림 (일일 다이제스트) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** save-it 사용자가 매일 정해진 시각에 "오늘 다시 볼 링크 N개"
푸시 알림을 받을 수 있게 한다. iOS PWA 16.4+(홈 화면 추가) 및
Chrome/Edge 데스크탑·안드로이드 모두 지원.

**Architecture:** `public/sw.js` Service Worker가 push/notificationclick
이벤트 수신. `push_subscriptions` 테이블에 디바이스별 endpoint 저장.
Vercel Cron이 매시 정각 `/api/cron/remind-push` 호출 → 사용자
`daily_time`과 매칭해 발송 → 기존 `pickDailyRemindCandidates` 재활용.
설정 페이지 토글로 권한·구독 ON/OFF, 같은 페이지의 테스트 버튼으로
즉시 검증.

**Tech Stack:** Next.js 16 App Router / React 19 / TypeScript /
`@supabase/ssr` / `web-push` (신규) / Service Worker / Vercel Cron.

**관련 스펙:** `docs/superpowers/specs/2026-05-26-push-notifications-design.md`

---

## File Structure

| 파일 | 책임 | 상태 |
|------|------|------|
| `web/package.json` + lockfile | `web-push` + `@types/web-push` | 수정 |
| `web/.env.example` | 신규 env 5종 안내 | 신규 |
| `web/supabase/migrations/<ts>_push_subscriptions.sql` | 테이블 + RLS | 신규 |
| `web/src/lib/supabase/service.ts` | `createServiceClient()` — SUPABASE_SERVICE_ROLE_KEY 기반 | 신규 |
| `web/src/lib/remind/picker.ts` | 옵셔널 `supabase` 인자 추가 (backward compat) | 수정 |
| `web/src/lib/push/key.ts` | URL-safe Base64 → Uint8Array 헬퍼 (pure, 테스트) | 신규 |
| `web/src/lib/push/key.test.ts` | 위 헬퍼 단위 테스트 | 신규 |
| `web/public/sw.js` | Service Worker: push + notificationclick | 신규 |
| `web/src/lib/push/client.ts` | 브라우저 측 subscribe/unsubscribe (use client에서 import) | 신규 |
| `web/src/lib/push/vapid.ts` | 서버 측 web-push 초기화 | 신규 |
| `web/src/lib/push/send.ts` | server-only sendToSubscription (410/404 정리) | 신규 |
| `web/src/app/api/push/subscribe/route.ts` | POST + DELETE | 신규 |
| `web/src/app/api/push/test/route.ts` | POST — 자기 디바이스에 즉시 발송 | 신규 |
| `web/src/app/api/cron/remind-push/route.ts` | GET — Bearer 인증 후 발송 루프 | 신규 |
| `web/vercel.json` | cron 등록 | 신규 |
| `web/src/components/settings/push-toggle.tsx` | 토글 + 테스트 버튼 | 신규 |
| `web/src/app/(main)/settings/page.tsx` | 위 컴포넌트 마운트 | 수정 |

---

### Task 1: 의존성 + env 가이드

이 task는 코드 + 사용자 수동 작업(VAPID 키 생성 + Vercel env 등록)을
함께 다룬다.

**Files:**
- Modify: `web/package.json`
- Create: `web/.env.example`

- [ ] **Step 1: 의존성 설치**

Run (from `web/`):
```bash
npm install --save web-push
npm install --save-dev @types/web-push
```

Expected: `package.json` `dependencies`에 `web-push`, `devDependencies`에
`@types/web-push` 추가.

- [ ] **Step 2: VAPID 키 한 번만 생성**

Run (from `web/`):
```bash
npx web-push generate-vapid-keys
```

출력 예시:
```
=======================================
Public Key:
BLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

Private Key:
yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
=======================================
```

두 키를 메모. **commit하지 않는다.**

- [ ] **Step 3: `web/.env.example` 작성**

Create `web/.env.example`:
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Web Push (npx web-push generate-vapid-keys로 생성)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:owner@example.com

# Vercel Cron
CRON_SECRET=
```

- [ ] **Step 4: 로컬 `.env.local`에 실제 값 채워 넣기 (commit X)**

`web/.env.local` 에 위 키들을 실제 값으로 추가:
- VAPID 키 2종은 Step 2 출력에서
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase 대시보드 → Project Settings → API
  → service_role secret 복사
- `CRON_SECRET`: `openssl rand -hex 32` 또는 임의 32자 이상

- [ ] **Step 5: Vercel 환경변수 등록 (브라우저)**

Vercel 대시보드 → 프로젝트 → Settings → Environment Variables에서 위
5개 추가 (Production / Preview / Development 모두).

`SUPABASE_SERVICE_ROLE_KEY`와 `VAPID_PRIVATE_KEY`, `CRON_SECRET`은
Sensitive로 표시.

- [ ] **Step 6: Commit (코드 변경분만)**

```bash
git add web/package.json web/package-lock.json web/.env.example
git commit -m "chore(web): add web-push deps and env example"
```

`.env.local`은 `.gitignore`에 이미 포함돼 있어야 함. 만약 빠져 있다면
`echo ".env.local" >> web/.gitignore` 후 함께 commit.

---

### Task 2: createServiceClient 헬퍼 + picker 시그니처 확장

`pickDailyRemindCandidates`는 현재 cookie 기반 `createClient`만 부를 수
있어서 cron에서 호출 불가. 옵셔널 supabase 인자를 받도록 확장하고,
service role client를 만드는 헬퍼를 추가한다.

**Files:**
- Create: `web/src/lib/supabase/service.ts`
- Modify: `web/src/lib/remind/picker.ts`

- [ ] **Step 1: service client 헬퍼 작성**

Create `web/src/lib/supabase/service.ts`:
```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}
```

- [ ] **Step 2: picker.ts 인자 확장**

Edit `web/src/lib/remind/picker.ts`. 함수 시그니처와 첫 줄을 변경:

기존:
```ts
export async function pickDailyRemindCandidates(
  userId: string
): Promise<RemindCandidate[]> {
  const supabase = await createClient();
  ...
}
```

변경 후:
```ts
export async function pickDailyRemindCandidates(
  userId: string,
  supabaseOverride?: Supabase
): Promise<RemindCandidate[]> {
  const supabase = supabaseOverride ?? (await createClient());
  ...
}
```

`Supabase` 타입은 picker.ts 안에서 이미 `type Supabase = Awaited<ReturnType<typeof createClient>>`로 정의되어 있다. 변경 후에도 그대로 호환.

- [ ] **Step 3: tsc/lint 확인**

Run (from `web/`):
```bash
npx tsc --noEmit && npm run lint
```

Expected: clean. (기존 호출자인 `/api/reminders/today/route.ts`는 인자를
하나만 넘기므로 옵셔널 인자가 들어와도 영향 없음.)

- [ ] **Step 4: 기존 단위 테스트 회귀**

Run (from `web/`):
```bash
npm test
```

Expected: 7/7 통과 (scoring.test.ts는 picker를 안 import하므로 영향 없음
— 확인용).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/supabase/service.ts web/src/lib/remind/picker.ts
git commit -m "feat(supabase): add service client + picker supabase override"
```

---

### Task 3: push_subscriptions 마이그레이션 + MCP 적용

**Files:**
- Create: `web/supabase/migrations/<ts>_push_subscriptions.sql`

- [ ] **Step 1: 타임스탬프 결정**

Run:
```bash
date -u +"%Y%m%d%H%M%S"
```

출력 값(예: `20260526060000`)을 파일명에 사용.

- [ ] **Step 2: 마이그레이션 SQL 작성**

Create `web/supabase/migrations/<timestamp>_push_subscriptions.sql`:
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

alter table push_subscriptions enable row level security;

create policy "Users can view own subscriptions" on push_subscriptions
  for select using (auth.uid() = user_id);

create policy "Users can insert own subscriptions" on push_subscriptions
  for insert with check (auth.uid() = user_id);

create policy "Users can delete own subscriptions" on push_subscriptions
  for delete using (auth.uid() = user_id);
```

- [ ] **Step 3: MCP로 원격 적용**

`mcp__supabase__apply_migration` 호출:
- name: `push_subscriptions`
- query: 위 SQL 전체

- [ ] **Step 4: 적용 확인**

`mcp__supabase__execute_sql`:
```sql
select column_name, data_type
from information_schema.columns
where table_name = 'push_subscriptions'
order by ordinal_position;
```

Expected: 7개 컬럼 (id, user_id, endpoint, p256dh, auth, created_at, last_success_at).

- [ ] **Step 5: Commit**

```bash
git add web/supabase/migrations/<timestamp>_push_subscriptions.sql
git commit -m "feat(db): add push_subscriptions table with RLS"
```

---

### Task 4: URL-safe Base64 → Uint8Array 헬퍼 (TDD)

브라우저의 `pushManager.subscribe`는 `applicationServerKey`로
`Uint8Array`를 요구한다. VAPID 공개키(URL-safe Base64 문자열)를 변환할
순수 함수가 필요.

**Files:**
- Create: `web/src/lib/push/key.test.ts`
- Create: `web/src/lib/push/key.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `web/src/lib/push/key.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { urlBase64ToUint8Array } from "./key";

describe("urlBase64ToUint8Array", () => {
  it("decodes a standard URL-safe base64 string", () => {
    // "hello" base64url = "aGVsbG8"
    const result = urlBase64ToUint8Array("aGVsbG8");
    expect(Array.from(result)).toEqual([104, 101, 108, 108, 111]);
  });

  it("handles dash and underscore (URL-safe charset)", () => {
    // url-safe: "-" and "_" map to "+" and "/" in standard base64
    // "a~b" base64url ≈ "YX5i"; let's verify a clean dash/underscore sample
    // bytes [251, 255] => base64 "+/8="  => url-safe "-_8"
    const result = urlBase64ToUint8Array("-_8");
    expect(Array.from(result)).toEqual([251, 255]);
  });

  it("pads missing '=' characters", () => {
    // "hi" base64 = "aGk="; without padding "aGk"
    const result = urlBase64ToUint8Array("aGk");
    expect(Array.from(result)).toEqual([104, 105]);
  });

  it("returns a Uint8Array (not a regular array)", () => {
    const result = urlBase64ToUint8Array("aGVsbG8");
    expect(result).toBeInstanceOf(Uint8Array);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run (from `web/`):
```bash
npm test -- key
```

Expected: `Cannot find module './key'` 또는 import 오류로 모든 테스트 실패.

- [ ] **Step 3: 구현 작성**

Create `web/src/lib/push/key.ts`:
```ts
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run (from `web/`):
```bash
npm test
```

Expected: 모든 테스트 통과 (이전 7개 + 새로 4개 = 11개).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/push/key.ts web/src/lib/push/key.test.ts
git commit -m "feat(push): add VAPID key base64url decoder with tests"
```

---

### Task 5: Service Worker 작성

**Files:**
- Create: `web/public/sw.js`

- [ ] **Step 1: Service Worker 작성**

Create `web/public/sw.js`:
```js
/* eslint-disable no-restricted-globals */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = { title: "save-it", body: "", url: "/today" };
  try {
    if (event.data) payload = Object.assign(payload, event.data.json());
  } catch (_) {
    // payload가 JSON이 아니면 기본값 그대로 사용
  }

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
  const targetUrl = (event.notification.data && event.notification.data.url) || "/today";

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientList) => {
      const existing = clientList.find((c) => c.url.includes(targetUrl));
      if (existing) return existing.focus();
      return self.clients.openWindow(targetUrl);
    })
  );
});
```

- [ ] **Step 2: 정적 서빙 경로 확인**

`web/public/sw.js`는 `http://localhost:3000/sw.js`로 자동 서빙됨. 별도
설정 불필요.

- [ ] **Step 3: Commit**

```bash
git add web/public/sw.js
git commit -m "feat(push): add service worker for push + notificationclick"
```

---

### Task 6: 클라이언트 push subscription 헬퍼

**Files:**
- Create: `web/src/lib/push/client.ts`

- [ ] **Step 1: 클라이언트 헬퍼 작성**

Create `web/src/lib/push/client.ts`:
```ts
import { urlBase64ToUint8Array } from "./key";

export type SubscribeResult =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "permission_denied" | "subscribe_failed" | "post_failed" };

function getVapidPublicKey(): string | null {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return null;
  return key;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function getPermissionState(): Promise<NotificationPermission> {
  if (!isPushSupported()) return "default";
  return Notification.permission;
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  // SW 미등록(첫 방문) 상태에선 ready가 영원히 pending이므로 getRegistration 사용.
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

export async function subscribePush(): Promise<SubscribeResult> {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };

  const vapid = getVapidPublicKey();
  if (!vapid) return { ok: false, reason: "subscribe_failed" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, reason: "permission_denied" };
  }

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  let subscription: PushSubscription;
  try {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid),
    });
  } catch (_) {
    return { ok: false, reason: "subscribe_failed" };
  }

  const json = subscription.toJSON();
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
    }),
  });

  if (!res.ok) {
    return { ok: false, reason: "post_failed" };
  }
  return { ok: true };
}

export async function unsubscribePush(): Promise<{ ok: boolean }> {
  if (!isPushSupported()) return { ok: true };

  const existing = await getExistingSubscription();
  if (!existing) return { ok: true };

  const endpoint = existing.endpoint;
  await existing.unsubscribe();

  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  }).catch(() => {});

  return { ok: true };
}
```

- [ ] **Step 2: tsc/lint 확인**

Run (from `web/`):
```bash
npx tsc --noEmit && npm run lint
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/push/client.ts
git commit -m "feat(push): add client-side subscribe/unsubscribe helpers"
```

---

### Task 7: 서버 push 유틸 (vapid + send)

**Files:**
- Create: `web/src/lib/push/vapid.ts`
- Create: `web/src/lib/push/send.ts`

- [ ] **Step 1: vapid 초기화 모듈**

Create `web/src/lib/push/vapid.ts`:
```ts
import "server-only";
import webpush from "web-push";

let configured = false;

export function getWebPush() {
  if (!configured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );
    configured = true;
  }
  return webpush;
}
```

- [ ] **Step 2: send 헬퍼**

Create `web/src/lib/push/send.ts`:
```ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getWebPush } from "./vapid";

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

export interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface SendOutcome {
  delivered: boolean;
  removed: boolean;
}

export async function sendToSubscription(
  supabase: SupabaseClient,
  row: SubscriptionRow,
  payload: PushPayload
): Promise<SendOutcome> {
  const webpush = getWebPush();

  try {
    await webpush.sendNotification(
      {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      },
      JSON.stringify(payload)
    );
    await supabase
      .from("push_subscriptions")
      .update({ last_success_at: new Date().toISOString() })
      .eq("id", row.id);
    return { delivered: true, removed: false };
  } catch (err) {
    const statusCode =
      typeof err === "object" && err !== null && "statusCode" in err
        ? (err as { statusCode?: number }).statusCode
        : undefined;

    if (statusCode === 404 || statusCode === 410) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("id", row.id);
      return { delivered: false, removed: true };
    }

    console.error("[push] sendNotification failed:", err);
    return { delivered: false, removed: false };
  }
}
```

- [ ] **Step 3: tsc/lint 확인**

Run (from `web/`):
```bash
npx tsc --noEmit && npm run lint
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/push/vapid.ts web/src/lib/push/send.ts
git commit -m "feat(push): add web-push init and send-to-subscription helper"
```

---

### Task 8: `/api/push/subscribe` (POST + DELETE)

**Files:**
- Create: `web/src/app/api/push/subscribe/route.ts`

- [ ] **Step 1: route 작성**

Create `web/src/app/api/push/subscribe/route.ts`:
```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface SubscribeBody {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as SubscribeBody | null;
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;

  if (
    typeof endpoint !== "string" ||
    endpoint.length === 0 ||
    typeof p256dh !== "string" ||
    typeof auth !== "string"
  ) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      { user_id: user.id, endpoint, p256dh, auth },
      { onConflict: "user_id,endpoint", ignoreDuplicates: false }
    );

  if (error) {
    console.error("[push] subscribe failed:", error.message);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const body = (await req.json().catch(() => null)) as { endpoint?: unknown } | null;
  const endpoint = body?.endpoint;

  if (typeof endpoint !== "string" || endpoint.length === 0) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: tsc/lint 확인**

Run (from `web/`):
```bash
npx tsc --noEmit && npm run lint
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add web/src/app/api/push/subscribe/route.ts
git commit -m "feat(api): add POST/DELETE /api/push/subscribe"
```

---

### Task 9: `/api/push/test`

**Files:**
- Create: `web/src/app/api/push/test/route.ts`

- [ ] **Step 1: route 작성**

Create `web/src/app/api/push/test/route.ts`:
```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendToSubscription } from "@/lib/push/send";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", user.id);

  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0, removed: 0 });
  }

  let sent = 0;
  let removed = 0;
  for (const row of subs) {
    const outcome = await sendToSubscription(supabase, row, {
      title: "save-it 테스트",
      body: "알림이 잘 도착하나요?",
      url: "/today",
    });
    if (outcome.delivered) sent++;
    if (outcome.removed) removed++;
  }

  return NextResponse.json({ sent, removed });
}
```

- [ ] **Step 2: tsc/lint 확인**

Run (from `web/`):
```bash
npx tsc --noEmit && npm run lint
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add web/src/app/api/push/test/route.ts
git commit -m "feat(api): add POST /api/push/test for manual verification"
```

---

### Task 10: `/api/cron/remind-push` + `vercel.json`

**Files:**
- Create: `web/src/app/api/cron/remind-push/route.ts`
- Create: `web/vercel.json`

- [ ] **Step 1: vercel.json 작성**

Create `web/vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/remind-push", "schedule": "0 * * * *" }
  ]
}
```

- [ ] **Step 2: cron route 작성**

Create `web/src/app/api/cron/remind-push/route.ts`:
```ts
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { pickDailyRemindCandidates } from "@/lib/remind/picker";
import { sendToSubscription } from "@/lib/push/send";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // 현재 UTC time 기준 ±30분 윈도우 안의 daily_time을 가진 사용자 select.
  // wraparound (자정 근처) 보정은 v1.5 — 받아들임.
  const nowUtcTime = new Date().toISOString().slice(11, 19); // HH:MM:SS

  const { data: prefs } = await supabase
    .from("user_reminder_prefs")
    .select("user_id, daily_time")
    .eq("daily_enabled", true);

  const userIds: string[] = [];
  for (const row of prefs ?? []) {
    const diffSec = Math.abs(
      timeStringToSeconds(row.daily_time as string) -
        timeStringToSeconds(nowUtcTime)
    );
    if (diffSec <= 1800) userIds.push(row.user_id as string);
  }

  let sent = 0;
  let skipped = 0;
  let removed = 0;

  for (const userId of userIds) {
    try {
      const candidates = await pickDailyRemindCandidates(userId, supabase);
      if (candidates.length === 0) {
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

      const payload = {
        title: "오늘 다시 볼 링크",
        body: `${candidates.length}개가 있어요`,
        url: "/today",
      };

      for (const row of subs) {
        const outcome = await sendToSubscription(supabase, row, payload);
        if (outcome.delivered) sent++;
        if (outcome.removed) removed++;
      }
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
```

- [ ] **Step 3: tsc/lint 확인**

Run (from `web/`):
```bash
npx tsc --noEmit && npm run lint
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add web/vercel.json web/src/app/api/cron/remind-push/route.ts
git commit -m "feat(cron): hourly remind-push that uses daily_time matching"
```

---

### Task 11: PushToggle UI + settings 마운트

**Files:**
- Create: `web/src/components/settings/push-toggle.tsx`
- Modify: `web/src/app/(main)/settings/page.tsx`

- [ ] **Step 1: PushToggle 컴포넌트 작성**

Create `web/src/components/settings/push-toggle.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import {
  isPushSupported,
  getPermissionState,
  getExistingSubscription,
  subscribePush,
  unsubscribePush,
} from "@/lib/push/client";

type State = "loading" | "off" | "on" | "denied" | "unsupported";

export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (!isPushSupported()) {
        setState("unsupported");
        return;
      }
      const perm = await getPermissionState();
      if (perm === "denied") {
        setState("denied");
        return;
      }
      const existing = await getExistingSubscription();
      setState(existing ? "on" : "off");
    })();
  }, []);

  async function handleToggle() {
    if (state === "off") {
      setState("loading");
      const r = await subscribePush();
      if (r.ok) {
        setState("on");
      } else if (r.reason === "permission_denied") {
        setState("denied");
      } else {
        setState("off");
      }
    } else if (state === "on") {
      setState("loading");
      await unsubscribePush();
      setState("off");
    }
  }

  async function handleTest() {
    if (testing) return;
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.sent > 0) {
        setTestMsg("알림을 보냈어요");
      } else {
        setTestMsg("잠시 후 다시 시도해주세요");
      }
    } catch {
      setTestMsg("잠시 후 다시 시도해주세요");
    } finally {
      setTimeout(() => setTesting(false), 5000);
    }
  }

  return (
    <section className="space-y-2">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        알림
      </h2>
      <div className="space-y-2 rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">매일 푸시 알림</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              iOS는 홈 화면에 추가 후에만 알림을 받을 수 있어요.
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggle}
            disabled={state === "loading" || state === "denied" || state === "unsupported"}
            className="shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-40"
          >
            {state === "on" ? "ON" : state === "loading" ? "…" : "OFF"}
          </button>
        </div>

        {state === "denied" && (
          <div className="text-xs text-muted-foreground">
            브라우저 알림 권한이 차단됐어요. 브라우저 설정에서 허용 후 다시 시도하세요.
          </div>
        )}

        {state === "unsupported" && (
          <div className="text-xs text-muted-foreground">
            이 브라우저는 푸시 알림을 지원하지 않습니다.
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleTest}
            disabled={state !== "on" || testing}
            className="rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-40"
          >
            지금 테스트 알림 보내기
          </button>
          {testMsg && (
            <span className="text-xs text-muted-foreground">{testMsg}</span>
          )}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: 설정 페이지에 마운트**

Edit `web/src/app/(main)/settings/page.tsx`. 다음 두 줄 변경:

Import block에 추가:
```ts
import { PushToggle } from "@/components/settings/push-toggle";
```

JSX의 `<div className="space-y-4 p-4">` 안, 기존 `<section>` 다음 위치에:
```tsx
<PushToggle />
```

수정 후 page 본문:
```tsx
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

      <PushToggle />
    </div>
  </>
);
```

- [ ] **Step 3: tsc/lint 확인**

Run (from `web/`):
```bash
npx tsc --noEmit && npm run lint
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/settings/push-toggle.tsx web/src/app/\(main\)/settings/page.tsx
git commit -m "feat(settings): add push toggle and test notification button"
```

---

### Task 12: 수동 End-to-End 검증

코드 변경 없음. dev 서버 + 실제 디바이스 또는 브라우저로 검증.

- [ ] **Step 1: 빌드 확인**

Run (from `web/`):
```bash
npm run build
```

Expected: 성공. Routes 목록에서 다음이 보여야 함:
- `/api/push/subscribe`
- `/api/push/test`
- `/api/cron/remind-push`

- [ ] **Step 2: dev 서버 기동**

Run (from `web/`):
```bash
npm run dev
```

- [ ] **Step 3: 권한 토글 ON (Chrome 또는 Edge 데스크탑)**

브라우저에서 `http://localhost:3000` → 로그인 → 하단 탭바 설정 →
"매일 푸시 알림" OFF 버튼 클릭. 브라우저 알림 권한 prompt → 허용.

Expected: 버튼이 ON으로 바뀜. Supabase SQL Editor에서:
```sql
select id, user_id, endpoint, created_at
from push_subscriptions
where user_id = '<your-uuid>';
```
→ row 1개 생성 확인.

- [ ] **Step 4: 테스트 버튼 검증**

설정 페이지의 "지금 테스트 알림 보내기" 클릭.

Expected:
- 시스템 알림으로 "save-it 테스트 / 알림이 잘 도착하나요?" 노출
- 클릭 시 `/today` 페이지로 이동
- 버튼 옆에 "알림을 보냈어요" 메시지

- [ ] **Step 5: 수동 cron 호출**

별도 터미널에서:
```bash
curl -i -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/remind-push
```
(`$CRON_SECRET`은 `.env.local`에 적은 값과 동일 — 같은 셸에서 export해
사용하거나 명령에 직접 붙여넣기)

Expected: 200 응답. body `{ sent: <N>, skipped: <N>, removed: 0 }`.
실제 daily_time 매칭 사용자가 있으면 sent > 0이고 시스템 알림 노출.

- [ ] **Step 6: 토글 OFF 확인**

설정 페이지에서 ON 버튼 클릭 → OFF.

Expected:
- 버튼 OFF
- `push_subscriptions` row 삭제됨 (위 SQL 다시 실행해 확인)
- 테스트 버튼 disabled

- [ ] **Step 7: 권한 거부 케이스**

다른 브라우저(또는 시크릿창)에서 권한 prompt 단계에서 "차단" 클릭.

Expected: 버튼 disabled + "브라우저 알림 권한이 차단됐어요" 안내.

- [ ] **Step 8: iOS PWA (선택 — iOS 디바이스 있을 때)**

배포된 환경(Vercel)에서:
1. iOS 16.4+ Safari로 접속
2. 공유 → "홈 화면에 추가"
3. 홈 화면 아이콘 탭 → PWA 열림
4. 로그인 → 설정 → 토글 ON → 권한 허용
5. 테스트 버튼 → iOS 알림 센터에 노출 확인

- [ ] **Step 9: 401 검증**

```bash
curl -i http://localhost:3000/api/cron/remind-push
```

Expected: 401 + `{ "error": "unauthorized" }`.

```bash
curl -i -X POST http://localhost:3000/api/push/test
```

Expected: 401 (시크릿창에서 호출 시).

위 단계 모두 통과하면 Task 12 완료.

---

## 작업 후 점검

- 스펙 §11(검증 계획)의 자동 4종은 Task 1~10 안에서 매 task의 tsc/lint
  단계로 흡수.
- 스펙 §11의 수동 항목은 Task 12에서 전부 다룬다.
- 스펙 §10(v1.5/v2 확장 지점)은 의도적으로 본 플랜에서 제외 — picker의
  옵셔널 supabase 인자(Task 2)와 cron route 구조(Task 10)가 그 시점의
  자연스러운 진입점.
