import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ActorSummary } from "../shared/types";
import { formatCsv, parseCsv } from "./csv";

export interface Movie {
  id: string;
  title: string;
  year: number | null;
  rating: number;
  votes: number;
}

export type Actor = ActorSummary;

export interface Credit {
  movieId: string;
  actorId: string;
}

/** The three CSV files, as records. Row order is kept: it defines "lowest id". */
export interface Dataset {
  movies: Movie[];
  actors: Actor[];
  credits: Credit[];
}

/** Loads movies.csv, actors.csv and credits.csv from a directory. */
export function loadDataset(dir: string): Dataset {
  const read = (file: string) => parseCsv(readFileSync(join(dir, file), "utf8"));
  return {
    movies: read("movies.csv").map((r) => ({
      id: r.id!,
      title: r.title!,
      year: r.year ? Number(r.year) : null,
      rating: Number(r.rating),
      votes: Number(r.votes),
    })),
    actors: read("actors.csv").map((r) => ({
      id: r.id!,
      name: r.name!,
      birthYear: r.birth_year ? Number(r.birth_year) : null,
    })),
    credits: read("credits.csv").map((r) => ({ movieId: r.movie_id!, actorId: r.actor_id! })),
  };
}

/** Writes a Dataset as the three CSV files that loadDataset reads. */
export function writeDataset(dir: string, { movies, actors, credits }: Dataset): void {
  mkdirSync(dir, { recursive: true });
  const write = (file: string, header: string[], rows: string[][]) =>
    writeFileSync(join(dir, file), formatCsv(header, rows));
  write("movies.csv", ["id", "title", "year", "rating", "votes"], movies.map((m) =>
    [m.id, m.title, formatOptional(m.year), String(m.rating), String(m.votes)]));
  write("actors.csv", ["id", "name", "birth_year"], actors.map((a) => [a.id, a.name, formatOptional(a.birthYear)]));
  write("credits.csv", ["movie_id", "actor_id"], credits.map((c) => [c.movieId, c.actorId]));
}

function formatOptional(value: number | null): string {
  return value === null ? "" : String(value);
}
