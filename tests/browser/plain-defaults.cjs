// Leftovers of removed features (5.85.3): a new task gets no hidden category
// (plain grey, its #words stay tags), Capture no longer asks for a lane, and
// the Calendar's bar is the day's Progress, the same number as its percent.
const assert = require("node:assert/strict");
const { start, fixture, openEngine } = require("./harness.cjs");

(async () => {
  const h = await start();
  try {
    for (const mobile of [false, true]) {
      const { context, page, errors } = await h.context(mobile);
      const f = await fixture(page, h.origin);
      // A short P1 task done and a long normal one open: by minutes the day is
      // about 11% done, by priority (the app's Progress) it is 80%.
      const [first, second] = f.data.days[f.date].blocks;
      f.data.days[f.date].blocks = [
        { ...first, min: 30, pri: 1, done: true },
        { ...second, min: 240, pri: 0, done: false },
      ];
      await page.evaluate((d) => localStorage.setItem("debug-day:v2", JSON.stringify(d)), f.data);
      await page.reload();
      await page.waitForSelector(".views", { state: "attached" });
      await page.locator('.views button[data-panel="calendar"]').click();
      const cell = page.locator(`[data-review-date="${f.date}"]`);
      await cell.waitFor();
      await cell.click();
      assert.equal(await cell.locator(".dd-cal-meter i").getAttribute("style"), "width: 80%;", "the month cell's bar is the day's Progress");
      const card = page.locator(".dd-review-overview");
      assert.equal(await card.locator(".dd-cal-meter i").getAttribute("style"), "width: 80%;", "the day card's bar too");
      assert.equal(await page.locator(".dd-day-progress").getAttribute("data-completion"), "80", "and its percent says the same");

      // Capture: no "Goes to" lane choice; the task lands where the Engine puts one.
      await page.locator(".dd-floating-capture").click();
      await page.getByRole("group", { name: "Capture type" }).getByRole("button", { name: "Task", exact: true }).click();
      assert.equal(await page.locator(".dd-capture-lanes").count(), 0, "Capture asks no lane");
      await page.getByRole("textbox", { name: "Capture text" }).fill("Call the framer #sport");
      await page.getByRole("button", { name: "Capture", exact: true }).click();
      await page.waitForFunction((date) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date].blocks.some((b) => b.name === "Call the framer"), f.date);
      let day = await page.evaluate((date) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date], f.date);
      const captured = day.blocks.find((b) => b.name === "Call the framer");
      assert.equal(captured.type, "", "a captured task has no category");
      assert.deepEqual(captured.tags, ["sport"], "#sport is a tag, not a hidden category");
      assert.equal(captured.lane, "work", "it goes to the first lane, like a new Engine task");

      // The Engine's quick add: no category taken from the task before it.
      const engine = await openEngine(page);
      const quick = engine.getByRole("textbox", { name: "Quick add", exact: true });
      await quick.fill("Glaze tests");
      await quick.press("Enter");
      await page.waitForFunction((date) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date].blocks.some((b) => b.name === "Glaze tests"), f.date);
      await page.keyboard.press("Escape");
      await page.locator(".dd-engine").waitFor({ state: "detached" });
      // Stays plain after a reload (the saved "no category" is kept).
      await page.reload();
      await page.waitForSelector(".views", { state: "attached" });
      day = await page.evaluate((date) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date], f.date);
      assert.equal(day.blocks.find((b) => b.name === "Glaze tests").type, "", "an Engine task has no category, even after a reload");
      assert.equal(day.blocks.find((b) => b.name === "Call the framer").type, "");
      assert.equal(day.blocks.find((b) => b.name === "Portfolio writing").type, "writing", "an old task keeps its category");
      await page.locator('.views button[data-panel="board"]').click();
      await page.locator(".b4").waitFor();
      if (mobile && !(await page.locator(".b4").getAttribute("class")).includes("focus-mode"))
        await page.getByRole("button", { name: "Full screen", exact: true }).click();
      const node = page.locator('.b4-node.b4-block[aria-label^="Glaze tests"]');
      await node.waitFor();
      assert.equal(await node.evaluate((n) => n.style.getPropertyValue("--node-color")), "#8E8A80", "a new task wears the plain grey");
      const old = page.locator('.b4-node.b4-block[aria-label^="Portfolio writing"]');
      assert.notEqual(await old.evaluate((n) => n.style.getPropertyValue("--node-color")), "#8E8A80", "an old task keeps its colour");
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log("plain defaults: no hidden category, no lane question, one Progress");
  } finally {
    await h.stop();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
