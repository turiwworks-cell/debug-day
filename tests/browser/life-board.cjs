const assert = require("node:assert/strict");
const { start, fixture } = require("./harness.cjs");
// The Life section is one shared set of sections and stickies: every day's board shows
// it, and editing it anywhere edits it everywhere (it lives in setup, not in a day).
(async () => {
  const h = await start();
  try {
    const { page, errors } = await h.context(false);
    page.setDefaultTimeout(8000);
    const f = await fixture(page, h.origin);
    await page.evaluate((f) => localStorage.setItem("debug-day:v2", JSON.stringify(f.data)), f);
    await page.reload();
    await page.waitForSelector("#qa", { state: "attached" });
    const read = () => page.evaluate(() => JSON.parse(localStorage.getItem("debug-day:v2")));
    await page.locator(".views button").nth(1).click();
    await page.locator('[data-board-id="section:life"]').waitFor();

    // Starting content is the planning board, exactly: 49 pieces, texts kept.
    assert.equal(await page.locator("[data-life-id]").count(), 49);
    assert.equal(await page.locator('[data-life-type="section"]').count(), 17);
    for (const text of ["state of mind", "LIFE/CREATIVITY", "knowledge and interest", "Job", "Doing", "getting clients", "daily routin", "تحقیقاتی", "هوشمندی و تجربه"])
      assert.ok(await page.locator(`[data-life-type="section"] > .dd-life-sec-head strong:text-is("${text}"), [data-life-type="sticky"] > span:text-is("${text}")`).count(), text);

    // Section tool: click on the canvas inside an existing section adds a nested one.
    await page.locator('[data-life-jump]').click();
    const target = page.locator('[data-life-id="lf-257-529"]');
    await page.getByRole("button", { name: "Section tool" }).click();
    await page.evaluate(() => window.scrollTo(0, 400));
    const box = await target.boundingBox();
    // The empty right side of the section, kept inside the visible board.
    await page.mouse.click(box.x + box.width * 0.9, Math.max(100, Math.min(box.y + box.height * 0.5, 480)));
    await page.waitForFunction(() => document.querySelectorAll("[data-life-type=section]").length === 18);
    let life = (await read()).setup.life;
    assert.equal(life.items.length, 50);
    const made = life.items.at(-1);
    assert.equal(made.type, "section");
    assert.equal(made.parent, "lf-257-529", "created inside the section under the click");

    // Edit a sticky: it is saved in setup, not in the day.
    const sticky = page.locator('[data-life-id="lf-254-304"]');
    await sticky.dispatchEvent("dblclick");
    await sticky.locator("textarea").fill("english every day");
    await sticky.locator("textarea").press("Control+Enter");
    life = (await read()).setup.life;
    assert.equal(life.items.find((i) => i.id === "lf-254-304").text, "english every day");
    assert.equal(JSON.stringify((await read()).days[f.date]).includes("english every day"), false);

    // Drag a sticky from one section into another: it joins it, for every day.
    await page.evaluate(() => window.scrollTo(0, 300));
    const from = await page.locator('[data-life-id="lf-257-576"]').boundingBox();
    const to = await page.locator('[data-life-id="lf-258-639"]').boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height * 0.7, { steps: 8 });
    await page.mouse.up();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("debug-day:v2")).setup.life.items.find((i) => i.id === "lf-257-576").parent === "lf-258-639");

    // Another day sees the same Life section (and Lanes shows it too).
    const before = (await read());
    before.days[f.last].canvas = null;
    await page.evaluate((d) => localStorage.setItem("debug-day:v2", JSON.stringify(d)), before);
    await page.reload();
    await page.waitForSelector("#qa", { state: "attached" });
    await page.locator(".views button").nth(1).click();
    const first = await page.locator(".b2-viewport").first().evaluate((el) => el.closest("section")?.textContent?.slice(0, 40));
    await page.getByRole("button", { name: "Previous day" }).click();
    await page.waitForTimeout(300);
    assert.notEqual(await page.locator(".b2-viewport").first().evaluate((el) => el.closest("section")?.textContent?.slice(0, 40)), first, "another day is open");
    await page.locator("text=Lanes").first().click();
    await page.locator('[data-board-id="section:life"]').waitFor();
    assert.equal(await page.locator('[data-life-id="lf-254-304"]').innerText().then((s) => s.replace(/[✎●×]/g, "").trim()), "english every day");

    // Deleting needs two presses; a section keeps its contents when it goes.
    const sec = page.locator(`[data-life-id="${made.id}"]`);
    await sec.locator(".dd-life-sec-head .dd-life-tools button").last().dispatchEvent("click");
    assert.equal((await read()).setup.life.items.length, 50, "first press only arms");
    await sec.locator(".dd-life-sec-head .dd-life-tools button").last().dispatchEvent("click");
    assert.equal((await read()).setup.life.items.length, 49);
    assert.deepEqual(errors, []);
    console.log("life-board ok");
  } finally {
    await h.stop();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
