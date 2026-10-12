import { describe, expect, it } from "vitest";
import { api, ApiError } from "./api.js";
import { makeListResponse, makeNote, stubFetch } from "../test-utils.js";

describe("api client", () => {
  it("lists notes and parses the response", async () => {
    const note = makeNote();
    stubFetch([{ body: makeListResponse([note]) }]);

    const res = await api.listNotes();
    expect(res.items).toHaveLength(1);
    expect(res.items[0]?.title).toBe("Test note");
  });

  it("creates a note", async () => {
    const note = makeNote({ title: "Created" });
    stubFetch([{ status: 201, body: note }]);

    const created = await api.createNote({ title: "Created" });
    expect(created.title).toBe("Created");
  });

  it("updates a note", async () => {
    stubFetch([{ body: makeNote({ title: "Updated" }) }]);
    const updated = await api.updateNote("note-1", { title: "Updated" });
    expect(updated.title).toBe("Updated");
  });

  it("deletes a note (204)", async () => {
    stubFetch([{ status: 204, body: undefined }]);
    await expect(api.deleteNote("note-1")).resolves.toBeUndefined();
  });

  it("throws ApiError on failure", async () => {
    stubFetch([
      { status: 404, body: { error: "Note not found", code: "NOTE_NOT_FOUND" } },
    ]);
    await expect(api.getNote("missing")).rejects.toThrow(ApiError);
  });

  it("rejects an invalid create payload locally", async () => {
    const fn = stubFetch([{ body: makeNote() }]);
    // Zod validates synchronously before any network call is made.
    expect(() => api.createNote({ title: "" })).toThrow();
    expect(fn).not.toHaveBeenCalled();
  });

  it("passes a search query to the endpoint", async () => {
    const fn = stubFetch([{ body: makeListResponse([]) }]);
    await api.listNotes({ search: "milk" });
    const url = fn.mock.calls[0]?.[0] as unknown as string;
    expect(url).toContain("search=milk");
  });
});
