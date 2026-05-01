-- Content type enum (콘텐츠 매칭용)
create type content_type as enum ('youtube', 'article', 'github', 'other');

-- Links 메타데이터 컬럼 확장
alter table links
  add column host text generated always as (
    lower(substring(url from 'https?://([^/:?#]+)'))
  ) stored,
  add column content_type content_type not null default 'other',
  add column thumbnail_url text,
  add column author text,
  add column updated_at timestamptz not null default now();

-- updated_at 자동 갱신 트리거
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger links_set_updated_at
  before update on links
  for each row execute function set_updated_at();

-- 컨텍스트 매칭용 인덱스
create index idx_links_user_host on links(user_id, host);
create index idx_links_content_type on links(user_id, content_type);
