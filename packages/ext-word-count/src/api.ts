import { NoteStatsSchema } from "@notespp/shared";
import type {
  ApiExtension,
  ApiExtensionContext,
  ExtensionManifest,
  Note,
} from "@notespp/shared";
import type { FastifyInstance } from "fastify";
import { computeStats } from "./stats.js";

/**
 * The minimal repository surface this extension needs. Structural on
 * purpose: the extension package never imports app internals, so it stays
 * decoupled and independently testable.
 */
export interface StatsRepo {
  get(id: string): Promise<Note | null>;
}

export const wordCountManifest: ExtensionManifest = {
  id: "word-count",
  name: "Word Count",
  version: "0.1.0",
};

/**
 * API-side word-count extension: adds `GET /notes/:id/stats`, returning
 * word/character/reading-time statistics for a stored note.
 */
export const wordCountApiExtension = {
  manifest: wordCountManifest,
  register(app: FastifyInstance, ctx: ApiExtensionContext<StatsRepo>): void {
    app.get<{ Params: { id: string } }>("/notes/:id/stats", async (request, reply) => {
      const note = await ctx.repo.get(request.params.id);
      if (!note) {
        return reply.code(404).send({ error: "Note not found", code: "NOTE_NOT_FOUND" });
      }
      return NoteStatsSchema.parse(computeStats(note.body));
    });
  },
} satisfies ApiExtension<StatsRepo, FastifyInstance>;
