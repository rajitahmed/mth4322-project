/**
 * Autocomplete over Actor names (DECISIONS D14). Every name is stored once per
 * word start ("kevin bacon", "bacon") in one sorted array, so a query is a
 * binary search for the first key that could start with it, then a scan of the
 * matching run. Matches rank by Movie count (more first), then name, then index.
 */
export type ActorSearch = (query: string, limit: number) => number[];

export function createActorSearch(names: string[], movieCounts: ArrayLike<number>): ActorSearch {
  const normalized = names.map(normalize);
  const entries = normalized.flatMap((name, actor) => wordStarts(name).map((key) => ({ key, actor })));
  entries.sort((a, b) => compare(a.key, b.key));
  const keys = entries.map((e) => e.key);
  const owners = Int32Array.from(entries, (e) => e.actor);

  const rank = (a: number, b: number) =>
    movieCounts[b]! - movieCounts[a]! || compare(normalized[a]!, normalized[b]!) || a - b;

  return (query, limit) => {
    const prefix = normalize(query);
    if (prefix === "") return [];
    const matches = new Set<number>();
    for (let i = lowerBound(keys, prefix); i < keys.length && keys[i]!.startsWith(prefix); i++) {
      matches.add(owners[i]!);
    }
    return [...matches].sort(rank).slice(0, limit);
  };
}

/** Lowercase, accents removed, runs of spaces collapsed. */
function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** The name from each word onward: "jean-luc picard" → itself, "luc picard", "picard". */
function wordStarts(name: string): string[] {
  const starts = [0];
  for (let i = 1; i < name.length; i++) {
    if (name[i - 1] === " " || name[i - 1] === "-") starts.push(i);
  }
  return starts.map((s) => name.slice(s));
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** First index whose key is >= target. */
function lowerBound(keys: string[], target: string): number {
  let lo = 0;
  let hi = keys.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (keys[mid]! < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
