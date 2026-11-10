/** One frame of the enter screen as a character grid: halftone field, turning icosahedron, MOVIE STATISTICS. */
import { bigText, dotText, scaleDots } from "./bigText";
import { createGrid, drawLine, type Grid, setCell } from "../stage/charGrid";
import { dissolved } from "../stage/dissolve";
import { overHalftone } from "./halftone";
import { type Point, viewEdges } from "./icosahedron";

/** The icosahedron is redrawn 30 times a second; the field and the dissolve move every frame. */
const ICOSAHEDRON_FPS = 30;
/** Radians per second around the upright axis. */
const SPIN = 0.45;
/** Share of the smaller screen side the icosahedron fills. */
const SIZE = 0.92;
const WORDS = ["MOVIE", "STATISTICS"];
const FIGLET = bigText(WORDS);
const DOT_FONT = dotText(WORDS);
/** The title's box inside the icosahedron, as shares of its radius: wide, and not quite as tall as the solid. */
const TITLE_WIDTH = 1.5;
const TITLE_HEIGHT = 0.9;

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

/**
 * MOVIE STATISTICS sized to the icosahedron (D27), so the two grow and shrink together: the dot font
 * scaled to fill the title's box when it fits at one row per dot or more, else the FIGlet letters when
 * they fit, else plain text.
 */
export function titleRows(width: number, height: number, aspect: number): string[] {
  const { radius } = stageLayout(width, height, aspect);
  const [boxWidth, boxHeight] = [radius * aspect * TITLE_WIDTH, radius * TITLE_HEIGHT];
  const scale = Math.min(boxHeight / DOT_FONT.length, boxWidth / (DOT_FONT[0]!.length * aspect));
  if (scale >= 1) return scaleDots(DOT_FONT, scale, aspect);
  if (FIGLET[0]!.length <= boxWidth && FIGLET.length <= boxHeight) return FIGLET;
  return WORDS.join(" ").length <= boxWidth ? [WORDS.join(" ")] : WORDS;
}

/**
 * The title in the middle of the icosahedron. Cells next to a letter are cleared, so the
 * wireframe never runs into the letters: they read as set into the solid, not pasted over it.
 */
function drawTitle(grid: Grid, aspect: number, hover: boolean): void {
  const { cx, cy } = stageLayout(grid.width, grid.height, aspect);
  const rows = titleRows(grid.width, grid.height, aspect);
  const top = cy - Math.floor(rows.length / 2);
  const glyphs = rows.flatMap((row, i) =>
    [...row].flatMap((char, j) => (char === " " ? [] : [{ x: cx - Math.floor(row.length / 2) + j, y: top + i, char }])),
  );
  for (const { x, y } of glyphs) for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) setCell(grid, x + dx, y + dy, " ", "ink");
  for (const { x, y, char } of glyphs) setCell(grid, x, y, char, hover ? "accent" : "ink");
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
