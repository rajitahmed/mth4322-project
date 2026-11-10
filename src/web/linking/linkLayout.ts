/** Where each Actor of a two-sided search sits on the stage's character grid. */
import type { ExploredLink, SearchSide, ShortestPath } from "../../shared/types";

/** A two-sided search to animate: its two end Actors, the Links it tried in order, and the answer chain ([] when not possible). */
export interface Linking {
  ends: [string, string];
  tried: ExploredLink[];
  answer: string[];
}

/**
 * What the animation plays: the search between the chain's two ends, or, when there is no path,
 * between the two `picked` Actors (only a two-Actor search can find no path).
 */
export function linkingOf(path: ShortestPath, picked: [string, string] | null): Linking {
  if (!path.found) {
    if (!picked) throw new Error("A 'no path' result comes from two picked Actors");
    return { ends: picked, tried: path.explored, answer: [] };
  }
  const answer = path.actors.map((actor) => actor.id);
  return { ends: [answer[0]!, answer.at(-1)!], tried: path.explored, answer };
}

export interface Cell {
  x: number;
  y: number;
}

/** Cells kept free at the stage's edges, so sparkles have room. */
const MARGIN_X = 2;
const MARGIN_Y = 1;

interface Reached {
  side: SearchSide;
  /** Links from this side's end. */
  depth: number;
  parent: string | null;
}

/** Each Actor's side, depth and parent, from the first Link that reached it. */
function searchTrees({ ends, tried }: Linking): Map<string, Reached> {
  const reached = new Map<string, Reached>([
    [ends[0], { side: "a", depth: 0, parent: null }],
    [ends[1], { side: "b", depth: 0, parent: null }],
  ]);
  for (const { from, to, side } of tried) {
    if (!reached.has(to)) reached.set(to, { side, depth: (reached.get(from)?.depth ?? 0) + 1, parent: from });
  }
  return reached;
}

/** Spreads `ids` (one side's Actors at one depth) over `rows`, by their parents' rows; side a leans up, side b down. */
function spreadOverRows(ids: string[], rows: number[], rowOfParent: (id: string) => number, side: SearchSide): number[] {
  ids.sort((p, q) => rowOfParent(p) - rowOfParent(q));
  const offset = side === "a" ? 0.25 : 0.75; // where the sides share a column, they don't land on the same cell
  return ids.map((_, i) => rows[Math.floor(((i + offset) * rows.length) / ids.length)]!);
}

/** Groups the Actors by side and depth, shallowest first, each group in the order reached. */
function bySideAndDepth(actors: [string, Reached][]): string[][] {
  const groups = new Map<string, string[]>();
  for (const [id, { side, depth }] of [...actors].sort(([, p], [, q]) => p.depth - q.depth)) {
    const key = `${side} ${depth}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(id);
  }
  return [...groups.values()];
}

/**
 * Side a grows from the left edge, side b from the right, one column step per Link. The answer chain
 * runs along the middle row, end to end; with no answer the two sides stay apart. Every other Actor
 * is spread over the remaining rows of its column, ordered by its parent's row so branches don't cross,
 * with side a leaning up and side b leaning down; when there are more Actors than rows, several share a cell.
 */
export function layoutLinks(linking: Linking, columns: number, rows: number): Map<string, Cell> {
  const reached = searchTrees(linking);
  const { answer } = linking;
  const middle = Math.floor(rows / 2);
  const [left, right] = [MARGIN_X, columns - 1 - MARGIN_X];
  const deepest = (side: SearchSide) => [...reached.values()].reduce((max, r) => (r.side === side ? Math.max(max, r.depth) : max), 0);
  const span = Math.max(1, answer.length > 1 ? answer.length - 1 : deepest("a") + deepest("b") + 1);
  const columnAt = (share: number) => Math.round(left + (right - left) * Math.min(1, Math.max(0, share)));
  const columnOf = ({ side, depth }: Reached) => columnAt(side === "a" ? depth / span : 1 - depth / span);

  const at = new Map<string, Cell>();
  answer.forEach((id, k) => at.set(id, { x: columnAt(k / span), y: middle }));
  for (const end of linking.ends) if (!at.has(end)) at.set(end, { x: columnOf(reached.get(end)!), y: middle });

  const freeRows = Array.from({ length: rows - 2 * MARGIN_Y }, (_, i) => i + MARGIN_Y).filter((y) => y !== middle);
  if (freeRows.length === 0) freeRows.push(middle);
  const rowOfParent = (id: string) => at.get(reached.get(id)!.parent!)?.y ?? middle;
  for (const ids of bySideAndDepth([...reached.entries()].filter(([id]) => !at.has(id)))) {
    const { side } = reached.get(ids[0]!)!;
    const ys = spreadOverRows(ids, freeRows, rowOfParent, side);
    ids.forEach((id, i) => at.set(id, { x: columnOf(reached.get(id)!), y: ys[i]! }));
  }
  return at;
}
