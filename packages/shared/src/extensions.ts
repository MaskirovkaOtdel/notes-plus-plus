import { z } from "zod";

/**
 * Extension contracts.
 *
 * These types are deliberately generic over their host types (the Fastify
 * instance for API extensions, the rendered element type for web extensions)
 * so that `@notespp/shared` stays dependency-light: host applications alias
 * them with their concrete types, extensions stay portable.
 *
 * See docs/EXTENSIONS.md for the authoring guide.
 */

/** Identity every extension carries. Validated at registration time. */
export const ExtensionManifestSchema = z.object({
  /** Kebab-case unique id, e.g. "word-count". */
  id: z.string().regex(/^[a-z][a-z0-9-]*$/, "id must be kebab-case"),
  /** Human-readable name shown in listings. */
  name: z.string().min(1).max(100),
  /** Extension version (semver-ish; not parsed, only displayed). */
  version: z.string().min(1).max(32),
});

export type ExtensionManifest = z.infer<typeof ExtensionManifestSchema>;

/** Context handed to an API extension at registration time. */
export interface ApiExtensionContext<TRepo> {
  repo: TRepo;
  version: string;
}

/**
 * A server-side extension. `register` runs once at startup, in array order,
 * on the root Fastify instance. Registration is fail-fast: a throwing or
 * invalid extension aborts startup rather than yielding a half-wired server.
 */
export interface ApiExtension<TRepo = unknown, TApp = unknown> {
  manifest: ExtensionManifest;
  /**
   * Optional write-path seam: wrap or replace the repository before any
   * routes are wired. Decorators compose in extension order (each sees the
   * previously decorated repository), and every consumer — note routes and
   * extension contexts alike — receives the final decorated instance.
   *
   * Typical uses: audit logging, metrics, validation, or — as premium's
   * version history does — capturing write snapshots. Decoration must be
   * synchronous and must return a repository; anything else aborts startup.
   */
  decorateRepo?: (repo: TRepo) => TRepo;
  register(app: TApp, ctx: ApiExtensionContext<TRepo>): void | Promise<void>;
}

/** Props handed to a note toolbar contribution. */
export interface NoteToolbarProps<TNote> {
  note: TNote;
}

/**
 * A client-side extension. Contributions are plain component references;
 * an absent slot key means the extension contributes nothing there.
 */
export interface WebExtension<TNote = unknown, TElement = unknown> {
  manifest: ExtensionManifest;
  contributions: {
    noteToolbar?: (props: NoteToolbarProps<TNote>) => TElement;
  };
}

/** Shape of `GET /extensions`. */
export const ExtensionListSchema = z.object({
  items: z.array(ExtensionManifestSchema),
});

export type ExtensionList = z.infer<typeof ExtensionListSchema>;
