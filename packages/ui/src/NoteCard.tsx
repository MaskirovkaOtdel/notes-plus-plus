import type { Note } from "@notespp/shared";
import { markdownToPlainText } from "@notespp/markdown";

export interface NoteCardProps {
  note: Note;
  onSelect?: (id: string) => void;
}

/** Read-only preview card for a single note in a list. */
export function NoteCard({ note, onSelect }: NoteCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(note.id)}
      className="group w-full rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-indigo-300 hover:shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
    >
      <h3 className="truncate text-sm font-semibold text-slate-900">{note.title}</h3>
      {note.body ? (
        <p className="mt-1 line-clamp-3 text-sm text-slate-500">
          {markdownToPlainText(note.body)}
        </p>
      ) : null}
      {note.tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {note.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      <time className="mt-2 block text-xs text-slate-400">
        {new Date(note.updatedAt).toLocaleDateString()}
      </time>
    </button>
  );
}
