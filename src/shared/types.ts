/** An Actor as the front end sees it. Birth year tells same-name Actors apart. */
export interface ActorSummary {
  id: string;
  name: string;
  birthYear: number | null;
}
