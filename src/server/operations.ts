import type {
  ActorSummary,
  Chain,
  ChainMode,
  ChainToCenter,
  FoundPath,
  LayerSummary,
  Link,
  MovieSummary,
  Names,
  ShortestCycle,
  ShortestPath,
  UnlinkedPage,
} from "../shared/types";
import { createActorSearch, nameMatcher } from "./actorSearch";
import { chainTo, type IndexChain } from "./bfs";
import { findBlocks } from "./blocks";
import { checkCycle } from "./cycleChecks";
import type { IndexLink } from "./cycleSearch";
import { searchCycleInWorker } from "./cycleWorker";
import { type Graph, moviesOf } from "./graph";
import { largestPath } from "./largestPath";
import { recentCache } from "./recentCache";
import { showRounds } from "./searchRounds";
import { shortestPath } from "./shortestPath";
import { type CenterLayers, chainRatings, layersAround, positionIn } from "./sixDegrees";

export const DEFAULT_SEARCH_LIMIT = 10;
export const MAX_SEARCH_LIMIT = 50;
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;
/** The default Center, found by exact name (the one with most Movies). A dataset without him falls back to its first Actor. */
export const DEFAULT_CENTER_NAME = "Kevin Bacon";
/** `[random]` picks among the Actors with at least this many Movies: names people know, linked enough for quick searches (D27). */
export const RANDOM_MIN_MOVIES = 10;
/** Centers other than the default one kept in memory, least recently used dropped first (DECISIONS D12). */
export const RECENT_CENTERS = 8;

/** Thrown for an Actor id that is not in the data. */
export class UnknownActorError extends Error {
  constructor(id: string) {
    super(`Unknown Actor: ${id}`);
  }
}

/**
 * The one module behind which every operation sits. It takes the graph as its
 * only input; the API and the tests both go through it. The largest finite
 * shortest path, the default Center's Layers and the blocks are computed here,
 * once, when the module is created (DECISIONS D5, D12, D20).
 */
