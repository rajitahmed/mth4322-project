import { Worker } from "node:worker_threads";
import type { CycleSearchInput, IndexCycleSearch } from "./cycleSearch";

const entry = new URL("./cycleWorkerEntry.ts", import.meta.url).href;
/**
 * The worker's first line: load the TypeScript entry through tsx. A worker
 * does not inherit tsx's import hooks, so passing `--import tsx` is not enough.
 */
const bootstrap = `import("tsx/esm/api").then(({ tsImport }) => tsImport(${JSON.stringify(entry)}, ${JSON.stringify(entry)}));`;

/**
 * Runs one Cycle search in its own worker thread (DECISIONS D9), so a long
 * search never blocks the other endpoints. No time limit. The graph's Links
 * are copied to the worker; the worker ends once it answers.
 */
export function searchCycleInWorker(input: CycleSearchInput): Promise<IndexCycleSearch> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(bootstrap, { eval: true, workerData: input });
    worker.once("message", (result: IndexCycleSearch) => {
      resolve(result);
      void worker.terminate();
    });
    worker.once("error", reject);
    worker.once("exit", (code) => reject(new Error(`Cycle worker stopped (exit code ${code}) without an answer`)));
  });
}
