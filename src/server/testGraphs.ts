import { actorsIn, buildGraph, type Graph, moviesOf } from "./graph";

/** Test helper: a graph from Movie casts given as lists of Actor indices (Actor i is `nm${i}`, Movie m is `tt${m}`). */
export function graphOf(actorCount: number, casts: number[][]): Graph {
  return buildGraph({
    actors: Array.from({ length: actorCount }, (_, i) => ({ id: `nm${i}`, name: `${i}`, birthYear: null })),
    movies: casts.map((_, m) => ({ id: `tt${m}`, title: `${m}`, year: null, rating: 7, votes: 2000 })),
    credits: casts.flatMap((cast, m) => cast.map((a) => ({ movieId: `tt${m}`, actorId: `nm${a}` }))),
  });
}

/**
 * Test helper: a seeded random number in 0 … n − 1, so runs repeat. A 32-bit
 * LCG (Math.imul keeps the product exact) using its high bits: its low bits
 * repeat with a short period.
 */
export function seededRandom(seed: number): (n: number) => number {
  let state = seed;
  return (n) => {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    return (state >>> 16) % n;
  };
}

/** Test helper: seeded random casts of 1–4 Actors, so some Actors have one co-star and some Groups are tiny. */
export function randomGraph(seed: number, actors: number, movies: number): Graph {
  const random = seededRandom(seed);
  return graphOf(
    actors,
    Array.from({ length: movies }, () => [...new Set(Array.from({ length: 1 + random(4) }, () => random(actors)))]),
  );
}

/** Test helper: the Actors linked to `a`, by walking its Movies (independent of any search under test). */
export function coStars(graph: Graph, a: number): Set<number> {
  const result = new Set<number>();
  for (const m of moviesOf(graph, a)) for (const b of actorsIn(graph, m)) if (b !== a) result.add(b);
  return result;
}
