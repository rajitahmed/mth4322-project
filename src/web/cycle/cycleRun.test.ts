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
      names: { p: "Pam", tt: "Heat" },
    };
    expect(cycleRunOf(cycle, ["c", "a", "b"].map(actor))).toEqual({
      outcome: "found",
      chosen: ["c", "a", "b"],
      circle: ["a", "b", "c"],
      movies: ["Heat", "Heat", "Ring One"],
      rejected: [link("a", "p")],
      moreRejected: 7,
      cut: null,
      names: { p: "Pam", tt: "Heat", a: "Name a", b: "Name b", c: "Name c" },
    });
  });

  it("puts the Chosen Actors on the circle when there is no Cycle", () => {
    const chosen = ["a", "b", "c"].map(actor);
    const run = cycleRunOf({ outcome: "not-possible", reason: "no-cycle", rejected: [link("a", "p")], moreRejected: 0, names: {} }, chosen);
    expect(run).toMatchObject({ outcome: "no-cycle", chosen: ["a", "b", "c"], circle: ["a", "b", "c"], movies: null, rejected: [link("a", "p")], cut: null });
    expect(cycleRunOf({ outcome: "not-possible", reason: "different-groups" }, chosen)).toMatchObject({ outcome: "different-groups", rejected: [] });
  });

  it("keeps the cut actor and the pair it splits, named", () => {
    const run = cycleRunOf({ outcome: "not-possible", reason: "cut-actor", cutActor: actor("d"), between: [actor("a"), actor("c")] }, ["a", "b", "c"].map(actor));
    expect(run).toMatchObject({ outcome: "cut-actor", cut: { actor: "d", between: ["a", "c"] }, names: { d: "Name d" } });
  });
});
