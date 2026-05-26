import { describe, it, expect } from "vitest";
import { calcDailyScore } from "./scoring";

const baseDate = new Date("2026-05-26T12:00:00Z");
const daysAgo = (n: number) =>
  new Date(baseDate.getTime() - n * 24 * 60 * 60 * 1000);

describe("calcDailyScore", () => {
  it("returns 0~1 range", () => {
    const score = calcDailyScore({
      priority: 0,
      paraCategory: "resource",
      createdAt: daysAgo(7),
      now: baseDate,
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("maximizes when priority=2, para=project, days=7", () => {
    const score = calcDailyScore({
      priority: 2,
      paraCategory: "project",
      createdAt: daysAgo(7),
      now: baseDate,
    });
    // 0.4*1 + 0.3*1 + 0.3*1 = 1.0
    expect(score).toBeCloseTo(1.0, 4);
  });

  it("priority normalization: 0/1/2 -> 0/0.5/1", () => {
    const args = {
      paraCategory: "project" as const,
      createdAt: daysAgo(7),
      now: baseDate,
    };
    const p0 = calcDailyScore({ ...args, priority: 0 });
    const p1 = calcDailyScore({ ...args, priority: 1 });
    const p2 = calcDailyScore({ ...args, priority: 2 });
    // age=peak, para=project (1.0): score = 0.4*pn + 0.3 + 0.3
    expect(p0).toBeCloseTo(0.6, 4);
    expect(p1).toBeCloseTo(0.8, 4);
    expect(p2).toBeCloseTo(1.0, 4);
  });

  it("clamps priority below 0 and above 2", () => {
    const args = {
      paraCategory: "project" as const,
      createdAt: daysAgo(7),
      now: baseDate,
    };
    const low = calcDailyScore({ ...args, priority: -5 });
    const high = calcDailyScore({ ...args, priority: 10 });
    expect(low).toBeCloseTo(0.6, 4);  // same as priority=0
    expect(high).toBeCloseTo(1.0, 4); // same as priority=2
  });

  it("treats null para_category as unassigned (0.5)", () => {
    const score = calcDailyScore({
      priority: 0,
      paraCategory: null,
      createdAt: daysAgo(7),
      now: baseDate,
    });
    // 0.4*0 + 0.3*0.5 + 0.3*1 = 0.45
    expect(score).toBeCloseTo(0.45, 4);
  });

  it("age decay peaks at 7 days", () => {
    const args = {
      priority: 2,
      paraCategory: "project" as const,
      now: baseDate,
    };
    const at0  = calcDailyScore({ ...args, createdAt: daysAgo(0)  });
    const at7  = calcDailyScore({ ...args, createdAt: daysAgo(7)  });
    const at14 = calcDailyScore({ ...args, createdAt: daysAgo(14) });
    const at30 = calcDailyScore({ ...args, createdAt: daysAgo(30) });

    expect(at7).toBeGreaterThan(at0);
    expect(at7).toBeGreaterThan(at14);
    expect(at14).toBeGreaterThan(at30);
    // at7 is exact peak: 0.4*1 + 0.3*1 + 0.3*1 = 1.0
    expect(at7).toBeCloseTo(1.0, 4);
  });

  it("age decay matches Gaussian shape", () => {
    const onlyAge = (days: number) =>
      calcDailyScore({
        priority: 0,
        paraCategory: null, // 0.5
        createdAt: daysAgo(days),
        now: baseDate,
      });
    // score = 0 + 0.15 + 0.3 * age_decay
    // days=0  -> age_decay = exp(-49/200) ≈ 0.7827
    // days=7  -> 1.0
    // days=30 -> exp(-529/200) ≈ 0.0716
    expect(onlyAge(0) - 0.15).toBeCloseTo(0.3 * 0.7827, 3);
    expect(onlyAge(7) - 0.15).toBeCloseTo(0.3 * 1.0, 3);
    expect(onlyAge(30) - 0.15).toBeCloseTo(0.3 * 0.0716, 3);
  });
});
