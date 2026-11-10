import { describe, expect, it } from "vitest";
import { loadDataset } from "./dataset";
import { buildGraph } from "./graph";
import { createOperations } from "./operations";

const operations = createOperations(buildGraph(loadDataset("data/tiny")));

describe("searchActors", () => {
  it("finds Actors by the start of any word in their name", () => {
    expect(operations.searchActors("bacon")).toEqual([{ id: "nm01", name: "Kevin Bacon", birthYear: 1958 }]);
    expect(operations.searchActors("kev")).toEqual([{ id: "nm01", name: "Kevin Bacon", birthYear: 1958 }]);
  });

  it("returns both same-name Actors, told apart by birth year", () => {
    expect(operations.searchActors("sam lee")).toEqual([
      { id: "nm11", name: "Sam Lee", birthYear: 1970 },
      { id: "nm15", name: "Sam Lee", birthYear: 1988 },
    ]);
  });

  it("ignores case, accents and surrounding spaces", () => {
    expect(operations.searchActors("  ÚMA ").map((a) => a.id)).toEqual(["nm10"]);
  });

  it("does not match the middle of a word", () => {
    expect(operations.searchActors("evin")).toEqual([]);
  });

  it("returns nothing for an empty query", () => {
    expect(operations.searchActors("   ")).toEqual([]);
  });

  it("ranks Actors with more Movies first, then by name, and respects the limit", () => {
    // Sid Moss and Sue Nash have 2 Movies each; both Sam Lees have 1.
    expect(operations.searchActors("s", 3).map((a) => a.id)).toEqual(["nm12", "nm13", "nm11"]);
  });
});
