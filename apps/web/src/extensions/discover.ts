import { ExtensionManifestSchema } from "@notespp/shared";
import type { NotesWebExtension } from "./types.js";

/**
 * Premium overlay discovery (web side).
 *
 * Mirrors apps/api/src/extensions/discover.ts: the premium edition ships
 * `@notespp/premium-web` as a workspace package that does not exist in the
 * community edition, so a missing module resolves to a graceful no-op. A
 * present-but-malformed module fails fast.
 */
export const PREMIUM_WEB_PACKAGE = "@notespp/premium-web";

export type ModuleImporter = (specifier: string) => Promise<unknown>;

const defaultImporter: ModuleImporter = (specifier) =>
  // @vite-ignore keeps the bundler from statically resolving a package
  // that intentionally may not exist.
  import(/* @vite-ignore */ specifier);

function isModuleNotFound(err: unknown, specifier: string): boolean {
  if (typeof err !== "object" || err === null) return false;
  const code = "code" in err ? (err as { code?: unknown }).code : undefined;
  if (code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND") return true;
  // Bundler resolvers (Vite/esbuild) surface plain errors without codes.
  const message = err instanceof Error ? err.message : "";
  return (
    message.includes(specifier) &&
    /cannot find|cannot resolve|failed to resolve/i.test(message)
  );
}

function extractExtension(mod: unknown, specifier: string): NotesWebExtension {
  const candidate =
    typeof mod === "object" && mod !== null && "default" in mod
      ? (mod as { default: unknown }).default
      : mod;

  if (
    typeof candidate !== "object" ||
    candidate === null ||
    typeof (candidate as { contributions?: unknown }).contributions !== "object" ||
    (candidate as { contributions: unknown }).contributions === null
  ) {
    throw new Error(
      `Premium web extension ${specifier} is malformed: expected a default ` +
        `export with { manifest, contributions }`,
    );
  }

  const withManifest = candidate as { manifest: unknown };
  ExtensionManifestSchema.parse(withManifest.manifest);
  return candidate as NotesWebExtension;
}

/**
 * Attempts to load the premium web extension. Returns null when the package
 * is not installed (community edition), the extension when it is, and throws
 * when it exists but does not honour the contract.
 */
export async function discoverPremiumWebExtension(
  importer: ModuleImporter = defaultImporter,
): Promise<NotesWebExtension | null> {
  let mod: unknown;
  try {
    mod = await importer(PREMIUM_WEB_PACKAGE);
  } catch (err) {
    if (isModuleNotFound(err, PREMIUM_WEB_PACKAGE)) return null;
    throw err;
  }
  return extractExtension(mod, PREMIUM_WEB_PACKAGE);
}
