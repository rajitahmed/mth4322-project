/** A slow halftone dot field: a drifting tone, dithered onto the light-to-dark ramp of design.md. */
import { createGrid, type Grid, setCell } from "../stage/charGrid";

const RAMP = [" ", "·", "•", "●"];

/** 4×4 ordered (Bayer) dither thresholds. */
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** Tone in [0, 1) at cell (x, y) and time t (seconds): two slow waves, mostly near 0. */
function tone(x: number, y: number, t: number): number {
  const wave = 0.5 + 0.25 * Math.sin(x * 0.11 + t * 0.35) + 0.25 * Math.sin(y * 0.23 + x * 0.05 - t * 0.27);
  return Math.min(0.99, Math.max(0, wave - 0.5) * 2);
}

export function halftoneGlyph(x: number, y: number, t: number): string {
  const threshold = (BAYER[y % 4]![x % 4]! + 0.5) / 16;
  return RAMP[Math.min(3, Math.floor(tone(x, y, t) * 3 + threshold))]!;
}

/** `front` laid over the halftone field at time `t`: its empty ("") cells show the field in ink-dim. */
export function overHalftone(front: Grid, t: number): Grid {
  const grid = createGrid(front.width, front.height);
  for (let y = 0; y < front.height; y++) {
    for (let x = 0; x < front.width; x++) {
      const i = y * front.width + x;
      if (front.chars[i] === "") setCell(grid, x, y, halftoneGlyph(x, y, t), "ink-dim");
      else setCell(grid, x, y, front.chars[i]!, front.inks[i]!);
    }
  }
  return grid;
}
