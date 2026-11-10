/** Draws a character grid on a canvas, one cell at a time, the way ascii-sharks does. */
import { changedCells, type Grid } from "./charGrid";

export interface CellSize {
  width: number;
  height: number;
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
