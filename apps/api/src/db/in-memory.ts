import { randomUUID } from "node:crypto";
import type {
  CreateNote,
  ListNotesQuery,
  ListNotesResponse,
  Note,
  UpdateNote,
} from "@notespp/shared";
import type { NotesRepository } from "./repository.js";

/**
 * Deterministic, dependency-free repository used by unit tests and local dev
 * when no Postgres instance is available. Mirrors the SQL semantics closely
 * enough that route tests are meaningful.
 */
export class InMemoryNotesRepository implements NotesRepository {
  private readonly store = new Map<string, Note>();

  constructor(seed: Note[] = []) {
    for (const note of seed) this.store.set(note.id, note);
  }

  async list(query: ListNotesQuery): Promise<ListNotesResponse> {
    let items = [...this.store.values()];

    if (query.tag) {
      items = items.filter((n) => n.tags.includes(query.tag as string));
    }
    if (query.search) {
      const needle = query.search.toLowerCase();
      items = items.filter(
        (n) =>
          n.title.toLowerCase().includes(needle) || n.body.toLowerCase().includes(needle),
      );
    }

    items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const total = items.length;

    return {
      items: items.slice(query.offset, query.offset + query.limit),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async get(id: string): Promise<Note | null> {
    return this.store.get(id) ?? null;
  }

  async create(input: CreateNote): Promise<Note> {
    const now = new Date().toISOString();
    const note: Note = {
      id: randomUUID(),
      title: input.title,
      body: input.body ?? "",
      tags: input.tags ?? [],
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(note.id, note);
    return note;
  }

  async update(id: string, input: UpdateNote): Promise<Note | null> {
    const existing = this.store.get(id);
    if (!existing) return null;

    const updated: Note = {
      ...existing,
      title: input.title ?? existing.title,
      body: input.body ?? existing.body,
      tags: input.tags ?? existing.tags,
      updatedAt: new Date().toISOString(),
    };
    this.store.set(id, updated);
    return updated;
  }

  async remove(id: string): Promise<boolean> {
    return this.store.delete(id);
  }
}
