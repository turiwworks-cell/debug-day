const assert = require("node:assert/strict");
const { start, fixture, openEngine } = require("./harness.cjs");
// Not everything has hours: counted cards ("3x") and waiting cards, in Plan and Board.
(async () => {
  const h = await start();
  try {
    const { page, errors } = await h.context(false);
    page.setDefaultTimeout(8000);
    const f = await fixture(page, h.origin);
    await page.evaluate((f) => localStorage.setItem("debug-day:v2", JSON.stringify(f.data)), f);
    await page.reload();
    await page.waitForSelector(".views", { state: "attached" });
    const read = () =>
      page.evaluate((date) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date], f.date);
    const card = async (name) => (await read()).blocks.find((b) => b.name === name);

    // Quick add (in the Engine, over the Board) understands "3x" and the ⏳ sign.
    const quick = (await openEngine(page)).getByRole("textbox", { name: "Quick add", exact: true });
    await quick.fill("Call the printer 3x");
    await quick.press("Enter");
    await quick.fill("⏳ Reply from client");
    await quick.press("Enter");
    const counted = await card("Call the printer"),
      waiting = await card("Reply from client");
    assert.equal(counted.measure, "count");
    assert.equal(counted.times, 3);
    assert.equal(waiting.measure, "wait");
    assert.ok(waiting.waitSince);

    // Engine rows: a tally instead of a duration, and "Arrived" for a wait.
    const countRow = page.locator(`.dd-engine [data-engine-task="${counted.id}"]`);
    await countRow.locator(".dd-tally button").last().click();
    assert.equal((await card("Call the printer")).count, 1);
    assert.equal(await countRow.locator(".dd-tally-dots i[data-on=true]").count(), 1);
    assert.equal(await countRow.locator(".duration-scroll").count(), 0);
    const waitRow = page.locator(`.dd-engine [data-engine-task="${waiting.id}"]`);
    await waitRow.locator(".dd-waiting button").click();
    assert.equal((await card("Reply from client")).done, true);

    // Board: the same cards show their tally, and the measure can change there.
    await page.keyboard.press("Escape");
    await page.locator(".dd-engine").waitFor({ state: "detached" });
    const node = page.locator(`[data-board-id="b:${counted.id}"]`);
    await node.waitFor();
    assert.match(await node.innerText(), /1\/3 times/);
    await node.locator(".b4-node-body").click();
    const details = page.locator(".dd-card-details");
    await details.waitFor();
    assert.equal(await details.locator('[data-measure="count"]').getAttribute("aria-pressed"), "true");
    await details.locator(".dd-tally button").last().click();
    assert.equal((await card("Call the printer")).count, 2);
    await details.locator('[data-measure="wait"]').click();
    assert.equal((await card("Call the printer")).measure, "wait");
    await details.locator('[data-measure="time"]').click();
    const back = await card("Call the printer");
    assert.equal(back.measure, undefined);
    assert.ok(await details.locator(".dd-card-minutes input").isVisible());

    // Saved data keeps the measure after a reload.
    await page.reload();
    await page.waitForSelector(".views", { state: "attached" });
    assert.equal((await card("Reply from client")).measure, "wait");

    assert.deepEqual(errors, []);
    console.log("Measure (times / waiting) passed");
    await page.context().close();
  } finally {
    await h.stop();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
