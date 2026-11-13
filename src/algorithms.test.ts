/**
 * ALGORITHM TEST CASES: the three operations, checked end to end through the one operations module.
 *
 *   1. Standard inputs: one small graph, drawn below, with every answer worked out by hand.
 *   2. Edge cases: same Actor twice, unlinked Actors, a lone Actor, a cut actor, no Cycle at all, unknown ids.
 *   3. Random cases: seeded random graphs, every answer compared with a brute force written here
 *      (Floyd–Warshall distances and an exhaustive Cycle search), independent of the code under test.
 *
 * Run: npx vitest run src/algorithms.test.ts
 *
 * ───────────────────────────── THE TEST GRAPH ─────────────────────────────
 * Actors A … L (ids in this order, so "lowest id" means earliest letter). Each Link is a Movie (rating).
 *
 *   Group 1 (A–G)
 *
 *        A ──Alpha 6.2── B
 *        │               │
 *     Delta 9.0       Beta 6.4          a square: A, B, C, D
 *        │               │
 *        D ──Gamma 8.0── C
 *        │
 *      Trio 7.0                         one Movie with 3 Actors: D, E, F
 *      /    \
 *     E      F ──Tail 7.5── G           F is G's only co-star (cut actor)
 *
 *   Group 2 (H–L): hubs H and I, each in a 2-Actor Movie with each of J, K, L.
 *
 *        H ── J, K, L ── I              (Movies HJ, HK, HL, IJ, IK, IL, all 7.0)
 *
 *   Group 3: M alone ("Solo" has only M in it).
 *
 * ───────────────────────────── EXPECTED ANSWERS ─────────────────────────────
 *   Largest finite shortest path: Distance 4, between B and G (the only pair that far).
 *   Shortest path:  A→G = 3 (A Delta D Trio F Tail G)   E→F = 1   A→A = 0   A→H, A→M = no path.
 *   Shortest Cycle: A,B,C = 4 (the square)   D,E,F = 3 (Trio reused)   A,B,C,D = 4
 *                   E,F,G = cut actor F      A,B,H = different Groups   J,K,L = no Cycle (only 2 hubs)
 *   Six Degrees around A:  Layer 0 A | 1 B, D | 2 C, E, F | 3 G | can't be linked H, I, J, K, L, M
 *   Chain A→C:  shortest (lowest ids) A Alpha B Beta C = 12.6 (avg 6.3)
 *               best-rated            A Delta D Gamma C = 17.0 (avg 8.5)
 */
import { describe, expect, it } from "vitest";
import type { Dataset } from "./server/dataset";
import { actorsIn, buildGraph, type Graph } from "./server/graph";
import { createOperations, UnknownActorError } from "./server/operations";
import { coStars, randomGraph } from "./server/testGraphs";
import type { ShortestPath } from "./shared/types";

const ACTORS = "ABCDEFGHIJKLM".split("");
const MOVIES: [title: string, rating: number, cast: string][] = [
  ["Alpha", 6.2, "AB"],
  ["Beta", 6.4, "BC"],
  ["Gamma", 8.0, "CD"],
  ["Delta", 9.0, "AD"],
  ["Trio", 7.0, "DEF"],
  ["Tail", 7.5, "FG"],
  ["HJ", 7.0, "HJ"],
  ["HK", 7.0, "HK"],
  ["HL", 7.0, "HL"],
  ["IJ", 7.0, "IJ"],
  ["IK", 7.0, "IK"],
  ["IL", 7.0, "IL"],
  ["Solo", 7.0, "M"],
];

const dataset: Dataset = {
  actors: ACTORS.map((id) => ({ id, name: id, birthYear: null })),
  movies: MOVIES.map(([title, rating]) => ({ id: title, title, year: null, rating, votes: 2000 })),
  credits: MOVIES.flatMap(([title, , cast]) => [...cast].map((actorId) => ({ movieId: title, actorId }))),
};
const ops = createOperations(buildGraph(dataset));

const ids = (actors: { id: string }[]) => actors.map((a) => a.id).join("");
const titles = (movies: { title: string }[]) => movies.map((m) => m.title);

