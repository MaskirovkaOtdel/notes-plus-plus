import type { Note, WebExtension } from "@notespp/shared";
import type { ReactElement } from "react";

/**
 * The concrete web extension contract for this app: contributions receive a
 * note and render a React element (or null to render nothing).
 */
export type NotesWebExtension = WebExtension<Note, ReactElement | null>;

/** A single note toolbar contribution function. */
export type NoteToolbarContribution = NonNullable<
  NotesWebExtension["contributions"]["noteToolbar"]
>;
