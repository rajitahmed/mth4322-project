/** A scene's narration: what the algorithm is doing from `at` seconds into the run. Steps are in time order. */
export interface Step {
  at: number;
  text: string;
}

/** Steps closer than this (seconds) count as the same moment, so stepping never stalls on a rounding error. */
const NEAR = 1e-6;

/** The index of the step being told at `t`: the last one at or before it; -1 before the first. */
export function stepIndexAt(steps: Step[], t: number): number {
  let index = -1;
  steps.forEach((step, i) => {
    if (step.at <= t + NEAR) index = i;
  });
  return index;
}

/** When the step after the one at `t` starts; `end` when there is none. */
export function nextStepTime(steps: Step[], t: number, end: number): number {
  return steps.find((step) => step.at > t + NEAR && step.at < end)?.at ?? end;
}

/** When the step before the one at `t` starts (the run's start before the second step). */
export function previousStepTime(steps: Step[], t: number): number {
  const current = stepIndexAt(steps, t);
  // Just after a step starts, going back means the one before it, as on a music player.
  const back = current >= 0 && t - steps[current]!.at > 0.5 ? current : current - 1;
  return back >= 0 ? steps[back]!.at : 0;
}
