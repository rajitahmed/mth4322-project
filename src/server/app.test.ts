import { describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { loadDataset } from "./dataset";
import { buildGraph } from "./graph";
import { createOperations } from "./operations";

const app = buildApp(createOperations(buildGraph(loadDataset("data/tiny"))));

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
