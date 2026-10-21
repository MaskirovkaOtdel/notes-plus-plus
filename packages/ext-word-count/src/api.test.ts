import { afterEach, describe, expect, it } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { wordCountApiExtension } from "./api.js";
import type { StatsRepo } from "./api.js";

async function makeApp(repo: StatsRepo): Promise<FastifyInstance> {
  const app = Fastify();
  wordCountApiExtension.register(app, { repo, version: "test" });
  await app.ready();
  return app;
}

const note = {
  id: "n1",
  title: "T",
  body: "one two three",
  tags: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("wordCountApiExtension", () => {
  it("exposes the expected manifest", () => {
    expect(wordCountApiExtension.manifest).toEqual({
      id: "word-count",
      name: "Word Count",
      version: "0.1.0",
    });
  });

  it("serves stats for an existing note", async () => {
    app = await makeApp({ get: async (id: string) => (id === "n1" ? note : null) });
    const res = await app.inject({ method: "GET", url: "/notes/n1/stats" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ words: 3, chars: 13, readingTimeMinutes: 0 });
  });

  it("404s for a missing note with the shared envelope", async () => {
    app = await makeApp({ get: async () => null });
    const res = await app.inject({ method: "GET", url: "/notes/missing/stats" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "Note not found", code: "NOTE_NOT_FOUND" });
  });
});
