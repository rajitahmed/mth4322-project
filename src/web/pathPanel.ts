import type { ActorSummary, FoundPath, ShortestPath } from "../shared/types";
import { createActorField, type SearchActors } from "./actorField";
import { button } from "./button";
import { createHeading } from "./heading";
import { linkingOf } from "./linking/linkLayout";
import { linkingScene } from "./linking/linkingScene";
import { createReport, type Report } from "./report";
import type { Stage } from "./stage/stage";

/** What tab 1 asks the server (`api.ts`). */
export interface PathApi {
  searchActors: SearchActors;
  findPath(a: string, b: string): Promise<ShortestPath>;
  findLargestPath(): Promise<FoundPath>;
  randomActors(count: number): Promise<ActorSummary[]>;
}

/** The finished answer: the Distance and the chain as a graph, or why there is none. */
export function showPath(report: Report, path: ShortestPath): void {
  if (!path.found) return report.show("no path: these actors share no chain of movies", null, "not-possible");
  report.show(`distance ${path.distance}`, path, "answer");
}

/**
 * Tab 1: the heading; `[largest path]` (no input), the two Actor fields, `[random]` and `[enter]`; then
 * the stage beside the report. While the search plays the report names the two ends; at the end it
 * shows the answer.
 */
export function createPathPanel(api: PathApi, stage: Stage): HTMLElement {
  const element = document.createElement("section");
  const heading = createHeading("largest path", "the two actors furthest apart, or the shortest chain of movies between any two");
  const fields = document.createElement("div");
  fields.className = "fields";
  const largestButton = button("[largest path]");
  const a = createActorField("actor a", api.searchActors);
  const b = createActorField("actor b", api.searchActors);
  const random = button("[random]");
  const enter = button("[enter]");
  fields.append(largestButton, a.element, b.element, random, enter);
  const report = createReport();
  const workspace = document.createElement("div");
  workspace.className = "workspace";
  workspace.append(stage.element, report.element);
  element.append(heading.element, fields, workspace);
  report.show("pick two actors, or find the [largest path]");

  let latest = 0; // only the newest request may change the screen
  /** Runs a search, plays it on the stage, then shows the answer in the report. */
  const show = async (request: () => Promise<ShortestPath>, picked: [ActorSummary, ActorSummary] | null) => {
    const asked = ++latest;
    report.show("searching…");
    const path = await request().catch(() => null);
    if (asked !== latest) return;
    if (!path) return report.show("search failed, try again");
    const linking = linkingOf(path, picked);
    const [from, to] = linking.ends.map((id) => linking.names[id]);
    stage.play(linkingScene(linking), (playing) => (playing ? report.show(`searching: ${from} and ${to}`) : showPath(report, path)));
  };
  largestButton.addEventListener("click", () => show(api.findLargestPath, null));
  enter.addEventListener("click", () => {
    const [actorA, actorB] = [a.selected(), b.selected()];
    if (actorA && actorB) show(() => api.findPath(actorA.id, actorB.id), [actorA, actorB]);
  });
  random.addEventListener("click", async () => {
    const picked = await api.randomActors(2).catch(() => null);
    if (!picked) return report.show("search failed, try again");
    a.set(picked[0]!);
    b.set(picked[1]!);
    enter.click();
  });
  return element;
}
