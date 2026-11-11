import { type ActorSummary, MAX_CHOSEN_ACTORS, MIN_CHOSEN_ACTORS, type ShortestCycle } from "../shared/types";
import { type ActorField, createActorField, type SearchActors } from "./actorField";
import { button } from "./button";
import { cycleRunOf } from "./cycle/cycleRun";
import { cycleScene } from "./cycle/cycleScene";
import { createHeading } from "./heading";
import { createReport, type Report } from "./report";
import type { Stage } from "./stage/stage";

/** What tab 2 asks the server (`api.ts`). */
export interface CycleApi {
  searchActors: SearchActors;
  findCycle(ids: string[]): Promise<ShortestCycle>;
  randomActors(count: number): Promise<ActorSummary[]>;
}

/** The finished answer: the Cycle's length and the Cycle as a closed graph, or why there is none (in red). */
export function showCycle(report: Report, cycle: ShortestCycle): void {
  if (cycle.outcome === "found") return report.show(`length ${cycle.length}`, { ...cycle, closed: true }, "answer");
  report.show(notPossibleText(cycle), null, "not-possible");
}

function notPossibleText(cycle: Extract<ShortestCycle, { outcome: "not-possible" }>): string {
  if (cycle.reason === "different-groups") return "not possible: these actors share no chain of movies";
  if (cycle.reason === "no-cycle") return "not possible: no cycle through all of them exists without repeating an actor";
  const [from, to] = cycle.between;
  return `not possible: every route from ${from.name} to ${to.name} passes through ${cycle.cutActor.name}`;
}

/**
 * Tab 2: the heading; 3 actor fields, `[add actor]` up to 6 and `[remove actor]` down to 3,
 * `random: [any] [3] [4] [5] [6]` (that many random Actors, or a random number of them, searched at
 * once) and `[enter]`; then the stage beside the report
 * (`searching…` while the search runs: it has no time limit). A field never suggests an Actor already
 * picked in another, so the Chosen Actors are always distinct.
 */
export function createCyclePanel(api: CycleApi, stage: Stage, random: () => number = Math.random): HTMLElement {
  const element = document.createElement("section");
  const heading = createHeading("shortest cycle", "the shortest closed chain of movies through 3 to 6 actors, never repeating an actor");
  const fields = document.createElement("div");
  fields.className = "fields";
  const addActor = button("[add actor]");
  const removeActor = button("[remove actor]");
  const randomChoices = document.createElement("span");
  randomChoices.className = "choices";
  const counts = Array.from({ length: MAX_CHOSEN_ACTORS - MIN_CHOSEN_ACTORS + 1 }, (_, i) => MIN_CHOSEN_ACTORS + i);
  const anyCount = button("[any]");
  const countButtons = counts.map((count) => button(`[${count}]`));
  randomChoices.append("random:", anyCount, ...countButtons);
  const enter = button("[enter]");
  const report = createReport();
  const workspace = document.createElement("div");
  workspace.className = "workspace";
  workspace.append(stage.element, report.element);
  element.append(heading.element, fields, workspace);
  report.show("pick 3 to 6 actors, or try a random set");

  const actorFields: ActorField[] = [];
  const pickedIds = () => new Set(actorFields.map((field) => field.selected()?.id));
  const searchUnpicked: SearchActors = async (query) => {
    const found = await api.searchActors(query);
    const picked = pickedIds();
    return found.filter((actor) => !picked.has(actor.id));
  };
  const fitButtons = () => {
    addActor.disabled = actorFields.length >= MAX_CHOSEN_ACTORS;
    removeActor.disabled = actorFields.length <= MIN_CHOSEN_ACTORS;
  };
  const add = () => {
    const field = createActorField(`actor ${actorFields.length + 1}`, searchUnpicked);
    actorFields.push(field);
    fields.insertBefore(field.element, addActor);
    fitButtons();
  };
  const remove = () => {
    actorFields.pop()!.element.remove();
    fitButtons();
  };
  fields.append(addActor, removeActor, randomChoices, enter);
  for (let i = 0; i < MIN_CHOSEN_ACTORS; i++) add();
  addActor.addEventListener("click", add);
  removeActor.addEventListener("click", remove);

  let latest = 0; // only the newest request may change the screen
  const search = async (chosen: ActorSummary[]) => {
    const asked = ++latest;
    report.show("searching… (no time limit)");
    const cycle = await api.findCycle(chosen.map((actor) => actor.id)).catch(() => null);
    if (asked !== latest) return;
    if (!cycle) return report.show("search failed, try again");
    const names = chosen.map((actor) => actor.name).join(", ");
    stage.play(cycleScene(cycleRunOf(cycle, chosen)), (playing) => (playing ? report.show(`searching: ${names}`) : showCycle(report, cycle)));
  };
  enter.addEventListener("click", () => {
    const chosen = actorFields.map((field) => field.selected());
    if (chosen.every((actor) => actor !== null)) void search(chosen as ActorSummary[]);
  });
  /** Fills `count` fields with random Actors (removing or adding fields to fit) and searches. */
  const searchRandom = async (count: number) => {
    const picked = await api.randomActors(count).catch(() => null);
    if (!picked) return report.show("search failed, try again");
    while (actorFields.length < picked.length) add();
    while (actorFields.length > picked.length) remove();
    picked.forEach((actor, i) => actorFields[i]!.set(actor));
    void search(picked);
  };
  anyCount.addEventListener("click", () => searchRandom(counts[Math.floor(random() * counts.length)]!));
  countButtons.forEach((b, i) => b.addEventListener("click", () => searchRandom(counts[i]!)));
  return element;
}
