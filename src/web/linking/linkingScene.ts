/**
 * Live linking (design.md § Animations): the Links a two-sided search tried, played one after another.
 * A Link being tried is ink; a rejected one turns red and dotted, then fades into the halftone (it stays
 * red when there is no answer, so "not possible" ends fully red); an answer Link turns green and solid.
 * At the end the answer flashes gold and sparkles fly off the two end Actors.
 */
import { createGrid, drawLine, type Grid, type Ink, lineCells, setCell } from "../stage/charGrid";
import { dissolved } from "../stage/dissolve";
import { overHalftone } from "../stage/halftone";
import type { Scene } from "../stage/stage";
import { type Cell, layoutLinks, type Linking } from "./linkLayout";

/** Seconds of the run given to each Link tried, kept so the whole run lasts 5 to 15 seconds. */
const PER_LINK = 0.03;
const MIN_TRYING = 3.5;
const MAX_TRYING = 11.5;
/** How long one Link stays ink while it is tried. */
const TRYING = 0.3;
/** A rejected Link stays red this long, then fades into the halftone over FADE. */
const HOLD = 0.6;
const FADE = 0.6;
/** The finish: the answer flashes gold, then sparkles fly. */
const FLASH = 0.5;
const FLASH_HZ = 6;
const SPARKLE = 1;
const SPARKS = 12;
/** How far sparkles fly, in rows. */
const SPARK_REACH = 7;
/** A cell is about twice as tall as it is wide (16px font: ~9.6px wide, 19px tall), so sparkles fly twice as many columns as rows to look round. */
const CELL_ASPECT = 2;
const SPARK_GLYPHS = ["*", "+", ".", "'"];

const pairKey = (p: string, q: string) => (p < q ? `${p}\n${q}` : `${q}\n${p}`);

/** The Links of the answer chain, as unordered pairs. */
function answerPairs(answer: string[]): Set<string> {
  return new Set(answer.slice(1).map((id, k) => pairKey(answer[k]!, id)));
}

/** A rejected cell `fade` (0 to 1) into fading: red, then halftone dots in ink-dim, then nothing. */
function fadedCell(grid: Grid, x: number, y: number, char: string, fade: number): void {
  const glyph = dissolved(char, y * grid.width + x, fade);
  if (glyph !== "") setCell(grid, x, y, glyph, glyph === char ? "red" : "ink-dim");
}

export function linkingScene(linking: Linking): Scene {
  const { ends, tried, answer } = linking;
  const possible = answer.length > 0;
  const onAnswer = answerPairs(answer);
  const trying = Math.min(MAX_TRYING, Math.max(MIN_TRYING, tried.length * PER_LINK));
  const startOf = (i: number) => (i * trying) / Math.max(1, tried.length);
  const settled = trying + TRYING;
  const duration = settled + FLASH + SPARKLE;
  /** The first Link that reached each Actor (the end Actors are there from the start). */
  const reachedBy = new Map<string, number>();
  tried.forEach(({ to }, i) => {
    if (!reachedBy.has(to) && !ends.includes(to)) reachedBy.set(to, i);
  });

  let layout: { columns: number; rows: number; at: Map<string, Cell> } | null = null;
  const positions = (columns: number, rows: number) => {
    if (layout?.columns !== columns || layout.rows !== rows) layout = { columns, rows, at: layoutLinks(linking, columns, rows) };
    return layout.at;
  };

  return {
    duration,
    frame(t, columns, rows) {
      const at = positions(columns, rows);
      const front = createGrid(columns, rows, "");
      const flashing = t >= settled && t < settled + FLASH;
      /** The answer is green, flashing gold just after the last Link. */
      const answerInk: Ink = flashing && Math.floor((t - settled) * FLASH_HZ * 2) % 2 === 0 ? "spark" : "green";
      /** How far a rejected Link or Actor tried at `start` has faded: never, when there is no answer. */
      const fadeOf = (start: number) => (possible ? Math.max(0, (t - start - TRYING - HOLD) / FADE) : 0);

      const inkLines: [Cell, Cell][] = [];
      const greenLines: [Cell, Cell][] = [];
      tried.forEach(({ from, to }, i) => {
        const start = startOf(i);
        if (t < start) return;
        const [p, q] = [at.get(from)!, at.get(to)!];
        if (t < start + TRYING) inkLines.push([p, q]);
        else if (onAnswer.has(pairKey(from, to))) greenLines.push([p, q]);
        else if (fadeOf(start) < 1) {
          for (const { x, y, char } of lineCells(p.x, p.y, q.x, q.y, true)) fadedCell(front, x, y, char, fadeOf(start));
        }
      });
      for (const [p, q] of inkLines) drawLine(front, p.x, p.y, q.x, q.y, "ink", false);
      for (const [p, q] of greenLines) drawLine(front, p.x, p.y, q.x, q.y, answerInk, false);

      for (const [id, i] of reachedBy) {
        const start = startOf(i);
        if (t < start) continue;
        const { x, y } = at.get(id)!;
        if (t < start + TRYING) setCell(front, x, y, "o", "ink");
        else if (answer.includes(id)) setCell(front, x, y, "@", answerInk);
        else if (fadeOf(start) < 1) fadedCell(front, x, y, "+", fadeOf(start));
      }
      for (const end of ends) {
        const { x, y } = at.get(end)!;
        setCell(front, x, y, "@", possible && t >= settled ? answerInk : "accent");
      }

      const sparkled = (t - settled - FLASH) / SPARKLE;
      if (possible && sparkled >= 0 && sparkled < 1) {
        const glyph = SPARK_GLYPHS[Math.floor(sparkled * SPARK_GLYPHS.length)]!;
        for (const end of ends) {
          const { x, y } = at.get(end)!;
          for (let k = 0; k < SPARKS; k++) {
            const angle = (2 * Math.PI * (k + 0.5)) / SPARKS;
            const reach = 1 + sparkled * SPARK_REACH;
            setCell(front, Math.round(x + Math.cos(angle) * reach * CELL_ASPECT), Math.round(y + Math.sin(angle) * reach), glyph, "spark");
          }
        }
      }
      return overHalftone(front, t);
    },
  };
}
