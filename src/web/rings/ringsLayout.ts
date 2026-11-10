/** Where each Layer's ring of dots sits on the stage's character grid, which Actors each dot stands for, and where the counts go. */
import { type Cell, CELL_ASPECT } from "../stage/charGrid";

/** A dot on a ring: it stands for the `size` Actors from position `first` of its Layer (Layers are in id order). */
export interface Dot extends Cell {
  first: number;
  size: number;
}

export interface Ring {
  count: number;
  dots: Dot[];
}

export interface Label extends Cell {
  text: string;
}

export interface RingsLayout {
  center: Cell;
  /** One per Layer: `rings[0]` is the Center, a single dot. */
  rings: Ring[];
  /** One count per Layer outside the Center, in Layer order. */
  labels: Label[];
}

/** Cells kept free at the stage's edges. */
const MARGIN_X = 2;
const MARGIN_Y = 1;
/** Columns between the outer ring and the counts. */
const LABEL_GAP = 3;
/** A click picks the nearest dot no more than this many rows away (a column counts 1 / CELL_ASPECT of a row). */
const PICK_REACH = 1.5;

/** The cells of a round ring `ry` rows high (twice as many columns wide), each once, clockwise from the top. */
function ringCells(cx: number, cy: number, ry: number): Cell[] {
  const rx = ry * CELL_ASPECT;
  const steps = Math.max(8, Math.ceil(4 * Math.PI * rx));
  const seen = new Set<string>();
  const cells: Cell[] = [];
  for (let k = 0; k < steps; k++) {
    const angle = -Math.PI / 2 + (2 * Math.PI * k) / steps;
    const cell = { x: Math.round(cx + rx * Math.cos(angle)), y: Math.round(cy + ry * Math.sin(angle)) };
    const key = `${cell.x},${cell.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cells.push(cell);
  }
  return cells;
}

/**
 * `count` Actors on the cells of one ring: one dot per Actor while they fit, spread evenly; otherwise
 * every cell is a dot, and dot j stands for the Actors from ceil(j·count/dots) up to the next dot's first.
 */
function dotsOn(cells: Cell[], count: number): Dot[] {
  const dots = Math.min(count, cells.length);
  const firstOf = (j: number) => Math.ceil((j * count) / dots);
  return Array.from({ length: dots }, (_, j) => ({ ...cells[Math.floor((j * cells.length) / dots)]!, first: firstOf(j), size: firstOf(j + 1) - firstOf(j) }));
}

/**
 * The Center in the middle of the space left of the counts, and Layer i on a round ring of i/L of the
 * largest radius that fits (L = the last Layer), so the rings are evenly spaced. The counts sit in a
 * column to the right of the outer ring, one row each, centered on the Center's row.
 */
export function layoutRings(layerCounts: number[], columns: number, rows: number): RingsLayout {
  const last = layerCounts.length - 1;
  const texts = layerCounts.slice(1).map((count, i) => `layer ${i + 1}: ${count.toLocaleString("en-US")}`);
  const labelWidth = texts.length === 0 ? 0 : LABEL_GAP + Math.max(...texts.map((t) => t.length));
  const [cx, cy] = [Math.round((columns - labelWidth - 1) / 2), Math.round((rows - 1) / 2)];
  const radius = Math.max(0, Math.min(cy - MARGIN_Y, (cx - MARGIN_X) / CELL_ASPECT));
  const center = { x: cx, y: cy };

  const rings = layerCounts.map((count, layer): Ring => {
    if (layer === 0) return { count, dots: [{ ...center, first: 0, size: 1 }] };
    return { count, dots: dotsOn(ringCells(cx, cy, (radius * layer) / last), count) };
  });
  const labelX = Math.min(columns - labelWidth + LABEL_GAP, Math.round(cx + radius * CELL_ASPECT) + LABEL_GAP + 1);
  const top = cy - Math.floor(texts.length / 2);
  return { center, rings, labels: texts.map((text, i) => ({ x: labelX, y: top + i, text })) };
}

/** The dot of `ring` that stands for the Actor at `position`. */
export function dotOf(ring: Ring, position: number): Dot {
  return ring.dots[Math.floor((position * ring.dots.length) / ring.count)]!;
}

/** The dot nearest `cell`, as its Layer and the position of the first Actor it stands for; null when none is close. */
export function nearestDot({ rings }: RingsLayout, cell: Cell): { layer: number; position: number } | null {
  let best: { layer: number; position: number } | null = null;
  let bestReach = PICK_REACH;
  rings.forEach((ring, layer) => {
    for (const dot of ring.dots) {
      const reach = Math.hypot((dot.x - cell.x) / CELL_ASPECT, dot.y - cell.y);
      if (reach <= bestReach) [best, bestReach] = [{ layer, position: dot.first }, reach];
    }
  });
  return best;
}
