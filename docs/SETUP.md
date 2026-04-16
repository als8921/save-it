# 개발 환경 세팅

## 사전 요구사항
- Node.js 23+
- npm 10+

## 설치
```bash
npm install
```

## 개발 서버 실행
```bash
# 전체 (웹 + 익스텐션)
npm run dev

# 웹만
npm run dev:web

# 익스텐션만
npm run dev:extension
```

## 환경 변수
`.env.example`을 `.env.local`로 복사 후 Supabase 키 입력:
```bash
cp .env.example .env.local
```

## Supabase 세팅
1. https://supabase.com 에서 프로젝트 생성
2. Authentication → Providers → Google 활성화
3. `.env.local`에 URL과 ANON_KEY 입력

## 크롬 익스텐션 로컬 테스트
1. `npm run dev:extension`
2. `chrome://extensions` → 개발자 모드 ON
3. "압축 해제된 확장 프로그램 로드" → `apps/extension/.output/chrome-mv3` 선택
