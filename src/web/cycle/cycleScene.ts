/**
 * The Cycle animation (design.md § Animations, tab 2; D24, D27). The Chosen Actors sit on a circle as `@`,
 * named. First the two checks are told (one Group? a cut actor?). Then the final pass's rejected branches
 * are tried one after another, each Actor named while it is tried: ink, then red and dotted, then faded
 * away (they stay red when there is no Cycle). Then the closing Links are drawn one by one around the
 * circle: green and solid until the Cycle closes on the first Actor, each labelled with its Movie, then
 * a gold flash and sparkles, and a spark keeps running around the Cycle. With no Cycle they grow in ink
 * and turn red and dotted, so it ends fully red.
 */
import { count } from "../format";
import { type Cell, CELL_ASPECT, createGrid, type Grid, type Ink, setCell, writeLabel, writeText } from "../stage/charGrid";
import { answerInk, clamp, drawPulse, drawRejectedLink, drawSparkles, fadedCell, fadeOf, FLASH, growLine, HOLD, SPARKLE, TRYING } from "../stage/linkMarks";
import type { Scene } from "../stage/stage";
import type { Step } from "../stage/steps";
import { type CycleLayout, layoutCycle } from "./cycleLayout";
import type { CycleRun } from "./cycleRun";

/** The two checks are told for CHECK seconds each before anything else plays. */
const CHECK = 1.2;
/** Seconds per rejected branch, with the whole window kept to MIN–MAX_REJECTING. */
const PER_REJECTED = 0.03;
const MIN_REJECTING = 2;
const MAX_REJECTING = 5;
/** Seconds per closing Link, with the whole window kept to MIN–MAX_CLOSING, so a run lasts 5 to 15 seconds. */
const PER_CLOSING = 0.5;
const MIN_CLOSING = 3.5;
const MAX_CLOSING = 4.5;
/** Rejected branches told in the steps (spread over the ones tried). */
const TOLD_REJECTED = 6;
/** Longest Actor name written on the stage. */
const NAME_WIDTH = 20;

/** The Links drawn around the circle after the rejections: the Cycle, or (not possible) the circle that can't close, then a cut actor's two routes. */
function closingLinks({ circle, cut }: CycleRun): [string, string][] {
  const around = circle.map((id, i): [string, string] => [id, circle[(i + 1) % circle.length]!]);
  return cut ? [...around, [cut.between[0], cut.actor], [cut.actor, cut.between[1]]] : around;
}

/** A name just outside `cell`, away from the center (cx, cy): beside it at the left and right, above or below it at the top and bottom. */
function writeName(grid: Grid, cell: Cell, cx: number, cy: number, name: string, ink: Ink): void {
  const [dx, dy] = [(cell.x - cx) / CELL_ASPECT, cell.y - cy];
  if (Math.abs(dx) > Math.abs(dy)) writeLabel(grid, dx < 0 ? cell.x - 2 : cell.x + 2, cell.y, name, ink, NAME_WIDTH, dx < 0 ? "end" : "start");
  else writeLabel(grid, cell.x, cell.y + (dy < 0 ? -1 : 1), name, ink, NAME_WIDTH, "center");
}

