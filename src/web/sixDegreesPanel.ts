import { type ActorSummary, CHAIN_MODES, type ChainMode, type ChainToCenter, type LayerSummary } from "../shared/types";
import { createActorField, type SearchActors } from "./actorField";
import { button } from "./button";
import { createHeading } from "./heading";
import { createReport, type Report } from "./report";
import { layoutRings, nearestDot } from "./rings/ringsLayout";
import { ringsScene } from "./rings/ringsScene";
import type { Stage } from "./stage/stage";
import { createUnlinkedList, type FindUnlinked } from "./unlinkedList";

/** What tab 3 asks the server (`api.ts`). */
export interface SixDegreesApi {
  findLayers(center?: string): Promise<LayerSummary>;
  findChain(center: string, actor: string, mode: ChainMode): Promise<ChainToCenter>;
  /** Who a dot stands for: the Actor at `position` in Layer `layer`. */
  findActorAt(center: string, layer: number, position: number): Promise<ActorSummary>;
  findUnlinked: FindUnlinked;
  randomActors(count: number): Promise<ActorSummary[]>;
}

/** The answer for a picked Actor: their Layer and the chain's ratings, then the chain from the Center as a graph; or why there is none (in red). */
export function showChain(report: Report, chain: ChainToCenter, actor: ActorSummary, center: ActorSummary): void {
  if (!chain.found) return report.show(`can't be linked: ${actor.name} shares no chain of movies with ${center.name}`, null, "not-possible");
  const ratings = chain.averageRating === null ? "" : ` · rating ${chain.totalRating}, average ${+chain.averageRating.toFixed(2)}`;
  report.show(`layer ${chain.distance}${ratings}`, chain, "answer");
}

/** How the toggle names each chain mode. */
const MODE_LABELS: Record<ChainMode, string> = { shortest: "[shortest link]", "best-rated": "[best-rated link]" };

/**
 * Tab 3: the heading ("six degrees of" the Center); the center field (Kevin Bacon to start) with
 * `[random center]`, an actor field with `[random actor]`, and `[enter]`; the `[shortest link]` /
 * `[best-rated link]` toggle and the `[can't be linked: n]` button; the stage beside the report.
 * Loading a Center plays its rings (circles inside circles). `[enter]` loads the Center in
 * the field if it changed, then draws the picked Actor's chain on the rings; picking a dot
 * does the same for the Actor it stands for. The toggle redraws the chain on screen in the
 * other mode; the Layers stay as they are. `[can't be linked: n]` shows the list in place of the stage.
 */
