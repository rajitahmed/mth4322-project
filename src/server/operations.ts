import type { ActorSummary } from "../shared/types";
import { createActorSearch } from "./actorSearch";
import { type Graph, moviesOf } from "./graph";

export const DEFAULT_SEARCH_LIMIT = 10;
export const MAX_SEARCH_LIMIT = 50;

/**
 * The one module behind which every operation sits. It takes the graph as its
 * only input; the API and the tests both go through it.
 */
export function createOperations(graph: Graph) {
  const movieCounts = graph.actors.map((_, a) => moviesOf(graph, a).length);
  const findActors = createActorSearch(
    graph.actors.map((a) => a.name),
    movieCounts,
  );
  return {
    /** Actors whose name has a word starting with the query, best match first. */
    searchActors(query: string, limit = DEFAULT_SEARCH_LIMIT): ActorSummary[] {
      return findActors(query, limit).map((a) => graph.actors[a]!);
    },
  };
}

export type Operations = ReturnType<typeof createOperations>;
