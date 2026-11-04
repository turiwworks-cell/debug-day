// 5.42: a calm Plan. One line per task (no hour bar), steps open only when
// asked, and day tools with nothing in them wait behind "…".
const assert = require("node:assert/strict");
const { start, fixture } = require("./harness.cjs");
(async () => {
  const h = await start();
  try {
    const { page, context, errors } = await h.context(false);
    page.setDefaultTimeout(8000);
    const f = await fixture(page, h.origin);
    f.data.days[f.date].blocks.push({ id: "plain", name: "Quick sketch", type: "writing", lane: "work", min: 30, done: false, subtasks: [], expanded: true });
    await page.evaluate((d) => localStorage.setItem("debug-day:v2", JSON.stringify(d)), f.data);
    await page.reload();
    await page.waitForSelector("#qa", { state: "attached" });
    const read = () => page.evaluate((date) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date], f.date);
    // One line per task.
    assert.equal(await page.locator("#plan .duration-scroll").count(), 0, "no hour bar under tasks");
    assert.equal(await page.locator("#plan .time-sample").count(), 0);
    const plain = page.locator('#plan .item[data-block-id="plain"]');
    assert.equal(await plain.locator(".subtree").count(), 0, "a task without steps is one line, even if it was left open");
    assert.equal(await plain.locator(".ty").isVisible(), false, "the kind of work is not repeated on every row");
    // Steps open when asked; Esc closes the field again.
    await plain.locator(".tree-btn").click();
    const field = page.getByRole("textbox", { name: "Add sub-step to Quick sketch" });
    await field.waitFor();
    assert.equal(await field.evaluate((el) => el === document.activeElement), true, "the step field is ready to type");
    await field.press("Escape");
    assert.equal(await plain.locator(".subtree").count(), 0, "Esc closes it and nothing is made");
    assert.equal((await read()).blocks.find((b) => b.id === "plain").subtasks.length, 0);
    await plain.locator(".tree-btn").click();
    await field.fill("Rough lines");
    await field.press("Enter");
    await page.waitForFunction((date) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date].blocks.find((b) => b.id === "plain").subtasks.length === 1, f.date);
    assert.equal(await field.isVisible(), true, "the field stays open for the next step");
    await field.press("Escape");
    await plain.locator(".subtree .dd-add-step").waitFor();
    assert.equal(await plain.getByText("Rough lines").count() + await plain.locator('textarea.subnode-input').count() > 0, true, "the step stays in sight");
    // Day tools with nothing in them wait behind "…".
    const tools = page.locator("main > .dayline");
    assert.equal(await tools.getByRole("button", { name: "Worry parking" }).isVisible(), false);
    assert.equal(await tools.getByRole("button", { name: "Later tray" }).isVisible(), false);
    assert.equal(await tools.getByRole("button", { name: "Life happened" }).isVisible(), false);
    assert.equal(await tools.locator(".dchip", { hasText: "Template" }).isVisible(), false, "one template needs no chip");
    await tools.getByRole("button", { name: "More day tools" }).click();
    for (const name of ["Worry parking", "Later tray", "Life happened"])
      assert.equal(await tools.getByRole("button", { name }).isVisible(), true, name + " shows after …");
    assert.equal(await tools.locator(".dchip", { hasText: "Template" }).isVisible(), true);
    await tools.getByRole("button", { name: "Fewer day tools" }).click();
    assert.equal(await tools.getByRole("button", { name: "Later tray" }).isVisible(), false);
    // A day without stickers shows only a small add button in the Plan's header.
    assert.equal(await page.locator("#plan .time-key .dd-day-stickers.is-empty .dd-sticker-add").isVisible(), true);
    assert.equal(await page.getByText("A little you, in your day").count(), 0);
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
