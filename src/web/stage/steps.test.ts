import { describe, expect, it } from "vitest";
import { type Step, stepEnd, stepIndexAt } from "./steps";

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

  it("stops a step just before the next one starts, so its own work is drawn and it is still the step told", () => {
    expect(stepEnd(steps, 0, 6)).toBeCloseTo(1.99);
    expect(stepIndexAt(steps, stepEnd(steps, 0, 6))).toBe(0);
    expect(stepEnd(steps, 2, 6)).toBeCloseTo(5.99);
    expect(stepEnd(steps, 3, 6)).toBe(6);
  });

  it("never stops a step before it starts", () => {
    expect(stepEnd([{ at: 1, text: "a" }, { at: 1, text: "b" }], 0, 5)).toBe(1);
  });
});
