import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { registerExtensions } from "./registry.js";
import type { NotesApiExtension } from "./types.js";

function makeApp() {
  return Fastify();
}

const ctx = {
  repo: {
    list: async () => ({ items: [], total: 0, limit: 20, offset: 0 }),
    get: async () => null,
    create: async () => {
      throw new Error("unused");
    },
    update: async () => null,
    remove: async () => false,
  },
  version: "test",
};

const stubExtension = (id: string): NotesApiExtension => ({
  manifest: { id, name: id, version: "1.0.0" },
  register: () => undefined,
});

describe("registerExtensions", () => {
  it("registers nothing for an empty list", async () => {
    const app = makeApp();
    const registered = await registerExtensions(app, ctx, []);
    expect(registered).toEqual([]);
    await app.close();
  });

  it("returns manifests in registration order", async () => {
    const app = makeApp();
    const registered = await registerExtensions(app, ctx, [
      stubExtension("alpha"),
      stubExtension("beta"),
    ]);
    expect(registered.map((m) => m.id)).toEqual(["alpha", "beta"]);
    await app.close();
  });

  it("lets an extension register a route that the app serves", async () => {
    const app = makeApp();
    const ext: NotesApiExtension = {
      manifest: { id: "route-ext", name: "Route ext", version: "1.0.0" },
      register: (instance) => {
        instance.get("/ext/ping", async () => ({ pong: true }));
      },
    };
    await registerExtensions(app, ctx, [ext]);
    await app.ready();
    const res = await app.inject({ method: "GET", url: "/ext/ping" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ pong: true });
    await app.close();
  });

  it("passes the injected context to the extension", async () => {
    const app = makeApp();
    let seenVersion = "";
    const ext: NotesApiExtension = {
      manifest: { id: "ctx-ext", name: "Ctx ext", version: "1.0.0" },
      register: (_instance, extensionCtx) => {
        seenVersion = extensionCtx.version;
      },
    };
    await registerExtensions(app, ctx, [ext]);
    expect(seenVersion).toBe("test");
    await app.close();
  });

  it("fails fast on an invalid manifest", async () => {
    const app = makeApp();
    const bad = {
      ...stubExtension("ok"),
      manifest: { id: "Bad Id!", name: "x", version: "1" },
    };
    await expect(registerExtensions(app, ctx, [bad])).rejects.toThrow(
      /kebab-case|invalid/i,
    );
    await app.close();
  });

  it("fails fast on duplicate ids", async () => {
    const app = makeApp();
    await expect(
      registerExtensions(app, ctx, [stubExtension("dupe"), stubExtension("dupe")]),
    ).rejects.toThrow(/Duplicate extension id "dupe"/);
    await app.close();
  });

  it("fails fast when register throws, naming the extension", async () => {
    const app = makeApp();
    const broken: NotesApiExtension = {
      manifest: { id: "broken", name: "Broken", version: "1.0.0" },
      register: () => {
        throw new Error("boom");
      },
    };
    await expect(registerExtensions(app, ctx, [broken])).rejects.toThrow(
      /Extension "broken" failed to register: boom/,
    );
    await app.close();
  });

  it("fails fast when register is not a function", async () => {
    const app = makeApp();
    const noRegister = {
      manifest: { id: "no-fn", name: "No fn", version: "1.0.0" },
    } as unknown as NotesApiExtension;
    await expect(registerExtensions(app, ctx, [noRegister])).rejects.toThrow(
      /has no register\(\) function/,
    );
    await app.close();
  });
});
