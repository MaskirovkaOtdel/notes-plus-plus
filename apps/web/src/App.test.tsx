import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { App } from "./App.js";
import {
  makeHealth,
  makeListResponse,
  makeNote,
  stubFetchByRoute,
} from "./test-utils.js";

function renderApp() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<App />, { wrapper });
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
});
