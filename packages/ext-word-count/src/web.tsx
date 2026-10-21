import type { Note, WebExtension } from "@notespp/shared";
import type { ReactElement } from "react";
import { wordCountManifest } from "./api.js";
import { computeStats } from "./stats.js";

/** Toolbar chip showing the note's word count and reading time. */
export function WordCountChip({ note }: { note: Note }): ReactElement {
  const { words, readingTimeMinutes } = computeStats(note.body);
  return (
    <span
      data-testid="word-count-chip"
      className="rounded-full bg-slate-100 px-2 py-0.5 font-medium"
    >
      {words} {words === 1 ? "word" : "words"} · ~{readingTimeMinutes} min read
    </span>
  );
}

/** Web-side word-count extension: contributes the chip to the note toolbar. */
export const wordCountWebExtension = {
  manifest: wordCountManifest,
  contributions: {
    noteToolbar: ({ note }: { note: Note }) => <WordCountChip note={note} />,
  },
} satisfies WebExtension<Note, ReactElement>;
