import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import type {
  CreateNote,
  Health,
  ListNotesResponse,
  Note,
  UpdateNote,
} from "@notespp/shared";
import { api } from "./api.js";

export const queryKeys = {
  health: ["health"] as const,
  notes: (params: Record<string, unknown>) => ["notes", params] as const,
  note: (id: string) => ["note", id] as const,
};

/** Fetch API health/version. Cached 5 min — it rarely changes. */
export function useHealth(): UseQueryResult<Health> {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => api.health(),
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

/** Fetch a page of notes. */
export function useNotes(
  params: Record<string, unknown> = {},
): UseQueryResult<ListNotesResponse> {
  return useQuery({
    queryKey: queryKeys.notes(params),
    queryFn: () => api.listNotes(params),
  });
}

/** Fetch a single note. */
export function useNote(id: string | null): UseQueryResult<Note> {
  return useQuery({
    queryKey: queryKeys.note(id ?? ""),
    queryFn: () => api.getNote(id as string),
    enabled: Boolean(id),
  });
}

/** Create a note, then invalidate the list cache. */
export function useCreateNote(): UseMutationResult<Note, unknown, CreateNote> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateNote) => api.createNote(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
  });
}

/** Update a note, then refresh both list and detail caches. */
export function useUpdateNote(): UseMutationResult<
  Note,
  unknown,
  { id: string; input: UpdateNote }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateNote }) =>
      api.updateNote(id, input),
    onSuccess: (note) => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      qc.setQueryData(queryKeys.note(note.id), note);
    },
  });
}

/** Delete a note, then invalidate the list cache. */
export function useDeleteNote(): UseMutationResult<void, unknown, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteNote(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
  });
}
