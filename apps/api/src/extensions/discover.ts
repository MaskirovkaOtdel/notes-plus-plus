import { ExtensionManifestSchema } from "@notespp/shared";
import type { NotesApiExtension } from "./types.js";

/**
 * Premium overlay discovery.
 *
 * The premium edition ships `@notespp/premium-api` as a workspace package.
 * In the community edition that package does not exist, so the import must
 * resolve to a graceful no-op — the community app never depends on premium.
 *
 * Rules:
 *  - module absent            -> null (normal in community; not an error)
 *  - module present, malformed -> throw (a broken premium install must not
 *    silently boot a half-wired server)
 */
export const PREMIUM_API_PACKAGE = "@notespp/premium-api";

export type ModuleImporter = (specifier: string) => Promise<unknown>;

const defaultImporter: ModuleImporter = (specifier) => import(specifier);

function isModuleNotFound(err: unknown, specifier: string): boolean {
  if (typeof err !== "object" || err === null) return false;
  const code = "code" in err ? (err as { code?: unknown }).code : undefined;
  // Node throws ERR_MODULE_NOT_FOUND; bundlers/resolvers may surface
  // plain messages without codes instead.
  if (code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND") return true;
  const message = err instanceof Error ? err.message : "";
  return (
    message.includes(specifier) &&
    /cannot find|cannot resolve|failed to resolve/i.test(message)
  );
}

function extractExtension(mod: unknown, specifier: string): NotesApiExtension {
  const candidate =
    typeof mod === "object" && mod !== null && "default" in mod
      ? (mod as { default: unknown }).default
      : mod;

  if (
    typeof candidate !== "object" ||
    candidate === null ||
    typeof (candidate as { register?: unknown }).register !== "function"
  ) {
    throw new Error(
      `Premium extension ${specifier} is malformed: expected a default export ` +
        `with { manifest, register() }`,
    );
  }

  const withManifest = candidate as { manifest: unknown };
  ExtensionManifestSchema.parse(withManifest.manifest);
  return candidate as NotesApiExtension;
}

/**
 * Attempts to load the premium API extension. Returns null when the package
 * is not installed (community edition), the extension when it is, and throws
 * when it exists but does not honour the contract.
 */
export async function discoverPremiumExtension(
  importer: ModuleImporter = defaultImporter,
): Promise<NotesApiExtension | null> {
  let mod: unknown;
  try {
    mod = await importer(PREMIUM_API_PACKAGE);
  } catch (err) {
    if (isModuleNotFound(err, PREMIUM_API_PACKAGE)) return null;
    throw err;
  }
  return extractExtension(mod, PREMIUM_API_PACKAGE);
}
