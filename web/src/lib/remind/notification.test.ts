import { describe, it, expect } from "vitest";
import { buildReminderNotification } from "./notification";
import type { RemindCandidate } from "./picker";

function cand(
  id: string,
  title: string,
  score: number,
  url = "https://example.com/x"
): RemindCandidate {
  return {
    link: {
      id,
      user_id: "u",
      folder_id: null,
      url,
      title,
      description: null,
      priority: 0,
      is_read: false,
      created_at: "2026-06-01T00:00:00Z",
      read_at: null,
    },
    folder: { id: "f", name: "폴더", para_category: null },
    score,
  };
}

describe("buildReminderNotification", () => {
  it("후보가 없으면 null", () => {
    expect(buildReminderNotification([], [])).toBeNull();
  });

  it("최고 점수 후보를 대표로 선택", () => {
    const n = buildReminderNotification([cand("a", "A", 0.9), cand("b", "B", 0.5)], []);
    expect(n?.hero.link.id).toBe("a");
    expect(n?.payload.title).toBe("A");
  });

  it("최근 대표는 건너뛰고 다음 후보 선택", () => {
    const n = buildReminderNotification([cand("a", "A", 0.9), cand("b", "B", 0.5)], ["a"]);
    expect(n?.hero.link.id).toBe("b");
  });

  it("모든 후보가 최근 대표면 최고 점수로 폴백", () => {
    const n = buildReminderNotification(
      [cand("a", "A", 0.9), cand("b", "B", 0.5)],
      ["a", "b"]
    );
    expect(n?.hero.link.id).toBe("a");
  });

  it("본문에 남은 개수 표기", () => {
    const n = buildReminderNotification(
      [cand("a", "A", 0.9), cand("b", "B", 0.5), cand("c", "C", 0.1)],
      []
    );
    expect(n?.payload.body).toBe("저장한 링크 · 외 2개");
  });

  it("후보 1개면 개수 생략", () => {
    const n = buildReminderNotification([cand("a", "A", 0.9)], []);
    expect(n?.payload.body).toBe("저장한 링크");
  });

  it("제목이 비면 host 로 폴백", () => {
    const n = buildReminderNotification(
      [cand("a", "", 0.9, "https://news.ycombinator.com/item?id=1")],
      []
    );
    expect(n?.payload.title).toBe("news.ycombinator.com");
  });

  it("긴 제목은 60자로 트림", () => {
    const long = "가".repeat(80);
    const n = buildReminderNotification([cand("a", long, 0.9)], []);
    expect(n?.payload.title.length).toBe(60);
    expect(n?.payload.title.endsWith("…")).toBe(true);
  });

  it("url 은 항상 /today", () => {
    const n = buildReminderNotification([cand("a", "A", 0.9)], []);
    expect(n?.payload.url).toBe("/today");
  });
});
