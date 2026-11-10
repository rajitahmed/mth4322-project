/** What the Cycle animation plays, built from the search's answer. */
import type { ActorSummary, Link, Names, ShortestCycle } from "../../shared/types";

/** How the search ended: a Cycle, or why there is none. */
export type CycleOutcome = "found" | "different-groups" | "cut-actor" | "no-cycle";

/** A Cycle search to animate (DECISIONS D8, D24, D27). */
export interface CycleRun {
  outcome: CycleOutcome;
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
  /** The name of every Actor and Movie the run shows, by id. */
  names: Names;
}

/** What the animation plays for `cycle`, searched for the `chosen` Actors. */
export function cycleRunOf(cycle: ShortestCycle, chosen: ActorSummary[]): CycleRun {
  const names: Names = "names" in cycle ? { ...cycle.names } : {};
  const named = (actors: ActorSummary[]) => actors.forEach((a) => (names[a.id] = a.name));
  named(chosen);
  const ids = chosen.map((a) => a.id);
  const run: CycleRun = { outcome: "found", chosen: ids, circle: ids, movies: null, rejected: [], moreRejected: 0, cut: null, names };
  if (cycle.outcome === "found") {
    const { actors, movies, rejected, moreRejected } = cycle;
    named(actors);
    return { ...run, circle: actors.map((a) => a.id), movies: movies.map((m) => m.title), rejected, moreRejected };
  }
  if (cycle.reason === "no-cycle") return { ...run, outcome: "no-cycle", rejected: cycle.rejected, moreRejected: cycle.moreRejected };
  if (cycle.reason === "cut-actor") {
    named([cycle.cutActor, ...cycle.between]);
    return { ...run, outcome: "cut-actor", cut: { actor: cycle.cutActor.id, between: [cycle.between[0].id, cycle.between[1].id] } };
  }
  return { ...run, outcome: "different-groups" };
}
