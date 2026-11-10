/** Test fixtures for tab 1: a small two-sided search between Ann (side a) and Bea (side b). */
import type { SearchRound } from "../../shared/types";
import type { Linking } from "./linkLayout";

export const link = (from: string, to: string, side: "a" | "b", movie = "tt0") => ({ from, movie, to, side });

/**
 * Ann – Cal – Bea is the answer (Distance 2). Round 1: Ann's side reaches Cal, Dan, Eve (40 Actors in
 * all); round 2: Bea's side reaches Cal (the meeting) and Fay (7 in all).
 */
export const rounds: SearchRound[] = [
  { side: "a", depth: 1, reached: 40, shown: [link("ann", "cal", "a", "tt1"), link("ann", "dan", "a"), link("ann", "eve", "a")] },
  { side: "b", depth: 1, reached: 7, shown: [link("bea", "cal", "b", "tt2"), link("bea", "fay", "b")] },
];

export const names = {
  ann: "Ann Ash",
  bea: "Bea Birch",
  cal: "Cal Cole",
  dan: "Dan Dee",
  eve: "Eve Elm",
  fay: "Fay Fox",
  tt0: "Some Film",
  tt1: "First Film",
  tt2: "Second Film",
};

export const found: Linking = { ends: ["ann", "bea"], rounds, answer: ["ann", "cal", "bea"], answerMovies: ["tt1", "tt2"], names };

/** No path: Ann's side runs dry after one round. */
export const notFound: Linking = {
  ends: ["ann", "bea"],
  rounds: [{ side: "a", depth: 1, reached: 2, shown: [link("ann", "dan", "a"), link("ann", "eve", "a")] }],
  answer: [],
  answerMovies: [],
  names,
};
