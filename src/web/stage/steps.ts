/** A scene's narration: what the algorithm is doing from `at` seconds into the run. Steps are in time order. */
export interface Step {
  at: number;
  text: string;
}

/** Steps closer than this (seconds) count as the same moment, so stepping never stalls on a rounding error. */
const NEAR = 1e-6;
/** How far before the next step a shown step stops, so its own work is drawn and the next has not begun. */
const BEFORE_NEXT = 0.01;

/** The index of the step being told at `t`: the last one at or before it; -1 before the first. */
export function stepIndexAt(steps: Step[], t: number): number {
  let index = -1;
  steps.forEach((step, i) => {
    if (step.at <= t + NEAR) index = i;
  });
  return index;
}

/**
 * Where stepping to step `i` stops: just before the next step starts, so the picture shows what step i
 * did (D29). Past the last step, it is the end of the run, `end`.
 */
export function stepEnd(steps: Step[], i: number, end: number): number {
  if (i >= steps.length) return end;
  const next = steps[i + 1]?.at ?? end;
  return Math.max(steps[i]!.at, next - BEFORE_NEXT);
}
