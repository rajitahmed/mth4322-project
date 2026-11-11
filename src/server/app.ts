import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import { CHAIN_MODES, type ChainMode, MAX_CHOSEN_ACTORS, MAX_RANDOM_ACTORS, MIN_CHOSEN_ACTORS } from "../shared/types";
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_SEARCH_LIMIT,
  MAX_PAGE_SIZE,
  MAX_SEARCH_LIMIT,
  type Operations,
  UnknownActorError,
} from "./operations";

/** The optional Center id every Six Degrees route takes (the default Center when missing). */
const centerSchema = { type: "string" } as const;

/**
 * The HTTP API over the operations module at `/api`, the same API over the tiny dataset at `/api/tiny`
 * when `tiny` is given (the explainer page's friendly cases, D29), plus the built web app when webDir is given.
 */
export function buildApp(operations: Operations, webDir?: string, tiny?: Operations) {
  const app = Fastify();
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof UnknownActorError) return reply.code(404).send({ error: error.message });
    return reply.send(error);
  });

  app.register(async (api) => routes(api, operations), { prefix: "/api" });
  if (tiny) app.register(async (api) => routes(api, tiny), { prefix: "/api/tiny" });
  if (webDir) app.register(fastifyStatic, { root: webDir });
  return app;
}

/** Every API route over one operations module. */
function routes(api: FastifyInstance, operations: Operations): void {
  api.get<{ Querystring: { q: string; limit: number } }>(
    "/actors",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["q"],
          properties: {
            q: { type: "string" },
            limit: { type: "integer", minimum: 1, maximum: MAX_SEARCH_LIMIT, default: DEFAULT_SEARCH_LIMIT },
          },
        },
      },
    },
    async (request) => operations.searchActors(request.query.q, request.query.limit),
  );

  api.get<{ Querystring: { count: number } }>(
    "/actors/random",
    {
      schema: {
        querystring: {
          type: "object",
          properties: { count: { type: "integer", minimum: 1, maximum: MAX_RANDOM_ACTORS, default: 1 } },
        },
      },
    },
    async (request) => operations.randomActors(request.query.count),
  );

  api.get<{ Querystring: { a: string; b: string } }>(
    "/path",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["a", "b"],
          properties: { a: { type: "string" }, b: { type: "string" } },
        },
      },
    },
    async (request) => operations.shortestPath(request.query.a, request.query.b),
  );

  api.get("/largest-path", async () => operations.largestPath());

  api.get<{ Querystring: { actors: string[] } }>(
    "/cycle",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["actors"],
          properties: {
            actors: {
              type: "array",
              items: { type: "string" },
              minItems: MIN_CHOSEN_ACTORS,
              maxItems: MAX_CHOSEN_ACTORS,
              uniqueItems: true,
            },
          },
        },
      },
    },
    async (request) => operations.shortestCycle(request.query.actors),
  );

  api.get<{ Querystring: { center?: string } }>(
    "/six-degrees",
    { schema: { querystring: { type: "object", properties: { center: centerSchema } } } },
    async (request) => operations.layerSummary(request.query.center),
  );

  api.get<{ Querystring: { center?: string; actor: string; mode: ChainMode } }>(
    "/six-degrees/chain",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["actor"],
          properties: {
            center: centerSchema,
            actor: { type: "string" },
            mode: { type: "string", enum: CHAIN_MODES, default: "shortest" },
          },
        },
      },
    },
    async ({ query }) => operations.chainToCenter(query.center, query.actor, query.mode),
  );

  api.get<{ Querystring: { center?: string; layer: number; position: number } }>(
    "/six-degrees/layer-actor",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["layer", "position"],
          properties: {
            center: centerSchema,
            layer: { type: "integer", minimum: 0 },
            position: { type: "integer", minimum: 0 },
          },
        },
      },
    },
    async ({ query }, reply) => {
      const actor = operations.layerActor(query.center, query.layer, query.position);
      return actor ?? reply.code(404).send({ error: `No Actor at layer ${query.layer}, position ${query.position}` });
    },
  );

  api.get<{ Querystring: { center?: string; q: string; offset: number; limit: number } }>(
    "/six-degrees/unlinked",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            center: centerSchema,
            q: { type: "string", default: "" },
            offset: { type: "integer", minimum: 0, default: 0 },
            limit: { type: "integer", minimum: 1, maximum: MAX_PAGE_SIZE, default: DEFAULT_PAGE_SIZE },
          },
        },
      },
    },
    async ({ query }) => operations.unlinked(query.center, query.q, query.offset, query.limit),
  );
}
