const assert = require("node:assert/strict");
const { start, fixture } = require("./harness.cjs");
(async () => {
  const h = await start();
  try {
    for (const language of ["en"])
      for (const mobile of [false, true]) {
        const { page, context, errors } = await h.context(mobile);
        page.setDefaultTimeout(8000);
        const f = await fixture(page, h.origin);
        f.data.setup.preferences.language = language;
        const names = {
          "Connect nodes": "اتصال نودها",
          "Move note": "جابه‌جایی نوت",
          "Edit note": "ویرایش نوت",
          "Sticky note text": "متن یادداشت",
          Undo: "واگرد",
          "Zoom out": "کوچک‌نمایی",
          "Zoom in": "بزرگ‌نمایی",
          Search: "جستجو",
          "Full day / more": "روز کامل / بیشتر",
          "Life happened": "اتفاقی افتاد",
          "Close today, keep the tasks": "بستن امروز و حفظ کارها",
          "Continue the day": "ادامهٔ روز",
        };
        const label = (value) =>
          language === "fa" ? names[value] || value : value;
        const touch = mobile ? await context.newCDPSession(page) : null;
        f.data.days[f.date].notes.push({
          id: "note2",
          kind: "sticky",
          text: "Second thought",
          color: "#FFE27A",
          x: 320,
          y: 80,
        });
        f.data.days[f.date].canvas = {
          board4: {
            version: 1,
            mode: "mindmap",
            layouts: { mindmap: { "b:writing": { x: 80, y: 400 } } },
            links: [],
            hidden: [],
            overrides: {},
            locked: [],
            groups: {},
            camera: { x: 24, y: 72, z: 0.8 },
          },
        };
        const read = () =>
          page.evaluate(
            (date) =>
              JSON.parse(localStorage.getItem("debug-day:v2")).days[date],
            f.date,
          );
        const note = () => page.locator('[data-board-id="sticky:note"]');
        const board = async () => {
          await page.locator(".views button").nth(1).click();
          await note().waitFor();
          if (mobile)
            await page
              .locator(".b2-viewport")
              .click({ position: { x: 30, y: 120 } });
        };
        async function seed() {
          await page.evaluate((f) => {
            localStorage.setItem("debug-day:v2", JSON.stringify(f.data));
            localStorage.setItem(
              "debug-day:board-view:" + f.date,
              JSON.stringify({
                camera: { x: 24, y: 72, z: 0.8 },
                mode: "mindmap",
              }),
            );
          }, f);
          await page.reload();
          await page.waitForSelector("#qa", { state: "attached" });
          await board();
        }
        async function drag(locator, target) {
          await locator.hover();
          const box = await locator.boundingBox(),
            x = box.x + box.width * 0.5,
            y = box.y + box.height * 0.5;
          const destination = target ? await target.boundingBox() : null;
          const dx = destination
              ? destination.x + destination.width / 2 - x
              : 60,
            dy = destination ? destination.y + destination.height / 2 - y : 30;
          if (touch) {
            await touch.send("Input.dispatchTouchEvent", {
              type: "touchStart",
              touchPoints: [{ x, y, id: 1 }],
            });
            for (let step = 1; step <= 10; step++)
              await touch.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [
                  { x: x + (dx * step) / 10, y: y + (dy * step) / 10, id: 1 },
                ],
              });
            await touch.send("Input.dispatchTouchEvent", {
              type: "touchEnd",
              touchPoints: [],
            });
          } else {
            await page.mouse.move(x, y);
            await page.mouse.down();
            await page.mouse.move(x + dx, y + dy, { steps: 10 });
            await page.mouse.up();
          }
        }
        await seed();
        // The connector tool has no dock button any more (FigJam); use its shortcut.
        await page.locator(".b2-viewport").focus(); await page.keyboard.press("x");
        await drag(note().locator(".dd-note-preview"));
        assert.notEqual((await read()).notes[0].x, 80);
        assert.equal((await read()).canvas.board4.links.length, 0);
        assert.equal(
          await page.locator(".b2-viewport").getAttribute("data-tool"),
          "select",
        );
        await seed();
        await note().locator(".dd-note-preview").click();
        // On desktop a selected note offers "+" (FigJam); phones keep the large circles.
        if (mobile) {
          await note().locator(".b4-port.right").click();
          assert.equal(
            await page.locator(".b2-viewport").getAttribute("data-tool"),
            "select",
          );
          assert.equal(await page.locator(".b4-connect-hint").count(), 0);
          const targetSize = await note().locator(".b4-port.right").boundingBox();
          assert.ok(
            targetSize.width >= 43.9 && targetSize.height >= 43.9,
            JSON.stringify(targetSize),
          );
        } else assert.equal(await note().locator('[data-add-near="right"]').count(), 1);
        // The connector tool has no dock button any more (FigJam); use its shortcut.
        await page.locator(".b2-viewport").focus(); await page.keyboard.press("x");
        await note().locator(".dd-note-preview").click();
        await page
          .locator('[data-board-id="sticky:note2"] .dd-note-preview')
          .click();
        assert.equal((await read()).canvas.board4.links.length, 1);
        await page
          .getByRole("button", { name: label("Undo"), exact: true })
          .click();
        await note().locator(".dd-note-preview").click();
        // Desktop drags the "+" of the selected note; phones keep the circle.
        await drag(
          note().locator('.b4-port.right:visible, [data-add-near="right"]:visible').first(),
          page.locator('[data-board-id="sticky:note2"] .dd-note-preview'),
        );
        assert.equal((await read()).canvas.board4.links.length, 1);
        assert.equal((await read()).canvas.board4.links[0].to, "sticky:note2");
        await seed();
        await drag(note().locator(".dd-note-preview"));
        assert.notEqual((await read()).notes[0].x, 80);
        await page
          .getByRole("button", { name: label("Undo"), exact: true })
          .click();
        assert.equal((await read()).notes[0].x, 80);
        await page
          .getByRole("button", { name: label("Zoom out"), exact: true })
          .click();
        await page
          .getByRole("button", { name: label("Zoom out"), exact: true })
          .click();
        await page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
        );
        const camera = await page
          .locator(".b2-world")
          .evaluate((el) => el.style.transform);
        // Select, then Enter edits (the note bar is hidden on desktop, as in FigJam).
        await note().locator(".dd-note-preview").click(); await page.keyboard.press("Enter");
        const input = note().getByRole("textbox", {
          name: label("Sticky note text"),
          exact: true,
        });
        await input.fill("نوت تازه\nخط دوم");
        await input.pressSequentially(" saved");
        assert.equal(
          await page.locator(".b2-world").evaluate((el) => el.style.transform),
          camera,
        );
        await page.waitForFunction(
          (date) =>
            JSON.parse(localStorage.getItem("debug-day:v2")).days[date].notes[0]
              .text === "نوت تازه\nخط دوم saved",
          f.date,
        );
        await page.reload();
        await board();
        assert.equal((await read()).notes[0].text, "نوت تازه\nخط دوم saved");
        await seed();
        await note().locator(".dd-note-preview").click();
        await page
          .getByRole("button", { name: label("Search"), exact: true })
          .focus();
        await page.keyboard.press("Backspace");
        assert.equal((await read()).notes.length, 2);
        await page.locator(".b2-viewport").focus();
        await page.keyboard.press("Delete");
        assert.equal((await read()).notes.length, 1);
        await page
          .getByRole("button", { name: label("Undo"), exact: true })
          .click();
        assert.equal((await read()).notes.length, 2);
        await seed();
        await page
          .getByRole("button", { name: label("Zoom in"), exact: true })
          .click();
        await page
          .getByRole("button", { name: label("Zoom in"), exact: true })
          .click();
        // Exact zoom steps can move this task off-screen. Find it through the board search.
        await page.locator(".b2-viewport").focus();await page.keyboard.press("Control+f");
        await page.locator(".b4-search input").fill("Portfolio writing");
        await page
          .locator(".b4-search button")
          .filter({ hasText: "Portfolio writing" })
          .click();
        assert.equal(await page.locator(".b4-search").count(),0);
        await page.locator('[data-board-id="b:writing"] .b4-node-icon').click();
        let task = (await read()).blocks[0];
        assert.equal(task.done, true);
        assert.equal(task.subtasks[0].children[0].done, true);
        await page.locator(".views button").nth(0).click();
        if (mobile)
          await page
            .getByRole("button", {
              name: label("Full day / more"),
              exact: true,
            })
            .click();
        await page
          .getByRole("button", {
            name: "Mark sub-step Nested outline not done",
            exact: true,
          })
          .click();
        task = (await read()).blocks[0];
        assert.equal(task.done, false);
        assert.equal(task.subtasks[0].done, false);
        await page
          .getByRole("button", { name: label("Life happened"), exact: true })
          .click();
        await page
          .getByRole("button", {
            name: label("Close today, keep the tasks"),
            exact: true,
          })
          .click();
        if (mobile) {
          const continueButton = page
            .locator(".dd-current-actions")
            .getByRole("button", {
              name: label("Continue the day"),
              exact: true,
            });
          await continueButton.click();
        } else {
          await page
            .locator("button.dchip")
            .filter({ hasText: label("Continue the day") })
            .click();
        }
        await page
          .getByRole("dialog", { name: label("Life happened"), exact: true })
          .getByRole("button", { name: label("Continue the day"), exact: true })
          .click();
        assert.equal((await read()).pause.closed, false);
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
        );
        assert.deepEqual(errors, []);
        console.log({
          viewport: mobile ? 390 : 1440,
          language,
          ux: "all eight fixes passed",
          errors,
        });
        await context.close();
      }
  } finally {
    await h.stop();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

