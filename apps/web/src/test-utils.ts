import type { Health, ListNotesResponse, Note } from "@notespp/shared";
import { vi } from "vitest";

export const makeNote = (overrides: Partial<Note> = {}): Note => ({
  id: "note-1",
  title: "Test note",
  body: "Body text",
  tags: ["tag-a"],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  ...overrides,
});

export const makeHealth = (overrides: Partial<Health> = {}): Health => ({
  status: "ok",
  version: "9.9.9-test",
  uptimeSeconds: 42,
  ...overrides,
});

export const makeListResponse = (
  items: Note[],
  overrides: Partial<ListNotesResponse> = {},
): ListNotesResponse => ({
  items,
  total: items.length,
  limit: 20,
  offset: 0,
  ...overrides,
});

type StubResponse = {
  status?: number;
  body: unknown;
  /** Response headers (e.g. the SW's `x-from-cache` stamp). */
  headers?: Record<string, string>;
};

function toResponse(res: StubResponse): Response {
  const headerMap = new Map(
    Object.entries(res.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return {
    ok: (res.status ?? 200) < 400,
    status: res.status ?? 200,
    headers: {
      get: (name: string) =>
        (headerMap.get(name.toLowerCase()) as string | undefined) ?? null,
    },
    json: async () => res.body,
  } as unknown as Response;
}

/** Stub global fetch with a sequence of JSON responses. */
export function stubFetch(responses: StubResponse[]) {
  let call = 0;
  const fn = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => {
    const res = responses[Math.min(call, responses.length - 1)] ?? {
      status: 200,
      body: {},
    };
    call += 1;
    return toResponse(res);
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

/**
 * Stub fetch by route pattern. More robust than the sequence stub when a
 * component fires several independent queries (e.g. notes + health) whose
 * resolution order isn't guaranteed.
 *
 * Patterns match as substrings of the URL. Prefix with a method and a space
 * (e.g. `"POST /notes"`) to also match on the HTTP method; otherwise any
 * method matches. Object keys are checked in insertion order.
 */
export function stubFetchByRoute(routes: Record<string, StubResponse>) {
  const fn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();
    for (const [pattern, res] of Object.entries(routes)) {
      const [maybeMethod, urlPattern] = pattern.includes(" ")
        ? (pattern.split(" ") as [string, string])
        : [null, pattern];
      if (maybeMethod && maybeMethod.toUpperCase() !== method) continue;
      if (url.includes(urlPattern)) return toResponse(res);
    }
    throw new Error(`stubFetchByRoute: no route matched ${method} ${url}`);
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

/**
 * Stateful single-server stub for the notes REST surface (list, create,
 * get, update, delete). Mutations actually mutate the backing array, so
 * refetches after a save/delete reflect the change — exactly what the
 * lifecycle (edit → verify → delete) tests need.
 */
export function stubNotesServer(initial: Note[]) {
  const state = { notes: [...initial] };
  const notFound = { status: 404, body: { error: "not found", code: "NOT_FOUND" } };

  const fn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();

    const idMatch = url.match(/^\/notes\/([^/?]+)$/);
    if (idMatch) {
      const id = idMatch[1];
      const note = state.notes.find((n) => n.id === id);
      if (method === "GET") {
        return toResponse(note ? { body: note } : notFound);
      }
      if (method === "PATCH") {
        if (!note) return toResponse(notFound);
        const patch = JSON.parse(String(init?.body)) as Partial<Note>;
        const updated: Note = {
          ...note,
          ...patch,
          updatedAt: "2026-01-03T00:00:00.000Z",
        };
        state.notes = state.notes.map((n) => (n.id === id ? updated : n));
        return toResponse({ body: updated });
      }
      if (method === "DELETE") {
        if (!note) return toResponse(notFound);
        state.notes = state.notes.filter((n) => n.id !== id);
        return toResponse({ status: 204, body: undefined });
      }
    }

    if (url.startsWith("/health")) {
      return toResponse({ body: makeHealth() });
    }

    if (url.startsWith("/notes")) {
      if (method === "GET") return toResponse({ body: makeListResponse(state.notes) });
      if (method === "POST") {
        const created = makeNote({
          ...JSON.parse(String(init?.body)),
          id: `note-${state.notes.length + 1}`,
        });
        state.notes = [...state.notes, created];
        return toResponse({ body: created });
      }
    }

    throw new Error(`stubNotesServer: no route matched ${method} ${url}`);
  });
  vi.stubGlobal("fetch", fn);
  return { state, fn };
}
