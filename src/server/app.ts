import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT, type Operations, UnknownActorError } from "./operations";

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

  if (webDir) app.register(fastifyStatic, { root: webDir });
  return app;
}
