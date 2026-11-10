import { type ActorSummary, CHAIN_MODES, type ChainMode, type ChainToCenter, type LayerSummary } from "../shared/types";
import { createActorField, type SearchActors } from "./actorField";
import { button } from "./button";
import { chainText } from "./chainText";
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
}

/** The result line for a picked Actor: their Layer, chain from the Center and its ratings, or why there is none. */
export function chainLine(chain: ChainToCenter, actor: ActorSummary, center: ActorSummary): string {
  if (!chain.found) return `can't be linked: ${actor.name} shares no chain of movies with ${center.name}`;
  const ratings = chain.averageRating === null ? "" : ` (rating ${chain.totalRating}, average ${+chain.averageRating.toFixed(2)})`;
  return `layer ${chain.distance}: ${chainText(chain)}${ratings}`;
}

/** How the toggle names each chain mode. */
const MODE_LABELS: Record<ChainMode, string> = { shortest: "[shortest link]", "best-rated": "[best-rated link]" };

/**
 * Tab 3: the center field (Kevin Bacon to start), an actor field and `[enter]`; the
 * `[shortest link]` / `[best-rated link]` toggle and the `[can't be linked: n]` button;
 * the stage; the result line.
 * Loading a Center plays its rings (circles inside circles). `[enter]` loads the Center in
 * the field if it changed, then draws the picked Actor's chain on the rings; picking a dot
 * does the same for the Actor it stands for. The toggle redraws the chain on screen in the
 * other mode; the Layers stay as they are. `[can't be linked: n]` shows the list in place of the stage.
 */
export function createSixDegreesPanel(searchActors: SearchActors, api: SixDegreesApi, stage: Stage): HTMLElement {
  const element = document.createElement("section");
  element.className = "six-degrees";
  const fields = document.createElement("div");
  fields.className = "fields";
  const centerField = createActorField("center", searchActors);
  const actorField = createActorField("actor", searchActors);
  const enter = button("[enter]");
  fields.append(centerField.element, actorField.element, enter);
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
  const result = document.createElement("p");
  result.className = "result";
  element.append(fields, toggle, layers, stage.element, unlinkedList.element, result);

  let summary: LayerSummary | null = null;
  let mode: ChainMode = "shortest";
  let shown: { from: ActorSummary; actor: ActorSummary } | null = null; // the chain on the result line
  let latest = 0; // only the newest request may change the screen
  const showResult = (text: string, notPossible = false) => {
    result.textContent = text;
    result.hidden = false;
    result.classList.toggle("not-possible", notPossible);
  };
  /** Plays the rings, with a chain drawn back to the Center when `chain` (each chain Actor's position in its Layer) is given. */
  const play = (layerCounts: number[], chain: number[] | null) =>
    stage.play(ringsScene(layerCounts, chain), (playing) => (result.hidden = playing));
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
      showResult("search failed, try again");
      return false;
    }
    centerField.set(found.center);
    layers.append(
      ...found.layerCounts.map((count, i) => line(`layer ${i}: ${count}`)),
      line(`can't be linked: ${found.unlinkedCount}`),
    );
    unlinkedButton.textContent = `[can't be linked: ${found.unlinkedCount.toLocaleString("en-US")}]`;
    play(found.layerCounts, null);
    return true;
  };

  /** Asks for one chain in the current mode, puts it on the result line, and draws it on the rings when there is one. */
  const showChain = async (request: number, around: LayerSummary, actor: ActorSummary) => {
    const chain = await api.findChain(around.center.id, actor.id, mode).catch(() => null);
    if (request !== latest) return;
    if (!chain) return showResult("search failed, try again");
    shown = { from: around.center, actor };
    showResult(chainLine(chain, actor, around.center), !chain.found);
    if (!chain.found) return;
    showList(false);
    play(around.layerCounts, chain.positions);
  };

  const selectMode = (next: ChainMode) => {
    mode = next;
    for (const b of modeButtons) b.element.setAttribute("aria-pressed", String(b.mode === mode));
  };
  selectMode(mode);
  for (const b of modeButtons) {
    b.element.addEventListener("click", () => {
      if (b.mode === mode) return;
      selectMode(b.mode);
      if (shown && summary) showChain(++latest, summary, shown.actor);
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
    if (!actor) return showResult("search failed, try again");
    actorField.set(actor);
    await showChain(request, around, actor);
  });

  enter.addEventListener("click", async () => {
    const request = ++latest;
    shown = null;
    showResult("");
    const picked = centerField.selected();
    if (picked && picked.id !== summary?.center.id && !(await load(request, picked.id))) return;
    const actor = actorField.selected();
    if (actor && summary) await showChain(request, summary, actor);
  });

  load(++latest);
  return element;
}

function line(text: string): HTMLLIElement {
  const item = document.createElement("li");
  item.textContent = text;
  return item;
}
