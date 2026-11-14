const assert = require("node:assert/strict");
const { start, fixture } = require("./harness.cjs");
// Board cards: readable steps, card details, zoomed-out buttons and Persian-layout shortcuts.
(async () => {
  const h = await start();
  try {
    for (const language of ["en"]) {
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
      await page.waitForSelector(".views", { state: "attached" });
      await page.locator(".views button[data-panel=board]").click();
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
      // Section tags replaced categories (5.54): the panel starts with the tag.
      assert.equal(await details.getByRole("combobox", { name: language === "fa" ? "دسته" : "Category", exact: true }).count(), 0);
      await details.locator(".dd-card-section [data-section-tag-add]").waitFor({ state: "attached" });
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

      // Lanes (5.68): the mind map itself, always tidy and compact. A task
      // dragged somewhere in the mind map still sits in its place in Lanes.
      await page.evaluate((f) => {
        const data = JSON.parse(localStorage.getItem("debug-day:v2"));
        const day = data.days[f.date];
        day.notes.push({ id: "n2", kind: "sticky", text: "Attached idea", color: "#B3EFBD", x: 900, y: 650 });
        day.canvas = { board4: { version: 1, mode: "lanes", layouts: { mindmap: { "b:writing": { x: 1400, y: 1600 } } }, links: [{ id: "l1", from: "b:writing", to: "sticky:n2" }], hidden: [], overrides: {}, locked: [], groups: {} } };
        localStorage.setItem("debug-day:v2", JSON.stringify(data));
        localStorage.setItem("debug-day:board-view:" + f.date, JSON.stringify({ camera: { x: 24, y: 20, z: 0.6 }, mode: "lanes" }));
      }, f);
      await page.reload();
      await page.waitForSelector(".views", { state: "attached" });
      await page.locator(".views button[data-panel=board]").click();
      if ((await page.locator(".b2-viewport").getAttribute("data-mode")) !== "lanes")
        await page.locator(".b4-modes button").nth(1).click();
      await page.locator('[data-board-id="b:writing"]').waitFor({ state: "attached" });
      await page.waitForTimeout(700);
      const rect = (ref) => page.locator(`[data-board-id="${ref}"]`).boundingBox();
      const work = await rect("lane:work"), writing = await rect("b:writing"), firstStep = await rect("sub:writing:sub");
      assert.ok(writing.x > work.x + work.width && writing.x - (work.x + work.width) < 200, "the task sits right beside its lane, not where it was dragged in the mind map");
      assert.ok(firstStep.x > writing.x + writing.width && firstStep.x - (writing.x + writing.width) < 160, "its steps right beside it");
      assert.ok(await page.locator('[data-wire-id="auto:lane:work->b:writing"]').count(), "the same lines as the mind map");
      assert.ok(await page.locator('[data-wire-id="l1"]').count(), "a line you drew stays");
      async function drag(from, to) {
        const a = await from.boundingBox(), b = await to.boundingBox();
        await page.mouse.move(a.x + a.width / 2, a.y + Math.min(12, a.height / 2));
        await page.mouse.down();
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
        await page.mouse.up();
      }
      // Dragged onto another lane, the task changes lane and goes back into a tidy place.
      await drag(page.locator('[data-board-id="b:writing"] .b4-node-body'), page.locator('[data-board-id="lane:life"]'));
      await page.waitForFunction((date) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date].blocks[0].lane === "life", f.date);
      await page.waitForTimeout(400);
      const life = await rect("lane:life"), moved = await rect("b:writing");
      assert.ok(moved.x > life.x + life.width && moved.x - (life.x + life.width) < 200, "tidy under its new lane");
      // Dragged into empty space, it comes back: Lanes keeps no spot for it.
      const resting = await rect("b:writing");
      await page.mouse.move(resting.x + resting.width / 2, resting.y + 12);await page.mouse.down();
      await page.mouse.move(resting.x + resting.width / 2 + 60, resting.y + 260, { steps: 10 });await page.mouse.up();
      await page.waitForTimeout(400);
      const settled = await rect("b:writing");
      assert.ok(Math.abs(settled.x - resting.x) < 2 && Math.abs(settled.y - resting.y) < 2, "back in its place");
      assert.equal((await page.evaluate((date) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date].canvas.board4.layouts.mindmap["b:writing"], f.date)), undefined, "a new lane clears the old spot, and Lanes saves none");

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

