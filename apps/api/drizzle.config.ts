import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit configuration.
 *
 * `db:push` syncs the schema in `src/db/schema.ts` directly to the database —
 * ideal for local dev and CI. For production, generate SQL migrations with
 * `db:generate` and apply them from version-controlled files instead.
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://localhost:5432/notespp",
  },
  verbose: true,
  strict: false,
});
