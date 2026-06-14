-- 하루 알림 횟수 (1~3). 1=아침, 2=아침+저녁, 3=아침+점심+저녁
alter table user_reminder_prefs
  add column daily_count smallint not null default 1
  check (daily_count between 1 and 3);
