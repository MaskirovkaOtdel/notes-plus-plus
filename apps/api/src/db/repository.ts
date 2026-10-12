import type {
  CreateNote,
  ListNotesQuery,
  ListNotesResponse,
  Note,
  UpdateNote,
} from "@notespp/shared";

/**
 * Storage contract for notes.
 *
 * Everything above this interface (routes, validation, services) is storage
 * agnostic. Two implementations exist:
 *
 *  - InMemoryNotesRepository  (tests, local dev without Postgres)
 *  - DrizzleNotesRepository   (production, Postgres)
 *
 * This is the main scalability seam: swapping or sharding storage later only
 * requires a new implementation of this interface.
 */
export interface NotesRepository {
  list(query: ListNotesQuery): Promise<ListNotesResponse>;
  get(id: string): Promise<Note | null>;
  create(input: CreateNote): Promise<Note>;
  update(id: string, input: UpdateNote): Promise<Note | null>;
  remove(id: string): Promise<boolean>;
}
