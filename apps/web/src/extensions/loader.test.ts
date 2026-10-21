import { afterEach, describe, expect, it } from "vitest";
import { loadWebExtensions, resetWebExtensionCache } from "./loader.js";

afterEach(() => {
  resetWebExtensionCache();
});

describe("loadWebExtensions", () => {
  it("loads community extensions with premium absent (standalone guarantee)", async () => {
    const extensions = await loadWebExtensions();
    expect(extensions.map((e) => e.manifest.id)).toEqual(["word-count"]);
  });

  it("caches the loaded list", async () => {
    const first = await loadWebExtensions();
    const second = await loadWebExtensions();
    expect(second).toBe(first);
  });

  it("re-loads after a cache reset", async () => {
    const first = await loadWebExtensions();
    resetWebExtensionCache();
    const second = await loadWebExtensions();
    expect(second).not.toBe(first);
  });
});
