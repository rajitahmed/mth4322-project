import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { CHAIN_MODES, type ChainMode } from "../shared/types";
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

/** The HTTP API over the operations module, plus the built web app when webDir is given. */
export function buildApp(operations: Operations, webDir?: string) {
  const app = Fastify();
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof UnknownActorError) return reply.code(404).send({ error: error.message });
    return reply.send(error);
  });

  app.get<{ Querystring: { q: string; limit: number } }>(
    "/api/actors",
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

  app.get<{ Querystring: { a: string; b: string } }>(
    "/api/path",
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

  app.get("/api/largest-path", async () => operations.largestPath());

  app.get<{ Querystring: { center?: string } }>(
    "/api/six-degrees",
    { schema: { querystring: { type: "object", properties: { center: centerSchema } } } },
    async (request) => operations.layerSummary(request.query.center),
  );

  app.get<{ Querystring: { center?: string; actor: string; mode: ChainMode } }>(
    "/api/six-degrees/chain",
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

  app.get<{ Querystring: { center?: string; q: string; offset: number; limit: number } }>(
    "/api/six-degrees/unlinked",
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

  if (webDir) app.register(fastifyStatic, { root: webDir });
  return app;
}
