import {
  ExtensionManifestSchema,
  type ApiExtensionContext,
  type ExtensionManifest,
} from "@notespp/shared";
import type { FastifyInstance } from "fastify";
import type { NotesRepository } from "../db/repository.js";
import type { NotesApiExtension } from "./types.js";

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
