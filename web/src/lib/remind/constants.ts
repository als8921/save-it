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

export const REMIND_MODE_DAILY = "daily" as const;
export const REMIND_CHANNEL_DASHBOARD = "dashboard" as const;
