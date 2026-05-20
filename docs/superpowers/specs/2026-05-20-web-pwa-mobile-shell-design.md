# Web PWA 모바일 셸 디자인

> save-it 웹앱(`web/`)을 모바일 우선 PWA로 재작성하기 위한 설계 문서.
> 익스텐션과의 디자인 통일은 별도 작업으로 큐잉(이 스펙 범위 밖).

## 1. 배경과 목적

기존 `web/`는 데스크탑 사이드바(`w-64`) 기반의 일반 SaaS 레이아웃이지만,
사용자가 실제로 쓰는 맥락은 **모바일에서 저장한 링크를 다시 보는 것**이다.
이를 위해 (main) 라우트 그룹을 모바일 우선 PWA로 재작성한다.

**참고**: 리마인드 발송(이메일/푸시)은 v2 작업. 본 스펙은 "오늘 리마인드" 탭을
제외한 3탭 구조까지를 다룬다.

## 2. 확정된 의사 결정

| 항목 | 결정 |
|------|------|
| 타겟 폼팩터 | 모바일 우선 PWA (데스크탑은 반응형 부가) |
| 메인 내비 | 하단 탭바 3개 — 라이브러리 / 검색 / 설정 |
| 디자인 톤 | 모던 SaaS (둥근 카드, 컬러 P/A/R/A 배지, Notion 톤) |
| 익스텐션과 관계 | 웹 스타일로 통일 (익스텐션 재디자인은 별도 후속 작업) |
| v1 범위 | 3탭만 — "오늘 리마인드" 탭은 v2 |
| PWA 깊이 | 설치 가능까지 — manifest + 아이콘 + 테마 컬러. 서비스워커 없음 |
| 라이브러리 홈 | PARA 4카드 그리드 + 미지정 와이드 카드 → 드릴다운 |
| 구현 접근 | (main) 인플레이스 재작성. (auth)는 그대로 유지 |
| 테스트 | v1에선 자동 테스트 없음. 수동 검증 체크리스트로 대체 |

## 3. 정보 구조 & 라우트

```
web/src/app/
├── (auth)/                          유지: login, signup, callback
├── (main)/
│   ├── layout.tsx                   재작성: 모바일 셸(헤더 슬롯 + 하단 탭바)
│   ├── page.tsx                     라이브러리 홈: PARA 4카드 그리드 + 미지정
│   ├── category/[para]/page.tsx     카테고리 → 폴더 목록
│   ├── folder/[id]/page.tsx         폴더 → 링크 목록
│   ├── search/page.tsx              검색 탭
│   ├── settings/page.tsx            설정 탭
│   ├── error.tsx                    공통 폴백
│   ├── not-found.tsx                잘못된 라우트
│   └── loading.tsx                  RSC 로딩 스켈레톤
├── layout.tsx                       루트: viewport, theme-color
└── manifest.ts                      PWA manifest 동적 생성
```

**드릴 흐름**
```
라이브러리(홈)
  └─ "Projects" 카드 탭 → /category/project
       └─ "제품 출시 기획" 폴더 탭 → /folder/<uuid>
            └─ 링크 카드 탭 → 외부 url 새 탭 (+ 백그라운드 읽음 처리)
```

**탭 활성 매칭**
- 라이브러리: `/`, `/category/*`, `/folder/*` 전부 활성
- 검색: `/search`
- 설정: `/settings`

**미지정 폴더 처리**: 라이브러리 홈 PARA 4카드 아래에 가로 와이드 카드 1개.
탭 시 `/category/unassigned`. 라우트 파라미터에서 `unassigned`는
`para_category is null`로 매핑.

**기존 코드 처리**
- 유지: `(auth)/*`, `lib/supabase/*`, `lib/types.ts`, `components/ui/*` (shadcn 기존)
- 폐기: `components/sidebar.tsx`, 현 `(main)/layout.tsx`, 현 `(main)/folder/*`,
  `add-link-button.tsx`, `link-list.tsx`

## 4. 디자인 토큰 & 컴포넌트

### 4.1 PARA 토큰 (`lib/para.ts`)

```ts
export const PARA_TOKENS = {
  project:  { letter: "P", label: "Projects",  fg: "#2563eb", bg: "#eff6ff" },
  area:     { letter: "A", label: "Areas",     fg: "#f59e0b", bg: "#fef3c7" },
  resource: { letter: "R", label: "Resources", fg: "#ec4899", bg: "#fce7f3" },
  archive:  { letter: "A", label: "Archives",  fg: "#737373", bg: "#f5f5f5" },
} as const;
export const UNASSIGNED_TOKEN = { label: "미지정", fg: "#6b7280", bg: "#f9fafb" };
```

- 단일 진실 공급원. Tailwind 4 테마 변수도 이 값에서 파생.
- Archive·Area letter가 둘 다 "A" — 컴포넌트는 letter 단독으로 매핑하면 안
  되며, 라벨/카테고리 키로 구분.
