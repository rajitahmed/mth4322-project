import { describe, expect, it } from "vitest";
import type { ActorSummary, Link, ShortestCycle } from "../../shared/types";
import { cycleRunOf } from "./cycleRun";

const actor = (id: string): ActorSummary => ({ id, name: `Name ${id}`, birthYear: null });
const link = (from: string, to: string): Link => ({ from, movie: "tt", to });

describe("cycleRunOf", () => {
  it("puts a found Cycle's Actors on the circle, in order, with each Link's Movie, even one used more than once", () => {
    const cycle: ShortestCycle = {
      outcome: "found",
      length: 3,
      actors: ["a", "b", "c"].map(actor),
      movies: [{ id: "tt1", title: "Heat" }, { id: "tt1", title: "Heat" }, { id: "tt2", title: "Ring One" }],
      rejected: [link("a", "p")],
      moreRejected: 7,
    };
    expect(cycleRunOf(cycle, ["c", "a", "b"])).toEqual({
      chosen: ["c", "a", "b"],
      circle: ["a", "b", "c"],
      movies: ["Heat", "Heat", "Ring One"],
      rejected: [link("a", "p")],
      moreRejected: 7,
      cut: null,
    });
  });

  it("puts the Chosen Actors on the circle when there is no Cycle", () => {
    const run = cycleRunOf({ outcome: "not-possible", reason: "no-cycle", rejected: [link("a", "p")], moreRejected: 0 }, ["a", "b", "c"]);
    expect(run).toEqual({ chosen: ["a", "b", "c"], circle: ["a", "b", "c"], movies: null, rejected: [link("a", "p")], moreRejected: 0, cut: null });
    expect(cycleRunOf({ outcome: "not-possible", reason: "different-groups" }, ["a", "b", "c"]).rejected).toEqual([]);
  });

  it("keeps the cut actor and the pair it splits", () => {
    const run = cycleRunOf({ outcome: "not-possible", reason: "cut-actor", cutActor: actor("b"), between: [actor("a"), actor("c")] }, ["a", "b", "c"]);
    expect(run.cut).toEqual({ actor: "b", between: ["a", "c"] });
  });
});
