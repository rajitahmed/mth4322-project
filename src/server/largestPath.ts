import { chainTo, searchLayers } from "./bfs";
import { actorsIn, type Graph, moviesOf } from "./graph";

/**
 * The largest finite shortest path: its Distance and the lowest-id pair of
 * Actors that far apart, by Actor index (a < b, or a = b when no two Actors are linked).
 */
export interface LargestPath {
  distance: number;
  a: number;
  b: number;
}

const NO_PAIR: LargestPath = { distance: -1, a: -1, b: -1 };

/**
 * The largest Distance between two Actors of the same Group, across all Groups
 * (DECISIONS D3, D17): iFUB with a 4-sweep start on every Group that could
 * still reach the best so far. Biggest Groups first; a Group of n Actors has no
 * Distance above n − 1, so once that is below the best, the rest are skipped.
 */
export function largestPath(graph: Graph): LargestPath {
  let best = NO_PAIR;
  const linkCount = createLinkCounter(graph);
  for (const members of groupsBySize(graph)) {
    if (members.length - 1 < best.distance) break;
    best = better(best, groupLargestPath(graph, members, linkCount));
  }
  if (best === NO_PAIR) throw new Error("The graph has no Actors");
  return best;
}

/**
 * iFUB on one Group (algorithms.md §3.3–3.4). When it stops, every pair at the
 * final Distance has an endpoint it searched from, so keeping the lowest pair
 * each search offers gives the lowest-id pair overall.
 */
function groupLargestPath(graph: Graph, members: Int32Array, linkCount: (actor: number) => number): LargestPath {
  let best = NO_PAIR;
  /** A full search from x; x and its farthest Actor (lowest index in the last Layer) are a candidate pair. */
  const sweep = (x: number) => {
    const result = searchLayers(graph, x);
    const farthest = result.layers.at(-1)![0]!;
    best = better(best, { distance: result.layers.length - 1, a: Math.min(x, farthest), b: Math.max(x, farthest) });
    return { ...result, farthest };
  };
  /** The Actor halfway along the chain from a sweep's start to its farthest Actor. */
  const midpoint = ({ search, farthest }: ReturnType<typeof sweep>) => {
    const { actors } = chainTo(search, farthest);
    return actors[Math.floor((actors.length - 1) / 2)]!;
  };

  // 4-sweep: most-linked Actor → a₁ → b₁, midpoint r₂ → a₂ → b₂, midpoint u.
  const a1 = sweep(mostLinked(members, linkCount)).farthest;
  const r2 = midpoint(sweep(a1));
  const a2 = sweep(r2).farthest;
  const u = midpoint(sweep(a2));

  // Layers from u, outermost first. Stop once no two unchecked Actors (both within i − 1 of u) can reach the best.
  const { layers } = sweep(u);
  for (let i = layers.length - 1; i >= 1; i--) {
    for (const x of layers[i]!) sweep(x);
    if (best.distance > 2 * (i - 1)) break;
  }
  return best;
}

/** The larger Distance; on equal Distances, the lower pair (lowest a, then lowest b). */
function better(p: LargestPath, q: LargestPath): LargestPath {
  if (p.distance !== q.distance) return p.distance > q.distance ? p : q;
  return p.a < q.a || (p.a === q.a && p.b <= q.b) ? p : q;
}

/** Every Group's Actors (lowest index first), biggest Group first; equal sizes keep Group order. */
function groupsBySize(graph: Graph): Int32Array[] {
  const members: number[][] = Array.from({ length: graph.groupCount }, () => []);
  graph.actorGroup.forEach((group, actor) => members[group]!.push(actor));
  return members.map((list) => Int32Array.from(list)).sort((x, y) => y.length - x.length);
}

/** The member with the most Links (distinct co-stars); the lowest index on ties. */
function mostLinked(members: Int32Array, linkCount: (actor: number) => number): number {
  let best = members[0]!;
  let bestCount = -1;
  for (const actor of members) {
    const count = linkCount(actor);
    if (count > bestCount) [best, bestCount] = [actor, count];
  }
  return best;
}

/** Counts an Actor's distinct co-stars, reusing one "last counted for" array across calls. */
function createLinkCounter(graph: Graph): (actor: number) => number {
  const countedFor = new Int32Array(graph.actors.length).fill(-1);
  return (actor) => {
    countedFor[actor] = actor;
    let count = 0;
    for (const movie of moviesOf(graph, actor)) {
      for (const costar of actorsIn(graph, movie)) {
        if (countedFor[costar] === actor) continue;
        countedFor[costar] = actor;
        count++;
      }
    }
    return count;
  };
}
