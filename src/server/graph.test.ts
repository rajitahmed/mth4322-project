import { describe, expect, it } from "vitest";
import { loadDataset } from "./dataset";
import { actorsIn, buildGraph, moviesOf } from "./graph";

const dataset = loadDataset("data/tiny");
const graph = buildGraph(dataset);
const actor = (id: string) => dataset.actors.findIndex((a) => a.id === id);
const movie = (id: string) => dataset.movies.findIndex((m) => m.id === id);
const ids = (list: Int32Array, of: { id: string }[]) => [...list].map((i) => of[i]!.id);

describe("loadDataset", () => {
  it("reads every Actor, Movie and credit of the tiny dataset", () => {
    expect(dataset.actors).toHaveLength(17);
    expect(dataset.movies).toHaveLength(16);
    expect(dataset.credits).toHaveLength(33);
  });

  it("parses numbers, quoted titles and missing birth years", () => {
    expect(dataset.movies[movie("tt10")]).toEqual({
      id: "tt10", title: "Heat, Again", year: 1999, rating: 8.0, votes: 9900,
    });
    expect(dataset.actors[actor("nm01")]).toEqual({ id: "nm01", name: "Kevin Bacon", birthYear: 1958 });
    expect(dataset.actors[actor("nm10")]!.birthYear).toBeNull();
  });
});

describe("buildGraph", () => {
  it("links each Actor to their Movies, lowest id first", () => {
    expect(ids(moviesOf(graph, actor("nm02")), dataset.movies)).toEqual(["tt01", "tt02", "tt07", "tt09"]);
  });

  it("links each Movie to its Actors, lowest id first", () => {
    expect(ids(actorsIn(graph, movie("tt10")), dataset.actors)).toEqual(["nm09", "nm10", "nm11"]);
  });

  it("gives every Actor a Group label, and the tiny dataset has two Groups", () => {
    expect(graph.groupCount).toBe(2);
    const group = (id: string) => graph.actorGroup[actor(id)];
    const first = ["nm01", "nm02", "nm03", "nm04", "nm05", "nm06", "nm07", "nm08", "nm09", "nm10", "nm11", "nm12", "nm13", "nm14"];
    const second = ["nm15", "nm16", "nm17"];
    expect(new Set(first.map(group)).size).toBe(1);
    expect(new Set(second.map(group)).size).toBe(1);
    expect(group("nm01")).not.toBe(group("nm15"));
  });
});

describe("bad data", () => {
  it("rejects a credit that names an unknown Actor", () => {
    expect(() =>
      buildGraph({ movies: dataset.movies, actors: [], credits: [{ movieId: "tt01", actorId: "nm99" }] }),
    ).toThrow(/nm99/);
  });
});
