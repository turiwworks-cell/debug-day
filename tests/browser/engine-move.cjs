const assert = require("node:assert/strict");
const { start, fixture } = require("./harness.cjs");
// The Engine's section moves by dragging its title. Today's tree moves with it,
// the spot is kept after a reload, and a new task lands inside the moved Engine.
(async () => {
  const h = await start();
  try {
    const { page, errors } = await h.context(false);
    const f = await fixture(page, h.origin);
    await page.evaluate((d) => localStorage.setItem("debug-day:v2", JSON.stringify(d)), f.data);
    await page.reload();
    await page.locator(".views button", { hasText: "Board" }).click();
    const area = page.locator('[data-board-id="section:engine"]');
    await area.waitFor();
    const pos = () => page.evaluate(() => Object.fromEntries(["section:engine", "day:root", "b:writing"].map((id) => {
      const e = document.querySelector(`[data-board-id="${id}"]`);
      return [id, e && { x: parseFloat(e.style.left), y: parseFloat(e.style.top) }];
    })));
    const before = await pos();
    const title = page.locator(".dd-engine-area-title"), box = await title.boundingBox(), open = await title.locator("button").boundingBox();
    const x = open.x - 24, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 120, y + 90, { steps: 6 });
    await page.mouse.move(x + 240, y + 180, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const after = await pos();
    const dx = after["section:engine"].x - before["section:engine"].x, dy = after["section:engine"].y - before["section:engine"].y;
    assert.ok(dx > 100 && dy > 80, "the Engine moved with the drag");
    for (const id of ["day:root", "b:writing"]) {
      assert.equal(after[id].x - before[id].x, dx, id + " moved with the Engine");
      assert.equal(after[id].y - before[id].y, dy, id + " moved with the Engine");
    }
    await page.reload();
    await page.locator(".views button", { hasText: "Board" }).click().catch(() => {});
    await area.waitFor();
    assert.deepEqual(await pos(), after, "the spot is kept after a reload");
    // A task added later starts inside the moved Engine.
    await page.evaluate(() => {
      const d = JSON.parse(localStorage.getItem("debug-day:v2")), date = new Date().toLocaleDateString("en-CA");
      d.days[date].blocks.push({ id: "fresh", name: "Fresh task", type: "writing", lane: "work", min: 30, done: false, subtasks: [] });
      localStorage.setItem("debug-day:v2", JSON.stringify(d));
    });
    await page.reload();
    await page.locator(".views button", { hasText: "Board" }).click().catch(() => {});
    const fresh = page.locator('[data-board-id="b:fresh"]');
    await fresh.waitFor();
    const ab = await area.boundingBox(), fb = await fresh.boundingBox();
    assert.ok(fb.x >= ab.x && fb.y >= ab.y && fb.x + fb.width <= ab.x + ab.width && fb.y + fb.height <= ab.y + ab.height, "the new task sits inside the Engine");
    assert.deepEqual(errors, []);
    console.log("engine-move: ok");
  } finally {
    await h.stop();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
