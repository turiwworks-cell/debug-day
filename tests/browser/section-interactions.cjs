const assert = require("node:assert/strict");
const { start, fixture } = require("./harness.cjs");
const { mkdirSync } = require("node:fs");
const { join } = require("node:path");

(async () => {
  const h = await start();
  try {
    for (const language of ["en", "fa"]) {
      const { page, context, errors } = await h.context(false);
      const f = await fixture(page, h.origin);
      f.data.setup.preferences.language = language;
      f.data.setup.life = { v: 1, items: [
        { id: "a", type: "section", parent: "", x: 40, y: 60, w: 420, h: 340, text: "Creative life", color: "#9DD6FF" },
        { id: "b", type: "section", parent: "", x: 560, y: 60, w: 420, h: 340, text: "Work & play", color: "#D3B8FF" },
        { id: "note", type: "sticky", parent: "a", x: 40, y: 70, w: 160, h: 160, text: "A small idea", color: "#FFE08A" },
      ] };
      await page.evaluate((data) => localStorage.setItem("debug-day:v2", JSON.stringify(data)), f.data);
      await page.reload();
      await page.waitForSelector("#qa", { state: "attached" });
      await page.locator(".views button").nth(1).click();
      await page.locator("[data-life-jump]").click();
      const read = () => page.evaluate(() => JSON.parse(localStorage.getItem("debug-day:v2")).setup.life.items);
      const a = page.locator('[data-life-id="a"]'), head = a.locator(".dd-life-sec-head"), note = page.locator('[data-life-id="note"]');
      const drag = async (locator, dx, dy, end = "up") => {
        const box = await locator.boundingBox();
        await page.mouse.move(box.x + 15, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + 15 + dx, box.y + box.height / 2 + dy, { steps: 10 });
        if (end === "escape") await page.keyboard.press("Escape");
        if (end === "cancel") await locator.dispatchEvent("pointercancel", { pointerId: 1 });
        await page.mouse.up();
      };
      const before = await read();
      const titleBox = await head.boundingBox(), bodyBox = await a.boundingBox();
      assert.ok(titleBox.y + titleBox.height < bodyBox.y, "title has its own space above the section");
      const oldFill = await a.evaluate((el) => getComputedStyle(el).backgroundColor);
      await head.getByRole("button", { name: language === "en" ? "Change color" : "تغییر رنگ", exact: true }).click();
      await head.getByRole("button", { name: (language === "en" ? "Use color " : "انتخاب رنگ ") + "#FFA799", exact: true }).click();
      assert.equal((await read())[0].color, "#FFA799");
      assert.notEqual(await a.evaluate((el) => getComputedStyle(el).backgroundColor), oldFill);
      await page.keyboard.press("Control+z");
      assert.deepEqual(await read(), before, "Life color changes participate in board undo");
      await page.keyboard.press("Control+Shift+z");
      assert.equal((await read())[0].color, "#FFA799");

      const start = await read();
      await drag(head.locator("strong"), 55, 35);
      const moved = await read(), movedA = moved.find((i) => i.id === "a");
      assert.ok(movedA.x > 40 && movedA.y > 60);
      assert.equal(movedA.parent, "");
      assert.deepEqual(moved.find((i) => i.id === "note"), start.find((i) => i.id === "note"), "children move with the section without rewriting their coordinates");
      assert.deepEqual(moved.find((i) => i.id === "b"), start.find((i) => i.id === "b"));
      await drag(head.locator("strong"), 60, 30, "escape");
      assert.deepEqual(await read(), moved, "Escape cancels without saving");
      await drag(note.locator("span").first(), 35, 20, "cancel");
      assert.deepEqual(await read(), moved, "pointer cancellation does not commit a drop");

      const grip = a.locator(".dd-life-grip");
      await drag(grip, -200, -200);
      const resized = (await read()).find((i) => i.id === "a");
      assert.ok(resized.w >= 224 && resized.h >= 254, "resize keeps contents inside");
      const b = (await read()).find((i) => i.id === "b");
      assert.equal(b.w, 420, "resizing does not grow unrelated sections");

      // Frame colors must render too, rather than being hidden by wash !important.
      const snapshot = await page.evaluate(() => JSON.parse(localStorage.getItem("debug-day:v2")));
      const day = snapshot.days[f.date];
      day.canvas ||= {};
      day.canvas.board4 ||= {};
      day.canvas.board4.styles ||= {};
      day.canvas.board4.styles["section:life"] = { fill: "#874FFF" };
      await page.evaluate((data) => localStorage.setItem("debug-day:v2", JSON.stringify(data)), snapshot);
      await page.reload();
      await page.waitForSelector("#qa", { state: "attached" });
      await page.locator(".views button").nth(1).click();
      await page.locator("[data-life-jump]").click();
      assert.equal((await read()).find((i) => i.id === "a").color, "#FFA799");
      const frameHead = page.locator('[data-board-id="section:life"] > .b4-node-body');
      assert.equal(await frameHead.evaluate((el) => getComputedStyle(el).backgroundColor), "rgb(135, 79, 255)");
      const dir = process.env.DEBUG_DAY_SCREENSHOTS;
      if (dir) { mkdirSync(dir, { recursive: true }); await page.screenshot({ path: join(dir, `sections-${language}.png`) }); }
      assert.deepEqual(errors, []);
      await context.close();
    }
    const { page, context, errors } = await h.context(true);
    const f = await fixture(page, h.origin);
    f.data.setup.life = { v: 1, items: [
      { id: "touch-sec", type: "section", parent: "", x: 40, y: 60, w: 420, h: 340, text: "Touch section", color: "#9DD6FF" },
      { id: "touch-note", type: "sticky", parent: "touch-sec", x: 40, y: 70, w: 160, h: 160, text: "Move me", color: "#FFE08A" },
    ] };
    await page.evaluate((data) => localStorage.setItem("debug-day:v2", JSON.stringify(data)), f.data);
    await page.reload();
    await page.waitForSelector("#qa", { state: "attached" });
    await page.locator(".views button").nth(1).click();
    await page.getByRole("button", { name: "Full screen", exact: true }).click();
    await page.locator("[data-life-jump]").click();
    await page.locator(".b2-viewport").scrollIntoViewIfNeeded();
    const touch = await context.newCDPSession(page);
    let previous = 40;
    for (let i = 0; i < 3; i++) {
      const box = await page.locator('[data-life-id="touch-note"]').boundingBox();
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
      await page.waitForFunction(() => document.querySelector(".dd-life").dataset.gesture === "move");
      for (let step = 1; step <= 6; step++)
        await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + 12 * step / 6, y, id: 1 }] });
      await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.waitForFunction((previous) => JSON.parse(localStorage.getItem("debug-day:v2")).setup.life.items.find((i) => i.id === "touch-note").x > previous, previous);
      const current = await page.evaluate(() => JSON.parse(localStorage.getItem("debug-day:v2")).setup.life.items.find((i) => i.id === "touch-note").x);
      assert.ok(current > previous, "each fresh finger drag moves the note");
      previous = current;
    }
    assert.equal(await page.locator("[data-life-id] textarea").count(), 0, "short repeated drags must not open the text editor");
    assert.deepEqual(errors, []);
    await context.close();
    console.log("section interactions ok (en, fa, repeated touch)");
  } finally { await h.stop(); }
})().catch((error) => { console.error(error); process.exit(1); });
