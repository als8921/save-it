# YouTube 컨텍스트 추천 위젯 — 설계

> 사용자가 유튜브 영상을 보는 동안, 익스텐션이 **저장해 둔 유튜브 영상**을 우측 하단
> 플로팅 위젯으로 다시 꺼내 보여준다. `docs/REMIND_STRATEGY.md` §3.3 "콘텐츠 매칭 모드
> — YouTube 모드"의 첫 구현이다.

- 작성일: 2026-06-14
- 대상: `extension/` (WXT 크롬 익스텐션)
- 상태: 설계 승인됨, 구현 계획 대기

---

## 1. 목표와 비목표

### 목표
- 유튜브 `watch`(및 `shorts`) 페이지에서, 저장해 둔 유튜브 링크를 추천 위젯으로 노출한다.
- 기존 Save It 플로팅 위젯과 **분리된** 별도 위젯으로, 유튜브에서만 동작한다.
- 스키마 변경 없이 현재 `links` 데이터만으로 구현한다.

### 비목표 (v1 제외)
- 같은 채널/저자 매칭 (채널 메타데이터 저장이 필요 → 향후).
- 유튜브 추천 영역 옆 **인라인 DOM 주입** (향후).
- 유튜브 외 도메인으로의 일반화 (헬퍼는 일반화 여지를 남기되 구현은 안 함).
- 스누즈/영구 숨김 (세션 내 접기까지만).

---

## 2. 아키텍처

기존 패턴(content script가 Supabase를 직접 호출)을 그대로 따른다. 유튜브 전용
content script 엔트리포인트를 신설해 관심사를 분리한다.

### 신규 파일
| 파일 | 역할 |
|------|------|
| `extension/entrypoints/youtube.content/index.tsx` | 유튜브 전용 content script. `matches: ["*://www.youtube.com/*"]`, `cssInjectionMode: "ui"`. `createShadowRootUi`로 body에 위젯 마운트. |
| `extension/lib/youtube.ts` | 순수 함수 모음: URL 판별·video id 추출·추천 선별. |
| `extension/entrypoints/youtube.content/YouTubeRecommendWidget.tsx` | 위젯 UI 컴포넌트(또는 index.tsx 내부에 동거). |

### 재사용
- `lib/supabase` (싱글톤 클라이언트), `lib/para` (PARA 토큰), `lib/types` (`Link`).
- `useAuth` (로그인 상태).
- 풀스크린 감지 패턴 (`document.fullscreenElement` + `fullscreenchange`), 기존
  `entrypoints/content/index.tsx`와 동일.

### 권한
- 추가 권한 불필요. 유튜브 content script `matches`는 WXT가 매니페스트에 자동 추가한다.
- Supabase 호출은 `*.supabase.co` host_permission으로 이미 허용됨(기존 all_urls content
  script가 동일하게 호출 중).

---

## 3. `lib/youtube.ts` — 순수 함수

```ts
// 저장 링크가 유튜브 영상인지 (호스트 매칭)
isYouTubeLink(url: string): boolean
//   true: youtube.com/watch, youtu.be/<id>, youtube.com/shorts/<id>, m.youtube.com ...

// 현재 보고 있는 페이지가 유튜브 영상 시청 페이지인지
isYouTubeWatchUrl(url: string): boolean
//   true: youtube.com/watch?v=, youtube.com/shorts/<id>  (홈·검색·채널 페이지는 false)

// 영상 id 추출 (썸네일 URL 및 현재 영상 제외에 사용)
extractVideoId(url: string): string | null
//   watch?v=ID, youtu.be/ID, shorts/ID 모두 처리. 실패 시 null.

// 추천 선별 — 정렬과 현재 영상 제외를 담은 순수 함수
pickYouTubeRecommendations(
  links: Link[],
  currentVideoId: string | null,
  limit = 3,
): Link[]
//   1) isYouTubeLink 필터
//   2) extractVideoId === currentVideoId 인 항목 제외 (지금 보는 영상)
//   3) 정렬: 미열람(is_read=false) 우선 → priority desc → created_at desc
//   4) 상위 limit개 (기본 3개 — 한눈에 들어오는 소수만 노출)
```

이 함수들이 로직의 핵심이며 단위 테스트 대상이다(§7).

---

## 4. 데이터 흐름

```
유튜브 페이지 진입
  → content script 로드 → shadow root에 위젯 마운트
  → (마운트 시 & SPA 이동마다) 현재 URL 평가
      ├─ watch/shorts 아님 → 위젯 숨김
      ├─ 로그아웃 → 위젯 숨김
      └─ watch & 로그인
            → supabase.from("links").select("*")
                 .or("url.ilike.%youtube.com%,url.ilike.%youtu.be%")
            → pickYouTubeRecommendations(links, currentVideoId)  // 상위 3개
            → 0개면 숨김 / 1개+면 위젯 표시(자동 펼침)
  → 카드 클릭
      → window.open(link.url, "_blank")
      → supabase.update({ is_read:true, read_at:now }).eq("id", link.id)  (미열람일 때만)
```

### SPA 내비게이션 감지
유튜브는 SPA라 영상 전환 시 페이지가 새로고침되지 않는다. 다음으로 영상 변경을 감지한다.

