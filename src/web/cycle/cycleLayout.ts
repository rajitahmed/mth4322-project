/** Where each Actor of a Cycle search sits on the stage's character grid, and where each Movie label goes. */
import type { Link } from "../../shared/types";
import { type Cell, CELL_ASPECT } from "../stage/charGrid";
import type { CycleRun } from "./cycleRun";

export interface Label extends Cell {
  text: string;
}

export interface CycleLayout {
  at: Map<string, Cell>;
  /** One per circle Link when there is a Cycle, in circle order. */
  labels: Label[];
}

/** Cells kept free at the stage's edges. */
const MARGIN_X = 2;
const MARGIN_Y = 1;
/** The circle's size as a share of the outer circle's, where the rejected branches end. */
const CIRCLE_SHARE = 0.6;
/** Each Actor's rejected branches fan out over this share of the angle between two circle Actors. */
const FAN_SHARE = 0.8;
/** Longer Movie titles are cut to this many characters, the last one `…`. */
const MAX_LABEL = 19;

const shorten = (title: string) => (title.length > MAX_LABEL ? `${title.slice(0, MAX_LABEL - 1)}…` : title);

/**
 * Each off-circle Actor, in the order first met, with the Actor it is anchored to: the other end of the
 * first rejected branch that met it, when that one was already placed (null otherwise).
 */
function anchors(onCircle: Set<string>, rejected: Link[]): Map<string, string | null> {
  const anchorOf = new Map<string, string | null>();
  const placed = (id: string) => onCircle.has(id) || anchorOf.has(id);
  for (const { from, to } of rejected) {
    for (const [id, other] of [[from, to], [to, from]] as const) {
      if (!placed(id)) anchorOf.set(id, placed(other) ? other : null);
    }
  }
  return anchorOf;
}

/**
 * The Cycle's Actors (or the Chosen Actors) sit evenly on a circle around the center, the first at the top, going clockwise.
 * Every Actor met only by a rejected branch sits on a larger outer circle, fanned out around the angle
 * of the Actor it branched from; one with no placed neighbor gets an even share of the outer circle.
 * A cut actor that is not on the circle sits in the center. Each Movie label sits just outside the middle
 * of its Link, moved further out when it would overlap another label.
 */
export function layoutCycle(run: CycleRun, columns: number, rows: number): CycleLayout {
  const [cx, cy] = [(columns - 1) / 2, (rows - 1) / 2];
  /** The outer circle's radius in rows: as large as fits, kept round (the stage is wider than tall, so this leaves room for labels at the sides). */
  const ry = Math.max(0, Math.min(cy - MARGIN_Y, (cx - MARGIN_X) / CELL_ASPECT));
  const rx = ry * CELL_ASPECT;
  const cellAt = (angle: number, share: number): Cell => ({
    x: Math.round(cx + rx * share * Math.cos(angle)),
    y: Math.round(cy + ry * share * Math.sin(angle)),
  });

  const { circle, rejected, cut, movies } = run;
  const angle = new Map(circle.map((id, k) => [id, -Math.PI / 2 + (2 * Math.PI * k) / circle.length]));
  const at = new Map(circle.map((id) => [id, cellAt(angle.get(id)!, CIRCLE_SHARE)]));

  const anchorOf = anchors(new Set(circle), rejected);
  const fan = (FAN_SHARE * 2 * Math.PI) / circle.length;
  const children = new Map<string | null, string[]>();
  for (const [id, anchor] of anchorOf) children.set(anchor, [...(children.get(anchor) ?? []), id]);
  const loose = children.get(null) ?? [];
  for (const [id, anchor] of anchorOf) {
    const siblings = children.get(anchor)!;
    const k = siblings.indexOf(id);
    const a = anchor === null ? -Math.PI / 2 + (2 * Math.PI * (k + 0.5)) / loose.length : angle.get(anchor)! + fan * ((k + 0.5) / siblings.length - 0.5);
    angle.set(id, a);
    at.set(id, cellAt(a, 1));
  }
  if (cut && !at.has(cut.actor)) at.set(cut.actor, { x: Math.round(cx), y: Math.round(cy) });

  const wanted = (movies ?? []).map((title, i) => labelAt(shorten(title), at.get(circle[i]!)!, at.get(circle[(i + 1) % circle.length]!)!, cx, cy, columns));
  return { at, labels: apart(wanted, cy, rows) };
}

/** Two labels overlap when they share a row and their texts touch or cross. */
const overlap = (p: Label, q: Label) => p.y === q.y && p.x <= q.x + q.text.length && q.x <= p.x + p.text.length;

/** Each label in turn, moved row by row away from the center (then towards it) until it overlaps none placed before it. */
function apart(wanted: Label[], cy: number, rows: number): Label[] {
  const placed: Label[] = [];
  for (const label of wanted) {
    const out = label.y < cy ? -1 : 1;
    const tries = [...Array(rows).keys()].flatMap((k) => [label.y + out * k, label.y - out * (k + 1)]).filter((y) => y >= 0 && y < rows);
    const y = tries.find((y) => !placed.some((other) => overlap({ ...label, y }, other))) ?? label.y;
    placed.push({ ...label, y });
  }
  return placed;
}

/** A label just outside the middle of the Link p–q: beside it when the middle is to the left or right of the center, else above or below. */
function labelAt(text: string, p: Cell, q: Cell, cx: number, cy: number, columns: number): Label {
  const [mx, my] = [Math.round((p.x + q.x) / 2), Math.round((p.y + q.y) / 2)];
  const [ox, oy] = [(mx - cx) / CELL_ASPECT, my - cy];
  const clampX = (x: number) => Math.max(0, Math.min(columns - text.length, x));
  if (Math.abs(ox) > Math.abs(oy)) return { text, y: my, x: clampX(ox < 0 ? mx - 2 - text.length : mx + 2) };
  return { text, y: my + Math.sign(oy || -1), x: clampX(mx - Math.floor(text.length / 2)) };
}
