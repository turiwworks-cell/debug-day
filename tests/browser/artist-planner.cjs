const assert = require("node:assert/strict");
const { start, fixture } = require("./harness.cjs");
// Board cards: readable steps, card details, zoomed-out buttons and Persian-layout shortcuts.
(async () => {
  const h = await start();
  try {
    for (const language of ["en", "fa"]) {
      const { page, errors } = await h.context(false);
      page.setDefaultTimeout(8000);
      const f = await fixture(page, h.origin);
      f.data.setup.preferences.language = language;
      await page.evaluate((f) => {
        localStorage.setItem("debug-day:v2", JSON.stringify(f.data));
        localStorage.setItem(
          "debug-day:board-view:" + f.date,
          JSON.stringify({ camera: { x: 24, y: 20, z: 0.9 }, mode: "mindmap" }),
        );
      }, f);
      await page.reload();
      await page.waitForSelector("#qa", { state: "attached" });
      await page.locator(".views button").nth(1).click();
      const read = () =>
        page.evaluate(
          (date) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date],
          f.date,
        );
      const step = page.locator('[data-board-id="sub:writing:sub"]');
      await step.waitFor();
      const title = await step
        .locator(".b4-node-title")
        .evaluate((el) => [el.scrollHeight, el.clientHeight]);
      assert.ok(title[0] <= title[1] + 2, "whole step text is visible " + title);
      assert.ok((await step.boundingBox()).height > 48 * 0.9);
      assert.match(
        await step.locator(".b4-node-subtitle").innerText(),
        language === "fa" ? /قدم/ : /step/i,
      );

      // Free notes resize from either bottom corner; the left one moves the edge.
      const free = page.locator('[data-board-id="sticky:note"]');
      await free.locator(".dd-note-preview").click();
      const left = free.locator('[data-edge="sw"]');
      const startBox = await free.boundingBox(), grip = await left.boundingBox();
      await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
      await page.mouse.down();
      await page.mouse.move(grip.x + grip.width / 2 - 60, grip.y + grip.height / 2 + 40, { steps: 8 });
      await page.mouse.up();
      await page.waitForFunction((date) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date].canvas.board4.styles?.["sticky:note"]?.width > 260, f.date);
      const endBox = await free.boundingBox();
      assert.ok(endBox.x < startBox.x - 20 && endBox.width > startBox.width + 20, JSON.stringify([startBox, endBox]));

      await page.locator('[data-board-id="b:writing"] .b4-node-body').click();
      const details = page.locator(".dd-card-details");
      await details.waitFor();
      assert.equal(await details.getByRole("combobox", { name: language === "fa" ? "دسته" : "Category", exact: true }).inputValue(), "writing");
      await details.locator("textarea").fill("Draft the intro first");
      assert.equal((await read()).blocks[0].note, "Draft the intro first");
      assert.equal(await details.locator(".dd-card-steps li").count(), 2);

      await page.locator("[data-add-step]").click();
      await page.locator(".b4-child input").fill("Pick three images");
      await page.locator(".b4-child button[type=submit]").click();
      await page.waitForFunction(
        (date) =>
          JSON.parse(localStorage.getItem("debug-day:v2")).days[date].blocks[0]
            .subtasks.length === 2,
        f.date,
      );
      // Ctrl+Z pressed on a Persian layout sends "ظ" with the Z key code.
      await page.locator(".b2-viewport").evaluate((el) =>
        el.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "ظ",
            code: "KeyZ",
            ctrlKey: true,
            bubbles: true,
          }),
        ),
      );
      await page.waitForFunction(
        (date) =>
          JSON.parse(localStorage.getItem("debug-day:v2")).days[date].blocks[0]
            .subtasks.length === 1,
        f.date,
      );

      await page.locator(".b2-viewport").focus();
      await page.keyboard.press("Escape");
      for (let i = 0; i < 3; i++) await page.keyboard.press("-");
      await page.waitForFunction(
        () => +document.querySelector(".b2-viewport").dataset.zoom < 0.5,
      );
      await step.hover({ force: true });
      const plus = step.locator(".b4-node-actions button").last();
      await plus.waitFor({ state: "visible" });
      const box = await plus.boundingBox();
      assert.ok(box.width >= 16 && box.height >= 16, JSON.stringify(box));

      // Lanes: no lines, cards hold their steps/feelings/notes, drop to attach.
      await page.evaluate((f) => {
        const data = JSON.parse(localStorage.getItem("debug-day:v2"));
        const day = data.days[f.date];
        day.notes.push({ id: "n2", kind: "sticky", text: "Attached idea", color: "#B3EFBD", x: 900, y: 650 });
        day.bugs.push({ id: "f2", text: "Tired after lunch", type: "", on: "", fixed: false, category: "body", triggerTag: "", antidote: "" });
        day.canvas = { board4: { version: 1, mode: "lanes", layouts: {}, links: [{ id: "l1", from: "b:writing", to: "sticky:n2" }], hidden: [], overrides: {}, locked: [], groups: {} } };
        localStorage.setItem("debug-day:v2", JSON.stringify(data));
        localStorage.setItem("debug-day:board-view:" + f.date, JSON.stringify({ camera: { x: 24, y: 20, z: 0.7 }, mode: "lanes" }));
      }, f);
      await page.reload();
      await page.waitForSelector("#qa", { state: "attached" });
      await page.locator(".views button").nth(1).click();
      if ((await page.locator(".b2-viewport").getAttribute("data-mode")) !== "lanes")
        await page.locator(".b4-modes button").nth(1).click();
      await page.locator('[data-board-id="sec:writing"]').waitFor({ state: "attached" });
      await page.waitForTimeout(700);
      assert.equal(await page.locator(".b4-wire").count(), 0, "no lines in lanes");
      assert.equal(await page.locator('.b2-viewport[data-mode=lanes] .b4-port').evaluateAll((els) => els.filter((el) => getComputedStyle(el).display !== "none").length), 0);
      const inside = async (ref, section) => {
        const a = await page.locator(`[data-board-id="${ref}"]`).boundingBox(),
          b = await page.locator(`[data-board-id="${section}"]`).boundingBox();
        if (process.env.DEBUG) console.log(ref, a, section, b);
        return a.x >= b.x - 1 && a.y >= b.y - 1 && a.x + a.width <= b.x + b.width + 1 && a.y + a.height <= b.y + b.height + 1;
      };
      assert.ok(await inside("sub:writing:sub", "sec:writing"), "step inside its card");
      assert.ok(await inside("sticky:n2", "sec:writing"), "linked note inside its card");
      async function drag(from, to) {
        const a = await from.boundingBox(), b = await to.boundingBox();
        await page.mouse.move(a.x + a.width / 2, a.y + Math.min(12,a.height/2));
        await page.mouse.down();
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
        await page.mouse.up();
      }
      await drag(page.locator('[data-board-id="bug:f2"]'), page.locator('[data-board-id="sec:writing"]'));
      await page.waitForFunction((date) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date].bugs.find((b) => b.id === "f2").blockId === "writing", f.date);
      assert.ok(await inside("bug:f2", "sec:writing"), "dropped feeling joins the card");
      await drag(page.locator('[data-board-id="sticky:n2"] .dd-note-preview'), page.locator('[data-board-id="lane:life"]'));
      await page.waitForFunction((date) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date].canvas.board4.links.length === 0, f.date);
      assert.ok(!(await inside("sticky:n2", "sec:writing")), "dragged-out note leaves the card");
      const before = await page.locator('[data-board-id="sub:writing:sub"]').boundingBox();
      await drag(page.locator('[data-board-id="b:writing"] .b4-node-body'), page.locator('[data-board-id="lane:life"]'));
      await page.waitForFunction((date) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date].blocks[0].lane === "life", f.date);
      assert.ok(await inside("sub:writing:sub", "sec:writing"), "steps move with their card");
      assert.notDeepEqual(await page.locator('[data-board-id="sub:writing:sub"]').boundingBox(), before);

      assert.deepEqual(errors, []);
      console.log("Artist planner board:", language, "passed");
      await page.context().close();
    }
  } finally {
    await h.stop();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

