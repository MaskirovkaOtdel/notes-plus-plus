import { randomUUID } from "node:crypto";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type {
  CreateNote,
  ListNotesQuery,
  ListNotesResponse,
  Note,
  UpdateNote,
} from "@notespp/shared";
import { notes, type NoteRow } from "./schema.js";
import type { NotesRepository } from "./repository.js";

/**
 * The shared Drizzle base type. Both the production driver
 * (`drizzle-orm/postgres-js` → PostgresJsDatabase) and the in-memory test
 * driver (`drizzle-orm/pglite` → PgliteDatabase) extend `PgDatabase`, so this
 * single repository class serves both without any casts.
 */
type Db = PgDatabase<PgQueryResultHKT, Record<string, unknown>>;

/** Map a raw DB row to the public Note contract. */
function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    tags: row.tags ?? [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Postgres-backed repository used in production. */
export class DrizzleNotesRepository implements NotesRepository {
  constructor(private readonly db: Db) {}

  async list(query: ListNotesQuery): Promise<ListNotesResponse> {
    const conditions = [];
    if (query.search) {
      const needle = `%${query.search}%`;
      conditions.push(or(ilike(notes.title, needle), ilike(notes.body, needle)));
    }
    if (query.tag) {
      conditions.push(sql`${query.tag} = ANY(${notes.tags})`);
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, totalRows] = await Promise.all([
      this.db
        .select()
        .from(notes)
        .where(where)
        .orderBy(desc(notes.updatedAt))
        .limit(query.limit)
        .offset(query.offset),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(notes)
        .where(where),
    ]);

    const total = Number(totalRows[0]?.count ?? 0);
    return { items: rows.map(toNote), total, limit: query.limit, offset: query.offset };
  }

  async get(id: string): Promise<Note | null> {
    const rows = await this.db.select().from(notes).where(eq(notes.id, id)).limit(1);
    const row = rows[0];
    return row ? toNote(row) : null;
  }

  async create(input: CreateNote): Promise<Note> {
    const id = randomUUID();
    const rows = await this.db
      .insert(notes)
      .values({
        id,
        title: input.title,
        body: input.body ?? "",
        tags: input.tags ?? [],
      })
      .returning();
    const row = rows[0];
    if (!row) throw new Error("insert returned no row");
    return toNote(row);
  }

  async update(id: string, input: UpdateNote): Promise<Note | null> {
    const rows = await this.db
      .update(notes)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
        updatedAt: new Date(),
      })
      .where(eq(notes.id, id))
      .returning();
    const row = rows[0];
    return row ? toNote(row) : null;
  }

  async remove(id: string): Promise<boolean> {
    const rows = await this.db
      .delete(notes)
      .where(eq(notes.id, id))
      .returning({ id: notes.id });
    return rows.length > 0;
  }
}
