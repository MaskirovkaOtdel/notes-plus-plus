import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { StatusBanner } from "./StatusBanner.js";
import { markDataFresh, markDataStale, reportRegistration } from "../lib/connectivity.js";

describe("StatusBanner", () => {
  beforeEach(() => {
    reportRegistration("pending");
    markDataFresh();
  });

  it("renders nothing while registration is fine and data is fresh", () => {
    render(<StatusBanner />);
    expect(screen.queryByTestId("sw-registration-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("stale-data-banner")).not.toBeInTheDocument();
  });

  it("surfaces a failed service-worker registration", () => {
    render(<StatusBanner />);
    act(() => reportRegistration("failed"));
    expect(screen.getByTestId("sw-registration-error")).toBeInTheDocument();
    expect(screen.getByText(/Offline support failed to enable/)).toBeInTheDocument();
  });

  it("surfaces browsers without service-worker support", () => {
    render(<StatusBanner />);
    act(() => reportRegistration("unsupported"));
    expect(screen.getByTestId("sw-registration-error")).toBeInTheDocument();
    expect(screen.getByText(/can't enable offline support/)).toBeInTheDocument();
  });

  it("hides the registration banner again once registration is ready", () => {
    render(<StatusBanner />);
    act(() => reportRegistration("failed"));
    expect(screen.getByTestId("sw-registration-error")).toBeInTheDocument();

    act(() => reportRegistration("ready"));
    expect(screen.queryByTestId("sw-registration-error")).not.toBeInTheDocument();
  });

  it("shows the stale-data signal until fresh data lands", () => {
    render(<StatusBanner />);
    act(() => {
      reportRegistration("ready");
      markDataStale();
    });
    expect(screen.getByTestId("stale-data-banner")).toBeInTheDocument();
    expect(screen.getByText(/Showing saved data/)).toBeInTheDocument();

    act(() => markDataFresh());
    expect(screen.queryByTestId("stale-data-banner")).not.toBeInTheDocument();
  });
});
