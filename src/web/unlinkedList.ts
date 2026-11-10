import type { ActorSummary, UnlinkedPage } from "../shared/types";
import { actorLabel } from "./actorField";
import { button } from "./button";

export type FindUnlinked = (center: string, query: string, offset: number, limit: number) => Promise<UnlinkedPage>;

/** Actors per page: few enough that the list fits where the stage was, with no page scroll (design.md § Layout). */
export const UNLINKED_PAGE = 10;

export interface UnlinkedList {
  element: HTMLElement;
  /** Shows the first page of the Actors who can't be linked to `center`, with an empty search. */
  show(center: ActorSummary): void;
}

/** The Actors who can't be linked to a Center, one page at a time, searchable by name (the server's rule, D18). */
export function createUnlinkedList(findUnlinked: FindUnlinked): UnlinkedList {
  const element = document.createElement("section");
  element.className = "unlinked";
  const field = document.createElement("label");
  field.className = "actor-field";
  const input = document.createElement("input");
  input.autocomplete = "off";
  input.spellcheck = false;
  field.append("search ", input);
  const list = document.createElement("ul");
  const previous = button("[previous]");
  const next = button("[next]");
  const page = document.createElement("span");
  page.className = "page";
  const nav = document.createElement("div");
  nav.className = "pager";
  nav.append(previous, page, next);
  element.append(field, list, nav);

  let centerId = "";
  let offset = 0;
  let latest = 0; // only the newest request may change the list

  const load = async (at: number) => {
    const request = ++latest;
    offset = at;
    previous.disabled = next.disabled = true;
    const found = await findUnlinked(centerId, input.value.trim(), at, UNLINKED_PAGE).catch(() => null);
    if (request !== latest) return;
    list.replaceChildren(...(found?.actors ?? []).map(item));
    if (!found) return void (page.textContent = "search failed, try again");
    page.textContent = found.total === 0 ? "none" : `${at + 1}–${at + found.actors.length} of ${found.total.toLocaleString("en-US")}`;
    previous.disabled = at === 0;
    next.disabled = at + UNLINKED_PAGE >= found.total;
  };

  input.addEventListener("input", () => load(0));
  previous.addEventListener("click", () => load(Math.max(0, offset - UNLINKED_PAGE)));
  next.addEventListener("click", () => load(offset + UNLINKED_PAGE));

  return {
    element,
    show(center) {
      centerId = center.id;
      input.value = "";
      void load(0);
    },
  };
}

function item(actor: ActorSummary): HTMLLIElement {
  const li = document.createElement("li");
  li.textContent = actorLabel(actor);
  return li;
}
