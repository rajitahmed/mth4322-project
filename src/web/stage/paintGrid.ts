/** Draws a character grid on a canvas, one cell at a time, the way ascii-sharks does. */
import { changedCells, type Grid } from "./charGrid";

export interface CellSize {
  width: number;
  height: number;
}

/** A canvas ready to paint, and how many character cells fit on it. */
export interface CanvasView {
  ctx: CanvasRenderingContext2D;
  cell: CellSize;
  columns: number;
  rows: number;
}

/** Canvas text size in px (design.md: nothing under 14px). */
const FONT_PX = 16;
/** Row height as a multiple of the font size. */
const LINE_HEIGHT = 1.2;

/** The canvas font: the page's one monospace typeface. */
export const canvasFont = () => `${FONT_PX}px ${getComputedStyle(document.body).fontFamily}`;

/** Sizes the canvas to `width` × `height` CSS px and measures one character cell; null when there is no 2D canvas. */
export function measureCanvas(canvas: HTMLCanvasElement, width: number, height: number): CanvasView | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.floor(width * scale);
  canvas.height = Math.floor(height * scale);
  ctx.scale(scale, scale);
  ctx.font = canvasFont();
  const cell = { width: ctx.measureText("M").width, height: Math.round(FONT_PX * LINE_HEIGHT) };
  return { ctx, cell, columns: Math.ceil(width / cell.width), rows: Math.ceil(height / cell.height) };
}

/** Colors come from the design.md tokens on :root, read once per paint. */
function tokens(): (name: string) => string {
  const style = getComputedStyle(document.documentElement);
  return (name) => style.getPropertyValue(`--${name}`).trim();
}

/** Redraws only the cells that differ from `before` (every cell when there is no `before`). */
export function paintGrid(ctx: CanvasRenderingContext2D, cell: CellSize, after: Grid, before: Grid | null): void {
  const color = tokens();
  const cells = before ? changedCells(before, after) : after.chars.map((_, i) => i);
  ctx.textBaseline = "middle";
  for (const i of cells) {
    const [column, y] = [i % after.width, Math.floor(i / after.width) * cell.height];
    // Cell widths are fractional; snapping both edges to whole pixels leaves no seams between cells.
    const [x, right] = [Math.round(column * cell.width), Math.round((column + 1) * cell.width)];
    ctx.fillStyle = color("bg");
    ctx.fillRect(x, y, right - x, cell.height);
    ctx.fillStyle = color(after.inks[i]!);
    ctx.fillText(after.chars[i]!, x, y + cell.height / 2);
  }
}
