import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";

/** API proxy: dev server and preview server route API calls to Fastify. */
const apiProxy = {
  "/health": "http://localhost:4000",
  "/notes": "http://localhost:4000",
  "/extensions": "http://localhost:4000",
};

/**
 * Workbox plugin serialized into the generated service worker (functions in
 * the `workbox` config are stringified into `sw.js`, so this must be
 * self-contained and touch only service-worker globals). It stamps every
 * response the NetworkFirst runtime cache produces with `x-from-cache: 1`,
 * which is how the page distinguishes stale (cached) API data from fresh
 * network responses.
 */
const stampCachedResponses = {
  // An arrow property, not a method shorthand: workbox-build stringifies
  // plugin functions via .toString(), and a method would serialize to
  // `async name(){...}` — invalid when re-wrapped as `{ key: ... }`.
  cachedResponseWillBeUsed: async ({
    cachedResponse,
  }: {
    cachedResponse?: Response;
  }): Promise<Response | undefined> => {
    if (!cachedResponse) return cachedResponse;
    const headers = new Headers(cachedResponse.headers);
    headers.set("x-from-cache", "1");
    return new Response(await cachedResponse.arrayBuffer(), {
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
      headers,
    });
  },
};

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "robots.txt"],
      manifest: {
        name: "Notes++",
        short_name: "Notes++",
        description: "Fast, offline-capable notes",
        theme_color: "#4f46e5",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            // Cache API reads so notes are readable offline.
            urlPattern: ({ url, request }) =>
              url.pathname.startsWith("/notes") && request.method === "GET",
            handler: "NetworkFirst",
            options: {
              cacheName: "notes-api-cache",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [200] },
              plugins: [stampCachedResponses],
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: apiProxy,
  },
  preview: {
    port: 4173,
    proxy: apiProxy,
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test-setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/main.tsx",
        "src/test-setup.ts",
        "src/vite-env.d.ts",
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
    },
  },
});
