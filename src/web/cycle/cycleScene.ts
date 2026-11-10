/**
 * The Cycle animation (design.md § Animations, tab 2). The Chosen Actors sit on a circle as `@`. The final
 * pass's rejected branches are tried one after another: ink, then red and dotted, then faded into the
 * halftone (they stay red when there is no Cycle). Then the closing Links are drawn one by one around the
 * circle: green and solid until the Cycle closes on the first Actor, each labelled with its Movie, then a
 * gold flash and sparkles. With no Cycle they grow in ink and turn red and dotted, so it ends fully red.
 */
import { type Cell, createGrid, type Grid, type Ink, lineCells, setCell, writeText } from "../stage/charGrid";
import { overHalftone } from "../stage/halftone";
import { answerInk, drawRejectedLink, drawSparkles, fadedCell, fadeOf, FLASH, SPARKLE, TRYING } from "../stage/linkMarks";
import type { Scene } from "../stage/stage";
import { type CycleLayout, layoutCycle } from "./cycleLayout";
import type { CycleRun } from "./cycleRun";

/** Seconds per rejected branch, with the whole window kept to MIN–MAX_REJECTING. */
const PER_REJECTED = 0.03;
const MIN_REJECTING = 2;
const MAX_REJECTING = 8;
/** Seconds per closing Link, with the whole window kept to MIN–MAX_CLOSING, so a run lasts 5 to 15 seconds. */
const PER_CLOSING = 0.5;
const MIN_CLOSING = 3.5;
const MAX_CLOSING = 4.5;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** The Links drawn around the circle after the rejections: the Cycle, or (not possible) the circle that can't close, then a cut actor's two routes. */
function closingLinks({ circle, cut }: CycleRun): [string, string][] {
  const around = circle.map((id, i): [string, string] => [id, circle[(i + 1) % circle.length]!]);
  return cut ? [...around, [cut.between[0], cut.actor], [cut.actor, cut.between[1]]] : around;
}

/** The first `progress` (0 to 1) of the solid line p–q, from p. */
function growLine(grid: Grid, p: Cell, q: Cell, progress: number, ink: Ink): void {
  const cells = lineCells(p.x, p.y, q.x, q.y, false);
  for (const { x, y, char } of cells.slice(0, Math.ceil(progress * cells.length))) setCell(grid, x, y, char, ink);
}

export function cycleScene(run: CycleRun): Scene {
  const { chosen, circle, rejected, moreRejected } = run;
  const possible = run.movies !== null;
  const closing = closingLinks(run);

  const rejecting = rejected.length === 0 ? 0 : clamp(rejected.length * PER_REJECTED, MIN_REJECTING, MAX_REJECTING);
  const triedAt = (i: number) => (i * rejecting) / rejected.length;
  const closingStart = rejected.length === 0 ? 0 : rejecting + TRYING;
  const slot = clamp(closing.length * PER_CLOSING, MIN_CLOSING, MAX_CLOSING) / closing.length;
  const settled = closingStart + closing.length * slot;
  const duration = settled + FLASH + SPARKLE;
  /** How far closing Link `j` has been drawn at `t` (0 to 1). */
  const drawn = (j: number, t: number) => clamp((t - closingStart - j * slot) / slot, 0, 1);

  /** When each Actor was first touched by a rejected branch (the circle's Chosen Actors are there from the start). */
  const touched = new Map<string, number>();
  rejected.forEach(({ from, to }, i) => {
    for (const id of [from, to]) if (!touched.has(id)) touched.set(id, i);
  });
  const offCircle = [...touched.keys()].filter((id) => !circle.includes(id));
  const extra = run.cut && !circle.includes(run.cut.actor) ? run.cut.actor : null;

  let layout: { columns: number; rows: number; at: CycleLayout } | null = null;
  const positions = (columns: number, rows: number) => {
    if (layout?.columns !== columns || layout.rows !== rows) layout = { columns, rows, at: layoutCycle(run, columns, rows) };
    return layout.at;
  };

  return {
    duration,
    frame(t, columns, rows) {
      const { at, labels } = positions(columns, rows);
      const front = createGrid(columns, rows, "");
      const finishInk = answerInk(t, settled);
      const faded = (i: number) => fadeOf(t, triedAt(i), possible);

      rejected.forEach(({ from, to }, i) => {
        if (t < triedAt(i)) return;
        const [p, q] = [at.get(from)!, at.get(to)!];
        if (t < triedAt(i) + TRYING) growLine(front, p, q, 1, "ink");
        else drawRejectedLink(front, p, q, faded(i));
      });

      closing.forEach(([from, to], j) => {
        const progress = drawn(j, t);
        if (progress === 0) return;
        const [p, q] = [at.get(from)!, at.get(to)!];
        if (possible) growLine(front, p, q, progress, finishInk);
        else if (progress < 1) growLine(front, p, q, progress, "ink");
        else drawRejectedLink(front, p, q, 0);
      });

      for (const id of offCircle) {
        const i = touched.get(id)!;
        if (t < triedAt(i)) continue;
        const { x, y } = at.get(id)!;
        if (t < triedAt(i) + TRYING) setCell(front, x, y, "o", "ink");
        else fadedCell(front, x, y, "+", faded(i));
      }
      if (extra) {
        const { x, y } = at.get(extra)!;
        const progress = drawn(closing.length - 2, t);
        if (progress > 0) setCell(front, x, y, progress < 1 ? "o" : "+", progress < 1 ? "ink" : "red");
      }
      circle.forEach((id, k) => {
        const { x, y } = at.get(id)!;
        /** The closing Link into circle Actor k; for the first, the last Link, which closes the Cycle. */
        const reached = possible && drawn((k - 1 + circle.length) % circle.length, t) === 1;
        if (reached) setCell(front, x, y, "@", finishInk);
        else if (chosen.includes(id)) setCell(front, x, y, "@", "accent");
        else if (touched.has(id) && t >= triedAt(touched.get(id)!)) setCell(front, x, y, "o", "ink");
      });

      labels.forEach(({ x, y, text }, j) => {
        if (drawn(j, t) === 1) writeText(front, x, y, text, "ink");
      });
      if (moreRejected > 0 && t >= closingStart) writeText(front, 2, rows - 1, `+ ${moreRejected.toLocaleString("en-US")} more branches tried`, "ink");
      if (possible) drawSparkles(front, [at.get(circle[0]!)!], (t - settled - FLASH) / SPARKLE);
      return overHalftone(front, t);
    },
  };
}
