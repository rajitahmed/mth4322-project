import type { ShortestPath } from "../shared/types";
import { createActorField, type SearchActors } from "./actorField";

export type FindPath = (a: string, b: string) => Promise<ShortestPath>;

/** The result line: the Distance and the chain, or why there is none. */
export function pathLine(path: ShortestPath): string {
  if (!path.found) return "no path: these actors share no chain of movies";
  const chain = path.actors.flatMap((actor, i) => (i === 0 ? [actor.name] : [path.movies[i - 1]!.title, actor.name]));
  return `distance ${path.distance}: ${chain.join(" — ")}`;
}

/** Tab 1: two Actor fields, `[enter]`, and the result line. */
export function createPathPanel(searchActors: SearchActors, findPath: FindPath): HTMLElement {
  const element = document.createElement("section");
  const fields = document.createElement("div");
  fields.className = "fields";
  const a = createActorField("actor a", searchActors);
  const b = createActorField("actor b", searchActors);
  const enter = document.createElement("button");
  enter.textContent = "[enter]";
  fields.append(a.element, b.element, enter);
  const result = document.createElement("p");
  result.className = "result";
  element.append(fields, result);

  enter.addEventListener("click", async () => {
    const actorA = a.selected();
    const actorB = b.selected();
    if (!actorA || !actorB) return;
    const path = await findPath(actorA.id, actorB.id).catch(() => null);
    result.textContent = path ? pathLine(path) : "search failed, try again";
    result.classList.toggle("not-possible", path !== null && !path.found);
  });
  return element;
}
