/** Fading a glyph into the halftone background, one cell at a time. */

const DOTS = ["●", "•", "·"];

/** A fixed pseudo-random number in [0, 1) per cell, so each cell fades at its own moment. */
function cellNoise(i: number): number {
  return ((Math.imul(i + 1, 2654435761) >>> 0) % 1000) / 1000;
}

/**
 * The glyph cell `i` shows `progress` (0 to 1) into the fade: itself, then `●` `•` `·`, then nothing.
 * Each cell starts somewhere in the first 70% and takes 30% to fade, so all are gone at 1.
 */
export function dissolved(char: string, i: number, progress: number): string {
  const step = (progress - 0.7 * cellNoise(i)) / 0.3;
  if (step <= 0) return char;
  return step >= 1 ? "" : DOTS[Math.floor(step * DOTS.length)]!;
}
