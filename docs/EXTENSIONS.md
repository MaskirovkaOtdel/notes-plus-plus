# Writing an Extension

Notes++ has a first-class extension mechanism: a typed internal registry on
both the API and the web app. This document is the authoring guide.

> The extension seams are **generic extension points**: they exist because
> they benefit this edition on its own (modularity, observability, community
> extensions), and the premium edition layers on top of them as
> `@notespp/premium-api` / `@notespp/premium-web`. See
> [COMMUNITY-PREMIUM.md](./COMMUNITY-PREMIUM.md) for the boundary rules.

## The contracts (in `@notespp/shared`)

| Contract            | Purpose                                                |
| ------------------- | ------------------------------------------------------ |
| `ExtensionManifest` | Identity: kebab-case `id`, display `name`, `version`   |
| `ApiExtension`      | Server side: `register(app, ctx)` runs once at startup |
| `WebExtension`      | Client side: `contributions` keyed by slot             |
| `ExtensionList`     | Shape of `GET /extensions`                             |

Manifests are validated with Zod at registration time. Extension ids must
be unique — registration is **fail-fast**: an invalid manifest, a duplicate
id, or a throwing `register` aborts startup rather than producing a
half-wired server.

## API extensions

```ts
import type { ApiExtension } from "@notespp/shared";

export const myExtension = {
  manifest: { id: "my-ext", name: "My extension", version: "1.0.0" },
  register(app, ctx) {
    app.get("/my-ext/ping", async () => ({ pong: true }));
    // ctx.repo is the injected NotesRepository; ctx.version is the app version.
  },
} satisfies ApiExtension<NotesRepository, FastifyInstance>;
```

Register it in the composition root
(`apps/api/src/extensions/load.ts`). The host pins the generics for you as
`NotesApiExtension` — `buildApp({ extensions })` takes them in array order,
and `GET /extensions` lists whatever registered.

## Web extensions

```tsx
import type { WebExtension, Note } from "@notespp/shared";

export const myWebExtension = {
  manifest: { id: "my-ext", name: "My extension", version: "1.0.0" },
  contributions: {
    noteToolbar: ({ note }) => <span>note {note.id}</span>,
  },
} satisfies WebExtension<Note, ReactElement>;
```

Register it in `apps/web/src/extensions/loader.ts`. Contributions render in
registration order; an absent slot renders nothing.

**Current slots:** `noteToolbar` — rendered in the note detail view.
New slots are added only when a real consumer exists (YAGNI).

## The reference extension

`packages/ext-word-count` is the canonical example, exercising both seams
from one stats core:

- `src/stats.ts` — the shared computation (`computeStats`)
- `src/api.ts` — `GET /notes/:id/stats` (uses a **structural** repo type:
  it only declares the `get` it needs, never app internals)
- `src/web.tsx` — the word-count chip for the `noteToolbar` slot
- subpath exports `./api` and `./web` keep server and client surfaces
  cleanly separated

Copy its layout when starting a new extension.

## Premium overlay

The premium edition is discovered, never depended upon: the composition
roots attempt a dynamic import of `@notespp/premium-api` /
`@notespp/premium-web`.

- **Package absent** (community): graceful no-op — this is the normal state
- **Package present and valid** (premium): loaded last, after community
  extensions
- **Package present but malformed**: startup fails loudly — a broken
  premium install must never silently boot a half-wired server

Community therefore always builds, tests, and runs standalone.
