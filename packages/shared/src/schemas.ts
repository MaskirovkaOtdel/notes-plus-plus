import { z } from "zod";

/** ISO-8601 timestamp string. */
export const IsoDateTime = z.string().datetime();

/** A note identifier (ULID/UUID-ish, opaque to the client). */
export const NoteId = z.string().min(1).max(64);

/** Core note body shared by create/update/read responses. */
export const NoteSchema = z.object({
  id: NoteId,
  title: z.string().min(1).max(200),
  /** Markdown body of the note. */
  body: z.string().max(500_000).default(""),
  tags: z.array(z.string().min(1).max(50)).max(32).default([]),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

export type Note = z.infer<typeof NoteSchema>;

/** Payload for creating a note. `id`/timestamps are server-generated.
 *  `z.input` keeps `body`/`tags` optional since they have schema defaults. */
export const CreateNoteSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(500_000).default(""),
  tags: z.array(z.string().min(1).max(50)).max(32).default([]),
});

export type CreateNote = z.input<typeof CreateNoteSchema>;

/** Partial update; all fields optional, server merges. */
export const UpdateNoteSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    body: z.string().max(500_000).optional(),
    tags: z.array(z.string().min(1).max(50)).max(32).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "Update must contain at least one field",
  });

export type UpdateNote = z.infer<typeof UpdateNoteSchema>;

/** Query params for listing notes. */
export const ListNotesQuerySchema = z.object({
  search: z.string().max(200).optional(),
  tag: z.string().max(50).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListNotesQuery = z.infer<typeof ListNotesQuerySchema>;

export const ListNotesResponseSchema = z.object({
  items: z.array(NoteSchema),
  total: z.number().int().min(0),
  limit: z.number().int(),
  offset: z.number().int(),
});

export type ListNotesResponse = z.infer<typeof ListNotesResponseSchema>;

/** Standard error envelope every API failure returns. */
export const ApiErrorSchema = z.object({
  error: z.string(),
  code: z.string(),
  details: z.unknown().optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

/** Health check response. */
export const HealthSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  version: z.string(),
  uptimeSeconds: z.number(),
});

export type Health = z.infer<typeof HealthSchema>;

/** Word/character statistics for a note body. */
export const NoteStatsSchema = z.object({
  words: z.number().int().min(0),
  chars: z.number().int().min(0),
  readingTimeMinutes: z.number().min(0),
});

export type NoteStats = z.infer<typeof NoteStatsSchema>;

/** Canonical API routes, so the web client never hardcodes strings. */
export const API_ROUTES = {
  health: "/health",
  notes: "/notes",
  note: (id: string) => `/notes/${encodeURIComponent(id)}`,
  noteStats: (id: string) => `/notes/${encodeURIComponent(id)}/stats`,
  extensions: "/extensions",
} as const;
