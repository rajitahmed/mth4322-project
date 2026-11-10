import type { ActorSummary, ChainToCenter, LayerSummary } from "../shared/types";
import { createActorField, type SearchActors } from "./actorField";
import { button } from "./button";
import { chainText } from "./chainText";

export type FindLayers = (center?: string) => Promise<LayerSummary>;
export type FindChainToCenter = (center: string, actor: string) => Promise<ChainToCenter>;

/** The result line for a picked Actor: their Layer and chain from the Center, or why there is none. */
export function chainLine(chain: ChainToCenter, actor: ActorSummary, center: ActorSummary): string {
  if (!chain.found) return `can't be linked: ${actor.name} shares no chain of movies with ${center.name}`;
  return `layer ${chain.distance}: ${chainText(chain)}`;
}

/**
 * Tab 3, plain view: the center field (Kevin Bacon to start) and an actor field.
 * `[enter]` loads the Center's Layer counts and can't-be-linked count if the
 * Center changed, then shows the chain back to the Center for the picked Actor.
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
  const layers = document.createElement("ul");
  layers.className = "layers";
  const result = document.createElement("p");
  result.className = "result";
  element.append(fields, layers, result);

  let center: ActorSummary | null = null;
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

  enter.addEventListener("click", async () => {
    const request = ++latest;
    showResult("");
    const picked = centerField.selected();
    if (picked && picked.id !== center?.id && !(await load(request, picked.id))) return;
    const actor = actorField.selected();
    const from = center;
    if (!actor || !from) return;
    const chain = await findChain(from.id, actor.id).catch(() => null);
    if (request !== latest) return;
    if (!chain) return showResult("search failed, try again");
    showResult(chainLine(chain, actor, from), !chain.found);
  });

  load(++latest);
  return element;
}

function line(text: string): HTMLLIElement {
  const item = document.createElement("li");
  item.textContent = text;
  return item;
}
