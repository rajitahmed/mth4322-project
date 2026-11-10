import type { Actor, Credit, Dataset, Movie } from "../server/dataset";

/** The four IMDb files, each as its lines (header first). */
export interface ImdbSources {
  ratings: AsyncIterable<string>;
  basics: AsyncIterable<string>;
  principals: AsyncIterable<string>;
  names: AsyncIterable<string>;
}

type Rating = Pick<Movie, "rating" | "votes">;

const MIN_RATING = 6.1;
const MIN_VOTES = 1100;
const ACTOR_CATEGORIES = new Set(["actor", "actress"]);
const MISSING = "\\N";

/**
 * Filters the IMDb files down to the Dataset (DECISIONS D15): one streaming
 * pass per file, each keeping only rows whose key a previous pass kept.
 * Rows come out in numeric id order, which is what "lowest id" means (D13).
 */
export async function filterImdb(sources: ImdbSources): Promise<Dataset> {
  const ratings = await readRatings(sources.ratings);
  const movies = await readMovies(sources.basics, ratings);
  const actorIdsOf = await readActorIdsOfMovies(sources.principals, new Set(movies.map((m) => m.id)));
  const actors = await readActors(sources.names, new Set([...actorIdsOf.values()].flatMap((ids) => [...ids])));
  movies.sort(byId);
  actors.sort(byId);
  return { movies, actors, credits: creditsOf(movies, actorIdsOf, new Set(actors.map((a) => a.id))) };
}

/** Pass 1: titles of any type rated at least 6.1 from at least 1,100 votes. */
async function readRatings(lines: AsyncIterable<string>): Promise<Map<string, Rating>> {
  const ratings = new Map<string, Rating>();
  for await (const r of rows(lines)) {
    const rating = Number(r.averageRating);
    const votes = Number(r.numVotes);
    if (rating >= MIN_RATING && votes >= MIN_VOTES) ratings.set(r.tconst!, { rating, votes });
  }
  return ratings;
}

/** Pass 2: the rated titles that are feature films. */
async function readMovies(lines: AsyncIterable<string>, ratings: Map<string, Rating>): Promise<Movie[]> {
  const movies: Movie[] = [];
  for await (const r of rows(lines)) {
    const rated = r.titleType === "movie" && ratings.get(r.tconst!);
    if (rated) movies.push({ id: r.tconst!, title: r.primaryTitle!, year: optionalNumber(r.startYear!), ...rated });
  }
  return movies;
}

/** Pass 3: the actors and actresses of each Movie, once each. */
async function readActorIdsOfMovies(
  lines: AsyncIterable<string>,
  movieIds: Set<string>,
): Promise<Map<string, Set<string>>> {
  const actorIdsOf = new Map<string, Set<string>>();
  for await (const r of rows(lines)) {
    if (!movieIds.has(r.tconst!) || !ACTOR_CATEGORIES.has(r.category!)) continue;
    let ids = actorIdsOf.get(r.tconst!);
    if (!ids) actorIdsOf.set(r.tconst!, (ids = new Set()));
    ids.add(r.nconst!);
  }
  return actorIdsOf;
}

/** Pass 4: the named people among those actors. */
async function readActors(lines: AsyncIterable<string>, actorIds: Set<string>): Promise<Actor[]> {
  const actors: Actor[] = [];
  for await (const r of rows(lines)) {
    if (actorIds.has(r.nconst!) && r.primaryName !== MISSING) {
      actors.push({ id: r.nconst!, name: r.primaryName!, birthYear: optionalNumber(r.birthYear!) });
    }
  }
  return actors;
}

/** One credit per Movie and kept Actor, by Movie, then Actor. */
function creditsOf(movies: Movie[], actorIdsOf: Map<string, Set<string>>, keptActorIds: Set<string>): Credit[] {
  return movies.flatMap(({ id: movieId }) =>
    [...(actorIdsOf.get(movieId) ?? [])]
      .filter((actorId) => keptActorIds.has(actorId))
      .sort(compareIds)
      .map((actorId) => ({ movieId, actorId })),
  );
}

/** IMDb TSV: tab-separated, no quoting, `\N` for a missing value. */
async function* rows(lines: AsyncIterable<string>): AsyncGenerator<Record<string, string>> {
  let header: string[] | undefined;
  for await (const line of lines) {
    const fields = line.split("\t");
    if (!header) header = fields;
    else yield Object.fromEntries(header.map((name, i) => [name, fields[i] ?? ""]));
  }
}

function optionalNumber(field: string): number | null {
  return field === MISSING || field === "" ? null : Number(field);
}

/** IMDb ids are a prefix and a number of varying length: nm9999999 < nm10000000. */
function compareIds(a: string, b: string): number {
  return Number(a.slice(2)) - Number(b.slice(2));
}

function byId(a: { id: string }, b: { id: string }): number {
  return compareIds(a.id, b.id);
}
