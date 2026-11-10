import { describe, expect, it } from "vitest";
import { loadDataset } from "./dataset";
import type { Dataset } from "./dataset";
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

/** A Dataset from a list of casts: Movie i has the Actors in casts[i]. Actor ids are listed in order. */
function datasetOf(actorIds: string[], casts: string[][]): Dataset {
  return {
    actors: actorIds.map((id) => ({ id, name: id, birthYear: null })),
    movies: casts.map((_, i) => ({ id: `tt${i}`, title: `Movie ${i}`, year: null, rating: 7, votes: 2000 })),
    credits: casts.flatMap((cast, i) => cast.map((actorId) => ({ movieId: `tt${i}`, actorId }))),
  };
}

describe("largestPath", () => {
  it("finds the tiny dataset's single farthest pair, Pia Holt and Xia Ortiz, at Distance 7 (paper answer)", () => {
    const result = operations.largestPath();
    expect(result.distance).toBe(7);
    expect([result.actors[0]!.id, result.actors.at(-1)!.id]).toEqual(["nm08", "nm14"]);
    expect(result.actors).toHaveLength(8);
    expect(result.movies).toHaveLength(7);
    result.movies.forEach((movie, i) => {
      const cast = Array.from(actorsIn(graph, graph.movies.findIndex((m) => m.id === movie.id)), (a) => graph.actors[a]!.id);
      expect(cast).toContain(result.actors[i]!.id);
      expect(cast).toContain(result.actors[i + 1]!.id);
    });
  });

  it("returns the explored Links of a bidirectional BFS between the two endpoints", () => {
    const result = operations.largestPath();
    const replay = operations.shortestPath(result.actors[0]!.id, result.actors.at(-1)!.id);
    expect(result.explored.length).toBeGreaterThan(0);
    expect(result.explored).toEqual(replay.explored);
  });

  it("ignores pairs in separate Groups, and a smaller Group whose farthest pair is farther apart wins", () => {
    // Group 1 (lowest ids, 7 Actors): a star around s0, largest Distance 2.
    // Group 2 (5 Actors): the chain c0 – c1 – c2 – c3 – c4, largest Distance 4.
    const star = ["s0", "s1", "s2", "s3", "s4", "s5", "s6"];
    const chain = ["c0", "c1", "c2", "c3", "c4"];
    const dataset = datasetOf(
      [...star, ...chain],
      [...star.slice(1).map((s) => ["s0", s]), ...chain.slice(1).map((c, i) => [chain[i]!, c])],
    );
    const result = createOperations(buildGraph(dataset)).largestPath();
    expect(result.distance).toBe(4);
    expect([result.actors[0]!.id, result.actors.at(-1)!.id]).toEqual(["c0", "c4"]);
  });

  it("breaks ties by lowest id, across Groups too", () => {
    // Both Groups' largest Distance is 3. The x Group (later ids) is bigger, so it is searched first;
    // the y Group (earliest ids) must still win the tie: y0 – y1 – y2 – y3.
    const dataset = datasetOf(
      ["y0", "y1", "y2", "y3", "x0", "x1", "x2", "x3", "x4"],
      [["x0", "x1"], ["x1", "x2"], ["x2", "x3"], ["x1", "x4"], ["y0", "y1"], ["y1", "y2"], ["y2", "y3"]],
    );
    const result = createOperations(buildGraph(dataset)).largestPath();
    expect(result.distance).toBe(3);
    expect([result.actors[0]!.id, result.actors.at(-1)!.id]).toEqual(["y0", "y3"]);
  });
});
