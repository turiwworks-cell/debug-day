const assert = require("node:assert/strict");
const { start, fixture } = require("./harness.cjs");
// Each panel has one icon and color, lives in one place, and isolates from Ctrl+Space or the map.
(async () => {
  const h = await start();
  try {
    const { page, errors } = await h.context(false);
    page.setDefaultTimeout(8000);
    const f = await fixture(page, h.origin);
    await page.evaluate((f) => {
      f.data.setup.habits = [{ id: "write", name: "Writing", emo: "", color: "#E2683C" }];
      localStorage.setItem("debug-day:v2", JSON.stringify(f.data));
    }, f);
    await page.reload();
    await page.waitForSelector(".views", { state: "attached" });
    const read = () => page.evaluate(() => JSON.parse(localStorage.getItem("debug-day:v2")));
    const today = async () => (await read()).days[f.date];
    const banner = page.locator(".isolate-banner");

    // View tabs and section headings carry the panel's icon and color. Feelings and Stats are gone.
    assert.deepEqual(
      await page.locator(".views button").evaluateAll((tabs) => tabs.map((tab) => tab.dataset.panel)),
      ["board", "calendar"],
      "the Engine has no page of its own (5.67)",
    );
    assert.equal(await page.locator(".views button .dd-panel-icon").count(), 2);
    // App changes was removed (5.28): no section, no panel.
    assert.equal(await page.locator('[data-section-id="lab"]').count(), 0);

    // The footer no longer repeats the header's map, Calendar and Feelings.
    assert.deepEqual(await page.locator(".foot .utilities button").allInnerTexts(), ["Settings"]);

    // Feelings were removed (5.16): no feelings list.
    assert.equal(await page.locator('[data-section-id="bugs"]').count(), 0);

    // Ctrl+Space: the first page starts with every panel; Enter isolates.
    await page.keyboard.press("Control+Space");
    const modal = page.locator(".dd-command-modal");
    const first = modal.locator(".dd-result-group").first();
    assert.equal(await first.getAttribute("data-group"), "panels");
    assert.equal(await first.locator(".dd-panel-row").count(), 5, "the panels, with Sections right after the Engine (Stats removed in 5.57)");
    assert.equal(await first.locator(".dd-panel-row").nth(1).getAttribute("data-panel"), "sections");
    const ids = await modal.locator(".dd-command-row").evaluateAll((rows) => rows.map((row) => row.id + row.textContent));
    assert.equal(new Set(ids.map((text) => text.replace(/^dd-result-\d+/, ""))).size, ids.length, "nothing is listed twice on the first page");
    assert.equal(await first.locator(".dd-panel-row").first().getAttribute("data-panel"), "engine", "the Engine comes first");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await modal.waitFor({ state: "hidden" });
    // Habits open beside the Board, in "Today's habits" (5.67).
    await page.locator("#dd-rail-habits").waitFor();
    assert.equal(await page.locator('#dd-rail-habits [data-rail-habit="write"]').count(), 1);
    assert.equal(await page.locator(".dd-engine").count(), 0);
    assert.equal(await page.locator('[data-section-id="bugs"]').count(), 0);

    // Typing finds a panel first. "plan" finds the Engine, which holds the old Plan (5.50).
    await page.keyboard.press("Control+Space");
    await modal.getByRole("combobox").fill("plan");
    assert.equal(await modal.locator(".dd-result-group").first().getAttribute("data-group"), "panels");
    assert.equal(await modal.locator(".dd-panel-row").first().getAttribute("data-panel"), "engine");
    await page.keyboard.press("Enter");
    await page.getByRole("dialog", { name: "Engine" }).waitFor();
    assert.equal(await page.locator('.views [role=tab][data-panel="board"]').getAttribute("aria-selected"), "true", "the Engine opens over the Board");
    await page.keyboard.press("Escape");
    await page.locator(".dd-engine").waitFor({ state: "detached" });
    // App changes was removed (5.28), so search no longer offers it.
    await page.keyboard.press("Control+Space");
    await modal.getByRole("combobox").fill("app changes");
    assert.equal(await modal.locator('.dd-panel-row[data-panel="lab"]').count(), 0);
    await page.keyboard.press("Escape");

    // App map: one card per panel (Feelings and Stats are gone). A number isolates, Shift+number shows it with the rest, 0 shows all.
    await page.keyboard.press("Alt+KeyM");
    await page.locator(".dd-panel-map").waitFor();
    assert.deepEqual(
      await page.locator(".dd-panel-map .app-map-card").evaluateAll((cards) => cards.map((card) => card.dataset.panel)),
      ["engine", "board", "habits", "calendar"],
    );
    assert.match(await page.locator('.app-map-card[data-panel="habits"] small').innerText(), /0 of 1 today/);
    await page.keyboard.press("Digit0");
    await banner.waitFor({ state: "detached" });
    await page.keyboard.press("Alt+KeyM");
    await page.keyboard.press("Shift+Digit3");
    await page.locator(".dd-panel-map").waitFor({ state: "detached" });
    assert.equal(await banner.count(), 0);
    assert.equal(await page.locator("#dd-rail-habits").count(), 1, "Shift+3 shows Today's habits");
    await page.keyboard.press("Alt+KeyM");
    await page.keyboard.press("Digit2");
    await page.locator(".b4").waitFor();
    await banner.locator('.dd-panel-icon[data-panel="board"]').waitFor();
    assert.equal(await page.locator('[data-board-id^="bug:"]').count(), 0, "no feelings on the Board");

    // Calendar reads the day note; there is no Feelings section any more.
    await page.keyboard.press("Alt+KeyM");
    await page.keyboard.press("Digit4");
    const day = page.locator("#dd-calendar-day");
    await day.waitFor();
    assert.equal(await banner.count(), 0);
    assert.equal(await day.getByRole("textbox", { name: "Feeling text", exact: true }).count(), 0);
    assert.equal(await day.getByRole("textbox", { name: "Day note", exact: true }).count(), 0);
    assert.equal(await day.locator(".dd-review-focus dd").innerText(), "Ship the portfolio");
    assert.equal(await day.locator(".dd-review-feelings-brief").count(), 0);
    assert.match(await day.locator(".dd-review-note-text").innerText(), /Journal/);
    assert.equal(await page.locator('.dd-review-sections button[data-panel="feelings"]').count(), 0);

    assert.deepEqual(errors, []);
    console.log("Panels passed");
    await page.context().close();
  } finally {
    await h.stop();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
