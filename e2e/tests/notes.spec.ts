import { expect, test } from "@playwright/test";

/**
 * Smoke test: the app boots, the API is reachable, and a note can be created
 * and then found via search. This is the minimal confidence check that the
 * whole stack (web + api + db) is wired correctly.
 */
test.describe("notes smoke", () => {
  test("app loads and reports healthy", async ({ page, request }) => {
    const health = await request.get("/health");
    expect(health.ok()).toBeTruthy();

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Notes++" })).toBeVisible();
  });

  test("creates a note and finds it via search", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /New note/ }).click();

    // The new note appears in the list.
    await expect(page.getByText("Untitled note").first()).toBeVisible();

    // Search narrows the list without erroring.
    await page.getByRole("searchbox").fill("Untitled");
    await expect(page.getByText("Untitled note").first()).toBeVisible();
  });
});
