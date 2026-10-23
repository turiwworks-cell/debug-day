const assert = require("node:assert/strict");
const { start, fixture } = require("./harness.cjs");
const { mkdirSync } = require("node:fs");
const path = require("node:path");
const screenshots = process.env.DD_QA_SCREENSHOTS;
if (screenshots) mkdirSync(screenshots, { recursive: true });
const shift = (date, amount) => {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
};
const read = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("debug-day:v2")));
async function scenario(h, mobile, language) {
  const { context, page, errors } = await h.context(mobile),
    f = await fixture(page, h.origin),
    fa = language === "fa",
    t = (en, other) => (fa ? other : en);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const empty = shift(f.date, -2),
    next = shift(f.date, 1);
  f.data.setup.preferences.language = language;
  f.data.setup.reminders = [
    {
      id: "weekly",
      date: f.last,
      title: "Weekly reminder",
      repeat: "weekly",
      done: false,
      type: "writing",
      lane: "work",
      min: 30,
      note: "",
    },
  ];
  f.data.days[f.last].journal = "Last week journal";
  f.data.days[f.last].bugs = [
    {
      id: "past-feeling",
      text: "An old feeling",
      category: "inner",
      fixed: false,
      antidote: "",
    },
  ];
  f.data.days[f.date].canvas = {
    board4: {
      links: [
        {
          id: "feeling-link",
          from: "bug:feeling",
          to: "b:writing",
          label: "made starting harder",
        },
      ],
      layouts: {
        mindmap: {
          "bug:feeling": { x: 10, y: 20 },
          "b:writing": { x: 200, y: 20 },
        },
      },
    },
  };
  await page.evaluate((f) => {
    localStorage.setItem("debug-day:v2", JSON.stringify(f.data));
    localStorage.setItem("debug-day:feeling-drafts", JSON.stringify([]));
  }, f);
  await page.reload();
  await page.waitForSelector(".views", { state: "attached" });
  const baseline = await read(page);
  const activate = (locator) => (mobile ? locator.tap() : locator.click());
  const nav = (index) => activate(page.locator(".views button").nth(index));
  // Day, Feelings and Stats are sections of the one Calendar tab.
  async function section(id) {
    await nav(2);
    const tab = page.locator(
      `.dd-review-sections button[data-panel="${id === "day" ? "calendar" : id}"]`,
    );
    await tab.waitFor();
    if ((await tab.getAttribute("aria-selected")) !== "true") await activate(tab);
    await page.waitForSelector(`.dd-review-root[data-section="${id}"]`);
  }
  async function select(date) {
    for (let i = 0; i < 14; i++) {
      const cell = page.locator(`[data-review-date="${date}"]`);
      if (await cell.count()) {
        await activate(cell);
        await page.waitForFunction(
          (date) =>
            document.querySelector(".dd-review-day time")?.dateTime === date,
          date,
        );
        return;
      }
      const first = await page
        .locator("[data-review-date]")
        .first()
        .getAttribute("data-review-date");
      await activate(
        page.getByRole("button", {
          name:
            date < first
              ? t("Previous month", "ماه قبل")
              : t("Next month", "ماه بعد"),
          exact: true,
        }),
      );
    }
    throw Error("Date not reachable: " + date);
  }
  await section("day");
  await page.waitForSelector(".dd-review-calendar");
  assert.equal(await page.locator("[data-review-date]").count(), 42);
  assert.equal(
    await page.locator(".dd-review-system select").inputValue(),
    fa ? "persian" : "gregory",
  );
  await select(f.last);
  if (mobile)
    await page.waitForFunction(
      () =>
        document.querySelector(".dd-review-day").getBoundingClientRect().top <
        100,
    );
  assert.match(
    await page.locator(".dd-review-day").innerText(),
    /Last week outreach/,
  );
  // Calendar reads the note and feelings; writing them happens in Feelings.
  assert.equal(
    await page.locator("#dd-calendar-day .dd-review-note-text").innerText(),
    "Last week journal",
  );
  assert.equal(
    await page
      .getByRole("textbox", { name: t("Day note", "یادداشت روز"), exact: true })
      .count(),
    0,
  );
  assert.equal(
    await page.locator('[data-feeling-id="past-feeling"]').count(),
    1,
  );
  assert.equal(await page.locator('[data-feeling-id="feeling"]').count(), 0);
  await select(empty);
  assert.equal(await page.locator("[data-review-task]").count(), 0);
  assert.deepEqual(
    await read(page),
    baseline,
    "Browsing dates must be read-only",
  );
  assert.equal(
    await page
      .getByRole("textbox", { name: t("Feeling text", "متن احساس"), exact: true })
      .count(),
    0,
  );
  await activate(
    page.getByRole("button", {
      name: t("Write in Feelings", "نوشتن در احساسات"),
      exact: true,
    }),
  );
  await page.waitForSelector("#dd-feelings-day");
  assert.equal(
    await page.locator(".dd-review-day time").getAttribute("dateTime"),
    empty,
    "Feelings opens on the day chosen in Calendar",
  );
  const input = page.getByRole("textbox", {
    name: t("Feeling text", "متن احساس"),
    exact: true,
  });
  await input.fill("Draft belonging to the empty day");
  await select(f.date);
  assert.equal(await input.inputValue(), "");
  await input.fill("Today draft");
  await select(empty);
  assert.equal(await input.inputValue(), "Draft belonging to the empty day");
  await activate(
    page.getByRole("button", {
      name: t("Save feeling", "ثبت احساس"),
      exact: true,
    }),
  );
  await page.waitForFunction(
    (date) =>
      JSON.parse(localStorage.getItem("debug-day:v2")).days[date]?.bugs
        .length === 1,
    empty,
  );
  let data = await read(page),
    id = data.days[empty].bugs[0].id;
  assert.deepEqual(
    data.days[empty].blocks,
    [],
    "Logging a feeling must not insert template tasks",
  );
  assert.equal(data.days[f.date].bugs.length, 1);
  await activate(
    page.getByRole("button", { name: t("Very good", "خیلی خوب"), exact: true }),
  );
  await page
    .getByRole("textbox", { name: t("Day note", "یادداشت روز"), exact: true })
    .fill("A note for the selected day");
  // The focus is written in the Plan header, for the same day.
  await nav(0);
  await page.locator("#fFocus").fill("One calm step");
  await page.waitForFunction(
    (date) =>
      JSON.parse(localStorage.getItem("debug-day:v2")).days[date]?.focus ===
      "One calm step",
    empty,
  );
  await section("feelings");
  await select(empty);
  let row = page.locator(`[data-feeling-id="${id}"]`);
  await activate(
    row.getByRole("button", {
      name: t("Close entry", "بستن این مورد"),
      exact: true,
    }),
  );
  await activate(
    row.getByRole("button", {
      name: t("Reopen", "باز کردن دوباره"),
      exact: true,
    }),
  );
  await activate(
    row.getByRole("button", { name: t("Edit", "ویرایش"), exact: true }),
  );
  await row
    .getByRole("textbox", { name: t("Feeling text", "متن احساس"), exact: true })
    .fill("Edited feeling");
  await select(f.date);
  await select(empty);
  await activate(
    row.getByRole("button", { name: t("Edit", "ویرایش"), exact: true }),
  );
  assert.equal(
    await row
      .getByRole("textbox", {
        name: t("Feeling text", "متن احساس"),
        exact: true,
      })
      .inputValue(),
    "Edited feeling",
    "Unfinished edits survive switching dates",
  );
  await activate(
    row.getByRole("button", {
      name: t("Save changes", "ذخیرهٔ تغییرات"),
      exact: true,
    }),
  );
  await activate(
    row.getByRole("button", { name: t("Delete", "حذف"), exact: true }),
  );
  await activate(
    row.getByRole("button", { name: t("Cancel", "لغو"), exact: true }),
  );
  assert.equal(await row.count(), 1, "Cancel deletion keeps the feeling");
  await section("feelings");
  assert.equal(await page.locator(".dd-review-tasks").count(), 0);
  assert.equal(
    await page.locator(".statview").count(),
    0,
    "Charts live in the Stats section, not under Feelings",
  );
  assert.equal(await input.inputValue(), "");
  await select(f.date);
  assert.equal(await input.inputValue(), "Today draft");
  const original = page.locator('[data-feeling-id="feeling"]');
  assert.match(
    await original.innerText(),
    /made starting harder/,
    "Existing board connections remain readable",
  );
  await activate(
    original.getByRole("button", { name: t("Edit", "ویرایش"), exact: true }),
  );
  await original
    .getByRole("textbox", { name: t("Feeling text", "متن احساس"), exact: true })
    .fill("Creative uncertainty, updated");
  await activate(
    original.getByRole("button", {
      name: t("Save changes", "ذخیرهٔ تغییرات"),
      exact: true,
    }),
  );
  data = await read(page);
  assert.equal(
    data.days[f.date].bugs[0].on,
    "Portfolio",
    "Editing preserves older task associations",
  );
  assert.deepEqual(
    data.days[f.date].canvas,
    baseline.days[f.date].canvas,
    "Reading or editing feelings preserves board content",
  );
  // Optional related task also survives the app's real normalizer and reload.
  await activate(
    page.locator(".dd-review-feeling-form").first().locator("summary"),
  );
  await page
    .getByRole("combobox", {
      name: t("Related task", "کار مرتبط"),
      exact: true,
    })
    .first()
    .selectOption("writing");
  await activate(
    page.getByRole("button", {
      name: t("Save feeling", "ثبت احساس"),
      exact: true,
    }),
  );
  await page.waitForFunction(
    (date) =>
      JSON.parse(localStorage.getItem("debug-day:v2")).days[date].bugs
        .length === 2,
    f.date,
  );
  await page.reload();
  await page.waitForSelector(".views", { state: "attached" });
  await section("feelings");
  await select(f.date);
  data = await read(page);
  const linked = data.days[f.date].bugs.find(
    (item) => item.text === "Today draft",
  );
  assert.equal(linked.blockId, "writing");
  assert.equal(linked.on, "Portfolio writing");
  await select(empty);
  assert.equal(
    await page
      .getByRole("textbox", { name: t("Day note", "یادداشت روز"), exact: true })
      .inputValue(),
    "A note for the selected day",
  );
  assert.equal(
    await page
      .getByRole("button", { name: t("Very good", "خیلی خوب"), exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  row = page.locator(`[data-feeling-id="${id}"]`);
  assert.match(await row.innerText(), /Edited feeling/);
  await activate(
    row.getByRole("button", { name: t("Delete", "حذف"), exact: true }),
  );
  await activate(
    row.getByRole("button", {
      name: t("Confirm delete", "تأیید حذف"),
      exact: true,
    }),
  );
  assert.equal(await row.count(), 0);
  assert.match(
    await page.locator(`[data-review-date="${empty}"]`).innerText(),
    new RegExp(t("Note", "یادداشت")),
    "A day containing only a journal still has a visible calendar marker",
  );
  await page
    .locator(".dd-review-system select")
    .selectOption(fa ? "gregory" : "persian");
  await page.reload();
  await page.waitForSelector(".views", { state: "attached" });
  await section("day");
  assert.equal(
    await page.locator(".dd-review-system select").inputValue(),
    fa ? "gregory" : "persian",
  );
  await page
    .locator(".dd-review-system select")
    .selectOption(fa ? "persian" : "gregory");
  await select(f.date);
  const task = page.locator('[data-review-task="writing"]');
  await activate(
    task.getByRole("button", {
      name: t("Toggle task: ", "تغییر وضعیت کار: ") + "Portfolio writing",
      exact: true,
    }),
  );
  data = await read(page);
  assert.equal(data.days[f.date].blocks[0].subtasks[0].children[0].done, true);
  await activate(
    task.getByRole("button", {
      name: t("Toggle task: ", "تغییر وضعیت کار: ") + "Portfolio writing",
      exact: true,
    }),
  );
  await activate(
    task.getByRole("button", { name: "Portfolio writing", exact: true }),
  );
  await page.waitForFunction(
    () =>
      document.querySelector(".views [aria-selected=true]") ===
      document.querySelector(".views button"),
  );
  if (mobile)
    assert.equal(
      await page
        .locator("body")
        .evaluate((node) => node.classList.contains("dd-phone-today")),
      false,
      "Opening a task reveals full Plan details on a phone",
    );
  await section("day");
  await select(f.date);
  await activate(task.locator("summary"));
  await task
    .getByLabel(t("New date for ", "تاریخ جدید برای ") + "Portfolio writing", {
      exact: true,
    })
    .fill(next);
  await activate(
    task.getByRole("button", {
      name: t("Move task", "انتقال کار"),
      exact: true,
    }),
  );
  data = await read(page);
  assert.equal(
    data.days[f.date].blocks.some((item) => item.id === "writing"),
    false,
  );
  assert.equal(
    data.days[next].blocks[0].subtasks[0].children[0].text,
    "Nested outline",
  );
  assert.equal(
    data.days[f.date].canvas.board4.links.length,
    0,
    "Moving a task removes its stale source connections",
  );
  await page
    .getByRole("textbox", {
      name: t("New task for this day", "کار جدید برای این روز"),
      exact: true,
    })
    .fill("A clear next step");
  await activate(
    page.getByRole("button", {
      name: t("Add task", "افزودن کار"),
      exact: true,
    }),
  );
  await page.waitForFunction(
    (date) =>
      JSON.parse(localStorage.getItem("debug-day:v2")).days[date].blocks.some(
        (item) => item.name === "A clear next step",
      ),
    f.date,
  );
  const reminder = page
    .locator(".dd-review-reminder")
    .filter({ hasText: "Weekly reminder" });
  await activate(
    reminder.getByRole("button", {
      name: t("Make a task in Plan", "تبدیل به کار در پلن"),
      exact: true,
    }),
  );
  await page.waitForFunction(
    (date) =>
      JSON.parse(localStorage.getItem("debug-day:v2")).days[date].blocks.some(
        (item) => item.name === "Weekly reminder",
      ),
    f.date,
  );
  await section("day");
  await select(f.date);
  assert.equal(
    await reminder
      .getByRole("button", {
        name: t("Make a task in Plan", "تبدیل به کار در پلن"),
        exact: true,
      })
      .count(),
    0,
  );
  await page.reload();
  await page.waitForSelector(".views");
  await section("day");
  await select(f.date);
  assert.equal(
    await reminder
      .getByRole("button", {
        name: t("Make a task in Plan", "تبدیل به کار در پلن"),
        exact: true,
      })
      .count(),
    0,
    "Occurrence completion survives normalization and reload",
  );
  // Date controls and keyboard change only selection, and the UI fits either language.
  const beforeNav = await read(page);
  await page.locator(`[data-review-date="${f.date}"]`).focus();
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(
    (date) => document.querySelector(".dd-review-day time")?.dateTime === date,
    shift(f.date, 7),
  );
  assert.equal(
    await reminder
      .getByRole("button", {
        name: t("Make a task in Plan", "تبدیل به کار در پلن"),
        exact: true,
      })
      .count(),
    1,
    "Completing one occurrence keeps future reminders active",
  );
  assert.deepEqual(await read(page), beforeNav);
  await activate(
    page
      .locator(".dd-review-month-controls")
      .getByRole("button", { name: t("Today", "امروز"), exact: true }),
  );
  assert.equal(
    await page.locator(".dd-review-day time").getAttribute("dateTime"),
    f.date,
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    true,
  );
  await section("feelings");
  await select(empty);
  await section("stats");
  assert.match(
    await page.locator(".dd-review-stats").innerText(),
    /One calm step/,
    "Stats share the selected day with the monthly calendar",
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    true,
    "Stats fit on mobile too",
  );
  await activate(page.locator(".dd-review-stats .pattern-banner button.btn.solid"));
  await page.waitForFunction(
    () =>
      document.querySelector(".views [aria-selected=true]") ===
      document.querySelector(".views button"),
  );
  assert.equal(
    await page.locator("#fFocus").inputValue(),
    "One calm step",
    "Open Day in Plan opens the same day shown by the charts",
  );
  await section("feelings");
  await page.keyboard.press("Control+Space");
  const search = page.getByRole("combobox", {
    name: t("Search everything", "جست‌وجوی همه‌چیز"),
    exact: true,
  });
  await search.fill(">stats");
  await page
    .getByRole("listbox")
    .getByRole("option")
    .filter({ hasText: t("Stats", "آمار") })
    .first()
    .waitFor();
  await search.press("Enter");
  await page.waitForSelector(".dd-command-modal", { state: "hidden" });
  await page.waitForSelector('.dd-review-sections button[data-panel="stats"][aria-selected="true"]');
  await section("day");
  const captured = shift(f.date, -3);
  await select(captured);
  await activate(
    page.getByRole("button", {
      name: t("Quick capture", "ثبت سریع"),
      exact: true,
    }),
  );
  const dialog = page.getByRole("dialog", {
    name: t("Quick capture", "ثبت سریع"),
    exact: true,
  });
  await activate(
    dialog.getByRole("button", { name: t("Feeling", "احساس"), exact: true }),
  );
  await dialog
    .getByRole("textbox", { name: t("Capture text", "متن ثبت"), exact: true })
    .fill("Captured on the chosen day");
  await activate(
    dialog.getByRole("button", { name: t("Capture", "ثبت"), exact: true }),
  );
  data = await read(page);
  assert.equal(data.days[captured].bugs[0].text, "Captured on the chosen day");
  assert.deepEqual(
    data.days[captured].blocks,
    [],
    "Quick capture also keeps empty review days free of template tasks",
  );
  await section("feelings");
  await select(f.date);
  if (screenshots) {
    await page.screenshot({
      path: path.join(
        screenshots,
        `feelings-${language}-${mobile ? "phone" : "desktop"}.png`,
      ),
      fullPage: true,
    });
    await section("day");
    await page.screenshot({
      path: path.join(
        screenshots,
        `calendar-${language}-${mobile ? "phone" : "desktop"}.png`,
      ),
      fullPage: true,
    });
  }
  assert.deepEqual(errors, [], "No runtime errors");
  await context.close();
  console.log(
    `Day review scenarios passed: ${language} ${mobile ? "phone" : "desktop"}`,
  );
}
(async () => {
  const h = await start();
  try {
    for (const language of ["en", "fa"])
      for (const mobile of [false, true]) await scenario(h, mobile, language);
  } finally {
    await h.stop();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
