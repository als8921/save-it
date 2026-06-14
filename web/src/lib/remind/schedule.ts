import { DAILY_PRESET_AFTERNOON, DAILY_PRESET_EVENING } from "./constants";

function normalizeTime(t: string): string {
  const [h = "0", m = "0", s = "0"] = t.split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}:${s.padStart(2, "0")}`;
}

/**
 * 하루 알림 횟수(1~3)에 따른 발송 시각 목록을 만든다.
 * 아침 = 사용자의 daily_time, 점심/저녁 = 프리셋. 중복은 제거하고 정렬한다.
 */
export function deriveScheduleTimes(dailyTime: string, dailyCount: number): string[] {
  const count = Number.isInteger(dailyCount) && dailyCount >= 1 && dailyCount <= 3
    ? dailyCount
    : 1;
  const slots = [normalizeTime(dailyTime)];
  if (count >= 3) slots.push(DAILY_PRESET_AFTERNOON);
  if (count >= 2) slots.push(DAILY_PRESET_EVENING);
  return [...new Set(slots)].sort();
}
