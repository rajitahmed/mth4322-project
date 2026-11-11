import type {
  ActorSummary,
  ChainMode,
  ChainToCenter,
  FoundPath,
  LayerSummary,
  ShortestCycle,
  ShortestPath,
  UnlinkedPage,
} from "../shared/types";

/** GET `url` as JSON; `what` names the request in the error. */
async function getJson<T>(url: string, what: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${what} failed: ${response.status}`);
  return response.json();
}

/** Every call the page makes to the server, against the API at `base`: "/api" (the real data) or "/api/tiny" (D29). */
export function apiAt(base: string) {
  const q = encodeURIComponent;
  return {
    searchActors: (query: string) => getJson<ActorSummary[]>(`${base}/actors?q=${q(query)}`, "Actor search"),

    /** `count` distinct random Actors, from those with enough Movies to be known (D27). */
    randomActors: (count: number) => getJson<ActorSummary[]>(`${base}/actors/random?count=${count}`, "Random actors"),

    findPath: (a: string, b: string) => getJson<ShortestPath>(`${base}/path?a=${q(a)}&b=${q(b)}`, "Path search"),

    findLargestPath: () => getJson<FoundPath>(`${base}/largest-path`, "Largest path"),

    /** The Layer counts around a Center; the default Center (Kevin Bacon) when none is given. */
    findLayers: (center?: string) => getJson<LayerSummary>(`${base}/six-degrees${center === undefined ? "" : `?center=${q(center)}`}`, "Layers"),

    findChain: (center: string, actor: string, mode: ChainMode) =>
      getJson<ChainToCenter>(`${base}/six-degrees/chain?center=${q(center)}&actor=${q(actor)}&mode=${mode}`, "Chain"),

    /** Who a dot on the rings stands for: the Actor at `position` in Layer `layer` around a Center. */
    findActorAt: (center: string, layer: number, position: number) =>
      getJson<ActorSummary>(`${base}/six-degrees/layer-actor?center=${q(center)}&layer=${layer}&position=${position}`, "Layer actor"),

    /** One page of the Actors who can't be linked to a Center, filtered by name. */
    findUnlinked: (center: string, query: string, offset: number, limit: number) =>
      getJson<UnlinkedPage>(`${base}/six-degrees/unlinked?center=${q(center)}&q=${q(query)}&offset=${offset}&limit=${limit}`, "Unlinked"),

    /** The shortest Cycle through 3 to 6 distinct Chosen Actors, or why there is none. No time limit (D9). */
    findCycle: (ids: string[]) => getJson<ShortestCycle>(`${base}/cycle?${ids.map((id) => `actors=${q(id)}`).join("&")}`, "Cycle"),
  };
}

export type Api = ReturnType<typeof apiAt>;
