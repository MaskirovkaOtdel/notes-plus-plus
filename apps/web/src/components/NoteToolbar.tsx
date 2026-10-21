import { Fragment } from "react";
import type { Note } from "@notespp/shared";
import { noteToolbarContributions } from "../extensions/registry.js";
import type { NotesWebExtension } from "../extensions/types.js";

export interface NoteToolbarProps {
  extensions: readonly NotesWebExtension[];
  note: Note;
}

/**
 * Renders the noteToolbar slot: every registered contribution in
 * registration order. Renders nothing (null) when no extension
 * contributes, so the slot never adds visual clutter on its own.
 */
export function NoteToolbar({ extensions, note }: NoteToolbarProps) {
  const contributions = noteToolbarContributions(extensions);
  if (contributions.length === 0) return null;

  return (
    <div
      data-testid="note-toolbar"
      className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500"
    >
      {contributions.map((Contribution, index) => (
        <Fragment key={index}>
          <Contribution note={note} />
        </Fragment>
      ))}
    </div>
  );
}
