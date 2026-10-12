import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { App } from "./App.js";
import { makeListResponse, makeNote, stubFetch } from "./test-utils.js";

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
    stubFetch([{ body: makeListResponse([]) }]);
    renderApp();
    expect(screen.getByRole("heading", { name: "Notes++" })).toBeInTheDocument();
  });

  it("shows a loading state then the notes", async () => {
    stubFetch([{ body: makeListResponse([makeNote({ title: "Groceries" })]) }]);
    renderApp();
    await waitFor(() => expect(screen.getByText("Groceries")).toBeInTheDocument());
  });

  it("shows an empty state", async () => {
    stubFetch([{ body: makeListResponse([]) }]);
    renderApp();
    await waitFor(() => expect(screen.getByText(/No notes yet/)).toBeInTheDocument());
  });

  it("shows an error state when the fetch fails", async () => {
    stubFetch([{ status: 500, body: { error: "boom", code: "INTERNAL" } }]);
    renderApp();
    await waitFor(() =>
      expect(screen.getByText(/Failed to load notes/)).toBeInTheDocument(),
    );
  });

  it("creates a note when the button is clicked", async () => {
    const user = userEvent.setup();
    stubFetch([
      { body: makeListResponse([]) }, // initial list
      { status: 201, body: makeNote({ title: "Untitled note" }) }, // create
      { body: makeListResponse([makeNote({ title: "Untitled note" })]) }, // refetch
    ]);
    renderApp();

    await user.click(screen.getByRole("button", { name: /New note/ }));

    await waitFor(() => expect(screen.getByText("Untitled note")).toBeInTheDocument());
  });
});
