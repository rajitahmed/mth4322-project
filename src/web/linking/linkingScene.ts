/**
 * Live linking (design.md § Animations): the Links a two-sided search tried, played one after another.
 * A Link being tried is ink; a rejected one turns red and dotted, then fades into the halftone (it stays
 * red when there is no answer, so "not possible" ends fully red); an answer Link turns green and solid.
 * At the end the answer flashes gold and sparkles fly off the two end Actors.
 */
import { type Cell, createGrid, drawLine, setCell } from "../stage/charGrid";
import { overHalftone } from "../stage/halftone";
import { answerInk, drawRejectedLink, drawSparkles, fadedCell, fadeOf, FLASH, SPARKLE, TRYING } from "../stage/linkMarks";
import type { Scene } from "../stage/stage";
import { layoutLinks, type Linking } from "./linkLayout";

/** Seconds of the run given to each Link tried, kept so the whole run lasts 5 to 15 seconds. */
const PER_LINK = 0.03;
const MIN_TRYING = 3.5;
const MAX_TRYING = 11.5;

const pairKey = (p: string, q: string) => (p < q ? `${p}\n${q}` : `${q}\n${p}`);

/** The Links of the answer chain, as unordered pairs. */
function answerPairs(answer: string[]): Set<string> {
  return new Set(answer.slice(1).map((id, k) => pairKey(answer[k]!, id)));
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
      /** The answer is green, flashing gold just after the last Link. */
      const finishInk = answerInk(t, settled);
      /** How far a rejected Link or Actor tried at `start` has faded: never, when there is no answer. */
      const faded = (start: number) => fadeOf(t, start, possible);

      const inkLines: [Cell, Cell][] = [];
      const greenLines: [Cell, Cell][] = [];
      tried.forEach(({ from, to }, i) => {
        const start = startOf(i);
        if (t < start) return;
        const [p, q] = [at.get(from)!, at.get(to)!];
        if (t < start + TRYING) inkLines.push([p, q]);
        else if (onAnswer.has(pairKey(from, to))) greenLines.push([p, q]);
        else drawRejectedLink(front, p, q, faded(start));
      });
      for (const [p, q] of inkLines) drawLine(front, p.x, p.y, q.x, q.y, "ink", false);
      for (const [p, q] of greenLines) drawLine(front, p.x, p.y, q.x, q.y, finishInk, false);

      for (const [id, i] of reachedBy) {
        const start = startOf(i);
        if (t < start) continue;
        const { x, y } = at.get(id)!;
        if (t < start + TRYING) setCell(front, x, y, "o", "ink");
        else if (answer.includes(id)) setCell(front, x, y, "@", finishInk);
        else if (faded(start) < 1) fadedCell(front, x, y, "+", faded(start));
      }
      for (const end of ends) {
        const { x, y } = at.get(end)!;
        setCell(front, x, y, "@", possible && t >= settled ? finishInk : "accent");
      }

      if (possible) drawSparkles(front, ends.map((end) => at.get(end)!), (t - settled - FLASH) / SPARKLE);
      return overHalftone(front, t);
    },
  };
}