export function createSixDegreesPanel(searchActors: SearchActors, api: SixDegreesApi, stage: Stage): HTMLElement {
  const element = document.createElement("section");
  element.className = "six-degrees";
  const heading = createHeading("six degrees of Kevin Bacon", "how many links every actor is from the center; any actor can be the center");
  const fields = document.createElement("div");
  fields.className = "fields";
  const centerField = createActorField("center", searchActors);
  const randomCenter = button("[random center]");
  const actorField = createActorField("actor", searchActors);
  const randomActor = button("[random actor]");
  const enter = button("[enter]");
  fields.append(centerField.element, randomCenter, actorField.element, randomActor, enter);
  const toggle = document.createElement("div");
  toggle.className = "modes";
  const modeButtons = CHAIN_MODES.map((m) => ({ mode: m, element: button(MODE_LABELS[m]) }));
  const unlinkedButton = button("");
  unlinkedButton.hidden = true;
  toggle.append(...modeButtons.map((b) => b.element), unlinkedButton);
  /** The counts as page text for screen readers: the stage's canvas is hidden from them. */
  const layers = document.createElement("ul");
  layers.className = "layers visually-hidden";
  const unlinkedList = createUnlinkedList(api.findUnlinked);
  const report = createReport();
  const workspace = document.createElement("div");
  workspace.className = "workspace";
  workspace.append(stage.element, unlinkedList.element, report.element);
  element.append(heading.element, fields, toggle, layers, workspace);

  let summary: LayerSummary | null = null;
  let mode: ChainMode = "shortest";
  let shown: { from: ActorSummary; actor: ActorSummary } | null = null; // the chain in the report
  let latest = 0; // only the newest request may change the screen
  const PICK = "pick an actor, or click a dot on the rings";
  /** Plays the rings around `around`, with `chain` drawn back to the Center when given; `done` fills the report once it ends. */
  const play = (around: LayerSummary, chain: Extract<ChainToCenter, { found: true }> | null, done: () => void) => {
    const named = chain && { positions: chain.positions, names: chain.actors.map((a) => a.name), movies: chain.movies.map((m) => m.title) };
    const run = { center: around.center.name, layerCounts: around.layerCounts, unlinkedCount: around.unlinkedCount, chain: named };
    const playing = chain ? `following the chain back to ${around.center.name}…` : "adding the layers…";
    stage.play(ringsScene(run), (now) => (now ? report.show(playing) : done()));
  };
  let listOpen = false;
  const showList = (open: boolean) => {
    listOpen = open;
    unlinkedButton.setAttribute("aria-expanded", String(open));
    unlinkedList.element.hidden = !open;
    stage.element.hidden = open;
  };
  showList(false);

  /** Loads a Center's Layers (the default Center when no id is given) and plays its rings. False if it failed or was overtaken. */
  const load = async (request: number, centerId?: string): Promise<boolean> => {
    const found = await api.findLayers(centerId).catch(() => null);
    if (request !== latest) return false;
    summary = found;
    layers.replaceChildren();
    showList(false);
    unlinkedButton.hidden = !found;
    if (!found) {
      report.show("search failed, try again");
      return false;
    }
    centerField.set(found.center);
    heading.set(`six degrees of ${found.center.name}`);
    layers.append(
      ...found.layerCounts.map((count, i) => line(`layer ${i}: ${count}`)),
      line(`can't be linked: ${found.unlinkedCount}`),
    );
    unlinkedButton.textContent = `[can't be linked: ${found.unlinkedCount.toLocaleString("en-US")}]`;
    play(found, null, () => report.show(PICK));
    return true;
  };

  /** Asks for one chain in the current mode, shows it in the report, and draws it on the rings when there is one. */
  const askChain = async (request: number, around: LayerSummary, actor: ActorSummary) => {
    const chain = await api.findChain(around.center.id, actor.id, mode).catch(() => null);
    if (request !== latest) return;
    if (!chain) return report.show("search failed, try again");
    shown = { from: around.center, actor };
    if (!chain.found) return showChain(report, chain, actor, around.center);
    showList(false);
    play(around, chain, () => showChain(report, chain, actor, around.center));
  };

  const selectMode = (next: ChainMode) => {
    mode = next;
    for (const b of modeButtons) b.element.setAttribute("aria-pressed", String(b.mode === mode));
  };
  selectMode(mode);
  for (const b of modeButtons) {
    b.element.addEventListener("click", () => {
      showList(false); // the modes and the list share one row: picking a mode always brings the stage back
      if (b.mode === mode) return;
      selectMode(b.mode);
      if (shown && summary) void askChain(++latest, summary, shown.actor);
    });
  }

  unlinkedButton.addEventListener("click", () => {
    showList(!listOpen);
    if (listOpen && summary) unlinkedList.show(summary.center);
  });

  stage.onCellClick(async (cell, columns, rows) => {
    const around = summary;
    if (!around) return;
    const dot = nearestDot(layoutRings(around.layerCounts, columns, rows), cell);
    if (!dot) return;
    const request = ++latest;
    const actor = await api.findActorAt(around.center.id, dot.layer, dot.position).catch(() => null);
    if (request !== latest) return;
    if (!actor) return report.show("search failed, try again");
    actorField.set(actor);
    await askChain(request, around, actor);
  });

  enter.addEventListener("click", async () => {
    const request = ++latest;
    shown = null;
    const picked = centerField.selected();
    if (picked && picked.id !== summary?.center.id && !(await load(request, picked.id))) return;
    const actor = actorField.selected();
    if (actor && summary) await askChain(request, summary, actor);
  });

  /** Fills `field` with a random Actor, then does what `[enter]` does. */
  const randomInto = (field: typeof centerField) => async () => {
    const [actor] = (await api.randomActors(1).catch(() => null)) ?? [];
    if (!actor) return report.show("search failed, try again");
    field.set(actor);
    enter.click();
  };
  randomCenter.addEventListener("click", randomInto(centerField));
  randomActor.addEventListener("click", randomInto(actorField));

  load(++latest);
  return element;
}

function line(text: string): HTMLLIElement {
  const item = document.createElement("li");
  item.textContent = text;
  return item;
}
