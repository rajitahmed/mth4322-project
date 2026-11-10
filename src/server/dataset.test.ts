import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type Dataset, loadDataset, writeDataset } from "./dataset";

describe("writeDataset", () => {
  let dir: string;
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("writes the three CSV files so that loadDataset reads the same Dataset back", () => {
    dir = mkdtempSync(join(tmpdir(), "dataset-"));
    const dataset: Dataset = {
      movies: [
        { id: "tt9", title: 'Heat, "Again"', year: null, rating: 6.1, votes: 1100 },
        { id: "tt10", title: "Plain", year: 1995, rating: 7, votes: 2000 },
      ],
      actors: [
        { id: "nm2", name: "Eady Ross", birthYear: null },
        { id: "nm10", name: "Neil Long", birthYear: 1960 },
      ],
      credits: [
        { movieId: "tt9", actorId: "nm2" },
        { movieId: "tt10", actorId: "nm10" },
      ],
    };
    writeDataset(dir, dataset);
    expect(loadDataset(dir)).toEqual(dataset);
  });
});
