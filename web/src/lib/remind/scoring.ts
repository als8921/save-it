import type { ParaCategory } from "@/lib/types";
import {
  REMIND_WEIGHTS,
  PARA_WEIGHT,
  AGE_PEAK_DAYS,
  AGE_SIGMA_DAYS,
} from "./constants";

export interface ScoreInput {
  priority: number;
  paraCategory: ParaCategory | null;
  createdAt: Date;
  now: Date;
}

export function calcDailyScore(input: ScoreInput): number {
  const priorityNorm =
    Math.max(0, Math.min(2, input.priority)) / 2;

  const paraKey =
    input.paraCategory === null ? "unassigned" : input.paraCategory;
  const paraWeight =
    (PARA_WEIGHT as Record<string, number>)[paraKey] ?? PARA_WEIGHT.unassigned;

  const days =
    (input.now.getTime() - input.createdAt.getTime()) /
    (1000 * 60 * 60 * 24);
  const ageDecay = Math.exp(
    -Math.pow(days - AGE_PEAK_DAYS, 2) / (2 * Math.pow(AGE_SIGMA_DAYS, 2))
  );

  return (
    REMIND_WEIGHTS.priority * priorityNorm +
    REMIND_WEIGHTS.para * paraWeight +
    REMIND_WEIGHTS.age * ageDecay
  );
}
