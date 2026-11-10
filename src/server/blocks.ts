import { type Csr, row, rowCount, toCsr } from "./csr";
import { actorsIn, type Graph, moviesOf } from "./graph";

/**
 * The biconnected blocks of the actor graph (DECISIONS D6, D20), and the
 * block–cut forest that joins them: one node per Actor, one per block, and a
 * tree edge between each block and each of its Actors. Computed once at startup.
 */
export interface Blocks {
  /** The blocks of every Actor, lowest first. Only a cut actor has more than one. */
  actorBlocks: Csr;
  /** Forest node of an Actor a is a; of a block b it is actorCount + b. −1 for a root. */
  parent: Int32Array;
  depth: Int32Array;
}

export function findBlocks(graph: Graph): Blocks {
  const actorCount = graph.actors.length;
  const { vertices, blocks, blockCount } = tarjanBlocks(graph);
  const merged = mergeAtMovies(actorCount, vertices, blocks, blockCount);

  const actorBlocks = toCsr(actorCount, merged.actors, merged.blocks);
  const blockActors = toCsr(merged.count, merged.blocks, merged.actors);
  return { actorBlocks, ...rootForest(actorBlocks, blockActors) };
}

/** A block that holds every one of these Actors (the lowest), or null if none does. */
export function sharedBlock({ actorBlocks }: Blocks, actors: number[]): number | null {
  const [first, ...rest] = actors;
  for (const block of row(actorBlocks, first!)) {
    if (rest.every((a) => row(actorBlocks, a).includes(block))) return block;
  }
  return null;
}

/**
 * The cut actor nearest to `a` that every route from a to b passes through, or
 * null when they share a block or are in different Groups. It is the first
 * Actor strictly inside the block–cut forest path from a to b.
 */
export function cutActorBetween({ parent, depth, actorBlocks }: Blocks, a: number, b: number): number | null {
  const actorCount = rowCount(actorBlocks);
  const fromA: number[] = [];
  const fromB: number[] = [];
  let u = a;
  let v = b;
  while (u !== v) {
    if (depth[u]! >= depth[v]!) fromA.push((u = parent[u]!));
    else fromB.push((v = parent[v]!));
    if (u === -1 || v === -1) return null; // different trees: different Groups
  }
  const inside = [...fromA, ...fromB.reverse()].filter((node) => node < actorCount && node !== a && node !== b);
  return inside[0] ?? null;
}

/**
 * Tarjan's blocks of the actor–movie graph, as an iterative DFS (the real graph
 * is too deep to recurse). Node n < A is Actor n, node A + m is Movie m. Each
 * (vertices[i], blocks[i]) pair says that node is in that block.
 */
function tarjanBlocks(graph: Graph): { vertices: number[]; blocks: number[]; blockCount: number } {
  const actorCount = graph.actors.length;
  const nodeCount = actorCount + graph.movies.length;
  const neighbours = (n: number): Int32Array => (n < actorCount ? moviesOf(graph, n) : actorsIn(graph, n - actorCount));
  const neighbour = (n: number, i: number): number => neighbours(n)[i]! + (n < actorCount ? actorCount : 0);

  const discovered = new Int32Array(nodeCount).fill(-1);
  const low = new Int32Array(nodeCount);
  const parent = new Int32Array(nodeCount).fill(-1);
  const nextEdge = new Int32Array(nodeCount);
  const vertices: number[] = [];
  const blocks: number[] = [];
  let blockCount = 0;
  let time = 0;

  for (let root = 0; root < nodeCount; root++) {
    if (discovered[root] !== -1) continue;
    const open: number[] = []; // nodes not yet assigned to a block, in discovery order
    const calls: number[] = [root];
    discovered[root] = low[root] = time++;
    open.push(root);

    while (calls.length > 0) {
      const v = calls.at(-1)!;
      if (nextEdge[v]! < neighbours(v).length) {
        const w = neighbour(v, nextEdge[v]!++);
        if (discovered[w] === -1) {
          parent[w] = v;
          discovered[w] = low[w] = time++;
          open.push(w);
          calls.push(w);
        } else if (w !== parent[v]) {
          low[v] = Math.min(low[v]!, discovered[w]!);
        }
        continue;
      }
      calls.pop();
      const p = parent[v]!;
      if (p === -1) continue;
      low[p] = Math.min(low[p]!, low[v]!);
      if (low[v]! >= discovered[p]!) {
        // p is a cut point (or the root): v's subtree plus p is one block.
        let popped: number;
        do {
          popped = open.pop()!;
          vertices.push(popped);
          blocks.push(blockCount);
        } while (popped !== v);
        vertices.push(p);
        blocks.push(blockCount++);
      }
    }
  }
  return { vertices, blocks, blockCount };
}

/**
 * A Movie can be reused by a Cycle, so it is never a real cut point: every
 * block that meets at a Movie becomes one block of the actor graph. Returns the
 * (Actor, merged block) pairs, blocks renumbered 0, 1, 2, … An Actor never
 * gets the same merged block twice: two of its blocks meet only at the Actor.
 */
function mergeAtMovies(
  actorCount: number,
  vertices: number[],
  blocks: number[],
  blockCount: number,
): { actors: Int32Array; blocks: Int32Array; count: number } {
  const root = Int32Array.from({ length: blockCount }, (_, i) => i);
  const find = (x: number): number => {
    while (root[x] !== x) x = root[x] = root[root[x]!]!;
    return x;
  };
  const firstBlockOfMovie = new Map<number, number>();
  vertices.forEach((node, i) => {
    if (node < actorCount) return;
    const first = firstBlockOfMovie.get(node);
    if (first === undefined) firstBlockOfMovie.set(node, blocks[i]!);
    else root[find(blocks[i]!)] = find(first);
  });

  const mergedId = new Int32Array(blockCount).fill(-1);
  let count = 0;
  const actorPairs: number[] = [];
  const blockPairs: number[] = [];
  vertices.forEach((node, i) => {
    if (node >= actorCount) return;
    const r = find(blocks[i]!);
    if (mergedId[r] === -1) mergedId[r] = count++;
    actorPairs.push(node);
    blockPairs.push(mergedId[r]!);
  });
  return { actors: Int32Array.from(actorPairs), blocks: Int32Array.from(blockPairs), count };
}

/** Roots each tree of the block–cut forest at its lowest Actor, by BFS. */
function rootForest(actorBlocks: Csr, blockActors: Csr): { parent: Int32Array; depth: Int32Array } {
  const actorCount = rowCount(actorBlocks);
  const nodeCount = actorCount + rowCount(blockActors);
  const parent = new Int32Array(nodeCount).fill(-1);
  const depth = new Int32Array(nodeCount).fill(-1);
  const children = (n: number): Int32Array => (n < actorCount ? row(actorBlocks, n) : row(blockActors, n - actorCount));
  const offset = (n: number): number => (n < actorCount ? actorCount : 0);

  const queue = new Int32Array(nodeCount);
  for (let start = 0; start < actorCount; start++) {
    if (depth[start] !== -1) continue;
    depth[start] = 0;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    while (head < tail) {
      const n = queue[head++]!;
      for (const c of children(n)) {
        const child = c + offset(n);
        if (depth[child] !== -1) continue;
        depth[child] = depth[n]! + 1;
        parent[child] = n;
        queue[tail++] = child;
      }
    }
  }
  return { parent, depth };
}
