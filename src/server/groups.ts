import { type Csr, row, rowCount } from "./csr";

/**
 * Labels every Actor with its Group using union-find (DECISIONS D13).
 * Groups are numbered 0, 1, 2, … in order of their lowest-index Actor.
 */
export function labelGroups(
  actorCount: number,
  movieActors: Csr,
): { actorGroup: Int32Array; groupCount: number } {
  const parent = Int32Array.from({ length: actorCount }, (_, i) => i);
  const size = new Int32Array(actorCount).fill(1);

  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]!]!; // path halving
      x = parent[x]!;
    }
    return x;
  };
  const union = (a: number, b: number) => {
    let ra = find(a);
    let rb = find(b);
    if (ra === rb) return;
    if (size[ra]! < size[rb]!) [ra, rb] = [rb, ra];
    parent[rb] = ra;
    size[ra]! += size[rb]!;
  };

  // Every Actor in a Movie joins the Movie's first Actor.
  for (let m = 0; m < rowCount(movieActors); m++) {
    const [first, ...rest] = row(movieActors, m);
    for (const actor of rest) union(first!, actor);
  }

  const actorGroup = new Int32Array(actorCount);
  const groupOfRoot = new Int32Array(actorCount).fill(-1);
  let groupCount = 0;
  for (let a = 0; a < actorCount; a++) {
    const root = find(a);
    if (groupOfRoot[root] === -1) groupOfRoot[root] = groupCount++;
    actorGroup[a] = groupOfRoot[root]!;
  }
  return { actorGroup, groupCount };
}
