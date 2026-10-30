const assert = require("node:assert/strict");
const { start, fixture } = require("./harness.cjs");
(async () => {
  const h = await start();
  try {
    const { page, errors } = await h.context(false);
    const f = await fixture(page, h.origin);
    await page.evaluate((data) => localStorage.setItem("debug-day:v2", JSON.stringify(data)), f.data);
    await page.reload();
    await page.waitForSelector("#qa", { state: "attached" });
    await page.locator(".views button").nth(1).click();
    const viewport = page.locator(".b2-viewport");
    const cursor = await viewport.evaluate((el) => getComputedStyle(el).cursor);
    assert.match(cursor, /url\("?data:image\/svg\+xml/, "select mode uses the supplied cursor on the actual viewport");
    for (const selector of ['[data-board-id="sticky:note"]', '[data-board-id="sticky:note"] .dd-note-preview', '[data-life-type="sticky"]'])
      assert.match(await page.locator(selector).first().evaluate((el) => getComputedStyle(el).cursor), /url\("?data:image\/svg\+xml/, selector);
    const size = await viewport.evaluate(async (el) => {
      const src = /url\(["']?([^"')]+)["']?\)/.exec(getComputedStyle(el).cursor)[1];
      const img = new Image(); img.src = src; await img.decode();
      return [img.naturalWidth, img.naturalHeight];
    });
    assert.deepEqual(size, [32, 32], "the cursor image actually loads");
    await page.getByRole("button", { name: "Hand tool", exact: true }).click();
    assert.doesNotMatch(await viewport.evaluate((el) => getComputedStyle(el).cursor), /data:image/);
    await page.getByRole("button", { name: "Section navigator", exact: true }).click();
    for (const theme of ["light", "dark"]) {
      await page.evaluate((theme) => document.documentElement.dataset.theme = theme, theme);
      const contrast = await page.locator(".dd-life-nav").evaluate((el) => {
        const luminance = (value) => {
          const rgb = value.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
          return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
        };
        const bg = luminance(getComputedStyle(el).backgroundColor);
        return [...el.querySelectorAll("strong,button")].map((node) => {
          const fg = luminance(getComputedStyle(node).color);
          return (Math.max(bg, fg) + .05) / (Math.min(bg, fg) + .05);
        });
      });
      assert.ok(contrast.every((ratio) => ratio >= 4.5), `${theme}: navigator title and every section label must be readable`);
    }
    assert.deepEqual(errors, []);
    console.log("Cursor and navigator: cursor decoding, hand mode, light/dark text contrast passed");
  } finally { await h.stop(); }
})().catch((error) => { console.error(error); process.exit(1); });
