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

- **Phase 4 — Reading experience:** safe Markdown rendering in the detail view (+ card previews); shared renderer later reused by premium HTML export.
- **Phase 5 — 1.0 stabilization:** offline/PWA hardening, self-hosting story (workspace TS-source packaging limitation), docs, deliberate v1.0.
