import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getConnectivitySnapshot,
  markDataFresh,
  markDataStale,
  reportRegistration,
  subscribeConnectivity,
} from "./connectivity.js";

describe("connectivity store", () => {
  beforeEach(() => {
    reportRegistration("pending");
    markDataFresh();
  });

  it("starts pending and fresh", () => {
    expect(getConnectivitySnapshot()).toEqual({
      registration: "pending",
      stale: false,
    });
  });

  it("reports registration outcomes to subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeConnectivity(listener);

    reportRegistration("failed");
    expect(getConnectivitySnapshot().registration).toBe("failed");
    expect(listener).toHaveBeenCalledTimes(1);

    reportRegistration("ready");
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    reportRegistration("unsupported");
    expect(listener).toHaveBeenCalledTimes(2);
    expect(getConnectivitySnapshot().registration).toBe("unsupported");
  });

  it("marks data stale and notifies only on an actual change", () => {
    const listener = vi.fn();
    subscribeConnectivity(listener);

    markDataStale();
    expect(getConnectivitySnapshot().stale).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    // Idempotent: repeated stale marks must not thrash the UI.
    markDataStale();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("clears the stale signal when fresh data lands", () => {
    markDataStale();
    const listener = vi.fn();
    subscribeConnectivity(listener);

    markDataFresh();
    expect(getConnectivitySnapshot().stale).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);

    markDataFresh();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("keeps the snapshot reference stable between changes", () => {
    const before = getConnectivitySnapshot();
    expect(getConnectivitySnapshot()).toBe(before);

    markDataStale();
    expect(getConnectivitySnapshot()).not.toBe(before);
    expect(getConnectivitySnapshot()).toBe(getConnectivitySnapshot());
  });
});
