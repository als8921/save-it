import { describe, it, expect } from "vitest";
import { isYouTubeLink, isYouTubeWatchUrl, extractVideoId } from "./youtube";

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
