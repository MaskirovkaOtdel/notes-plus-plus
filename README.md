# Notes++ 📝

A fast, offline-capable, scalable notes application. Web + PWA front end, Node
API, Postgres storage, and a fully automated GitHub Actions pipeline for
prechecks, auto-merge, and semantic versioning.

## Stack

| Layer         | Choice                        | Why                                           |
| ------------- | ----------------------------- | --------------------------------------------- |
| Frontend      | React 19 + Vite + Tailwind v4 | Fast HMR, small bundles, PWA-ready            |
| PWA           | vite-plugin-pwa (Workbox)     | Offline notes via service worker              |
| Data fetching | TanStack Query                | Caching, invalidation, optimistic updates     |
| API           | Fastify 5 + Zod               | Fast, schema-validated, typed end-to-end      |
| ORM           | Drizzle                       | Type-safe SQL, low overhead, easy migrations  |
| Database      | PostgreSQL 16                 | Scalable, full-text search when needed        |
| Monorepo      | pnpm workspaces + Turborepo   | Cached, parallel, one repo for app+API+shared |
| Tests         | Vitest + Playwright           | Fast units with coverage gate + real E2E      |
| CI/CD         | GitHub Actions                | Prechecks, auto-merge, versioned releases     |

## Repository layout

```
apps/
  api/          Fastify + Drizzle + Postgres (CRUD /notes, /health)
  web/          React + Vite + PWA client
packages/
  shared/       Zod schemas + types shared by web and API
  ui/           Reusable React primitives (Button, NoteCard)
e2e/            Playwright end-to-end tests
infra/          docker-compose for Postgres + the app
docs/           Deployment guide, extension API, edition overview
scripts/        Version engine + release-notes generator
.github/        Workflows, CODEOWNERS, PR template
Dockerfile      Multi-stage production image (API + web on one port)
```

## Getting started

```bash
pnpm install
pnpm dev              # web on :5173, api on :4000
```

The API runs with an in-memory store when `DATABASE_URL` is unset. For a real
database:

```bash
pnpm db:up
cp .env.example .env  # set DATABASE_URL
pnpm dev:api
```

## Self-hosting

Run the whole app (API + web + Postgres) with Docker:

```bash
NOTESPP_DB_PASSWORD=<strong-password> pnpm app:up
# open http://localhost:4000
```

The image builds everything from source, runs as a non-root user, applies
database migrations at boot, and serves the API and the web UI on one port.
No Docker? Build once and run under plain Node (>=24):

```bash
pnpm install && pnpm build
WEB_DIST=./apps/web/dist MIGRATE_ON_BOOT=true \
  DATABASE_URL=postgres://... node apps/api/dist/server.js
```

Full configuration (auth token, bind address, reverse proxy, backup) lives in
[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md); the security posture is described
in [SECURITY.md](./SECURITY.md).

## Limitations (by design, for 1.0)

- **Offline reads, not offline writes.** Cached notes stay readable offline;
  edits made while offline fail with an inline error and are not queued.
- **Single user, single device at a time.** No accounts, sharing, or
  collaboration.
- **No authentication unless you enable it.** The API binds to `127.0.0.1` by
  default; set `NOTESPP_API_TOKEN` (and `VITE_API_TOKEN` in the web build)
  before exposing it beyond localhost. See [SECURITY.md](./SECURITY.md).

## Scripts

| Command                        | Description                        |
| ------------------------------ | ---------------------------------- |
| `pnpm dev`                     | Run web + api in watch mode        |
| `pnpm build`                   | Production build of all packages   |
| `pnpm lint` / `pnpm typecheck` | Static checks                      |
| `pnpm test`                    | Unit tests                         |
| `pnpm coverage`                | Unit tests + coverage gate         |
| `pnpm test:e2e`                | Playwright end-to-end              |
| `pnpm version:check`           | Dry-run the version engine locally |
| `pnpm db:up` / `db:down`       | Manage local Postgres              |
| `pnpm app:up` / `app:down`     | Build & run the Docker app         |

## Versioning & releases

Versioning is SemVer, driven entirely by Conventional Commits:

- `X.X.1 → X.X.2` — small patch/hotfix (`fix`, `perf`, `revert`)
- `X.1.X → X.2.X` — mainstream update (`feat`)
- `1.X.X → 2.X.X` — important update (`BREAKING CHANGE` or `type!:`)

Releases are cut automatically on merges to `main`, guarded by anti-overflow
gates so tags never flood:

1. **Type gate** — only release-worthy commit types produce a tag.
2. **Path gate** — docs/meta/config-only changes are ignored.
3. **Cooldown** — rapid merges batch into one release.
4. **24h cap** — a rolling cap prevents runaway releases.
5. **Dedupe** — an existing version is never re-tagged.

A `hotfix` commit marker (`[release-now]`) or a manual `workflow_dispatch` with
`force` bypasses the cooldown and cap. Run `pnpm version:check` locally to see
what the engine would decide.

## Automation

| Workflow              | Purpose                                                      |
| --------------------- | ------------------------------------------------------------ |
| `ci.yml`              | Lint, typecheck, unit + coverage gate, build, E2E            |
| `commit-lint.yml`     | Enforce Conventional Commits on every PR                     |
| `auto-merge.yml`      | Owner PRs auto-merge; third-party PRs contained on `contrib` |
| `contrib-landing.yml` | Keeps a rolling `contrib → main` PR open                     |
| `sync-contrib.yml`    | Fast-forwards `contrib` to `main` after merges               |
| `release.yml`         | Computes version, tags, and publishes GitHub Releases        |

## License

PolyForm Noncommercial License 1.0.0 — free for personal, educational,
research, and other noncommercial use. Commercial use requires a separate
license from the copyright holder. See [LICENSE](./LICENSE).

## Editions

Notes++ ships in a community edition (this repository) and a private premium
edition — see [docs/COMMUNITY-PREMIUM.md](./docs/COMMUNITY-PREMIUM.md) for
how the two relate.
