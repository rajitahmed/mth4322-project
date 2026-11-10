/**
 * Memoizes `compute`, keeping only the `capacity` most recently used keys
 * (DECISIONS D12, D18). A Map keeps insertion order, so re-inserting a key on
 * every use leaves the least recently used one first, ready to drop.
 */
export function recentCache<K, V>(capacity: number, compute: (key: K) => V): (key: K) => V {
  const entries = new Map<K, V>();
  return (key) => {
    const value = entries.has(key) ? entries.get(key)! : compute(key);
    entries.delete(key);
    entries.set(key, value);
    if (entries.size > capacity) entries.delete(entries.keys().next().value!);
    return value;
  };
}
