import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NoteDetail } from "./NoteDetail.js";
import { makeNote, stubFetchByRoute, stubNotesServer } from "../test-utils.js";

function renderDetail(onBack = () => {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<NoteDetail noteId="note-1" extensions={[]} onBack={onBack} />, {
    wrapper,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("NoteDetail", () => {
  it("shows a loading state then the note", async () => {
    stubFetchByRoute({ "/notes/note-1": { body: makeNote({ title: "Detailed" }) } });
    renderDetail();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Detailed" })).toBeInTheDocument(),
    );
  });

  it("shows an error state when the note fails to load", async () => {
    stubFetchByRoute({
      "/notes/note-1": { status: 500, body: { error: "boom", code: "INTERNAL" } },
    });
    renderDetail();
    await waitFor(() =>
      expect(screen.getByText(/Failed to load the note/)).toBeInTheDocument(),
    );
  });

  it("calls onBack when the back button is clicked", async () => {
    const user = userEvent.setup();
    let backed = false;
    stubFetchByRoute({ "/notes/note-1": { body: makeNote() } });
    renderDetail(() => {
      backed = true;
    });
    await user.click(screen.getByRole("button", { name: /Back/ }));
    expect(backed).toBe(true);
  });

  it("renders the word-count chip via the extension seam", async () => {
    stubFetchByRoute({
      "/notes/note-1": { body: makeNote({ body: "one two three" }) },
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { wordCountWebExtension } = await import("@notespp/ext-word-count/web");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    render(
      <NoteDetail
        noteId="note-1"
        extensions={[wordCountWebExtension]}
        onBack={() => {}}
      />,
      { wrapper },
    );
    await waitFor(() =>
      expect(screen.getByTestId("word-count-chip")).toHaveTextContent("3 words"),
    );
  });

  it("enters edit mode with the note prefilled and saves via PATCH", async () => {
    const user = userEvent.setup();
    const { state, fn } = stubNotesServer([makeNote({ title: "Old", body: "old body" })]);
    renderDetail();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Old" })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const title = screen.getByLabelText("Title");
    expect(title).toHaveValue("Old");

    await user.clear(title);
    await user.type(title, "New title");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "New title" })).toBeInTheDocument(),
    );
    expect(state.notes[0]?.title).toBe("New title");
    expect(fn.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(true);
  });

  it("cancels editing and keeps the persisted state", async () => {
    const user = userEvent.setup();
    const { fn } = stubNotesServer([makeNote({ title: "Original" })]);
    renderDetail();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Original" })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Changed");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("heading", { name: "Original" })).toBeInTheDocument();
    expect(fn.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
  });

  it("keeps the Save button disabled until the draft is dirty", async () => {
    const user = userEvent.setup();
    stubNotesServer([makeNote()]);
    renderDetail();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Edit" })).toBeEnabled(),
    );

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("confirms before discarding a dirty draft on Back", async () => {
    const user = userEvent.setup();
    let backed = false;
    stubNotesServer([makeNote()]);
    renderDetail(() => {
      backed = true;
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Edit" })).toBeEnabled(),
    );

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.type(screen.getByLabelText("Title"), "!");

    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await user.click(screen.getByRole("button", { name: /Back/ }));
    expect(confirm).toHaveBeenCalledWith("Discard unsaved changes?");
    expect(backed).toBe(false);

    confirm.mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: /Back/ }));
    expect(backed).toBe(true);
  });

  it("surfaces a save failure inline without losing the draft", async () => {
    const user = userEvent.setup();
    stubFetchByRoute({
      "GET /notes/note-1": { body: makeNote() },
      "PATCH /notes/note-1": { status: 500, body: { error: "boom", code: "INTERNAL" } },
    });
    renderDetail();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Edit" })).toBeEnabled(),
    );

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.type(screen.getByLabelText("Title"), "-changed");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/Saving failed/),
    );
    // Still editing, draft intact.
    expect(screen.getByLabelText("Title")).toHaveValue("Test note-changed");
  });

  it("deletes after an explicit confirmation and returns to the list", async () => {
    const user = userEvent.setup();
    let backed = false;
    const { state } = stubNotesServer([makeNote()]);
    renderDetail(() => {
      backed = true;
    });
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Test note" })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Yes, delete" }));

    await waitFor(() => expect(backed).toBe(true));
    expect(state.notes).toHaveLength(0);
  });

  it("stays on the note when the delete confirmation is declined", async () => {
    const user = userEvent.setup();
    let backed = false;
    stubNotesServer([makeNote()]);
    renderDetail(() => {
      backed = true;
    });
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Test note" })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Keep" }));

    expect(backed).toBe(false);
    expect(screen.getByRole("heading", { name: "Test note" })).toBeInTheDocument();
  });

  it("surfaces a delete failure inline", async () => {
    const user = userEvent.setup();
    stubFetchByRoute({
      "GET /notes/note-1": { body: makeNote() },
      "DELETE /notes/note-1": { status: 500, body: { error: "boom", code: "INTERNAL" } },
    });
    renderDetail();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Test note" })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Yes, delete" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/Deleting failed/),
    );
    expect(screen.getByRole("heading", { name: "Test note" })).toBeInTheDocument();
  });

  it("adds and removes tags in edit mode, then persists them", async () => {
    const user = userEvent.setup();
    const { state } = stubNotesServer([makeNote({ tags: ["keep"] })]);
    renderDetail();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Edit" })).toBeEnabled(),
    );

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.type(screen.getByLabelText("Add tag"), "fresh{Enter}");
    await user.click(screen.getByRole("button", { name: "Remove tag keep" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByText("keep")).not.toBeInTheDocument());
    expect(state.notes[0]?.tags).toEqual(["fresh"]);
  });

  it("feeds the live draft to the toolbar chip while typing", async () => {
    const user = userEvent.setup();
    stubNotesServer([makeNote({ body: "one two three" })]);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { wordCountWebExtension } = await import("@notespp/ext-word-count/web");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    render(
      <NoteDetail
        noteId="note-1"
        extensions={[wordCountWebExtension]}
        onBack={() => {}}
      />,
      { wrapper },
    );
    await waitFor(() =>
      expect(screen.getByTestId("word-count-chip")).toHaveTextContent("3 words"),
    );

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.type(screen.getByLabelText("Body"), " four");
    expect(screen.getByTestId("word-count-chip")).toHaveTextContent("4 words");
  });
});
