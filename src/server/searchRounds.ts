import type { SearchSide } from "../shared/types";
import type { ExploredLink, Round } from "./shortestPath";

/** How many of a round's Links the animation shows (DECISIONS D27). */
export const SHOWN_PER_ROUND = 6;

/** A round as the animation sees it: how many Actors it reached, and the few Links it shows. */
export interface ShownRound {
  side: SearchSide;
  depth: number;
  reached: number;
  shown: ExploredLink[];
}

/**
 * Picks the Links each round shows, so the animation draws a small tree that reads (D27): every
 * Link into an answer Actor first, then Links from an Actor already shown, in the order tried,
 * up to `perRound`. A shown Link therefore always starts at an end or at an Actor shown before it.
 */
export function showRounds(rounds: Round[], ends: [number, number], answer: number[], perRound = SHOWN_PER_ROUND): ShownRound[] {
  const onAnswer = new Set(answer);
  const shownActors = new Set<number>(ends);
  return rounds.map(({ side, depth, links }) => {
    const answerLinks = links.filter((link) => onAnswer.has(link.to));
    const others = links.filter((link) => !onAnswer.has(link.to) && shownActors.has(link.from));
    const shown = [...answerLinks, ...others.slice(0, Math.max(0, perRound - answerLinks.length))];
    for (const link of shown) shownActors.add(link.to);
    return { side, depth, reached: links.length, shown };
  });
}
