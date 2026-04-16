# Architecture

## 기술 스택
- **웹앱**: Next.js 15 (App Router, Turbopack) + Tailwind CSS 4
- **크롬 익스텐션**: WXT + React (Vite 기반)
- **DB / Auth**: Supabase (Postgres + Auth)
- **배포**: Vercel (웹), Chrome Web Store (익스텐션)
- **모노레포**: Turborepo + npm workspaces

## 프로젝트 구조
```
save-it/
├── apps/
│   ├── web/              # Next.js 웹앱
│   └── extension/        # WXT 크롬 익스텐션
│       ├── entrypoints/  # popup, background 등
│       └── lib/          # 유틸리티 (supabase 등)
├── packages/
│   └── shared/           # 공유 타입, 상수, 유틸
└── docs/                 # 문서
```

## 데이터 흐름
```
웹앱       → Supabase (직접 호출)
익스텐션    → Supabase (직접 호출)
Vercel Cron → Next.js API Route → Supabase (리마인드)
```
