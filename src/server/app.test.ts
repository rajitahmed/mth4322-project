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
