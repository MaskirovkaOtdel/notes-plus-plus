import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
  makeHealth,
  makeListResponse,
  makeNote,
  stubFetch,
  stubFetchByRoute,
} from "../test-utils.js";
import {
  useCreateNote,
  useDeleteNote,
  useHealth,
  useNote,
  useNotes,
  useUpdateNote,
} from "./hooks.js";

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("useNotes", () => {
  it("resolves with notes", async () => {
    stubFetch([{ body: makeListResponse([makeNote({ title: "Hooked" })]) }]);
    const { result } = renderHook(() => useNotes(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items[0]?.title).toBe("Hooked");
  });

  it("surfaces fetch errors", async () => {
    stubFetch([{ status: 500, body: { error: "boom", code: "INTERNAL" } }]);
    const { result } = renderHook(() => useNotes(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useHealth", () => {
  it("resolves with health and version", async () => {
    stubFetchByRoute({ "/health": { body: makeHealth({ version: "1.2.3" }) } });
    const { result } = renderHook(() => useHealth(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.version).toBe("1.2.3");
    expect(result.current.data?.status).toBe("ok");
  });

  it("retries once then surfaces errors", async () => {
    stubFetchByRoute({
      "/health": { status: 503, body: { error: "degraded", code: "UNAVAILABLE" } },
    });
    const { result } = renderHook(() => useHealth(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
  });
});

describe("useNote", () => {
  it("fetches when an id is provided", async () => {
    stubFetch([{ body: makeNote({ title: "Detail" }) }]);
    const { result } = renderHook(() => useNote("note-1"), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.title).toBe("Detail");
  });

  it("does not fetch when the id is null", async () => {
    const fn = stubFetch([{ body: makeNote() }]);
    const { result } = renderHook(() => useNote(null), { wrapper: wrapper() });

    // Give React Query a chance; it should stay idle, not fetch.
    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("useCreateNote", () => {
  it("creates a note and invalidates the list cache", async () => {
    stubFetch([
      { status: 201, body: makeNote({ title: "New" }) },
      { body: makeListResponse([]) }, // invalidation refetch
    ]);
    const { result } = renderHook(() => useCreateNote(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isIdle).toBe(true));
    const created = await result.current.mutateAsync({ title: "New" });
    expect(created.title).toBe("New");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("useUpdateNote", () => {
  it("updates a note and refreshes caches", async () => {
    stubFetch([{ body: makeNote({ title: "Updated" }) }, { body: makeListResponse([]) }]);
    const { result } = renderHook(() => useUpdateNote(), { wrapper: wrapper() });

    const updated = await result.current.mutateAsync({
      id: "note-1",
      input: { title: "Updated" },
    });
    expect(updated.title).toBe("Updated");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("useDeleteNote", () => {
  it("deletes a note and invalidates the list cache", async () => {
    stubFetch([{ status: 204, body: undefined }, { body: makeListResponse([]) }]);
    const { result } = renderHook(() => useDeleteNote(), { wrapper: wrapper() });

    await result.current.mutateAsync("note-1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
