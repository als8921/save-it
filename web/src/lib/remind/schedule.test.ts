import { describe, it, expect } from "vitest";
import { deriveScheduleTimes } from "./schedule";

describe("deriveScheduleTimes", () => {
  it("count 1 → 아침만", () => {
    expect(deriveScheduleTimes("09:00:00", 1)).toEqual(["09:00:00"]);
  });

  it("count 2 → 아침 + 저녁", () => {
    expect(deriveScheduleTimes("09:00:00", 2)).toEqual(["09:00:00", "21:00:00"]);
  });

  it("count 3 → 아침 + 점심 + 저녁 (정렬)", () => {
    expect(deriveScheduleTimes("09:00:00", 3)).toEqual([
      "09:00:00",
      "13:00:00",
      "21:00:00",
    ]);
  });

  it("HH:MM 을 HH:MM:SS 로 정규화", () => {
    expect(deriveScheduleTimes("9:00", 1)).toEqual(["09:00:00"]);
  });

  it("daily_time 이 프리셋과 겹치면 dedupe", () => {
    expect(deriveScheduleTimes("21:00:00", 2)).toEqual(["21:00:00"]);
  });

  it("count 가 범위를 벗어나면 1로 취급", () => {
    expect(deriveScheduleTimes("09:00:00", 0)).toEqual(["09:00:00"]);
    expect(deriveScheduleTimes("09:00:00", 5)).toEqual(["09:00:00"]);
  });
});
