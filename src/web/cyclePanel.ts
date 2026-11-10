import { MAX_CHOSEN_ACTORS, MIN_CHOSEN_ACTORS, type ShortestCycle } from "../shared/types";
import { type ActorField, createActorField, type SearchActors } from "./actorField";
import { button } from "./button";
import { chainText } from "./chainText";

export type FindCycle = (ids: string[]) => Promise<ShortestCycle>;

/** The result line: the Cycle's length and every Link with its Movie, back to the first Actor, or why there is none. */
export function cycleLine(cycle: ShortestCycle): string {
  if (cycle.outcome === "found") {
    const { length, actors, movies } = cycle;
    return `length ${length}: ${chainText({ distance: length, actors: [...actors, actors[0]!], movies })}`;
  }
  if (cycle.reason === "different-groups") return "not possible: these actors share no chain of movies";
  if (cycle.reason === "no-cycle") return "not possible: no cycle through all of them exists without repeating an actor";
  const [from, to] = cycle.between;
  return `not possible: every route from ${from.name} to ${to.name} passes through ${cycle.cutActor.name}`;
}

/**
 * Tab 2: 3 actor fields, `[add actor]` up to 6, `[enter]`, and the result line
 * (`searching…` while the search runs: it has no time limit).
 * A field never suggests an Actor already picked in another, so the Chosen
 * Actors are always distinct.
 */
export function createCyclePanel(searchActors: SearchActors, findCycle: FindCycle): HTMLElement {
  const element = document.createElement("section");
  const fields = document.createElement("div");
  fields.className = "fields";
  const addActor = button("[add actor]");
  const enter = button("[enter]");
  const result = document.createElement("p");
  result.className = "result";
  element.append(fields, result);

  const actorFields: ActorField[] = [];
  const pickedIds = () => new Set(actorFields.map((field) => field.selected()?.id));
  const searchUnpicked: SearchActors = async (query) => {
    const found = await searchActors(query);
    const picked = pickedIds();
    return found.filter((actor) => !picked.has(actor.id));
  };
  const add = () => {
    const field = createActorField(`actor ${actorFields.length + 1}`, searchUnpicked);
    actorFields.push(field);
    fields.insertBefore(field.element, addActor);
    addActor.disabled = actorFields.length >= MAX_CHOSEN_ACTORS;
  };
  fields.append(addActor, enter);
  for (let i = 0; i < MIN_CHOSEN_ACTORS; i++) add();
  addActor.addEventListener("click", add);

  enter.addEventListener("click", async () => {
    const chosen = actorFields.map((field) => field.selected());
    if (chosen.some((actor) => actor === null)) return;
    result.textContent = "searching…";
    result.classList.remove("not-possible");
    const cycle = await findCycle(chosen.map((actor) => actor!.id)).catch(() => null);
    result.textContent = cycle ? cycleLine(cycle) : "search failed, try again";
    result.classList.toggle("not-possible", cycle?.outcome === "not-possible");
  });
  return element;
}
