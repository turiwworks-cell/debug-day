// When a new day starts (5.86.3, L5 and L6). With "A new day starts at" 4:00,
// half past one at night is still the day before: the Calendar, the Engine and
// quick add all use that day. A device that gets the hour from sync follows it
// at once, and an app left open moves on to the new day when the hour comes.
// The week starts with the Calendar's choice (Saturday with the Persian
// calendar), not with the app's language.
const assert = require("node:assert/strict");
const { start, fixture, openEngine } = require("./harness.cjs");

const read = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("debug-day:v2")));
const today = (page) => page.locator('[data-review-date][aria-current="date"]').getAttribute("data-review-date");
const calendar = async (page) => {
  await page.locator('.views button[data-panel="calendar"]').click();
  await page.locator('[data-review-date][aria-current="date"]').waitFor();
};

(async () => {
  const h = await start();
  try {
    {
      const { context, page, errors } = await h.context(false);
      // Friday night, half past one (Tehran).
      await page.clock.install({ time: new Date("2026-11-21T01:30:00+03:30") });
      const f = await fixture(page, h.origin);
      assert.equal(f.date, "2026-11-21");
      const late = { id: "late", name: "Ink the night page", type: "", lane: "work", min: 0, pri: 0, emo: "", note: "", done: false, expanded: false, subtasks: [] };
      f.data.days["2026-11-20"] = { date: "2026-11-20", blocks: [late], notes: [], bugs: [] };
      // The hour came from another device: this one has no copy of it yet.
      f.data.setup.preferences = { ...f.data.setup.preferences, dayStartsAt: 4 };
      await page.evaluate((d) => {
        localStorage.setItem("debug-day:v2", JSON.stringify(d));
        localStorage.removeItem("debug-day:day-starts");
      }, f.data);
      await page.reload();
      await page.waitForSelector(".views", { state: "attached" });
      await page.waitForFunction(() => localStorage.getItem("debug-day:day-starts") === "4");

      // It is still Friday: the Calendar, the Engine and quick add agree.
      await calendar(page);
      assert.equal(await today(page), "2026-11-20", "half past one is still the day before");
      const engine = await openEngine(page);
      await engine.locator('[data-engine-task="late"]').waitFor();
      const quick = engine.getByRole("textbox", { name: "Quick add", exact: true });
      await quick.fill("Wash the brushes");
      await quick.press("Enter");
      await page.waitForFunction(() => JSON.parse(localStorage.getItem("debug-day:v2")).days["2026-11-20"].blocks.some((b) => b.name === "Wash the brushes"));
      assert.equal(((await read(page)).days["2026-11-21"]?.blocks || []).some((b) => b.name === "Wash the brushes"), false);
      await page.keyboard.press("Escape");
      await page.locator(".dd-engine").waitFor({ state: "detached" });

      // Settings › Basics: Midnight makes it Saturday; 4:00 brings Friday back.
      await page.locator("button", { hasText: "Settings" }).last().click();
      const hour = page.getByRole("combobox", { name: "New day starts at", exact: true });
      assert.equal(await hour.inputValue(), "4");
      assert.equal((await hour.locator("option").allInnerTexts())[0], "Midnight");
      await hour.selectOption("0");
      await page.waitForFunction(() => localStorage.getItem("debug-day:day-starts") === null);
      assert.ok(!((await read(page)).setup.preferences.dayStartsAt > 0), "midnight is the plain day");
      await calendar(page);
      assert.equal(await today(page), "2026-11-21", "at midnight's hour it is Saturday");
      await page.locator("button", { hasText: "Settings" }).last().click();
      await hour.selectOption("4");
      await page.waitForFunction(() => JSON.parse(localStorage.getItem("debug-day:v2")).setup.preferences.dayStartsAt === 4);
      await calendar(page);
      assert.equal(await today(page), "2026-11-20");

      // Left open, the app moves on when the new day starts, and the Engine follows.
      await page.clock.fastForward("03:00:00");
      await page.waitForFunction(() => document.querySelector('[data-review-date][aria-current="date"]')?.dataset.reviewDate === "2026-11-21");
      const next = await openEngine(page);
      await next.locator('[data-engine-task="writing"]').waitFor();
      assert.equal(await next.locator('[data-engine-task="late"]').count(), 0, "yesterday's task stays on its day");
      await page.keyboard.press("Escape");
      assert.deepEqual(errors, []);
      await context.close();
    }

    // The week starts with the Calendar's choice, whatever the language.
    for (const mobile of [false, true]) {
      const { context, page, errors } = await h.context(mobile);
      await page.clock.install({ time: new Date("2026-11-21T12:00:00+03:30") });
      const f = await fixture(page, h.origin);
      await page.evaluate((d) => {
        localStorage.setItem("debug-day:v2", JSON.stringify(d));
        localStorage.setItem("debug-day:calendar-mode", JSON.stringify("week"));
        localStorage.setItem("debug-day:review-calendar", JSON.stringify("persian"));
      }, f.data);
      await page.reload();
      await page.waitForSelector(".views", { state: "attached" });
      await page.locator('.views button[data-panel="calendar"]').click();
      const first = () => page.locator("[data-week-date]").first().getAttribute("data-week-date");
      await page.locator("[data-week-date]").first().waitFor();
      assert.equal(await first(), "2026-11-21", "the Persian week starts on Saturday");
      await page.evaluate(() => localStorage.setItem("debug-day:review-calendar", JSON.stringify("gregory")));
      await page.reload();
      await page.waitForSelector(".views", { state: "attached" });
      await page.locator('.views button[data-panel="calendar"]').click();
      await page.locator("[data-week-date]").first().waitFor();
      assert.equal(await first(), "2026-11-16", "the Gregorian week starts on Monday");
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log("day start: a late night stays on its day, the open app moves on, the week starts with the calendar");
  } finally {
    await h.stop();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
