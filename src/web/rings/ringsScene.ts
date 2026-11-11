/**
 * Circles inside circles (design.md § Animations, tab 3; D25, D27). The Center is `@` in accent in the
 * middle, named. Without a chain, the Layers are added one at a time from the inside out, each as a ring
 * of dots swept clockwise from the top, then its count; afterwards a dotted sweep keeps turning over the
 * rings. A dot's weight (`·` `•` `●`) says how many Actors it stands for. With a chain (a picked Actor),
 * the rings are already there and the chain is drawn from the picked Actor back to the Center, green and
 * solid, Link by Link, each Actor named as it is reached, then the gold flash and sparkles off both ends,
 * and a spark keeps running down the chain.
 */
import type { ChainToCenter, LayerSummary } from "../../shared/types";
import { count, links } from "../format";
import { CELL_ASPECT, createGrid, drawLine, type Grid, setCell, writeLabel, writeText } from "../stage/charGrid";
import { answerInk, clamp, drawPulse, drawSparkles, FLASH, growLine, SPARKLE } from "../stage/linkMarks";
import type { Scene } from "../stage/stage";
import type { Step } from "../stage/steps";
import { dotOf, layoutRings, type RingsLayout } from "./ringsLayout";

/** What tab 3 plays: the rings around a named Center, and maybe one chain back to it. */
export interface RingsRun {
  center: string;
  layerCounts: number[];
  unlinkedCount: number;
  /** Each chain Actor's position in its Layer (from the Center), its name, and the Movie of each Link. */
  chain: { positions: number[]; names: string[]; movies: string[] } | null;
}

/** The run for a Center's Layers, with `chain` (a found chain to a picked Actor) drawn back to it when given. */
export function ringsRunOf(around: LayerSummary, chain: Extract<ChainToCenter, { found: true }> | null): RingsRun {
  return {
    center: around.center.name,
    layerCounts: around.layerCounts,
    unlinkedCount: around.unlinkedCount,
    chain: chain && { positions: chain.positions, names: chain.actors.map((a) => a.name), movies: chain.movies.map((m) => m.title) },
  };
}

/** Seconds per Layer, with the whole window kept to MIN–MAX_RINGS, then HOLD on the finished picture: 5 to 15 seconds. */
const PER_LAYER = 1;
const MIN_RINGS = 4;
const MAX_RINGS = 12;
const HOLD = 1;
/** The first step (the Center alone) is told for INTRO seconds before anything is drawn, so every step has its own moment. */
const INTRO = 1;
/** A ring is swept in this share of its Layer's slot; the rest is a pause before the next. */
const SWEEP_SHARE = 0.7;
/** Seconds per chain Link, with the whole chain kept to MIN–MAX_CHAIN. */
const PER_LINK = 0.5;
const MIN_CHAIN = 1.5;
const MAX_CHAIN = 4;
/** A dot for this many Actors or more is `●`; fewer (but more than one) is `•`; one is `·`. */
const HEAVY = 10;
/** Seconds the idle sweep takes to go round once. */
const SWEEP_TURN = 8;
/** Longest name written on the stage. */
const NAME_WIDTH = 22;

const weight = (size: number) => (size === 1 ? "·" : size < HEAVY ? "•" : "●");

/** Every ring's dots (all of them, or the first `shown(layer)`) and the counts of the finished rings. */
function drawRings(grid: Grid, { rings, labels }: RingsLayout, shown: (layer: number) => number): void {
  rings.forEach((ring, layer) => {
    if (layer === 0) return;
    const count = shown(layer);
    ring.dots.slice(0, count).forEach(({ x, y, size }) => setCell(grid, x, y, weight(size), "ink"));
    if (count === ring.dots.length) writeText(grid, labels[layer - 1]!.x, labels[layer - 1]!.y, labels[layer - 1]!.text, "ink");
  });
}

/** The rings for `run`: growing around the Center, or with its chain drawn back to the Center. */
export function ringsScene(run: RingsRun): Scene {
  let cached: { columns: number; rows: number; layout: RingsLayout } | null = null;
  const layoutFor = (columns: number, rows: number) => {
    if (cached?.columns !== columns || cached.rows !== rows) cached = { columns, rows, layout: layoutRings(run.layerCounts, columns, rows) };
    return cached.layout;
  };
  return run.chain ? chainScene(run, run.chain, layoutFor) : growingRings(run, layoutFor);
}

/** The Center as `@`, named at the head of the counts (or at the top, with no counts), clear of the rings. */
function drawCenter(grid: Grid, { center, labels }: RingsLayout, name: string): void {
  setCell(grid, center.x, center.y, "@", "accent");
  const head = labels[0];
  if (head) writeLabel(grid, head.x, head.y - 2, `around ${name}`, "accent", grid.width - head.x, "start");
  else writeLabel(grid, center.x, 0, name, "accent", NAME_WIDTH, "center");
}

