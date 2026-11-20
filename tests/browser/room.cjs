// Room in the planner (5.92.0). Near the 1.5 MB sync limit, today's Engine says
// so once a day ("Your planner is 84% full", with "Not today"), and its button
// opens Settings › Your data, which shows what takes the room.
const assert = require("node:assert/strict");
const { start, fixture, openEngine } = require("./harness.cjs");

(async () => {
  const h = await start();
  try {
    for (const mobile of [false, true]) {
      const { context, page, errors } = await h.context(mobile);
      page.setDefaultTimeout(15000);
      const f = await fixture(page, h.origin);
      // About 1.27 MB of words on an older day.
      f.data.days["2026-09-02"] = { date: "2026-09-02", blocks: [], notes: [], bugs: [], journal: "a long page of words ".repeat(60000) };
      await page.evaluate((d) => localStorage.setItem("debug-day:v2", JSON.stringify(d)), f.data);
      await page.reload();
      await page.waitForSelector(".views", { state: "attached" });

      let engine = await openEngine(page);
      const nudge = engine.locator('[data-nudge="room"]');
      await nudge.waitFor();
      assert.match(await nudge.innerText(), /Your planner is 8\d% full[\s\S]*Archiving old months makes room\./);
      if (mobile) assert.ok((await nudge.getByRole("button", { name: "Not today", exact: true }).boundingBox()).height >= 44, "a finger-sized button");

      if (!mobile) {
        await nudge.getByRole("button", { name: "See what takes room", exact: true }).click();
        const parts = page.locator("[data-storage-parts]");
        await parts.waitFor();
        assert.match(await parts.innerText(), /^Days 1\.3 MB · /, "the days take the room");
        assert.match(await page.locator(".dd-storage-near").innerText(), /Getting close to the limit\. Deleting drawings you no longer need makes room; with sync on, old months can be archived too\./);
        assert.match(await page.locator("[data-storage-part]").innerText(), /Space used: 1\.\d+ MB of 1\.5 MB \(8\d%\)/);
      } else {
        await nudge.getByRole("button", { name: "Not today", exact: true }).click();
        await nudge.waitFor({ state: "detached" });
      }
      // Once a day: it stays away until tomorrow.
      engine = await openEngine(page);
      await engine.getByRole("textbox", { name: "Quick add", exact: true }).waitFor();
      await page.waitForTimeout(300);
      assert.equal(await engine.locator('[data-nudge="room"]').count(), 0, "not again today");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false, "no sideways scroll");
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally {
    await h.stop();
  }
  console.log("room: near the sync limit the Engine says so once a day, and Settings shows what takes room");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
