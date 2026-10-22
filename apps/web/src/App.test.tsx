import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App.js";
import {
  makeHealth,
  makeListResponse,
  makeNote,
  stubFetchByRoute,
  stubNotesServer,
} from "./test-utils.js";

function renderApp() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { ...render(<App />, { wrapper }), client };
}

describe("App", () => {
  it("renders the heading", async () => {
    stubFetchByRoute({
      "/health": { body: makeHealth() },
      "/notes": { body: makeListResponse([]) },
    });
    renderApp();
    expect(screen.getByRole("heading", { name: "Notes++" })).toBeInTheDocument();
  });

  it("shows a loading state then the notes", async () => {
    stubFetchByRoute({
      "/health": { body: makeHealth() },
      "/notes": { body: makeListResponse([makeNote({ title: "Groceries" })]) },
    });
    renderApp();
    await waitFor(() => expect(screen.getByText("Groceries")).toBeInTheDocument());
  });

  it("shows an empty state", async () => {
    stubFetchByRoute({
      "/health": { body: makeHealth() },
      "/notes": { body: makeListResponse([]) },
    });
    renderApp();
    await waitFor(() => expect(screen.getByText(/No notes yet/)).toBeInTheDocument());
  });

  it("shows an error state when the fetch fails", async () => {
    stubFetchByRoute({
      "/health": { body: makeHealth() },
      "/notes": { status: 500, body: { error: "boom", code: "INTERNAL" } },
    });
    renderApp();
    await waitFor(() =>
      expect(screen.getByText(/Failed to load notes/)).toBeInTheDocument(),
    );
  });

  it("displays the API version in the footer once health resolves", async () => {
    stubFetchByRoute({
      "/health": { body: makeHealth({ version: "4.2.0" }) },
      "/notes": { body: makeListResponse([]) },
    });
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId("app-version")).toHaveTextContent("v4.2.0"),
    );
  });

  it("refetches queries when the network reconnects", async () => {
    stubFetchByRoute({
      "/health": { body: makeHealth() },
      "/notes": { body: makeListResponse([]) },
    });
    const { client } = renderApp();
    await waitFor(() => expect(screen.getByTestId("app-version")).toBeInTheDocument());

    const spy = vi.spyOn(client, "invalidateQueries");
    window.dispatchEvent(new Event("online"));
    expect(spy).toHaveBeenCalledTimes(1);

    spy.mockRestore();
  });

  it("creates a note when the button is clicked", async () => {
    const user = userEvent.setup();
    // Once POST /notes has been served, the list refetch reflects the new note.
    // Keying off the POST (not test-body timing) keeps this deterministic.
    let created = false;
    stubFetchByRoute({
      "/health": { body: makeHealth() },
      "GET /notes": {
        get body() {
          return created
            ? makeListResponse([makeNote({ title: "Untitled note" })])
            : makeListResponse([]);
        },
      },
      "POST /notes": {
        status: 201,
        get body() {
          created = true;
          return makeNote({ title: "Untitled note" });
        },
      },
    });
    renderApp();

    // Sanity: the note is not present before the create.
    expect(screen.queryByText("Untitled note")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /New note/ }));

    await waitFor(() => expect(screen.getByText("Untitled note")).toBeInTheDocument());
  });

  it("opens the detail view with the extension chip when a note is clicked", async () => {
    const user = userEvent.setup();
    stubFetchByRoute({
      "/health": { body: makeHealth() },
      // Insertion order matters: the specific detail route must come first,
      // since "/notes" also matches "/notes/note-1" as a substring.
      "/notes/note-1": {
        body: makeNote({ title: "Deep dive", body: "alpha beta gamma" }),
      },
      "/notes": { body: makeListResponse([makeNote({ title: "Deep dive" })]) },
    });
    renderApp();

    await waitFor(() => expect(screen.getByText("Deep dive")).toBeInTheDocument());
    await user.click(screen.getByText("Deep dive"));

    // The detail view renders, driven by the noteToolbar extension slot.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Back/ })).toBeInTheDocument(),
    );
    expect(screen.getByTestId("word-count-chip")).toHaveTextContent("3 words");
  });

  it("runs the full lifecycle: open → edit → verify in list → delete → gone", async () => {
    const user = userEvent.setup();
    stubNotesServer([makeNote({ title: "Lifecycle", body: "before edit" })]);
    renderApp();

    // Open the detail view.
    await waitFor(() => expect(screen.getByText("Lifecycle")).toBeInTheDocument());
    await user.click(screen.getByText("Lifecycle"));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument(),
    );

    // Edit the body and save.
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByLabelText("Body"));
    await user.type(screen.getByLabelText("Body"), "after edit");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByText("after edit")).toBeInTheDocument());

    // Back to the list: the persisted change is reflected.
    await user.click(screen.getByRole("button", { name: /Back/ }));
    await waitFor(() => expect(screen.getByText("after edit")).toBeInTheDocument());

    // Reopen and delete with the inline confirmation.
    await user.click(screen.getByText("Lifecycle"));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Yes, delete" }));

    // Back on the list, and the note is gone.
    await waitFor(() => expect(screen.getByText(/No notes yet/)).toBeInTheDocument());
  });
});
