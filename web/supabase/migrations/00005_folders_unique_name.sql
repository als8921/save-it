-- 같은 사용자가 같은 PARA 카테고리 안에 같은 이름의 폴더를 만들지 못하도록 한다.
-- - lower(name): 대소문자 무관 ("Work" === "work")
-- - nulls not distinct: para_category가 null("미지정")인 경우도 동일 이름 차단
-- 적용 전 중복이 이미 있으면 실패하므로 사전 정리 필요.

create unique index folders_user_para_name_uniq
  on folders (user_id, para_category, lower(name))
  nulls not distinct;
