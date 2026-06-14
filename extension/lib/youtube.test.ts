import { describe, it, expect } from "vitest";
import {
  isYouTubeLink,
  isYouTubeWatchUrl,
  extractVideoId,
  pickYouTubeRecommendations,
} from "./youtube";
import type { Link } from "./types";

function mk(partial: Partial<Link> & { id: string; url?: string }): Link {
  return {
    id: partial.id,
    user_id: "u",
    folder_id: null,
    url: partial.url ?? `https://www.youtube.com/watch?v=${partial.id}`,
    title: partial.title ?? "t",
    description: null,
    priority: partial.priority ?? 0,
    is_read: partial.is_read ?? false,
    created_at: partial.created_at ?? "2026-01-01T00:00:00Z",
    read_at: null,
  };
}

describe("isYouTubeLink", () => {
  it("youtube 호스트를 인식한다", () => {
    expect(isYouTubeLink("https://www.youtube.com/watch?v=abc")).toBe(true);
    expect(isYouTubeLink("https://youtu.be/abc")).toBe(true);
    expect(isYouTubeLink("https://m.youtube.com/watch?v=abc")).toBe(true);
    expect(isYouTubeLink("https://youtube.com/shorts/abc")).toBe(true);
  });
  it("비유튜브 링크는 거른다", () => {
    expect(isYouTubeLink("https://vimeo.com/123")).toBe(false);
    expect(isYouTubeLink("https://example.com/youtube.com")).toBe(false);
    expect(isYouTubeLink("not a url")).toBe(false);
  });
});

describe("extractVideoId", () => {
  it("watch URL에서 추출", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s")).toBe("dQw4w9WgXcQ");
  });
  it("youtu.be 단축 URL에서 추출", () => {
    expect(extractVideoId("https://youtu.be/dQw4w9WgXcQ?si=x")).toBe("dQw4w9WgXcQ");
  });
  it("shorts URL에서 추출", () => {
    expect(extractVideoId("https://www.youtube.com/shorts/abc123")).toBe("abc123");
  });
  it("영상이 아니면 null", () => {
    expect(extractVideoId("https://www.youtube.com/")).toBe(null);
    expect(extractVideoId("https://www.youtube.com/results?search_query=x")).toBe(null);
    expect(extractVideoId("nope")).toBe(null);
  });
});

describe("isYouTubeWatchUrl", () => {
  it("youtube 도메인의 watch/shorts는 true", () => {
    expect(isYouTubeWatchUrl("https://www.youtube.com/watch?v=abc")).toBe(true);
    expect(isYouTubeWatchUrl("https://m.youtube.com/watch?v=abc")).toBe(true);
    expect(isYouTubeWatchUrl("https://www.youtube.com/shorts/abc")).toBe(true);
  });
  it("watch가 아니면 false", () => {
    expect(isYouTubeWatchUrl("https://www.youtube.com/")).toBe(false);
    expect(isYouTubeWatchUrl("https://youtu.be/abc")).toBe(false);
    expect(isYouTubeWatchUrl("https://vimeo.com/watch?v=abc")).toBe(false);
  });
});

describe("pickYouTubeRecommendations", () => {
  it("비유튜브 링크를 거른다", () => {
    const links = [mk({ id: "a" }), mk({ id: "b", url: "https://vimeo.com/1" })];
    expect(pickYouTubeRecommendations(links, null).map((l) => l.id)).toEqual(["a"]);
  });
  it("현재 보는 영상을 제외한다", () => {
    const links = [
      mk({ id: "a", url: "https://youtu.be/CUR" }),
      mk({ id: "b", url: "https://www.youtube.com/watch?v=OTHER" }),
    ];
    expect(pickYouTubeRecommendations(links, "CUR").map((l) => l.id)).toEqual(["b"]);
  });
  it("미열람 → 우선도 → 최신 순으로 정렬한다", () => {
    const links = [
      mk({ id: "read", is_read: true, priority: 2, url: "https://youtu.be/read" }),
      mk({ id: "low", priority: 0, created_at: "2026-01-01T00:00:00Z", url: "https://youtu.be/low" }),
      mk({ id: "high", priority: 2, created_at: "2026-01-01T00:00:00Z", url: "https://youtu.be/high" }),
      mk({ id: "newer", priority: 0, created_at: "2026-02-01T00:00:00Z", url: "https://youtu.be/newer" }),
    ];
    expect(pickYouTubeRecommendations(links, null, 10).map((l) => l.id)).toEqual([
      "high",
      "newer",
      "low",
      "read",
    ]);
  });
  it("limit만큼만 반환한다", () => {
    const links = ["a", "b", "c", "d"].map((id) => mk({ id, url: `https://youtu.be/${id}` }));
    expect(pickYouTubeRecommendations(links, null, 3)).toHaveLength(3);
  });
});
