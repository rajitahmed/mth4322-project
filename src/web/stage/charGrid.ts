/** A screen of character cells, each with a glyph and a color token from design.md. */

/** A design.md color token. Green, red and spark only ever mean the answer, rejected, and sparkles. */
export type Ink = "ink" | "ink-dim" | "accent" | "green" | "red" | "spark";

/** A cell's place on the grid. */
export interface Cell {
  x: number;
  y: number;
}

/** A cell is about twice as tall as it is wide (16px font: ~9.6px wide, 19px tall), so a round shape spans twice as many columns as rows. */
export const CELL_ASPECT = 2;

export interface Grid {
  width: number;
  height: number;
  chars: string[];
  inks: Ink[];
}

/** A blank grid; `fill` "" marks every cell as empty, so a layer can be laid over another. */
export function createGrid(width: number, height: number, fill = " "): Grid {
  const size = width * height;
  return { width, height, chars: Array<string>(size).fill(fill), inks: Array<Ink>(size).fill("ink") };
}

export function setCell(grid: Grid, x: number, y: number, char: string, ink: Ink): void {
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return;
  const i = y * grid.width + x;
  grid.chars[i] = char;
  grid.inks[i] = ink;
}

export function writeText(grid: Grid, x: number, y: number, text: string, ink: Ink): void {
  [...text].forEach((char, i) => setCell(grid, x + i, y, char, ink));
}

/** Solid glyphs and dotted glyphs, by slope: flat, steep, rising, falling. */
const SOLID = { flat: "-", steep: "|", rising: "/", falling: "\\" };
const DOTTED = { flat: ".", steep: ":", rising: "'", falling: "'" };

function slope(dx: number, dy: number): keyof typeof SOLID {
  if (Math.abs(dx) > 3 * Math.abs(dy)) return "flat";
  if (Math.abs(dy) > 1.5 * Math.abs(dx)) return "steep";
  return dx * dy < 0 ? "rising" : "falling"; // screen y grows downwards
}

/** The cells of a straight line in cell coordinates, with their glyphs; a dotted line takes every other cell. */
export function lineCells(x0: number, y0: number, x1: number, y1: number, dotted: boolean): { x: number; y: number; char: string }[] {
  const [dx, dy] = [x1 - x0, y1 - y0];
  const char = (dotted ? DOTTED : SOLID)[slope(dx, dy)];
  const steps = Math.max(1, Math.round(Math.max(Math.abs(dx), Math.abs(dy))));
  const cells = [];
  for (let i = 0; i <= steps; i += dotted ? 2 : 1) {
    cells.push({ x: Math.round(x0 + (dx * i) / steps), y: Math.round(y0 + (dy * i) / steps), char });
  }
  return cells;
}

export function drawLine(grid: Grid, x0: number, y0: number, x1: number, y1: number, ink: Ink, dotted: boolean): void {
  for (const { x, y, char } of lineCells(x0, y0, x1, y1, dotted)) setCell(grid, x, y, char, ink);
}

export function rowText(grid: Grid, y: number): string {
  return grid.chars.slice(y * grid.width, (y + 1) * grid.width).join("");
}

/** Indices of the cells whose glyph or color differs, so only those are redrawn. */
export function changedCells(before: Grid, after: Grid): number[] {
  const changed: number[] = [];
  for (let i = 0; i < after.chars.length; i++) {
    if (before.chars[i] !== after.chars[i] || before.inks[i] !== after.inks[i]) changed.push(i);
  }
  return changed;
}
