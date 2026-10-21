import { describe, expect, it } from "vitest";
import {
  discoverPremiumWebExtension,
  PREMIUM_WEB_PACKAGE,
  type ModuleImporter,
} from "./discover.js";

const validModule = {
  default: {
    manifest: { id: "premium-web", name: "Premium web", version: "1.0.0" },
    contributions: { noteToolbar: () => null },
  },
};

const notFound: ModuleImporter = () =>
  Promise.reject(
    Object.assign(new Error(`Cannot find package '${PREMIUM_WEB_PACKAGE}'`), {
      code: "ERR_MODULE_NOT_FOUND",
    }),
  );

describe("discoverPremiumWebExtension", () => {
  it("returns null when the package is absent (community edition)", async () => {
    await expect(discoverPremiumWebExtension(notFound)).resolves.toBeNull();
  });

  it("treats a bundler-style resolution failure as absent", async () => {
    const importer: ModuleImporter = () =>
      Promise.reject(
        new Error(
          `Failed to resolve import "${PREMIUM_WEB_PACKAGE}" from "src/extensions/loader.ts"`,
        ),
      );
    await expect(discoverPremiumWebExtension(importer)).resolves.toBeNull();
  });

  it("returns the extension from a default export", async () => {
    const importer: ModuleImporter = () => Promise.resolve(validModule);
    const ext = await discoverPremiumWebExtension(importer);
    expect(ext?.manifest.id).toBe("premium-web");
  });

  it("throws when contributions are missing", async () => {
    const importer: ModuleImporter = () =>
      Promise.resolve({ default: { manifest: validModule.default.manifest } });
    await expect(discoverPremiumWebExtension(importer)).rejects.toThrow(/malformed/);
  });

  it("throws when the manifest is invalid", async () => {
    const importer: ModuleImporter = () =>
      Promise.resolve({
        default: {
          manifest: { id: "Bad!", name: "x", version: "1" },
          contributions: {},
        },
      });
    await expect(discoverPremiumWebExtension(importer)).rejects.toThrow();
  });

  it("rethrows unrelated import errors", async () => {
    const importer: ModuleImporter = () => Promise.reject(new Error("network sad"));
    await expect(discoverPremiumWebExtension(importer)).rejects.toThrow(/network sad/);
  });
});
