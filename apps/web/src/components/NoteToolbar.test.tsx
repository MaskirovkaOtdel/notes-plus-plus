import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NoteToolbar } from "./NoteToolbar.js";
import type { NotesWebExtension } from "../extensions/types.js";
import { makeNote } from "../test-utils.js";

const chipExtension: NotesWebExtension = {
  manifest: { id: "chip", name: "Chip", version: "1.0.0" },
  contributions: {
    noteToolbar: ({ note }) => <span data-testid="chip">chip for {note.title}</span>,
  },
};

const noToolbarExtension: NotesWebExtension = {
  manifest: { id: "silent", name: "Silent", version: "1.0.0" },
  contributions: {},
};

describe("NoteToolbar", () => {
  it("renders nothing when no extension contributes", () => {
    const { container } = render(
      <NoteToolbar extensions={[noToolbarExtension]} note={makeNote()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders contributions in order", () => {
    const second: NotesWebExtension = {
      manifest: { id: "second", name: "Second", version: "1.0.0" },
      contributions: {
        noteToolbar: ({ note }) => <span data-testid="second">{note.id}</span>,
      },
    };
    render(<NoteToolbar extensions={[chipExtension, second]} note={makeNote()} />);
    expect(screen.getByTestId("chip")).toHaveTextContent("chip for Test note");
    expect(screen.getByTestId("second")).toHaveTextContent("note-1");
  });
});
