// Carrying a task on (5.86.2, L3 and L4): yesterday's open task comes into
// today as the same task carried on, its done steps still done, and yesterday
// marks it carried on, so its Progress no longer counts it as left undone. The
// morning routine does the same once a day on every device, and with sync on
// it waits for the first sync before it runs.
const assert = require("node:assert/strict");
const { start, fixture, openEngine } = require("./harness.cjs");

const read = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("debug-day:v2")));
const ink = (extra = {}) => ({
  id: "ink", name: "Ink the pages", type: "", lane: "work", min: 90, pri: 0, emo: "", note: "", done: false, expanded: true,
  subtasks: [
    { id: "s1", text: "Pencils", done: true, expanded: true, children: [] },
    { id: "s2", text: "Inks", done: false, expanded: true, children: [] },
  ],
  ...extra,
});
const email = { id: "email", name: "Email the printer", type: "", lane: "work", min: 15, pri: 0, emo: "", note: "", done: true, expanded: false, subtasks: [] };

(async () => {
  const h = await start();
  try {
    for (const mobile of [false, true]) {
      const { context, page, errors } = await h.context(mobile);
      const f = await fixture(page, h.origin);
      f.data.days[f.last] = { ...f.data.days[f.last], date: f.last, blocks: [ink(), email] };
      f.data.days[f.date].blocks = [];
      await page.evaluate((d) => localStorage.setItem("debug-day:v2", JSON.stringify(d)), f.data);
      await page.reload();
      await page.waitForSelector(".views", { state: "attached" });

      // The Engine offers it; "Bring it" carries it on.
      const engine = await openEngine(page);
      const carry = engine.locator(".dd-engine-carry");
      await carry.waitFor();
      assert.match(await carry.innerText(), /1 still open from[\s\S]*Ink the pages/);
      await carry.getByRole("button", { name: "Bring it", exact: true }).click();
      await page.waitForFunction((date) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date].blocks.some((b) => b.name === "Ink the pages"), f.date);
      await page.waitForFunction((date) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date].blocks.find((b) => b.id === "ink")?.carriedTo, f.last);
      let data = await read(page);
      const brought = data.days[f.date].blocks.find((b) => b.name === "Ink the pages");
      assert.equal(brought.id, "c" + f.date.replace(/-/g, "") + "-ink");
      assert.deepEqual(brought.carriedFrom, { date: f.last, id: "ink" });
      assert.deepEqual(brought.subtasks.map((s) => s.done), [true, false], "a done step stays done");
      assert.equal(data.days[f.last].blocks.find((b) => b.id === "ink").carriedTo, f.date, "yesterday marks it carried on");
      assert.equal(data.days[f.last].blocks.find((b) => b.id === "ink").done, false, "and keeps it as it was");
      await carry.waitFor({ state: "detached" });
      await page.keyboard.press("Escape");
      await page.locator(".dd-engine").waitFor({ state: "detached" });

      // A reload keeps it carried on: nothing is offered again.
      await page.reload();
      await page.waitForSelector(".views", { state: "attached" });
      data = await read(page);
      assert.equal(data.days[f.last].blocks.find((b) => b.id === "ink").carriedTo, f.date);
      assert.equal(data.days[f.date].blocks.filter((b) => b.name === "Ink the pages").length, 1);
      const again = await openEngine(page);
      assert.equal(await again.locator(".dd-engine-carry").count(), 0, "the carry line does not come back");
      await page.keyboard.press("Escape");
      await page.locator(".dd-engine").waitFor({ state: "detached" });

      // Yesterday in the Calendar: done is everything that stayed (100%), and
      // the carried task says where it went.
      await page.locator('.views button[data-panel="calendar"]').click();
      const cell = page.locator(`[data-review-date="${f.last}"]`);
      await cell.waitFor();
      await cell.click();
      await page.waitForFunction(() => document.querySelector(".dd-day-progress")?.dataset.completion === "100");
      const row = page.locator('.dd-review-task[data-review-task="ink"]');
      await row.waitFor();
      assert.match(await row.getAttribute("class"), /carried/);
      assert.match(await row.locator(".dd-review-minutes").innerText(), /^→ /);
      assert.deepEqual(errors, []);
      await context.close();
    }

    // The routine brings it by itself once a day, after the first sync.
    {
      const { context, page, errors } = await h.context(false);
      const f = await fixture(page, h.origin);
      f.data.days[f.last] = { ...f.data.days[f.last], date: f.last, blocks: [ink(), email] };
      f.data.days[f.date].blocks = [];
      f.data.setup.preferences = { ...f.data.setup.preferences, routine: { leftovers: "bring" } };
      let release, synced = new Promise((resolve) => (release = resolve));
      await page.route("**/api/sync", async (route) => {
        if (route.request().method() === "GET") {
          await synced;
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ revision: 0, data: null }) });
        }
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ revision: 1 }) });
      });
      await page.evaluate(({ d, origin }) => {
        localStorage.setItem("debug-day:v2", JSON.stringify(d));
        localStorage.setItem("debug-day:cloud-config", JSON.stringify({ url: origin, key: "s".repeat(64) }));
        localStorage.removeItem("debug-day:routine-ran");
      }, { d: f.data, origin: h.origin });
      await page.reload();
      await page.waitForSelector(".views", { state: "attached" });
      await page.waitForTimeout(1500);
      let data = await read(page);
      assert.equal(data.days[f.date].blocks.length, 0, "it waits for the first sync");
      release();
      await page.waitForFunction((date) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date]?.blocks.some((b) => b.name === "Ink the pages"), f.date);
      data = await read(page);
      assert.equal(data.setup.preferences.routine.ran, f.date, "the day it ran syncs with the routine");
      assert.equal(data.days[f.last].blocks.find((b) => b.id === "ink").carriedTo, f.date);
      assert.deepEqual(data.days[f.date].blocks.find((b) => b.name === "Ink the pages").subtasks.map((s) => s.done), [true, false]);
      // Another device that already sees "ran" today does nothing: a fresh
      // load here, without this device's own note, adds nothing either.
      await page.evaluate(() => localStorage.removeItem("debug-day:routine-ran"));
      await page.reload();
      await page.waitForSelector(".views", { state: "attached" });
      await page.waitForTimeout(800);
      data = await read(page);
      assert.equal(data.days[f.date].blocks.filter((b) => b.name === "Ink the pages").length, 1, "once a day");
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log("carry on: done steps stay, yesterday lets it go, the routine runs once after sync");
  } finally {
    await h.stop();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
