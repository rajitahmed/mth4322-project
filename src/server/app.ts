import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT, type Operations } from "./operations";

/** The HTTP API over the operations module, plus the built web app when webDir is given. */
export function buildApp(operations: Operations, webDir?: string) {
  const app = Fastify();

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

  if (webDir) app.register(fastifyStatic, { root: webDir });
  return app;
}
