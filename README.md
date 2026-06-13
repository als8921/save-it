# Save It

> 저장만 되고 잊혀지는 링크를, **다시 보게** 만드는 서비스

기존 북마크가 "저장"에 초점을 둔다면, **Save It**은 "재사용(다시 보기)"에 초점을 둡니다.
[PARA](https://fortelabs.com/blog/para/) 구조로 링크를 정리하고, 미열람·중요도·최근 저장 기준으로 **상황에 맞게 다시 노출**합니다.

웹앱(PWA)과 크롬 익스텐션에서 모두 사용할 수 있습니다.

---

## ✨ 주요 기능

- **링크 저장** — 현재 탭/클립보드 URL을 빠르게 저장, 페이지 제목 자동 추출
- **PARA 분류** — Projects / Areas / Resources / Archives + 미지정
- **폴더 관리** — 폴더 생성·이름변경·이동·삭제, 링크 수정·이동·삭제
- **다시 보기 리마인드** — 매시 정각 cron으로 점수화된 후보를 **웹 푸시 알림**으로 재노출
- **크롬 익스텐션** — 페이지 위 플로팅 위젯 + 팝업에서 바로 저장/탐색 (전체화면 시 자동 숨김)

### PARA 구조

| 분류 | 설명 | 예시 |
|------|------|------|
| **Projects** | 현재 진행 중 작업 | 과제, 업무 |
| **Areas** | 지속적 관심 분야 | 개발, 운동 |
| **Resources** | 참고 자료 | 나중에 볼 영상 |
| **Archives** | 완료/비활성 | 끝난 프로젝트 |

---

## 🧱 기술 스택

| 영역 | 스택 |
|------|------|
| 웹앱 | Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS 4 |
| 익스텐션 | WXT + React 19 (Vite 기반) |
| DB / Auth | Supabase (Postgres + Auth, RLS) |
| 푸시 | web-push (VAPID), GitHub Actions cron |
| 배포 | Vercel (웹), Chrome Web Store (익스텐션) |

---

## 📂 프로젝트 구조

```
save-it/
├── web/                  # Next.js 웹앱 (PWA)
│   ├── src/
│   │   ├── app/          # App Router 페이지 · API Route
│   │   ├── components/   # UI 컴포넌트
│   │   └── lib/          # supabase, para, remind, push 유틸
│   └── supabase/migrations/   # DB 마이그레이션
├── extension/            # WXT 크롬 익스텐션
│   ├── entrypoints/      # popup, content(floating widget), background
│   ├── components/       # UI 컴포넌트
│   └── lib/              # supabase, para, types 유틸
├── docs/                 # PRD, ARCHITECTURE, ERD, 리마인드 전략
└── .github/workflows/    # 매시 푸시 리마인드 cron
```

데이터 흐름:

```
웹앱        → Supabase (브라우저에서 직접 호출)
익스텐션     → Supabase (브라우저에서 직접 호출)
GitHub Cron → Vercel API Route → web-push → 사용자 (리마인드)
```

---

## 🚀 시작하기

### 사전 준비
- Node.js 20+
- [Supabase](https://supabase.com) 프로젝트

### 1. Supabase
`web/supabase/migrations/`의 SQL을 Supabase 프로젝트에 순서대로 적용합니다.
주요 테이블: `folders`, `links`, `tags`, `link_tags`, `link_reminders`, `user_reminder_prefs`, `push_subscriptions` (모두 RLS 적용).

### 2. 웹앱 (`web/`)

```bash
cd web
cp .env.example .env.local   # 값 채우기
npm install
npm run dev                  # http://localhost:3000
```

`.env.local` 필요 값:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# 웹 푸시 — npx web-push generate-vapid-keys 로 생성
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:owner@example.com

CRON_SECRET=                 # cron 엔드포인트 보호용
```

### 3. 익스텐션 (`extension/`)

```bash
cd extension
# extension/.env 생성
#   WXT_PUBLIC_SUPABASE_URL=
#   WXT_PUBLIC_SUPABASE_ANON_KEY=
npm install
npm run dev                  # 개발 모드(자동 리로드)
npm run build                # .output/chrome-mv3 생성
```

빌드 후 `chrome://extensions` → 개발자 모드 → **압축해제된 확장 프로그램 로드** → `extension/.output/chrome-mv3` 선택.

---

## ⏰ 리마인드 시스템

- `.github/workflows/remind-push.yml` 이 **매시 정각(UTC)** 에 Vercel cron 엔드포인트를 호출
- `/api/cron/remind-push` 가 사용자별 타임존·발송 시각을 확인하고, 점수화된 후보를 `web-push`로 발송
- 점수 전략은 [`docs/REMIND_STRATEGY.md`](docs/REMIND_STRATEGY.md) 참고
- GitHub Actions secret: `CRON_SECRET`

---

## 🛠 스크립트

**web/**

```bash
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run start    # 프로덕션 실행
npm run lint     # ESLint
npm run test     # Vitest
```

**extension/**

```bash
npm run dev      # WXT 개발 모드
npm run build    # 프로덕션 빌드
npm run zip      # 스토어 업로드용 zip
```

---

## 📖 문서

- [`docs/PRD.md`](docs/PRD.md) — 제품 요구사항
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — 아키텍처
- [`docs/ERD.md`](docs/ERD.md) — 데이터 모델
- [`docs/REMIND_STRATEGY.md`](docs/REMIND_STRATEGY.md) — 리마인드 점수 전략
