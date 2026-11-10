import { type ActorSummary, CHAIN_MODES, type ChainMode, type ChainToCenter, type LayerSummary } from "../shared/types";
import { createActorField, type SearchActors } from "./actorField";
import { button } from "./button";
import { chainText } from "./chainText";

export type FindLayers = (center?: string) => Promise<LayerSummary>;
export type FindChainToCenter = (center: string, actor: string, mode: ChainMode) => Promise<ChainToCenter>;

/** The result line for a picked Actor: their Layer, chain from the Center and its ratings, or why there is none. */
export function chainLine(chain: ChainToCenter, actor: ActorSummary, center: ActorSummary): string {
  if (!chain.found) return `can't be linked: ${actor.name} shares no chain of movies with ${center.name}`;
  const ratings = chain.averageRating === null ? "" : ` (rating ${chain.totalRating}, average ${+chain.averageRating.toFixed(2)})`;
  return `layer ${chain.distance}: ${chainText(chain)}${ratings}`;
}

/** How the toggle names each chain mode. */
const MODE_LABELS: Record<ChainMode, string> = { shortest: "[shortest link]", "best-rated": "[best-rated link]" };

/**
 * Tab 3, plain view: the center field (Kevin Bacon to start) and an actor field.
 * `[enter]` loads the Center's Layer counts and can't-be-linked count if the
 * Center changed, then shows the chain back to the Center for the picked Actor.
 * The `[shortest link]` / `[best-rated link]` toggle asks again for the chain on
 * screen in the other mode; the Layers stay as they are.
 * The rings animation replaces the list later.
 */
export function createSixDegreesPanel(
  searchActors: SearchActors,
  findLayers: FindLayers,
  findChain: FindChainToCenter,
): HTMLElement {
  const element = document.createElement("section");
  const fields = document.createElement("div");
  fields.className = "fields";
  const centerField = createActorField("center", searchActors);
  const actorField = createActorField("actor", searchActors);
  const enter = button("[enter]");
  fields.append(centerField.element, actorField.element, enter);
  const toggle = document.createElement("div");
  toggle.className = "modes";
  const modeButtons = CHAIN_MODES.map((m) => ({ mode: m, element: button(MODE_LABELS[m]) }));
  toggle.append(...modeButtons.map((b) => b.element));
  const layers = document.createElement("ul");
  layers.className = "layers";
  const result = document.createElement("p");
  result.className = "result";
  element.append(fields, toggle, layers, result);

  let center: ActorSummary | null = null;
  let mode: ChainMode = "shortest";
  let shown: { from: ActorSummary; actor: ActorSummary } | null = null; // the chain on the result line
  let latest = 0; // only the newest request may change the screen
  const showResult = (text: string, notPossible = false) => {
    result.textContent = text;
    result.classList.toggle("not-possible", notPossible);
  };

  /** Loads a Center's Layers (the default Center when no id is given). False if it failed or was overtaken. */
  const load = async (request: number, centerId?: string): Promise<boolean> => {
    const summary = await findLayers(centerId).catch(() => null);
    if (request !== latest) return false;
    center = summary?.center ?? null;
    layers.replaceChildren();
    if (!summary) {
      showResult("search failed, try again");
      return false;
    }
    centerField.set(summary.center);
    layers.append(
      ...summary.layerCounts.map((count, i) => line(`layer ${i}: ${count}`)),
      line(`can't be linked: ${summary.unlinkedCount}`),
    );
    return true;
  };

  /** Asks for one chain in the current mode and puts it on the result line. */
  const showChain = async (request: number, from: ActorSummary, actor: ActorSummary) => {
    const chain = await findChain(from.id, actor.id, mode).catch(() => null);
    if (request !== latest) return;
    if (!chain) return showResult("search failed, try again");
    shown = { from, actor };
    showResult(chainLine(chain, actor, from), !chain.found);
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
      if (shown) showChain(++latest, shown.from, shown.actor);
    });
  }

  enter.addEventListener("click", async () => {
    const request = ++latest;
    shown = null;
    showResult("");
    const picked = centerField.selected();
    if (picked && picked.id !== center?.id && !(await load(request, picked.id))) return;
    const actor = actorField.selected();
    if (actor && center) await showChain(request, center, actor);
  });

  load(++latest);
  return element;
}

function line(text: string): HTMLLIElement {
  const item = document.createElement("li");
  item.textContent = text;
  return item;
}
