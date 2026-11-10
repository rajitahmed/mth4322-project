/** What tab 1's animation plays, and where each Actor of the two-sided search sits on the stage's character grid. */
import type { ActorSummary, Names, SearchRound, SearchSide, ShortestPath } from "../../shared/types";
import type { Cell } from "../stage/charGrid";

/** A two-sided search to animate (D27): its two end Actors, its rounds, the answer chain ([] when there is none), and every name it shows. */
export interface Linking {
  ends: [string, string];
  rounds: SearchRound[];
  /** The answer chain's Actors, end to end, and the Movie of each of its Links. */
  answer: string[];
  answerMovies: string[];
  names: Names;
}

/**
 * What the animation plays: the search between the chain's two ends, or, when there is no path,
 * between the two `picked` Actors (only a two-Actor search can find no path).
 */
export function linkingOf(path: ShortestPath, picked: [ActorSummary, ActorSummary] | null): Linking {
  const names: Names = { ...path.names };
  if (!path.found) {
    if (!picked) throw new Error("A 'no path' result comes from two picked Actors");
    for (const actor of picked) names[actor.id] = actor.name;
    return { ends: [picked[0].id, picked[1].id], rounds: path.rounds, answer: [], answerMovies: [], names };
  }
  for (const actor of path.actors) names[actor.id] = actor.name;
  for (const movie of path.movies) names[movie.id] = movie.title;
  const answer = path.actors.map((actor) => actor.id);
  return { ends: [answer[0]!, answer.at(-1)!], rounds: path.rounds, answer, answerMovies: path.movies.map((m) => m.id), names };
}

/** Where everything sits: each Actor's cell, each round's column, and the columns between two depths. */
export interface LinkLayout {
  at: Map<string, Cell>;
  /** The column of each round, in round order, for its count. */
  roundX: number[];
  spacing: number;
  /** The answer's row; the rows just above and below it hold its labels, the one above those the ends' names. */
  middle: number;
}

/** Cells kept free at the stage's edges, so sparkles have room. */
const MARGIN_X = 2;
/** Row 0 holds each round's count; the last row stays free. */
const TOP = 2;
const BOTTOM = 1;

interface Reached {
  side: SearchSide;
  depth: number;
  parent: string | null;
}

/** Each shown Actor's side, depth and parent, from the first round that showed it. */
function searchTrees({ ends, rounds }: Linking): Map<string, Reached> {
  const reached = new Map<string, Reached>([
    [ends[0], { side: "a", depth: 0, parent: null }],
    [ends[1], { side: "b", depth: 0, parent: null }],
  ]);
  for (const { side, depth, shown } of rounds) {
    for (const { from, to } of shown) if (!reached.has(to)) reached.set(to, { side, depth, parent: from });
  }
  return reached;
}

/**
 * Side a grows from the left edge and side b from the right, one column step per depth. The answer chain
 * runs along the middle row, end to end; with no answer the two sides stay apart. Every other shown Actor
 * is spread evenly over its column's free rows (the middle row and its label rows are kept clear),
 * ordered by its parent's row so branches don't cross.
 */
export function layoutLinks(linking: Linking, columns: number, rows: number): LinkLayout {
  const reached = searchTrees(linking);
  const { answer, rounds } = linking;
  const middle = Math.floor((rows + TOP - BOTTOM) / 2);
  const [left, right] = [MARGIN_X, columns - 1 - MARGIN_X];
  const deepest = (side: SearchSide) => Math.max(0, ...rounds.filter((r) => r.side === side).map((r) => r.depth));
  const span = Math.max(1, answer.length > 1 ? answer.length - 1 : deepest("a") + deepest("b") + 1);
  const columnAt = (share: number) => Math.round(left + (right - left) * Math.min(1, Math.max(0, share)));
  const columnOf = (side: SearchSide, depth: number) => columnAt(side === "a" ? depth / span : 1 - depth / span);

  const at = new Map<string, Cell>();
  answer.forEach((id, k) => at.set(id, { x: columnAt(k / span), y: middle }));
  for (const [i, end] of linking.ends.entries()) if (!at.has(end)) at.set(end, { x: columnOf(i === 0 ? "a" : "b", 0), y: middle });

  const kept = new Set([middle - 2, middle - 1, middle, middle + 1]);
  const freeRows = Array.from({ length: rows }, (_, y) => y).filter((y) => y >= TOP && y < rows - BOTTOM && !kept.has(y));
  if (freeRows.length === 0) freeRows.push(middle);
  const rowOf = (id: string | null) => (id === null ? middle : (at.get(id)?.y ?? middle));
  for (const { side, depth, shown } of rounds) {
    const ids = shown.map((link) => link.to).filter((id) => !at.has(id) && reached.get(id)!.depth === depth);
    ids.sort((p, q) => rowOf(reached.get(p)!.parent) - rowOf(reached.get(q)!.parent));
    ids.forEach((id, i) => at.set(id, { x: columnOf(side, depth), y: freeRows[Math.floor(((i + 0.5) * freeRows.length) / ids.length)]! }));
  }
  return {
    at,
    roundX: rounds.map(({ side, depth }) => columnOf(side, depth)),
    spacing: Math.max(1, Math.floor((right - left) / span)),
    middle,
  };
}
