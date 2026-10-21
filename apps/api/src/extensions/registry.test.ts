import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import type { NotesRepository } from "../db/repository.js";
import { composeRepository, registerExtensions } from "./registry.js";
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

describe("composeRepository", () => {
  const base = ctx.repo as unknown as NotesRepository;

  const decorating = (
    id: string,
    wrap: (inner: NotesRepository) => NotesRepository,
  ): NotesApiExtension => ({
    manifest: { id, name: id, version: "1.0.0" },
    decorateRepo: wrap,
    register: () => undefined,
  });

  it("returns the base repository when no extension decorates", () => {
    expect(composeRepository([], base)).toBe(base);
    expect(
      composeRepository(
        [
          {
            manifest: { id: "plain", name: "plain", version: "1.0.0" },
            register: () => undefined,
          },
        ],
        base,
      ),
    ).toBe(base);
  });

  it("applies a decorator, and the result differs from the base", () => {
    const composed = composeRepository([decorating("audit", (i) => ({ ...i }))], base);
    expect(composed).not.toBe(base);
    expect(composed.create).toBe(base.create);
  });

  it("composes decorators in array order (later wraps earlier)", () => {
    const order: string[] = [];
    const composed = composeRepository(
      [
        decorating("first", (inner) => {
          order.push("first");
          return { ...inner };
        }),
        decorating("second", (inner) => {
          order.push("second");
          // "inner" here is the repository the first decorator produced.
          expect(inner).not.toBe(base);
          return { ...inner };
        }),
      ],
      base,
    );
    expect(order).toEqual(["first", "second"]);
    expect(composed).not.toBe(base);
  });

  it("lets a decorator intercept writes while reads pass through", async () => {
    const snapshots: unknown[] = [];
    const historyAware = decorating("history", (inner) => ({
      ...inner,
      update: async (id: string, input: Parameters<typeof inner.update>[1]) => {
        const before = await inner.get(id);
        snapshots.push(before);
        return inner.update(id, input);
      },
    }));
    const composed = composeRepository([historyAware], base);
    await composed.update("any", { title: "t" });
    expect(snapshots).toHaveLength(1);
  });

  it("fails fast when a decorator throws, naming the extension", () => {
    const broken = decorating("boom", () => {
      throw new Error("kaput");
    });
    expect(() => composeRepository([broken], base)).toThrow(
      /Extension "boom" failed to decorate the repository: kaput/,
    );
  });

  it("fails fast when a decorator returns nothing", () => {
    const empty = {
      manifest: { id: "empty", name: "empty", version: "1.0.0" },
      decorateRepo: () => undefined,
      register: () => undefined,
    } as unknown as NotesApiExtension;
    expect(() => composeRepository([empty], base)).toThrow(
      /Extension "empty" failed to decorate the repository: decorateRepo\(\) did not return a repository/,
    );
  });

  it("fails fast on an invalid manifest before decorating", () => {
    const bad = {
      manifest: { id: "Bad Id!", name: "x", version: "1" },
      decorateRepo: (r: unknown) => r,
      register: () => undefined,
    } as unknown as NotesApiExtension;
    expect(() => composeRepository([bad], base)).toThrow();
  });
});
