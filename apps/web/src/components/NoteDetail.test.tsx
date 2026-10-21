import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { NoteDetail } from "./NoteDetail.js";
import { makeNote, stubFetchByRoute } from "../test-utils.js";

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
});
