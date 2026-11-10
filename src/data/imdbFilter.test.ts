import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadDataset, writeDataset } from "../server/dataset";
import { buildGraph } from "../server/graph";
import { filterImdb, type ImdbSources } from "./imdbFilter";

const tsv = (...rows: string[][]) => rows.map((r) => r.join("\t"));
const lines = async function* (rows: string[]) {
  yield* rows;
};

// One feature film that passes every filter, plus one title per way to fail.
const ratings = tsv(
  ["tconst", "averageRating", "numVotes"],
  ["tt0000010", "6.1", "1100"], // kept: exactly on both thresholds
  ["tt0000002", "6.0", "50000"], // rated below 6.1
  ["tt0000003", "9.0", "1099"], // fewer than 1,100 votes
  ["tt0000004", "8.0", "9000"], // TV movie
  ["tt0000005", "8.0", "9000"], // short
  ["tt0000006", "8.0", "9000"], // video
  ["tt0000007", "8.0", "9000"], // TV episode
  ["tt0000009", "7.5", "2000"], // kept, no year
);
const basics = tsv(
  ["tconst", "titleType", "primaryTitle", "originalTitle", "isAdult", "startYear", "endYear", "runtimeMinutes", "genres"],
  ["tt0000010", "movie", 'Heat, "Again"', "x", "0", "1995", "\\N", "170", "Crime"],
  ["tt0000002", "movie", "Low Rating", "x", "0", "1990", "\\N", "90", "Drama"],
  ["tt0000003", "movie", "Few Votes", "x", "0", "1990", "\\N", "90", "Drama"],
  ["tt0000004", "tvMovie", "A TV Movie", "x", "0", "1990", "\\N", "90", "Drama"],
  ["tt0000005", "short", "A Short", "x", "0", "1990", "\\N", "9", "Drama"],
  ["tt0000006", "video", "A Video", "x", "0", "1990", "\\N", "90", "Drama"],
  ["tt0000007", "tvEpisode", "An Episode", "x", "0", "1990", "\\N", "40", "Drama"],
  ["tt0000008", "movie", "Not Rated", "x", "0", "1990", "\\N", "90", "Drama"],
  ["tt0000009", "movie", "Undated", "x", "0", "\\N", "\\N", "90", "Drama"],
);
const principals = tsv(
  ["tconst", "ordering", "nconst", "category", "job", "characters"],
  ["tt0000010", "1", "nm10000000", "actor", "\\N", '["Neil"]'],
  ["tt0000010", "2", "nm0000002", "actress", "\\N", '["Eady"]'],
  ["tt0000010", "3", "nm0000003", "director", "\\N", "\\N"],
  ["tt0000010", "4", "nm0000004", "writer", "novel", "\\N"],
  ["tt0000010", "5", "nm0000005", "self", "\\N", '["Himself"]'],
  ["tt0000010", "6", "nm0000006", "actor", "\\N", '["No Name Row"]'],
  ["tt0000009", "1", "nm0000002", "actress", "\\N", '["Twin A"]'],
  ["tt0000009", "2", "nm0000002", "actress", "\\N", '["Twin B"]'],
  ["tt0000002", "1", "nm0000007", "actor", "\\N", '["Only In A Dropped Movie"]'],
);
const names = tsv(
  ["nconst", "primaryName", "birthYear", "deathYear", "primaryProfession", "knownForTitles"],
  ["nm0000002", "Eady Ross", "\\N", "\\N", "actress", "tt0000010"],
  ["nm0000003", "Dee Rector", "1950", "\\N", "director", "tt0000010"],
  ["nm0000004", "Wren Writer", "1950", "\\N", "writer", "tt0000010"],
  ["nm0000005", "Sal Self", "1950", "\\N", "self", "tt0000010"],
  ["nm0000007", "Dropped Actor", "1950", "\\N", "actor", "tt0000002"],
  ["nm0000008", "\N", "1950", "\N", "actor", "tt0000010"],
  ["nm10000000", "Neil Long", "1960", "\\N", "actor", "tt0000010"],
);

const sources = (): ImdbSources => ({
  ratings: lines(ratings),
  basics: lines(basics),
  principals: lines(principals),
  names: lines(names),
});

describe("filterImdb", () => {
  it("keeps only feature films rated at least 6.1 from at least 1,100 votes, in id order", async () => {
    const { movies } = await filterImdb(sources());
    expect(movies).toEqual([
      { id: "tt0000009", title: "Undated", year: null, rating: 7.5, votes: 2000 },
      { id: "tt0000010", title: 'Heat, "Again"', year: 1995, rating: 6.1, votes: 1100 },
    ]);
  });

  it("leaves out a Movie rated below 6.1", async () => {
    const { movies } = await filterImdb(sources());
    expect(movies.map((m) => m.id)).not.toContain("tt0000002");
  });

  it("leaves out a Movie with fewer than 1,100 votes", async () => {
    const { movies } = await filterImdb(sources());
    expect(movies.map((m) => m.id)).not.toContain("tt0000003");
  });

  it("leaves out titles that are not feature films", async () => {
    const ids = (await filterImdb(sources())).movies.map((m) => m.id);
    for (const id of ["tt0000004", "tt0000005", "tt0000006", "tt0000007"]) expect(ids).not.toContain(id);
  });

  it("keeps only actors and actresses of kept Movies, in numeric id order", async () => {
    const { actors } = await filterImdb(sources());
    expect(actors).toEqual([
      { id: "nm0000002", name: "Eady Ross", birthYear: null },
      { id: "nm10000000", name: "Neil Long", birthYear: 1960 },
    ]);
  });

  it("credits each kept Actor once per Movie, and only Actors with a name", async () => {
    const { credits } = await filterImdb(sources());
    expect(credits).toEqual([
      { movieId: "tt0000009", actorId: "nm0000002" },
      { movieId: "tt0000010", actorId: "nm0000002" },
      { movieId: "tt0000010", actorId: "nm10000000" },
    ]);
  });

  it("writes CSV files that the loader reads and the graph builder accepts", async () => {
    const dataset = await filterImdb(sources());
    const dir = mkdtempSync(join(tmpdir(), "imdb-"));
    try {
      writeDataset(dir, dataset);
      expect(loadDataset(dir)).toEqual(dataset);
      expect(buildGraph(loadDataset(dir)).groupCount).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
