/**
 * Compressed sparse row: row r is list[start[r] .. start[r + 1]), sorted ascending.
 * Used for both directions of the actor–movie graph (DECISIONS D13).
 */
export interface Csr {
  start: Int32Array;
  list: Int32Array;
}

export function row({ start, list }: Csr, r: number): Int32Array {
  return list.subarray(start[r], start[r + 1]);
}

export function rowCount(csr: Csr): number {
  return csr.start.length - 1;
}

/** Counting sort of (from, to) pairs into a CSR with one row per `from` node. */
export function toCsr(rows: number, from: Int32Array, to: Int32Array): Csr {
  const start = new Int32Array(rows + 1);
  for (const f of from) start[f + 1]!++;
  for (let r = 0; r < rows; r++) start[r + 1]! += start[r]!;

  const list = new Int32Array(from.length);
  const next = start.slice(0, rows);
  from.forEach((f, i) => (list[next[f]!++] = to[i]!));
  const csr = { start, list };
  for (let r = 0; r < rows; r++) row(csr, r).sort();
  return csr;
}
