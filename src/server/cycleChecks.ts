import { type Blocks, cutActorBetween, sharedBlock } from "./blocks";
import type { Graph } from "./graph";

/** D6 steps 1–2 on Actor indices. `block` is the block the search runs in. */
export type IndexCycleCheck =
  | { outcome: "not-possible"; reason: "different-groups" }
  | { outcome: "not-possible"; reason: "cut-actor"; cutActor: number; between: [number, number] }
  | { outcome: "shares-block"; block: number };

/**
 * Runs the checks before a Cycle search, in D6's order. When no block holds
 * every Chosen Actor, some pair already shares none (blocks of a tree pairwise
 * meeting always share a node), so the first such pair names the cut actor.
 */
export function checkCycle(graph: Graph, blocks: Blocks, chosen: number[]): IndexCycleCheck {
  const group = graph.actorGroup[chosen[0]!];
  if (chosen.some((a) => graph.actorGroup[a] !== group)) return { outcome: "not-possible", reason: "different-groups" };

  const block = sharedBlock(blocks, chosen);
  if (block !== null) return { outcome: "shares-block", block };

  for (const [i, a] of chosen.entries()) {
    for (const b of chosen.slice(i + 1)) {
      const cutActor = cutActorBetween(blocks, a, b);
      if (cutActor !== null) return { outcome: "not-possible", reason: "cut-actor", cutActor, between: [a, b] };
    }
  }
  throw new Error("Chosen Actors in one Group with no shared block must have a pair split by a cut actor");
}
