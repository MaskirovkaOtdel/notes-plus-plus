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

/**
 * Lifecycle: the app can modify its own notes (Phase 3). Full journey —
 * edit a note, verify the change in the list, delete it with the inline
 * confirmation, and confirm it is gone. The delete confirmation is inline
 * (no window.confirm), so no dialog handling is needed here.
 */
test.describe("note lifecycle", () => {
  test("edits a note, verifies it in the list, then deletes it", async ({
    page,
    request,
  }) => {
    // Seed a note directly through the API for determinism.
    const created = await request.post("/notes", {
      data: { title: "Lifecycle note", body: "before edit", tags: ["seed"] },
    });
    expect(created.ok()).toBeTruthy();

    await page.goto("/");
    await page.getByText("Lifecycle note").first().click();

    // Edit the body and save.
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Body").fill("after edit in e2e");
    await page.getByRole("button", { name: "Save" }).click();

    // Detail view shows the persisted body.
    await expect(page.getByText("after edit in e2e")).toBeVisible();

    // Back to the list: the change is reflected there too.
    await page.getByRole("button", { name: /Back/ }).click();
    await expect(page.getByText("after edit in e2e")).toBeVisible();

    // Reopen and delete via the two-step inline confirmation.
    await page.getByText("Lifecycle note").first().click();
    await page.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Yes, delete" }).click();

    // Back on the list, and the note is gone.
    await expect(page.getByText("Lifecycle note")).toHaveCount(0);
  });
});

/**
 * Markdown reading experience (Phase 4): the detail view renders note bodies
 * as sanitized markdown — headings become real headings and raw markdown
 * syntax is not shown — while hostile HTML is stripped before it reaches
 * the DOM.
 */
test.describe("markdown reading", () => {
  test("renders markdown as HTML in the detail view", async ({ page, request }) => {
    const created = await request.post("/notes", {
      data: {
        title: "Markdown note",
        body: "# Big heading\n\nSome **bold** words",
        tags: [],
      },
    });
    expect(created.ok()).toBeTruthy();

    await page.goto("/");
    await page.getByText("Markdown note").first().click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Big heading" }),
    ).toBeVisible();
    await expect(page.locator('[data-testid="note-body"] strong')).toHaveText("bold");

    // The raw markdown markers are not shown to the reader.
    const bodyText = await page.getByTestId("note-body").innerText();
    expect(bodyText).not.toContain("**");
    expect(bodyText).not.toContain("# ");
  });

  test("sanitizes hostile HTML in note bodies", async ({ page, request }) => {
    const created = await request.post("/notes", {
      data: {
        title: "Hostile note",
        body: "safe <script>window.__pwned = 1</script> text",
        tags: [],
      },
    });
    expect(created.ok()).toBeTruthy();

    await page.goto("/");
    await page.getByText("Hostile note").first().click();

    await expect(page.getByTestId("note-body")).toContainText("safe");
    const html = await page.getByTestId("note-body").innerHTML();
    expect(html).not.toContain("<script");
    expect(
      await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned),
    ).toBeUndefined();
  });
});
