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
    await page.waitForSelector("#qa", { state: "attached" });
    const read = () => page.evaluate(() => JSON.parse(localStorage.getItem("debug-day:v2")));
    const today = async () => (await read()).days[f.date];
    const banner = page.locator(".isolate-banner");

    // View tabs and section headings carry the panel's icon and color. Feelings and Stats are inside Calendar.
    assert.deepEqual(
      await page.locator(".views button").evaluateAll((tabs) => tabs.map((tab) => tab.dataset.panel)),
      ["plan", "board", "calendar"],
    );
    assert.equal(await page.locator(".views button .dd-panel-icon").count(), 3);
    const color = (selector) => page.locator(selector).first().evaluate((node) => getComputedStyle(node).getPropertyValue("--pc").trim());
    assert.equal(await color('.dd-habits[data-panel="habits"]'), "#2BA672");
    assert.equal(await color('[data-section-id="lab"][data-panel="lab"]'), "#D39A00");
    assert.equal(await page.locator('[data-section-id="lab"] .dd-panel-title').innerText(), "App changes");

    // The footer no longer repeats the header's map, Calendar and Feelings.
    assert.deepEqual(await page.locator(".foot .utilities button").allInnerTexts(), ["Settings"]);

    // Feelings were removed (5.16): no feelings list in Plan.
    assert.equal(await page.locator('[data-section-id="bugs"]').count(), 0);

    // Ctrl+Space: the first page starts with every panel; Enter isolates.
    await page.keyboard.press("Control+Space");
    const modal = page.locator(".dd-command-modal");
    const first = modal.locator(".dd-result-group").first();
    assert.equal(await first.getAttribute("data-group"), "panels");
    assert.equal(await first.locator(".dd-panel-row").count(), 7);
    const ids = await modal.locator(".dd-command-row").evaluateAll((rows) => rows.map((row) => row.id + row.textContent));
    assert.equal(new Set(ids.map((text) => text.replace(/^dd-result-\d+/, ""))).size, ids.length, "nothing is listed twice on the first page");
    assert.equal(await first.locator(".dd-panel-row").first().getAttribute("data-panel"), "engine", "the Engine comes first");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await modal.waitFor({ state: "hidden" });
    await banner.locator('.dd-panel-icon[data-panel="habits"]').waitFor();
    assert.equal(await page.locator(".dd-habits").count(), 1);
    assert.equal(await page.locator("section.plan").count(), 0);
    assert.equal(await page.locator('[data-section-id="bugs"]').count(), 0);

    // Typing finds a panel first.
    await page.keyboard.press("Control+Space");
    await modal.getByRole("combobox").fill("app changes");
    assert.equal(await modal.locator(".dd-result-group").first().getAttribute("data-group"), "panels");
    await page.keyboard.press("Enter");
    await banner.locator('.dd-panel-icon[data-panel="lab"]').waitFor();
    assert.equal(await page.locator('[data-section-id="lab"]').count(), 1);
    assert.equal(await page.locator(".dd-habits").count(), 0);

    // App map: one card per panel, Feelings and Stats share Calendar's. A number isolates, Shift+number shows it with the rest, 0 shows all.
    await page.keyboard.press("Alt+KeyM");
    await page.locator(".dd-panel-map").waitFor();
    assert.deepEqual(
      await page.locator(".dd-panel-map .app-map-card").evaluateAll((cards) => cards.map((card) => card.dataset.panel)),
      ["engine", "plan", "board", "habits", "calendar", "lab"],
    );
    assert.match(await page.locator('.app-map-card[data-panel="habits"] small').innerText(), /0 of 1 today/);
    await page.keyboard.press("Digit0");
    await banner.waitFor({ state: "detached" });
    await page.keyboard.press("Alt+KeyM");
    await page.keyboard.press("Shift+Digit4");
    await page.locator(".dd-panel-map").waitFor({ state: "detached" });
    assert.equal(await banner.count(), 0);
    assert.equal(await page.locator("section.plan").count(), 1);
    await page.keyboard.press("Alt+KeyM");
    await page.keyboard.press("Digit3");
    await page.locator(".b4").waitFor();
    await banner.locator('.dd-panel-icon[data-panel="board"]').waitFor();
    assert.equal(await page.locator('[data-board-id^="bug:"]').count(), 0, "no feelings on the Board");

    // Calendar reads the day note; there is no Feelings section any more.
    await page.keyboard.press("Alt+KeyM");
    await page.keyboard.press("Digit5");
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
