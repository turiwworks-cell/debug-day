// One "Outside event" a day (5.86.1, L8): copies left by older versions fold
// into one, so the Calendar counts one; pausing again the same day opens that
// line again instead of writing it once more.
const assert = require("node:assert/strict");
const { start, fixture } = require("./harness.cjs");

(async () => {
  const h = await start();
  try {
    for (const mobile of [false, true]) {
      const { context, page, errors } = await h.context(mobile);
      const f = await fixture(page, h.origin);
      const event = (id, fixed) => ({ id, text: "Outside event", type: "", on: "", fixed, category: "plan", triggerTag: "outside-event", antidote: "" });
      f.data.days[f.date].bugs = [event("a", true), event("b", true), event("c", true)];
      f.data.days[f.date].pause = { active: false, closed: false, at: new Date().toISOString(), wasRunning: false, eventId: "c" };
      await page.evaluate((d) => localStorage.setItem("debug-day:v2", JSON.stringify(d)), f.data);
      await page.reload();
      await page.waitForSelector(".views", { state: "attached" });

      // The Calendar counts one event, not three.
      await page.locator('.views button[data-panel="calendar"]').click();
      const cell = page.locator(`[data-review-date="${f.date}"]`);
      await cell.waitFor();
      await cell.click();
      const feelings = page.locator(".dd-review-overview div", { has: page.locator("dt", { hasText: "Feelings & events" }) }).locator("dd");
      assert.equal(await feelings.innerText(), "1", "three old copies count as one");

      // Pause, continue, pause again: still one line, opened again.
      await page.locator('.views button[data-panel="board"]').click();
      await page.locator(".b2").first().waitFor();
      const pause = page.locator("[data-pause-day]");
      const pauseOnce = async () => {
        if (mobile && !(await pause.isVisible())) await page.locator('.b2-top-actions [aria-label="More"], .b2-top-actions .b2-more').first().click().catch(() => {});
        await pause.click();
        const dialog = page.getByRole("dialog", { name: "Pause the day", exact: true });
        await dialog.waitFor();
        return dialog;
      };
      for (let i = 0; i < 2; i++) {
        const dialog = await pauseOnce();
        await page.waitForFunction((date) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date].pause?.active === true, f.date);
        const day = await page.evaluate((date) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date], f.date);
        const lines = day.bugs.filter((b) => b.triggerTag === "outside-event");
        assert.equal(lines.length, 1, "one Outside event line");
        assert.equal(lines[0].id, "c", "the line the pause pointed at");
        assert.equal(lines[0].fixed, false, "open while the day is paused");
        assert.equal(day.pause.count, i + 1, "each pause is counted");
        await dialog.getByRole("button", { name: "Continue the day", exact: true }).click();
        await page.waitForFunction((date) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date].pause?.active === false, f.date);
      }
      const after = await page.evaluate((date) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date], f.date);
      assert.deepEqual(after.bugs.map((b) => [b.id, b.fixed]), [["c", true]]);
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log("pause once: one Outside event a day, pauses counted");
  } finally {
    await h.stop();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
