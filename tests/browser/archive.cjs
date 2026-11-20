// Archive old months (5.91.0). With sync on, Settings › Your data moves a month
// you are done with to your server: its days leave the planner but keep their
// light record (here, the mood). The Calendar says the month and the day are
// in your archive, and Bring back joins them again; every step syncs.
const assert = require("node:assert/strict");
const { start, fixture } = require("./harness.cjs");

const read = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("debug-day:v2")));
const synced = (page) => page.waitForFunction(() => document.querySelector(".dd-cloud-mini")?.dataset.status === "synced", null, { timeout: 15000 });
const server = (h) => JSON.parse(h.sql.prepare("SELECT data FROM planner WHERE id = 1").get().data);

(async () => {
  for (const mobile of [false, true]) {
    const h = await start();
    try {
      const { context, page, errors } = await h.context(mobile);
      page.setDefaultTimeout(15000);
      await page.clock.install({ time: new Date("2026-11-20T12:00:00+03:30") });
      const f = await fixture(page, h.origin);
      const day = (date, extra) => ({ date, blocks: [], notes: [], bugs: [], ...extra });
      f.data.days["2026-08-02"] = day("2026-08-02", { blocks: [{ id: "ink", name: "Ink the cover", done: true, subtasks: [] }] });
      f.data.days["2026-08-03"] = day("2026-08-03", { mood: "🙂", notes: [{ id: "idea", kind: "sticky", text: "Blue sky study" }] });
      await page.evaluate(({ d, origin }) => {
        localStorage.setItem("debug-day:v2", JSON.stringify(d));
        localStorage.setItem("debug-day:cloud-config", JSON.stringify({ url: origin, key: "s".repeat(64) }));
        localStorage.setItem("debug-day:review-calendar", JSON.stringify("gregory"));
        localStorage.setItem("debug-day:calendar-mode", JSON.stringify("month"));
      }, { d: f.data, origin: h.origin });
      await page.reload();
      await page.waitForSelector(".views", { state: "attached" });
      await synced(page);

      // Settings › Your data offers August (this month and last month stay).
      await page.locator("button", { hasText: "Settings" }).last().click();
      const box = page.locator("[data-archive]");
      const august = box.locator('[data-archive-month="2026-08-01"]');
      await august.waitFor();
      await box.scrollIntoViewIfNeeded();
      assert.match(await box.innerText(), /Archive old months[\s\S]*Habits keep their record/);
      assert.equal(await august.locator(".dd-copy-when").innerText(), "August 2026");
      assert.match(await august.locator("small").innerText(), /^2 days · \d+ KB$/);
      assert.equal(await box.locator("[data-archive-month]").count(), 1, "only months before last month");

      // Archive asks first, then moves the month to the server.
      await august.getByRole("button", { name: "Archive August 2026", exact: true }).click();
      const confirm = august.getByRole("group", { name: "Archive this month?" });
      assert.match(await confirm.innerText(), /won't show in the Calendar, search or the week's look back until you bring them back/);
      await confirm.getByRole("button", { name: "Archive this month", exact: true }).click();
      await page.waitForFunction(() => {
        const d = JSON.parse(localStorage.getItem("debug-day:v2"));
        return !d.days["2026-08-02"] && d.setup.archive?.length === 1;
      });
      const after = await read(page);
      assert.equal(after.days["2026-08-03"].mood, "🙂", "the light record stays");
      assert.deepEqual(after.days["2026-08-03"].notes, [], "the rest waits on the server");
      assert.equal(after.setup.archive[0].label, "August 2026");
      const rows = h.sql.prepare("SELECT id, days FROM planner_archive").all();
      assert.equal(rows.length, 1);
      assert.equal(rows[0].days, 2);
      await page.waitForFunction(() => /August 2026 is in your archive/.test(document.body.innerText));
      await synced(page);
      await page.waitForTimeout(400);
      assert.equal(server(h).setup.archive.length, 1, "the archive list synced");
      assert.equal(server(h).days["2026-08-02"], undefined);
      const kept = box.locator(`[data-archive-month="${rows[0].id}"]`);
      await kept.getByRole("button", { name: "Bring back August 2026", exact: true }).waitFor();
      assert.match(await box.innerText(), /Nothing to archive yet/);

      // The Calendar says so on the month and on the day, and brings it back.
      await page.locator('.views button[data-panel="calendar"]').click();
      const prev = page.getByRole("button", { name: "Previous month", exact: true });
      for (let i = 0; i < 3; i++) await prev.click();
      const monthNote = page.locator('[data-archived-note="month"]');
      await monthNote.waitFor();
      assert.match(await monthNote.innerText(), /August 2026 is in your archive/);
      await page.locator('[data-review-date="2026-08-02"]').click();
      const dayNote = page.locator('[data-archived-note="day"]');
      await dayNote.waitFor();
      assert.match(await dayNote.innerText(), /This day is in your archive/);
      if (mobile) assert.ok((await dayNote.getByRole("button").boundingBox()).height >= 44, "a finger-sized button");
      await dayNote.getByRole("button", { name: "Bring back August 2026", exact: true }).click();
      await page.waitForFunction(() => {
        const d = JSON.parse(localStorage.getItem("debug-day:v2"));
        return d.days["2026-08-02"]?.blocks?.length === 1 && !d.setup.archive;
      });
      const back = await read(page);
      assert.equal(back.days["2026-08-02"].blocks[0].name, "Ink the cover");
      assert.equal(back.days["2026-08-03"].notes[0].text, "Blue sky study");
      assert.equal(back.days["2026-08-03"].mood, "🙂");
      await page.waitForFunction(() => /August 2026 is back/.test(document.body.innerText));
      assert.equal(await page.locator("[data-archived-note]").count(), 0, "the notes go");
      await synced(page);
      await page.waitForTimeout(400);
      assert.equal(server(h).days["2026-08-02"].blocks[0].name, "Ink the cover", "the month synced back");
      assert.equal(server(h).setup.archive, undefined);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false, "no sideways scroll");
      assert.deepEqual(errors, []);
      await context.close();
    } finally {
      await h.stop();
    }
  }
  console.log("archive: a month moves to the server, the Calendar says so, and it comes back, synced");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
