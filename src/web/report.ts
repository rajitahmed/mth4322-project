import type { ActorSummary, MovieSummary } from "../shared/types";

/** A chain to draw as a graph: Actor, Movie, Actor, … (`movies[i]` links `actors[i]` and `actors[i + 1]`). */
export interface ChainView {
  actors: ActorSummary[];
  movies: MovieSummary[];
  /** A note after each Movie's title, such as its rating. */
  movieNotes?: string[];
  /** A Cycle: one more Movie than Links between `actors`, the last leading back to the first Actor. */
  closed?: boolean;
}

/** How the headline reads: the answer, not possible (red), or plain (searching, or a failed request). */
export type Tone = "answer" | "not-possible" | "plain";

export interface Report {
  element: HTMLElement;
  /** Shows `headline`, with `chain` under it as a graph when given. */
  show(headline: string, chain?: ChainView | null, tone?: Tone): void;
}

/**
 * The result of a tab, beside the stage (D27): a headline in 24px, then the chain drawn top to bottom as
 * a graph, each Actor a node (`@`) and each Movie the edge (`|`) to the next one. It stays page text, so
 * it can be selected and read by screen readers.
 */
export function createReport(): Report {
  const element = document.createElement("section");
  element.className = "report";
  element.setAttribute("aria-live", "polite");
  const headline = document.createElement("p");
  headline.className = "result";
  const list = document.createElement("ol");
  list.className = "chain";
  element.append(headline, list);

  return {
    element,
    show(text, chain = null, tone = "plain") {
      headline.textContent = text;
      headline.classList.toggle("not-possible", tone === "not-possible");
      list.replaceChildren(...(chain ? chainItems(chain) : []));
      list.hidden = !chain;
    },
  };
}

function chainItems({ actors, movies, movieNotes, closed }: ChainView): HTMLLIElement[] {
  const items = actors.flatMap((actor, i) => {
    const movie = movies[i];
    return movie ? [actorItem(actor), movieItem(movie, movieNotes?.[i])] : [actorItem(actor)];
  });
  if (closed && actors.length > 0) items.push(actorItem(actors[0]!, "back to the start"));
  return items;
}

function actorItem({ name, birthYear }: ActorSummary, note = birthYear === null ? "" : String(birthYear)): HTMLLIElement {
  const item = document.createElement("li");
  item.className = "chain-actor";
  item.append(glyph("@"), name, dim(note));
  return item;
}

function movieItem({ title }: MovieSummary, note = ""): HTMLLIElement {
  const item = document.createElement("li");
  item.className = "chain-movie";
  item.append(glyph("|"), title, dim(note));
  return item;
}

function glyph(char: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = "glyph";
  span.setAttribute("aria-hidden", "true");
  span.textContent = char;
  return span;
}

function dim(text: string): HTMLSpanElement | string {
  if (!text) return "";
  const span = document.createElement("span");
  span.className = "dim";
  span.textContent = text;
  return span;
}
