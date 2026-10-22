/**
 * App-wide connectivity state shared between the service-worker registration
 * (`main.tsx`), the API client (which detects NetworkFirst cache fallbacks),
 * and the status UI. A plain module store consumed via
 * `useSyncExternalStore`, so any part of the tree can observe it without
 * prop drilling.
 */

export type RegistrationState = "pending" | "ready" | "unsupported" | "failed";

export interface ConnectivitySnapshot {
  /** Service-worker registration outcome. "pending" until reported. */
  registration: RegistrationState;
  /**
   * True when an API response was served by the service worker's cache
   * (NetworkFirst fell back while the page was open) — the data on screen
   * may be stale until a fresh network response arrives.
   */
  stale: boolean;
}

let registration: RegistrationState = "pending";
let stale = false;
let snapshot: ConnectivitySnapshot = { registration, stale };
const listeners = new Set<() => void>();

function commit(): void {
  if (snapshot.registration === registration && snapshot.stale === stale) return;
  snapshot = { registration, stale };
  for (const listener of listeners) listener();
}

/** Record the service-worker registration outcome (called from `main.tsx`). */
export function reportRegistration(state: RegistrationState): void {
  registration = state;
  commit();
}

/** Flag that the latest API response came from the service-worker cache. */
export function markDataStale(): void {
  stale = true;
  commit();
}

/** Clear the stale signal — a fresh network response landed. */
export function markDataFresh(): void {
  stale = false;
  commit();
}

/** Subscribe to connectivity changes (useSyncExternalStore contract). */
export function subscribeConnectivity(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Current immutable snapshot; reference-stable between changes. */
export function getConnectivitySnapshot(): ConnectivitySnapshot {
  return snapshot;
}
