# Deploying Notes++

Two supported paths: Docker (recommended) or bare metal with Node >=24.

## Quickstart (Docker)

```bash
git clone <repo> && cd notes-plus-plus
NOTESPP_DB_PASSWORD=<strong-password> pnpm app:up
# open http://localhost:4000
```

`app:up` builds the image from source and starts two containers: `app`
(API + web on one port, non-root) and `postgres`. Database migrations
(`apps/api/drizzle`) are applied automatically at boot.

To stop: `pnpm app:down` (add `-v` to also delete the database volume).

## What the image does

- Multi-stage build: full workspace install, `pnpm build` (packages compile
  to `dist`, the web app builds with its service worker), then a pruned
  production deploy of the API.
- Runtime: `node:24-alpine`, `USER node`, serves the API and the built web
  app from one process (`WEB_DIST`).
- Healthcheck hits `GET /health`, which is deliberately unauthenticated so
  orchestrators can probe it.

## Configuration

| Variable            | Default     | Purpose                                                        |
| ------------------- | ----------- | -------------------------------------------------------------- |
| `HOST`              | `127.0.0.1` | Bind address. The container sets `0.0.0.0` inside its network. |
| `PORT`              | `4000`      | HTTP port.                                                     |
| `DATABASE_URL`      | _(unset)_   | Postgres URL. Unset = in-memory store (dev only, data lost).   |
| `MIGRATE_ON_BOOT`   | `false`     | Apply `apps/api/drizzle` SQL migrations at startup.            |
| `NOTESPP_API_TOKEN` | _(unset)_   | When set, all routes except `/health` require a bearer token.  |
| `APP_VERSION`       | `0.0.0`     | Reported by `/health` and shown in the UI footer.              |
| `WEB_DIST`          | _(unset)_   | Serve the built web app from this directory (single origin).   |
| `VITE_API_BASE`     | _(empty)_   | Web build: absolute API base if not same-origin.               |
| `VITE_API_TOKEN`    | _(unset)_   | Web build: bearer token matching `NOTESPP_API_TOKEN`.          |

`VITE_*` variables are baked into the web bundle at **build** time; the
compose file passes them through as build args.

## Enabling authentication

The API is unauthenticated by default and binds to loopback. Before the
instance is reachable from other machines:

1. Pick a strong token: `openssl rand -hex 32`.
2. Set it on both sides:

   ```yaml
   # infra/docker-compose.yml — app service
   environment:
     NOTESPP_API_TOKEN: ${VITE_API_TOKEN:-}
   build:
     args:
       VITE_API_TOKEN: ${VITE_API_TOKEN:-}
   ```

   Un-comment the `NOTESPP_API_TOKEN` line in the compose file, then
   `VITE_API_TOKEN=<token> pnpm app:up --build`.

3. Verify: `curl -i http://localhost:4000/notes` returns `401` without the
   header and `200` with `Authorization: Bearer <token>`; `/health` stays
   open.

## Reverse proxy and TLS

The published port is plain HTTP. Terminate TLS at a reverse proxy before
sharing beyond localhost, and proxy to `app:4000` on the compose network.
Any proxy works; keep request bodies unconstrained (notes bodies are plain
JSON) and avoid response buffering only if you later add long-lived
connections.

## Existing databases

`MIGRATE_ON_BOOT=true` (the container default) expects a database that was
created **by those migrations**. If your database predates them (created
with `pnpm db:push`), either:

- keep using `pnpm db:push` for schema changes and leave
  `MIGRATE_ON_BOOT` unset, or
- start from a fresh database/volume and let the migrations create it.

The migrator fails fast (crash loop with `relation "notes" already exists`)
rather than risk applying schema twice — that is intentional.

## Backup and restore

Notes live in the `notes` table of the Postgres volume
(`infra_notespp_pgdata`):

```bash
# backup
docker exec notespp-postgres pg_dump -U notespp notespp > backup.sql
# restore (volume must exist and be empty of the schema)
cat backup.sql | docker exec -i notespp-postgres psql -U notespp notespp
```

## Bare metal

```bash
pnpm install
pnpm build
pnpm db:up                                   # local Postgres, or point elsewhere
DATABASE_URL=... MIGRATE_ON_BOOT=true \
  WEB_DIST=./apps/web/dist \
  node apps/api/dist/server.js
```

Without `WEB_DIST` the API serves JSON only — run `pnpm dev:web` for the
Vite dev server, or host `apps/web/dist` on any static file server (the API
must be reachable from the browser; set `VITE_API_BASE` at build time if it
is not same-origin).

## Upgrading

```bash
git pull
NOTESPP_DB_PASSWORD=<password> pnpm app:up   # rebuilds the image
```

Migrations for new versions apply automatically at boot. Read the release
notes for any manual steps.
