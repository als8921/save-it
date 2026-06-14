import type { Link } from "./types";

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** 저장 링크가 유튜브 영상 호스트인지 (youtube.com / m.youtube.com / youtu.be) */
export function isYouTubeLink(url: string): boolean {
  const host = hostOf(url);
  return host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be";
}

/** 영상 id 추출. watch?v= / youtu.be/ID / shorts/ID 처리. 실패 시 null */
export function extractVideoId(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.host.replace(/^www\./, "");
  if (host === "youtu.be") {
    return u.pathname.slice(1).split("/")[0] || null;
  }
  if (host === "youtube.com" || host === "m.youtube.com") {
    if (u.pathname === "/watch") {
      return u.searchParams.get("v");
    }
    if (u.pathname.startsWith("/shorts/")) {
      return u.pathname.slice("/shorts/".length).split("/")[0] || null;
    }
  }
  return null;
}

/** 현재 보고 있는 페이지가 유튜브 영상 시청 페이지(watch/shorts)인지 */
export function isYouTubeWatchUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.host.replace(/^www\./, "");
    if (host !== "youtube.com" && host !== "m.youtube.com") return false;
    return u.pathname === "/watch"
      ? u.searchParams.has("v")
      : u.pathname.startsWith("/shorts/");
  } catch {
    return false;
  }
}

/**
 * 저장 링크 중 유튜브 영상만 골라 추천 순서로 정렬해 상위 limit개 반환.
 * 정렬: 미열람 우선 → priority 내림차순 → 최신 저장순.
 * currentVideoId가 주어지면 그 영상은 제외(지금 보고 있는 영상).
 * 제네릭이라 folders 조인 등 Link 확장 타입도 그대로 보존한다.
 */
export function pickYouTubeRecommendations<T extends Link>(
  links: T[],
  currentVideoId: string | null,
  limit = 3,
): T[] {
  return links
    .filter((l) => isYouTubeLink(l.url))
    .filter((l) => (currentVideoId ? extractVideoId(l.url) !== currentVideoId : true))
    .sort((a, b) => {
      if (a.is_read !== b.is_read) return a.is_read ? 1 : -1;
      const pa = a.priority ?? 0;
      const pb = b.priority ?? 0;
      if (pa !== pb) return pb - pa;
      return b.created_at.localeCompare(a.created_at);
    })
    .slice(0, limit);
}
