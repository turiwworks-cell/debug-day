const assert = require("node:assert/strict");
const { start, fixture } = require("./harness.cjs");
// Habits live in their own Board section and stay in sync with Plan.
(async () => {
  const h = await start();
  try {
    const { page, errors } = await h.context(false);
    page.setDefaultTimeout(8000);
    const f = await fixture(page, h.origin);
    await page.evaluate((f) => {
      const data = f.data,
        shift = (n) => {
          const d = new Date(f.date + "T12:00:00Z");
          d.setUTCDate(d.getUTCDate() - n);
          return d.toISOString().slice(0, 10);
        };
      data.setup.habits = [{ id: "write", name: "Writing", emo: "", color: "#E2683C" }];
      data.days[f.date].blocks.find(b => b.id === "long").emo = "sticker:studio";
      for (const [n, min] of [[1, 10], [2, 40], [3, 0]]) {
        const date = shift(n);
        data.days[date] = data.days[date] || { date, blocks: [], bugs: [], notes: [] };
        data.days[date].habits = { write: min ? { done: true, min } : { done: true } };
      }
      data.days[f.date].bugs.push({ id: "f2", text: "Tired after lunch", type: "", on: "", fixed: false, category: "energy", triggerTag: "", antidote: "" });
      localStorage.setItem("debug-day:v2", JSON.stringify(data));
      localStorage.setItem("debug-day:board-view:" + f.date, JSON.stringify({ camera: { x: 24, y: 20, z: 0.6 }, mode: "mindmap" }));
    }, f);
    await page.reload();
    await page.waitForSelector("#qa", { state: "attached" });
    const read = () => page.evaluate(() => JSON.parse(localStorage.getItem("debug-day:v2")));
    const today = async () => (await read()).days[f.date];

    // Plan: tick + minutes, levels and the last two weeks.
    const panel = page.locator(".dd-habits");
    const writing = panel.locator('[data-habit-id="write"]');
    await writing.locator(".dd-habit-tick").click();
    assert.deepEqual((await today()).habits.write, { done: true });
    assert.equal(await writing.locator(".dd-habit-level").innerText(), "Done");
    await writing.locator(".dd-habit-min input").fill("20");
    assert.deepEqual((await today()).habits.write, { done: true, min: 20 });
    assert.equal(await writing.locator(".dd-habit-level").innerText(), "Good");
    assert.equal(await writing.locator(".dd-habit-strip i").count(), 14);
    assert.equal(await writing.locator('.dd-habit-strip i[data-level="3"]').count(), 1, "40 minutes is 'enough'");
    await writing.locator(".dd-habit-name").click();
    assert.match(await writing.locator(".dd-habit-sum").innerText(), /4 days/);
    await panel.locator(".dd-habit-add input").fill("Stretch");
    await panel.locator(".dd-habit-add button").click();
    const stretch = (await read()).setup.habits.find((x) => x.name === "Stretch");
    assert.ok(stretch);

    // Board: habits live in the rail beside the board, not in a section under the Engine.
    await page.locator(".views button").nth(1).click();
    await page.locator('[data-board-id="section:engine"]').waitFor();
    assert.equal(await page.locator('[data-board-id="section:habits"]').count(), 0);
    assert.equal(await page.locator('[data-board-id^="habit:"]').count(), 0);
    assert.equal(await page.locator('[data-section-id="bugs"]').count(), 0);
    // Feelings were removed (5.16): no feeling cards on the Board.
    assert.equal(await page.locator('[data-board-id="bug:f2"]').count(), 0);

    // Back in Plan, everything is still there.
    await page.locator(".views button").nth(0).click();
    await panel.waitFor();
    assert.equal(await panel.locator(`[data-habit-id="${stretch.id}"]`).count(), 1);

    // Settings: the minutes for each level can change.
    await page.locator("button", { hasText: "Settings" }).last().click();
    const good = page.locator("#dd-habits-prefs .dd-habit-levels input").first();
    await good.fill("10");
    assert.equal((await read()).setup.preferences.habitLevels.good, 10);

    // A reload keeps habits, logs and levels.
    await page.reload();
    await page.waitForSelector(".app", { state: "attached" });
    const after = await read();
    assert.equal(after.setup.habits.length, 2);
    assert.equal(after.days[f.date].habits.write.min, 20);
    assert.equal(after.setup.preferences.habitLevels.good, 10);

    assert.deepEqual(errors, []);
    console.log("Habits section passed");
    await page.context().close();
  } finally {
    await h.stop();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
