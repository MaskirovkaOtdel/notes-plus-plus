import { describe, expect, it } from "vitest";
import { loadApiExtensions } from "./load.js";

describe("loadApiExtensions", () => {
  it("loads community extensions with premium absent (standalone guarantee)", async () => {
    const extensions = await loadApiExtensions();
    expect(extensions.map((e) => e.manifest.id)).toEqual(["word-count"]);
  });
});
