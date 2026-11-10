import { searchLayers } from "./bfs";
import { type Csr, row, rowCount } from "./csr";
import { actorsIn, type Links, moviesOf } from "./graph";

/** Rejected branches kept for the animation; the rest are only counted (DECISIONS D8). */
export const MAX_REJECTED = 300;

/** Everything the search needs, all plain data, so it can be sent to a worker (D9). */
export interface CycleSearchInput {
  links: Links;
  actorBlocks: Csr;
  /** The block the checks found holding every Chosen Actor (D6 step 3). */
  block: number;
  /** The Chosen Actors, Chosen Actor #1 first. */
  chosen: number[];
}

/** A Link by index: from an Actor, through a Movie, to a co-star. */
export interface IndexLink {
  from: number;
  movie: number;
  to: number;
}

/** The final pass's rejected branches, in the order tried, capped, and how many more there were. */
interface Rejections {
  rejected: IndexLink[];
  moreRejected: number;
}

/**
 * The shortest Cycle, Chosen Actor #1 first: `movies[i]` links `actors[i]` and
 * `actors[i + 1]`, and the last Movie links back to `actors[0]`. Or none.
 */
export type IndexCycleSearch =
  | ({ found: true; actors: number[]; movies: number[] } & Rejections)
  | ({ found: false } & Rejections);

/**
 * The shortest Cycle through every Chosen Actor, by IDA* inside their block
 * (DECISIONS D7, algorithms.md §5.4). Only Actors are marked used; Movies may
 * supply any number of Links. Budgets rise one at a time, so the first Cycle
 * found is a shortest one. None exists (D6 step 4) once a pass rejects nothing
 * (that pass already tried every route, and a bigger budget would repeat it)
 * or the budget passes the block's size.
 */
export function shortestCycleIn({ links, actorBlocks, block, chosen }: CycleSearchInput): IndexCycleSearch {
  const actorCount = rowCount(actorBlocks);
  const inBlock = new Uint8Array(actorCount);
  for (let a = 0; a < actorCount; a++) if (row(actorBlocks, a).includes(block)) inBlock[a] = 1;
  const blockSize = inBlock.reduce((sum, x) => sum + x, 0);

  const start = chosen[0]!;
  const bitOf = new Map(chosen.map((c, i) => [c, 1 << i]));
  const lowerBoundFrom = lowerBound(links, chosen);
  const used = new Uint8Array(actorCount);
  used[start] = 1;
  const actors = [start];
  const movies: number[] = [];
  let rejections: Rejections = { rejected: [], moreRejected: 0 };
  let budget = 0;

  /** The co-stars of v inside the block, lowest index first, each through its lowest-index shared Movie. */
  const linksFrom = (v: number): [number, number][] => {
    const via = new Map<number, number>();
    for (const movie of moviesOf(links, v)) {
      for (const w of actorsIn(links, movie)) if (w !== v && inBlock[w] && !via.has(w)) via.set(w, movie);
    }
    return [...via].sort(([a], [b]) => a - b);
  };

  /** Depth-first from v, `length` Links so far, `remaining` = the bits of the Chosen Actors still to visit. */
  const searchFrom = (v: number, length: number, remaining: number): boolean => {
    for (const [w, movie] of linksFrom(v)) {
      if (w === start) {
        if (remaining !== 0) continue;
        movies.push(movie);
        return true;
      }
      if (used[w]) continue;
      const left = remaining & ~(bitOf.get(w) ?? 0);
      if (length + 1 + lowerBoundFrom(w, left) > budget) {
        if (rejections.rejected.length < MAX_REJECTED) rejections.rejected.push({ from: v, movie, to: w });
        else rejections.moreRejected++;
        continue;
      }
      used[w] = 1;
      actors.push(w);
      movies.push(movie);
      if (searchFrom(w, length + 1, left)) return true;
      used[w] = 0;
      actors.pop();
      movies.pop();
    }
    return false;
  };

  const allOthers = (1 << chosen.length) - 2;
  for (budget = lowerBoundFrom(start, allOthers); budget <= blockSize; budget++) {
    rejections = { rejected: [], moreRejected: 0 };
    if (searchFrom(start, 0, allOthers)) return { found: true, actors, movies, ...rejections };
    if (rejections.rejected.length === 0) break;
  }
  return { found: false, ...rejections };
}

/**
 * The lower bound h(v, R) of D7: the shortest way from v through every Chosen
 * Actor in R (a bitmask) and back to Chosen Actor #1, if paths could overlap.
 * Exact BFS distances (shortest paths between Actors of one block stay in it),
 * with the best order of each subset precomputed by Held–Karp.
 */
function lowerBound(links: Links, chosen: number[]): (v: number, remaining: number) => number {
  const k = chosen.length;
  const distance = chosen.map((c) => searchLayers(links, c).search.distance);
  const toStart = distance[0]!;
  // finish[mask * k + j]: from Chosen Actor j, through the rest of mask, back to #1 (j in mask, #1 never in it).
  const finish = new Int32Array((1 << k) * k);
  for (let mask = 2; mask < 1 << k; mask += 2) {
    for (let j = 1; j < k; j++) {
      if (!(mask & (1 << j))) continue;
      const rest = mask & ~(1 << j);
      let best = rest === 0 ? toStart[chosen[j]!]! : Infinity;
      for (let i = 1; i < k; i++) {
        if (rest & (1 << i)) best = Math.min(best, distance[j]![chosen[i]!]! + finish[rest * k + i]!);
      }
      finish[mask * k + j] = best;
    }
  }
  return (v, remaining) => {
    if (remaining === 0) return toStart[v]!;
    let best = Infinity;
    for (let j = 1; j < k; j++) {
      if (remaining & (1 << j)) best = Math.min(best, distance[j]![v]! + finish[remaining * k + j]!);
    }
    return best;
  };
}
