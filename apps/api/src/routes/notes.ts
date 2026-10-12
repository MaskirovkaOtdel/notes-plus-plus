import {
  CreateNoteSchema,
  ListNotesQuerySchema,
  UpdateNoteSchema,
  type Note,
} from "@notespp/shared";
import type { FastifyInstance } from "fastify";
import type { NotesRepository } from "../db/repository.js";

/** Dependencies injected into the route registration. */
export interface NotesRouteOptions {
  repo: NotesRepository;
}

/**
 * Registers the /notes CRUD routes.
 *
 * Kept separate from the app factory so route logic can be exercised in tests
 * against the in-memory repository without booting the full server.
 */
export async function registerNoteRoutes(
  app: FastifyInstance,
  { repo }: NotesRouteOptions,
): Promise<void> {
  app.get("/notes", async (request) => {
    const query = ListNotesQuerySchema.parse(request.query);
    return repo.list(query);
  });

  app.get<{ Params: { id: string } }>("/notes/:id", async (request, reply) => {
    const note = await repo.get(request.params.id);
    if (!note) {
      return reply.code(404).send({ error: "Note not found", code: "NOTE_NOT_FOUND" });
    }
    return note;
  });

  app.post("/notes", async (request, reply) => {
    const input = CreateNoteSchema.parse(request.body);
    const note: Note = await repo.create(input);
    return reply.code(201).send(note);
  });

  app.patch<{ Params: { id: string } }>("/notes/:id", async (request, reply) => {
    const input = UpdateNoteSchema.parse(request.body);
    const note = await repo.update(request.params.id, input);
    if (!note) {
      return reply.code(404).send({ error: "Note not found", code: "NOTE_NOT_FOUND" });
    }
    return note;
  });

  app.delete<{ Params: { id: string } }>("/notes/:id", async (request, reply) => {
    const removed = await repo.remove(request.params.id);
    if (!removed) {
      return reply.code(404).send({ error: "Note not found", code: "NOTE_NOT_FOUND" });
    }
    return reply.code(204).send();
  });
}
