import { describe, expect, it } from "vitest";
import { nextStepTime, previousStepTime, type Step, stepIndexAt } from "./steps";

const steps: Step[] = [
  { at: 0, text: "start" },
  { at: 2, text: "round 1" },
  { at: 4, text: "round 2" },
];

describe("steps", () => {
  it("tells the last step at or before t", () => {
    expect(stepIndexAt(steps, 0)).toBe(0);
    expect(stepIndexAt(steps, 1.9)).toBe(0);
    expect(stepIndexAt(steps, 2)).toBe(1);
    expect(stepIndexAt(steps, 99)).toBe(2);
    expect(stepIndexAt([{ at: 1, text: "late" }], 0)).toBe(-1);
  });

  it("steps forward to the next step's start, then to the end", () => {
    expect(nextStepTime(steps, 0, 6)).toBe(2);
    expect(nextStepTime(steps, 2, 6)).toBe(4);
    expect(nextStepTime(steps, 4, 6)).toBe(6);
    expect(nextStepTime(steps, 6, 6)).toBe(6);
  });

  it("steps back to the current step's start, or the one before when just past it", () => {
    expect(previousStepTime(steps, 3)).toBe(2);
    expect(previousStepTime(steps, 2)).toBe(0);
    expect(previousStepTime(steps, 4.2)).toBe(2);
    expect(previousStepTime(steps, 0)).toBe(0);
  });
});
