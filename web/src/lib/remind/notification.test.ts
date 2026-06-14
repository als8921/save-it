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
    expect(n?.payload.body).toBe("A 외 1개");
  });

  it("제목은 고정 헤드라인", () => {
    const n = buildReminderNotification([cand("a", "A", 0.9)], []);
    expect(n?.payload.title).toBe("다시 볼 링크가 있어요!");
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

  it("본문에 대표 제목 + 남은 개수 표기", () => {
    const n = buildReminderNotification(
      [cand("a", "A", 0.9), cand("b", "B", 0.5), cand("c", "C", 0.1)],
      []
    );
    expect(n?.payload.body).toBe("A 외 2개");
  });

  it("후보 1개면 개수 생략", () => {
    const n = buildReminderNotification([cand("a", "A", 0.9)], []);
    expect(n?.payload.body).toBe("A");
  });

  it("제목이 비면 host 로 폴백", () => {
    const n = buildReminderNotification(
      [cand("a", "", 0.9, "https://news.ycombinator.com/item?id=1")],
      []
    );
    expect(n?.payload.body).toBe("news.ycombinator.com");
  });

  it("긴 대표 제목은 60자로 트림", () => {
    const long = "가".repeat(80);
    const n = buildReminderNotification([cand("a", long, 0.9)], []);
    expect(n?.payload.body.length).toBe(60);
    expect(n?.payload.body.endsWith("…")).toBe(true);
  });

  it("긴 이모지 제목도 깨지지 않게 트림", () => {
    const n = buildReminderNotification([cand("a", "😀".repeat(80), 0.9)], []);
    const body = n!.payload.body;
    expect([...body].length).toBe(60);
    expect(body.endsWith("…")).toBe(true);
    // 마지막 문자(… 직전)가 온전한 이모지인지: 깨진 반쪽 surrogate가 아님
    expect(body.codePointAt([...body].length - 2)).toBe("😀".codePointAt(0));
  });

  it("url 은 항상 /today", () => {
    const n = buildReminderNotification([cand("a", "A", 0.9)], []);
    expect(n?.payload.url).toBe("/today");
  });
});
