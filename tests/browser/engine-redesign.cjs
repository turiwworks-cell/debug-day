const assert = require("node:assert/strict");
const { start, fixture } = require("./harness.cjs");

(async () => {
  const app = await start();
  try {
    for (const [language, mobile] of [["en", false], ["fa", true]]) {
      const { page, context, errors } = await app.context(mobile);
      const f = await fixture(page, app.origin);
      f.data.setup.preferences.language = language;
      f.data.days[f.date].notes[0].engineShared = true;
      f.data.setup.later = [{ ...f.data.days[f.date].blocks[1], id: "capture-task", name: "Review the boards" }];
      await page.evaluate((data) => localStorage.setItem("debug-day:v2", JSON.stringify(data)), f.data);
      await page.reload();
      await page.waitForSelector("#qa", { state: "attached" });
      const read = () => page.evaluate((date) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date], f.date);
      const engine = page.locator(".dd-engine");

      assert.equal(await page.locator('.dd-tabs .views button[data-panel="plan"]').getAttribute("aria-label"), language === "fa" ? "انجین" : "Engine");
      await page.locator('.dd-tabs .views button[data-panel="plan"]').click();
      await engine.waitFor();
      assert.equal(await engine.locator('[data-engine-zone="today"]').count(), 1);
      assert.equal(await engine.locator('[data-engine-zone="park"]').count(), 1);
      await engine.getByRole("button", { name: language === "fa" ? "ابزارهای پلن" : "Planning tools" }).click();
      await engine.locator(".dd-engine-planning .plan").waitFor();
      await engine.getByRole("button", { name: language === "fa" ? "بازگشت به کارها" : "Back to tasks" }).click();
      const row = engine.locator('[data-engine-task="writing"]');
      await row.locator('.dd-engine-step-head button').click();
      await engine.locator('[data-engine-task="long"] .dd-engine-step-head button').click();
      assert.equal(await row.locator('[data-step="sub"]').count(), 1);
      assert.equal(await row.locator('[data-step="nested"]').count(), 1);
      assert.ok(await row.locator('.dd-engine-priority').innerText() === 'P1');

      // A step in one task can depend on a step in another, with cycle-safe storage.
      const add = engine.locator('[data-engine-task="long"] .dd-engine-step-add input');
      await add.fill("Send draft");
      await add.press("Enter");
      let state = await read();
      const id = state.blocks.find((b) => b.id === "long").subtasks.at(-1).id;
      await engine.locator(`[data-step="${id}"] .dd-step-dep-edit`).click();
      await engine.locator(`[data-step="${id}"] .dd-step-dependency`).selectOption('sub');
      state = await read();
      assert.deepEqual(state.blocks.find((b) => b.id === "long").subtasks.at(-1).dependsOn, ["sub"]);
      assert.equal(await engine.locator(`[data-step="${id}"]`).getAttribute("data-blocked"), "true");

      await row.locator('.dd-engine-step-head button').click();
      await engine.locator(`[data-step="${id}"] .dd-step-dep`).click();
      await page.waitForFunction(() => document.activeElement?.closest('[data-step]')?.dataset.step === 'sub');
      assert.deepEqual((await read()).blocks.find(b => b.id === "long").subtasks.at(-1).dependsOn, ["sub"]);

      // Park returns to Today without losing the task/step tree.
      await row.locator('.dd-engine-move').click();
      assert.equal(await engine.locator('[data-engine-zone="park"] [data-engine-task="writing"]').count(), 1);
      await engine.locator('[data-engine-zone="park"] [data-engine-task="writing"] .dd-engine-move').click();
      assert.equal(await engine.locator('[data-engine-zone="today"] [data-engine-task="writing"]').count(), 1);

      // Notes made here are saved in the shared Feed rather than the selected day.
      const note = engine.getByRole("textbox", { name: language === "fa" ? "نوت مشترک جدید" : "New shared note" });
      await note.fill("Shared storyboard"); await note.press("Enter");
      await page.waitForFunction(() => JSON.parse(localStorage.getItem("debug-day:v2")).setup.life.items.some((i) => i.text === "Shared storyboard"));
      await engine.getByRole("button", { name: language === "fa" ? "بستن انجین" : "Close Engine" }).click();

      // Tab is a navigation hub, and Capture is visually separate.
      await page.locator(".b2-viewport").focus();
      await page.keyboard.press("Tab");
      const tabs = page.locator(".dd-flow"); await tabs.waitFor();
      assert.equal(await tabs.locator(".dd-flow-quick-capture").count(), 1);
      await tabs.locator(".dd-flow-quick-capture").click();
      const capture = page.locator(".dd-capture-hub"); await capture.waitFor();
      assert.equal(await capture.locator(".dd-capture-categories button").count(), 3);
      await capture.locator(".dd-capture-categories button").nth(1).click();
      await capture.locator('[data-capture-item="capture-task"] button').nth(1).click();
      assert.equal((await read()).blocks.find((task) => task.id === "capture-task").lane, "");
      assert.equal(await capture.locator('[data-capture-item="capture-task"]').count(), 0);
      await capture.getByRole("button", { name: language === "fa" ? "بستن" : "Close" }).click();

      // T creates/opens This App; E shows shared notes there as well.
      await page.locator(".b2-viewport").focus(); await page.keyboard.press("t");
      await page.waitForFunction(() => JSON.parse(localStorage.getItem("debug-day:v2")).setup.life.items.some((i) => i.type === "section" && i.text === "This App"));
      await page.locator('[data-board-id="sticky:note"]').waitFor({ state: "attached", timeout: 3000 });
      await page.locator(".b2-viewport").focus(); await page.keyboard.press("e");
      await engine.waitFor();
      assert.ok(await engine.locator('.dd-engine-shared textarea').first().inputValue() === "Shared storyboard");
      assert.equal(await engine.locator('[data-engine-task="writing"]').count(), 0);
      await engine.locator(".dd-engine-filter select").selectOption("all");
      assert.equal(await engine.locator('[data-engine-task="writing"]').count(), 1);
      assert.deepEqual(errors, [], "no console errors on redesigned paths");
      await context.close();
    }
    console.log("Engine redesign, Tab, Capture and shared notes passed");
  } finally { await app.stop(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
