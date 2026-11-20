// Reminders that repeat every day, month or year, with an optional time
// (5.93.0). "Pay rent" on the 31st, every month: November has 30 days, so it
// comes on the 30th; the time shows beside it, and a reload keeps it all.
const assert = require("node:assert/strict");
const { start, fixture } = require("./harness.cjs");

(async () => {
  const h = await start();
  try {
    for (const mobile of [false, true]) {
      const { context, page, errors } = await h.context(mobile);
      page.setDefaultTimeout(15000);
      await page.clock.install({ time: new Date("2026-11-20T12:00:00+03:30") });
      const f = await fixture(page, h.origin);
      f.data.setup.reminders = [];
      await page.evaluate((d) => {
        localStorage.setItem("debug-day:v2", JSON.stringify(d));
        localStorage.setItem("debug-day:review-calendar", JSON.stringify("gregory"));
        localStorage.setItem("debug-day:calendar-mode", JSON.stringify("month"));
      }, f.data);
      await page.reload();
      await page.waitForSelector(".views", { state: "attached" });
      await page.locator('.views button[data-panel="calendar"]').click();

      const addBox = page.locator(".dd-review-reminders details");
      await addBox.locator("summary").click();
      await addBox.getByRole("textbox", { name: "Reminder text", exact: true }).fill("Pay rent");
      await addBox.getByLabel("Reminder day", { exact: true }).fill("2026-10-31");
      const repeat = addBox.locator("select");
      assert.deepEqual(await repeat.locator("option").allInnerTexts(), ["This day only", "Every day", "Every week", "Every other day", "Every month", "Every year"]);
      await repeat.selectOption("monthly");
      await addBox.getByLabel("Reminder time", { exact: true }).fill("09:00");
      await addBox.getByRole("button", { name: "Save reminder", exact: true }).click();
      await page.waitForFunction(() => JSON.parse(localStorage.getItem("debug-day:v2")).setup.reminders.some((r) => r.title === "Pay rent" && r.repeat === "monthly" && r.time === "09:00" && r.cal === "gregory"));

      // The 31st falls on November's last day, the 30th.
      await page.reload();
      await page.waitForSelector(".views", { state: "attached" });
      await page.locator('.views button[data-panel="calendar"]').click();
      const cell = page.locator('[data-review-date="2026-11-30"]');
      await cell.waitFor();
      if (!mobile) {
        // (A phone's month is too narrow for names; its day panel shows them.)
        assert.match(await cell.innerText(), /Pay rent/);
        assert.doesNotMatch(await page.locator('[data-review-date="2026-11-29"]').innerText(), /Pay rent/);
      }
      await cell.click();
      const row = page.locator(".dd-review-reminders .dd-review-reminder", { hasText: "Pay rent" });
      await row.waitFor();
      assert.match(await row.locator(".dd-rem-open small").innerText(), /^09:00 · ↻ Every month/);
      // Inside: every way to repeat, and the time.
      // (Picking the day by its middle may already have opened it: its line sits there.)
      if ((await row.locator(".dd-rem-open").getAttribute("aria-expanded")) !== "true") await row.locator(".dd-rem-open").click();
      const inside = row.locator(".dd-rem-detail");
      await inside.waitFor();
      assert.equal(await inside.locator("[data-rem-repeat]").count(), 6);
      assert.equal(await inside.locator("[data-rem-time]").inputValue(), "09:00");
      await inside.locator('[data-rem-repeat="yearly"]').click();
      await page.waitForFunction(() => JSON.parse(localStorage.getItem("debug-day:v2")).setup.reminders.find((r) => r.title === "Pay rent").repeat === "yearly");
      if (mobile) assert.ok((await inside.locator('[data-rem-repeat="yearly"]').boundingBox()).height >= 32, "a choice you can tap");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false, "no sideways scroll");
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally {
    await h.stop();
  }
  console.log("reminder repeats: every month falls on a short month's last day, with its time, on desktop and phone");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
