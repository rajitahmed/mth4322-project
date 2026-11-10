import type { ActorSummary } from "../shared/types";

export type SearchActors = (query: string) => Promise<ActorSummary[]>;

export interface ActorField {
  element: HTMLElement;
  /** The Actor picked from the list, or null. Typed text alone never counts. */
  selected(): ActorSummary | null;
}

/** Same-name Actors are told apart by birth year. */
export function actorLabel({ name, birthYear }: ActorSummary): string {
  return `${name} (${birthYear ?? "born ?"})`;
}

/** A labelled text field that only accepts an Actor picked from its suggestions. */
export function createActorField(label: string, search: SearchActors): ActorField {
  const element = document.createElement("label");
  element.className = "actor-field";
  const input = document.createElement("input");
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.autocomplete = "off";
  input.spellcheck = false;
  const list = document.createElement("ul");
  list.setAttribute("role", "listbox");
  list.className = "suggestions";
  element.append(`${label} `, input, list);

  let suggestions: ActorSummary[] = [];
  let highlighted = -1;
  let picked: ActorSummary | null = null;
  let latestQuery = 0;

  const render = () => {
    list.replaceChildren(
      ...suggestions.map((actor, i) => {
        const option = document.createElement("li");
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", String(i === highlighted));
        option.textContent = actorLabel(actor);
        option.addEventListener("mousedown", (event) => {
          event.preventDefault(); // keep focus, so blur doesn't clear the text first
          pick(actor);
        });
        return option;
      }),
    );
    input.setAttribute("aria-expanded", String(suggestions.length > 0));
  };
  const show = (actors: ActorSummary[]) => {
    suggestions = actors;
    highlighted = -1;
    render();
  };
  const pick = (actor: ActorSummary) => {
    picked = actor;
    input.value = actorLabel(actor);
    show([]);
  };

  input.addEventListener("input", async () => {
    picked = null;
    const query = ++latestQuery;
    const actors = input.value.trim() ? await search(input.value).catch(() => []) : [];
    if (query === latestQuery) show(actors);
  });

  input.addEventListener("keydown", (event) => {
    if (suggestions.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      highlighted = (highlighted + step + suggestions.length) % suggestions.length;
      render();
    } else if (event.key === "Enter" && highlighted >= 0) {
      event.preventDefault();
      pick(suggestions[highlighted]!);
    } else if (event.key === "Escape") {
      show([]);
    }
  });

  input.addEventListener("blur", () => {
    if (!picked) input.value = "";
    show([]);
  });

  return { element, selected: () => picked };
}
