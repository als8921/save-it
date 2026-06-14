import type { RemindCandidate } from "./picker";

export interface ReminderPayload {
  title: string;
  body: string;
  url: string;
}

export interface ReminderNotification {
  hero: RemindCandidate;
  payload: ReminderPayload;
}

const TITLE_MAX = 60;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname || "저장한 링크";
  } catch {
    return "저장한 링크";
  }
}

function heroTitle(c: RemindCandidate): string {
  const raw = c.link.title?.trim();
  const base = raw && raw.length > 0 ? raw : hostOf(c.link.url);
  return base.length > TITLE_MAX ? base.slice(0, TITLE_MAX - 1) + "…" : base;
}

/**
 * 후보(점수 내림차순)에서 최근 대표가 아닌 첫 링크를 대표로 골라 알림 payload 를 만든다.
 * 모두 최근 대표면 최고 점수로 폴백. 후보가 없으면 null.
 */
export function buildReminderNotification(
  candidates: RemindCandidate[],
  recentHeroLinkIds: string[]
): ReminderNotification | null {
  if (candidates.length === 0) return null;
  const recent = new Set(recentHeroLinkIds);
  const hero = candidates.find((c) => !recent.has(c.link.id)) ?? candidates[0];
  const rest = candidates.length - 1;
  const body = rest > 0 ? `저장한 링크 · 외 ${rest}개` : "저장한 링크";
  return { hero, payload: { title: heroTitle(hero), body, url: "/today" } };
}
