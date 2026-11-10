import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ActorSummary } from "../shared/types";
import { parseCsv } from "./csv";

export interface Movie {
  id: string;
  title: string;
  year: number;
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
      year: Number(r.year),
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
