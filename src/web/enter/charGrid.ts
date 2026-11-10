/** A screen of character cells, each with a glyph and a color token from design.md. */

export type Ink = "ink" | "ink-dim" | "accent";

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

/** A straight line in cell coordinates; a dotted line fills every other cell. */
export function drawLine(grid: Grid, x0: number, y0: number, x1: number, y1: number, ink: Ink, dotted: boolean): void {
  const [dx, dy] = [x1 - x0, y1 - y0];
  const glyph = (dotted ? DOTTED : SOLID)[slope(dx, dy)];
  const steps = Math.max(1, Math.round(Math.max(Math.abs(dx), Math.abs(dy))));
  for (let i = 0; i <= steps; i += dotted ? 2 : 1) {
    setCell(grid, Math.round(x0 + (dx * i) / steps), Math.round(y0 + (dy * i) / steps), glyph, ink);
  }
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
