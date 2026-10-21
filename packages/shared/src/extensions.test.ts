import { describe, expect, it } from "vitest";
import { API_ROUTES } from "./schemas.js";
import { ExtensionListSchema, ExtensionManifestSchema } from "./extensions.js";
import type { ApiExtension, WebExtension } from "./extensions.js";

describe("API_ROUTES", () => {
  it("builds note, stats, and extension routes with escaping", () => {
    expect(API_ROUTES.note("x y")).toBe("/notes/x%20y");
    expect(API_ROUTES.noteStats("x y")).toBe("/notes/x%20y/stats");
    expect(API_ROUTES.extensions).toBe("/extensions");
  });
});

describe("ExtensionManifestSchema", () => {
  it("accepts a well-formed manifest", () => {
    const parsed = ExtensionManifestSchema.parse({
      id: "word-count",
      name: "Word Count",
      version: "1.0.0",
    });
    expect(parsed.id).toBe("word-count");
  });

  it("rejects non-kebab-case ids", () => {
    expect(() =>
      ExtensionManifestSchema.parse({ id: "WordCount", name: "x", version: "1" }),
    ).toThrow();
    expect(() =>
      ExtensionManifestSchema.parse({ id: "1-leading-digit", name: "x", version: "1" }),
    ).toThrow();
    expect(() =>
      ExtensionManifestSchema.parse({ id: "has_underscore", name: "x", version: "1" }),
    ).toThrow();
  });

  it("rejects missing or empty fields", () => {
    expect(() =>
      ExtensionManifestSchema.parse({ id: "ok", name: "", version: "1" }),
    ).toThrow();
    expect(() => ExtensionManifestSchema.parse({ id: "ok", name: "n" })).toThrow();
    expect(() => ExtensionManifestSchema.parse({ name: "n", version: "1" })).toThrow();
  });
});

describe("ExtensionListSchema", () => {
  it("validates a list of manifests", () => {
    const list = ExtensionListSchema.parse({
      items: [{ id: "a", name: "A", version: "1.0.0" }],
    });
    expect(list.items).toHaveLength(1);
  });
});

describe("contract shape (compile-time)", () => {
  it("ApiExtension and WebExtension are structural, generic contracts", () => {
    // These only need to typecheck; runtime assertion keeps the test honest.
    interface FakeRepo {
      get(id: string): Promise<string | null>;
    }
    const apiExt: ApiExtension<FakeRepo, { get: unknown }> = {
      manifest: { id: "api-fake", name: "API fake", version: "1.0.0" },
      register: (app, ctx) => {
        expect(typeof app.get).toBe("function");
        expect(typeof ctx.repo.get).toBe("function");
        expect(ctx.version).toBe("test");
      },
    };
    apiExt.register(
      { get: () => null },
      { repo: { get: async () => null }, version: "test" },
    );

    const webExt: WebExtension<{ id: string }, string> = {
      manifest: { id: "web-fake", name: "Web fake", version: "1.0.0" },
      contributions: {
        noteToolbar: ({ note }) => `chip:${note.id}`,
      },
    };
    expect(webExt.contributions.noteToolbar?.({ note: { id: "n1" } })).toBe("chip:n1");
  });
});
