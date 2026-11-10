import { describe, expect, it } from "vitest";
import { loadDataset } from "./dataset";
import type { ShortestPath } from "../shared/types";
import { actorsIn, buildGraph } from "./graph";
import { createOperations, UnknownActorError } from "./operations";

const graph = buildGraph(loadDataset("data/tiny"));
const operations = createOperations(graph);

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

describe("shortestPath", () => {
  const titleOf = new Map(graph.movies.map((m) => [m.id, m.title]));
  const castOf = new Map(graph.movies.map((m, i) => [m.id, new Set(Array.from(actorsIn(graph, i), (a) => graph.actors[a]!.id))]));

  /** The chain starts at a, ends at b, has `distance` Links, and every Link is a Movie both Actors are in. */
  function expectValidChain(result: ShortestPath, a: string, b: string) {
    if (!result.found) throw new Error("expected a path");
    const { distance, actors, movies } = result;
    expect(actors).toHaveLength(distance + 1);
    expect(movies).toHaveLength(distance);
    expect(actors[0]!.id).toBe(a);
    expect(actors.at(-1)!.id).toBe(b);
    expect(new Set(actors.map((x) => x.id)).size).toBe(actors.length);
    movies.forEach((movie, i) => {
      expect(titleOf.get(movie.id)).toBe(movie.title);
      expect(castOf.get(movie.id)).toContain(actors[i]!.id);
      expect(castOf.get(movie.id)).toContain(actors[i + 1]!.id);
    });
  }

  it("finds Kevin Bacon → Dev Ennis at Distance 4 (paper answer)", () => {
    const result = operations.shortestPath("nm01", "nm05");
    expect(result.found && result.distance).toBe(4);
    expectValidChain(result, "nm01", "nm05");
  });

  it("finds the farthest pair, Pia Holt → Xia Ortiz, at Distance 7 (paper answer)", () => {
    const result = operations.shortestPath("nm08", "nm14");
    expect(result.found && result.distance).toBe(7);
    expectValidChain(result, "nm08", "nm14");
  });

  it("finds Actors who share a Movie at Distance 1", () => {
    const result = operations.shortestPath("nm09", "nm11");
    expect(result.found && result.distance).toBe(1);
    expectValidChain(result, "nm09", "nm11");
  });

  it("finds an Actor at Distance 0 from themself", () => {
    const result = operations.shortestPath("nm03", "nm03");
    expect(result.found && result.distance).toBe(0);
    expectValidChain(result, "nm03", "nm03");
  });

  it("breaks ties by lowest id, so the same pair always gives the same chain", () => {
    // Pia → Xia has three chains of 7; the lowest ids go through Cara, Ben, Kevin and Sid.
    const result = operations.shortestPath("nm08", "nm14");
    expect(result.found && result.actors.map((a) => a.id)).toEqual([
      "nm08", "nm05", "nm04", "nm03", "nm02", "nm01", "nm12", "nm14",
    ]);
  });

  it("reports no path between Actors in different Groups", () => {
    const result = operations.shortestPath("nm01", "nm17");
    expect(result.found).toBe(false);
  });

  it("returns the explored Links: every one is a real Link, and the chain's Links are among them", () => {
    const result = operations.shortestPath("nm01", "nm05");
    if (!result.found) throw new Error("expected a path");
    for (const { from, movie, to } of result.explored) {
      expect(castOf.get(movie)).toContain(from);
      expect(castOf.get(movie)).toContain(to);
    }
    const explored = new Set(result.explored.flatMap(({ from, movie, to }) => [`${from} ${movie} ${to}`, `${to} ${movie} ${from}`]));
    result.movies.forEach((movie, i) => {
      expect(explored).toContain(`${result.actors[i]!.id} ${movie.id} ${result.actors[i + 1]!.id}`);
    });
  });

  it("explores links from both ends, and stays in the Group when there is no path", () => {
    const result = operations.shortestPath("nm15", "nm01");
    expect(result.found).toBe(false);
    const sides = new Set(result.explored.map((link) => link.side));
    expect(sides.size).toBeGreaterThan(0);
    for (const link of result.explored) expect(["nm15", "nm16", "nm17", "nm01", "nm02", "nm12", "nm13"]).toContain(link.from);
  });

  it("rejects an unknown Actor id", () => {
    expect(() => operations.shortestPath("nm01", "nm99")).toThrow(UnknownActorError);
  });
});
