import type { NoteToolbarContribution } from "./types.js";
import type { NotesWebExtension } from "./types.js";

/**
 * Pure registry helpers. Extensions contribute to named slots; a missing
 * slot key means the extension contributes nothing there. Slots are added
 * only when a real consumer exists (YAGNI).
 */
export function noteToolbarContributions(
  extensions: readonly NotesWebExtension[],
): NoteToolbarContribution[] {
  return extensions.flatMap((ext) =>
    ext.contributions.noteToolbar ? [ext.contributions.noteToolbar] : [],
  );
}
