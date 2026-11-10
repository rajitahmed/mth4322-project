import type { FoundPath, ShortestPath } from "../shared/types";
import { createActorField, type SearchActors } from "./actorField";
import { button } from "./button";
import { chainText } from "./chainText";
import { linkingOf } from "./linking/linkLayout";
import { linkingScene } from "./linking/linkingScene";
import type { Stage } from "./stage/stage";

export type FindPath = (a: string, b: string) => Promise<ShortestPath>;
export type FindLargestPath = () => Promise<FoundPath>;

/** The result line: the Distance and the chain, or why there is none. */
export function pathLine(path: ShortestPath): string {
  if (!path.found) return "no path: these actors share no chain of movies";
  return `distance ${path.distance}: ${chainText(path)}`;
}

/** Tab 1: `[largest path]` (no input), the optional two Actor fields with `[enter]`, the stage, and the result line. */
export function createPathPanel(
  searchActors: SearchActors,
  findPath: FindPath,
  findLargestPath: FindLargestPath,
  stage: Stage,
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
  element.append(fields, stage.element, result);

  /** Runs a search, plays it on the stage, then shows the result line. */
  const show = async (request: () => Promise<ShortestPath>, picked: [string, string] | null) => {
    const path = await request().catch(() => null);
    result.textContent = path ? pathLine(path) : "search failed, try again";
    result.classList.toggle("not-possible", path !== null && !path.found);
    result.hidden = false;
    if (path) stage.play(linkingScene(linkingOf(path, picked)), (playing) => (result.hidden = playing));
  };
  largestButton.addEventListener("click", () => show(findLargestPath, null));
  enter.addEventListener("click", () => {
    const actorA = a.selected();
    const actorB = b.selected();
    if (actorA && actorB) show(() => findPath(actorA.id, actorB.id), [actorA.id, actorB.id]);
  });
  return element;
}
