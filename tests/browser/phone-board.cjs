// 5.41: the Board gets the room. On a computer the Plan's rows step aside on
// the Board view; on a phone the Board opens full screen with the tabs still
// at the bottom, and Capture can drop an idea into the Feed's Inbox.
const assert = require("node:assert/strict");
const { devices } = require("playwright");
const { start, fixture } = require("./harness.cjs");
(async () => {
  const h = await start();
  try {
    // Computer: the Board view has no Plan rows above it and fills the window.
    {
      const { page, context, errors } = await h.context(false);
      page.setDefaultTimeout(8000);
      await fixture(page, h.origin);
      await page.locator(".views button").nth(1).click();
      await page.locator("#b2").waitFor();
      assert.equal(await page.locator("main > .dayline").isVisible(), false, "Plan rows step aside on the Board view");
      const box = await page.locator("#b2").boundingBox();
      assert.ok(box.height >= 900 - 110, "board fills the window: " + box.height);
      assert.equal(await page.locator("#b2.focus-mode").count(), 0, "a computer keeps the board in the page");
      await page.locator(".views button").nth(0).click();
      await page.locator("main > .dayline").waitFor();
      assert.deepEqual(errors, []);
      await context.close();
    }
    // Phone: full screen by default, tabs stay at the bottom and reachable.
    {
      const context = await h.browser.newContext({
        ...devices["iPhone 13"],
        viewport: { width: 390, height: 844 },
        timezoneId: "Asia/Tehran",
      });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.setDefaultTimeout(8000);
      const f = await fixture(page, h.origin);
      const tabs = await page.locator(".top .dd-tabs").boundingBox();
      assert.ok(tabs.y + tabs.height >= 843 && tabs.y > 700, "tabs sit at the bottom: " + JSON.stringify(tabs));
      await page.locator(".views button").nth(1).click();
      await page.locator("#b2.focus-mode").waitFor();
      const board = await page.locator("#b2").boundingBox();
      assert.ok(board.y + board.height <= tabs.y + 1, "full screen board ends above the tabs");
      const plan = await page.locator(".views button").nth(0).boundingBox();
      const hit = await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest(".views"), { x: plan.x + plan.width / 2, y: plan.y + plan.height / 2 });
      assert.equal(hit, true, "the Plan tab is not covered by the board");
      await page.locator(".views button").nth(0).click();
      await page.locator("#qa").waitFor({ state: "attached" });
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
