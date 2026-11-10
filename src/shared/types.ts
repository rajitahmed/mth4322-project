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
export interface FoundPath {
  found: true;
  distance: number;
  actors: ActorSummary[];
  movies: MovieSummary[];
  explored: ExploredLink[];
}

/** Shortest path between two Actors, or none when they are in different Groups. */
export type ShortestPath = FoundPath | { found: false; explored: ExploredLink[] };
