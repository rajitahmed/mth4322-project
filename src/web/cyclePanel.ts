import { type CycleCheck, MAX_CHOSEN_ACTORS, MIN_CHOSEN_ACTORS } from "../shared/types";
import { type ActorField, createActorField, type SearchActors } from "./actorField";
import { button } from "./button";

export type FindCycle = (ids: string[]) => Promise<CycleCheck>;

/** The result line: why no Cycle is possible, or that the Chosen Actors share a block. */
export function cycleLine(check: CycleCheck): string {
  if (check.outcome === "shares-block") return "these actors share a block, so a cycle may exist";
  if (check.reason === "different-groups") return "not possible: these actors share no chain of movies";
  const [from, to] = check.between;
  return `not possible: every route from ${from.name} to ${to.name} passes through ${check.cutActor.name}`;
}

/**
 * Tab 2: 3 actor fields, `[add actor]` up to 6, `[enter]`, and the result line.
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
    const check = await findCycle(chosen.map((actor) => actor!.id)).catch(() => null);
    result.textContent = check ? cycleLine(check) : "search failed, try again";
    result.classList.toggle("not-possible", check?.outcome === "not-possible");
  });
  return element;
}
