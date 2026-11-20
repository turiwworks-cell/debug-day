// Copies on your server (5.90.0). With sync on, the first change of a new day
// keeps the planner as it was before it. Settings › Your data lists the copies:
// one downloads as a backup file, and Restore brings it back like an import
// (a recovery copy of how things are now is saved first), then syncs.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { start, fixture, openEngine } = require("./harness.cjs");

const read = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("debug-day:v2")));
const synced = (page) => page.waitForFunction(() => document.querySelector(".dd-cloud-mini")?.dataset.status === "synced", null, { timeout: 15000 });
const has = (data, date, name) => (data.days[date]?.blocks || []).some((b) => b.name === name);

(async () => {
  for (const mobile of [false, true]) {
    const h = await start();
    try {
      const { context, page, errors } = await h.context(mobile);
      page.setDefaultTimeout(15000);
      const f = await fixture(page, h.origin);
      await page.evaluate(({ d, origin }) => {
        localStorage.setItem("debug-day:v2", JSON.stringify(d));
        localStorage.setItem("debug-day:cloud-config", JSON.stringify({ url: origin, key: "s".repeat(64) }));
      }, { d: f.data, origin: h.origin });
      await page.reload();
      await page.waitForSelector(".views", { state: "attached" });
      await synced(page);

      // The server last saved yesterday. Today's first change keeps that planner.
      const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      h.sql.prepare("UPDATE planner SET updated_at = ? WHERE id = 1").run(yesterday + "T12:00:00.000Z");
      const engine = await openEngine(page);
      const quick = engine.getByRole("textbox", { name: "Quick add", exact: true });
      await quick.fill("Wash the brushes");
      await quick.press("Enter");
      await page.waitForFunction((date) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date].blocks.some((b) => b.name === "Wash the brushes"), f.date);
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => document.querySelector(".dd-cloud-mini")?.dataset.status === "synced" && !document.querySelector(".dd-engine"));
      await page.waitForTimeout(300);
      await synced(page);
      const kept = h.sql.prepare("SELECT day, data FROM planner_daily").all();
      assert.deepEqual(kept.map((r) => r.day), [yesterday], "one copy, of the day before");
      assert.equal(has(JSON.parse(kept[0].data), f.date, "Wash the brushes"), false, "as it was before today's change");

      // Settings › Your data lists it.
      await page.locator("button", { hasText: "Settings" }).last().click();
      const copies = page.locator("[data-server-copies]");
      await copies.locator(`[data-server-copy="day-${yesterday}"]`).waitFor();
      await copies.scrollIntoViewIfNeeded();
      assert.match(await copies.innerText(), /Copies on your server[\s\S]*last 30 days[\s\S]*Download[\s\S]*Restore/);
      assert.match(await copies.locator(".dd-copy-recent summary").innerText(), /^Last (save|\d+ saves)$/);
      const row = copies.locator(`[data-server-copy="day-${yesterday}"]`);
      assert.match(await row.locator("small").innerText(), /^\d+ KB$/);

      // Download: a backup file of that copy.
      const [file] = await Promise.all([page.waitForEvent("download"), row.getByRole("button", { name: /^Download the copy from / }).click()]);
      assert.equal(file.suggestedFilename(), `debug-day-server-${yesterday}.json`);
      const saved = JSON.parse(fs.readFileSync(await file.path(), "utf8"));
      assert.equal(saved.app, "debug-day");
      assert.equal(has(saved, f.date, "Wash the brushes"), false);
      assert.ok(saved.setup && saved.days[f.date], "a whole planner");

      // Restore asks first, then brings the copy back and syncs it.
      await row.getByRole("button", { name: /^Restore the copy from / }).click();
      const confirm = row.getByRole("group", { name: "Restore this copy?" });
      assert.match(await confirm.innerText(), /Your setup and the days in it come back; days added since then stay\. A recovery copy of how things are now is saved in this browser first\./);
      await confirm.getByRole("button", { name: "Restore this copy", exact: true }).click();
      await page.waitForFunction((date) => !JSON.parse(localStorage.getItem("debug-day:v2")).days[date].blocks.some((b) => b.name === "Wash the brushes"), f.date);
      const recovery = await page.evaluate(() => JSON.parse(localStorage.getItem("debug-day:recovery") || "[]"));
      assert.equal(has(recovery[0].data, f.date, "Wash the brushes"), true, "how things were is kept in this browser");
      await page.waitForFunction(() => /Copy restored/.test(document.body.innerText));
      await synced(page);
      await page.waitForTimeout(400);
      const server = JSON.parse(h.sql.prepare("SELECT data FROM planner WHERE id = 1").get().data);
      assert.equal(has(server, f.date, "Wash the brushes"), false, "the restored planner synced");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false, "no sideways scroll");
      if (mobile) {
        const box = await row.getByRole("button", { name: /^Download the copy from / }).boundingBox();
        assert.ok(box.height >= 44, "a finger-sized button");
      }
      assert.deepEqual(errors, []);
      await context.close();
    } finally {
      await h.stop();
    }
  }
  console.log("server copies: a daily copy is kept, listed, downloaded and restored, then synced");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
