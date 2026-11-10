import { type Search, searchLayers } from "./bfs";
import type { Graph } from "./graph";

/**
 * Everything Six Degrees needs about one Center (DECISIONS D10, D18): one full
 * BFS from it. Layer i holds the Actors at Distance i, lowest index first; the
 * Actors it never reaches (everyone outside the Center's Group) can't be linked.
 * The search's parents give each reached Actor's shortest-link chain (`chainTo`).
 */
export interface CenterLayers {
  search: Search;
  layers: Int32Array[];
  unlinked: Int32Array;
}

export function layersAround(graph: Graph, center: number): CenterLayers {
  const { search, layers } = searchLayers(graph, center);
  const unlinked: number[] = [];
  search.distance.forEach((d, actor) => d === -1 && unlinked.push(actor));
  return { search, layers, unlinked: Int32Array.from(unlinked) };
}
