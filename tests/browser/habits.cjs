const assert = require("node:assert/strict");
const { start, fixture } = require("./harness.cjs");
// Habits live beside the Board ("Today's habits"), with their settings right there (5.67).
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
    await page.waitForSelector(".views", { state: "attached" });
    const read = () => page.evaluate(() => JSON.parse(localStorage.getItem("debug-day:v2")));
    const today = async () => (await read()).days[f.date];

    // Board: habits live in the rail beside the board ("Today's habits"), not in a
    // section and not on an Engine page (gone in 5.67).
    await page.locator(".views button[data-panel=board]").click();
    await page.locator('[data-board-id="section:engine"]').waitFor();
    assert.equal(await page.locator('[data-board-id="section:habits"]').count(), 0);
    assert.equal(await page.locator('[data-board-id^="habit:"]').count(), 0);
    assert.equal(await page.locator('[data-section-id="bugs"]').count(), 0);
    // Feelings were removed (5.16): no feeling cards on the Board.
    assert.equal(await page.locator('[data-board-id="bug:f2"]').count(), 0);
    await page.locator('[data-rail-toggle="habits"]').click();
    const panel = page.locator("#dd-rail-habits");
    await panel.waitFor();

    // Tick + minutes, levels and the last weeks.
    const writing = panel.locator('[data-rail-habit="write"]');
    await writing.locator(".dd-habit-tick").click();
    assert.deepEqual((await today()).habits.write, { done: true });
    assert.equal(await writing.locator(".dd-habit-level").innerText(), "Done");
    await writing.locator(".dd-habit-min input").fill("20");
    assert.deepEqual((await today()).habits.write, { done: true, min: 20 });
    assert.equal(await writing.locator(".dd-habit-level").innerText(), "Good");
    await writing.locator(".dd-rail-heading").click();
    assert.match(await writing.locator(".dd-habit-sum").innerText(), /4 days/);
    await writing.locator(".dd-rail-heading").click();

    // Habit settings sit right there, small: the pencil opens name, colour, goal,
    // remove and a field for a new habit.
    await panel.getByRole("button", { name: "Edit habits", exact: true }).click();
    await panel.getByRole("textbox", { name: "New habit", exact: true }).fill("Stretch");
    await panel.getByRole("button", { name: "Add", exact: true }).click();
    const stretch = (await read()).setup.habits.find((x) => x.name === "Stretch");
    assert.ok(stretch);
    const manage = panel.locator(".dd-habit-manage");
    await manage.getByRole("textbox", { name: "Name of Writing", exact: true }).fill("Writing pages");
    assert.equal((await read()).setup.habits[0].name, "Writing pages");
    const goal = manage.getByRole("spinbutton", { name: "Daily goal in minutes for Writing pages", exact: true });
    assert.equal(await goal.inputValue(), "30", "without its own goal a habit starts at 30 minutes");
    await goal.fill("60");
    await goal.press("Enter");
    assert.equal((await read()).setup.habits[0].goal, 60);
    await manage.getByRole("button", { name: "Remove Stretch", exact: true }).click();
    assert.equal((await read()).setup.habits.length, 2, "the first click only asks");
    await manage.getByRole("button", { name: "Confirm removing Stretch", exact: true }).click();
    assert.equal((await read()).setup.habits.length, 1);
    await panel.getByRole("button", { name: "Done editing habits", exact: true }).click();

    // Labels follow each habit's goal: with a 60 minute goal, 40 minutes is "good", not "enough".
    const pages = panel.locator('[data-rail-habit="write"]');
    assert.equal(await pages.locator(".dd-rail-heading").innerText(), "Writing pages");
    await pages.locator(".dd-habit-min input").fill("40");
    assert.equal(await pages.locator(".dd-habit-level").innerText(), "Good");
    await pages.locator(".dd-habit-min input").fill("60");
    assert.equal(await pages.locator(".dd-habit-level").innerText(), "Enough");
    await pages.locator(".dd-habit-min input").fill("120");
    assert.equal(await pages.locator(".dd-habit-level").innerText(), "Too much");
    await pages.locator(".dd-habit-min input").fill("20");

    // Settings: no habits section and no language choice; the technical parts wait under Advanced.
    await page.locator("button", { hasText: "Settings" }).last().click();
    assert.equal(await page.locator("#dd-habits-prefs").count(), 0);
    assert.equal(await page.getByRole("combobox", { name: "UI language", exact: true }).count(), 0);
    await page.locator("#dd-data").waitFor();
    assert.ok((await page.locator("#dd-data").innerText()).includes("On this device"));
    assert.equal(await page.getByRole("textbox", { name: "Server URL", exact: true }).isVisible(), false);
    await page.locator("#dd-advanced > summary").click();
    assert.equal(await page.getByRole("textbox", { name: "Server URL", exact: true }).isVisible(), true);
    assert.equal(await page.getByRole("textbox", { name: "MCP endpoint", exact: true }).isVisible(), true);

    // A reload keeps habits, logs and goals. A saved Persian UI choice now shows English.
    await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem("debug-day:v2"));
      data.setup.preferences.language = "fa";
      localStorage.setItem("debug-day:v2", JSON.stringify(data));
    });
    await page.reload();
    await page.waitForSelector(".app", { state: "attached" });
    const after = await read();
    assert.equal(after.setup.habits.length, 1);
    assert.equal(after.setup.habits[0].goal, 60);
    assert.equal(after.days[f.date].habits.write.min, 20);
    assert.equal(await page.evaluate(() => [document.documentElement.lang, document.documentElement.dir].join()), "en,ltr");
    assert.ok(!(await page.locator(".views").innerText()).includes("Engine"), "no Engine page");
    assert.ok((await page.locator(".views").innerText()).includes("Board"));

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
