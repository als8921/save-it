# Architecture

## 기술 스택
- **웹앱**: Next.js 16 (App Router, Turbopack) + Tailwind CSS 4
- **크롬 익스텐션**: WXT + React (Vite 기반)
- **DB / Auth**: Supabase (Postgres + Auth)
- **배포**: Vercel (웹), Chrome Web Store (익스텐션)

## 프로젝트 구조
```
save-it/
├── web/                  # Next.js 웹앱
│   ├── src/
│   │   ├── app/          # App Router 페이지
│   │   ├── components/   # UI 컴포넌트
│   │   └── lib/          # 유틸리티 (supabase 등)
│   └── public/
├── extension/            # WXT 크롬 익스텐션
│   ├── entrypoints/      # popup, background 등
│   └── lib/              # 유틸리티 (supabase 등)
└── docs/                 # 문서
```

## 데이터 흐름
```
웹앱       → Supabase (직접 호출)
익스텐션    → Supabase (직접 호출)
Vercel Cron → Next.js API Route → Supabase (리마인드)
```
