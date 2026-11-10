/** What the Cycle animation plays, built from the search's answer. */
import type { Link, ShortestCycle } from "../../shared/types";

/** A Cycle search to animate (DECISIONS D8, D24). */
export interface CycleRun {
  /** The Chosen Actors, as entered. */
  chosen: string[];
  /** The Actors on the circle, in order: the Cycle's, or the Chosen Actors' when there is none. */
  circle: string[];
  /** The Movie of each circle Link (`circle[i]` to `circle[i + 1]`, the last back to `circle[0]`); null when no Cycle was found. */
  movies: string[] | null;
  /** The final pass's rejected branches, in the order tried, and how many more were not sent. */
  rejected: Link[];
  moreRejected: number;
  /** For "cut actor": the Actor every route passes through, and the pair it splits. */
  cut: { actor: string; between: [string, string] } | null;
}

/** What the animation plays for `cycle`, searched for the `chosen` Actor ids. */
export function cycleRunOf(cycle: ShortestCycle, chosen: string[]): CycleRun {
  const run: CycleRun = { chosen, circle: chosen, movies: null, rejected: [], moreRejected: 0, cut: null };
  if (cycle.outcome === "found") {
    const { actors, movies, rejected, moreRejected } = cycle;
    return { ...run, circle: actors.map((a) => a.id), movies: movies.map((m) => m.title), rejected, moreRejected };
  }
  if (cycle.reason === "no-cycle") return { ...run, rejected: cycle.rejected, moreRejected: cycle.moreRejected };
  if (cycle.reason === "cut-actor") return { ...run, cut: { actor: cycle.cutActor.id, between: [cycle.between[0].id, cycle.between[1].id] } };
  return run;
}
