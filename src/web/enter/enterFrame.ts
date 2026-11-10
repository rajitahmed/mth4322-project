/** One frame of the enter screen as a character grid: halftone field, turning icosahedron, MOVIE STATISTICS. */
import { bigText } from "./bigText";
import { createGrid, drawLine, type Grid, writeText } from "../stage/charGrid";
import { dissolved } from "../stage/dissolve";
import { overHalftone } from "../stage/halftone";
import { type Point, viewEdges } from "./icosahedron";

/** The icosahedron is redrawn 30 times a second; the field and the dissolve move every frame. */
const ICOSAHEDRON_FPS = 30;
/** Radians per second around the upright axis. */
const SPIN = 0.45;
/** Share of the smaller screen side the icosahedron fills. */
const SIZE = 0.92;
const TITLE = bigText(["MOVIE", "STATISTICS"]);

export interface StageLayout {
  cx: number;
  cy: number;
  /** In rows; a column is 1 / aspect of a row. */
  radius: number;
}

/** `aspect` is a cell's height divided by its width, so the icosahedron stays round. */
export function stageLayout(width: number, height: number, aspect: number): StageLayout {
  return { cx: Math.floor(width / 2), cy: Math.floor(height / 2), radius: (Math.min(height, width / aspect) * SIZE) / 2 };
}

export function isOnIcosahedron(width: number, height: number, aspect: number, x: number, y: number): boolean {
  const { cx, cy, radius } = stageLayout(width, height, aspect);
  return Math.hypot((x - cx) / aspect, y - cy) <= radius;
}

function drawIcosahedron(grid: Grid, aspect: number, t: number): void {
  const { cx, cy, radius } = stageLayout(grid.width, grid.height, aspect);
  const angle = (Math.floor(t * ICOSAHEDRON_FPS) / ICOSAHEDRON_FPS) * SPIN;
  const cell = ([x, y]: Point) => [cx + x * radius * aspect, cy - y * radius] as const;
  const edges = viewEdges(angle).sort((a, b) => Number(b.hidden) - Number(a.hidden)); // near edges drawn last, on top
  for (const { from, to, hidden } of edges) {
    drawLine(grid, ...cell(from), ...cell(to), hidden ? "ink-dim" : "ink", hidden);
  }
}

function drawTitle(grid: Grid, aspect: number, hover: boolean): void {
  const { cx, cy } = stageLayout(grid.width, grid.height, aspect);
  const top = cy - Math.floor(TITLE.length / 2);
  const left = cx - Math.floor(TITLE[0]!.length / 2);
  TITLE.forEach((row, i) => writeText(grid, left, top + i, row, hover ? "accent" : "ink"));
}

/**
 * The frame at time `t` seconds. `dissolve` runs from 0 (whole) to 1 (only the halftone field is left).
 */
export function composeFrame(width: number, height: number, aspect: number, t: number, hover: boolean, dissolve: number): Grid {
  const front = createGrid(width, height, "");
  drawIcosahedron(front, aspect, t);
  drawTitle(front, aspect, hover);

  for (let i = 0; i < front.chars.length; i++) {
    if (front.chars[i] !== "") front.chars[i] = dissolved(front.chars[i]!, i, dissolve);
  }
  return overHalftone(front, t);
}
