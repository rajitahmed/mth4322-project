import type { ActorSummary } from "../shared/types";

export async function searchActors(query: string): Promise<ActorSummary[]> {
  const response = await fetch(`/api/actors?q=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error(`Actor search failed: ${response.status}`);
  return response.json();
}
