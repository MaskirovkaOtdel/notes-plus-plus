import { Button } from "@notespp/ui";
import { useNote } from "../lib/hooks.js";
import type { NotesWebExtension } from "../extensions/types.js";
import { NoteToolbar } from "./NoteToolbar.js";

export interface NoteDetailProps {
  noteId: string;
  extensions: readonly NotesWebExtension[];
  onBack: () => void;
}

/** Single-note detail view: title, extension toolbar, and body. */
export function NoteDetail({ noteId, extensions, onBack }: NoteDetailProps) {
  const { data: note, isPending, isError } = useNote(noteId);

  return (
    <div>
      <Button onClick={onBack}>← Back</Button>

      {isPending ? (
        <p className="mt-6 text-sm text-slate-500">Loading note…</p>
      ) : isError || !note ? (
        <div className="mt-6 rounded-md bg-rose-50 p-4 text-sm text-rose-700">
          Failed to load the note.
        </div>
      ) : (
        <article>
          <h2 className="mt-6 text-xl font-bold tracking-tight text-slate-900">
            {note.title}
          </h2>
          <NoteToolbar extensions={extensions} note={note} />
          {note.body ? (
            <pre className="mt-4 whitespace-pre-wrap font-sans text-sm text-slate-700">
              {note.body}
            </pre>
          ) : null}
        </article>
      )}
    </div>
  );
}
