import { HealthSchema } from "@notespp/shared";
import Fastify, { type FastifyInstance } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { z } from "zod";
import type { NotesRepository } from "./db/repository.js";
import { registerNoteRoutes } from "./routes/notes.js";

export interface BuildAppOptions {
  repo: NotesRepository;
  version: string;
  logger?: boolean;
}

/**
 * Builds the Fastify application.
 *
 * The app is assembled from an injected repository, so tests can pass an
 * in-memory implementation while production passes the Postgres/Drizzle one.
 */
export async function buildApp({
  repo,
  version,
  logger = true,
}: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger,
    disableRequestLogging: process.env.NODE_ENV === "test",
  }).withTypeProvider<ZodTypeProvider>();

  // Wire Zod as the schema compiler so route schemas are the same shared
  // contracts the web client consumes.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  const startedAt = Date.now();

  app.get(
    "/health",
    {
      schema: {
        response: {
          200: HealthSchema,
        },
      },
    },
    async () => ({
      status: "ok" as const,
      version,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    }),
  );

  await registerNoteRoutes(app, { repo });

  // Normalise Zod validation failures into the shared error envelope.
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: error.issues,
      });
    }
    app.log.error(error);
    return reply.code(500).send({ error: "Internal server error", code: "INTERNAL" });
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({ error: "Route not found", code: "ROUTE_NOT_FOUND" });
  });

  return app;
}
