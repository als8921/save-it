-- PARA category enum
create type para_category as enum ('project', 'area', 'resource', 'archive');

-- Folders table
create table folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  para_category para_category, -- null = 미지정
  created_at timestamptz not null default now()
);

-- Links table
create table links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  folder_id uuid not null references folders(id) on delete cascade,
  url text not null,
  title text not null,
  description text,
  priority smallint not null default 0,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

-- Indexes
create index idx_folders_user_id on folders(user_id);
create index idx_folders_para_category on folders(user_id, para_category);
create index idx_links_folder_id on links(folder_id);
create index idx_links_user_id on links(user_id);
create index idx_links_is_read on links(user_id, is_read);

-- RLS
alter table folders enable row level security;
alter table links enable row level security;

create policy "Users can view own folders" on folders
  for select using (auth.uid() = user_id);
create policy "Users can insert own folders" on folders
  for insert with check (auth.uid() = user_id);
create policy "Users can update own folders" on folders
  for update using (auth.uid() = user_id);
create policy "Users can delete own folders" on folders
  for delete using (auth.uid() = user_id);

create policy "Users can view own links" on links
  for select using (auth.uid() = user_id);
create policy "Users can insert own links" on links
  for insert with check (auth.uid() = user_id);
create policy "Users can update own links" on links
  for update using (auth.uid() = user_id);
create policy "Users can delete own links" on links
  for delete using (auth.uid() = user_id);

-- Auto-create default folder for new users
create or replace function create_default_folder()
returns trigger as $$
begin
  insert into public.folders (user_id, name, para_category)
  values (new.id, '미지정', null);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function create_default_folder();