/** The rings added one Layer at a time: ring i is swept from (i − 1)·slot, one dot after another; then the idle sweep. */
function growingRings(run: RingsRun, layoutFor: (columns: number, rows: number) => RingsLayout): Scene {
  const last = run.layerCounts.length - 1;
  const slot = last === 0 ? 0 : clamp(last * PER_LAYER, MIN_RINGS, MAX_RINGS) / last;
  const sweep = slot * SWEEP_SHARE;
  const duration = INTRO + last * slot + HOLD;
  const steps: Step[] = [{ at: 0, text: `${run.center} is layer 0: every other actor goes in the layer of their distance from ${run.center}` }];
  run.layerCounts.slice(1).forEach((n, i) => steps.push({ at: INTRO + i * slot, text: `layer ${i + 1}: ${count(n)} actors are ${links(i + 1)} from ${run.center}` }));
  steps.push({ at: INTRO + last * slot, text: `${count(run.unlinkedCount)} actors can't be linked to ${run.center}: they are in another group` });
  return {
    duration,
    steps,
    frame(t, columns, rows) {
      const layout = layoutFor(columns, rows);
      const grid = createGrid(columns, rows);
      if (t > duration) drawSweep(grid, layout, t - duration);
      const shown = (layer: number) => {
        const dots = layout.rings[layer]!.dots.length;
        return clamp(Math.floor(((t - INTRO - (layer - 1) * slot) / sweep) * dots), 0, dots);
      };
      drawRings(grid, layout, shown);
      drawCenter(grid, layout, run.center);
      return grid;
    },
  };
}

/** A dotted radius in ink-dim turning slowly clockwise from the top, under the dots. */
function drawSweep(grid: Grid, { center, radius }: RingsLayout, t: number): void {
  const angle = -Math.PI / 2 + (2 * Math.PI * t) / SWEEP_TURN;
  const end = { x: Math.round(center.x + radius * CELL_ASPECT * Math.cos(angle)), y: Math.round(center.y + radius * Math.sin(angle)) };
  drawLine(grid, center.x, center.y, end.x, end.y, "ink-dim", true);
}

/** The finished rings, and the chain drawn from the picked Actor (the last) back to the Center, one Link per slot. */
function chainScene(run: RingsRun, chain: NonNullable<RingsRun["chain"]>, layoutFor: (columns: number, rows: number) => RingsLayout): Scene {
  const { positions, names, movies } = chain;
  const linkCount = positions.length - 1;
  const linking = linkCount === 0 ? 0 : clamp(linkCount * PER_LINK, MIN_CHAIN, MAX_CHAIN);
  const slot = linkCount === 0 ? 0 : linking / linkCount;
  const settled = INTRO + linking;
  const duration = settled + FLASH + SPARKLE;
  /** How far the k-th Link drawn (from chain Actor linkCount − k to linkCount − k − 1) is at `t` (0 to 1). */
  const drawn = (k: number, t: number) => clamp((t - INTRO - k * slot) / slot, 0, 1);
  const picked = names[linkCount]!;
  const steps: Step[] = [{ at: 0, text: `${picked} is in layer ${linkCount}: follow the chain back to ${run.center}` }];
  for (let k = 0; k < linkCount; k++) {
    const [from, to] = [linkCount - k, linkCount - k - 1];
    steps.push({ at: INTRO + k * slot, text: `${names[from]} → ${names[to]} (${movies[to]}), layer ${from} to ${to}` });
  }
  steps.push({ at: settled, text: `${run.center} reached: ${picked} is ${links(linkCount)} away` });
  return {
    duration,
    steps,
    frame(t, columns, rows) {
      const layout = layoutFor(columns, rows);
      const grid = createGrid(columns, rows);
      const finishInk = answerInk(t, settled);
      drawRings(grid, layout, (layer) => layout.rings[layer]!.dots.length);
      drawCenter(grid, layout, run.center);
      const cells = positions.map((position, layer) => dotOf(layout.rings[layer]!, position));
      for (let k = 0; k < linkCount; k++) growLine(grid, cells[linkCount - k]!, cells[linkCount - k - 1]!, drawn(k, t), finishInk);
      cells.forEach(({ x, y }, layer) => {
        /** The picked Actor turns green as its Link starts; every other one when the Link into it is finished. */
        const reached = t >= settled || (layer === linkCount ? drawn(0, t) > 0 : drawn(linkCount - 1 - layer, t) === 1);
        if (reached) setCell(grid, x, y, "@", finishInk);
        else if (layer === linkCount || layer === 0) setCell(grid, x, y, "@", "accent");
        if ((reached || layer === linkCount) && layer > 0) writeLabel(grid, x + 2, y, names[layer]!, reached ? "ink" : "accent", NAME_WIDTH, "start");
      });
      drawSparkles(grid, [cells[linkCount]!, cells[0]!], (t - settled - FLASH) / SPARKLE);
      if (t > duration && linkCount > 0) drawPulse(grid, [...cells].reverse(), t - duration);
      return grid;
    },
  };
}
