import { describe, expect, it } from "vitest";
import { loadDataset } from "./dataset";
import type { Dataset } from "./dataset";
import type { ChainToCenter, ShortestCycle, ShortestPath } from "../shared/types";
import { actorsIn, buildGraph } from "./graph";
import { createOperations, UnknownActorError } from "./operations";

const graph = buildGraph(loadDataset("data/tiny"));
const operations = createOperations(graph);

const titleOf = new Map(graph.movies.map((m) => [m.id, m.title]));
const castOf = new Map(graph.movies.map((m, i) => [m.id, new Set(Array.from(actorsIn(graph, i), (a) => graph.actors[a]!.id))]));

/** The chain starts at a, ends at b, has `distance` Links, and every Link is a Movie both Actors are in. */
function expectValidChain(result: ShortestPath | ChainToCenter, a: string, b: string) {
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

describe("six degrees", () => {
  const idsOf = (actors: { id: string }[]) => actors.map((a) => a.id);

  it("finds the tiny dataset's Layers around Kevin Bacon (paper answer)", () => {
    const { center, layers } = operations.sixDegrees("nm01");
    expect(center.id).toBe("nm01");
    expect(layers.map(idsOf)).toEqual([
      ["nm01"],
      ["nm02", "nm12", "nm13"],
      ["nm03", "nm07", "nm09", "nm14"],
      ["nm04", "nm06", "nm10", "nm11"],
      ["nm05"],
      ["nm08"],
    ]);
  });

  it("puts Actors outside the Center's Group in the can't-be-linked set and in no Layer", () => {
    const { layers, unlinked } = operations.sixDegrees("nm01");
    expect(idsOf(unlinked)).toEqual(["nm15", "nm16", "nm17"]);
    const layered = new Set(layers.flatMap(idsOf));
    for (const id of idsOf(unlinked)) expect(layered).not.toContain(id);
  });

  it("defaults to Kevin Bacon", () => {
    expect(operations.sixDegrees().center.id).toBe("nm01");
    expect(operations.layerSummary().center.id).toBe("nm01");
  });

  it("works around any Center", () => {
    const { layers, unlinked } = operations.sixDegrees("nm16");
    expect(layers.map(idsOf)).toEqual([["nm16"], ["nm15", "nm17"]]);
    expect(unlinked).toHaveLength(14);
  });

  it("summarises the Layer counts and the can't-be-linked count", () => {
    expect(operations.layerSummary("nm01")).toEqual({
      center: { id: "nm01", name: "Kevin Bacon", birthYear: 1958 },
      layerCounts: [1, 3, 4, 4, 1, 1],
      unlinkedCount: 3,
    });
  });

  it("gives a valid shortest chain whose length is the Actor's Layer number", () => {
    const { layers } = operations.sixDegrees("nm01");
    layers.forEach((layer, distance) => {
      for (const actor of layer) {
        const chain = operations.chainToCenter("nm01", actor.id);
        expect(chain.found && chain.distance).toBe(distance);
        expectValidChain(chain, "nm01", actor.id);
      }
    });
  });

  it("picks the lowest-id shortest chain (Xia Ortiz through Sid Moss)", () => {
    const chain = operations.chainToCenter("nm01", "nm14");
    expect(chain.found && chain.movies.map((m) => m.title)).toEqual(["Low Tide", "Low Tide 2"]);
  });

  it("finds no chain for an Actor who can't be linked", () => {
    expect(operations.chainToCenter("nm01", "nm17")).toEqual({ found: false });
  });

  it("gives the shortest chain's ratings: Xia Ortiz through Sid Moss is 6.2 + 6.3", () => {
    expect(operations.chainToCenter("nm01", "nm14")).toMatchObject({ distance: 2, totalRating: 12.5, averageRating: 6.25 });
  });

  it("picks a different best-rated chain for Xia Ortiz in the same Layer (paper answer: 17.3, average 8.65)", () => {
    const shortest = operations.chainToCenter("nm01", "nm14", "shortest");
    const best = operations.chainToCenter("nm01", "nm14", "best-rated");
    expectValidChain(best, "nm01", "nm14");
    expect(best).toMatchObject({ distance: 2, totalRating: 17.3, averageRating: 8.65 });
    expect(best.found && best.movies.map((m) => m.title)).toEqual(["High Noon Redux", "High Noon Redux 2"]);
    expect(best.found && best.movies).not.toEqual(shortest.found && shortest.movies);
  });

  it("keeps Dev Ennis's chain when the lowest-id chain is also the best-rated one (paper answer: 27.4)", () => {
    const best = operations.chainToCenter("nm01", "nm05", "best-rated");
    expect(best).toMatchObject({ distance: 4, totalRating: 27.4 });
    expect(best).toEqual(operations.chainToCenter("nm01", "nm05", "shortest"));
  });

  it("gives a valid best-rated chain whose length is the Actor's Layer number, for every Actor", () => {
    const { layers } = operations.sixDegrees("nm01");
    layers.forEach((layer, distance) => {
      for (const actor of layer) {
        const chain = operations.chainToCenter("nm01", actor.id, "best-rated");
        expect(chain.found && chain.distance).toBe(distance);
        expectValidChain(chain, "nm01", actor.id);
      }
    });
  });

  it("gives the Center itself a chain of no Movies, rating 0 and no average", () => {
    expect(operations.chainToCenter("nm01", "nm01", "best-rated")).toMatchObject({ distance: 0, totalRating: 0, averageRating: null });
  });

  it("finds no best-rated chain for an Actor who can't be linked", () => {
    expect(operations.chainToCenter("nm01", "nm17", "best-rated")).toEqual({ found: false });
  });

  it("breaks best-rated ties by the lowest Actor id, then the lowest Movie id", () => {
    // x3 reaches Layer 1 through x1 (Movie 3) or x2 (Movie 2), all rated 7: the lowest Actor wins, not the lowest Movie.
    const tied = createOperations(buildGraph(datasetOf(["x0", "x1", "x2", "x3"], [["x0", "x1"], ["x0", "x2"], ["x2", "x3"], ["x1", "x3"], ["x1", "x3"]])));
    const chain = tied.chainToCenter("x0", "x3", "best-rated");
    expect(chain.found && chain.actors.map((a) => a.id)).toEqual(["x0", "x1", "x3"]);
    expect(chain.found && chain.movies.map((m) => m.id)).toEqual(["tt0", "tt3"]);
  });

  it("pages the can't-be-linked list in id order and searches it by name", () => {
    expect(operations.unlinked("nm01", "", 0, 2)).toEqual({
      total: 3,
      actors: [
        { id: "nm15", name: "Sam Lee", birthYear: 1988 },
        { id: "nm16", name: "Gus Price", birthYear: 1960 },
      ],
    });
    expect(idsOf(operations.unlinked("nm01", "", 2, 2).actors)).toEqual(["nm17"]);
    // "sam" also matches Sam Lee 1970, who is linked, so only Sam Lee 1988 is listed.
    expect(operations.unlinked("nm01", "SAM", 0, 10)).toEqual({ total: 1, actors: [{ id: "nm15", name: "Sam Lee", birthYear: 1988 }] });
  });

  it("rejects an unknown Center or Actor", () => {
    expect(() => operations.layerSummary("nm99")).toThrow(UnknownActorError);
    expect(() => operations.chainToCenter("nm01", "nm99")).toThrow(UnknownActorError);
  });

  it("falls back to the first Actor when there is no Kevin Bacon", () => {
    const other = createOperations(buildGraph(datasetOf(["x0", "x1"], [["x0", "x1"]])));
    expect(other.layerSummary()).toMatchObject({ center: { id: "x0" }, layerCounts: [1, 1] });
  });
});

/** All Chosen Actors present, the first one first, no Actor repeated, every Link a Movie both Actors are in, and it closes. */
function expectValidCycle(result: ShortestCycle, chosen: string[]) {
  if (result.outcome !== "found") throw new Error("expected a Cycle");
  const ids = result.actors.map((a) => a.id);
  expect(result.length).toBe(ids.length);
  expect(ids[0]).toBe(chosen[0]);
  for (const id of chosen) expect(ids).toContain(id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(result.movies).toHaveLength(ids.length);
  result.movies.forEach((movie, i) => {
    expect(titleOf.get(movie.id)).toBe(movie.title);
    expect(castOf.get(movie.id)).toContain(ids[i]);
    expect(castOf.get(movie.id)).toContain(ids[(i + 1) % ids.length]); // closes back to the first
  });
}

describe("shortestCycle (D6 checks, then IDA* in a worker)", () => {
  it("is not possible for Chosen Actors in different Groups", async () => {
    expect(await operations.shortestCycle(["nm01", "nm02", "nm15"])).toEqual({ outcome: "not-possible", reason: "different-groups" });
  });

  it("is not possible through the tiny dataset's cut actor, and names Dev Ennis", async () => {
    const result = await operations.shortestCycle(["nm08", "nm05", "nm02"]);
    expect(result).toMatchObject({ outcome: "not-possible", reason: "cut-actor" });
    if (result.outcome !== "not-possible" || result.reason !== "cut-actor") throw new Error("expected a cut actor");
    expect(result.cutActor.id).toBe("nm05");
    expect(result.between.map((a) => a.id)).toEqual(["nm08", "nm02"]);
  });

  it("finds Tom, Uma, Sam Lee 1970 at length 3, every Link from the one Movie they share (paper answer)", async () => {
    const result = await operations.shortestCycle(["nm09", "nm10", "nm11"]);
    expectValidCycle(result, ["nm09", "nm10", "nm11"]);
    expect(result).toMatchObject({ outcome: "found", length: 3 });
    if (result.outcome !== "found") throw new Error("expected a Cycle");
    expect(result.movies.map((m) => m.title)).toEqual(["Heat, Again", "Heat, Again", "Heat, Again"]);
  });

  it("finds Kevin Bacon, Sid Moss, Xia Ortiz at length 4, never leaving their block (paper answer)", async () => {
    const result = await operations.shortestCycle(["nm01", "nm12", "nm14"]);
    expectValidCycle(result, ["nm01", "nm12", "nm14"]);
    // Ada Hart is Kevin's lowest-id co-star but outside the block (Open Road is a bridge), so she is never tried.
    expect(result).toMatchObject({ outcome: "found", length: 4, rejected: [], moreRejected: 0 });
    if (result.outcome !== "found") throw new Error("expected a Cycle");
    expect(result.actors.map((a) => a.id)).toEqual(["nm01", "nm12", "nm14", "nm13"]);
  });

  it("finds the k = 6 ring at length 6 (paper answer)", async () => {
    const ring = ["nm02", "nm03", "nm04", "nm05", "nm06", "nm07"];
    const result = await operations.shortestCycle(ring);
    expectValidCycle(result, ring);
    expect(result).toMatchObject({ outcome: "found", length: 6 });
    if (result.outcome !== "found") throw new Error("expected a Cycle");
    expect(result.actors.map((a) => a.id)).toEqual(ring);
  });

  it("is not possible when the Actors share a block but no Cycle exists (K₂,₃)", async () => {
    // c0, c1, c2 are each linked only to the hubs h0 and h1.
    const casts = ["c0", "c1", "c2"].flatMap((c) => [[c, "h0"], [c, "h1"]]);
    const other = createOperations(buildGraph(datasetOf(["c0", "c1", "c2", "h0", "h1"], casts)));
    expect(await other.shortestCycle(["c0", "c1", "c2"])).toMatchObject({ outcome: "not-possible", reason: "no-cycle", moreRejected: 0 });
  });

  it("rejects an unknown Actor", async () => {
    await expect(operations.shortestCycle(["nm01", "nm02", "nm99"])).rejects.toThrow(UnknownActorError);
  });
});
