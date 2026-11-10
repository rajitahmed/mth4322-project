import { describe, expect, it } from "vitest";
import { showRounds } from "./searchRounds";
import type { Round } from "./shortestPath";

const link = (from: number, to: number, side: "a" | "b" = "a") => ({ from, movie: 0, to, side });

describe("showRounds", () => {
  it("keeps every round's count and shows at most `perRound` Links, the answer's first", () => {
    const rounds: Round[] = [{ side: "a", depth: 1, links: [link(0, 1), link(0, 2), link(0, 3), link(0, 4)] }];
    expect(showRounds(rounds, [0, 9], [0, 4, 9], 2)).toEqual([{ side: "a", depth: 1, reached: 4, shown: [link(0, 4), link(0, 1)] }]);
  });

  it("only shows a Link whose first Actor is an end or was shown before", () => {
    const rounds: Round[] = [
      { side: "a", depth: 1, links: [link(0, 1), link(0, 2)] },
      { side: "b", depth: 1, links: [link(9, 8, "b")] },
      { side: "a", depth: 2, links: [link(2, 5), link(1, 6), link(7, 3)] },
    ];
    const shown = showRounds(rounds, [0, 9], [], 1).map((round) => round.shown);
    expect(shown).toEqual([[link(0, 1)], [link(9, 8, "b")], [link(1, 6)]]);
  });

  it("returns no rounds for a search that tried nothing", () => {
    expect(showRounds([], [0, 0], [0])).toEqual([]);
  });
});
