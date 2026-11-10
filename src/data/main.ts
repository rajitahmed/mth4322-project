/**
 * Offline data script: downloads the IMDb non-commercial dataset files (or
 * reuses ones already downloaded) and writes movies.csv, actors.csv and
 * credits.csv. Run on the developer's computer: `npm run data`.
 */
import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { writeDataset } from "../server/dataset";
import { filterImdb } from "./imdbFilter";

const SOURCE_URL = "https://datasets.imdbws.com";
const RAW_DIR = "data/imdb-raw";
const OUT_DIR = "data/imdb";

async function download(file: string): Promise<string> {
  const path = join(RAW_DIR, file);
  if (existsSync(path)) return path;
  console.log(`Downloading ${file}…`);
  const response = await fetch(`${SOURCE_URL}/${file}`);
  if (!response.ok || !response.body) throw new Error(`${file}: HTTP ${response.status}`);
  await pipeline(response.body, createWriteStream(`${path}.part`));
  renameSync(`${path}.part`, path);
  return path;
}

/** Opens the file only when the first line is read, so each pass streams it in turn. */
async function* gzipLines(path: string): AsyncGenerator<string> {
  yield* createInterface({ input: createReadStream(path).pipe(createGunzip()), crlfDelay: Infinity });
}

async function main(): Promise<void> {
  mkdirSync(RAW_DIR, { recursive: true });
  const lines = async (name: string) => gzipLines(await download(`${name}.tsv.gz`));
  const [ratings, basics, principals, names] = await Promise.all([
    lines("title.ratings"),
    lines("title.basics"),
    lines("title.principals"),
    lines("name.basics"),
  ]);
  console.log("Filtering…");
  const dataset = await filterImdb({ ratings, basics, principals, names });
  writeDataset(OUT_DIR, dataset);
  const { movies, actors, credits } = dataset;
  console.log(`Wrote ${movies.length} Movies, ${actors.length} Actors, ${credits.length} credits to ${OUT_DIR}`);
}

await main();
