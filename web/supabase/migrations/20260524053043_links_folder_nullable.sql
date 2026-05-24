-- 미지정 링크는 "폴더 없음"으로 표현한다.
-- 1) 유저당 미지정 폴더 1개 제약 인덱스 제거 (개념 자체가 사라짐)
-- 2) links.folder_id의 NOT NULL 제거
-- 3) 기존 unassigned 폴더(para_category IS NULL) 안의 링크를 folder_id=NULL 로 이관
-- 4) 비워진 unassigned 폴더 삭제

drop index if exists folders_user_unassigned_uniq;

alter table links
  alter column folder_id drop not null;

update links
set folder_id = null
where folder_id in (
  select id from folders where para_category is null
);

delete from folders where para_category is null;
