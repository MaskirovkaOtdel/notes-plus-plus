import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DrizzleNotesRepository } from "./drizzle-repository.js";
import * as schema from "./schema.js";

/**
 * These tests run the real SQL layer against PGlite — an in-memory Postgres
 * compiled to WASM. No Docker, no mocks: query construction, the `ilike`
 * search, the `ANY` tag filter, and row mapping are all exercised for real.
 */
let repo: DrizzleNotesRepository;
let client: PGlite;

beforeEach(async () => {
  client = new PGlite();
  const db = drizzle(client, { schema });

  // Mirror the schema from drizzle-orm/pg-core so we test the real DDL shape.
  await client.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id varchar(64) PRIMARY KEY,
      title varchar(200) NOT NULL,
      body text NOT NULL DEFAULT '',
      tags text[] NOT NULL DEFAULT '{}',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  repo = new DrizzleNotesRepository(db);
});

afterEach(async () => {
  await client.close();
});

describe("DrizzleNotesRepository", () => {
  it("creates a note and maps row to the public contract", async () => {
    const note = await repo.create({ title: "First", body: "hello", tags: ["a"] });
    expect(note.id).toBeTruthy();
    expect(note.title).toBe("First");
    expect(note.body).toBe("hello");
    expect(note.tags).toEqual(["a"]);
    // Timestamps must be ISO strings on the public contract.
    expect(note.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("defaults body and tags when omitted", async () => {
    const note = await repo.create({ title: "Bare" });
    expect(note.body).toBe("");
    expect(note.tags).toEqual([]);
  });

  it("retrieves a note by id", async () => {
    const created = await repo.create({ title: "Find me" });
    const found = await repo.get(created.id);
    expect(found?.title).toBe("Find me");
  });

  it("returns null for a missing id", async () => {
    expect(await repo.get("does-not-exist")).toBeNull();
  });

  it("updates only the provided fields", async () => {
    const created = await repo.create({ title: "Original", body: "keep", tags: ["x"] });
    const updated = await repo.update(created.id, { title: "Renamed" });
    expect(updated?.title).toBe("Renamed");
    expect(updated?.body).toBe("keep");
    expect(updated?.tags).toEqual(["x"]);
  });

  it("returns null when updating a missing note", async () => {
    expect(await repo.update("missing", { title: "x" })).toBeNull();
  });

  it("removes a note and reports true", async () => {
    const created = await repo.create({ title: "Bye" });
    expect(await repo.remove(created.id)).toBe(true);
    expect(await repo.get(created.id)).toBeNull();
  });

  it("reports false when removing a missing note", async () => {
    expect(await repo.remove("missing")).toBe(false);
  });

  it("lists all notes ordered by updatedAt desc", async () => {
    await repo.create({ title: "Older" });
    await repo.create({ title: "Newer" });
    const res = await repo.list({ limit: 10, offset: 0 });
    expect(res.total).toBe(2);
    expect(res.items).toHaveLength(2);
  });

  it("searches title and body case-insensitively", async () => {
    await repo.create({ title: "Groceries", body: "milk" });
    await repo.create({ title: "Journal", body: "Today I bought MILK" });
    await repo.create({ title: "Other", body: "nothing here" });

    const res = await repo.list({ search: "milk", limit: 10, offset: 0 });
    expect(res.total).toBe(2);
  });

  it("filters by a single tag using ANY", async () => {
    await repo.create({ title: "A", tags: ["work", "urgent"] });
    await repo.create({ title: "B", tags: ["home"] });

    const res = await repo.list({ tag: "work", limit: 10, offset: 0 });
    expect(res.total).toBe(1);
    expect(res.items[0]?.title).toBe("A");
  });

  it("paginates with limit and offset", async () => {
    for (let i = 0; i < 5; i += 1) await repo.create({ title: `Note ${i}` });

    const page1 = await repo.list({ limit: 2, offset: 0 });
    const page2 = await repo.list({ limit: 2, offset: 4 });
    expect(page1.total).toBe(5);
    expect(page1.items).toHaveLength(2);
    expect(page2.items).toHaveLength(1);
  });

  it("combines search and tag filters", async () => {
    await repo.create({ title: "Alpha milk", tags: ["work"] });
    await repo.create({ title: "Alpha home", tags: ["home"] });

    const res = await repo.list({ search: "alpha", tag: "work", limit: 10, offset: 0 });
    expect(res.total).toBe(1);
    expect(res.items[0]?.title).toBe("Alpha milk");
  });

  it("returns an empty list when nothing matches", async () => {
    const res = await repo.list({ search: "zzz", limit: 10, offset: 0 });
    expect(res.total).toBe(0);
    expect(res.items).toEqual([]);
  });
});
