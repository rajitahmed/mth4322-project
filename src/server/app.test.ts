import { describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { loadDataset } from "./dataset";
import { buildGraph } from "./graph";
import { createOperations } from "./operations";

const operations = createOperations(buildGraph(loadDataset("data/tiny")));
const app = buildApp(operations);

describe("GET /api/actors", () => {
  it("returns matching Actors with id, name and birth year", async () => {
    const response = await app.inject({ url: "/api/actors?q=sam" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      { id: "nm11", name: "Sam Lee", birthYear: 1970 },
      { id: "nm15", name: "Sam Lee", birthYear: 1988 },
    ]);
  });

  it("applies the limit", async () => {
    const response = await app.inject({ url: "/api/actors?q=sam&limit=1" });
    expect(response.json()).toHaveLength(1);
  });

  it("rejects a missing query or a bad limit", async () => {
    expect((await app.inject({ url: "/api/actors" })).statusCode).toBe(400);
    expect((await app.inject({ url: "/api/actors?q=a&limit=0" })).statusCode).toBe(400);
  });
});

describe("GET /api/path", () => {
  it("returns the Distance and the chain of Movies", async () => {
    const response = await app.inject({ url: "/api/path?a=nm01&b=nm05" });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toMatchObject({ found: true, distance: 4 });
    expect(body.movies.map((m: { title: string }) => m.title)).toEqual(["Open Road", "Ring One", "Ring Two", "Ring Three"]);
  });

  it("returns no path for Actors in different Groups", async () => {
    const response = await app.inject({ url: "/api/path?a=nm01&b=nm17" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ found: false });
  });

  it("answers 404 for an unknown Actor and 400 for a missing one", async () => {
    expect((await app.inject({ url: "/api/path?a=nm01&b=nm99" })).statusCode).toBe(404);
    expect((await app.inject({ url: "/api/path?a=nm01" })).statusCode).toBe(400);
  });
});

describe("GET /api/largest-path", () => {
  it("returns the Distance, the two Actors, the chain of Movies and the explored Links", async () => {
    const response = await app.inject({ url: "/api/largest-path" });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toMatchObject({ found: true, distance: 7 });
    expect([body.actors[0].name, body.actors.at(-1).name]).toEqual(["Pia Holt", "Xia Ortiz"]);
    expect(body.movies).toHaveLength(7);
    expect(body.explored.length).toBeGreaterThan(0);
  });

  it("serves one result, computed once when the operations module is created", () => {
    expect(operations.largestPath()).toBe(operations.largestPath());
  });
});

describe("GET /api/six-degrees", () => {
  it("returns the Layer counts and the can't-be-linked count around Kevin Bacon by default", async () => {
    const response = await app.inject({ url: "/api/six-degrees" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      center: { id: "nm01", name: "Kevin Bacon", birthYear: 1958 },
      layerCounts: [1, 3, 4, 4, 1, 1],
      unlinkedCount: 3,
    });
  });

  it("accepts any Center, and answers 404 for an unknown one", async () => {
    const response = await app.inject({ url: "/api/six-degrees?center=nm16" });
    expect(response.json()).toMatchObject({ layerCounts: [1, 2], unlinkedCount: 14 });
    expect((await app.inject({ url: "/api/six-degrees?center=nm99" })).statusCode).toBe(404);
  });
});

describe("GET /api/six-degrees/chain", () => {
  it("returns the chain for one Actor back to the Center", async () => {
    const response = await app.inject({ url: "/api/six-degrees/chain?center=nm01&actor=nm14" });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toMatchObject({ found: true, distance: 2 });
    expect(body.movies.map((m: { title: string }) => m.title)).toEqual(["Low Tide", "Low Tide 2"]);
  });

  it("returns no chain for an Actor who can't be linked, 400 without an Actor, 404 for an unknown one", async () => {
    expect((await app.inject({ url: "/api/six-degrees/chain?actor=nm17" })).json()).toEqual({ found: false });
    expect((await app.inject({ url: "/api/six-degrees/chain" })).statusCode).toBe(400);
    expect((await app.inject({ url: "/api/six-degrees/chain?actor=nm99" })).statusCode).toBe(404);
  });
});

describe("GET /api/six-degrees/unlinked", () => {
  it("returns one page of the can't-be-linked list, searchable by name", async () => {
    const page = await app.inject({ url: "/api/six-degrees/unlinked?center=nm01&offset=1&limit=1" });
    expect(page.statusCode).toBe(200);
    expect(page.json()).toEqual({ total: 3, actors: [{ id: "nm16", name: "Gus Price", birthYear: 1960 }] });
    const search = await app.inject({ url: "/api/six-degrees/unlinked?q=gia" });
    expect(search.json()).toMatchObject({ total: 1, actors: [{ id: "nm17" }] });
  });

  it("rejects a bad page", async () => {
    expect((await app.inject({ url: "/api/six-degrees/unlinked?limit=0" })).statusCode).toBe(400);
    expect((await app.inject({ url: "/api/six-degrees/unlinked?offset=-1" })).statusCode).toBe(400);
  });
});
