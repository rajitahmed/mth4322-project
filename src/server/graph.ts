import { type Csr, row, toCsr } from "./csr";
import type { Actor, Dataset, Movie } from "./dataset";
import { labelGroups } from "./groups";

/**
 * The bipartite actor–movie graph (DECISIONS D1, D13). Actors and Movies are
 * numbered by their row in the CSV files; both directions are stored as CSR.
 */
export interface Graph {
  actors: Actor[];
  movies: Movie[];
  actorMovies: Csr;
  movieActors: Csr;
  /** The Group of every Actor, numbered 0 … groupCount − 1. */
  actorGroup: Int32Array;
  groupCount: number;
}

/** Just the Links of the graph, both directions: all a search needs, and small enough to hand to a worker (D9). */
export type Links = Pick<Graph, "actorMovies" | "movieActors">;

export function buildGraph({ actors, movies, credits }: Dataset): Graph {
  const actorIndex = indexById(actors);
  const movieIndex = indexById(movies);
  const creditActors = new Int32Array(credits.length);
  const creditMovies = new Int32Array(credits.length);
  credits.forEach(({ actorId, movieId }, i) => {
    creditActors[i] = lookup(actorIndex, actorId, "Actor");
    creditMovies[i] = lookup(movieIndex, movieId, "Movie");
  });

  const actorMovies = toCsr(actors.length, creditActors, creditMovies);
  const movieActors = toCsr(movies.length, creditMovies, creditActors);
  return { actors, movies, actorMovies, movieActors, ...labelGroups(actors.length, movieActors) };
}

/** The Movies an Actor is in, lowest index first. */
export function moviesOf(graph: Links, actor: number): Int32Array {
  return row(graph.actorMovies, actor);
}

/** The Actors in a Movie, lowest index first. */
export function actorsIn(graph: Links, movie: number): Int32Array {
  return row(graph.movieActors, movie);
}

function indexById(rows: { id: string }[]): Map<string, number> {
  return new Map(rows.map((row, i) => [row.id, i]));
}

function lookup(index: Map<string, number>, id: string, kind: string): number {
  const i = index.get(id);
  if (i === undefined) throw new Error(`credits.csv names an unknown ${kind}: ${id}`);
  return i;
}
