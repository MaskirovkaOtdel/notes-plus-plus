# Notes++ Project Roadmap

## Phase 1: Release Automation Cleanup & Streamlining

**Goal:** Restore repo stability, remove diagnostic junk (`schedule-probe.yml`, dummy comments, bot self-approval quirks), and simplify GitHub Actions release automation with reliable Conventional Commits bumping and manual dispatch fallback.

### Success Criteria:

1. `schedule-probe.yml` is deleted and no dummy test comments remain in the codebase.
2. `scripts/version-engine.mjs` has cooldown/cap barriers removed, enabling deterministic version resolution on legitimate commits.
3. `.github/workflows/release.yml` triggers reliably on push to `main` without artificial skipping and supports `workflow_dispatch` with manual overrides.
4. CI checks (`lint`, `format:check`, `typecheck`, `unit tests`) pass locally and on GitHub.
5. Pre-commit hook is plumbed with leak prevention according to SVERG standards.

## Phase 2: Extension Seam (internal registry)

**Goal:** Give the community edition a first-class extension mechanism — a typed internal registry on both API and web surfaces — proven by a shipped reference extension, and structured so the premium edition overlays as "just another extension" rather than a fork.

### Success Criteria:

1. `@notespp/shared` exports extension contracts: `ExtensionManifest`, `ApiExtension`, `WebExtension` (generic, dependency-free beyond Zod).
2. `buildApp()` accepts an `extensions` array; registration is deterministic, validated, and fail-fast; `GET /extensions` lists registered extensions.
3. The web app loads extensions through a registry with a `noteToolbar` slot rendered in a new note detail view; empty slots render nothing.
4. Premium discovery is a graceful no-op in community: dynamic import of `@notespp/premium-api` / `@notespp/premium-web` that silently resolves to nothing when absent, fail-fast when present-but-malformed.
5. `@notespp/ext-word-count` ships as the reference extension: `GET /notes/:id/stats` route + word-count chip in the note toolbar, both driven by one shared stats core.
6. Unit + integration tests prove the app builds and runs **with and without** extensions; e2e covers the chip and the `/extensions` endpoint.
7. `docs/EXTENSIONS.md` documents authoring an extension; boundary doc cross-links it.
8. Full verification suite green locally; release run decision line verified from logs (deliberate `v0.4.0`).

## Phase 3: Note Lifecycle & Editing

**Goal:** Close the most fundamental product gap: the app can create notes but not modify them. Full edit/save/delete lifecycle in the detail view, wired through the existing mutation hooks.

### Success Criteria:

1. The note detail view toggles between read and edit mode: editable title, body, and tags (chips with Enter-to-add / remove affordances).
2. Save persists through the existing `useUpdateNote` hook and invalidates list + detail caches; Cancel restores the last persisted state.
3. Delete requires an explicit confirmation step and returns to the list on success via `useDeleteNote`.
4. The Back button warns when the draft has unsaved changes (dirty guard).
5. While editing, the noteToolbar extension slot receives the live draft — the word-count chip updates as the user types (proves extensions compose with editing state).
6. Saving/deleting failure states are surfaced inline, never silently swallowed.
7. Component + App-level tests cover edit, tags, dirty-guard, and error paths; e2e covers the full lifecycle (create → edit → verify in list → delete → gone).
8. Full verification suite green; deliberate `v0.5.0` with the release decision line verified from logs; premium synced.

### Directional (not yet specced):

- **Phase 4 — Reading experience:** safe Markdown rendering in the detail view (+ card previews); shared renderer later reused by premium HTML export. **Delivered in v0.6.0** (`@notespp/markdown`, marked + injectable DOMPurify sanitizer).
- **Write-path seam (v0.7.0):** `ApiExtension.decorateRepo` lets extensions wrap the repository; composition happens before routes wire up, fail-fast on misuse. Community-usable (audit, metrics) and the basis for premium version history.

## Phase 5: 1.0 Stabilization

**Goal:** Make the self-hosting story real and the 1.0 honest: workspace packages that build and run outside the dev toolchain, a supported Docker deployment, a safe-by-default network posture, hardened offline/PWA behavior with real test coverage, the docs to tie it together — and a deliberate v1.0.0. Scope informed by the premium P3 sync spec (`docs/P3-SPEC.md` in the premium edition): the P3 hub container builds on this phase's packaging and Docker foundation.

### Success Criteria:

1. **Packaging.** Workspace packages compile to `dist` (JS + `.d.ts`) with real `exports` maps; `pnpm build && node apps/api/dist/server.js` boots a healthy API under plain Node with no TypeScript tooling involved; `pnpm pack` on `@notespp/shared` yields a consumable tarball. Dev and test workflows keep resolving source without extra manual build steps. Premium overlay discovery keeps its contract after sync (graceful no-op in community, loads in premium).
2. **Docker deployment.** A multi-stage `Dockerfile` builds the app (API + built web assets) and `infra/docker-compose.yml` gains an app service (healthcheck, Postgres wired, explicit password-rotation guidance). From a clean clone, `docker compose up` serves the app end-to-end — verified live by creating, editing, and reading a note through the deployed UI.
3. **Network safety.** API bind address configurable via `HOST` (safe default `127.0.0.1`; the Docker service sets `0.0.0.0` inside the container). Optional `NOTESPP_API_TOKEN` bearer auth gates every API route except `/health` when set. Tests prove 401 without the token / 200 with it, and unchanged behavior when unset.
4. **PWA/offline hardening.** Service-worker registration failures are handled and surfaced instead of failing silently. When the `NetworkFirst` API cache fires while the page is open, the UI signals that data is stale and refetches on reconnect. A production-preview e2e project covers: the SW registers, app shell + cached notes load with the network offline, an offline edit attempt surfaces the inline error, and reconnect recovers.
5. **Docs.** README gains a self-hosting quickstart (Docker + bare metal) and an honest limitations section (no offline write queue; no auth unless `NOTESPP_API_TOKEN` is set). New `docs/DEPLOYMENT.md` (env-var table incl. `HOST`/`NOTESPP_API_TOKEN`/`DATABASE_URL`, reverse-proxy notes, backup) and `SECURITY.md` (reporting channel + exposure guidance).
6. **Deliberate v1.0.0.** Full verification suite green — `pnpm lint && pnpm format:check && pnpm typecheck && pnpm coverage && pnpm build && pnpm test:e2e` (including the new production-PWA e2e) — pushed with GitHub CI green; engine-driven `v1.0.0` release with its decision line read explicitly from the run (`engine exit code: 0`); CHANGELOG current; premium synced onto the release with its own suite green.

### Non-goals (documented limitations, not built here):

- Offline write queue / background sync — offline _reads_ are supported; offline write attempts fail with inline errors (stated in docs).
- Auth beyond the optional single bearer token — multi-user/collaboration stays parked.
- Publishing packages to a registry — pack-ability is proven; npm publication is out of scope.
- Native mobile apps, i18n.
