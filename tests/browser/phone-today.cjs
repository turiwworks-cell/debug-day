// The phone opens on Today (5.87.0): the first time the app is opened on a new
// day, a phone on the Board shows the Engine's Today; one tap shows the Board.
// Once a day, and Settings › Basics can turn it off. A desktop never does it.
const assert = require("node:assert/strict");
const { start, fixture } = require("./harness.cjs");

const onBoard = (page, extra = {}) =>
  page.evaluate((extra) => {
    const ui = JSON.parse(localStorage.getItem("debug-day:ui") || "{}");
    localStorage.setItem("debug-day:ui", JSON.stringify({ ...ui, view: "board" }));
    for (const [key, value] of Object.entries(extra)) value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value);
  }, extra);
const relaunch = async (page) => {
  await page.reload();
  await page.waitForSelector(".views", { state: "attached" });
  await page.locator(".b2").first().waitFor();
};

(async () => {
  const h = await start();
  try {
    {
      const { context, page, errors } = await h.context(true);
      const f = await fixture(page, h.origin);
      assert.equal(await page.evaluate(() => localStorage.getItem("debug-day:phone-today")), f.date, "the first open of the day is remembered, on any view");
      await page.evaluate((d) => localStorage.setItem("debug-day:v2", JSON.stringify(d)), f.data);

      // A new day: the phone opens on Today, over the Board.
      await onBoard(page, { "debug-day:phone-today": null });
      await relaunch(page);
      const engine = page.getByRole("dialog", { name: "Engine" });
      await engine.waitFor();
      await engine.locator('[data-engine-task="writing"]').waitFor();
      // One tap and the Board is there.
      await engine.getByRole("button", { name: "Close Engine", exact: true }).click();
      await engine.waitFor({ state: "detached" });
      assert.equal(await page.locator(".b2").first().isVisible(), true);

      // Once a day: opening again the same day stays on the Board.
      await relaunch(page);
      await page.waitForTimeout(600);
      assert.equal(await engine.count(), 0, "not again today");

      // The next morning, coming back to the app opens Today again.
      await page.evaluate(() => {
        localStorage.setItem("debug-day:phone-today", "2000-01-01");
        window.dispatchEvent(new Event("focus"));
      });
      await engine.waitFor();
      await page.keyboard.press("Escape");
      await engine.waitFor({ state: "detached" });

      // Settings › Basics turns it off.
      await page.locator("button", { hasText: "Settings" }).last().click();
      const toggle = page.getByRole("checkbox", { name: "On a phone, open on Today", exact: true });
      await toggle.waitFor({ state: "attached" });
      assert.equal(await toggle.isChecked(), true, "on unless turned off");
      await toggle.uncheck();
      await page.waitForFunction(() => JSON.parse(localStorage.getItem("debug-day:v2")).setup.preferences.phoneToday === false);
      await onBoard(page, { "debug-day:phone-today": null });
      await relaunch(page);
      await page.waitForTimeout(600);
      assert.equal(await engine.count(), 0, "turned off, the phone opens on the Board");
      assert.deepEqual(errors, []);
      await context.close();
    }

    // A desktop opens where it was, Engine closed.
    {
      const { context, page, errors } = await h.context(false);
      await fixture(page, h.origin);
      await onBoard(page, { "debug-day:phone-today": null });
      await relaunch(page);
      await page.waitForTimeout(600);
      assert.equal(await page.getByRole("dialog", { name: "Engine" }).count(), 0);
      assert.equal(await page.evaluate(() => localStorage.getItem("debug-day:phone-today")), null);
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log("phone today: a new day opens on Today, once, and only on a phone");
  } finally {
    await h.stop();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
