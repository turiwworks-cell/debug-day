const assert = require("node:assert/strict");
const { start, fixture } = require("./harness.cjs");

(async () => {
  const h = await start();
  try {
    for (const language of ["en", "fa"]) for (const mobile of [false, true]) {
      const { page, context, errors } = await h.context(mobile), f = await fixture(page, h.origin),
        t = (en, fa) => language === "fa" ? fa : en;
      page.setDefaultTimeout(7000);
      f.data.setup.preferences = { ...f.data.setup.preferences, language, boardRailGoal: false, boardRailNote: false, boardRailHabits: false };
      if (mobile) Object.assign(f.data.setup.preferences, { boardRailGoal: true, boardRailNote: true, boardRailHabits: true });
      f.data.setup.habits = [{ id: "draw", name: "Drawing", color: "#E2683C" }];
      f.data.days[f.date].notes[0].role = "goal";
      f.data.days[f.date].notes.push({ id: "scratch", kind: "sticky", text: "Remember to wander", color: "#9DD6FF", x: 430, y: 80 });
      f.data.days[f.date].canvas = { board4: { links: [
        { id: "task", from: "sticky:note", to: "b:writing" },
        { id: "cross", from: "life:small", to: "b:long" },
      ] } };
      f.data.setup.life = { v: 2, frame: { x: 24, y: 1200 }, items: [
        { id: "a", type: "section", parent: "", text: "Art", x: 40, y: 60, w: 1000, h: 750 },
        { id: "b", type: "section", parent: "a", text: "Sketches", x: 420, y: 140, w: 520, h: 500 },
        ...[["big", "a", "Keep exploring"], ["small", "b", "Notice light"], ["memo", "b", "Gentle reminder"], ["root", "", "Creative life"]].map(([id, parent, text], n) => ({ id, parent, text, type: "sticky", role: id === "memo" ? "note" : "goal", x: 40, y: n === 2 ? 280 : 90, w: 220, h: 150, color: "#FFE08A" })),
      ], links: [{ id: "shared", from: "life:memo", to: "life:small" }] };
      await page.evaluate((data) => localStorage.setItem("debug-day:v2", JSON.stringify(data)), f.data);
      await page.reload(); await page.waitForSelector("#qa", { state: "attached" });
      const read = () => page.evaluate(() => JSON.parse(localStorage.getItem("debug-day:v2"))),
        canvas = page.locator(".b2-viewport"), toggle = (key) => page.locator(`[data-rail-toggle="${key}"]`),
        panel = (key) => page.locator(`#dd-rail-${key}`),
        key = async (value) => { await canvas.focus(); await page.keyboard.press(value); },
        open = async (name) => { if (await toggle(name).getAttribute("aria-expanded") !== "true") await toggle(name).click(); },
        close = async (name) => { if (await toggle(name).getAttribute("aria-expanded") === "true") await toggle(name).click(); };
      await page.locator(".views button").nth(1).click();
      await key("Control+Shift+F"); await page.locator(".b2.focus-mode").waitFor();
      if (mobile) {
        // Preferences synced from a desktop may have several open rails. A
        // phone still shows one; closing it must not open another behind it.
        await toggle("goal").click();
        for (const name of ["goal", "note", "habits"]) assert.equal(await toggle(name).getAttribute("aria-expanded"), "false");
      }
      await key("g"); await panel("goal").waitFor();
      assert.deepEqual(await panel("goal").locator("[data-rail-group]").evaluateAll((els) => els.map((e) => e.dataset.railGroup)), ["sticky:note", "life:root"]);
      await panel("goal").locator('[data-rail-ref="b:writing"]').click();
      assert.equal(await page.locator('[data-board-id="b:writing"]').getAttribute("aria-selected"), "true");
      if (mobile) assert.equal(await panel("goal").count(), 0, "a row returns the phone canvas to view");
      await close("goal");

      // Roles are edits to the real note, undoable and usable from touch More actions too.
      await page.locator('[data-board-id="sticky:scratch"]').focus();
      await page.keyboard.press("Shift+F10");
      await page.getByRole("menuitem", { name: t("Make it a note", "نوت کن"), exact: true }).click();
      assert.equal((await read()).days[f.date].notes.find((n) => n.id === "scratch").role, "note");
      await key("Control+z");
      assert.equal((await read()).days[f.date].notes.find((n) => n.id === "scratch").role, undefined);
      await key("Control+Shift+z");
      await key("Shift+g");
      assert.match(await panel("note").innerText(), /Remember to wander/);
      await close("note");
      // The text editor owns letters, even those used by rail shortcuts.
      await page.locator('[data-board-id="sticky:scratch"]').focus(); await page.keyboard.press("Enter");
      await page.locator(".dd-note-editor textarea").fill("gh"); await page.locator(".dd-note-editor textarea").press("g");
      assert.equal(await toggle("goal").getAttribute("aria-expanded"), "false");
      await page.locator(".dd-note-editor textarea").press("Control+Enter");

      // Nested board: main → Art → Sketches, and both day and shared connections.
      await page.locator('[data-sections-button]').click();
      await page.locator('.dd-sections [data-enter-section="b"]').click();
      if (await page.locator(".dd-sections").count()) await page.locator(".dd-sections-close").click();
      await page.locator(".dd-room-bar").waitFor(); await open("goal");
      assert.deepEqual(await panel("goal").locator("[data-rail-group]").evaluateAll((els) => els.map((e) => e.dataset.railGroup)), ["sticky:note", "life:root", "life:big", "life:small"]);
      assert.match(await panel("goal").locator('[data-rail-group="life:small"]').innerText(), /Long research[\s\S]*Gentle reminder/);
      const bounds = await panel("goal").boundingBox(), path = await page.locator(".dd-room-bar").boundingBox();
      assert.ok(bounds.y >= path.y + path.height, "rail begins below the section path");
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= (mobile ? 390 : 1440), JSON.stringify(await page.evaluate(() => Object.fromEntries([".b2", ".dd-board-rails", ".dd-rails-left", "#dd-rail-goal"].map((s) => { const el = document.querySelector(s), r = el.getBoundingClientRect(), c = getComputedStyle(el); return [s, { x:r.x, width:r.width, left:c.left, right:c.right, direction:c.direction, overflowX:c.overflowX, boxSizing:c.boxSizing }]; })))));
      await page.screenshot({ path: process.env.RAILS_SCREENSHOT_DIR ? `${process.env.RAILS_SCREENSHOT_DIR}/rails-${language}-${mobile ? "phone" : "desktop"}.png` : `${require("node:os").tmpdir()}/rails-${language}-${mobile ? "phone" : "desktop"}.png` });
      await panel("goal").locator('[data-rail-ref="life:memo"]').click();
      assert.equal(await page.locator('[data-board-id="life:memo"]').getAttribute("aria-selected"), "true");
      await open("goal");
      await panel("goal").locator('[data-rail-ref="sticky:note"]').click();
      await page.locator(".dd-room-bar").waitFor({ state: "detached" });
      await page.waitForSelector('[data-board-id="sticky:note"][aria-selected="true"]');
      const revealed = await page.locator('[data-board-id="sticky:note"]').boundingBox();
      assert.ok(revealed.x + revealed.width > 0 && revealed.x < (mobile ? 390 : 1440) && revealed.y > 0 && revealed.y < (mobile ? 744 : 800), "the camera reaches the original note");
      await close("goal");

      await key("h"); assert.equal(await canvas.getAttribute("data-tool"), "hand", "H remains Pan");
      await key("v"); await key("Shift+h"); await panel("habits").waitFor();
      const habit = panel("habits").locator('[data-rail-habit="draw"]');
      await habit.locator(".dd-habit-tick").click();
      assert.deepEqual((await read()).days[f.date].habits.draw, { done: true });
      await habit.locator(".dd-habit-min input").fill("30");
      assert.deepEqual((await read()).days[f.date].habits.draw, { done: true, min: 30 });
      assert.equal(await page.locator('[data-board-id="habit:draw"]').getAttribute("data-level"), "3");
      await habit.locator(".dd-rail-heading").click();
      assert.equal(await habit.locator(".dd-habit-grid i[data-level]").count(), 56);
      assert.equal(await panel("habits").locator(".dd-habit-stats").count(), 1, "stats stay in the right rail");
      const geometry = await page.evaluate(() => {
        const rect = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; };
        return { panel: rect("#dd-rail-habits"), top: rect(".b2-top"), height: innerHeight, width: innerWidth, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
      });
      assert.ok(geometry.panel.top >= geometry.top.bottom);
      assert.ok(geometry.panel.bottom < geometry.height - (mobile ? 100 : 60), "bottom tools remain clear");
      assert.ok(geometry.panel.left >= 0 && geometry.panel.right <= geometry.width);
      assert.equal(geometry.overflow, false);
      if (mobile) {
        await open("note"); assert.equal(await panel("habits").count(), 0, "one phone overlay at a time");
        await open("habits"); assert.equal(await panel("note").count(), 0);
      }
      await page.reload(); await page.waitForSelector("#qa", { state: "attached" });
      await page.locator(".views button").nth(1).click();
      if (mobile) await key("Control+Shift+F");
      assert.equal(await toggle("habits").getAttribute("aria-expanded"), "true", "toggle survives normalization and reload");
      assert.equal(await habit.locator(".dd-habit-tick").getAttribute("aria-pressed"), "true");
      if (mobile) await key("Control+Shift+F");
      await page.locator(".views button").nth(0).click();
      const plan = page.locator('.dd-habits [data-habit-id="draw"]');
      assert.equal(await plan.locator(".dd-habit-min input").inputValue(), "30");
      if (mobile) await page.locator(".dd-today-heading button").click();
      await plan.locator(".dd-habit-tick").click();
      await page.locator(".views button").nth(1).click();
      assert.equal(await habit.locator(".dd-habit-tick").getAttribute("aria-pressed"), "false");
      // Browsing a past day still edits today's habit, never the old day's log.
      await page.getByRole("button", { name: t("Previous day", "روز قبل"), exact: true }).click();
      if (mobile) await key("Control+Shift+F");
      await habit.locator(".dd-habit-tick").click();
      const afterPast = await read(), previousDate = new Date(f.date + "T12:00:00Z");
      previousDate.setUTCDate(previousDate.getUTCDate() - 1);
      assert.equal(afterPast.days[f.date].habits.draw.done, true);
      assert.equal(afterPast.days[previousDate.toISOString().slice(0, 10)]?.habits?.draw, undefined);
      const fullscreenBefore = await page.locator(".b2.focus-mode").count();
      await habit.locator(".dd-rail-heading").focus(); await page.keyboard.press("Escape");
      assert.equal(await panel("habits").count(), 0, "Escape in a rail closes it without leaving fullscreen");
      assert.equal(await page.locator(".b2.focus-mode").count(), fullscreenBefore);
      await key("e"); await page.getByRole("dialog", { name: t("Engine", "انجین"), exact: true }).waitFor();
      await page.keyboard.press("Escape");
      await key("Shift+e"); await page.locator(".dd-sticker-dialog").waitFor(); await page.keyboard.press("Escape");
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`rails ${language} ${mobile ? "390x844" : "1440x900"} ok`);
    }
  } finally { await h.stop(); }
})().catch((error) => { console.error(error); process.exit(1); });
