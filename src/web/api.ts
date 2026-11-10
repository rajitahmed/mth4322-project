import type { ActorSummary, ShortestPath } from "../shared/types";

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
