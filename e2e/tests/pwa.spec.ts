import { expect, test, type Page } from "@playwright/test";

/**
 * PWA / offline acceptance tests (Phase 5.4).
 *
 * These run against the production preview build (`vite preview` on dist),
 * where the service worker is registered: the dev server never registers it.
 *
 * Covered criteria:
 * - the service worker registers and takes control of the page;
 * - with the network offline, the app shell (precache) and cached notes
 *   (NetworkFirst runtime cache) still load, and the UI flags the data as
 *   stale via the stale-data banner;
 * - an offline edit attempt surfaces the inline save error;
 * - reconnecting refetches server-side changes and clears the stale signal.
 */

/** Wait until the SW is active and has claimed the page (clientsClaim). */
async function waitForServiceWorker(page: Page): Promise<void> {
  await page.waitForFunction(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.active !== null;
  });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

/** Wait until the NetworkFirst runtime cache actually holds the notes list —
 * the precondition for any "serves cached data offline" assertion. Without
 * this, going offline races the post-create refetch that populates the cache.
 * Deliberately a page.evaluate loop, not waitForFunction (which observed a
 * different caches view in practice). */
async function waitForCachedNotes(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt++) {
    const found = await page.evaluate(async () => {
      const cache = await caches.open("notes-api-cache");
      const keys = await cache.keys();
      return keys.some((request) => new URL(request.url).pathname === "/notes");
    });
    if (found) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("notes-api-cache never received the notes list");
}

/** Create a note via the UI so the list has content for the SW to cache. */
async function createNote(page: Page): Promise<void> {
  await page.getByRole("button", { name: /New note/ }).click();
  await expect(page.getByText("Untitled note").first()).toBeVisible();
  await waitForCachedNotes(page);
}

test.describe("production PWA (service worker)", () => {
  test("registers the service worker and takes control", async ({ page }) => {
    await page.goto("/");
    await waitForServiceWorker(page);
    expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(
      true,
    );
  });

  test("serves the app shell and cached notes offline, flagged as stale", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await waitForServiceWorker(page);
    await createNote(page);

    await context.setOffline(true);
    await page.reload();

    // App shell from the precache (level 1: a note title may also match):
    await expect(page.getByRole("heading", { level: 1, name: "Notes++" })).toBeVisible();
    // Notes from the NetworkFirst runtime cache:
    await expect(page.getByText("Untitled note").first()).toBeVisible();
    // The cached answer is flagged as stale while the page is open:
    await expect(page.getByTestId("stale-data-banner")).toBeVisible();
    // Registration itself still succeeds offline (existing registration):
    await expect(page.getByTestId("sw-registration-error")).toBeHidden();
  });

  test("surfaces the inline error when saving while offline", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await waitForServiceWorker(page);
    await createNote(page);
    await page.getByText("Untitled note").first().click();
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Body").fill("edited while offline");

    await context.setOffline(true);
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText(/Saving failed/)).toBeVisible();
    // The draft survives the failed save:
    await expect(page.getByLabel("Body")).toHaveValue("edited while offline");
  });

  test("recovers on reconnect: refetches server changes and clears the banner", async ({
    page,
    context,
    request,
  }) => {
    await page.goto("/");
    await waitForServiceWorker(page);
    await createNote(page);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId("stale-data-banner")).toBeVisible();

    // A note created server-side while the page is offline:
    const created = await request.post("/notes", {
      data: { title: "While you were away", body: "", tags: [] },
    });
    expect(created.ok()).toBeTruthy();

    // Reconnect: the app refetches without a manual reload, shows the new
    // note, and the fresh responses clear the stale-data banner.
    await context.setOffline(false);
    await expect(page.getByText("While you were away").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("stale-data-banner")).toBeHidden();
  });
});
