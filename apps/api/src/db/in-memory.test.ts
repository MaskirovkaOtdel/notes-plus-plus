import { describe, expect, it } from "vitest";
import { InMemoryNotesRepository } from "./in-memory.js";

describe("InMemoryNotesRepository", () => {
  it("creates a note with defaults", async () => {
    const repo = new InMemoryNotesRepository();
    const note = await repo.create({ title: "First" });
    expect(note.id).toBeTruthy();
    expect(note.body).toBe("");
    expect(note.tags).toEqual([]);
    expect(note.createdAt).toBe(note.updatedAt);
  });

  it("retrieves a created note", async () => {
    const repo = new InMemoryNotesRepository();
    const created = await repo.create({ title: "Find me" });
    const found = await repo.get(created.id);
    expect(found?.title).toBe("Find me");
  });

  it("returns null for a missing note", async () => {
    const repo = new InMemoryNotesRepository();
    expect(await repo.get("nope")).toBeNull();
  });

  it("updates only provided fields", async () => {
    const repo = new InMemoryNotesRepository();
    const created = await repo.create({ title: "Original", body: "keep me" });
    const updated = await repo.update(created.id, { title: "Renamed" });
    expect(updated?.title).toBe("Renamed");
    expect(updated?.body).toBe("keep me");
  });

  it("returns null when updating a missing note", async () => {
    const repo = new InMemoryNotesRepository();
    expect(await repo.update("missing", { title: "x" })).toBeNull();
  });

  it("deletes a note", async () => {
    const repo = new InMemoryNotesRepository();
    const created = await repo.create({ title: "Bye" });
    expect(await repo.remove(created.id)).toBe(true);
    expect(await repo.get(created.id)).toBeNull();
  });

  it("returns false when deleting a missing note", async () => {
    const repo = new InMemoryNotesRepository();
    expect(await repo.remove("missing")).toBe(false);
  });

  it("filters by search across title and body", async () => {
    const repo = new InMemoryNotesRepository();
    await repo.create({ title: "Groceries", body: "milk" });
    await repo.create({ title: "Journal", body: "today I bought milk" });
    await repo.create({ title: "Other", body: "nothing" });

    const res = await repo.list({ search: "milk", limit: 20, offset: 0 });
    expect(res.total).toBe(2);
  });

  it("filters by tag", async () => {
    const repo = new InMemoryNotesRepository();
    await repo.create({ title: "A", tags: ["work"] });
    await repo.create({ title: "B", tags: ["home"] });

    const res = await repo.list({ tag: "work", limit: 20, offset: 0 });
    expect(res.total).toBe(1);
    expect(res.items[0]?.title).toBe("A");
  });

  it("paginates results", async () => {
    const repo = new InMemoryNotesRepository();
    for (let i = 0; i < 5; i += 1) await repo.create({ title: `Note ${i}` });

    const page1 = await repo.list({ limit: 2, offset: 0 });
    const page2 = await repo.list({ limit: 2, offset: 2 });
    expect(page1.total).toBe(5);
    expect(page1.items).toHaveLength(2);
    expect(page2.items).toHaveLength(2);
  });

  it("seeds from constructor", async () => {
    const repo = new InMemoryNotesRepository([
      {
        id: "seed-1",
        title: "Seeded",
        body: "",
        tags: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    expect((await repo.get("seed-1"))?.title).toBe("Seeded");
  });
});
