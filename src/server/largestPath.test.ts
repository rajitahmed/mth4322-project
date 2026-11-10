import { describe, expect, it } from "vitest";
import { searchLayers } from "./bfs";
import { buildGraph, type Graph } from "./graph";
import { type LargestPath, largestPath } from "./largestPath";

/**
 * The baseline iFUB must agree with (algorithms.md §3.1): BFS from every Actor,
 * keep the largest Distance and, among pairs that far apart, the lowest-id pair.
 */
function naiveLargest(graph: Graph): LargestPath {
  let best: LargestPath = { distance: -1, a: -1, b: -1 };
  for (let x = 0; x < graph.actors.length; x++) {
    const { layers } = searchLayers(graph, x);
    for (const y of layers.at(-1)!) {
      const pair = { distance: layers.length - 1, a: Math.min(x, y), b: Math.max(x, y) };
      const lower = pair.a < best.a || (pair.a === best.a && pair.b < best.b);
      if (pair.distance > best.distance || (pair.distance === best.distance && lower)) best = pair;
    }
  }
  return best;
}

/** A small random graph: `movies` Movies, each with 2–4 Actors picked from `actors` (seeded, so runs repeat). */
function randomGraph(seed: number, actors: number, movies: number): Graph {
  let state = seed;
  const random = (n: number) => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state % n;
  };
  const actorIds = Array.from({ length: actors }, (_, i) => `nm${i}`);
  const credits = Array.from({ length: movies }, (_, m) => {
    const cast = new Set(Array.from({ length: 2 + random(3) }, () => actorIds[random(actors)]!));
    return [...cast].map((actorId) => ({ movieId: `tt${m}`, actorId }));
  }).flat();
  return buildGraph({
    actors: actorIds.map((id) => ({ id, name: id, birthYear: null })),
    movies: Array.from({ length: movies }, (_, m) => ({ id: `tt${m}`, title: `${m}`, year: null, rating: 7, votes: 2000 })),
    credits,
  });
}

describe("largestPath (iFUB with a 4-sweep start)", () => {
  it("matches a BFS from every Actor on many random graphs with several Groups: same Distance, same lowest-id pair", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const graph = randomGraph(seed, 10 + (seed % 30), 5 + (seed % 25));
      expect(largestPath(graph), `seed ${seed}`).toEqual(naiveLargest(graph));
    }
  });

  it("returns endpoints in the same Group, at exactly that Distance", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const graph = randomGraph(seed, 25, 15);
      const { distance, a, b } = largestPath(graph);
      expect(graph.actorGroup[a]).toBe(graph.actorGroup[b]);
      expect(searchLayers(graph, a).search.distance[b]).toBe(distance);
    }
  });

  it("gives Distance 0 when no two Actors are linked", () => {
    const graph = buildGraph({
      actors: [{ id: "nm1", name: "Solo", birthYear: null }],
      movies: [{ id: "tt1", title: "One", year: null, rating: 7, votes: 2000 }],
      credits: [{ movieId: "tt1", actorId: "nm1" }],
    });
    expect(largestPath(graph)).toEqual({ distance: 0, a: 0, b: 0 });
  });
});
