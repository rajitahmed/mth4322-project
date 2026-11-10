import { describe, expect, it } from "vitest";
import { findBlocks, sharedBlock } from "./blocks";
import { type IndexCycleSearch, MAX_REJECTED, shortestCycleIn } from "./cycleSearch";
import { actorsIn, type Graph } from "./graph";
import { coStars, graphOf, randomGraph } from "./testGraphs";

/** Runs the search the way the operations module does: inside the block the checks found. */
function search(graph: Graph, chosen: number[]): IndexCycleSearch {
  const blocks = findBlocks(graph);
  const block = sharedBlock(blocks, chosen);
  if (block === null) throw new Error("the Chosen Actors must share a block");
  return shortestCycleIn({ links: graph, actorBlocks: blocks.actorBlocks, block, chosen });
}

/**
 * The baseline, by brute force: every simple cycle through `start`, as the
 * shortest length seen for each set of Actors on it (a bitmask).
 */
function naiveCycles(graph: Graph, start: number): Map<number, number> {
  const shortest = new Map<number, number>();
  const path = [start];
  const walk = (v: number, mask: number) => {
    for (const w of coStars(graph, v)) {
      if (w === start && path.length >= 3) {
        shortest.set(mask, Math.min(shortest.get(mask) ?? Infinity, path.length));
      } else if (!(mask & (1 << w))) {
        path.push(w);
        walk(w, mask | (1 << w));
        path.pop();
      }
    }
  };
  walk(start, 1 << start);
  return shortest;
}

/** The shortest of the brute-force cycles that holds every Chosen Actor, or null. */
function naiveShortestCycle(cycles: Map<number, number>, chosen: number[]): number | null {
  const want = chosen.reduce((mask, c) => mask | (1 << c), 0);
  let best: number | null = null;
  for (const [mask, length] of cycles) if ((mask & want) === want) best = Math.min(best ?? Infinity, length);
  return best;
}

/** All Chosen Actors present, Chosen Actor #1 first, no Actor repeated, every Link a Movie both Actors are in, and it closes. */
function expectValidCycle(graph: Graph, chosen: number[], result: IndexCycleSearch) {
  if (!result.found) throw new Error("expected a Cycle");
  const { actors, movies } = result;
  expect(actors[0]).toBe(chosen[0]);
  for (const c of chosen) expect(actors).toContain(c);
  expect(new Set(actors).size).toBe(actors.length);
  expect(movies).toHaveLength(actors.length);
  movies.forEach((movie, i) => {
    const cast = actorsIn(graph, movie);
    expect(cast).toContain(actors[i]);
    expect(cast).toContain(actors[(i + 1) % actors.length]); // the last Link closes back to Chosen Actor #1
  });
}

describe("shortestCycleIn (IDA* inside the shared block)", () => {
  it("agrees with brute force on every 3 and 4 Actors sharing a block, in many random graphs", () => {
    const compared = { found: 0, none: 0 };
    for (let seed = 1; seed <= 60; seed++) {
      const graph = randomGraph(seed, 6 + (seed % 5), 6 + (seed % 10));
      const blocks = findBlocks(graph);
      const n = graph.actors.length;
      const cyclesFrom = graph.actors.map((_, a) => naiveCycles(graph, a));
      for (let a = 0; a < n; a++) {
        for (let b = a + 1; b < n; b++) {
          for (let c = b + 1; c < n; c++) {
            for (const chosen of [[a, b, c], [c, a, b], ...(c + 1 < n ? [[a, b, c, c + 1]] : [])]) {
              if (sharedBlock(blocks, chosen) === null) continue;
              const result = search(graph, chosen);
              const expected = naiveShortestCycle(cyclesFrom[chosen[0]!]!, chosen);
              expect(result.found ? result.actors.length : null, `seed ${seed}: ${chosen}`).toBe(expected);
              if (result.found) expectValidCycle(graph, chosen, result);
              compared[result.found ? "found" : "none"]++;
            }
          }
        }
      }
    }
    expect(compared.found).toBeGreaterThan(2000);
    expect(compared.none).toBeGreaterThan(20);
  });

  it("reuses one Movie for every Link when that is shortest", () => {
    // Movie 0 = {0, 1, 2}; a longer way round through Movies 1–3 and Actor 3.
    const graph = graphOf(4, [[0, 1, 2], [0, 3], [3, 1], [1, 2]]);
    const result = search(graph, [0, 1, 2]);
    expectValidCycle(graph, [0, 1, 2], result);
    expect(result).toMatchObject({ found: true, actors: [0, 1, 2], movies: [0, 0, 0] });
  });

  it("finds the k = 6 ring", () => {
    const graph = graphOf(6, [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]]);
    const result = search(graph, [0, 1, 2, 3, 4, 5]);
    expectValidCycle(graph, [0, 1, 2, 3, 4, 5], result);
    expect(result).toMatchObject({ found: true, actors: [0, 1, 2, 3, 4, 5], movies: [0, 1, 2, 3, 4, 5] });
  });

  it("is not found when the Actors share a block but no Cycle exists (K₂,₃: 3 Actors, only 2 hubs)", () => {
    // Actors 0, 1, 2 are each linked only to the hubs 3 and 4.
    const graph = graphOf(5, [[0, 3], [0, 4], [1, 3], [1, 4], [2, 3], [2, 4]]);
    expect(search(graph, [0, 1, 2])).toMatchObject({ found: false });
  });

  it("stops as soon as a pass rejects nothing, long before the budget reaches the block size (K₂,₃₀₀)", () => {
    // 300 Actors each linked only to the hubs 0 and 1: no simple path is longer than 4 Links, so the pass
    // at L = 10 rejects nothing. Without the early stop, ~290 more identical passes run.
    const others = Array.from({ length: 300 }, (_, i) => 2 + i);
    const graph = graphOf(302, others.flatMap((a) => [[a, 0], [a, 1]]));
    const started = performance.now();
    expect(search(graph, [2, 3, 4])).toEqual({ found: false, rejected: [], moreRejected: 0 });
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it("records the final pass's pruned branches in the order tried (algorithms.md §5.5)", () => {
    // Ann 0, Bob 1, Dan 2, Cat 3. Heat = {Ann, Bob, Cat}, Ronin = {Bob, Dan}, Tenet = {Dan, Cat}.
    const graph = graphOf(4, [[0, 1, 3], [1, 2], [2, 3]]);
    const result = search(graph, [0, 1, 3]);
    expect(result).toEqual({
      found: true,
      actors: [0, 1, 3],
      movies: [0, 0, 0],
      rejected: [{ from: 1, movie: 1, to: 2 }], // Bob → Dan: 2 + h(Dan, {Cat}) = 4 > 3
      moreRejected: 0,
    });
  });

  it("keeps at most MAX_REJECTED pruned branches and counts the rest", () => {
    // Chosen 400, 401, 402 share Movie 0; Actors 0–399 share Movie 1 with 400 and 401, and are
    // pruned from both: 2 × 400 branches before the Cycle closes.
    const extras = Array.from({ length: 400 }, (_, i) => i);
    const graph = graphOf(403, [[400, 401, 402], [...extras, 400, 401]]);
    const result = search(graph, [400, 401, 402]);
    expect(result).toMatchObject({ found: true, actors: [400, 401, 402], moreRejected: 800 - MAX_REJECTED });
    expect(result.rejected).toHaveLength(MAX_REJECTED);
    expect(result.rejected.slice(0, 2)).toEqual([
      { from: 400, movie: 1, to: 0 },
      { from: 400, movie: 1, to: 1 },
    ]);
  });
});
