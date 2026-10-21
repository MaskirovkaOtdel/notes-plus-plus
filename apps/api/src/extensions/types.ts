import type { ApiExtension } from "@notespp/shared";
import type { FastifyInstance } from "fastify";
import type { NotesRepository } from "../db/repository.js";

/**
 * The concrete API extension contract for this app: extensions register
 * against the root Fastify instance and receive the injected repository.
 *
 * Generic machinery lives in @notespp/shared; this alias pins the host types
 * so extension authors get full type safety without importing app internals.
 */
export type NotesApiExtension = ApiExtension<NotesRepository, FastifyInstance>;
