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

      await page.locator('[data-board-id="b:writing"] .b4-node-body').click();
      const details = page.locator(".dd-card-details");
      await details.waitFor();
      assert.equal(await details.locator("select").inputValue(), "writing");
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
