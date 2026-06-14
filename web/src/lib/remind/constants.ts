export const REMIND_WEIGHTS = {
  priority: 0.4,
  para: 0.3,
  age: 0.3,
} as const;

export const PARA_WEIGHT = {
  project: 1.0,
  area: 0.7,
  resource: 0.5,
  unassigned: 0.5,
} as const;

export const AGE_PEAK_DAYS = 7;
export const AGE_SIGMA_DAYS = 10;

export const FATIGUE_WINDOW_DAYS = 7;
export const REMIND_TTL_HOURS = 4;

export const DEFAULT_MAX_ITEMS = 5;

// Must match DB enums (reminder_mode, reminder_channel) in 00004_reminders.sql.
export const REMIND_MODE_DAILY = "daily" as const;
export const REMIND_CHANNEL_DASHBOARD = "dashboard" as const;
export const REMIND_CHANNEL_PUSH = "push" as const;

// 대표(hero) 링크 연속 중복 방지: 최근 N일간 대표였던 링크는 제외
export const HERO_COOLDOWN_DAYS = 3;

// 하루 알림 횟수별 프리셋 시각 (로컬 시각, 정각). 아침은 user의 daily_time 사용.
export const DAILY_PRESET_AFTERNOON = "13:00:00" as const;
export const DAILY_PRESET_EVENING = "21:00:00" as const;
