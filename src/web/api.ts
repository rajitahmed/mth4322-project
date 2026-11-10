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

export async function searchActors(query: string): Promise<ActorSummary[]> {
  const response = await fetch(`/api/actors?q=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error(`Actor search failed: ${response.status}`);
  return response.json();
}

export async function findPath(a: string, b: string): Promise<ShortestPath> {
  const response = await fetch(`/api/path?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`);
  if (!response.ok) throw new Error(`Path search failed: ${response.status}`);
  return response.json();
}

export async function findLargestPath(): Promise<FoundPath> {
  const response = await fetch("/api/largest-path");
  if (!response.ok) throw new Error(`Largest path failed: ${response.status}`);
  return response.json();
}

/** The Layer counts around a Center; the default Center (Kevin Bacon) when none is given. */
export async function findLayers(center?: string): Promise<LayerSummary> {
  const query = center === undefined ? "" : `?center=${encodeURIComponent(center)}`;
  const response = await fetch(`/api/six-degrees${query}`);
  if (!response.ok) throw new Error(`Layers failed: ${response.status}`);
  return response.json();
}

export async function findChainToCenter(center: string, actor: string, mode: ChainMode): Promise<ChainToCenter> {
  const response = await fetch(
    `/api/six-degrees/chain?center=${encodeURIComponent(center)}&actor=${encodeURIComponent(actor)}&mode=${mode}`,
  );
  if (!response.ok) throw new Error(`Chain failed: ${response.status}`);
  return response.json();
}

/** Who a dot on the rings stands for: the Actor at `position` in Layer `layer` around a Center. */
export async function findActorAt(center: string, layer: number, position: number): Promise<ActorSummary> {
  const response = await fetch(`/api/six-degrees/layer-actor?center=${encodeURIComponent(center)}&layer=${layer}&position=${position}`);
  if (!response.ok) throw new Error(`Layer actor failed: ${response.status}`);
  return response.json();
}

/** One page of the Actors who can't be linked to a Center, filtered by name. */
export async function findUnlinked(center: string, query: string, offset: number, limit: number): Promise<UnlinkedPage> {
  const response = await fetch(
    `/api/six-degrees/unlinked?center=${encodeURIComponent(center)}&q=${encodeURIComponent(query)}&offset=${offset}&limit=${limit}`,
  );
  if (!response.ok) throw new Error(`Unlinked failed: ${response.status}`);
  return response.json();
}

/** The shortest Cycle through 3 to 6 distinct Chosen Actors, or why there is none. No time limit (D9). */
export async function findCycle(ids: string[]): Promise<ShortestCycle> {
  const response = await fetch(`/api/cycle?${ids.map((id) => `actors=${encodeURIComponent(id)}`).join("&")}`);
  if (!response.ok) throw new Error(`Cycle failed: ${response.status}`);
  return response.json();
}