- 익스텐션 `lib/types.ts`의 `PARA_LABELS` 통일은 [[extension-redesign]]
  후속 작업에서 처리.

### 4.2 컴포넌트 트리 (`src/components/`)

```
shell/
├── bottom-nav.tsx          하단 3탭, 현재 path 매칭 + 활성 표시
├── app-header.tsx          화면별 타이틀 + 액션 슬롯
└── back-button.tsx         드릴 단계용 ←

library/
├── para-card.tsx           컬러 P/A/R/A 카드 (홈 그리드 아이템)
├── unassigned-card.tsx     미지정 와이드 카드
├── folder-card.tsx         카테고리 화면의 폴더 카드
└── link-card.tsx           폴더 화면의 링크 카드 (썸네일/호스트/우선도)

actions/
├── add-link-fab.tsx        우하단 FAB → 모달
├── add-link-modal.tsx      폴더 화면 신규 링크
└── add-folder-modal.tsx    카테고리 화면 신규 폴더

primitives/
└── para-badge.tsx          인라인 P/A/R/A 배지 (검색결과/링크카드용)

ui/                         shadcn 기존 유지
```

**핵심 재사용 단위**: `para-card` / `para-badge` 둘 다 `para` prop 하나로
토큰 매핑. 라이브러리 홈·검색 결과·링크 카드 어디서나 일관된 표현.

**FAB 등장 규칙**
- 폴더 화면(`/folder/[id]`)에서만 FAB 노출(새 링크 추가)
- 카테고리 화면(`/category/[para]`)에는 "새 폴더" 카드 버튼이 목록 안에 등장
- 라이브러리 홈·검색·설정에는 FAB 없음

## 5. 데이터 흐름

### 5.1 렌더링 전략

- 페이지(라이브러리/카테고리/폴더/검색/설정) = **서버 컴포넌트(RSC)** 로
  Supabase 조회.
- 인증·리다이렉트는 `(main)/layout.tsx`에서 한 번만.
- 변경(저장/수정/삭제/이동) = **클라이언트 컴포넌트** + Supabase 직접 호출 +
  `router.refresh()`로 RSC 재실행.
- Server Actions는 v1에서 사용 안 함(과한 추상화). 직접 호출이 더 명확.

### 5.2 페이지별 쿼리

| 라우트 | 쿼리 |
|--------|------|
| `/` | `folders.select('*')` + `links.select('folder_id')` → JS에서 PARA별 폴더/링크 수 집계 |
| `/category/[para]` | `folders.eq('para_category', para)` (unassigned는 `.is('para_category', null)`) + 해당 folder_id의 `links.select('folder_id')` 카운트 |
| `/folder/[id]` | `folders.eq('id', id).single()` + `links.eq('folder_id', id).order('created_at', desc)` |
| `/search?q=` | `links.select('*, folders(name, para_category)').or('title.ilike.%q%,description.ilike.%q%,url.ilike.%q%').limit(50)` |
| `/settings` | `auth.user` (이메일 표시). `user_reminder_prefs`는 v2 |

**집계 단순화 원칙**: SQL이 아니라 JS에서. 폴더 수십·링크 수백 규모까지 충분.
5000+ 시점에 RPC/뷰로 옮김.

### 5.3 쓰기 액션

| 액션 | 컴포넌트 | 호출 | 사후 처리 |
|------|----------|------|-----------|
| 링크 저장 | `add-link-modal` (폴더 화면) | `links.insert(...)` | 모달 닫기 + `router.refresh()` |
| 폴더 생성 | `add-folder-modal` (카테고리 화면) | `folders.insert(...)` | 모달 닫기 + `router.refresh()` |
| 링크 읽음 처리 | `link-card` 클릭 | `links.update({is_read, read_at})` 후 새 탭 열기 | 백그라운드 `router.refresh()` |
| 링크 수정/삭제/이동 | (v1.1 이후) | — | — |
| 로그아웃 | settings | `auth.signOut()` | `/login`로 |

### 5.4 라우트 파라미터 핸들링

`/category/[para]`에서 유효 값은 `project|area|resource|archive|unassigned`.
그 외는 `notFound()`로 404.

```ts
const VALID_PARAS = ["project", "area", "resource", "archive", "unassigned"] as const;
type ParaParam = (typeof VALID_PARAS)[number];

if (!VALID_PARAS.includes(params.para as ParaParam)) notFound();

const query = params.para === "unassigned"
  ? folders.is("para_category", null)
  : folders.eq("para_category", params.para);
```

### 5.5 중복 URL 처리

링크 저장 모달 진입 시 `links.select('id, folder_id').eq('url', url).maybeSingle()`
사전 체크 → 이미 있으면 "이미 저장됨" 안내 + 해당 폴더로 이동 옵션 제공.

### 5.6 동시 사용(익스텐션 ↔ 웹) 동기화

