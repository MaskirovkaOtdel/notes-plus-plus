import { useSyncExternalStore } from "react";
import { getConnectivitySnapshot, subscribeConnectivity } from "../lib/connectivity.js";

/**
 * Transient connectivity signals, rendered under the header:
 *
 * - Service-worker registration failed (or is unsupported): offline support
 *   is unavailable, so the app needs a live connection — surfaced instead of
 *   failing silently.
 * - Stale data: the service worker's NetworkFirst cache answered while the
 *   page was open. Cleared automatically once a fresh network response
 *   lands (e.g. after reconnecting).
 */
export function StatusBanner() {
  const { registration, stale } = useSyncExternalStore(
    subscribeConnectivity,
    getConnectivitySnapshot,
  );

  const registrationBroken = registration === "failed" || registration === "unsupported";

  return (
    <div className="mt-4 space-y-2">
      {registrationBroken ? (
        <div
          role="alert"
          data-testid="sw-registration-error"
          className="rounded-md bg-rose-50 p-3 text-sm text-rose-700"
        >
          {registration === "failed"
            ? "Offline support failed to enable — the app needs an internet connection."
            : "This browser can't enable offline support — the app needs an internet connection."}
        </div>
      ) : null}
      {stale ? (
        <div
          role="status"
          data-testid="stale-data-banner"
          className="rounded-md bg-amber-50 p-3 text-sm text-amber-800"
        >
          Showing saved data — reconnecting…
        </div>
      ) : null}
    </div>
  );
}
