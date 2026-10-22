import {
  API_ROUTES,
  CreateNoteSchema,
  ListNotesQuerySchema,
  ListNotesResponseSchema,
  NoteSchema,
  UpdateNoteSchema,
  type CreateNote,
  type Health,
  type ListNotesQuery,
  type ListNotesResponse,
  type Note,
  type UpdateNote,
} from "@notespp/shared";
import { markDataFresh, markDataStale } from "./connectivity.js";

/** Base URL for the API. In dev this is proxied by Vite. */
const BASE = import.meta.env.VITE_API_BASE ?? "";

/**
 * Optional bearer token. Set `VITE_API_TOKEN` at build time to match the
 * server's `NOTESPP_API_TOKEN` when the API is deployed beyond localhost.
 */
const TOKEN = import.meta.env.VITE_API_TOKEN;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  parse: (data: unknown) => T,
): Promise<T> {
  // Only declare a JSON content type when a body is actually sent — an
  // empty body with this header makes Fastify reject the request
  // (FST_ERR_CTP_EMPTY_JSON_BODY), which previously broke DELETE.
  const headers: Record<string, string> = {
    ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
    ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
    ...((options.headers as Record<string, string>) ?? {}),
  };
  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  // The service worker stamps responses its NetworkFirst cache produced
  // (see vite.config.ts). A stamp means the payload may be stale — surface
  // that signal until a fresh network response clears it again.
  if (res.headers.get("x-from-cache") === "1") markDataStale();
  else markDataFresh();

  if (res.status === 204) return undefined as T;

  const payload: unknown = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = payload as { error?: string; code?: string };
    throw new ApiError(err.error ?? "Request failed", res.status, err.code ?? "UNKNOWN");
  }

  return parse(payload);
}

/** Typed API client. Every response is validated against the shared schema. */
export const api = {
  health: () => request<Health>(API_ROUTES.health, {}, (d) => d as Health),

  listNotes: (query: Partial<ListNotesQuery> = {}) => {
    const params = new URLSearchParams();
    const parsed = ListNotesQuerySchema.parse(query);
    for (const [k, v] of Object.entries(parsed)) {
      if (v !== undefined) params.set(k, String(v));
    }
    return request<ListNotesResponse>(
      `${API_ROUTES.notes}?${params.toString()}`,
      {},
      (d) => ListNotesResponseSchema.parse(d),
    );
  },

  getNote: (id: string) =>
    request<Note>(API_ROUTES.note(id), {}, (d) => NoteSchema.parse(d)),

  createNote: (input: CreateNote) =>
    request<Note>(
      API_ROUTES.notes,
      { method: "POST", body: JSON.stringify(CreateNoteSchema.parse(input)) },
      (d) => NoteSchema.parse(d),
    ),

  updateNote: (id: string, input: UpdateNote) =>
    request<Note>(
      API_ROUTES.note(id),
      { method: "PATCH", body: JSON.stringify(UpdateNoteSchema.parse(input)) },
      (d) => NoteSchema.parse(d),
    ),

  deleteNote: (id: string) =>
    request<void>(API_ROUTES.note(id), { method: "DELETE" }, () => undefined),
};
