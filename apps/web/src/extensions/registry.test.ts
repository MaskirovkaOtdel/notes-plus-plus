import { describe, expect, it } from "vitest";
import { noteToolbarContributions } from "./registry.js";
import type { NotesWebExtension } from "./types.js";

const contribution = () => null;

const ext = (id: string, withToolbar: boolean): NotesWebExtension => ({
  manifest: { id, name: id, version: "1.0.0" },
  contributions: withToolbar ? { noteToolbar: contribution } : {},
});

describe("noteToolbarContributions", () => {
  it("returns an empty list for no extensions", () => {
    expect(noteToolbarContributions([])).toEqual([]);
  });

  it("collects contributions in registration order, skipping absent slots", () => {
    const a = ext("a", true);
    const b = ext("b", false);
    const c = ext("c", true);
    expect(noteToolbarContributions([a, b, c])).toEqual([
      a.contributions.noteToolbar,
      c.contributions.noteToolbar,
    ]);
  });
});
