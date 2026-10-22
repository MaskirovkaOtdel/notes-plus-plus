import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { buildApp } from "./app.js";
import { InMemoryNotesRepository } from "./db/in-memory.js";
import { DrizzleNotesRepository } from "./db/drizzle-repository.js";
import * as schema from "./db/schema.js";
import { loadApiExtensions } from "./extensions/load.js";

const PORT = Number(process.env.PORT ?? 4000);
const VERSION = process.env.APP_VERSION ?? "0.0.0";
const DATABASE_URL = process.env.DATABASE_URL;
// Safe-by-default bind: loopback only. Container deployments (Docker
// compose) set HOST=0.0.0.0 so the port is reachable through the container
// network; anything beyond that should sit behind a reverse proxy.
const HOST = process.env.HOST ?? "127.0.0.1";
const API_TOKEN = process.env.NOTESPP_API_TOKEN;
// Optional: serve the built web app from this directory (single origin).
const WEB_DIST = process.env.WEB_DIST;
// Apply version-controlled SQL migrations at boot (container deployments).
const MIGRATE_ON_BOOT = process.env.MIGRATE_ON_BOOT === "true";

async function main() {
  let repo;

  if (DATABASE_URL) {
    const client = postgres(DATABASE_URL, { max: 10 });
    const db = drizzle(client, { schema });
    if (MIGRATE_ON_BOOT) {
      console.warn("applying database migrations");
      await migrate(db, {
        migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
      });
    }
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

  const app = await buildApp({
    repo,
    version: VERSION,
    extensions: await loadApiExtensions(),
    apiToken: API_TOKEN,
    webDist: WEB_DIST,
  });

  const close = async () => {
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);

  await app.listen({ port: PORT, host: HOST });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