v1엔 Realtime 미사용. 사용자가 익스텐션에서 추가 후 웹에서 보려면 새로고침
1회 필요. 트레이드오프 수용. v2에서 Realtime 도입 검토.

## 6. PWA 설정

### 6.1 파일

```
web/src/app/manifest.ts          동적 manifest
web/src/app/layout.tsx           viewport + theme-color
web/public/icon-192.png          192×192
web/public/icon-512.png          512×512 maskable (안전영역 80%)
web/public/apple-touch-icon.png  iOS 180×180
```

### 6.2 `app/manifest.ts`

**브랜드 컬러**: PARA Projects의 `#2563eb`를 그대로 브랜드 컬러로 채택. PRD의
"행동 중심" 가치가 Projects(현재 진행 중 작업)와 가장 결이 맞고, 별도 브랜드
컬러를 새로 정의하면 토큰이 분산됨. v2에서 별도 브랜드 컬러가 필요해지면 그때
분리.


```ts
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

### 6.3 viewport (Next.js 16: `viewport` export 분리)

```ts
export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,        // 입력 시 zoom 방지 — 입력 폰트 16px+ 보장 전제
  viewportFit: "cover",   // iOS 노치/홈 인디케이터 영역 배경 채움
};
```

### 6.4 세이프 에어리어

하단 탭바와 FAB는 `env(safe-area-inset-bottom)` padding 적용. Tailwind 4
유틸 `pb-[env(safe-area-inset-bottom)]` 등.

### 6.5 설치 프롬프트

v1엔 직접 후킹(`beforeinstallprompt`) 안 함. 브라우저 기본 UI에 맡김.
직접 배너는 v1.1 이후.

### 6.6 v1 PWA 베네핏 / 비베네핏

- ✅ 홈화면 설치, 스플래시, 풀스크린 standalone, 테마 컬러
- ❌ 오프라인(서비스워커 없음), 푸시 알림(v2)

## 7. 에러 처리 & 빈 상태

### 7.1 에러 경계

- `(main)/error.tsx` — 공통 폴백 + 재시도 버튼(`reset()`)
- `(main)/folder/[id]/error.tsx` — 폴더 단위 세부 폴백
- Supabase 에러는 `error.code` / `error.message`를 카드 안에 표시

### 7.2 잘못된 경로

- 유효하지 않은 `para` 값 / 존재하지 않는 `folder_id` → `notFound()`
- 공통 `(main)/not-found.tsx`로 폴백

### 7.3 빈 상태

| 화면 | 빈 상태 처리 |
|------|--------------|
| 라이브러리 홈 | PARA 카드는 항상 4개(0개 카운트 OK). 미지정은 0이면 행 자체 숨김 |
| 카테고리 | "아직 폴더가 없어요" + "새 폴더 만들기" CTA 카드 |
| 폴더 | "이 폴더는 비어 있어요" + FAB 강조 |
| 검색 | 입력 전: 안내 카피. 결과 0: "일치하는 링크가 없어요" |

### 7.4 로딩

페이지마다 `loading.tsx`로 스켈레톤. 홈은 PARA 4박스 스켈레톤, 카테고리·폴더는
줄 4~5개.

## 8. 수동 검증 체크리스트

자동 테스트 대신 PR 완료 전 다음을 수동 확인.

1. 로그아웃 상태에서 `/` 진입 → `/login` 리다이렉트
2. 로그인 → 라이브러리 홈 진입, PARA 4카드 + 미지정 카운트 일치
3. Projects 카드 → 폴더 목록 → 폴더 진입 → 링크 카드 클릭 → 새 탭 열림 + 읽음 표시 갱신
4. 새 폴더 생성(카테고리 화면) / 새 링크 저장(폴더 화면)
5. 중복 URL 저장 시도 → "이미 저장됨" 안내 동작
6. 검색 입력 → 결과 클릭 → 외부 열림
7. 로그아웃 → `/login` 이동
8. iOS Safari "홈 화면에 추가" → standalone 실행 → 노치 영역 OK, 하단 탭바가 홈 인디케이터 위
9. Lighthouse(Chrome DevTools) PWA Installable 통과

## 9. v1에 포함하지 않는 것

- "오늘 리마인드" 탭과 리마인드 알고리즘
- 푸시 알림 / 이메일 발송 / 백엔드 API Routes
- 오프라인 지원, 서비스워커
- 익스텐션 재디자인 (별도 작업)
- 링크 수정·삭제·이동 (v1.1 이후)
- 태그 입력 UI (스키마는 있음, UI는 v1.1 이후)
- 다크 모드 (v2)
- Realtime 동기화

## 10. 후속 작업 (이 스펙 밖)

- [[extension-redesign]] — 익스텐션을 본 디자인 시스템으로 재작성
- [[reminder-backend]] — Vercel Cron + Next.js API Route + Resend
- [[link-edit-ui]] — 링크 수정·삭제·이동 UI (v1.1)
- [[tags-ui]] — 태그 입력/검색 UI (v1.1)
