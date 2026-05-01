-- Tags table
create table tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- Link-Tag 정션 (M:N)
create table link_tags (
  link_id uuid not null references links(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  primary key (link_id, tag_id)
);

-- Indexes
create unique index uq_tags_user_name on tags(user_id, lower(name));
create index idx_link_tags_tag on link_tags(tag_id);

-- RLS
alter table tags enable row level security;
alter table link_tags enable row level security;

create policy "Users can view own tags" on tags
  for select using (auth.uid() = user_id);
create policy "Users can insert own tags" on tags
  for insert with check (auth.uid() = user_id);
create policy "Users can update own tags" on tags
  for update using (auth.uid() = user_id);
create policy "Users can delete own tags" on tags
  for delete using (auth.uid() = user_id);

-- link_tags: 자체 user_id 컬럼이 없으므로 소속 link의 user_id로 검사
create policy "Users can view own link_tags" on link_tags
  for select using (
    exists (
      select 1 from links
      where links.id = link_tags.link_id and links.user_id = auth.uid()
    )
  );
create policy "Users can insert own link_tags" on link_tags
  for insert with check (
    exists (
      select 1 from links
      where links.id = link_tags.link_id and links.user_id = auth.uid()
    )
  );
create policy "Users can delete own link_tags" on link_tags
  for delete using (
    exists (
      select 1 from links
      where links.id = link_tags.link_id and links.user_id = auth.uid()
    )
  );
