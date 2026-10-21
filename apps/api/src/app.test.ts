import { describe, expect, it, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";
import { InMemoryNotesRepository } from "./db/in-memory.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp({
    repo: new InMemoryNotesRepository(),
    version: "0.0.0-test",
    logger: false,
  });
});

afterAll(async () => {
  await app.close();
});

describe("GET /health", () => {
  it("returns status and version", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("ok");
    expect(body.version).toBe("0.0.0-test");
  });
});

describe("notes CRUD", () => {
  it("creates a note and returns 201", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/notes",
      payload: { title: "Hello", body: "world", tags: ["x"] },
    });
    expect(res.statusCode).toBe(201);
    const note = res.json();
    expect(note.title).toBe("Hello");
    expect(note.id).toBeTruthy();
  });

  it("rejects an invalid create with 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/notes",
      payload: { title: "" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("VALIDATION_ERROR");
  });

  it("lists notes", async () => {
    await app.inject({ method: "POST", url: "/notes", payload: { title: "Listed" } });
    const res = await app.inject({ method: "GET", url: "/notes" });
    expect(res.statusCode).toBe(200);
    expect(res.json().items.length).toBeGreaterThan(0);
  });

  it("reads a single note", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/notes",
      payload: { title: "Read me" },
    });
    const id = created.json().id as string;
    const res = await app.inject({ method: "GET", url: `/notes/${id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe("Read me");
  });

  it("404s on a missing note", async () => {
    const res = await app.inject({ method: "GET", url: "/notes/does-not-exist" });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("NOTE_NOT_FOUND");
  });

  it("patches a note", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/notes",
      payload: { title: "Before" },
    });
    const id = created.json().id as string;
    const res = await app.inject({
      method: "PATCH",
      url: `/notes/${id}`,
      payload: { title: "After" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe("After");
  });

  it("rejects an empty patch with 400", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/notes",
      payload: { title: "Refine" },
    });
    const id = created.json().id as string;
    const res = await app.inject({ method: "PATCH", url: `/notes/${id}`, payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it("deletes a note with 204", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/notes",
      payload: { title: "Delete" },
    });
    const id = created.json().id as string;
    const res = await app.inject({ method: "DELETE", url: `/notes/${id}` });
    expect(res.statusCode).toBe(204);
    const after = await app.inject({ method: "GET", url: `/notes/${id}` });
    expect(after.statusCode).toBe(404);
  });

  it("404s when patching a missing note", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/notes/missing",
      payload: { title: "x" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("404s when deleting a missing note", async () => {
    const res = await app.inject({ method: "DELETE", url: "/notes/missing" });
    expect(res.statusCode).toBe(404);
  });

  it("404s an unknown route", async () => {
    const res = await app.inject({ method: "GET", url: "/nope" });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("ROUTE_NOT_FOUND");
  });
});

describe("error handling", () => {
  it("returns 500 with the shared envelope on unexpected errors", async () => {
    // A repository that explodes exercises the non-Zod error handler path.
    const boomRepo = {
      async list() {
        throw new Error("db exploded");
      },
      async get() {
        return null;
      },
      async create() {
        throw new Error("unused");
      },
      async update() {
        return null;
      },
      async remove() {
        return false;
      },
    };
    const boomApp = await buildApp({
      repo: boomRepo,
      version: "0.0.0-test",
      logger: false,
    });

    const res = await boomApp.inject({ method: "GET", url: "/notes" });
    expect(res.statusCode).toBe(500);
    expect(res.json().code).toBe("INTERNAL");

    await boomApp.close();
  });
});

describe("extension seam", () => {
  it("lists an empty extension set when built without extensions (standalone)", async () => {
    const res = await app.inject({ method: "GET", url: "/extensions" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ items: [] });
  });

  it("registers extensions and lists their manifests", async () => {
    const extApp = await buildApp({
      repo: new InMemoryNotesRepository(),
      version: "0.0.0-test",
      logger: false,
      extensions: [
        {
          manifest: { id: "demo-ext", name: "Demo extension", version: "2.1.0" },
          register: (instance) => {
            instance.get("/demo/ping", async () => ({ pong: true }));
          },
        },
      ],
    });

    const list = await extApp.inject({ method: "GET", url: "/extensions" });
    expect(list.statusCode).toBe(200);
    expect(list.json().items).toEqual([
      { id: "demo-ext", name: "Demo extension", version: "2.1.0" },
    ]);

    // The extension's own route is served too.
    const ping = await extApp.inject({ method: "GET", url: "/demo/ping" });
    expect(ping.statusCode).toBe(200);

    await extApp.close();
  });

  it("aborts startup when an extension is invalid (fail-fast)", async () => {
    await expect(
      buildApp({
        repo: new InMemoryNotesRepository(),
        version: "0.0.0-test",
        logger: false,
        extensions: [
          {
            manifest: { id: "Bad Id", name: "bad", version: "1" },
            register: () => undefined,
          },
        ],
      }),
    ).rejects.toThrow(/kebab-case|invalid/i);
  });
});
