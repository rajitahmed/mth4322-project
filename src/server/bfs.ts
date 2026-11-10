import { actorsIn, type Graph, moviesOf } from "./graph";

/**
 * One breadth-first search on the actor–movie graph (DECISIONS D2, D16). The only
 * BFS in the codebase: every operation drives it one Link at a time with
 * `expandFrontier`, so a single search and a two-sided search share the same code.
 */
export interface Search {
  /** Distance in Links from the start Actor, or -1 if not reached yet. */
  distance: Int32Array;
  /** The Actor and Movie each reached Actor was discovered through (-1 for the start Actor). */
  parentActor: Int32Array;
  parentMovie: Int32Array;
  /** Movies already expanded: each Movie releases its Actors once per search. */
  movieSeen: Uint8Array;
}

export function startSearch(graph: Graph, start: number): Search {
  const search: Search = {
    distance: new Int32Array(graph.actors.length).fill(-1),
    parentActor: new Int32Array(graph.actors.length).fill(-1),
    parentMovie: new Int32Array(graph.actors.length).fill(-1),
    movieSeen: new Uint8Array(graph.movies.length),
  };
  search.distance[start] = 0;
  return search;
}

/**
 * Moves the search out by one Link: Actor → Movie → Actor. Returns the newly
 * reached Actors, lowest index first. Frontier Actors and their Movies are
 * walked in index order, so each Actor's parent is the lowest-index one.
 */
export function expandFrontier(graph: Graph, search: Search, frontier: Int32Array): Int32Array {
  const next: number[] = [];
  for (const actor of frontier) {
    for (const movie of moviesOf(graph, actor)) {
      if (search.movieSeen[movie]) continue;
      search.movieSeen[movie] = 1;
      for (const costar of actorsIn(graph, movie)) {
        if (search.distance[costar] !== -1) continue;
        search.distance[costar] = search.distance[actor]! + 1;
        search.parentActor[costar] = actor;
        search.parentMovie[costar] = movie;
        next.push(costar);
      }
    }
  }
  return Int32Array.from(next).sort();
}

/** A chain by index: `movies[i]` links `actors[i]` and `actors[i + 1]`. */
export interface IndexChain {
  actors: number[];
  movies: number[];
}

/** For each Actor, the Actor and Movie it was reached through (-1 for the start Actor). */
export type Parents = Pick<Search, "parentActor" | "parentMovie">;

/**
 * The chain from the start Actor to a reached Actor: Actors and the Movies
 * linking them, walked back through any parents (a search's, or the best-rated choices).
 */
export function chainTo(parents: Parents, actor: number): IndexChain {
  const actors = [actor];
  const movies: number[] = [];
  for (let a = actor; parents.parentActor[a] !== -1; a = parents.parentActor[a]!) {
    movies.push(parents.parentMovie[a]!);
    actors.push(parents.parentActor[a]!);
  }
  return { actors: actors.reverse(), movies: movies.reverse() };
}

/**
 * Runs a whole search from one Actor: Layer i holds the Actors at Distance i,
 * lowest index first. The last Layer is the farthest one.
 */
export function searchLayers(graph: Graph, start: number): { search: Search; layers: Int32Array[] } {
  const search = startSearch(graph, start);
  const layers: Int32Array[] = [Int32Array.of(start)];
  for (let next = expandFrontier(graph, search, layers[0]!); next.length > 0; next = expandFrontier(graph, search, next)) {
    layers.push(next);
  }
  return { search, layers };
}
