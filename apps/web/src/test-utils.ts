import type { ListNotesResponse, Note } from "@notespp/shared";
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

/** Stub global fetch with a sequence of JSON responses. */
export function stubFetch(responses: Array<{ status?: number; body: unknown }>) {
  let call = 0;
  const fn = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => {
    const res = responses[Math.min(call, responses.length - 1)] ?? {
      status: 200,
      body: {},
    };
    call += 1;
    return {
      ok: (res.status ?? 200) < 400,
      status: res.status ?? 200,
      json: async () => res.body,
    } as Response;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}
