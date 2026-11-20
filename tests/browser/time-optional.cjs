// Time is optional (5.86.0): a new task has no time unless someone gives it
// one. The Engine's − steps down to "No time", Capture adds no time, a reload
// keeps it, and Settings › New tasks take starts on "No time" and keeps a
// length someone picks.
const assert = require("node:assert/strict");
const { start, fixture, openEngine } = require("./harness.cjs");

const saved = (page, date, name) =>
  page.evaluate(({ date, name }) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date].blocks.find((b) => b.name === name), { date, name });
const waitFor = (page, date, name, min) =>
  page.waitForFunction(
    ({ date, name, min }) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date]?.blocks.some((b) => b.name === name && b.min === min),
    { date, name, min },
  );

(async () => {
  const h = await start();
  try {
    for (const mobile of [false, true]) {
      const { context, page, errors } = await h.context(mobile);
      const f = await fixture(page, h.origin);
      // A planner from before: the old untouched 60 minutes.
      f.data.setup.preferences = { ...f.data.setup.preferences, defaultMinutes: 60 };
      delete f.data.setup.preferences.timeOptional;
      await page.evaluate((d) => localStorage.setItem("debug-day:v2", JSON.stringify(d)), f.data);
      await page.reload();
      await page.waitForSelector(".views", { state: "attached" });

      // Engine quick add: no time, and the row says nothing about time.
      const engine = await openEngine(page);
      const quick = engine.getByRole("textbox", { name: "Quick add", exact: true });
      await quick.fill("Glaze tests");
      await quick.press("Enter");
      await waitFor(page, f.date, "Glaze tests", 0);
      const glaze = await saved(page, f.date, "Glaze tests");
      const row = engine.locator(`[data-engine-task="${glaze.id}"]`);
      await row.waitFor();
      assert.equal(await row.locator(".dd-engine-min").count(), 0, "a task with no time shows no length");

      // − and + step through "No time".
      await engine.getByRole("button", { name: "More for: Glaze tests", exact: true }).click();
      const time = row.locator(".dd-engine-time");
      await time.waitFor();
      assert.equal(await time.locator("b").innerText(), "No time");
      assert.equal(await time.getByRole("button", { name: "Less time", exact: true }).isDisabled(), true, "nothing below no time");
      await time.getByRole("button", { name: "More time", exact: true }).click();
      await waitFor(page, f.date, "Glaze tests", 15);
      assert.equal(await time.locator("b").innerText(), "15m");
      await time.getByRole("button", { name: "Less time", exact: true }).click();
      await waitFor(page, f.date, "Glaze tests", 0);
      assert.equal(await time.locator("b").innerText(), "No time");

      // A length typed in quick add still counts.
      await quick.fill("Varnish 45m");
      await quick.press("Enter");
      await waitFor(page, f.date, "Varnish", 45);
      await page.keyboard.press("Escape");
      await page.locator(".dd-engine").waitFor({ state: "detached" });

      // Capture: a task with no time.
      await page.locator(".dd-floating-capture").click();
      await page.getByRole("group", { name: "Capture type" }).getByRole("button", { name: "Task", exact: true }).click();
      await page.getByRole("textbox", { name: "Capture text" }).fill("Call the framer");
      await page.getByRole("button", { name: "Capture", exact: true }).click();
      await waitFor(page, f.date, "Call the framer", 0);
      if (await page.locator(".dd-capture-sheet, .dd-capture").first().isVisible().catch(() => false)) await page.keyboard.press("Escape");

      // A reload keeps "no time" (it is not turned back into an hour).
      await page.reload();
      await page.waitForSelector(".views", { state: "attached" });
      assert.equal((await saved(page, f.date, "Glaze tests")).min, 0);
      assert.equal((await saved(page, f.date, "Call the framer")).min, 0);
      assert.equal((await saved(page, f.date, "Varnish")).min, 45);
      assert.equal((await saved(page, f.date, "Portfolio writing")).min, 180, "an old task keeps its time");
      assert.deepEqual(errors, []);
      await context.close();
    }

    // Settings › New tasks take: "No time" first and by default; a length picked stays.
    {
      const { context, page, errors } = await h.context(false);
      const f = await fixture(page, h.origin);
      f.data.setup.preferences = { ...f.data.setup.preferences, defaultMinutes: 60 };
      delete f.data.setup.preferences.timeOptional;
      await page.evaluate((d) => localStorage.setItem("debug-day:v2", JSON.stringify(d)), f.data);
      await page.reload();
      await page.waitForSelector(".views", { state: "attached" });
      const openSettings = async () => {
        await page.locator("button", { hasText: "Settings" }).last().click();
        return page.getByRole("combobox", { name: "Default task length", exact: true });
      };
      let length = await openSettings();
      assert.equal(await length.inputValue(), "0", "the old untouched hour became no time");
      assert.equal((await length.locator("option").allInnerTexts())[0], "No time");
      await length.selectOption("60");
      await page.waitForFunction(() => JSON.parse(localStorage.getItem("debug-day:v2")).setup.preferences.defaultMinutes === 60);
      await page.reload();
      await page.waitForSelector(".views", { state: "attached" });
      length = await openSettings();
      assert.equal(await length.inputValue(), "60", "an hour picked now stays an hour");
      const engine = await openEngine(page);
      const quick = engine.getByRole("textbox", { name: "Quick add", exact: true });
      await quick.fill("Stretch canvas");
      await quick.press("Enter");
      await waitFor(page, f.date, "Stretch canvas", 60);
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log("time optional: no time by default, − reaches no time, a picked length stays");
  } finally {
    await h.stop();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
