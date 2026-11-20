// How much you can draw (5.88.1): room, not a count of lines. A board shows and
// keeps more than the old 600 drawings. A new drawing stops only when the
// planner nears the 1.5 MB sync limit, with a calm word on why, and deleting
// still works then; once there is room again, drawing goes on.
const assert = require("node:assert/strict");
const { start, fixture } = require("./harness.cjs");

const ink = (i) => ({ id: "old" + i, pts: `${2000 + (i % 40) * 14},${900 + Math.floor(i / 40) * 14} 8,4 6,-3`, color: "#1E1E1E", width: 2 });

(async () => {
  const h = await start();
  try {
    for (const mobile of [false, true]) {
      const { context, page, errors } = await h.context(mobile);
      page.setDefaultTimeout(15000);
      const f = await fixture(page, h.origin);
      const day = f.data.days[f.date];
      day.notes = [];
      day.canvas = { board4: { layouts: { mindmap: {} }, locked: [], styles: {}, links: [], strokes: Array.from({ length: 800 }, (_, i) => ink(i)) } };
      const open = async (data) => {
        await page.evaluate(({ data, date }) => {
          localStorage.setItem("debug-day:v2", JSON.stringify(data));
          localStorage.setItem("debug-day:ui", JSON.stringify({ view: "board" }));
          localStorage.setItem("debug-day:board-view:" + date, JSON.stringify({ camera: { x: 70, y: 100, z: 0.8 }, mode: "mindmap" }));
        }, { data, date: f.date });
        await page.reload();
        await page.waitForSelector(".b2-viewport");
        await page.locator('[data-stroke-id="old0"]').first().waitFor({ state: "attached" }).catch(() => {});
      };
      const view = page.locator(".b2-viewport");
      const key = async (k) => { await view.focus(); await page.keyboard.press(k); await page.waitForTimeout(130); };
      const screen = (x, y) => page.evaluate(({ x, y }) => {
        const r = document.querySelector(".b2-viewport").getBoundingClientRect();
        const m = document.querySelector(".b2-world").style.transform.match(/translate3d\(([-\d.]+)px,\s*([-\d.]+)px.*scale\(([-\d.]+)\)/);
        return { x: r.x + +m[1] + x * +m[3], y: r.y + +m[2] + y * +m[3] };
      }, { x, y });
      const draw = async (points) => {
        const pp = [];
        for (const p of points) pp.push(await screen(...p));
        await page.mouse.move(pp[0].x, pp[0].y);
        await page.mouse.down();
        for (const p of pp.slice(1)) await page.mouse.move(p.x, p.y, { steps: 5 });
        await page.mouse.up();
        await page.waitForTimeout(200);
      };
      const strokes = () => page.evaluate((date) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date].canvas?.board4?.strokes?.length || 0, f.date);

      // More than the old 600: every drawing shows, and one more can be drawn.
      await open(f.data);
      await key("Control+Shift+F");
      assert.equal(await page.locator(".dd-ink g[data-stroke-id]").count(), 800, "all 800 drawings show");
      await key("p");
      await draw([[150, 250], [220, 280], [300, 260]]);
      assert.equal(await strokes(), 801, "the 801st drawing is kept");

      // The planner nears the 1.5 MB sync limit (filled with words): a new drawing
      // is not added, and the board says why.
      const full = await page.evaluate(() => JSON.parse(localStorage.getItem("debug-day:v2")));
      let size = JSON.stringify(full).length, n = 0;
      while (size < 1430000) {
        const date = new Date(Date.UTC(2025, 0, 1 + n)).toISOString().slice(0, 10);
        full.days[date] = { date, blocks: [], bugs: [], notes: Array.from({ length: 4 }, (_, k) => ({ id: "w" + n + "-" + k, kind: "sticky", text: "Sketchbook words ".repeat(220).slice(0, 3900), color: "#FFE299", x: 40, y: 40 + k * 200 })) };
        size = JSON.stringify(full).length;
        n++;
      }
      await open(full);
      await key("Control+Shift+F");
      await key("p");
      await draw([[150, 400], [220, 430], [300, 410]]);
      const status = page.locator(".b4-status");
      await page.waitForFunction(() => /1\.5 MB sync limit/.test(document.querySelector(".b4-status")?.textContent || ""));
      assert.match(await status.innerText(), /^Your planner is close to the 1\.5 MB sync limit, so this drawing wasn't added\. Delete drawings you no longer need to make room\.$/);
      assert.equal(await strokes(), 801, "nothing was added");

      // Deleting always works, and then there is room to draw again.
      await page.locator("[data-pen-select-all]").click();
      await key("Delete");
      await page.waitForFunction((date) => !JSON.parse(localStorage.getItem("debug-day:v2")).days[date].canvas?.board4?.strokes?.length, f.date);
      await key("p");
      await draw([[150, 500], [220, 530], [300, 510]]);
      assert.equal(await strokes(), 1, "room again: the drawing is kept");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false, "no sideways scroll");
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log("pen room: more than 600 drawings, a calm stop near the sync limit, deleting always works");
  } finally {
    await h.stop();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
