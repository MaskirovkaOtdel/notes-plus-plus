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
