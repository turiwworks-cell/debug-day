const assert = require("node:assert/strict");
const { mkdirSync } = require("node:fs");
const { join } = require("node:path");
const screenshots = process.env.DEBUG_DAY_SCREENSHOTS || join(require("node:os").tmpdir(), "debug-day-screenshots");
mkdirSync(screenshots, { recursive: true });
const { start, fixture } = require("./harness.cjs");
(async () => {
  const h = await start();
  try {
    for (const language of ["en"])
      for (const mobile of [false, true]) {
        const { page, context, errors } = await h.context(mobile);
        page.setDefaultTimeout(7000);
        const f = await fixture(page, h.origin);
        f.data.setup.preferences.language = language;
        f.data.days[f.date].notes.push({
          id: "note2",
          kind: "sticky",
          text: "Second thought",
          color: "#A8DAFF",
          x: 390,
          y: 80,
        });
        f.data.days[f.date].canvas = {
          board4: {
            layouts: { mindmap: {} },
            links: [
              {
                id: "link:manual",
                from: "sticky:note",
                to: "sticky:note2",
                style: "curve",
                arrow: true,
                color: "#874FFF",
              },
            ],
            locked: [],
            styles: {},
            camera: { x: 24, y: 160, z: 0.65 },
          },
        };
        const t = (en, fa) => (language === "fa" ? fa : en);
        const read = () =>
          page.evaluate(
            (date) =>
              JSON.parse(localStorage.getItem("debug-day:v2")).days[date],
            f.date,
          );
        const world = () =>
          page.locator(".b2-world").evaluate((el) => el.style.transform);
        const camera = () =>
          page
            .locator(".b2-viewport")
            .evaluate((el) => JSON.parse(el.dataset.zoom));
        const note = () => page.locator('[data-board-id="sticky:note"]');
        const note2 = () => page.locator('[data-board-id="sticky:note2"]');
        const menu = () =>
          page.getByRole("menu", {
            name: t("Board context menu", "منوی راست‌کلیک برد"),
          });
        const menuItem = (en, fa) =>
          menu().getByRole("menuitem", { name: t(en, fa), exact: true });
        const props = () => page.locator(".b6-properties");
        async function seed() {
          await page.evaluate((f) => {
            localStorage.setItem("debug-day:v2", JSON.stringify(f.data));
            localStorage.setItem(
              "debug-day:board-view:" + f.date,
              JSON.stringify({
                camera: { x: 24, y: 160, z: 0.65 },
                mode: "mindmap",
              }),
            );
          }, f);
          await page.reload();
          await page.waitForSelector("#qa", { state: "attached" });
          await page.locator(".views button").nth(1).click();
          await note().waitFor();
          await page.locator(".b2-viewport").scrollIntoViewIfNeeded();
          if (mobile)
            await page
              .locator(".b2-viewport")
              .click({ position: { x: 30, y: 140 } });
        }
        async function nodeMenu() {
          await note().locator(".dd-note-preview").click({ button: "right" });
          await menu().waitFor();
        }
        async function backgroundMenu(edge = false) {
          const r = await page.locator(".b2-viewport").boundingBox();
          await page.mouse.click(
            r.x + r.width - (edge ? 3 : 22),
            Math.min(
              r.y + r.height - (edge ? 3 : 155),
              page.viewportSize().height - (edge ? 8 : 155),
            ),
            { button: "right" },
          );
          await menu().waitFor();
        }
        async function within() {
          const b = await menu().boundingBox(),
            v = page.viewportSize();
          assert.ok(
            b.x >= 0 &&
              b.y >= 0 &&
              b.x + b.width <= v.width + 1 &&
              b.y + b.height <= v.height + 1,
            JSON.stringify({ b, v }),
          );
        }
        await seed();
        const initial = JSON.stringify(await read());
        const zoom = page.getByRole("textbox", {
          name: t("Zoom percentage", "درصد زوم"),
          exact: true,
        });
        await zoom.fill(t("125", "۱۲۵"));
        await zoom.press("Enter");
        await page.waitForFunction(
          () => document.querySelector(".b2-viewport").dataset.zoom === "1.25",
        );
        assert.equal(await camera(), 1.25);
        await zoom.fill("800");
        await zoom.press("Escape");
        assert.equal(await camera(), 1.25);
        assert.equal(await zoom.inputValue(), "125");
        await page
          .getByRole("button", {
            name: t("Zoom in", "بزرگ‌نمایی"),
            exact: true,
          })
          .click();
        await page.waitForFunction(
          () => document.querySelector(".b2-viewport").dataset.zoom === "1.5",
        );
        await zoom.fill("65");
        await zoom.press("Enter");
        // Canvas settings live in the tools dock's ⋯ (or a right-click on it).
        await page.locator('[data-dock-more="tools"]').click();
        await menuItem("Canvas settings…", "تنظیمات بوم…").click();
        const view = page.locator(".b6-view-panel");
        await view.waitFor();
        await view
          .getByRole("textbox", {
            name: t("Grid dot opacity", "شفافیت نقاط شبکه"),
            exact: true,
          })
          .fill("40");
        await view
          .getByRole("textbox", {
            name: t("Grid dot opacity", "شفافیت نقاط شبکه"),
            exact: true,
          })
          .press("Enter");
        assert.match(
          await page
            .locator(".b2-viewport")
            .evaluate((el) => el.style.getPropertyValue("--b6-dot")),
          /0\.4/,
        );
        await view
          .getByRole("button", {
            name: t("Close canvas settings", "بستن تنظیمات بوم"),
          })
          .click();
        assert.equal(
          JSON.stringify(await read()),
          initial,
          "navigation and view settings must not change planner data",
        );
        await backgroundMenu(true);
        await within();
        await menuItem("Add note here", "افزودن نوت اینجا").focus();
        await page.keyboard.press("End");
        await page.keyboard.press("Home");
        await page.keyboard.press("Escape");
        await menu().waitFor({ state: "detached" });
        assert.equal(
          await page
            .locator(".b2-viewport")
            .evaluate((el) => el === document.activeElement),
          true,
        );
        await nodeMenu();
        await within();
        await menuItem("Color & properties…", "رنگ و ویژگی‌ها…").click();
        await props().waitFor();
        const hex = props().getByRole("textbox", {
          name: t("Hex color", "کد رنگ"),
          exact: true,
        });
        await hex.fill("#12345680");
        await hex.press("Enter");
        await page.waitForFunction(date=>JSON.parse(localStorage.getItem("debug-day:v2")).days[date].notes[0].color==="#123456",f.date);
        let d = await read();
        assert.equal(d.notes[0].color, "#123456");
        assert.ok(
          Math.abs(d.canvas.board4.styles["sticky:note"].opacity - 0.502) <
            0.001,
        );
        const alpha = props().getByRole("textbox", {
          name: t("Opacity", "شفافیت"),
          exact: true,
        });
        await alpha.fill("27");
        await alpha.press("Escape");
        assert.ok(
          Math.abs(
            (await read()).canvas.board4.styles["sticky:note"].opacity - 0.502,
          ) < 0.001,
        );
        await alpha.fill("75");
        await alpha.press("Enter");
        assert.equal(
          (await read()).canvas.board4.styles["sticky:note"].opacity,
          0.75,
        );
        await props()
          .getByText(t("Position & text", "موقعیت و متن"), { exact: true })
          .click();
        const width = props().getByRole("textbox", {
          name: t("Note width", "عرض نوت"),
          exact: true,
        });
        await width.fill("320");
        await width.press("Enter");
        assert.equal(
          (await read()).canvas.board4.styles["sticky:note"].width,
          360,
        );
        await page.screenshot({
          path:
            screenshots + "/properties-" +
            language +
            "-" +
            (mobile ? "phone" : "desktop") +
            ".png",
        });
        await props()
          .getByRole("button", { name: t("Close properties", "بستن ویژگی‌ها") })
          .click();
        // Export lives in the top dock's right-click menu.
        if (!mobile && language === "en") {
          const pending = page.waitForEvent("download");
          await page.locator(".b2-top-actions").click({ button: "right", position: { x: 4, y: 4 } });
          await menuItem("Export board SVG", "خروجی SVG برد").click();
          const download = await pending,
            svg = require("node:fs").readFileSync(
              await download.path(),
              "utf8",
            );
          assert.match(svg, /opacity="0.75"/);
          assert.match(svg, /#123456/);
        }
        await nodeMenu();
        await menuItem("Copy", "کپی").click();
        await backgroundMenu();
        await menuItem("Paste here", "چسباندن اینجا").click();
        await page.waitForFunction(
          (date) =>
            JSON.parse(localStorage.getItem("debug-day:v2")).days[date].notes
              .length === 3,
          f.date,
        );
        d = await read();
        const pasted = d.notes[2];
        assert.equal(pasted.text, "Orbit idea");
        assert.equal(pasted.color, "#123456");
        assert.equal(d.canvas.board4.styles["sticky:" + pasted.id].width, 360);
        await page
          .getByRole("button", { name: t("Undo", "واگرد"), exact: true })
          .click();
        assert.equal((await read()).notes.length, 2);
        await nodeMenu();
        await menuItem("Lock", "قفل‌کردن").click();
        assert.ok((await read()).canvas.board4.locked.includes("sticky:note"));
        await nodeMenu();
        assert.equal(
          await menuItem("Delete selection", "حذف انتخاب").isEnabled(),
          false,
        );
        await menuItem("Unlock", "بازکردن قفل").click();
        await nodeMenu();
        await menuItem("Layer order", "ترتیب لایه‌ها").click();
        await menuItem("Bring to front", "آوردن به جلو").click();
        assert.equal((await read()).canvas.board4.stack.at(-1), "sticky:note");
        // Select two notes with Shift, then right-click one without collapsing selection.
        // (Clicking an already selected note starts typing, as in FigJam, so clear first.)
        await page.keyboard.press("Escape");
        await note().locator(".dd-note-preview").click();
        await page.keyboard.down("Shift");
        await note2().locator(".dd-note-preview").click();
        await page.keyboard.up("Shift");
        assert.equal(
          await page
            .locator(".b4-node.selected[data-node-kind=sticky]")
            .count(),
          2,
        );
        await nodeMenu();
        assert.equal(
          await page
            .locator(".b4-node.selected[data-node-kind=sticky]")
            .count(),
          2,
        );
        await menuItem("Align & distribute", "تراز و فاصله‌گذاری").click();
        await menuItem("Align top", "تراز بالا").click();
        d = await read();
        assert.equal(d.notes[0].y, d.notes[1].y);
        await page.screenshot({
          path:
            screenshots + "/board-" +
            language +
            "-" +
            (mobile ? "phone" : "desktop") +
            ".png",
        });
        await backgroundMenu(true);
        await within();
        await page.screenshot({
          path:
            screenshots + "/menu-" +
            language +
            "-" +
            (mobile ? "phone" : "desktop") +
            ".png",
        });
        await page.keyboard.press("Escape");
        await seed();
        const wire = page.locator('[data-wire-id="link:manual"]');
        async function wireMenu() {
          const p = await wire.locator(".b4-wire-hit").evaluate((el) => {
            const p = el.getPointAtLength(el.getTotalLength() / 2),
              q = new DOMPoint(p.x, p.y).matrixTransform(el.getScreenCTM());
            return { x: q.x, y: q.y };
          });
          await page.mouse.click(p.x, p.y, { button: "right" });
          await menu().waitFor();
        }
        await wireMenu();
        await menuItem("Opacity", "شفافیت").click();
        await menuItem("25%", "25٪").click();
        assert.equal((await read()).canvas.board4.links[0].opacity, 0.25);
        await wireMenu();
        await menuItem("Color & properties…", "رنگ و ویژگی‌ها…").click();
        const lineWidth = props().getByRole("textbox", {
          name: t("Line width", "ضخامت خط"),
          exact: true,
        });
        await lineWidth.fill("6");
        await lineWidth.press("Enter");
        assert.equal((await read()).canvas.board4.links[0].width, 6);
        await props()
          .getByRole("combobox", {
            name: t("Line pattern", "نوع خط"),
            exact: true,
          })
          .selectOption("dotted");
        assert.equal(
          await wire.locator(".b4-wire-line").getAttribute("stroke-dasharray"),
          "1 5",
        );
        await props()
          .getByRole("combobox", {
            name: t("Connection style", "شکل اتصال"),
            exact: true,
          })
          .selectOption("straight");
        assert.equal((await read()).canvas.board4.links[0].style, "straight");
        await props()
          .getByRole("button", { name: t("Close properties", "بستن ویژگی‌ها") })
          .click();
        await wireMenu();
        await menuItem("Delete connection", "حذف اتصال").click();
        assert.equal((await read()).canvas.board4.links.length, 0);
        assert.equal((await read()).notes.length, 2);
        await page
          .getByRole("button", { name: t("Undo", "واگرد"), exact: true })
          .click();
        assert.equal((await read()).canvas.board4.links.length, 1);
        await seed();
        await note().locator(".dd-note-preview").click();
        const handle = note().getByRole("button", {
          name: t("Resize note", "تغییر اندازهٔ نوت"),
          exact: true,
        });
        const box = await handle.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(
          box.x + box.width / 2 + 42,
          box.y + box.height / 2 + 27,
          { steps: 6 },
        );
        await page.mouse.up();
        assert.ok(
          (await read()).canvas.board4.styles["sticky:note"].width > 260,
        );
        await page
          .getByRole("button", { name: t("Undo", "واگرد"), exact: true })
          .click();
        assert.equal(
          (await read()).canvas.board4.styles?.["sticky:note"]?.width,
          undefined,
        );
        // Canvas settings live in the tools dock's ⋯ (or a right-click on it).
        await page.locator('[data-dock-more="tools"]').click();
        await menuItem("Canvas settings…", "تنظیمات بوم…").click();
        await view
          .getByRole("checkbox", {
            name: t(
              "Right-click and drag to pan",
              "حرکت بوم با کشیدن راست‌کلیک",
            ),
            exact: true,
          })
          .check();
        await view
          .getByRole("button", {
            name: t("Close canvas settings", "بستن تنظیمات بوم"),
          })
          .click();
        const saved = JSON.stringify(await read()),
          before = await world(),
          vp = await page.locator(".b2-viewport").boundingBox(),
          y = Math.min(
            vp.y + vp.height - 200,
            page.viewportSize().height - 170,
          );
        await page.mouse.move(vp.x + vp.width - 70, y);
        await page.mouse.down({ button: "right" });
        await page.mouse.move(vp.x + vp.width - 115, y + 25, { steps: 6 });
        await page.mouse.up({ button: "right" });
        await page.waitForTimeout(220);
        assert.equal(await menu().count(), 0);
        assert.notEqual(await world(), before);
        assert.equal(JSON.stringify(await read()), saved);
        await backgroundMenu(true);
        await page.keyboard.press("Escape");
        await page.locator(".b2-viewport").focus();
        await page.locator(".b2-viewport").evaluate((el) => {
          const transfer = new DataTransfer();
          transfer.setData("text/plain", "Pasted outside text");
          el.dispatchEvent(
            new ClipboardEvent("paste", {
              bubbles: true,
              cancelable: true,
              clipboardData: transfer,
            }),
          );
        });
        assert.equal((await read()).notes.at(-1).text, "Pasted outside text");
        await page.evaluate(
          () => (document.documentElement.dataset.theme = "dark"),
        );
        // Canvas settings live in the tools dock's ⋯ (or a right-click on it).
        await page.locator('[data-dock-more="tools"]').click();
        await menuItem("Canvas settings…", "تنظیمات بوم…").click();
        await view.waitFor();
        const inputColor = await view
          .getByRole("textbox", {
            name: t("Grid spacing", "فاصلهٔ نقاط شبکه"),
            exact: true,
          })
          .evaluate((el) => ({
            fg: getComputedStyle(el).color,
            bg: getComputedStyle(el.closest(".b6-number-input"))
              .backgroundColor,
          }));
        assert.notEqual(inputColor.fg, inputColor.bg);
        await page.screenshot({
          path:
            screenshots + "/dark-" +
            language +
            "-" +
            (mobile ? "phone" : "desktop") +
            ".png",
        });
        assert.deepEqual(errors, []);
        console.log(
          "Board controls:",
          language,
          mobile ? "phone" : "desktop",
          "passed",
        );
        await context.close();
      }
  } finally {
    await h.stop();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

