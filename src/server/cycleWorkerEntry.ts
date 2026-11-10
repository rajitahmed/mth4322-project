import { parentPort, workerData } from "node:worker_threads";
import { type CycleSearchInput, shortestCycleIn } from "./cycleSearch";

/** The worker started by `searchCycleInWorker`: one search, one answer. */
parentPort!.postMessage(shortestCycleIn(workerData as CycleSearchInput));
