/**
 * The marks every search animation shares (design.md § Animations): a tried Link's timing, a rejected
 * cell fading into the halftone, a Link growing, the answer's gold flash, and sparkles. Used by every tab.
 */
import { dissolved } from "./dissolve";
import { type Cell, CELL_ASPECT, type Grid, type Ink, lineCells, setCell } from "./charGrid";

/** How long one Link stays ink while it is tried. */
export const TRYING = 0.3;
/** A rejected Link stays red this long, then fades into the halftone over FADE. */
export const HOLD = 0.6;
export const FADE = 0.6;
/** The finish: the answer flashes gold for FLASH, then sparkles fly for SPARKLE. */
export const FLASH = 0.5;
export const SPARKLE = 1;
const FLASH_HZ = 6;
const SPARKS = 12;
/** How far sparkles fly, in rows. */
const SPARK_REACH = 7;
const SPARK_GLYPHS = ["*", "+", ".", "'"];

/** Cells per second the idle pulse travels along an answer. */
const PULSE_SPEED = 18;
const PULSE_GLYPHS = ["*", "+", "."];

/** `value` kept within min to max. */
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** How far a rejected mark tried at `start` has faded at `t` (0 to 1): never, when `fades` is false (not possible ends fully red). */
export function fadeOf(t: number, start: number, fades: boolean): number {
  return fades ? Math.max(0, (t - start - TRYING - HOLD) / FADE) : 0;
}

/** A rejected cell `fade` (0 to 1) into fading: red, then halftone dots in ink-dim, then nothing. */
export function fadedCell(grid: Grid, x: number, y: number, char: string, fade: number): void {
  const glyph = dissolved(char, y * grid.width + x, fade);
  if (glyph !== "") setCell(grid, x, y, glyph, glyph === char ? "red" : "ink-dim");
}

/** A rejected Link: red and dotted, `fade` (0 to 1) into fading. */
export function drawRejectedLink(grid: Grid, p: Cell, q: Cell, fade: number): void {
  if (fade >= 1) return;
  for (const { x, y, char } of lineCells(p.x, p.y, q.x, q.y, true)) fadedCell(grid, x, y, char, fade);
}

/** The first `progress` (0 to 1) of the solid line p–q, from p. */
export function growLine(grid: Grid, p: Cell, q: Cell, progress: number, ink: Ink): void {
  const cells = lineCells(p.x, p.y, q.x, q.y, false);
  for (const { x, y, char } of cells.slice(0, Math.ceil(progress * cells.length))) setCell(grid, x, y, char, ink);
}

/** The answer's ink at `t`: green, flashing gold for FLASH after `settled`. */
export function answerInk(t: number, settled: number): Ink {
  const flashing = t >= settled && t < settled + FLASH;
  return flashing && Math.floor((t - settled) * FLASH_HZ * 2) % 2 === 0 ? "spark" : "green";
}

/**
 * The idle motion once a run is over (D27): a spark with a short tail travelling along the answer, cell
 * by cell from `path[0]`, looping; `closed` joins the last cell back to the first (a Cycle).
 */
export function drawPulse(grid: Grid, path: Cell[], t: number, closed = false): void {
  const ends = closed ? [...path, path[0]!] : path;
  const cells = ends.slice(1).flatMap((q, k) => lineCells(ends[k]!.x, ends[k]!.y, q.x, q.y, false).slice(1));
  if (cells.length === 0) return;
  // An open path leaves a short gap between laps, so the tail runs off the end before the head comes back.
  const lap = closed ? cells.length : cells.length + PULSE_GLYPHS.length;
  const head = Math.floor(t * PULSE_SPEED) % lap;
  PULSE_GLYPHS.forEach((glyph, back) => {
    const cell = cells[closed ? (head - back + lap) % lap : head - back];
    if (cell) setCell(grid, cell.x, cell.y, glyph, "spark");
  });
}

/** Sparkles flying off each of `from`, `progress` (0 to 1) through their flight; nothing outside that. */
export function drawSparkles(grid: Grid, from: Cell[], progress: number): void {
  if (progress < 0 || progress >= 1) return;
  const glyph = SPARK_GLYPHS[Math.floor(progress * SPARK_GLYPHS.length)]!;
  const reach = 1 + progress * SPARK_REACH;
  for (const { x, y } of from) {
    for (let k = 0; k < SPARKS; k++) {
      const angle = (2 * Math.PI * (k + 0.5)) / SPARKS;
      setCell(grid, Math.round(x + Math.cos(angle) * reach * CELL_ASPECT), Math.round(y + Math.sin(angle) * reach), glyph, "spark");
    }
  }
}
