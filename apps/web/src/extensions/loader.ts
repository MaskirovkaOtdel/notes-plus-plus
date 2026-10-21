import { wordCountWebExtension } from "@notespp/ext-word-count/web";
import { discoverPremiumWebExtension } from "./discover.js";
import type { NotesWebExtension } from "./types.js";

/**
 * Composition root for web extensions. Static community extensions first,
 * the premium overlay last when present. Results are cached — extensions
 * are app-scoped singletons.
 */
let cache: NotesWebExtension[] | null = null;

export async function loadWebExtensions(): Promise<NotesWebExtension[]> {
  if (cache) return cache;
  const statics: NotesWebExtension[] = [wordCountWebExtension];
  const premium = await discoverPremiumWebExtension();
  cache = premium ? [...statics, premium] : statics;
  return cache;
}

/** Test hook: clears the module-level cache. */
export function resetWebExtensionCache(): void {
  cache = null;
}
