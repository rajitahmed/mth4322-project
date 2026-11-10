/**
 * Live linking, tab 1 (design.md § Animations, D27). The two end Actors sit at the left and right
 * edges, named. The search plays round by round: each round, one side reaches every co-star one Link
 * further, and a few of them are drawn and named while the round is told; the round's count sits above
 * its column. Links off the answer turn red and dotted when their round ends, then fade away (they stay
 * red when there is no answer, so "not possible" ends fully red). Once the sides meet, the answer chain
 * turns green from end to end with every Actor named, flashes gold, and sparkles fly off the two ends.
 * Then a spark keeps running along the chain.
 */
import { compactCount, count, links } from "../format";
import { type Cell, createGrid, drawLine, type Grid, type Ink, setCell, writeLabel } from "../stage/charGrid";
import { answerInk, clamp, drawPulse, drawRejectedLink, drawSparkles, fadedCell, fadeOf, FLASH, growLine, SPARKLE, TRYING } from "../stage/linkMarks";
import type { Scene } from "../stage/stage";
import type { Step } from "../stage/steps";
import { type LinkLayout, layoutLinks, type Linking } from "./linkLayout";

/** The ends are shown alone for INTRO seconds; then each round gets PER_ROUND, the whole search kept to MIN–MAX_SEARCH. */
const INTRO = 1.5;
const PER_ROUND = 1.6;
const MIN_SEARCH = 3;
const MAX_SEARCH = 12;
/** A round's Links are started over this share of its slot. */
const STAGGER = 0.5;
/** Seconds per answer Link as the chain turns green, the whole chain kept to MIN–MAX_REVEAL. */
const PER_REVEAL = 0.3;
const MIN_REVEAL = 1;
const MAX_REVEAL = 3;
/** Names told per round. */
const TOLD = 3;

