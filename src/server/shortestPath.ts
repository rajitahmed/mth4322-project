import type { SearchSide } from "../shared/types";
import { chainTo, expandFrontier, type Search, startSearch } from "./bfs";
import type { Graph } from "./graph";

/** A Link the search tried, by index, and which end's search tried it. */
export interface ExploredLink {
  from: number;
  movie: number;
  to: number;
  side: SearchSide;
}

interface Side {
  name: SearchSide;
  search: Search;
  frontier: Int32Array;
}

/** One round of the search: one side reached every Actor one Link further from its end, each by one Link. */
export interface Round {
  side: SearchSide;
  /** Links from this side's end to the Actors reached this round. */
  depth: number;
  links: ExploredLink[];
}

export type PathResult =
  | { found: true; distance: number; actors: number[]; movies: number[]; rounds: Round[] }
  | { found: false; rounds: Round[] };

/**
 * Shortest path between two Actors by bidirectional BFS (DECISIONS D4, D16).
 * Each round the side with fewer Actors in its frontier expands its whole frontier by one Link;
 * meetings are checked as Actors are discovered, and the shortest meeting in
 * that step wins (ties: lowest index). An emptied frontier means no path.
 */
export function shortestPath(graph: Graph, a: number, b: number): PathResult {
  const sideA: Side = { name: "a", search: startSearch(graph, a), frontier: Int32Array.of(a) };
  const sideB: Side = { name: "b", search: startSearch(graph, b), frontier: Int32Array.of(b) };
  const rounds: Round[] = [];
  let meeting = a === b ? a : -1;

  while (meeting === -1 && sideA.frontier.length > 0 && sideB.frontier.length > 0) {
    const [side, other] = sideA.frontier.length <= sideB.frontier.length ? [sideA, sideB] : [sideB, sideA];
    side.frontier = expandFrontier(graph, side.search, side.frontier);
    const links = Array.from(side.frontier, (actor) => discoveredLink(side.search, actor, side.name));
    if (links.length > 0) rounds.push({ side: side.name, depth: side.search.distance[links[0]!.to]!, links });
    meeting = closestMeeting(side.search, other.search, side.frontier);
  }
  if (meeting === -1) return { found: false, rounds };

  const fromA = chainTo(sideA.search, meeting);
  const fromB = chainTo(sideB.search, meeting);
  return {
    found: true,
    distance: fromA.movies.length + fromB.movies.length,
    actors: [...fromA.actors, ...fromB.actors.reverse().slice(1)],
    movies: [...fromA.movies, ...fromB.movies.reverse()],
    rounds,
  };
}

function discoveredLink(search: Search, actor: number, side: SearchSide): ExploredLink {
  return { from: search.parentActor[actor]!, movie: search.parentMovie[actor]!, to: actor, side };
}

/** The newly reached Actor the other side has also reached, with the shortest total; lowest index on ties. */
function closestMeeting(search: Search, other: Search, reached: Int32Array): number {
  let best = -1;
  let bestLength = Infinity;
  for (const actor of reached) {
    if (other.distance[actor] === -1) continue;
    const length = search.distance[actor]! + other.distance[actor]!;
    if (length < bestLength) [best, bestLength] = [actor, length];
  }
  return best;
}
