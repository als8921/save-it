# 링크/폴더 삭제·수정(이동·이름변경) 기능 설계

날짜: 2026-06-13
대상: web, extension

## 1. 배경 및 목표

사용자가 저장한 **링크**와 **폴더**를 삭제하고 수정할 수 있어야 한다.
- 링크: 삭제 / 수정(제목·메모·우선도) / 이동(폴더 변경)
- 폴더: 삭제 / 수정(이름·PARA 분류) — 이름변경과 이동을 한 화면에서 처리

web와 extension 양쪽 모두 지원한다.

### 핵심 전제 (조사 결과)
- Supabase RLS 정책 `Users can update/delete own folders|links` 가 **이미 존재**한다.
- `links.folder_id` 는 `folders(id) on delete cascade` → 폴더 삭제 시 안의 링크가 DB에서 자동 삭제된다.
- 따라서 **DB 마이그레이션은 불필요**하다. 순수 프론트엔드 작업이다.

### 기존 패턴
- web: 클라이언트 컴포넌트가 `createClient()`(브라우저 supabase)로 직접 mutate 후 `router.refresh()`. 모달은 base-ui `Dialog`. base-ui `Menu`/`AlertDialog`/`Select` 사용 가능(설치됨).
- extension: `BrowseView` 가 `folders`/`links` 를 로컬 state로 보유, supabase mutate 후 로컬 state 직접 갱신. UI 프리미티브는 `button`/`input`/`label` 뿐.

## 2. 기능 명세

### 링크
| 동작 | 내용 | 비고 |
|---|---|---|
| 수정 | `title`, `description`, `priority` 편집 | URL은 읽기 전용(중복 검사 깨짐 방지) |
| 이동 | `folder_id` 변경 (폴더 선택, 미지정=`null` 포함) | 폴더 목록은 열 때 조회 |
| 삭제 | 확인 후 row 삭제 | |

### 폴더
| 동작 | 내용 | 비고 |
|---|---|---|
| 수정 | `name` + `para_category` 편집 (한 모달) | 이름변경+이동 통합 |
| 삭제 | "N개 링크도 함께 삭제됩니다" 경고 후 삭제 | DB cascade 활용 |

폴더 유니크 제약(`folders_user_para_name_uniq`, `folders_user_unassigned_uniq`)으로 수정 시
`23505` 발생 가능 → "이미 같은 이름의 폴더가 있어요" 메시지(기존 add-folder 로직 재사용).

### 조작 방식 (확정)
- 진입: 각 카드 우측 **⋮ 케밥 메뉴**.
- 링크 ⋮ 메뉴 항목: **수정 / 이동 / 삭제** (3개 분리)
- 폴더 ⋮ 메뉴 항목: **수정 / 삭제**
- 폴더 ⋮ 메뉴 노출 위치: **폴더 목록 카드 + 폴더 상세 페이지 헤더** 양쪽

## 3. Web 설계 (`web/src/components/`)

### 신규 컴포넌트
- `library/link-actions-menu.tsx` — `LinkCard` 우측 ⋮ (base-ui `Menu`). 항목 수정/이동/삭제. 각 항목이 해당 모달/다이얼로그를 연다.
- `actions/edit-link-modal.tsx` — 제목 + 메모 + 우선도 폼(add-link-modal 필드 재사용). URL은 읽기 전용 표시.
- `actions/move-link-modal.tsx` — 폴더 선택 전용(미지정 포함). 폴더 목록은 모달 open 시 클라이언트 조회.
- `library/folder-actions-menu.tsx` — 폴더 ⋮ (base-ui `Menu`). 항목 수정/삭제.
- `actions/edit-folder-modal.tsx` — 이름 입력 + PARA 분류 선택.
- `actions/confirm-delete-dialog.tsx` — 재사용 삭제 확인(base-ui `AlertDialog`). props로 메시지/카운트 전달. 링크·폴더 삭제 공용.

### 배치/연결
- `LinkCard` 는 `<a>` 이므로 ⋮ 는 형제 오버레이 버튼으로 두고 `preventDefault`/`stopPropagation` 으로 내비게이션 차단.
- `FolderCard`(`library/folder-card.tsx`)와 `library/folder-accordion-item.tsx` 에 폴더 ⋮ 추가(동일하게 링크 내비 차단 처리).
- 폴더 상세 페이지(`app/(main)/folder/[id]/page.tsx`)의 `AppHeader` `right` 슬롯에 폴더 ⋮ 추가.
- 모든 mutate 성공 후 `router.refresh()`.

### 폴더 목록 조회(이동 모달용)
- `move-link-modal` 이 열릴 때 `supabase.from("folders").select("id,name,para_category").order("created_at")` 로 사용자 폴더 전체를 조회. (서버 페이지마다 props로 내리지 않음 — 단순화)

## 4. Extension 설계 (`extension/`)

### 신규 컴포넌트
- `components/ui/menu.tsx` — 경량 케밥 드롭다운(absolute 포지션). 메뉴 프리미티브가 없어 직접 구현. 외부 클릭 닫기 포함.

### `BrowseView` 변경
- 각 `LinkRow` 우측에 ⋮ → 수정 / 이동 / 삭제.
  - 수정: 인라인 또는 작은 폼(제목/메모/우선도).
  - 이동: 폴더 선택(미지정 포함). 폴더 목록은 이미 로드된 `folders` state 재사용.
  - 삭제: 확인 후 삭제.
- 각 폴더 헤더에 ⋮ → 수정(이름+PARA) / 삭제(링크 수 경고).
- 모든 mutate 후 **로컬 `folders`/`links` state 직접 갱신**(기존 패턴, 재조회 없음). 폴더 삭제 시 해당 폴더 + 소속 링크를 state에서 함께 제거.
- 폴더 선택 UI는 `SaveView` 의 폴더 선택 패턴을 참고/재사용.

## 5. 에러 처리 · 엣지 케이스
- 폴더 수정/이동 시 이름 충돌 `23505` → "이미 같은 이름의 폴더가 있어요".
- 링크를 "미지정"으로 이동 → `folder_id = null`.
- 삭제 실패 → 인라인 에러 표시. extension은 낙관적 갱신 실패 시 롤백.
- 폴더 삭제 확인 다이얼로그는 폴더 내 링크 수를 표시.

## 6. 테스트
- web: `vitest` 보유. 순수 로직(삭제 확인 메시지 생성기, 폴더 옵션 목록 빌더 등)을 헬퍼로 분리해 단위 테스트.
- supabase 의존 동작은 수동 검증.

## 7. 범위 밖 (YAGNI)
- 다중 선택/일괄 삭제.
- 드래그 앤 드롭 이동.
- 삭제 취소(undo)/휴지통.
- URL 편집.
