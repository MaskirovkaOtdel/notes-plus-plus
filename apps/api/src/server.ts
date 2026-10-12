import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { buildApp } from "./app.js";
import { InMemoryNotesRepository } from "./db/in-memory.js";
import { DrizzleNotesRepository } from "./db/drizzle-repository.js";
import * as schema from "./db/schema.js";

const PORT = Number(process.env.PORT ?? 4000);
const VERSION = process.env.APP_VERSION ?? "0.0.0";
const DATABASE_URL = process.env.DATABASE_URL;

async function main() {
  let repo;

  if (DATABASE_URL) {
    const client = postgres(DATABASE_URL, { max: 10 });
    const db = drizzle(client, { schema });
    repo = new DrizzleNotesRepository(db);
    console.warn("using Postgres repository");
  } else {
    // Seed a couple of notes so a fresh local boot is not empty.
    const seeded = new InMemoryNotesRepository();
    await seeded.create({
      title: "Welcome to Notes++",
      body: "Edit or delete me.",
      tags: ["meta"],
    });
    await seeded.create({
      title: "Second brain",
      body: "Start writing.",
      tags: ["idea"],
    });
    repo = seeded;
    console.warn("DATABASE_URL not set — using in-memory repository (dev only)");
  }

  const app = await buildApp({ repo, version: VERSION });

  const close = async () => {
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);

  await app.listen({ port: PORT, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// auto-merge test footer

