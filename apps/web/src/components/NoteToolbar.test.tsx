import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

function renderToolbar(extensions: readonly NotesWebExtension[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NoteToolbar extensions={extensions} note={makeNote()} />
    </QueryClientProvider>,
  );
}

describe("NoteToolbar", () => {
  it("renders nothing when no extension contributes", () => {
    const { container } = renderToolbar([noToolbarExtension]);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders contributions in order", () => {
    const second: NotesWebExtension = {
      manifest: { id: "second", name: "Second", version: "1.0.0" },
      contributions: {
        noteToolbar: ({ note }) => <span data-testid="second">{note.id}</span>,
      },
    };
    renderToolbar([chipExtension, second]);
    expect(screen.getByTestId("chip")).toHaveTextContent("chip for Test note");
    expect(screen.getByTestId("second")).toHaveTextContent("note-1");
  });

  it("hands contributions a refreshNote callback that invalidates caches", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    let seenRefresh: (() => void) | undefined;
    const observer: NotesWebExtension = {
      manifest: { id: "observer", name: "Observer", version: "1.0.0" },
      contributions: {
        noteToolbar: ({ refreshNote }) => {
          seenRefresh = refreshNote;
          return <span data-testid="observer" />;
        },
      },
    };
    render(
      <QueryClientProvider client={client}>
        <NoteToolbar extensions={[observer]} note={makeNote()} />
      </QueryClientProvider>,
    );
    expect(seenRefresh).toBeTypeOf("function");
    seenRefresh?.();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["note", "note-1"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["notes"] });
  });
});