describe("1. Standard inputs (the drawn graph)", () => {
  it("largest finite shortest path: Distance 4, between B and G", () => {
    const result = ops.largestPath();
    expect(result.distance).toBe(4);
    expect([result.actors[0]!.id, result.actors.at(-1)!.id]).toEqual(["B", "G"]);
  });

  it("shortest path A→G is 3: A Delta D Trio F Tail G", () => {
    const result = ops.shortestPath("A", "G");
    expect(result).toMatchObject({ found: true, distance: 3 });
    if (!result.found) return;
    expect(ids(result.actors)).toBe("ADFG");
    expect(titles(result.movies)).toEqual(["Delta", "Trio", "Tail"]);
  });

  it("shortest path E→F is 1, through the 3-Actor Movie Trio", () => {
    expect(ops.shortestPath("E", "F")).toMatchObject({ found: true, distance: 1, movies: [{ title: "Trio" }] });
  });

  it("shortest Cycle through A, B, C is 4: the square", async () => {
    const result = await ops.shortestCycle(["A", "B", "C"]);
    expect(result).toMatchObject({ outcome: "found", length: 4 });
    if (result.outcome === "found") expect([...ids(result.actors)].sort().join("")).toBe("ABCD");
  });

  it("shortest Cycle through D, E, F is 3: every Link is Trio", async () => {
    const result = await ops.shortestCycle(["D", "E", "F"]);
    expect(result).toMatchObject({ outcome: "found", length: 3 });
    if (result.outcome === "found") expect(titles(result.movies)).toEqual(["Trio", "Trio", "Trio"]);
  });

  it("shortest Cycle through A, B, C, D (k = 4) is 4", async () => {
    expect(await ops.shortestCycle(["A", "B", "C", "D"])).toMatchObject({ outcome: "found", length: 4 });
  });

  it("Six Degrees around A: Layers A | B D | C E F | G, and H–M can't be linked", () => {
    const { center, layers, unlinked } = ops.sixDegrees("A");
    expect(center.id).toBe("A");
    expect(layers.map(ids)).toEqual(["A", "BD", "CEF", "G"]);
    expect(ids(unlinked)).toBe("HIJKLM");
    expect(ops.layerSummary("A")).toMatchObject({ layerCounts: [1, 2, 3, 1], unlinkedCount: 6 });
  });

  it("chain A→C: shortest goes through B (12.6), best-rated through D (17.0)", () => {
    const shortest = ops.chainToCenter("A", "C", "shortest");
    const best = ops.chainToCenter("A", "C", "best-rated");
    if (!shortest.found || !best.found) throw new Error("expected chains");
    expect([ids(shortest.actors), shortest.distance]).toEqual(["ABC", 2]);
    expect(shortest.totalRating).toBeCloseTo(12.6);
    expect(shortest.averageRating).toBeCloseTo(6.3);
    expect([ids(best.actors), best.distance]).toEqual(["ADC", 2]);
    expect(best.totalRating).toBeCloseTo(17.0);
    expect(best.averageRating).toBeCloseTo(8.5);
  });
});

describe("2. Edge cases", () => {
  it("shortest path from an Actor to themself is 0", () => {
    expect(ops.shortestPath("A", "A")).toMatchObject({ found: true, distance: 0 });
  });

  it("no shortest path between Groups, or to a lone Actor", () => {
    expect(ops.shortestPath("A", "H").found).toBe(false);
    expect(ops.shortestPath("A", "M").found).toBe(false);
  });

  it("no Cycle across Groups", async () => {
    expect(await ops.shortestCycle(["A", "B", "H"])).toEqual({ outcome: "not-possible", reason: "different-groups" });
  });

  it("no Cycle through G: its only co-star F is a cut actor", async () => {
    expect(await ops.shortestCycle(["E", "F", "G"])).toMatchObject({ outcome: "not-possible", reason: "cut-actor", cutActor: { id: "F" } });
  });

  it("no Cycle through J, K, L: they share a block, but only 2 hubs link them", async () => {
    expect(await ops.shortestCycle(["J", "K", "L"])).toMatchObject({ outcome: "not-possible", reason: "no-cycle" });
  });

  it("the Center's own chain is just the Center, with no average rating", () => {
    expect(ops.chainToCenter("A", "A")).toMatchObject({ found: true, distance: 0, totalRating: 0, averageRating: null });
  });

  it("an Actor who can't be linked has no chain; a lone Center has only Layer 0", () => {
    expect(ops.chainToCenter("A", "M")).toEqual({ found: false });
    expect(ops.sixDegrees("M").layers.map(ids)).toEqual(["M"]);
  });

  it("a graph with one lone Actor has largest Distance 0", () => {
    const solo = createOperations(buildGraph({ actors: [dataset.actors.at(-1)!], movies: [dataset.movies.at(-1)!], credits: [{ movieId: "Solo", actorId: "M" }] }));
    expect(solo.largestPath()).toMatchObject({ distance: 0, actors: [{ id: "M" }] });
  });

  it("unknown Actor ids are rejected", async () => {
    expect(() => ops.shortestPath("A", "Z")).toThrow(UnknownActorError);
    expect(() => ops.sixDegrees("Z")).toThrow(UnknownActorError);
    await expect(ops.shortestCycle(["A", "B", "Z"])).rejects.toThrow(UnknownActorError);
  });
});

