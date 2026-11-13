const assert = require("node:assert/strict");
const { mkdirSync } = require("node:fs");
const { join } = require("node:path");
const { start, fixture } = require("./harness.cjs");
(async () => {
  const h = await start();
  try {
    for (const language of ["en"])
      for (const mobile of [false, true]) {
        const { page, context, errors } = await h.context(mobile),
          f = await fixture(page, h.origin),
          t = (en, fa) => (language === "fa" ? fa : en);
        page.setDefaultTimeout(9000);
        const day = f.data.days[f.date];
        f.data.setup.preferences.language = language;
        day.blocks[0].subtasks = [
          {
            id: "sub",
            text: "Outline",
            done: false,
            children: [
              {
                id: "nested",
                text: "Nested outline",
                done: false,
                children: [],
              },
            ],
          },
        ];
        day.blocks[1].min = 60;
        day.blocks[1].pri = 0;
        f.data.setup.board = {
          work: { x: 40, y: 40 },
          life: { x: 40, y: 700 },
        };
        day.canvas = {
          board4: {
            links: [],
            hidden: [],
            overrides: {},
            locked: [],
            styles: {},
            groups: {},
            layouts: {
              mindmap: {
                "day:root": { x: 20, y: 20 },
                "lane:work": { x: 20, y: 150 },
                "lane:life": { x: 20, y: 340 },
                "b:writing": { x: 230, y: 150 },
                "b:long": { x: 230, y: 330 },
              },
              lanes: { "b:writing": { x: 70, y: 100 } },
            },
          },
        };
        await page.evaluate((f) => {
          localStorage.setItem("debug-day:v2", JSON.stringify(f.data));
          localStorage.setItem(
            "debug-day:board-view:" + f.date,
            JSON.stringify({
              mode: "mindmap",
              camera: { x: 12, y: 140, z: 0.55 },
            }),
          );
        }, f);
        await page.reload();
        await page.waitForSelector("#qa", { state: "attached" });
        // Full Plan on phones as well as desktop.
        await page.evaluate(() =>
          window.dispatchEvent(
            new CustomEvent("debug-day-open-capture", { detail: "full-day" }),
          ),
        );
        const touch = mobile ? await context.newCDPSession(page) : null;
        async function drag(locator, dx, dy, during) {
          await locator.scrollIntoViewIfNeeded();
          const box = await locator.boundingBox(),
            x = box.x + box.width / 2,
            y = box.y + box.height / 2;
          if (touch) {
            await touch.send("Input.dispatchTouchEvent", {
              type: "touchStart",
              touchPoints: [{ x, y, id: 1 }],
            });
            for (let i = 1; i <= 12; i++)
              await touch.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [
                  { x: x + (dx * i) / 12, y: y + (dy * i) / 12, id: 1 },
                ],
              });
            if (during) await during();
            await touch.send("Input.dispatchTouchEvent", {
              type: "touchEnd",
              touchPoints: [],
            });
          } else {
            await page.mouse.move(x, y);
            await page.mouse.down();
            await page.mouse.move(x + dx, y + dy, { steps: 12 });
            if (during) await during();
            await page.mouse.up();
          }
        }
        const read = () =>
          page.evaluate(
            (date) =>
              JSON.parse(localStorage.getItem("debug-day:v2")).days[date],
            f.date,
          );
        const nav = async (i) => {
          if (i !== 1 && (await page.locator(".b4.focus-mode").count()))
            await page.getByRole("button",{name:t("Exit full screen","بستن تمام‌صفحه"),exact:true}).click();
          await page.locator(".views button").nth(i).click();
          if (i === 1) {
            await page.locator(".b4").waitFor();
            if (
              mobile &&
              !(await page.locator(".b4").getAttribute("class")).includes(
                "focus-mode",
              )
            )
              await page.getByRole("button",{name:t("Full screen","تمام‌صفحه"),exact:true}).click();
          }
        };
        assert.equal(
          await page
            .getByRole("button", { name: /App ?Map|^نقشهٔ? (?:کلی )?اپ$/i })
            .count(),
          0,
          "AppMap buttons are gone",
        );
        // Force a scrollbar to appear and disappear. The application's width and left edge stay put.
        const geometry = () =>
          page.locator(".app").evaluate((el) => ({
            x: el.getBoundingClientRect().x,
            w: el.getBoundingClientRect().width,
          }));
        const before = await geometry();
        await page.evaluate(() => {
          const el = document.createElement("div");
          el.id = "scrollbar-check";
          el.style.height = "6000px";
          document.body.append(el);
        });
        assert.deepEqual(await geometry(), before);
        await page.locator("#scrollbar-check").evaluate((el) => el.remove());
        assert.deepEqual(await geometry(), before);
        // Create a real lane relationship with the connector tool, in either drawing direction.
        await nav(1);
        await page.locator('[data-board-id="b:writing"]').waitFor();
        // The connector tool has no dock button any more (FigJam); use its shortcut.
        await page.locator(".b2-viewport").focus(); await page.keyboard.press("x");
        await page.locator('[data-board-id="lane:life"] .b4-node-body').click();
        await page.locator('[data-board-id="b:writing"] .b4-node-body').click();
        assert.equal((await read()).blocks[0].lane, "life");
        assert.equal(
          (await read()).canvas.board4.layouts.lanes["b:writing"],
          undefined,
        );
        await page
          .locator('[data-wire-id="auto:lane:life->b:writing"]')
          .waitFor({ state: "attached" });
        assert.equal(
          await page
            .locator('[data-wire-id="auto:lane:work->b:writing"]')
            .count(),
          0,
        );
        // The Engine page shows the same task, with its lane kept for the Lanes view.
        await nav(0);
        const row = page.locator('.dd-engine [data-engine-task="writing"]');
        await row.waitFor();
        await row.locator(".dd-engine-more").click();
        await row
          .getByRole("combobox", { name: t("Lane", "لاین"), exact: true })
          .selectOption("work");
        await row.getByRole("button", { name: /^P1 ·/ }).click();
        const tagInput = row.getByRole("textbox", { name: t("New tag", "تگ جدید"), exact: true });
        await tagInput.fill("پروژه");
        await tagInput.press("Enter");
        await tagInput.fill("cancel-me");
        await tagInput.press("Escape");
        assert.deepEqual((await read()).blocks[0].tags, ["پروژه"]);
        assert.equal((await read()).blocks[0].lane, "work");
        assert.equal(
          (await read()).canvas.board4.layouts.mindmap["b:writing"],
          undefined,
        );
        await row.locator(".dd-engine-check").click();
        assert.equal((await read()).blocks[0].done, true);
        assert.equal(
          (await read()).blocks[0].subtasks[0].children[0].done,
          true,
        );
        assert.equal(
          await page
            .locator(".dd-engine-progress[data-completion]")
            .getAttribute("data-completion"),
          "80",
        );
        await nav(1);
        await page
          .locator('[data-board-id="b:writing"]')
          .waitFor({ state: "attached" });
        assert.match(
          await page.locator(".b2-brandbar small").innerText(),
          /80|۸۰/,
        );
        // Fit the selected card, edit its metadata, then undo a membership edit.
        await page
          .locator('[data-board-id="b:writing"] .b4-node-body')
          .click({ force: true });
        const details = page.locator(".dd-card-details");
        if (!(await details.count()))
          await page
            .getByRole("button", {
              name: t("Card details", "جزئیات کارت"),
              exact: true,
            })
            .click();
        await details.waitFor();
        assert.match(
          await details.locator(".dd-task-tags").innerText(),
          /پروژه/,
        );
        await details
          .getByRole("combobox", {
            name: t("Task lane", "لاین کار"),
            exact: true,
          })
          .selectOption("life");
        assert.equal((await read()).blocks[0].lane, "life");
        await page
          .getByRole("button", { name: t("Undo", "واگرد"), exact: true })
          .click();
        assert.equal((await read()).blocks[0].lane, "work");
        await page.keyboard.press("Control+Space");
        const search = page.getByRole("dialog").getByRole("combobox");
        await search.fill("#پروژه");
        assert.ok(
          (await page
            .getByRole("listbox")
            .getByRole("option")
            .filter({ hasText: "Portfolio writing" })
            .count()) > 0,
        );
        await page.keyboard.press("Escape");
        // Quick add stores arbitrary tags without making them part of the task name.
        await nav(0);
        await page.locator("#qa").fill("New design p2 #project #شخصی");
        await page.locator("#qa").press("Enter");
        const added = (await read()).blocks.find(
          (b) => b.name === "New design",
        );
        assert.ok(added);
        assert.equal(added.pri, 2);
        assert.deepEqual(added.tags, ["project", "شخصی"]);
        await page.reload();
        await page.waitForSelector("#qa", { state: "attached" });
        assert.deepEqual(
          (await read()).blocks.find((b) => b.id === added.id).tags,
          ["project", "شخصی"],
        );
        assert.equal((await read()).blocks[0].lane, "work");
        // A fresh geometry fixture keeps both endpoints visible at a normal touch zoom.
        await page.evaluate((date) => {
          const data = JSON.parse(localStorage.getItem("debug-day:v2"));
          data.days[date].canvas.board4.layouts.mindmap["b:writing"] = {
            x: 230,
            y: 150,
          };
          data.days[date].canvas.board4.layouts.mindmap["b:long"] = {
            x: 230,
            y: 400,
          };
          localStorage.setItem("debug-day:v2", JSON.stringify(data));
          localStorage.setItem(
            "debug-day:board-view:" + date,
            JSON.stringify({
              mode: "mindmap",
              camera: { x: 12, y: 140, z: 0.55 },
            }),
          );
        }, f.date);
        await page.reload();
        await page.waitForSelector("#qa", { state: "attached" });
        await nav(1);
        // The path repaints while the pointer is still down, using actual touch on phones.
        // The connector tool has no dock button any more (FigJam); use its shortcut.
        await page.locator(".b2-viewport").focus(); await page.keyboard.press("x");
        await page.locator('[data-board-id="b:writing"] .b4-node-body').click();
        await page.locator('[data-board-id="b:long"] .b4-node-body').click();
        // A line from one task to another sets their order (5.51): Long comes
        // after Writing, stored on the task, drawn as a dashed arrow.
        assert.deepEqual((await read()).blocks.find((b) => b.id === "long").after, ["b:writing"]);
        assert.equal((await read()).canvas.board4.links.some((l) => l.from === "b:writing" && l.to === "b:long"), false, "no separate board-only line");
        const line = { id: "auto:after:b:long->b:writing" };
        await page.locator('[data-wire-id="auto:after:b:writing->b:long"][data-wire-kind="order"]').waitFor();
        if (process.env.DEBUG_DAY_SCREENSHOTS) {
          mkdirSync(process.env.DEBUG_DAY_SCREENSHOTS, { recursive: true });
          await page.screenshot({
            path: join(
              process.env.DEBUG_DAY_SCREENSHOTS,
              `connections-${language}-${mobile ? "phone" : "desktop"}.png`,
            ),
          });
        }
        // Reversing an order line reverses the order: Writing now comes after Long.
        await page.locator(".b4-selectionbar").getByRole("button", { name: t("Reverse direction", "برعکس کردن جهت"), exact: true }).click();
        await page.waitForFunction((date) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date].blocks[0].after?.[0] === "b:long", f.date);
        assert.equal("after" in (await read()).blocks.find((b) => b.id === "long"), false);
        assert.equal(
          await page
            .locator('[data-wire-id="' + line.id + '"] [marker-end]')
            .count(),
          1,
        );
        // The details panel opens only on request now (FigJam); close it if open.
        const closeProps = page.getByRole("button", { name: t("Close properties", "بستن ویژگی‌ها"), exact: true });
        if (await closeProps.count()) await closeProps.click();
        const path = page
            .locator('[data-wire-id="' + line.id + '"] [data-wire-path]')
            .first(),
          oldPath = await path.getAttribute("d");
        await drag(
          page.locator('[data-board-id="b:writing"] .b4-node-body'),
          -160,
          24,
          () =>
            page.waitForFunction(
              ({ id, old }) =>
                document
                  .querySelector('[data-wire-id="' + id + '"] [data-wire-path]')
                  ?.getAttribute("d") !== old,
              { id: line.id, old: oldPath },
            ),
        );
        assert.notEqual(await path.getAttribute("d"), oldPath);
        assert.equal((await read()).blocks[0].lane, "work");
        // Drop a whole card (including its nested steps) into another lane.
        await page.evaluate(
          (date) =>
            localStorage.setItem(
              "debug-day:board-view:" + date,
              JSON.stringify({
                mode: "lanes",
                camera: { x: 12, y: 140, z: 0.45 },
              }),
            ),
          f.date,
        );
        await page.reload();
        await page.waitForSelector("#qa", { state: "attached" });
        await nav(1);
        await page.locator(".b4-modes button").nth(1).click();
        await page.waitForSelector('.b2-viewport[data-mode="lanes"]');
        // Switching mode fits the day on the next tick; read the lane only once the camera is still.
        await page.waitForFunction(() => {
          const now = document.querySelector(".b2-world").style.transform, w = window;
          if (w.__ddCam !== now) { w.__ddCam = now; w.__ddCamAt = performance.now(); return false; }
          return performance.now() - w.__ddCamAt > 200;
        }, null, { polling: 50 });
        const task = page.locator('[data-board-id="b:writing"] .b4-node-body'),
          frame = await page
            .locator('[data-board-id="lane:life"]')
            .boundingBox(),
          box = await task.boundingBox();
        await drag(
          task,
          frame.x + frame.width * 0.25 - (box.x + box.width / 2),
          frame.y + frame.height * 0.55 - (box.y + box.height / 2),
        );
        assert.equal((await read()).blocks[0].lane, "life");
        assert.equal(
          (await read()).blocks[0].subtasks[0].children[0].id,
          "nested",
        );
        await page
          .getByRole("button", { name: t("Undo", "واگرد"), exact: true })
          .click();
        assert.equal((await read()).blocks[0].lane, "work");
        // Redo lives in the top dock's ⋯.
        await page.locator('[data-dock-more="top"]').click();
        await page
          .getByRole("menuitem", { name: t("Redo", "انجام مجدد"), exact: true })
          .click();
        assert.equal((await read()).blocks[0].lane, "life");
        await nav(0);
        await page.locator('.dd-engine [data-engine-task="writing"]').waitFor();
        if (process.env.DEBUG_DAY_SCREENSHOTS) {
          mkdirSync(process.env.DEBUG_DAY_SCREENSHOTS, { recursive: true });
          await page.screenshot({
            path: join(
              process.env.DEBUG_DAY_SCREENSHOTS,
              `connected-${language}-${mobile ? "phone" : "desktop"}.png`,
            ),
            fullPage: false,
          });
        }
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        );
        assert.deepEqual(errors, []);
        console.log(
          `Connected planner: ${language} ${mobile ? "phone" : "desktop"} passed`,
        );
        await context.close();
      }
  } finally {
    await h.stop();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

