import { describe, expect, it } from "vitest";
import { loadApiExtensions } from "./load.js";

describe("loadApiExtensions", () => {
  it("loads community extensions first, with premium discovered when present", async () => {
    // Community extensions always come first; premium overlays (absent in
    // this edition, present in the premium repo) append after them. The
    // assertions hold in both editions.
    const extensions = await loadApiExtensions();
    const ids = extensions.map((e) => e.manifest.id);
    expect(ids).toContain("word-count");
    expect(ids[0]).toBe("word-count");
  });
});
