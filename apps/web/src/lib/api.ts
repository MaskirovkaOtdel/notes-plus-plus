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

/** Base URL for the API. In dev this is proxied by Vite. */
const BASE = import.meta.env.VITE_API_BASE ?? "";

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
  const res = await fetch(`${BASE}${path}`, {
    headers: { "content-type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });

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
