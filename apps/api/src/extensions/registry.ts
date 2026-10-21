import {
  ExtensionManifestSchema,
  type ApiExtensionContext,
  type ExtensionManifest,
} from "@notespp/shared";
import type { FastifyInstance } from "fastify";
import type { NotesRepository } from "../db/repository.js";
import type { NotesApiExtension } from "./types.js";

/** The method surface a composed repository must preserve. */
const REPO_METHODS = ["list", "get", "create", "update", "remove"] as const;

/**
 * Composes the write-path seam: applies every extension's optional
 * `decorateRepo` in array order, so later decorators wrap earlier ones.
 *
 * The returned repository is what note routes and every extension context
 * receive — a single consistent view of storage. Fail-fast: an invalid
 * manifest, a throwing decorator, a decorator that returns nothing, or one
 * that drops a repository method aborts startup with the offending
 * extension id in the error.
 */
export function composeRepository(
  extensions: readonly NotesApiExtension[],
  repo: NotesRepository,
): NotesRepository {
  return extensions.reduce<NotesRepository>((current, extension) => {
    if (typeof extension.decorateRepo !== "function") return current;

    const manifest = ExtensionManifestSchema.parse(extension.manifest);
    try {
      const decorated = extension.decorateRepo(current);
      if (
        decorated === undefined ||
        decorated === null ||
        typeof decorated !== "object"
      ) {
        throw new Error("decorateRepo() did not return a repository");
      }
      // Repositories are classes: spreading an instance copies only its own
      // properties and silently drops the prototype methods. A decorator
      // that loses methods must fail here, not as broken routes later.
      const surface = decorated as unknown as Record<string, unknown>;
      const missing = REPO_METHODS.filter(
        (method) => typeof surface[method] !== "function",
      );
      if (missing.length > 0) {
        throw new Error(
          `decorateRepo() dropped repository method(s): ${missing.join(", ")} ` +
            `— delegate every method explicitly instead of spreading the ` +
            `repository instance`,
        );
      }
      return decorated;
    } catch (err) {
      throw new Error(
        `Extension "${manifest.id}" failed to decorate the repository: ${
          err instanceof Error ? err.message : String(err)
        }`,
        { cause: err },
      );
    }
  }, repo);
}

/**
 * Validates and registers extensions on the app instance.
 *
 * Guarantees, in array order:
 *  - every manifest satisfies ExtensionManifestSchema (fail-fast otherwise)
 *  - extension ids are unique (fail-fast otherwise)
 *  - a throwing `register` aborts startup with the extension id in the error
 *
 * Returns the registered manifests so callers can expose them (e.g. the
 * GET /extensions listing).
 */
export async function registerExtensions(
  app: FastifyInstance,
  ctx: ApiExtensionContext<NotesRepository>,
  extensions: readonly NotesApiExtension[],
): Promise<ExtensionManifest[]> {
  const seen = new Set<string>();
  const registered: ExtensionManifest[] = [];

  for (const extension of extensions) {
    const manifest = ExtensionManifestSchema.parse(extension.manifest);

    if (seen.has(manifest.id)) {
      throw new Error(
        `Duplicate extension id "${manifest.id}" — extension ids must be unique`,
      );
    }
    if (typeof extension.register !== "function") {
      throw new Error(`Extension "${manifest.id}" has no register() function`);
    }

    try {
      await extension.register(app, ctx);
    } catch (err) {
      throw new Error(
        `Extension "${manifest.id}" failed to register: ${
          err instanceof Error ? err.message : String(err)
        }`,
        { cause: err },
      );
    }

    seen.add(manifest.id);
    registered.push(manifest);
  }

  return registered;
}