/** All-pairs Distances by Floyd–Warshall over co-stars (Infinity when unlinked). */
function allDistances(graph: Graph): number[][] {
  const n = graph.actors.length;
  const d = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : Infinity)));
  for (let a = 0; a < n; a++) for (const b of coStars(graph, a)) d[a]![b] = 1;
  for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) d[i]![j] = Math.min(d[i]![j]!, d[i]![k]! + d[k]![j]!);
  return d;
}

/** The shortest Cycle (distinct Actors, Movies may repeat) through every chosen Actor, by trying every simple Cycle from chosen[0]. */
function bruteShortestCycle(graph: Graph, chosen: number[]): number | null {
  const neighbours = graph.actors.map((_, a) => coStars(graph, a));
  const start = chosen[0]!;
  let best: number | null = null;
  const path = [start];
  const walk = (a: number) => {
    for (const b of neighbours[a]!) {
      if (b === start && path.length >= 3 && chosen.every((c) => path.includes(c))) best = Math.min(best ?? Infinity, path.length);
      if (path.includes(b)) continue;
      path.push(b);
      walk(b);
      path.pop();
    }
  };
  walk(start);
  return best;
}

/** The chain starts at a, ends at b, and every Link is a Movie both Actors are in. */
function expectValidChain(graph: Graph, result: ShortestPath, a: number, b: number) {
  if (!result.found) throw new Error("expected a chain");
  const index = new Map(graph.actors.map((x, i) => [x.id, i]));
  const movieIndex = new Map(graph.movies.map((x, i) => [x.id, i]));
  expect(index.get(result.actors[0]!.id)).toBe(a);
  expect(index.get(result.actors.at(-1)!.id)).toBe(b);
  result.movies.forEach((movie, i) => {
    const cast = actorsIn(graph, movieIndex.get(movie.id)!);
    expect(cast).toContain(index.get(result.actors[i]!.id));
    expect(cast).toContain(index.get(result.actors[i + 1]!.id));
  });
}

describe("3. Random cases (seeded, compared with brute force)", () => {
  const seeds = Array.from({ length: 30 }, (_, i) => i + 1);

  it("shortest path: same Distance as Floyd–Warshall for every pair, with a valid chain", () => {
    for (const seed of seeds) {
      const graph = randomGraph(seed, 6 + (seed % 7), 5 + (seed % 9));
      const d = allDistances(graph);
      const random = createOperations(graph);
      graph.actors.forEach((x, a) =>
        graph.actors.forEach((y, b) => {
          const result = random.shortestPath(x.id, y.id);
          expect(result.found ? result.distance : Infinity, `seed ${seed}: ${a}→${b}`).toBe(d[a]![b]);
          if (result.found) expectValidChain(graph, result, a, b);
        }),
      );
    }
  });

  it("largest path: the largest finite Distance, at the lowest-id pair", () => {
    for (const seed of seeds) {
      const graph = randomGraph(seed, 6 + (seed % 7), 5 + (seed % 9));
      const d = allDistances(graph);
      const largest = Math.max(...d.flat().filter(Number.isFinite));
      const a = d.findIndex((row) => row.includes(largest));
      const result = createOperations(graph).largestPath();
      expect([result.distance, result.actors[0]!.id, result.actors.at(-1)!.id], `seed ${seed}`).toEqual([
        largest,
        graph.actors[a]!.id,
        graph.actors[d[a]!.indexOf(largest)]!.id,
      ]);
    }
  });

  it("Six Degrees: Layer i holds exactly the Actors at Distance i; the rest can't be linked", () => {
    for (const seed of seeds) {
      const graph = randomGraph(seed, 6 + (seed % 7), 5 + (seed % 9));
      const d = allDistances(graph)[0]!;
      const { layers, unlinked } = createOperations(graph).sixDegrees(graph.actors[0]!.id);
      const at = (k: number) => graph.actors.filter((_, a) => d[a] === k).map((x) => x.id);
      expect(layers.map((layer) => layer.map((x) => x.id)), `seed ${seed}`).toEqual(layers.map((_, k) => at(k)));
      expect(unlinked.map((x) => x.id), `seed ${seed}`).toEqual(at(Infinity));
    }
  });

  it("shortest Cycle: same length as an exhaustive search (or none)", async () => {
    // ponytail: 12 Cycle queries only; each spawns a worker thread. cycleSearch.test.ts runs thousands without the worker.
    const outcomes = new Set<string>();
    for (const seed of seeds.slice(0, 12)) {
      const graph = randomGraph(seed, 7, 9);
      const chosen = [0, 1 + (seed % 3), 4 + (seed % 3)];
      const result = await createOperations(graph).shortestCycle(chosen.map((a) => graph.actors[a]!.id));
      expect(result.outcome === "found" ? result.length : null, `seed ${seed}: ${chosen}`).toBe(bruteShortestCycle(graph, chosen));
      outcomes.add(result.outcome);
    }
    expect(outcomes).toEqual(new Set(["found", "not-possible"]));
  });
});