export function createOperations(graph: Graph) {
  const movieCounts = graph.actors.map((_, a) => moviesOf(graph, a).length);
  const findActors = createActorSearch(
    graph.actors.map((a) => a.name),
    movieCounts,
  );
  const actorIndex = new Map(graph.actors.map((actor, i) => [actor.id, i]));
  const indexOf = (id: string) => {
    const i = actorIndex.get(id);
    if (i === undefined) throw new UnknownActorError(id);
    return i;
  };
  const actorAt = (i: number): ActorSummary => graph.actors[i]!;
  const movieAt = (i: number): MovieSummary => {
    const { id, title } = graph.movies[i]!;
    return { id, title };
  };

  /** A chain of Actor and Movie indices, mapped for the front end. */
  const chainOf = (chain: IndexChain): Chain => ({
    distance: chain.movies.length,
    actors: chain.actors.map(actorAt),
    movies: chain.movies.map(movieAt),
  });

  const linkOf = ({ from, movie, to }: IndexLink): Link => ({ from: actorAt(from).id, movie: movieAt(movie).id, to: actorAt(to).id });

  /** The names of both ends and the Movie of every one of these Links, plus `alsoActors`, by id, for an animation. */
  const namesOfLinks = (links: IndexLink[], alsoActors: number[] = []): Names => {
    const names: Names = {};
    for (const a of [...alsoActors, ...links.flatMap((l) => [l.from, l.to])]) names[actorAt(a).id] = actorAt(a).name;
    for (const { movie } of links) names[movieAt(movie).id] = movieAt(movie).title;
    return names;
  };

  /** Bidirectional BFS between two Actor indices, its rounds cut down to what the animation shows (D27), mapped to ids. */
  const pathBetween = (a: number, b: number): ShortestPath => {
    const result = shortestPath(graph, a, b);
    const rounds = showRounds(result.rounds, [a, b], result.found ? result.actors : []);
    const trace = {
      rounds: rounds.map(({ side, depth, reached, shown }) => ({ side, depth, reached, shown: shown.map((link) => ({ ...linkOf(link), side })) })),
      names: namesOfLinks(rounds.flatMap((round) => round.shown), [a, b]),
    };
    if (!result.found) return { found: false, ...trace };
    return { found: true, ...chainOf(result), ...trace };
  };

  const farthestPair = largestPath(graph);
  const farthestChain = pathBetween(farthestPair.a, farthestPair.b);
  if (!farthestChain.found) throw new Error("The largest path's endpoints must share a Group");

  const defaultCenter = findActors(DEFAULT_CENTER_NAME, MAX_SEARCH_LIMIT).find((i) => actorAt(i).name === DEFAULT_CENTER_NAME) ?? 0;
  const defaultLayers = layersAround(graph, defaultCenter);
  const recentLayers = recentCache(RECENT_CENTERS, (center: number) => layersAround(graph, center));
  /** The Center's index (the default one when no id is given) and its Layers, cached. */
  const centerOf = (id?: string): { center: number; around: CenterLayers } => {
    const center = id === undefined ? defaultCenter : indexOf(id);
    return { center, around: center === defaultCenter ? defaultLayers : recentLayers(center) };
  };

  const blocks = findBlocks(graph);
  /** Only the Links go to a Cycle worker: the Actor and Movie records stay here. */
  const links = { actorMovies: graph.actorMovies, movieActors: graph.movieActors };
  const randomPool = graph.actors.flatMap((_, a) => (movieCounts[a]! >= RANDOM_MIN_MOVIES ? [a] : []));

  return {
    /** Actors whose name has a word starting with the query, best match first. */
    searchActors(query: string, limit = DEFAULT_SEARCH_LIMIT): ActorSummary[] {
      return findActors(query, limit).map(actorAt);
    },

    /**
     * `count` distinct Actors picked at random among those with at least RANDOM_MIN_MOVIES Movies
     * (every Actor, when too few have that many), for the `[random]` buttons. `random` is in [0, 1).
     */
    randomActors(count: number, random: () => number = Math.random): ActorSummary[] {
      const pool = randomPool.length >= count ? [...randomPool] : graph.actors.map((_, a) => a);
      // A partial Fisher–Yates shuffle: the first `count` places end up a uniform random sample.
      for (let i = 0; i < Math.min(count, pool.length); i++) {
        const j = i + Math.floor(random() * (pool.length - i));
        [pool[i], pool[j]] = [pool[j]!, pool[i]!];
      }
      return pool.slice(0, count).map(actorAt);
    },

    /** The Distance between two Actors, one shortest chain, and what the search did on the way (D27). */
    shortestPath(a: string, b: string): ShortestPath {
      return pathBetween(indexOf(a), indexOf(b));
    },

    /**
     * The largest finite shortest path in the whole database: its Distance, the
     * lowest-id pair that far apart (lower id first), and their chain, with what a bidirectional BFS
     * between them does (for the animation). Computed at startup.
     */
    largestPath(): FoundPath {
      return farthestChain;
    },

    /**
     * The full Six Degrees answer for a Center (Kevin Bacon when none is given):
     * the Actors in each Layer (Layer 0 is the Center) and the Actors who can't be linked.
     */
    sixDegrees(centerId?: string): { center: ActorSummary; layers: ActorSummary[][]; unlinked: ActorSummary[] } {
      const { center, around } = centerOf(centerId);
      return {
        center: actorAt(center),
        layers: around.layers.map((layer) => Array.from(layer, actorAt)),
        unlinked: Array.from(around.unlinked, actorAt),
      };
    },

    /** What tab 3 shows first: the Center, how many Actors are in each Layer, and how many can't be linked. */
    layerSummary(centerId?: string): LayerSummary {
      const { center, around } = centerOf(centerId);
      return {
        center: actorAt(center),
        layerCounts: around.layers.map((layer) => layer.length),
        unlinkedCount: around.unlinked.length,
      };
    },

    /**
     * The chain from the Center to one Actor, with its total and average rating:
     * the shortest-link chain (BFS parents) or the best-rated one (D11). Its
     * Distance is the Actor's Layer in both modes. `positions[i]` is chain Actor i's
     * position in Layer i (D25).
     */
    chainToCenter(centerId: string | undefined, actorId: string, mode: ChainMode = "shortest"): ChainToCenter {
      const { search, bestRatedParents, layers } = centerOf(centerId).around;
      const actor = indexOf(actorId);
      if (search.distance[actor] === -1) return { found: false };
      const chain = chainTo(mode === "shortest" ? search : bestRatedParents, actor);
      const positions = chain.actors.map((a, i) => positionIn(layers[i]!, a));
      return { found: true, ...chainOf(chain), ...chainRatings(graph, chain), positions };
    },

    /** The Actor at `position` in Layer `layer` around the Center (Layers are in id order), or null outside the Layers (D25). */
    layerActor(centerId: string | undefined, layer: number, position: number): ActorSummary | null {
      const actor = centerOf(centerId).around.layers[layer]?.[position];
      return actor === undefined ? null : actorAt(actor);
    },

    /**
     * The shortest Cycle through 3 to 6 distinct Chosen Actors (D6–D9): the
     * checks first (different Groups, a cut actor), then IDA* inside their
     * block, in a worker thread so other requests are answered meanwhile.
     */
    async shortestCycle(ids: string[]): Promise<ShortestCycle> {
      const chosen = ids.map(indexOf);
      const check = checkCycle(graph, blocks, chosen);
      if (check.outcome === "not-possible") {
        if (check.reason === "different-groups") return check;
        const [a, b] = check.between;
        return { ...check, cutActor: actorAt(check.cutActor), between: [actorAt(a), actorAt(b)] };
      }
      const search = await searchCycleInWorker({ links, actorBlocks: blocks.actorBlocks, block: check.block, chosen });
      const rejections = {
        rejected: search.rejected.map(linkOf),
        moreRejected: search.moreRejected,
        names: namesOfLinks(search.rejected),
      };
      if (!search.found) return { outcome: "not-possible", reason: "no-cycle", ...rejections };
      return {
        outcome: "found",
        length: search.actors.length,
        actors: search.actors.map(actorAt),
        movies: search.movies.map(movieAt),
        ...rejections,
      };
    },

    /** One page of the Actors who can't be linked to the Center, in id order, filtered by name. */
    unlinked(centerId: string | undefined, query: string, offset: number, limit: number): UnlinkedPage {
      const { around } = centerOf(centerId);
      const matches = nameMatcher(query);
      const actors = Array.from(around.unlinked, actorAt).filter((actor) => matches(actor.name));
      return { total: actors.length, actors: actors.slice(offset, offset + limit) };
    },
  };
}

export type Operations = ReturnType<typeof createOperations>;
