import type { FoundPath, ShortestPath } from "../shared/types";
import { createActorField, type SearchActors } from "./actorField";

export type FindPath = (a: string, b: string) => Promise<ShortestPath>;
export type FindLargestPath = () => Promise<FoundPath>;

/** The result line: the Distance and the chain, or why there is none. */
export function pathLine(path: ShortestPath): string {
  if (!path.found) return "no path: these actors share no chain of movies";
  const chain = path.actors.flatMap((actor, i) => (i === 0 ? [actor.name] : [path.movies[i - 1]!.title, actor.name]));
  return `distance ${path.distance}: ${chain.join(" — ")}`;
}

/** Tab 1: `[largest path]` (no input), the optional two Actor fields with `[enter]`, and the result line. */
export function createPathPanel(
  searchActors: SearchActors,
  findPath: FindPath,
  findLargestPath: FindLargestPath,
): HTMLElement {
  const element = document.createElement("section");
  const fields = document.createElement("div");
  fields.className = "fields";
  const largestButton = button("[largest path]");
  const a = createActorField("actor a", searchActors);
  const b = createActorField("actor b", searchActors);
  const enter = button("[enter]");
  fields.append(largestButton, a.element, b.element, enter);
  const result = document.createElement("p");
  result.className = "result";
  element.append(fields, result);

  const show = async (request: () => Promise<ShortestPath>) => {
    const path = await request().catch(() => null);
    result.textContent = path ? pathLine(path) : "search failed, try again";
    result.classList.toggle("not-possible", path !== null && !path.found);
  };
  largestButton.addEventListener("click", () => show(findLargestPath));
  enter.addEventListener("click", () => {
    const actorA = a.selected();
    const actorB = b.selected();
    if (actorA && actorB) show(() => findPath(actorA.id, actorB.id));
  });
  return element;
}

function button(text: string): HTMLButtonElement {
  const element = document.createElement("button");
  element.textContent = text;
  return element;
}
