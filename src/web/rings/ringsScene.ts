/**
 * Circles inside circles (design.md § Animations, tab 3). The Center is `@` in accent in the middle.
 * Without a chain, the Layers are added one at a time from the inside out, each as a ring of dots swept
 * clockwise from the top, then its count. A dot's weight (`·` `•` `●`) says how many Actors it stands for.
 * With a chain (a picked Actor), the rings are already there and the chain is drawn from the picked
 * Actor back to the Center, green and solid, Link by Link, then the gold flash and sparkles off both ends.
 */
import { createGrid, type Grid, setCell, writeText } from "../stage/charGrid";
import { overHalftone } from "../stage/halftone";
import { answerInk, clamp, drawSparkles, FLASH, growLine, SPARKLE } from "../stage/linkMarks";
import type { Scene } from "../stage/stage";
import { dotOf, layoutRings, type RingsLayout } from "./ringsLayout";

/** Seconds per Layer, with the whole window kept to MIN–MAX_RINGS, then HOLD on the finished picture: 5 to 15 seconds. */
const PER_LAYER = 1;
const MIN_RINGS = 4;
const MAX_RINGS = 12;
const HOLD = 1;
/** A ring is swept in this share of its Layer's slot; the rest is a pause before the next. */
const SWEEP_SHARE = 0.7;
/** Seconds per chain Link, with the whole chain kept to MIN–MAX_CHAIN. */
const PER_LINK = 0.5;
const MIN_CHAIN = 1.5;
const MAX_CHAIN = 4;
/** A dot for this many Actors or more is `●`; fewer (but more than one) is `•`; one is `·`. */
const HEAVY = 10;

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

/** The rings around a Center with these Layer counts; with `chain` (each chain Actor's position in its Layer), that chain drawn back to the Center. */
export function ringsScene(layerCounts: number[], chain: number[] | null): Scene {
  let cached: { columns: number; rows: number; layout: RingsLayout } | null = null;
  const layoutFor = (columns: number, rows: number) => {
    if (cached?.columns !== columns || cached.rows !== rows) cached = { columns, rows, layout: layoutRings(layerCounts, columns, rows) };
    return cached.layout;
  };
  return chain ? chainScene(chain, layoutFor) : growingRings(layerCounts.length - 1, layoutFor);
}

/** The rings added one Layer at a time: ring i is swept from (i − 1)·slot, one dot after another. */
function growingRings(last: number, layoutFor: (columns: number, rows: number) => RingsLayout): Scene {
  const slot = last === 0 ? 0 : clamp(last * PER_LAYER, MIN_RINGS, MAX_RINGS) / last;
  const sweep = slot * SWEEP_SHARE;
  return {
    duration: last * slot + HOLD,
    frame(t, columns, rows) {
      const layout = layoutFor(columns, rows);
      const front = createGrid(columns, rows, "");
      const shown = (layer: number) => {
        const dots = layout.rings[layer]!.dots.length;
        return clamp(Math.floor(((t - (layer - 1) * slot) / sweep) * dots), 0, dots);
      };
      drawRings(front, layout, shown);
      setCell(front, layout.center.x, layout.center.y, "@", "accent");
      return overHalftone(front, t);
    },
  };
}

/** The finished rings, and the chain drawn from the picked Actor (the last) back to the Center, one Link per slot. */
function chainScene(chain: number[], layoutFor: (columns: number, rows: number) => RingsLayout): Scene {
  const links = chain.length - 1;
  const settled = links === 0 ? 0 : clamp(links * PER_LINK, MIN_CHAIN, MAX_CHAIN);
  const slot = links === 0 ? 0 : settled / links;
  /** How far the k-th Link drawn (from chain Actor links − k to links − k − 1) is at `t` (0 to 1). */
  const drawn = (k: number, t: number) => clamp((t - k * slot) / slot, 0, 1);
  return {
    duration: settled + FLASH + SPARKLE,
    frame(t, columns, rows) {
      const layout = layoutFor(columns, rows);
      const front = createGrid(columns, rows, "");
      const finishInk = answerInk(t, settled);
      drawRings(front, layout, (layer) => layout.rings[layer]!.dots.length);
      const cells = chain.map((position, layer) => dotOf(layout.rings[layer]!, position));
      for (let k = 0; k < links; k++) growLine(front, cells[links - k]!, cells[links - k - 1]!, drawn(k, t), finishInk);
      cells.forEach(({ x, y }, layer) => {
        /** The picked Actor turns green as its Link starts; every other one when the Link into it is finished. */
        const reached = t >= settled || (layer === links ? drawn(0, t) > 0 : drawn(links - 1 - layer, t) === 1);
        if (reached) setCell(front, x, y, "@", finishInk);
        else if (layer === links || layer === 0) setCell(front, x, y, "@", "accent");
      });
      drawSparkles(front, [cells[links]!, cells[0]!], (t - settled - FLASH) / SPARKLE);
      return overHalftone(front, t);
    },
  };
}
