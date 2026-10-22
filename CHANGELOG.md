# Changelog

All notable changes to this project will be documented in this file.

Entries are recorded at release time in the release commit. The format is
based on [Keep a Changelog](https://keepachangelog.com/), and this project
adheres to [Semantic Versioning](https://semver.org/). Full notes for every
published version also live in the GitHub Releases.

<!-- entries below -->

## [0.9.0] - 2026-10-22

### Added

- Workspace packages build to `dist` with real `exports` and a `development`
  condition, so the API starts with plain `node` and packages are `pnpm pack`
  consumable (Phase 5.1).
- Multi-stage Docker image and a `docker compose` stack (Postgres + app) with
  healthcheck and non-root runtime (Phase 5.2).
- Optional bearer-token auth for API writes via `NOTESPP_API_TOKEN`
  (Phase 5.3).
- Offline readiness UI: service-worker registration failures surface as an
  alert banner, cached-only responses are flagged with a stale-data banner,
  and reconnecting refetches server state without a manual reload (Phase 5.4).
- Production-preview PWA e2e project covering the offline shell, offline save
  errors, and reconnect recovery (Phase 5.4).
- Self-hosting quickstart in the README, `docs/DEPLOYMENT.md`, and
  `SECURITY.md` (Phase 5.5).

### Changed

- **Default bind is loopback** — the API listens on `127.0.0.1` (was
  `0.0.0.0`). Deployments that reach it beyond the machine must set
  `HOST=0.0.0.0` (or another interface) themselves; docker compose already
  does (Phase 5.3).
- **Workspace package entry points** resolve through built `dist` output with
  the `development` condition for the dev toolchain; import package entry
  points rather than deep source paths (Phase 5.1).
- The API serves the built web assets and can run migrations at boot
  (`MIGRATE_ON_BOOT`), so one process can run the whole app (Phase 5.2).
- Offline edits in the web app attempt the save and fail inline with the draft
  intact instead of queueing silently while offline (Phase 5.4).

[0.9.0]: https://github.com/MaskirovkaOtdel/notes-plus-plus/compare/v0.8.1...v0.9.0
