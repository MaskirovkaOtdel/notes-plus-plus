import { createHash, timingSafeEqual } from "node:crypto";
import { ExtensionListSchema, HealthSchema } from "@notespp/shared";
import fastifyStatic from "@fastify/static";
import Fastify, { LogController, type FastifyInstance } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { z } from "zod";
import type { NotesRepository } from "./db/repository.js";
import { composeRepository, registerExtensions } from "./extensions/registry.js";
import type { NotesApiExtension } from "./extensions/types.js";
import { registerNoteRoutes } from "./routes/notes.js";

export interface BuildAppOptions {
  repo: NotesRepository;
  version: string;
  logger?: boolean;
  /**
   * Extensions to register, in order. Defaults to none — callers compose
   * the list (see extensions/load.ts), keeping this factory pure and
   * directly testable.
   */
  extensions?: readonly NotesApiExtension[];
  /**
   * When set to a non-empty value, every route except `GET /health` requires
   * an `Authorization: Bearer <token>` header. Unset (the default) leaves the
   * API unauthenticated — the documented posture for a localhost-bound
   * personal instance. Comparison is constant-time over SHA-256 digests so
   * neither the token length nor its bytes leak through timing.
   */
  apiToken?: string;
  /**
   * When set to a non-empty directory, the API also serves the built web
   * app from it (single-origin deployment: one process, one port). GET
   * requests that accept HTML and match no API route fall back to
   * `index.html` so SPA deep links work; everything else keeps the JSON 404.
   */
  webDist?: string;
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
  extensions = [],
  apiToken,
  webDist,
}: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger,
    logController: new LogController({
      disableRequestLogging: process.env.NODE_ENV === "test",
    }),
  }).withTypeProvider<ZodTypeProvider>();

  // Wire Zod as the schema compiler so route schemas are the same shared
  // contracts the web client consumes.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Optional bearer-token gate. Registered as an onRequest hook so it runs
  // before every route (including extension routes); /health stays open so
  // container orchestrators can probe without credentials.
  if (apiToken !== undefined && apiToken !== "") {
    const expected = createHash("sha256").update(apiToken, "utf8").digest();
    app.addHook("onRequest", async (request, reply) => {
      if (request.url.split("?")[0] === "/health") return;
      const header = request.headers.authorization;
      const token =
        typeof header === "string" && header.startsWith("Bearer ")
          ? header.slice("Bearer ".length)
          : undefined;
      const received =
        token !== undefined
          ? createHash("sha256").update(token, "utf8").digest()
          : undefined;
      if (received === undefined || !timingSafeEqual(received, expected)) {
        return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
      }
    });
  }

  const startedAt = Date.now();

  // Optional static hosting of the built web app (Docker/single-origin
  // deployments). No directory listing; @fastify/static confines reads to
  // `webDist` and blocks path traversal.
  if (webDist !== undefined && webDist !== "") {
    await app.register(fastifyStatic, { root: webDist, wildcard: false });
  }

  // Compose the write-path seam first: extensions may wrap the repository,
  // and note routes plus every extension context must see one consistent
  // (decorated) view of storage. Validation is fail-fast.
  const effectiveRepo = composeRepository(extensions, repo);

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

  await registerNoteRoutes(app, { repo: effectiveRepo });

  // Extensions register deterministically in array order; validation and
  // registration failures abort startup (fail-fast, never half-wired).
  const registeredExtensions = await registerExtensions(
    app,
    { repo: effectiveRepo, version },
    extensions,
  );

  app.get(
    "/extensions",
    {
      schema: {
        response: {
          200: ExtensionListSchema,
        },
      },
    },
    async () => ({ items: registeredExtensions }),
  );

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

  app.setNotFoundHandler((request, reply) => {
    // SPA deep links: navigation requests that no API route matched get the
    // app shell. Non-HTML requests keep the JSON 404 envelope.
    if (
      webDist !== undefined &&
      webDist !== "" &&
      request.method === "GET" &&
      (request.headers.accept ?? "").includes("text/html")
    ) {
      return reply.sendFile("index.html");
    }
    reply.code(404).send({ error: "Route not found", code: "ROUTE_NOT_FOUND" });
  });

  return app;
}
