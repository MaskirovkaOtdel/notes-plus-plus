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

/**
 * Extension seam: the registry endpoint lists community extensions, the
 * stats route serves them over HTTP, and the toolbar chip renders in the
 * note detail view. This is the end-to-end proof of Phase 2.
 */
test.describe("extension seam", () => {
  test("lists the word-count extension and serves its stats route", async ({
    request,
  }) => {
    const ext = await request.get("/extensions");
    expect(ext.ok()).toBeTruthy();
    const { items } = (await ext.json()) as { items: { id: string }[] };
    expect(items.map((i) => i.id)).toContain("word-count");

    const created = await request.post("/notes", {
      data: { title: "Stats note", body: "alpha beta", tags: [] },
    });
    expect(created.ok()).toBeTruthy();
    const { id } = (await created.json()) as { id: string };

    const stats = await request.get(`/notes/${id}/stats`);
    expect(stats.ok()).toBeTruthy();
    expect(await stats.json()).toEqual({
      words: 2,
      chars: 10,
      readingTimeMinutes: 0,
    });
  });

  test("renders the word-count chip in the note detail toolbar", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /New note/ }).click();
    await expect(page.getByText("Untitled note").first()).toBeVisible();

    await page.getByText("Untitled note").first().click();

    // The detail view renders with the extension-contributed toolbar chip.
    await expect(page.getByRole("button", { name: /Back/ })).toBeVisible();
    await expect(page.getByTestId("word-count-chip")).toHaveText(/0 words/);
  });
});
