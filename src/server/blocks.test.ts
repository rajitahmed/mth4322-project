import { describe, expect, it } from "vitest";
import { cutActorBetween, findBlocks, sharedBlock } from "./blocks";
import { buildGraph, type Graph } from "./graph";
import { loadDataset } from "./dataset";
import { coStars, graphOf, randomGraph } from "./testGraphs";

/** Whether a reaches b in the actor graph without passing through `removed`. */
function connectedWithout(graph: Graph, a: number, b: number, removed: number): boolean {
  const seen = new Set([a, removed]);
  const queue = [a];
  for (let i = 0; i < queue.length; i++) {
    if (queue[i] === b) return true;
    for (const next of coStars(graph, queue[i]!)) if (!seen.has(next)) (seen.add(next), queue.push(next));
  }
  return false;
}

/** Menger: two Actors share a block of the actor graph iff they are linked, or no third Actor separates them. */
function naiveShareBlock(graph: Graph, a: number, b: number): boolean {
  if (!connectedWithout(graph, a, b, -1)) return false;
  if (coStars(graph, a).has(b)) return true;
  return graph.actors.every((_, x) => x === a || x === b || connectedWithout(graph, a, b, x));
}

describe("findBlocks (Tarjan on the actor–movie graph, merged at Movies)", () => {
  it("agrees with Menger's theorem on every pair of many random graphs", () => {
    for (let seed = 1; seed <= 150; seed++) {
      const graph = randomGraph(seed, 6 + (seed % 14), 4 + (seed % 16));
      const blocks = findBlocks(graph);
      for (let a = 0; a < graph.actors.length; a++) {
        for (let b = a + 1; b < graph.actors.length; b++) {
          expect(sharedBlock(blocks, [a, b]) !== null, `seed ${seed}: ${a}, ${b}`).toBe(naiveShareBlock(graph, a, b));
        }
      }
    }
  });

  it("names a cut actor that really separates the pair, whenever two Actors of one Group share no block", () => {
    for (let seed = 1; seed <= 150; seed++) {
      const graph = randomGraph(seed, 6 + (seed % 14), 4 + (seed % 16));
      const blocks = findBlocks(graph);
      for (let a = 0; a < graph.actors.length; a++) {
        for (let b = a + 1; b < graph.actors.length; b++) {
          const cut = cutActorBetween(blocks, a, b);
          const sameGroup = graph.actorGroup[a] === graph.actorGroup[b];
          if (!sameGroup || sharedBlock(blocks, [a, b]) !== null) {
            expect(cut, `seed ${seed}: ${a}, ${b}`).toBeNull();
          } else {
            expect(cut, `seed ${seed}: ${a}, ${b}`).not.toBeNull();
            expect(connectedWithout(graph, a, b, cut!), `seed ${seed}: ${a}, ${b} through ${cut}`).toBe(false);
          }
        }
      }
    }
  });

  it("never treats a Movie as a cut point: Actors joined only by one Movie with 3+ Actors share a block", () => {
    const graph = graphOf(4, [[0, 1, 2], [2, 3]]);
    const blocks = findBlocks(graph);
    expect(sharedBlock(blocks, [0, 1, 2])).not.toBeNull();
    expect(sharedBlock(blocks, [0, 3])).toBeNull();
    expect(cutActorBetween(blocks, 0, 3)).toBe(2);
  });

  it("finds a block holding all k Actors only when there is one", () => {
    // A 4-ring 0–1–2–3 with a tail 3–4.
    const graph = graphOf(5, [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4]]);
    const blocks = findBlocks(graph);
    expect(sharedBlock(blocks, [0, 1, 2, 3])).not.toBeNull();
    expect(sharedBlock(blocks, [0, 2, 4])).toBeNull();
  });

  it("puts the tiny dataset's Pia Holt in a block with Dev Ennis only, cut off by him", () => {
    const tiny = buildGraph(loadDataset("data/tiny"));
    const index = (id: string) => tiny.actors.findIndex((a) => a.id === id);
    const blocks = findBlocks(tiny);
    expect(sharedBlock(blocks, [index("nm08"), index("nm05")])).not.toBeNull();
    expect(cutActorBetween(blocks, index("nm08"), index("nm02"))).toBe(index("nm05"));
    expect(sharedBlock(blocks, ["nm02", "nm03", "nm04", "nm05", "nm06", "nm07"].map(index))).not.toBeNull();
  });
});
