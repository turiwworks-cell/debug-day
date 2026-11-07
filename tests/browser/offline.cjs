const assert = require("node:assert/strict");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { pathToFileURL } = require("node:url");
const { start, fixture } = require("./harness.cjs");
(async () => {
  const h = await start(),
    folder = mkdtempSync(join(tmpdir(), "debug-day-offline-"));
  try {
    const { page, context, errors } = await h.context(false),
      f = await fixture(page, h.origin);
    f.data.days[f.date].notes[0].role = "goal";
    f.data.days[f.date].canvas = { board4: { links: [{ id: "offline-goal", from: "sticky:note", to: "b:writing" }] } };
    f.data.setup.preferences.boardRailGoal = true;
    f.data.setup.preferences.boardRailNote = false;
    f.data.setup.preferences.boardRailHabits = false;
    await page.evaluate(
      (f) => localStorage.setItem("debug-day:v2", JSON.stringify(f.data)),
      f,
    );
    await page.reload();
    await page.locator(".foot .utilities button").last().click();
    const pending = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download standalone HTML", exact: true })
      .click();
    const download = await pending,
      file = join(folder, "debug-day.html");
    await download.saveAs(file);
    assert.deepEqual(errors, []);
    await context.close();
    // Same time zone as the fixture, so "today" is the same day around midnight too.
    const offline = await h.browser.newContext({
        viewport: { width: 390, height: 844 },
        timezoneId: "Asia/Tehran",
      }),
      p = await offline.newPage(),
      offlineErrors = [];
    await offline.route("http**/*", (route) => route.abort());
    p.on("pageerror", (error) => offlineErrors.push(error.message));
    await p.goto(pathToFileURL(file).href);
    await p.waitForSelector(".views");
    await p.getByRole("button", { name: "Search", exact: true }).click();
    await p
      .getByRole("combobox", { name: "Search everything", exact: true })
      .fill("Portfolio writing");
    await p
      .getByRole("listbox")
      .getByRole("option")
      .filter({ hasText: "Portfolio writing" })
      .first()
      .waitFor();
    await p.getByRole("button", { name: "Close search", exact: true }).click();
    await p.locator(".views button").nth(2).click();
    assert.equal(await p.locator("[data-review-date]").count(), 42);
    assert.equal(
      await p.locator(".dd-review-day time").getAttribute("dateTime"),
      f.date,
    );
    // The Engine works in the standalone file and its tasks survive a reload.
    await p.locator(".views button").nth(1).click();
    await p.locator(".b2-viewport").focus(); await p.keyboard.press("Control+Shift+F");
    await p.locator('#dd-rail-goal [data-rail-ref="b:writing"]').waitFor();
    await p.locator('[data-rail-toggle="goal"]').click();
    assert.equal(await p.locator("#dd-rail-goal").count(), 0, "rails are bundled and toggle offline");
    await p.locator(".b2-viewport").focus();
    await p.keyboard.press("e");
    const engine = p.getByRole("dialog", { name: "Engine", exact: true });
    await engine.locator('[data-lane="work"] .dd-engine-add input').fill("An offline task");
    await engine.locator('[data-lane="work"] .dd-engine-add input').press("Enter");
    await engine.locator(".dd-engine-name", { hasText: "An offline task" }).waitFor();
    await p.keyboard.press("Escape");
    await p.reload();
    await p.locator(".views button").nth(1).click();
    await p.locator(".b2-viewport").focus();
    await p.keyboard.press("e");
    await engine.locator(".dd-engine-name", { hasText: "An offline task" }).waitFor();
    await p.keyboard.press("Escape");
    await p.locator(".views button").nth(2).click();
    assert.equal(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      true,
    );
    await p.locator(".views button").nth(1).click();
    const zoom = p.getByRole("textbox", { name: "Zoom percentage", exact: true });
    await zoom.fill("125"); await zoom.press("Enter");
    await p.waitForFunction(() => document.querySelector(".b2-viewport").dataset.zoom === "1.25");
    // Original vectors on tasks stay usable in the self-contained file.
    await p.evaluate((date) => {
      const data = JSON.parse(localStorage.getItem("debug-day:v2"));
      data.days[date].blocks[0].emo = "sticker:orbit";
      localStorage.setItem("debug-day:v2", JSON.stringify(data));
    }, f.date);
    await p.reload();
    await p.locator(".views button").nth(0).click();
    await p.locator('[data-block-id="writing"] svg.dd-sticker-art,[data-playful-task="writing"] svg.dd-sticker-art').first().waitFor({ state: "attached" });
    await p.locator(".views button").nth(1).click();
    await p.locator('[data-board-id="b:writing"] [data-symbol="sticker:orbit"] svg').waitFor();
    assert.deepEqual(offlineErrors, []);
    await offline.close();
    console.log(
      "Standalone HTML works without network: search, calendar, Engine, animated stickers, save and reload",
    );
  } finally {
    await h.stop();
    rmSync(folder, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
