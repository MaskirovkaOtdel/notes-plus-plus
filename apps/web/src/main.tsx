import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { reportRegistration } from "./lib/connectivity.js";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
      // Always hit the network layer: the service worker is the connectivity
      // arbiter (NetworkFirst serves cached data offline), so react-query's
      // offline pausing would hide both the stale-data signal and honest
      // error states behind an endless spinner.
      networkMode: "always",
    },
    // Offline saves must attempt and fail fast with the inline error while
    // the draft stays intact — never queue silently.
    mutations: { networkMode: "always" },
  },
});

const container = document.getElementById("root");
if (!container) throw new Error("Root element #root not found");

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);

// Register the service worker for offline support (production only).
// Failures are handled and surfaced (status banner) instead of failing
// silently: an offline-capable app must say so when offline support is gone.
if (import.meta.env.PROD) {
  if ("serviceWorker" in navigator) {
    void import("virtual:pwa-register")
      .then(({ registerSW }) => {
        registerSW({
          immediate: true,
          onRegisteredSW: () => reportRegistration("ready"),
          onRegisterError: (error: unknown) => {
            console.error("service worker registration failed", error);
            reportRegistration("failed");
          },
        });
      })
      .catch((error: unknown) => {
        console.error("service worker registration module failed", error);
        reportRegistration("failed");
      });
  } else {
    reportRegistration("unsupported");
  }
}
