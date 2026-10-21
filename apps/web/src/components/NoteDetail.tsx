import { useState } from "react";
import { renderMarkdown } from "@notespp/markdown";
import { Button } from "@notespp/ui";
import { useDeleteNote, useNote, useUpdateNote } from "../lib/hooks.js";
import type { NotesWebExtension } from "../extensions/types.js";
import { NoteToolbar } from "./NoteToolbar.js";
import { TagsEditor } from "./TagsEditor.js";

export interface NoteDetailProps {
  noteId: string;
  extensions: readonly NotesWebExtension[];
  onBack: () => void;
}

interface Draft {
  title: string;
  body: string;
  tags: string[];
}

/** Single-note detail view with the full edit/save/delete lifecycle. */
export function NoteDetail({ noteId, extensions, onBack }: NoteDetailProps) {
  const { data: note, isPending, isError } = useNote(noteId);
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const dirty =
    draft !== null &&
    note !== undefined &&
    (draft.title !== note.title ||
      draft.body !== note.body ||
      draft.tags.join("\u0000") !== note.tags.join("\u0000"));

  const handleBack = () => {
    if (isEditing && dirty && !window.confirm("Discard unsaved changes?")) return;
    onBack();
  };

  const startEditing = () => {
    if (!note) return;
    setDraft({ title: note.title, body: note.body, tags: [...note.tags] });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setDraft(null);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!note || !draft) return;
    try {
      await updateNote.mutateAsync({
        id: note.id,
        input: { title: draft.title, body: draft.body, tags: draft.tags },
      });
      cancelEditing();
    } catch {
      // Surfaced inline through updateNote.isError; the draft stays intact.
    }
  };

  const handleDelete = async () => {
    if (!note) return;
    try {
      await deleteNote.mutateAsync(note.id);
      onBack();
    } catch {
      // Surfaced inline through deleteNote.isError.
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" onClick={handleBack}>
          ← Back
        </Button>

        {!isEditing ? (
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={startEditing} disabled={!note}>
              Edit
            </Button>
            {showDeleteConfirm ? (
              <span className="flex items-center gap-2 text-xs text-slate-600">
                Delete this note?
                <Button
                  variant="danger"
                  onClick={handleDelete}
                  disabled={deleteNote.isPending}
                >
                  {deleteNote.isPending ? "Deleting…" : "Yes, delete"}
                </Button>
                <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
                  Keep
                </Button>
              </span>
            ) : (
              <Button
                variant="secondary"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={!note}
              >
                Delete
              </Button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSave}
              disabled={updateNote.isPending || !dirty || draft?.title.trim() === ""}
            >
              {updateNote.isPending ? "Saving…" : "Save"}
            </Button>
            <Button variant="secondary" onClick={cancelEditing}>
              Cancel
            </Button>
          </div>
        )}
      </div>

      {isPending ? (
        <p className="mt-6 text-sm text-slate-500">Loading note…</p>
      ) : isError || !note ? (
        <div className="mt-6 rounded-md bg-rose-50 p-4 text-sm text-rose-700">
          Failed to load the note.
        </div>
      ) : (
        <article>
          {isEditing && draft ? (
            <div>
              <label htmlFor="note-title" className="sr-only">
                Title
              </label>
              <input
                id="note-title"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className="mt-6 w-full rounded-md border border-slate-300 px-3 py-2 text-lg font-semibold shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <NoteToolbar extensions={extensions} note={{ ...note, ...draft }} />
              <label htmlFor="note-body" className="sr-only">
                Body
              </label>
              <textarea
                id="note-body"
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                rows={12}
                className="mt-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <TagsEditor
                tags={draft.tags}
                onChange={(tags) => setDraft({ ...draft, tags })}
              />
              {updateNote.isError ? (
                <div
                  role="alert"
                  className="mt-4 rounded-md bg-rose-50 p-3 text-sm text-rose-700"
                >
                  Saving failed — your draft is intact, try again.
                </div>
              ) : null}
            </div>
          ) : (
            <div>
              <h2 className="mt-6 text-xl font-bold tracking-tight text-slate-900">
                {note.title}
              </h2>
              <NoteToolbar extensions={extensions} note={note} />
              {note.body ? (
                <div
                  data-testid="note-body"
                  className="prose-note mt-4 text-sm text-slate-700"
                  // Sanitized by renderMarkdown (marked + DOMPurify).
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(note.body) }}
                />
              ) : null}
              {note.tags.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-1">
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
              {deleteNote.isError ? (
                <div
                  role="alert"
                  className="mt-4 rounded-md bg-rose-50 p-3 text-sm text-rose-700"
                >
                  Deleting failed — try again.
                </div>
              ) : null}
            </div>
          )}
        </article>
      )}
    </div>
  );
}
