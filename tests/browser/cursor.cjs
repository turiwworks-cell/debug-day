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
    // The board uses the normal system arrow, not a custom picture.
    assert.equal(await viewport.evaluate((el) => getComputedStyle(el).cursor), "default", "select mode uses the system cursor");
    for (const selector of ['[data-board-id="sticky:note"]', '[data-board-id="sticky:note"] .dd-note-preview', '[data-life-type="sticky"]'])
      assert.doesNotMatch(await page.locator(selector).first().evaluate((el) => getComputedStyle(el).cursor), /data:image/, selector);
    await page.getByRole("button", { name: "Hand tool", exact: true }).click();
    assert.doesNotMatch(await viewport.evaluate((el) => getComputedStyle(el).cursor), /data:image/);
    await page.locator("[data-sections-button]").click();await page.locator("[data-life-tools]").click();
    const before=await page.locator('[data-board-id="section:life"]').evaluate((el)=>({w:el.offsetWidth,h:el.offsetHeight}));
    await page.getByRole("button",{name:"Enlarge Life area +25%",exact:true}).click();
    let geometry=await page.evaluate(()=>JSON.parse(localStorage.getItem("debug-day:v2")).setup.life.frame);
    assert.ok(geometry.w>before.w&&geometry.h>before.h,"visible enlarge action updates shared Life dimensions");
    const requested=geometry.w+500;
    await page.getByRole("spinbutton",{name:"Life area width",exact:true}).fill(String(requested));
    await page.getByRole("spinbutton",{name:"Life area width",exact:true}).press("Enter");
    geometry=await page.evaluate(()=>JSON.parse(localStorage.getItem("debug-day:v2")).setup.life.frame);
    assert.equal(geometry.w,requested,"custom width is saved in shared setup");
    for (const theme of ["light", "dark"]) {
      await page.evaluate((theme) => document.documentElement.dataset.theme = theme, theme);
      const contrast = await page.locator(".dd-flow").evaluate((el) => {
        // rgb()/rgba() in 0–255, or color(srgb …) in 0–1 for color-mix().
        const parse = (value) => {
          const n = value.match(/[\d.]+/g).map(Number), unit = value.startsWith("color(") ? 1 : 255;
          return { rgb: n.slice(0, 3).map((v) => v / unit), alpha: n.length > 3 ? n[3] : 1 };
        };
        const luminance = (value) => {
          const rgb = parse(value).rgb.map((v) => (v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4));
          return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
        };
        // Each label against the first solid background behind it (the blue "you are here" pill has its own).
        const behind = (node) => {
          for (let at = node; at; at = at.parentElement) { const bg = getComputedStyle(at).backgroundColor; if (parse(bg).alpha > .5) return bg; }
          return "rgb(255, 255, 255)";
        };
        return [...el.querySelectorAll("strong,button")].map((node) => {
          const bg = luminance(behind(node)), fg = luminance(getComputedStyle(node).color);
          return (Math.max(bg, fg) + .05) / (Math.min(bg, fg) + .05);
        });
      });
      assert.ok(contrast.every((ratio) => ratio >= 4.5), `${theme}: navigator title and every section label must be readable`);
    }
    assert.deepEqual(errors, []);
    console.log("Cursor and navigator: system cursor, hand mode, light/dark text contrast passed");
  } finally { await h.stop(); }
})().catch((error) => { console.error(error); process.exit(1); });
