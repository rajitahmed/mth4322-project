import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { buildApp } from "./app";
import { loadDataset } from "./dataset";
import { buildGraph } from "./graph";
import { createOperations } from "./operations";

const dataDir = process.env.DATA_DIR ?? "data/tiny";
const port = Number(process.env.PORT ?? 3000);
const webDir = resolve("dist/web");

const started = performance.now();
const graph = buildGraph(loadDataset(dataDir));
console.log(
  `Loaded ${graph.actors.length} Actors, ${graph.movies.length} Movies, ${graph.groupCount} Groups ` +
    `from ${dataDir} in ${Math.round(performance.now() - started)} ms`,
);

const app = buildApp(createOperations(graph), existsSync(webDir) ? webDir : undefined);
await app.listen({ port, host: "0.0.0.0" });
console.log(`Listening on http://localhost:${port}`);
