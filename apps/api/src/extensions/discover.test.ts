import { describe, expect, it } from "vitest";
import {
  discoverPremiumExtension,
  PREMIUM_API_PACKAGE,
  type ModuleImporter,
} from "./discover.js";

const validModule = {
  default: {
    manifest: { id: "premium", name: "Premium", version: "1.0.0" },
    register: () => undefined,
  },
};

const notFound: ModuleImporter = () =>
  Promise.reject(
    Object.assign(new Error(`Cannot find package '${PREMIUM_API_PACKAGE}'`), {
      code: "ERR_MODULE_NOT_FOUND",
    }),
  );

describe("discoverPremiumExtension", () => {
  it("returns null when the package is absent (community edition)", async () => {
    await expect(discoverPremiumExtension(notFound)).resolves.toBeNull();
  });

  it("treats a bare 'Cannot find module' message as absent", async () => {
    const importer: ModuleImporter = () =>
      Promise.reject(new Error(`Cannot find package '${PREMIUM_API_PACKAGE}' from src`));
    await expect(discoverPremiumExtension(importer)).resolves.toBeNull();
  });

  it("returns the extension from a default export", async () => {
    const importer: ModuleImporter = () => Promise.resolve(validModule);
    const ext = await discoverPremiumExtension(importer);
    expect(ext?.manifest.id).toBe("premium");
  });

  it("accepts a module that is the extension itself (no default)", async () => {
    const importer: ModuleImporter = () => Promise.resolve(validModule.default);
    const ext = await discoverPremiumExtension(importer);
    expect(ext?.manifest.id).toBe("premium");
  });

  it("throws when the package exists but has no register function", async () => {
    const importer: ModuleImporter = () =>
      Promise.resolve({ default: { manifest: validModule.default.manifest } });
    await expect(discoverPremiumExtension(importer)).rejects.toThrow(/malformed/);
  });

  it("throws when the manifest is invalid", async () => {
    const importer: ModuleImporter = () =>
      Promise.resolve({
        default: {
          manifest: { id: "Not Kebab", name: "x", version: "1" },
          register: () => undefined,
        },
      });
    await expect(discoverPremiumExtension(importer)).rejects.toThrow();
  });

  it("rethrows unrelated import errors", async () => {
    const importer: ModuleImporter = () => Promise.reject(new Error("disk on fire"));
    await expect(discoverPremiumExtension(importer)).rejects.toThrow(/disk on fire/);
  });
});
