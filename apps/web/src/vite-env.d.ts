/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Optional API base URL; empty (same origin) uses the Vite dev proxy. */
  readonly VITE_API_BASE?: string;
  /**
   * Optional bearer token. Set at build time to match the server's
   * `NOTESPP_API_TOKEN` when deploying beyond localhost.
   */
  readonly VITE_API_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
