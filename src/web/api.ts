import type { ActorSummary, ChainMode, ChainToCenter, FoundPath, LayerSummary, ShortestPath } from "../shared/types";

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
