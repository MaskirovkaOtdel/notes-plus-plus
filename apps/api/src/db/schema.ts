import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * Postgres schema for Notes++.
 *
 * Kept deliberately small: a single `notes` table. As features grow (folders,
 * sharing, full-text search) new tables land here and Drizzle generates the
 * migration — no hand-written SQL drift.
 */
export const notes = pgTable("notes", {
  id: varchar("id", { length: 64 }).primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body").notNull().default(""),
  tags: text("tags").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type NoteRow = typeof notes.$inferSelect;
export type NewNoteRow = typeof notes.$inferInsert;