- 주: `document.addEventListener("yt-navigate-finish", handler)` — 유튜브가 라우팅
  완료 시 발생시키는 이벤트.
- 보조: `location.href`를 ~1초 간격으로 확인하는 폴링(이벤트 미발생 환경 대비).
- 두 경로 모두 동일한 "현재 URL 재평가" 함수를 호출한다(중복 호출은 멱등 처리).

### Supabase 조회 메모
- `.or(url.ilike...)`로 1차 축소 후, 클라이언트에서 `isYouTubeLink`로 정밀 필터(쿼리
  오탐 방지: 본문에 youtube가 포함된 비유튜브 URL 등).
- 영상 전환마다 매번 호출하지 않도록, 한 번 불러온 링크 목록은 위젯 인스턴스 수명 동안
  메모리에 캐시하고 `currentVideoId`만 바꿔 재선별한다. (목록 신선도는 위젯 재마운트 또는
  수동 새로고침 시 갱신 — v1은 단순 캐시로 충분.)

---

## 5. UI / 상태

### 위치
- 고정 우측 하단(예: `bottom: 20, right: 20`), `zIndex: 2147483647`.
- 기존 Save It 위젯 기본값은 우측 상단이라 겹치지 않는다. v1은 드래그 이동 없음.

### 표시 조건 (모두 만족해야 보임)
1. 현재 URL이 watch/shorts, 2. 로그인됨, 3. 추천 ≥ 1개, 4. 풀스크린 아님.

### 상태 머신
- **진입 시**: 패널이 **자동으로 펼쳐짐** → 약 5초 뒤 **pill로 접힘**.
  - 5초 타이머는 사용자가 패널에 호버/클릭(상호작용)하면 취소.
- **pill**: "저장한 영상 N" + ▶ 아이콘. 클릭 시 펼침/접힘 토글.
- **수동 접기**: 사용자가 접기 버튼/pill로 접으면, 그 세션 동안 자동 펼침을 끈다
  (이후 영상 이동 시 pill 상태로만 등장). 세션 플래그는 위젯 메모리 상태로 관리
  (영구 저장 안 함 → 탭/새로고침하면 초기화).

### 펼친 패널 구성
```
┌─────────────────────────────┐
│ 저장한 유튜브 영상   3   ⌄   │  ← 헤더(제목·개수·접기)
├─────────────────────────────┤
│ [썸네일] 제목…              │
│          P · 폴더명   ●미열람 │  ← 카드(썸네일+제목+PARA배지+미열람점)
│ [썸네일] 제목…              │
│ [썸네일] 제목…              │  ← 최대 3개, 스크롤 거의 불필요
└─────────────────────────────┘
```
- 최대 3개만 노출하므로 목록이 짧다(고정 높이 스크롤은 안전장치로만).
- 썸네일: `https://i.ytimg.com/vi/<videoId>/mqdefault.jpg`. id 없으면 파비콘 폴백.
- PARA 배지: 기존 `lib/para` 토큰 재사용. 미열람은 작은 점 표시.

### 접근성/품질
- pill·카드는 키보드 포커스 가능, 가시적 focus ring.
- `prefers-reduced-motion` 시 펼침/접힘 애니메이션 생략.
- 모든 텍스트 한글, sentence case.

---

## 6. 에러 처리

- Supabase 조회 오류 → 위젯을 렌더하지 않음(유튜브 시청을 방해하지 않는다). `console.warn`만.
- `is_read` 갱신 실패 → 무시(다음 기회에 갱신). 링크 열기는 이미 수행됨.
- video id 파싱 실패 → 해당 카드 썸네일을 파비콘으로 폴백, 현재 영상 제외는 스킵.
- 로그아웃 상태 → 위젯 숨김(로그인 유도는 기존 Save It 위젯이 담당).

---

## 7. 테스트

### 단위 (vitest) — `lib/youtube.ts`
- `isYouTubeLink` / `isYouTubeWatchUrl`: `watch?v=`, `youtu.be/`, `shorts/`,
  `m.youtube.com`, 쿼리 파라미터 다수, 재생목록(`&list=`), 홈/검색/채널 URL(false 기대).
- `extractVideoId`: 위 형태별 정확 추출, 실패 케이스 null.
- `pickYouTubeRecommendations`:
  - 비유튜브 링크 제외, 현재 영상 제외.
  - 정렬 순서(미열람 → priority → 최신) 검증.
  - limit 적용.

### 수동
- 영상 A→B 이동 시 추천 갱신, 현재 영상이 목록에서 빠지는지.
- 5초 후 자동 접힘, 호버 시 타이머 취소.
- 수동 접기 후 세션 내 자동 펼침 억제.
- 풀스크린 진입/이탈 시 숨김/복귀.

---

## 8. 구현 순서(개요)

1. `lib/youtube.ts` + 단위 테스트.
2. 유튜브 content script 엔트리포인트 + shadow root 마운트(빈 위젯).
3. 데이터 조회 + `pickYouTubeRecommendations` 연결.
4. UI(pill/패널/카드) + 자동 펼침·접힘 상태 머신.
5. SPA 내비게이션 감지 + 풀스크린 숨김.
6. 다듬기(접근성·reduced-motion·에러 경로).
