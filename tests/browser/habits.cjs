const assert = require("node:assert/strict");
const { start, fixture } = require("./harness.cjs");
// Habits and feelings live in their own Board sections and stay in sync with Plan.
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

    // Board: Feelings and Habits sections, no old feelings box underneath.
    await page.locator(".views button").nth(1).click();
    await page.locator('[data-board-id="section:habits"]').waitFor();
    assert.equal(await page.locator('[data-section-id="bugs"]').count(), 0);
    assert.equal(await page.locator('[data-board-id="habit:write"]').getAttribute("data-level"), "2");
    await page.locator(`[data-board-id="habit:${stretch.id}"] .b4-node-body`).click();
    await page.locator(".dd-habit-details .dd-habit-tick").click();
    assert.deepEqual((await today()).habits[stretch.id], { done: true });

    // Feelings: the panel uses the Plan words; drop on a card links it.
    const feeling = page.locator('[data-board-id="bug:f2"]');
    await feeling.locator(".b4-node-body").click();
    await page.locator(".dd-feeling-details").waitFor();
    await page.locator(".dd-feeling-topics button", { hasText: "Plans & time" }).click();
    assert.equal((await today()).bugs.find((b) => b.id === "f2").category, "plan");
    async function drag(from, to) {
      const a = await from.boundingBox(), b = await to.boundingBox();
      await page.mouse.move(a.x + a.width / 2, a.y + 12);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
      await page.mouse.up();
    }
    await drag(feeling.locator(".b4-node-body"), page.locator('[data-board-id="b:long"]'));
    await page.waitForFunction((date) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date].bugs.find((b) => b.id === "f2").blockId === "long", f.date);

    // Lanes: drop a card into Habits and it becomes a habit.
    await page.locator(".b4-modes button").nth(1).click();
    await page.locator('[data-board-id="section:habits"]').waitFor();
    await page.waitForTimeout(700);
    await drag(page.locator('[data-board-id="b:long"] .b4-node-body'), page.locator('[data-board-id="section:habits"]'));
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("debug-day:v2")).setup.habits.some((x) => x.name === "Long research"));
    assert.ok(!(await today()).blocks.some((b) => b.id === "long"));
    const made = (await read()).setup.habits.find((x) => x.name === "Long research");
    assert.equal(made.emo, "sticker:studio");
    await page.locator(`[data-board-id="habit:${made.id}"]`).waitFor();

    // Back in Plan, everything from the Board is there.
    await page.locator(".views button").nth(0).click();
    await panel.waitFor();
    assert.equal(await panel.locator(`[data-habit-id="${stretch.id}"] .dd-habit-tick`).getAttribute("aria-pressed"), "true");
    assert.equal(await panel.locator(`[data-habit-id="${made.id}"]`).count(), 1);
    await panel.locator(`[data-habit-id="${made.id}"] [data-symbol="sticker:studio"] svg`).waitFor();

    // Settings: the minutes for each level can change.
    await page.locator("button", { hasText: "Settings" }).last().click();
    const good = page.locator("#dd-habits-prefs .dd-habit-levels input").first();
    await good.fill("10");
    assert.equal((await read()).setup.preferences.habitLevels.good, 10);

    // A reload keeps habits, logs and levels.
    await page.reload();
    await page.waitForSelector(".app", { state: "attached" });
    const after = await read();
    assert.equal(after.setup.habits.length, 3);
    assert.equal(after.days[f.date].habits.write.min, 20);
    assert.equal(after.setup.preferences.habitLevels.good, 10);

    assert.deepEqual(errors, []);
    console.log("Habits and feelings sections passed");
    await page.context().close();
  } finally {
    await h.stop();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
