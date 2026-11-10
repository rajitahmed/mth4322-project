/** An Actor as the front end sees it. Birth year tells same-name Actors apart. */
export interface ActorSummary {
  id: string;
  name: string;
  birthYear: number | null;
}

/** A Movie as the front end sees it. */
export interface MovieSummary {
  id: string;
  title: string;
}

/** Which end of a two-sided search: the search from Actor a or from Actor b. */
export type SearchSide = "a" | "b";

/** A Link a search tried, by id, and which end's search tried it (for the animation). */
export interface ExploredLink {
  from: string;
  movie: string;
  to: string;
  side: SearchSide;
}

/**
 * A chain between two Actors. The Distance is the answer; the chain is one
 * example: `movies[i]` links `actors[i]` and `actors[i + 1]`.
 */
export interface Chain {
  distance: number;
  actors: ActorSummary[];
  movies: MovieSummary[];
}

/** A chain found by a two-sided search, with the Links it tried (for the animation). */
export interface FoundPath extends Chain {
  found: true;
  explored: ExploredLink[];
}

/** Shortest path between two Actors, or none when they are in different Groups. */
export type ShortestPath = FoundPath | { found: false; explored: ExploredLink[] };

/** Which chain tab 3 shows: the BFS-parent chain, or the shortest chain with the highest average rating (DECISIONS D11). */
export const CHAIN_MODES = ["shortest", "best-rated"] as const;
export type ChainMode = (typeof CHAIN_MODES)[number];

/**
 * The chain from the Center to a picked Actor, with the sum and average of its
 * Movies' ratings (no average for the Center itself), or none when the Actor
 * can't be linked.
 */
export type ChainToCenter =
  | (Chain & { found: true; totalRating: number; averageRating: number | null })
  | { found: false };

/** What tab 3 shows first: Actors per Layer (Layer 0 is the Center) and how many can't be linked. */
export interface LayerSummary {
  center: ActorSummary;
  layerCounts: number[];
  unlinkedCount: number;
}

/** One page of the can't-be-linked list; `total` counts every match, not just this page. */
export interface UnlinkedPage {
  total: number;
  actors: ActorSummary[];
}

/** How many Actors a Cycle search takes (the brief: 3, up to 6). */
export const MIN_CHOSEN_ACTORS = 3;
export const MAX_CHOSEN_ACTORS = 6;

/**
 * The checks run before a Cycle search (DECISIONS D6 steps 1–2): not possible
 * because the Chosen Actors are in different Groups, or because every route
 * between two of them passes through one cut actor; otherwise they share a
 * block, and the search (next) runs inside it.
 */
export type CycleCheck =
  | { outcome: "not-possible"; reason: "different-groups" }
  | { outcome: "not-possible"; reason: "cut-actor"; cutActor: ActorSummary; between: [ActorSummary, ActorSummary] }
  | { outcome: "shares-block" };