export function linkingScene(linking: Linking): Scene {
  const { ends, rounds, answer, answerMovies, names } = linking;
  const name = (id: string) => names[id] ?? id;
  const possible = answer.length > 0;
  const onAnswer = new Set(answer);
  const slot = rounds.length === 0 ? 0 : clamp(rounds.length * PER_ROUND, MIN_SEARCH, MAX_SEARCH) / rounds.length;
  const roundStart = (r: number) => INTRO + r * slot;
  const searchEnd = roundStart(rounds.length);
  const reveal = possible ? clamp((answer.length - 1) * PER_REVEAL, MIN_REVEAL, MAX_REVEAL) : 0;
  const settled = searchEnd + reveal;
  const duration = settled + FLASH + (possible ? SPARKLE : 0);
  /** How far the chain has turned green at `t` (0 to 1). */
  const revealed = (t: number) => (reveal === 0 ? 0 : clamp((t - searchEnd) / reveal, 0, 1));

  /** Each shown Link with when it is tried. */
  const tried = rounds.flatMap((round, r) =>
    round.shown.map((link, j) => ({ ...link, round: r, start: roundStart(r) + (j / Math.max(1, round.shown.length)) * slot * STAGGER })),
  );

  let cached: { columns: number; rows: number; layout: LinkLayout } | null = null;
  const layoutFor = (columns: number, rows: number) => {
    if (cached?.columns !== columns || cached.rows !== rows) cached = { columns, rows, layout: layoutLinks(linking, columns, rows) };
    return cached.layout;
  };

  return {
    duration,
    steps: narrate(),
    frame(t, columns, rows) {
      const { at, roundX, spacing, middle } = layoutFor(columns, rows);
      const grid = createGrid(columns, rows);
      const finishInk = answerInk(t, settled);
      /** A Link off the answer turns red when its round ends, then fades (never, when there is no answer). */
      const faded = (round: number) => fadeOf(t, roundStart(round + 1) - TRYING, possible);
      const current = slot === 0 ? -1 : Math.min(rounds.length - 1, Math.floor((t - INTRO) / slot)); // the round being told
      const searching = t < searchEnd;

      // Each round's count, over its column, once the round has started.
      rounds.forEach((round, r) => {
        if (t >= roundStart(r)) writeLabel(grid, roundX[r]!, 0, `+${compactCount(round.reached)}`, r === current && searching ? "accent" : "ink-dim", spacing - 1, "center");
      });

      const answerCells = answer.map((id) => at.get(id)!);
      const greenLinks = Math.floor(revealed(t) * (answer.length - 1) + 1e-9);
      const roundOver = (round: number) => t >= roundStart(round + 1);
      for (const link of tried) {
        if (t < link.start) continue;
        const [p, q] = [at.get(link.from)!, at.get(link.to)!];
        if (!roundOver(link.round)) growLine(grid, p, q, clamp((t - link.start) / TRYING, 0, 1), "ink");
        else if (onAnswer.has(link.from) && onAnswer.has(link.to)) drawLine(grid, p.x, p.y, q.x, q.y, "ink", false);
        else drawRejectedLink(grid, p, q, faded(link.round));
      }
      // The answer turns green from end a to end b.
      for (let k = 0; k < answer.length - 1; k++) {
        const progress = clamp(revealed(t) * (answer.length - 1) - k, 0, 1);
        if (progress > 0) growLine(grid, answerCells[k]!, answerCells[k + 1]!, progress, finishInk);
      }

      for (const link of tried) {
        if (t < link.start || ends.includes(link.to)) continue;
        const { x, y } = at.get(link.to)!;
        const k = answer.indexOf(link.to);
        const green = k >= 0 && revealed(t) > 0 && k <= greenLinks;
        if (green) setCell(grid, x, y, "@", finishInk);
        else if (k >= 0 || !roundOver(link.round)) setCell(grid, x, y, "o", "ink");
        else fadedCell(grid, x, y, "+", faded(link.round));
        // Named while its round is being told.
        if (link.round === current && searching && k < 0) {
          const side = rounds[link.round]!.side;
          writeLabel(grid, side === "a" ? x + 2 : x - 2, y, name(link.to), "ink", 2 * spacing - 3, side === "a" ? "start" : "end");
        }
      }

      // The answer's Actors are named once green, alternating above and below the chain.
      answer.forEach((id, k) => {
        if (k === 0 || k === answer.length - 1 || k > greenLinks || revealed(t) === 0) return;
        writeLabel(grid, answerCells[k]!.x, k % 2 === 1 ? middle + 1 : middle - 1, name(id), "ink", 2 * spacing - 2, "center");
      });
      drawEnds(grid, ends.map((id) => at.get(id)!) as [Cell, Cell], ends.map(name) as [string, string], middle, possible && t >= settled ? finishInk : "accent");

      if (possible) drawSparkles(grid, ends.map((id) => at.get(id)!), (t - settled - FLASH) / SPARKLE);
      if (possible && t > duration) drawPulse(grid, answerCells, t - duration);
      return grid;
    },
  };

  /** The tale of the run, one step per round (D27). */
  function narrate(): Step[] {
    const sideName = (side: "a" | "b") => name(side === "a" ? ends[0] : ends[1]);
    const steps: Step[] = [
      { at: 0, text: `search both ways at once: from ${name(ends[0])} (left) and from ${name(ends[1])} (right)` },
    ];
    rounds.forEach(({ side, depth, reached, shown }, r) => {
      const told = shown.slice(0, TOLD).map((link) => `${name(link.to)} (${name(link.movie)})`);
      const more = reached > told.length ? `, … ${count(reached - told.length)} more` : "";
      steps.push({
        at: roundStart(r),
        text: `round ${r + 1}: from ${sideName(side)}'s side, ${count(reached)} new actors ${links(depth)} away: ${told.join(", ")}${more}`,
      });
    });
    if (!possible) {
      steps.push({ at: searchEnd, text: `no one new to reach: no chain of movies joins ${name(ends[0])} and ${name(ends[1])}` });
      return steps;
    }
    const meeting = rounds.at(-1)?.shown.find((link) => onAnswer.has(link.to))?.to ?? ends[1];
    steps.push({ at: searchEnd, text: `the two sides meet at ${name(meeting)}: distance ${answer.length - 1}` });
    const chain = answer.map((id, k) => (k === 0 ? name(id) : `${name(answerMovies[k - 1]!)} → ${name(id)}`)).join(" → ");
    steps.push({ at: settled, text: `shortest chain: ${chain}` });
    return steps;
  }
}

/** The two ends as `@`, each named on the row above the answer's labels: a's name starting at it, b's ending at it. */
function drawEnds(grid: Grid, [a, b]: [Cell, Cell], [nameA, nameB]: [string, string], middle: number, ink: Ink): void {
  const half = Math.max(1, Math.floor((b.x - a.x) / 2) - 1);
  writeLabel(grid, a.x, middle - 2, nameA, "accent", half, "start");
  writeLabel(grid, b.x, middle - 2, nameB, "accent", half, "end");
  setCell(grid, a.x, a.y, "@", ink);
  setCell(grid, b.x, b.y, "@", ink);
}