export function cycleScene(run: CycleRun): Scene {
  const { chosen, circle, rejected, moreRejected, names } = run;
  const name = (id: string) => names[id] ?? id;
  const possible = run.movies !== null;
  const closing = closingLinks(run);
  /** Different Groups stop after the first check; everything else after the second. */
  const checks = run.outcome === "different-groups" ? CHECK : 2 * CHECK;
  /** When the search plays: after the checks, and after its own step ("search for the shortest cycle") when there is a search. */
  const searching = run.outcome === "found" || run.outcome === "no-cycle" ? checks + CHECK : checks;

  const rejecting = rejected.length === 0 ? 0 : clamp(rejected.length * PER_REJECTED, MIN_REJECTING, MAX_REJECTING);
  const triedAt = (i: number) => searching + (i * rejecting) / rejected.length;
  const closingStart = searching + (rejected.length === 0 ? 0 : rejecting + TRYING);
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
    steps: narrate(),
    frame(t, columns, rows) {
      const { at, labels } = positions(columns, rows);
      const [cx, cy] = [(columns - 1) / 2, (rows - 1) / 2];
      const grid = createGrid(columns, rows);
      const finishInk = answerInk(t, settled);
      const faded = (i: number) => fadeOf(t, triedAt(i), possible);
      /** The off-circle Actor most recently reached by a rejected branch, while the branches play. */
      const current = rejected.length === 0 || t < searching ? -1 : Math.min(rejected.length - 1, Math.floor(((t - searching) * rejected.length) / rejecting));
      const trying = t < closingStart ? rejected[current] : undefined;
      const newest = trying && (circle.includes(trying.to) ? trying.from : trying.to);

      rejected.forEach(({ from, to }, i) => {
        if (t < triedAt(i)) return;
        const [p, q] = [at.get(from)!, at.get(to)!];
        if (t < triedAt(i) + TRYING) growLine(grid, p, q, 1, "ink");
        else drawRejectedLink(grid, p, q, faded(i));
      });

      closing.forEach(([from, to], j) => {
        const progress = drawn(j, t);
        if (progress === 0) return;
        const [p, q] = [at.get(from)!, at.get(to)!];
        if (possible) growLine(grid, p, q, progress, finishInk);
        else if (progress < 1) growLine(grid, p, q, progress, "ink");
        else drawRejectedLink(grid, p, q, 0);
      });

      for (const id of offCircle) {
        const i = touched.get(id)!;
        if (t < triedAt(i)) continue;
        const cell = at.get(id)!;
        if (t < triedAt(i) + TRYING) setCell(grid, cell.x, cell.y, "o", "ink");
        else fadedCell(grid, cell.x, cell.y, "+", faded(i));
        // Only the Actor of the branch being tried is named, so names never pile up.
        if (id === newest) writeName(grid, cell, cx, cy, name(id), "ink");
      }
      if (extra) {
        const cell = at.get(extra)!;
        const progress = drawn(closing.length - 2, t);
        if (progress > 0) {
          setCell(grid, cell.x, cell.y, progress < 1 ? "o" : "+", progress < 1 ? "ink" : "red");
          writeLabel(grid, cell.x, cell.y + 1, name(extra), "red", NAME_WIDTH, "center");
        }
      }
      circle.forEach((id, k) => {
        const cell = at.get(id)!;
        /** The closing Link into circle Actor k; for the first, the last Link, which closes the Cycle. */
        const reached = possible && drawn((k - 1 + circle.length) % circle.length, t) === 1;
        const shown = reached || chosen.includes(id) || (touched.has(id) && t >= triedAt(touched.get(id)!));
        if (reached) setCell(grid, cell.x, cell.y, "@", finishInk);
        else if (chosen.includes(id)) setCell(grid, cell.x, cell.y, "@", "accent");
        else if (shown) setCell(grid, cell.x, cell.y, "o", "ink");
        if (reached || chosen.includes(id)) writeName(grid, cell, cx, cy, name(id), reached ? "ink" : "accent");
      });

      labels.forEach(({ x, y, text }, j) => {
        if (drawn(j, t) === 1) writeText(grid, x, y, text, "ink-dim");
      });
      if (moreRejected > 0 && t >= closingStart) writeText(grid, 2, rows - 1, `+ ${count(moreRejected)} more branches tried`, "ink");
      if (possible) drawSparkles(grid, [at.get(circle[0]!)!], (t - settled - FLASH) / SPARKLE);
      if (possible && t > duration) drawPulse(grid, circle.map((id) => at.get(id)!), t - duration, true);
      return grid;
    },
  };

  /** The tale of the run (D27): the checks, a few rejected branches, each closing Link, and the answer. */
  function narrate(): Step[] {
    const list = chosen.map(name).join(", ");
    const steps: Step[] = [{ at: 0, text: `check 1: are ${list} all linked by some chain of movies (one group)?` }];
    if (run.outcome === "different-groups") {
      steps.push({ at: closingStart, text: "no: some of them share no chain of movies at all, so no cycle can hold them all" });
      return steps;
    }
    steps.push({ at: CHECK, text: "yes. check 2: does one actor split them, so every route between two of them passes through it?" });
    if (run.outcome === "cut-actor") {
      const [from, to] = run.cut!.between.map(name);
      steps.push({ at: closingStart, text: `yes: every route from ${from} to ${to} passes through ${name(run.cut!.actor)}, so no cycle can hold both` });
      return steps;
    }
    const limit = possible ? `length ${circle.length}` : "any length";
    steps.push({ at: checks, text: `no, they share one block: search for the shortest cycle (IDA*), last pass with a limit of ${limit}` });
    const told = Math.min(TOLD_REJECTED, rejected.length);
    for (let k = 0; k < told; k++) {
      const i = Math.floor((k * rejected.length) / told);
      const { from, movie, to } = rejected[i]!;
      const why = possible ? `every cycle through it is longer than ${circle.length}` : "no cycle can close through it";
      steps.push({ at: triedAt(i), text: `try ${name(from)} → ${name(to)} (${name(movie)}): rejected, ${why}` });
    }
    if (moreRejected > 0) steps.at(-1)!.text += ` (+ ${count(moreRejected)} more branches tried)`;
    if (!possible) {
      steps.push({ at: closingStart, text: "every branch was rejected: no cycle through all of them exists without repeating an actor" });
      return steps;
    }
    closing.forEach(([from, to], j) => {
      steps.push({ at: closingStart + j * slot, text: `link ${j + 1} of ${closing.length}: ${name(from)} → ${name(to)} (${run.movies![j]})` });
    });
    steps.push({ at: settled, text: `shortest cycle: length ${circle.length}, back to ${name(circle[0]!)}` });
    return steps;
  }
}
