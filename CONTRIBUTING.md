# Contributing to Notes++

Thanks for your interest in contributing! This document explains the
branching model, commit conventions, and how automation handles your PR.

## Branching model

```
main        Protected. Source of truth. Releases are tagged from here.
  ├── contrib   Landing zone for third-party work. Reviewed, then merged to main.
  └── feat/*    Feature branches (owner) — PR straight to main.
```

- **Owner PRs** (`MaskirovkaOtdel`) are auto-approved and auto-merged once CI
  is green.
- **Everyone else:** your work lands on `contrib`. If you open a PR against
  `main`, automation retargets it to `contrib`, labels it `third-party`, and
  requests a review. It is never auto-merged.

## Commit conventions (required)

We use [Conventional Commits](https://www.conventionalcommits.org/). The commit
type directly determines the version bump, so this is enforced in CI:

```
type(scope): subject
```

| Commit type                                                 | Version bump            | Example                          |
| ----------------------------------------------------------- | ----------------------- | -------------------------------- |
| `feat`                                                      | minor (`X.1.X → X.2.X`) | `feat(web): add markdown editor` |
| `fix`, `perf`, `revert`                                     | patch (`X.X.1 → X.X.2`) | `fix(api): race in sync`         |
| `chore`, `docs`, `ci`, `refactor`, `test`, `style`, `build` | none                    | `docs: fix typo`                 |
| `!` or `BREAKING CHANGE` footer                             | major (`1.X.X → 2.X.X`) | `feat!: drop legacy import`      |

Valid scopes: `api`, `web`, `shared`, `ui`, `e2e`, `ci`, `release`, `deps`,
`infra`, `docs`.

## Development

```bash
pnpm install
pnpm dev          # start web + api together
pnpm test         # unit tests
pnpm coverage     # unit tests + coverage gate
pnpm test:e2e     # Playwright end-to-end
```

Local Postgres (optional — the API falls back to in-memory without it):

```bash
pnpm db:up
cp .env.example .env
```

## Pull request checklist

- [ ] Conventional Commit title
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm coverage` pass locally
- [ ] Tests added for new behavior
- [ ] Docs updated if behavior changed
