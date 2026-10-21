import { afterEach, describe, expect, it } from "vitest";
import { loadWebExtensions, resetWebExtensionCache } from "./loader.js";

afterEach(() => {
  resetWebExtensionCache();
});

describe("loadWebExtensions", () => {
  it("loads community extensions first, with premium discovered when present", async () => {
    // Community extensions always come first; premium overlays (absent in
    // this edition, present in the premium repo) append after them. The
    // assertions hold in both editions.
    const extensions = await loadWebExtensions();
    const ids = extensions.map((e) => e.manifest.id);
    expect(ids).toContain("word-count");
    expect(ids[0]).toBe("word-count");
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
