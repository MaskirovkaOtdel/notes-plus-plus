# Community & Premium Editions

Notes++ ships in two editions with a hard boundary between them.

|                  | Community                                            | Premium                            |
| ---------------- | ---------------------------------------------------- | ---------------------------------- |
| **Where**        | This repository                                      | Private, self-hosted repository    |
| **License**      | [PolyForm Noncommercial 1.0.0](../LICENSE)           | Proprietary                        |
| **Availability** | Public, anyone may use it for noncommercial purposes | Owner only, air-gapped (no remote) |
| **Tags**         | `v*`                                                 | `p*`                               |
| **Automation**   | Full GitHub Actions chain                            | Local scripts only                 |

## What lives where

The community edition is a complete, working product on its own. The premium
edition adds capability beyond it in three categories:

- **Advanced & AI features**
- **Security & sync**
- **Power features** (plugins, themes, advanced export, version history,
  collaboration)

The exact premium lineup is intentionally not documented here.

## The boundary rules

1. **Premium code never enters this repository.** Nothing that only makes
   sense in the premium edition may be committed, pushed, or merged here.
2. **Shared improvements land here first.** When premium needs a change to
   community-owned code, that change must be a _generic extension point_
   (feature flag, registration hook, plugin seam) that benefits this edition
   on its own — then it flows into premium via sync. The extension registry
   documented in [EXTENSIONS.md](./EXTENSIONS.md) is the canonical example.
3. **This repo must always build, test, and run standalone.** Premium is an
   overlay (`@notespp/premium-*` packages), never a dependency.

## Sync direction

Community is the upstream: the premium repository pulls from here through a
local git remote. Nothing ever flows the other way. Releases are cut
independently per edition — community tags are cut automatically by GitHub
Actions, premium tags are cut locally with `TAG_PREFIX=p`.
