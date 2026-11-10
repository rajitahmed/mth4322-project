import type { Chain } from "../shared/types";

/** A chain written out: Actor — Movie — Actor — … */
export function chainText({ actors, movies }: Chain): string {
  return actors.flatMap((actor, i) => (i === 0 ? [actor.name] : [movies[i - 1]!.title, actor.name])).join(" — ");
}
