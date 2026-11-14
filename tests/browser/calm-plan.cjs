// 5.42: a calm Plan. One line per task (no hour bar), steps open only when
// asked, and day tools with nothing in them wait behind "…".
const assert = require("node:assert/strict");
const { start, fixture, openEngine } = require("./harness.cjs");
(async () => {
  const h = await start();
  try {
    const { page, context, errors } = await h.context(false);
    page.setDefaultTimeout(8000);
    const f = await fixture(page, h.origin);
    f.data.days[f.date].blocks.push({ id: "plain", name: "Quick sketch", type: "writing", lane: "work", min: 30, done: false, subtasks: [], expanded: true });
    await page.evaluate((d) => localStorage.setItem("debug-day:v2", JSON.stringify(d)), f.data);
    await page.reload();
    await page.waitForSelector(".views", { state: "attached" });
    const read = () => page.evaluate((date) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date], f.date);
    // One line per task.
    await openEngine(page);
    assert.equal(await page.locator(".dd-engine .duration-scroll").count(), 0, "no hour bar under tasks");
    assert.equal(await page.locator(".dd-engine .time-sample").count(), 0);
    const plain = page.locator('.dd-engine [data-engine-task="plain"]');
    assert.equal(await plain.locator(".dd-engine-steps").count(), 0, "a task without steps is one line, even if it was left open");
    // Steps open when asked; Esc closes the field again.
    await plain.locator(".dd-engine-steps-toggle").click();
    const field = page.getByRole("textbox", { name: "New step in Quick sketch" });
    await field.waitFor();
    assert.equal(await field.evaluate((el) => el === document.activeElement), true, "the step field is ready to type");
    await field.press("Escape");
    assert.equal(await plain.locator(".dd-engine-steps").count(), 0, "Esc closes it and nothing is made");
    assert.equal((await read()).blocks.find((b) => b.id === "plain").subtasks.length, 0);
    await plain.locator(".dd-engine-steps-toggle").click();
    await field.fill("Rough lines");
    await field.press("Enter");
    await page.waitForFunction((date) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date].blocks.find((b) => b.id === "plain").subtasks.length === 1, f.date);
    assert.equal(await field.isVisible(), true, "the field stays open for the next step");
    await field.press("Escape");
    await plain.locator(".dd-engine-steps").waitFor({ state: "detached" });
    assert.match(await plain.locator(".dd-engine-steps-toggle").innerText(), /0\/1 steps[\s\S]*Rough lines/, "the next step stays in sight");
    await page.keyboard.press("Escape");
    await page.locator(".dd-engine").waitFor({ state: "detached" });
    // The day tools of the old Engine page wait in the Board's top ⋯ (5.67):
    // a day template and worry parking.
    await page.locator('[data-dock-more="top"]').click();
    const menu = page.getByRole("menu", { name: "Board context menu" });
    await menu.getByRole("menuitem", { name: "Day template", exact: true }).click();
    await menu.getByRole("menuitem", { name: "Save this day as a template", exact: true }).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("debug-day:v2")).setup.templates.length >= 2);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("debug-day:v2")));
    const made = saved.setup.templates.at(-1);
    assert.equal(saved.days[f.date].tpl, made.id, "the day uses the new template");
    assert.ok(made.blocks.length > 0 && made.blocks.every((b) => !b.done));
    // Using a template puts its tasks into the day's lanes.
    await page.locator('[data-dock-more="top"]').click();
    await menu.getByRole("menuitem", { name: "Day template", exact: true }).click();
    await menu.getByRole("menuitem", { name: new RegExp("^" + saved.setup.templates[0].name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " ·") }).click();
    await page.waitForFunction(([date, id]) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date].tpl === id, [f.date, saved.setup.templates[0].id]);
    await page.locator('[data-dock-more="top"]').click();
    await menu.getByRole("menuitem", { name: "Worry parking", exact: true }).click();
    await page.getByRole("dialog", { name: /Worry/ }).waitFor();
    assert.deepEqual(errors, []);
    await context.close();
    console.log("calm plan: one line per task, steps on demand, quiet day tools");
  } finally {
    await h.stop();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
