import type { NoteStats } from "@notespp/shared";

/** Average adult reading speed, words per minute. */
export const WORDS_PER_MINUTE = 200;

/**
 * Computes word/character statistics for a note body.
 *
 * Deliberately naive: whitespace-split words, raw character count. This is
 * the shared core both the API route and the web toolbar chip consume, so
 * the two surfaces can never disagree.
 */
export function computeStats(body: string): NoteStats {
  const chars = body.length;
  const trimmed = body.trim();
  const words = trimmed === "" ? 0 : trimmed.split(/\s+/).length;
  const readingTimeMinutes = Math.round((words / WORDS_PER_MINUTE) * 10) / 10;
  return { words, chars, readingTimeMinutes };
}
