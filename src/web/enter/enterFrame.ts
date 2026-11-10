/** One frame of the enter screen as a character grid: halftone field, turning icosahedron, MOVIE STATISTICS. */
import { bigText } from "./bigText";
import { createGrid, drawLine, type Grid, setCell, writeText } from "./charGrid";
import { halftoneGlyph } from "./halftone";
import { type Point, viewEdges } from "./icosahedron";

/** The icosahedron is redrawn 30 times a second; the field and the dissolve move every frame. */
const ICOSAHEDRON_FPS = 30;
/** Radians per second around the upright axis. */
const SPIN = 0.45;
/** Share of the smaller screen side the icosahedron fills. */
const SIZE = 0.92;
const TITLE = bigText(["MOVIE", "STATISTICS"]);
const DOTS = ["●", "•", "·"];

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

/** A fixed pseudo-random number in [0, 1) per cell, so each cell dissolves at its own moment. */
function cellNoise(i: number): number {
  return ((Math.imul(i + 1, 2654435761) >>> 0) % 1000) / 1000;
}

/**
 * The glyph a cell shows `progress` (0 to 1) into the dissolve: itself, then `●` `•` `·`, then nothing.
 * Each cell starts somewhere in the first 70% and takes 30% to fade, so all are gone at 1.
 */
function dissolved(char: string, i: number, progress: number): string {
  const step = (progress - 0.7 * cellNoise(i)) / 0.3;
  if (step <= 0) return char;
  return step >= 1 ? "" : DOTS[Math.floor(step * DOTS.length)]!;
}

/**
 * The frame at time `t` seconds. `dissolve` runs from 0 (whole) to 1 (only the halftone field is left).
 */
export function composeFrame(width: number, height: number, aspect: number, t: number, hover: boolean, dissolve: number): Grid {
  const front = createGrid(width, height, "");
  drawIcosahedron(front, aspect, t);
  drawTitle(front, aspect, hover);

  const grid = createGrid(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const char = front.chars[i] === "" ? "" : dissolved(front.chars[i]!, i, dissolve);
      if (char === "") setCell(grid, x, y, halftoneGlyph(x, y, t), "ink-dim");
      else setCell(grid, x, y, char, front.inks[i]!);
    }
  }
  return grid;
}
