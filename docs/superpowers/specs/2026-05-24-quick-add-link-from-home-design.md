# 메인 화면 빠른 링크 추가 (Quick Add) — 설계

- **작성일**: 2026-05-24
- **범위**: web 앱 메인 라이브러리 화면(`/`)에서 폴더 컨텍스트 없이 링크를 빠르게 저장하는 플로우
- **관련 기존 자산**: `components/actions/add-link-fab.tsx`, `components/actions/add-link-modal.tsx` (폴더 상세 페이지 전용 — 그대로 유지)

## 1. 목표

사용자가 메인 화면에서 우하단 + 버튼을 눌러, 복사해둔 링크를 빠르게 저장할 수 있게 한다.

- 기존 폴더 상세 페이지의 1-step 모달과 별개로, 메인용 2-step 모달을 별도 컴포넌트로 둔다.
- "복사한 링크"라는 사용자 멘탈모델에 맞춰, 모달 오픈 시 클립보드 URL을 자동 채우고 URL에서 제목을 자동 추출한다.
- 폴더 선택은 확장 프로그램 `SaveView`와 동일한 PARA 탭 + 폴더 목록 + 새 폴더 생성 패턴을 따른다.

## 2. 사용자 플로우

```
[메인 화면] PARA 카드 + UnassignedCard
        ↓ 우하단 + FAB 탭
[모달 Step 1: URL]
  • 열리자마자 navigator.clipboard.readText() 시도
    → URL 형식이면 input 자동 채움 (실패는 조용히 무시)
  • input 변경 디바운스(500ms)로 /api/metadata?url=... 호출
    → 제목 미리보기 표시 (저장 직전 수정 가능)
  • "다음" 버튼 → 중복 URL 1차 체크 → Step 2
        ↓
[모달 Step 2: 폴더 선택]
  • PARA 탭(Project / Area / Resource / Archive / 미분류)
  • 해당 카테고리의 폴더 리스트 선택
  • "+ 새 폴더" 버튼 (확장 SaveView와 동일)
  • 하단 토글: "메모 · 우선순위 추가" (펼치면 input + 우선순위 칩)
  • "저장" 버튼 → 중복 URL 2차 체크 → insert → router.refresh() → 모달 닫기
        ↓
[메인 화면으로 복귀, 카드 카운트 증가]
```

**핵심 인터랙션**
- 한 모달 안에서 step state로 전환 (모달 두 번 띄우지 않음 → 부드러운 전환)
- "뒤로" 버튼으로 Step 2 → Step 1 복귀 가능
- 중복 URL 발견 시 Step 1에서 차단, "이미 저장된 URL, 해당 폴더 열기" 인라인 안내

## 3. 컴포넌트 구조

### 새로 만들 파일

```
web/src/
├── app/
│   └── api/
│       └── metadata/
│           └── route.ts          ← GET /api/metadata?url=...
│                                    HTML fetch + og:title/<title> 파싱
└── components/
    └── actions/
        ├── quick-add-fab.tsx     ← 메인 화면 전용 FAB (folderId 없이)
        └── quick-add-modal.tsx   ← 2-step 모달 (URL → 폴더)
```

### 수정 파일

```
web/src/app/(main)/page.tsx
  → user 세션 받아서 <QuickAddFab userId={user.id} /> 추가
```

### 기존 파일 그대로 유지

`add-link-fab.tsx`, `add-link-modal.tsx` — 폴더 상세 페이지에서 계속 사용. folderId 컨텍스트가 명확하므로 1-step 모달이 더 빠르다. 메인용을 별도 컴포넌트로 두는 이유: props 다름(folderId 유무), step 상태 복잡도 다름. 억지로 합치면 양쪽 다 어려워진다.

### 컴포넌트 책임 분리

| 컴포넌트 | 책임 |
|---|---|
| `QuickAddFab` | 메인의 FAB 버튼, 모달 open state만 관리 |
| `QuickAddModal` | step state (`"url" \| "folder"`), URL/title/folderId 등 통합 상태 |
| `QuickAddModal` 내부 `<UrlStep />` | URL input + 클립보드 자동입력 + 메타 fetch |
| `QuickAddModal` 내부 `<FolderStep />` | PARA 탭 + 폴더 리스트 + 새 폴더 생성 + 메모/우선순위 토글 |
| `/api/metadata` Route Handler | URL fetch → og:title/<title> 추출 후 JSON 반환 |

`<UrlStep />`, `<FolderStep />`는 같은 파일 안의 내부 컴포넌트 (별도 파일로 뺄 만큼 크지 않음).

### 상태 흐름

```
QuickAddModal에 통합 state:
  step: "url" | "folder"
  url, title, titleDirty (사용자 수정 여부)
  folderId, description, priority
  error, duplicate, submitting, metaLoading

UrlStep: url/title만 읽고 쓰기, "다음" 누르면 부모가 step 변경
FolderStep: folderId/description/priority 쓰기, "저장"이 insert 실행
```

## 4. `/api/metadata` Route Handler

### 요청 / 응답

```
GET /api/metadata?url=https%3A%2F%2Fexample.com%2Fpost
→ 200 { ok: true, title: "...", host: "example.com" }
→ 200 { ok: false, reason: "fetch_failed" | "invalid_url" | "timeout" | "not_html" | "blocked_host" }
→ 401 (비로그인)
```

