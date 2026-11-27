// 5.41: the Board gets the room. On a computer the Plan's rows step aside on
// the Board view; on a phone the Board opens full screen with the tabs still
// at the bottom, and Capture can drop an idea into the Feed's Inbox.
const assert = require("node:assert/strict");
const { devices, webkit } = require("playwright");
const { start, fixture } = require("./harness.cjs");
(async () => {
  const h = await start(process.env.DD_PHONE_WEBKIT === "1" ? webkit : undefined);
  try {
    // Computer: the Board view has no Plan rows above it and fills the window.
    {
      const { page, context, errors } = await h.context(false);
      page.setDefaultTimeout(8000);
      await fixture(page, h.origin);
      await page.locator(".views button[data-panel=board]").click();
      await page.locator("#b2").waitFor();
      assert.equal(await page.locator("main > .dayline").isVisible(), false, "Plan rows step aside on the Board view");
      const box = await page.locator("#b2").boundingBox();
      assert.ok(box.height >= 900 - 110, "board fills the window: " + box.height);
      assert.equal(await page.locator("#b2.focus-mode").count(), 0, "a computer keeps the board in the page");
      await page.locator(".views button[data-panel=calendar]").click();
      await page.locator("#dd-calendar-day").waitFor();
      assert.deepEqual(errors, []);
      await context.close();
    }
    // Phone: full screen by default, tabs stay at the bottom and reachable.
    {
      const context = await h.browser.newContext({
        ...devices["iPhone 14 Pro Max"],
        timezoneId: "Asia/Tehran",
      });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.setDefaultTimeout(8000);
      const f = await fixture(page, h.origin);
      const tabs = await page.locator(".top .dd-tabs").boundingBox();
      // 5.81: the tab bar floats just above the bottom edge (iOS 27).
      assert.ok(tabs.y + tabs.height >= page.viewportSize().height - 24 && tabs.y > page.viewportSize().height * 0.8, "tabs sit at the bottom: " + JSON.stringify(tabs));
      await page.locator(".views button[data-panel=board]").click();
      await page.locator("#b2.focus-mode").waitFor();
      const board = await page.locator("#b2").boundingBox();
      assert.ok(board.y + board.height <= tabs.y + 1, "full screen board ends above the tabs");
      // Feed the order of touch and WebKit gesture events into the same fullscreen
      // viewport. A scripted pointer has no OS capture token; real two-finger input
      // and pen capture are also exercised in board-tools.cjs.
      const motion = await page.locator(".b2-viewport").evaluate(async el => {
        const box = el.getBoundingClientRect(), cx = box.left + box.width / 2, cy = box.top + box.height / 2;
        const frame = () => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
        const camera = () => {
          const m = new DOMMatrix(getComputedStyle(el.querySelector(".b2-world")).transform);
          return { x: m.e, y: m.f, z: m.a };
        };
        const pointer = (type, id, x, y) => el.dispatchEvent(new PointerEvent(type, {
          bubbles:true, cancelable:true, pointerType:"touch", pointerId:id, clientX:x, clientY:y, button:0,
        }));
        const native = (type, scale) => {
          const event = Object.assign(new Event(type,{bubbles:true,cancelable:true}), { scale, clientX:cx, clientY:cy });
          el.dispatchEvent(event);
        };
        el.setPointerCapture = () => {};
        try {
          await frame();
          const start = camera();
          pointer("pointerdown", 10, cx-40, cy); pointer("pointerdown", 11, cx+40, cy);
          native("gesturestart", 1);
          pointer("pointermove", 10, cx-60, cy); pointer("pointermove", 11, cx+60, cy);
          await frame(); const zoomed = camera();
          native("gesturechange", 2); await frame(); const overlapping = camera();
          pointer("pointerup", 11, cx+60, cy);
          pointer("pointermove", 10, cx-60, cy+55); await frame(); const panned = camera();
          pointer("pointerup", 10, cx-60, cy+55);
          native("gesturechange", 2.2); native("gestureend", 2.2);
          await frame(); const ended = camera();
          native("gesturestart", 1); native("gesturechange", 1.1); native("gestureend", 1.1);
          await frame();
          return { start, zoomed, overlapping, panned, ended, standalone:camera() };
        } finally { delete el.setPointerCapture; }
      });
      assert.ok(Math.abs(motion.zoomed.z / motion.start.z - 1.5) < 0.002, JSON.stringify(motion));
      assert.deepEqual(motion.overlapping, motion.zoomed, "native gesture did not overwrite the pointer-driven zoom");
      assert.equal(motion.panned.z, motion.zoomed.z);
      assert.ok(Math.abs(motion.panned.y - motion.zoomed.y - 55) < 1, "one finger kept panning without a new touch");
      assert.ok(Math.abs(motion.panned.x - motion.zoomed.x) < 1);
      assert.deepEqual(motion.ended, motion.panned, "late gesture changes cannot move the board after release");
      assert.ok(Math.abs(motion.standalone.z / motion.ended.z - 1.1) < 0.002, "native-only gestures still zoom");
      const plan = await page.locator(".views button[data-panel=calendar]").boundingBox();
      const hit = await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest(".views"), { x: plan.x + plan.width / 2, y: plan.y + plan.height / 2 });
      assert.equal(hit, true, "the Calendar tab is not covered by the board");
      await page.locator(".views button[data-panel=calendar]").click();
      await page.locator(".views").waitFor({ state: "attached" });
      // An idea goes to the Feed's Inbox.
      await page.locator(".dd-floating-capture").click();
      await page.getByRole("group", { name: "Capture type" }).getByRole("button", { name: "Idea", exact: true }).click();
      await page.getByRole("textbox", { name: "Capture text" }).fill("Poster with moving type");
      await page.getByRole("button", { name: "Capture", exact: true }).click();
      await page.waitForFunction(() => {
        const items = JSON.parse(localStorage.getItem("debug-day:v2")).setup.life?.items || [];
        return items.some((i) => i.parent === "lf-inbox" && i.text === "Poster with moving type");
      });
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("debug-day:v2")));
      const inbox = saved.setup.life.items.find((i) => i.id === "lf-inbox");
      assert.equal(inbox.type, "section");
      assert.equal(saved.days[f.date].blocks.some((b) => b.name === "Poster with moving type"), false, "an idea is not a task");
      assert.equal(await page.evaluate(() => localStorage.getItem("debug-day:capture-kind")), '"idea"', "the kind is remembered");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log("phone board: full screen with tabs, board room on computer, idea to Inbox");
  } finally {
    await h.stop();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
