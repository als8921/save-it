-- Reminder enums
create type reminder_channel as enum ('dashboard', 'extension', 'email', 'push');
create type reminder_mode as enum (
  'daily',         -- 일일 다이제스트
  'weekly',        -- 주간 회고
  'resurface',     -- 오래된 Resource 재발굴
  'priority',      -- 중요한데 놓친 것
  'youtube_ctx',   -- YouTube 컨텍스트 매칭
  'domain_ctx'     -- 일반 도메인 매칭
);

-- 리마인드 이력 (점수 계산 + KPI 측정)
create table link_reminders (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references links(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel reminder_channel not null,
  mode reminder_mode not null,
  sent_at timestamptz not null default now(),
  opened_at timestamptz,
  snoozed_until timestamptz
);

create index idx_link_reminders_link on link_reminders(link_id, sent_at desc);
create index idx_link_reminders_user on link_reminders(user_id, sent_at desc);

-- 사용자별 리마인드 설정 (1:1)
create table user_reminder_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_enabled boolean not null default true,
  daily_time time not null default '09:00',
  timezone text not null default 'Asia/Seoul',
  weekly_enabled boolean not null default true,
  email_enabled boolean not null default false,
  max_items_per_reminder smallint not null default 5
);

-- RLS
alter table link_reminders enable row level security;
alter table user_reminder_prefs enable row level security;

create policy "Users can view own reminders" on link_reminders
  for select using (auth.uid() = user_id);
create policy "Users can insert own reminders" on link_reminders
  for insert with check (auth.uid() = user_id);
create policy "Users can update own reminders" on link_reminders
  for update using (auth.uid() = user_id);

create policy "Users can view own prefs" on user_reminder_prefs
  for select using (auth.uid() = user_id);
create policy "Users can insert own prefs" on user_reminder_prefs
  for insert with check (auth.uid() = user_id);
create policy "Users can update own prefs" on user_reminder_prefs
  for update using (auth.uid() = user_id);

-- 신규 가입자에게 기본 prefs 자동 생성
create or replace function create_default_reminder_prefs()
returns trigger as $$
begin
  insert into public.user_reminder_prefs (user_id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created_prefs
  after insert on auth.users
  for each row execute function create_default_reminder_prefs();