실패해도 200 + ok:false — 클라는 ok:false면 그냥 URL을 제목으로 사용. UX가 메타데이터 실패로 막히면 안 됨.

### 구현 핵심

- `web/src/app/api/metadata/route.ts`에 `export async function GET(req: NextRequest)` 형태
- **인증 필수**: `createClient()` (server)로 user 확인, 비로그인이면 401 — 익명 SSRF 방지
- URL 검증: `new URL(url)` 성공 + `protocol`이 `"http:"` 또는 `"https:"`만 허용
- **SSRF 방어**: 사설 IP/로컬호스트 차단 (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `::1`, `fe80::/10`, `169.254.0.0/16`). DNS resolve 후 첫 IP 검증.
- `AbortController`로 5초 timeout
- `fetch(url, { headers: { "User-Agent": "SaveItBot/1.0", "Accept": "text/html" }, redirect: "follow" })`
- 응답 크기 제한: stream으로 받아 처음 256KB만 읽기 (대용량 페이지 방어)
- Content-Type이 `text/html`이 아니면 ok:false (`reason: "not_html"`)
- HTML 파싱: 의존성 추가 부담 줄이려고 **정규식 1차** (`<meta property="og:title" content="(.+?)">`, fallback `<title>(.+?)</title>`) — 실패 시 ok:false. cheerio 같은 무거운 라이브러리 회피.
- HTML entity 디코딩(`&amp;`, `&#39;`, `&quot;`, `&lt;`, `&gt;`, `&#\d+;`, `&#x[0-9a-f]+;`) 처리 필요
- 응답에 `Cache-Control: private, max-age=3600` — 같은 URL 재호출 비용 절감

### 클라이언트 호출 시점

- URL input의 onChange 디바운스 500ms → `new URL(value)` 유효성 통과 시에만 호출
- 로딩 중엔 "제목 가져오는 중…" 표시
- 사용자가 title input을 직접 수정한 적이 있으면 자동 fetch 결과로 덮어쓰지 않음 (`titleDirty` flag)

## 5. 데이터 / 에러 / 테스트

### DB 작성 (Step 2 "저장")

```ts
const { data: existing } = await supabase
  .from("links").select("id, folder_id").eq("url", url.trim()).maybeSingle();
if (existing) { setDuplicate(existing); return; }   // 인라인 안내

await supabase.from("links").insert({
  user_id: userId,
  folder_id: folderId,
  url: url.trim(),
  title: (title.trim() || url.trim()),
  description: description.trim() || null,
  priority,
});
router.refresh();
```

- 중복 체크는 Step 1 "다음" 시점에 1차, Step 2 "저장" 시점에 2차 (race condition 방어).
- `content_type`, `thumbnail_url`, `author`는 이번 작업에서 채우지 않음 (`host`는 generated column이라 자동, 나머지는 추후 메타데이터 확장 작업).

### 폴더 데이터 로딩 (Step 2)

- Step 2 진입 시점에 client-side `supabase.from("folders").select("*").order("created_at")`
- Step 1에서 prefetch 안 함 → 사용자가 URL만 입력하다 닫으면 불필요한 쿼리.
- "+ 새 폴더" 흐름은 확장 `SaveView`와 동일 패턴 (이름 입력 → insert → 목록에 추가 + 자동 선택).

### 에러 케이스

| 상황 | UX |
|---|---|
| 클립보드 권한 거부/실패 | 조용히 무시, input 빈 채로 |
| `/api/metadata` 실패/timeout | title 칸 비워둠, placeholder "URL이 제목으로 사용됩니다" |
| 중복 URL (Step 1) | 인라인 안내 + "해당 폴더 열기" 링크, "다음"으로 안 넘어감 |
| 폴더 0개 | "+ 새 폴더"가 유일한 선택지로 강조 |
| insert 실패 | Step 2 하단에 에러 메시지, 모달 유지 |

### 테스트 범위 (수동 검증 체크리스트)

이 프로젝트에 자동 테스트 인프라가 아직 없어 보이므로 수동 검증 체크리스트로 갈음.

1. 클립보드에 URL 복사 → +탭 → input 자동 채워짐
2. 클립보드에 일반 텍스트 → +탭 → input 빈 채로, 오류 없음
3. 유효한 URL 입력 → 디바운스 후 제목 자동 fetch (콘솔에 401/SSRF 차단 없음)
4. 잘못된 URL (`http://localhost:3000`) → 서버가 SSRF 차단, ok:false
5. Step 2 → PARA 탭 전환 → 폴더 필터링 정상
6. 새 폴더 생성 → 즉시 선택됨
7. 메모/우선순위 토글 펼치고 입력 → DB에 반영
8. 중복 URL → Step 1에서 차단, 폴더 링크로 이동 가능
9. 저장 성공 → 모달 닫힘, 메인 카드 카운트 +1

타입 체크는 `npm run build` (또는 `tsc --noEmit`)로 확인.

## 6. 명시적으로 범위에서 제외

- `content_type` 자동 분류 (youtube/article/github) — 별도 작업
- `thumbnail_url`, `author` 추출 — 별도 작업
- 자동 폴더 추천 — PRD의 "권장 기능"이지만 이번 범위 밖
- 기존 `AddLinkModal`과 `QuickAddModal`의 코드 통합 — 책임 다르므로 의도적 미통합
