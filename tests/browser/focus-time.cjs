// Time focused on a task (5.88.0). Focus started from a task in the Engine
// counts the time that really passed and writes it on the task: the Engine
// row, the Calendar's day and the week's look back show it. A clock that ran
// out while the app was closed still gives the task its time.
const assert = require("node:assert/strict");
const { start, fixture, openEngine } = require("./harness.cjs");

const spent = (page, date) =>
  page.evaluate((date) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date].blocks.find((b) => b.id === "writing")?.spent || 0, date);

(async () => {
  const h = await start();
  try {
    for (const mobile of [false, true]) {
      const { context, page, errors } = await h.context(mobile);
      await page.clock.install({ time: new Date("2026-11-21T10:00:00+03:30") });
      const f = await fixture(page, h.origin);
      await page.evaluate((d) => {
        localStorage.setItem("debug-day:v2", JSON.stringify(d));
        localStorage.setItem("debug-day:phone-today", new Date().toLocaleDateString("en-CA"));
      }, f.data);
      await page.reload();
      await page.waitForSelector(".views", { state: "attached" });

      // Focus on a task from the Engine on the Board.
      const engine = await openEngine(page);
      await engine.getByRole("button", { name: "More for: Portfolio writing", exact: true }).click();
      await engine.getByRole("button", { name: "Focus", exact: true }).click();
      await page.waitForFunction(() => JSON.parse(localStorage.getItem("debug-day:timer") || "{}").running === true);
      const clock = await page.evaluate(() => JSON.parse(localStorage.getItem("debug-day:timer")));
      assert.deepEqual([clock.task.date, clock.task.id, clock.task.name], [f.date, "writing", "Portfolio writing"]);

      // Ten minutes of focus, then a pause: the task gets ten minutes.
      await page.clock.fastForward("10:00");
      await page.evaluate(() => import("./timer.js").then((m) => m.DDtimer.pause()));
      await page.waitForFunction((date) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date].blocks.find((b) => b.id === "writing")?.spent >= 600, f.date);
      assert.equal(await spent(page, f.date), 600);
      const row = engine.locator('[data-engine-task="writing"] .dd-engine-spent');
      await row.waitFor();
      assert.equal(await row.innerText(), "10m focused");
      await page.keyboard.press("Escape");
      await page.locator(".dd-engine").waitFor({ state: "detached" });

      // The clock ran out while the app was closed: 25 more minutes.
      await page.evaluate((date) => {
        const now = Date.now();
        localStorage.setItem("debug-day:timer", JSON.stringify({ running: true, deadline: now - 60e3, seconds: 0, total: 1500, base: 1500, task: { date, id: "writing", name: "Portfolio writing" }, runFrom: now - 26 * 60e3 }));
      }, f.date);
      await page.reload();
      await page.waitForSelector(".views", { state: "attached" });
      await page.waitForFunction((date) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date].blocks.find((b) => b.id === "writing")?.spent >= 2100, f.date);
      assert.equal(await spent(page, f.date), 2100, "written once");
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("debug-day:timer")).task), null, "the clock is free again");
      await page.locator(".dd-timer-notice button").last().click().catch(() => {});

      // The Calendar's day and the week's look back.
      await page.locator('.views button[data-panel="calendar"]').click();
      const cell = page.locator(`[data-review-date="${f.date}"]`);
      await cell.waitFor();
      await cell.click();
      const task = page.locator('.dd-review-task[data-review-task="writing"] .dd-review-spent');
      await task.waitFor();
      assert.equal(await task.innerText(), "35m focused");
      assert.equal(await page.locator(".dd-review-focused dd").innerText(), "35m");
      await page.locator('[data-cal-mode="week"]').first().click();
      const week = page.locator("[data-week-focused]");
      await week.waitFor();
      assert.match(await week.innerText(), /Focused[\s\S]*35m[\s\S]*Portfolio writing[\s\S]*35m/);
      await page.locator('[data-cal-mode="month"]').first().click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false, "no sideways scroll");
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log("focus time: focused time is written on the task and shown as history");
  } finally {
    await h.stop();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
