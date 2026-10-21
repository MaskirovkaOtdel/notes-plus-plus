import { useEffect, useState } from "react";
import { Button, NoteCard } from "@notespp/ui";
import { NoteDetail } from "./components/NoteDetail.js";
import { loadWebExtensions } from "./extensions/loader.js";
import type { NotesWebExtension } from "./extensions/types.js";
import { useCreateNote, useHealth, useNotes } from "./lib/hooks.js";

/** Main application shell: note list + create action, or the detail view. */
export function App() {
  const [search, setSearch] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [extensions, setExtensions] = useState<NotesWebExtension[]>([]);
  const { data, isPending, isError, refetch } = useNotes(search ? { search } : {});
  const createNote = useCreateNote();
  const health = useHealth();

  useEffect(() => {
    let alive = true;
    loadWebExtensions().then((loaded) => {
      if (alive) setExtensions(loaded);
    });
    return () => {
      alive = false;
    };
  }, []);

  const handleCreate = async () => {
    await createNote.mutateAsync({
      title: "Untitled note",
      body: "",
      tags: [],
    });
    await refetch();
  };

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col px-4 py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Notes++</h1>
        <Button onClick={handleCreate} disabled={createNote.isPending}>
          {createNote.isPending ? "Creating…" : "New note"}
        </Button>
      </header>

      <div className="mt-6">
        <label htmlFor="search" className="sr-only">
          Search notes
        </label>
        <input
          id="search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notes…"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <main className="mt-6 flex-1">
        {selectedNoteId ? (
          <NoteDetail
            noteId={selectedNoteId}
            extensions={extensions}
            onBack={() => setSelectedNoteId(null)}
          />
        ) : isPending ? (
          <p className="text-sm text-slate-500">Loading notes…</p>
        ) : isError ? (
          <div className="rounded-md bg-rose-50 p-4 text-sm text-rose-700">
            Failed to load notes. Is the API running?
          </div>
        ) : data.items.length === 0 ? (
          <p className="text-sm text-slate-500">
            {search ? "No notes match your search." : "No notes yet — create one."}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.items.map((note) => (
              <li key={note.id}>
                <NoteCard note={note} onSelect={setSelectedNoteId} />
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer className="mt-8 border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
        Notes++ — offline-capable notes
        {health.data ? (
          <span data-testid="app-version"> · v{health.data.version}</span>
        ) : null}
      </footer>
    </div>
  );
}
