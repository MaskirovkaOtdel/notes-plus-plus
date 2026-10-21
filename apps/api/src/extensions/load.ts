import { wordCountApiExtension } from "@notespp/ext-word-count/api";
import { discoverPremiumExtension } from "./discover.js";
import type { NotesApiExtension } from "./types.js";

/**
 * Composition root for API extensions. Static community extensions first,
 * the premium overlay last when present (graceful no-op in community).
 *
 * Called by server.ts; buildApp stays pure and takes an explicit list.
 */
export async function loadApiExtensions(): Promise<NotesApiExtension[]> {
  const statics: NotesApiExtension[] = [wordCountApiExtension];
  const premium = await discoverPremiumExtension();
  return premium ? [...statics, premium] : statics;
}
