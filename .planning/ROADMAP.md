# Notes++ Project Roadmap

## Phase 1: Release Automation Cleanup & Streamlining

**Goal:** Restore repo stability, remove diagnostic junk (`schedule-probe.yml`, dummy comments, bot self-approval quirks), and simplify GitHub Actions release automation with reliable Conventional Commits bumping and manual dispatch fallback.

### Success Criteria:

1. `schedule-probe.yml` is deleted and no dummy test comments remain in the codebase.
2. `scripts/version-engine.mjs` has cooldown/cap barriers removed, enabling deterministic version resolution on legitimate commits.
3. `.github/workflows/release.yml` triggers reliably on push to `main` without artificial skipping and supports `workflow_dispatch` with manual overrides.
4. CI checks (`lint`, `format:check`, `typecheck`, `unit tests`) pass locally and on GitHub.
5. Pre-commit hook is plumbed with leak prevention according to SVERG standards.
