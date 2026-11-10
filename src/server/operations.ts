import type { ActorSummary, FoundPath, MovieSummary, ShortestPath } from "../shared/types";
import { createActorSearch } from "./actorSearch";
import { type Graph, moviesOf } from "./graph";
import { largestPath } from "./largestPath";
import { shortestPath } from "./shortestPath";

export const DEFAULT_SEARCH_LIMIT = 10;
export const MAX_SEARCH_LIMIT = 50;

/** Thrown for an Actor id that is not in the data. */
export class UnknownActorError extends Error {
  constructor(id: string) {
    super(`Unknown Actor: ${id}`);
  }
}

/**
 * The one module behind which every operation sits. It takes the graph as its
 * only input; the API and the tests both go through it. The largest finite
 * shortest path is computed here, once, when the module is created (DECISIONS D5).
 */
export function createOperations(graph: Graph) {
  const movieCounts = graph.actors.map((_, a) => moviesOf(graph, a).length);
  const findActors = createActorSearch(
    graph.actors.map((a) => a.name),
    movieCounts,
  );
  const actorIndex = new Map(graph.actors.map((actor, i) => [actor.id, i]));
  const indexOf = (id: string) => {
    const i = actorIndex.get(id);
    if (i === undefined) throw new UnknownActorError(id);
    return i;
  };
  const actorAt = (i: number): ActorSummary => graph.actors[i]!;
  const movieAt = (i: number): MovieSummary => {
    const { id, title } = graph.movies[i]!;
    return { id, title };
  };

  /** Bidirectional BFS between two Actor indices, mapped to ids for the front end. */
  const pathBetween = (a: number, b: number): ShortestPath => {
    const result = shortestPath(graph, a, b);
    const explored = result.explored.map(({ from, movie, to, side }) => ({
      from: actorAt(from).id,
      movie: movieAt(movie).id,
      to: actorAt(to).id,
      side,
    }));
    if (!result.found) return { found: false, explored };
    return {
      found: true,
      distance: result.distance,
      actors: result.actors.map(actorAt),
      movies: result.movies.map(movieAt),
      explored,
    };
  };

  const farthestPair = largestPath(graph);
  const farthestChain = pathBetween(farthestPair.a, farthestPair.b);
  if (!farthestChain.found) throw new Error("The largest path's endpoints must share a Group");

  return {
    /** Actors whose name has a word starting with the query, best match first. */
    searchActors(query: string, limit = DEFAULT_SEARCH_LIMIT): ActorSummary[] {
      return findActors(query, limit).map(actorAt);
    },

    /** The Distance between two Actors, one shortest chain, and the Links tried on the way. */
    shortestPath(a: string, b: string): ShortestPath {
      return pathBetween(indexOf(a), indexOf(b));
    },

    /**
     * The largest finite shortest path in the whole database: its Distance, the
     * lowest-id pair that far apart (lower id first), and their chain, with the Links a bidirectional BFS
     * between them tries (for the animation). Computed at startup.
     */
    largestPath(): FoundPath {
      return farthestChain;
    },
  };
}

export type Operations = ReturnType<typeof createOperations>;
