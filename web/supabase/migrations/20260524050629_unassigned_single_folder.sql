-- 미지정(para_category IS NULL)은 유저당 정확히 1개의 "기본" 폴더만 갖도록 정규화한다.
-- 그 폴더 안의 링크만 미지정 화면에 평탄하게 노출되고, 추가 폴더는 허용하지 않는다.
--
-- 1) 미지정 폴더가 하나도 없는 유저에게 기본 '미지정' 폴더를 만들어 준다.
-- 2) 유저별로 가장 오래된 미지정 폴더를 default로 선택한다.
-- 3) 나머지 미지정 폴더의 링크를 default 폴더로 옮긴다.
-- 4) 비워진 나머지 미지정 폴더를 삭제한다.
-- 5) 유저당 미지정 폴더가 1개를 넘지 못하도록 부분 유니크 인덱스를 추가한다.

-- 1) Backfill: 미지정 폴더가 없는 기존 유저 보강
insert into folders (user_id, name, para_category)
select u.id, '미지정', null
from auth.users u
where not exists (
  select 1 from folders f
  where f.user_id = u.id and f.para_category is null
);

-- 2~4) 링크를 default 폴더로 이관 후 잉여 폴더 삭제
with default_folders as (
  select distinct on (user_id) user_id, id as default_id
  from folders
  where para_category is null
  order by user_id, created_at asc, id asc
)
update links
set folder_id = df.default_id
from folders f
join default_folders df on df.user_id = f.user_id
where links.folder_id = f.id
  and f.para_category is null
  and f.id <> df.default_id;

with default_folders as (
  select distinct on (user_id) user_id, id as default_id
  from folders
  where para_category is null
  order by user_id, created_at asc, id asc
)
delete from folders
where para_category is null
  and id not in (select default_id from default_folders);

-- 5) 유저당 미지정 폴더는 1개로 제한
create unique index folders_user_unassigned_uniq
  on folders (user_id)
  where para_category is null;
