import { describe, expect, it } from "vitest";
import {
  API_ROUTES,
  CreateNoteSchema,
  ListNotesQuerySchema,
  UpdateNoteSchema,
} from "./schemas.js";

describe("API_ROUTES", () => {
  it("builds the note route from an id", () => {
    expect(API_ROUTES.note("abc")).toBe("/notes/abc");
  });

  it("URL-encodes special characters in ids", () => {
    expect(API_ROUTES.note("a/b c")).toBe("/notes/a%2Fb%20c");
  });

  it("exposes the static routes", () => {
    expect(API_ROUTES.health).toBe("/health");
    expect(API_ROUTES.notes).toBe("/notes");
  });
});

describe("CreateNoteSchema", () => {
  it("accepts a minimal note", () => {
    const parsed = CreateNoteSchema.parse({ title: "Hello" });
    expect(parsed.title).toBe("Hello");
    expect(parsed.body).toBe("");
    expect(parsed.tags).toEqual([]);
  });

  it("rejects an empty title", () => {
    expect(() => CreateNoteSchema.parse({ title: "" })).toThrow();
  });

  it("rejects a title over 200 chars", () => {
    expect(() => CreateNoteSchema.parse({ title: "a".repeat(201) })).toThrow();
  });
});

describe("UpdateNoteSchema", () => {
  it("requires at least one field", () => {
    expect(() => UpdateNoteSchema.parse({})).toThrow();
  });

  it("accepts a partial body-only update", () => {
    const parsed = UpdateNoteSchema.parse({ body: "new content" });
    expect(parsed.body).toBe("new content");
  });
});

describe("ListNotesQuerySchema", () => {
  it("applies defaults", () => {
    const parsed = ListNotesQuerySchema.parse({});
    expect(parsed.limit).toBe(20);
    expect(parsed.offset).toBe(0);
  });

  it("coerces numeric strings", () => {
    const parsed = ListNotesQuerySchema.parse({ limit: "5", offset: "10" });
    expect(parsed.limit).toBe(5);
    expect(parsed.offset).toBe(10);
  });

  it("rejects a limit above 100", () => {
    expect(() => ListNotesQuerySchema.parse({ limit: "101" })).toThrow();
  });
});
