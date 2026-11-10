import { type IndexChain, type Parents, type Search, searchLayers } from "./bfs";
import type { Movie } from "./dataset";
import { type Graph, moviesOf } from "./graph";

/**
 * Everything Six Degrees needs about one Center (DECISIONS D10, D11, D18): one
 * full BFS from it. Layer i holds the Actors at Distance i, lowest index first;
 * the Actors it never reaches (everyone outside the Center's Group) can't be linked.
 * The search's parents give each reached Actor's shortest-link chain, and
 * `bestRatedParents` its best-rated chain (both walked with `chainTo`).
 */
export interface CenterLayers {
  search: Search;
  layers: Int32Array[];
  unlinked: Int32Array;
  bestRatedParents: Parents;
}

export function layersAround(graph: Graph, center: number): CenterLayers {
  const { search, layers } = searchLayers(graph, center);
  const unlinked: number[] = [];
  search.distance.forEach((d, actor) => d === -1 && unlinked.push(actor));
  return { search, layers, unlinked: Int32Array.from(unlinked), bestRatedParents: bestRatedChoices(graph, layers) };
}

/** An Actor's place in a Layer (Layers are sorted by index), found by binary search; -1 when not there. */
export function positionIn(layer: Int32Array, actor: number): number {
  let [low, high] = [0, layer.length - 1];
  while (low <= high) {
    const middle = (low + high) >>> 1;
    if (layer[middle] === actor) return middle;
    if (layer[middle]! < actor) low = middle + 1;
    else high = middle - 1;
  }
  return -1;
}

/** A Movie's rating in tenths, so sums of ratings add and compare exactly. */
function ratingTenths(movie: Movie): number {
  return Math.round(movie.rating * 10);
}

/** The sum of a chain's Movie ratings and their average (none for a chain of no Movies). */
export function chainRatings(graph: Graph, chain: IndexChain): { totalRating: number; averageRating: number | null } {
  const tenths = chain.movies.reduce((sum, m) => sum + ratingTenths(graph.movies[m]!), 0);
  const distance = chain.movies.length;
  return { totalRating: tenths / 10, averageRating: distance === 0 ? null : tenths / 10 / distance };
}

/**
 * Dynamic programming on the shortest-path DAG (DECISIONS D11, `algorithms.md` §6.3):
 * best(Center) = 0, best(v) = max of best(p) + rating(m) over Actors p in the
 * previous Layer sharing a Movie m with v. Layers go in order, each in two steps:
 * every Movie takes its best Actor from the previous Layer, then every Actor its
 * best Movie. The winning (p, m) is v's choice; ties go to the lowest p, then the lowest m.
 */
function bestRatedChoices(graph: Graph, layers: Int32Array[]): Parents {
  const rating = Int32Array.from(graph.movies, ratingTenths);
  const best = new Int32Array(graph.actors.length).fill(-1);
  const parentActor = new Int32Array(graph.actors.length).fill(-1);
  const parentMovie = new Int32Array(graph.actors.length).fill(-1);
  /** The Layer each Movie leads into (its Actors in the Layer before), its best value from there, and whose. */
  const movieLayer = new Int32Array(graph.movies.length).fill(-1);
  const movieBest = new Int32Array(graph.movies.length);
  const movieFrom = new Int32Array(graph.movies.length);
  best[layers[0]![0]!] = 0;

  for (let i = 1; i < layers.length; i++) {
    // Movies first: Actors are walked lowest index first, so a strict > keeps the lowest p on a tie.
    for (const p of layers[i - 1]!) {
      for (const m of moviesOf(graph, p)) {
        if (movieLayer[m] !== i) {
          movieLayer[m] = i;
          movieBest[m] = -1;
        }
        if (best[p]! > movieBest[m]!) {
          movieBest[m] = best[p]!;
          movieFrom[m] = p;
        }
      }
    }
    // Then Actors: only Movies shared with the previous Layer lead into this one.
    for (const v of layers[i]!) {
      for (const m of moviesOf(graph, v)) {
        if (movieLayer[m] !== i) continue;
        const value = movieBest[m]! + rating[m]!;
        // Movies come lowest index first, so on a tie only a lower p can win.
        if (value > best[v]! || (value === best[v] && movieFrom[m]! < parentActor[v]!)) {
          best[v] = value;
          parentActor[v] = movieFrom[m]!;
          parentMovie[v] = m;
        }
      }
    }
  }
  return { parentActor, parentMovie };
}
