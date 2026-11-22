const assert = require("node:assert/strict");
const { start, fixture } = require("./harness.cjs");
const { join } = require("node:path");
const { mkdirSync, mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { pathToFileURL } = require("node:url");

// Local fixture only; no connection to the person's planner.
async function seed(page, origin) {
  const f = await fixture(page, origin);
  const section = (id, text, x, y, w, h, parent = "", color = "#9DD6FF") =>
    ({ id, type: "section", parent, text, x, y, w, h, color, ownColor: true });
  const note = (id, text, parent, x, y, extra = {}) =>
    ({ id, type: "sticky", parent, text, x, y, w: 240, h: 180, color: "#FFE299", ...extra });
  f.data.setup.life = { v: 2, frame: { x: 40, y: 1200 }, links: [], items: [
    { ...section("personal", "The Way", 40, 40, 720, 660, "", "#A8E6B8"), due: "2099-12-01" },
    { ...section("work", "Job", 820, 40, 920, 780, "", "#9DD6FF"), due: "2099-12-01" },
    section("outreach", "Outreach", 24, 40, 840, 680, "work", "#D3B8FF"),
    section("research", "Research", 24, 240, 500, 330, "outreach"),
    note("goal", "Build a rhythm that lasts", "personal", 24, 40, { role: "goal" }),
    note("step", "Read the next chapter", "personal", 300, 40),
    note("out-goal", "Find thoughtful startup teams", "outreach", 24, 24, { role: "goal" }),
    note("lead", "Review the next three leads", "research", 24, 40),
    section("other1", "projects", 40, 850, 420, 300),
    section("other2", "Projects", 500, 850, 420, 300),
  ] };
  Object.assign(f.data.setup.preferences, { boardRailGoal: false, boardRailNote: false, boardRailHabits: false, phoneToday: false });
  await page.evaluate(({ data, date }) => {
    localStorage.setItem("debug-day:v2", JSON.stringify(data));
    localStorage.setItem("debug-day:board-view:" + date, JSON.stringify({ mode: "mindmap", camera: { x: 30, y: -545, z: 0.5 } }));
  }, f);
  await page.reload();
  await page.locator('[data-panel="board"][role="tab"]').click();
  await page.locator(".b2-viewport").waitFor();
  return f;
}

(async () => {
  const h = await start(), folder = mkdtempSync(join(tmpdir(), "dd-project-export-"));
  try {
    const { page, errors } = await h.context(false);
    const f = await seed(page, h.origin);
    page.setDefaultTimeout(10000);
    const tab = (id) => page.locator(`.views [data-panel="${id}"]`),
      item = (id) => page.locator(`[data-board-id="life:${id}"]`),
      card = (id) => page.locator(`.dd-project-card[data-project-id="${id}"]`),
      read = () => page.evaluate(() => JSON.parse(localStorage.getItem("debug-day:v2"))),
      menu = () => page.getByRole("menu", { name: "Board context menu" }),
      menuItem = (name) => menu().getByRole("menuitem", { name, exact: true }),
      openMenu = async (id) => {
        await item(id).locator(':scope>.b4-node-body').click({ button: "right" });
        await menu().waitFor();
      },
      action = async (id, name) => { await openMenu(id); await menuItem(name).click(); await menu().waitFor({ state: "detached" }); },
      selected = (id) => page.locator(`[data-board-id="life:${id}"][aria-selected="true"]`),
      board = page.locator(".b2-viewport"),
      snap = () => page.locator("[data-life-id]").evaluateAll((nodes) => nodes.map((n) => ({ id: n.dataset.lifeId, x: n.offsetLeft, y: n.offsetTop, w: n.offsetWidth, h: n.offsetHeight, color: getComputedStyle(n).getPropertyValue("--node-color") }))),
      dir = process.env.DD_SCREENSHOTS || process.env.DEBUG_DAY_SCREENSHOTS,
      shot = async (name, p = page) => { if (dir) { mkdirSync(dir, { recursive: true }); await p.screenshot({ path: join(dir, name + ".png"), animations: "disabled" }); } };
    await page.waitForFunction(() => document.querySelector(".b2-viewport")?.dataset.zoom === "0.5");
    await page.waitForTimeout(300);
    await shot(process.env.DD_BASELINE ? "projects-board-base" : "projects-board-unmarked");
    if (process.env.DD_BASELINE) {
      assert.deepEqual(errors, []);
      console.log("baseline board captured");
      return;
    }
    const original = await read(), beforeGeometry = await snap();
    await action("personal", "Make it a project");
    await action("outreach", "Make it a project");
    await action("research", "Make it a subproject");
    await action("step", "Continue from here");
    await action("lead", "Continue from here");
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("debug-day:v2")).setup.life.items.find((i) => i.id === "outreach").nextNoteId === "lead");
    const marked = await read();
    assert.deepEqual(marked.setup.life.items.map(({ projectKind, nextNoteId, ...i }) => i), original.setup.life.items);
    assert.deepEqual(marked.setup.life.links, original.setup.life.links);
    assert.deepEqual(await snap(), beforeGeometry, "marking a section changes no board geometry or colour");
    await board.focus(); await page.keyboard.press("Escape");
    await shot("projects-board-marked");
    // The ordinary Board tools continue to work on marked sections.
    await item("personal").locator(":scope>.b4-node-body").click();
    await page.getByRole("button", { name: "Collapse section", exact: true }).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("debug-day:v2")).setup.life.items.find((i) => i.id === "personal").collapsed);
    await page.getByRole("button", { name: "Expand section", exact: true }).click();
    await page.waitForFunction(() => !JSON.parse(localStorage.getItem("debug-day:v2")).setup.life.items.find((i) => i.id === "personal").collapsed);
    const header = await item("personal").locator(":scope>.b4-node-body").boundingBox();
    await page.mouse.move(header.x + header.width / 2, header.y + header.height / 2);
    await page.mouse.down(); await page.mouse.move(header.x + header.width / 2 - 28, header.y + header.height / 2 + 20, { steps: 8 }); await page.mouse.up();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("debug-day:v2")).setup.life.items.find((i) => i.id === "personal").x !== 40);
    await board.focus(); await page.keyboard.press("Control+z");
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("debug-day:v2")).setup.life.items.find((i) => i.id === "personal").x === 40);

    await tab("projects").click();
    assert.equal(await page.locator(".dd-project-card").count(), 2, "only manually marked projects");
    assert.match(await card("personal").innerText(), /The Way[\s\S]*Build a rhythm that lasts[\s\S]*Read the next chapter/);
    assert.equal(await card("personal").locator(".dd-project-due").count(), 1);
    assert.equal(await card("outreach").locator(".dd-project-due").count(), 0, "Job's date is not inherited");
    assert.equal(await card("outreach").locator(".dd-project-details").count(), 0);
    await shot("projects-desktop");
    await card("outreach").getByRole("button", { name: "Details" }).click();
    assert.match(await card("outreach").locator(".dd-project-details").innerText(), /Research/);
    await card("personal").locator("[data-project-open]").click();
    await selected("personal").waitFor();
    await tab("projects").click();
    await card("outreach").locator("[data-project-next]").click();
    await selected("lead").waitFor();
    await openMenu("lead"); await menuItem("Edit text").click();
    const editor = item("lead").locator(".dd-live");
    await editor.waitFor(); await editor.fill("Review three leads and their sites"); await editor.press("Control+Enter");
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("debug-day:v2")).setup.life.items.find((i) => i.id === "lead").text === "Review three leads and their sites");
    await tab("projects").click();
    assert.equal(await card("outreach").locator("[data-project-next]").innerText(), "Review three leads and their sites");

    // Record an event without navigating or rearranging the board.
    const oldItems = (await read()).setup.life.items;
    await card("personal").getByRole("button", { name: "Record an event", exact: true }).click();
    await card("personal").getByRole("textbox", { name: "What happened today?" }).fill("Read chapter one");
    await card("personal").getByRole("button", { name: "Save", exact: true }).click();
    await card("personal").locator('[data-project-history="log"]').waitFor();
    assert.equal(await tab("projects").getAttribute("aria-selected"), "true");
    const recorded = (await read()).setup.life.items, log = recorded.find((i) => i.projectLog);
    assert.deepEqual(recorded.filter((i) => i.id !== log.id), oldItems);
    assert.equal(log.parent, "personal");
    assert.equal(log.at, f.date);
    await shot("projects-details");

    // The same task opens in the Engine, even when it was completed.
    await card("outreach").locator("[data-project-send]").click();
    const engine = page.getByRole("dialog", { name: "Engine", exact: true });
    await engine.waitFor();
    await page.waitForFunction((date) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date].blocks.some((b) => b.noteRef === "lead"), f.date);
    const task = (await read()).days[f.date].blocks.find((b) => b.noteRef === "lead");
    assert.equal(task.projectRef, "outreach");
    const row = engine.locator(`[data-engine-task="${task.id}"]`);
    await row.locator(".dd-engine-check").click();
    await page.waitForFunction(([date, id]) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date].blocks.find((b) => b.id === id).done, [f.date, task.id]);
    await row.locator(".dd-engine-more").click();
    await row.locator('[data-action="origin-note"]').click();
    await selected("lead").waitFor();
    await tab("projects").click();
    await card("outreach").locator("[data-project-send]").click();
    await row.waitFor();
    assert.equal((await read()).days[f.date].blocks.filter((b) => b.noteRef === "lead").length, 1);
    await page.keyboard.press("Escape"); await engine.waitFor({ state: "detached" });
    await tab("projects").click();
    await page.reload(); await tab("projects").waitFor();
    assert.equal(await tab("projects").getAttribute("aria-selected"), "true");
    await card("outreach").getByRole("button", { name: "Details" }).click();
    assert.match(await card("outreach").locator('[data-project-history="done"]').innerText(), /Review three leads and their sites/);
    await card("personal").getByRole("button", { name: "Details" }).click();
    await card("personal").locator('[data-project-history="log"] button').click();
    await selected(log.id).waitFor();
    assert.equal((await read()).setup.life.items.find((i) => i.id === "lead").text, "Review three leads and their sites");

    // A real menu move and delete both clear the continuation, without affecting
    // the completed task. Removing a role never removes the section.
    await tab("projects").click(); await card("outreach").locator("[data-project-next]").click();
    await selected("lead").waitFor(); await openMenu("lead");
    await menuItem("Send to").click(); await menuItem("Out of its section").click();
    // This moved it out of Research but still inside Outreach. It remains a valid continuation.
    await tab("projects").click(); await card("outreach").locator("[data-project-next]").waitFor();
    await card("outreach").locator("[data-project-next]").click(); await selected("lead").waitFor();
    await openMenu("lead"); await menuItem("Send to").click(); await menuItem("Out of its section").click();
    await tab("projects").click();
    assert.equal(await card("outreach").locator("[data-project-next]").count(), 0);
    assert.equal((await read()).setup.life.items.find((i) => i.id === "outreach").nextNoteId, undefined);
    await card("personal").locator("[data-project-next]").click(); await selected("step").waitFor();
    await action("step", "Delete selection");
    await tab("projects").click();
    assert.equal(await card("personal").locator("[data-project-next]").count(), 0);
    const saved = await read();
    assert.deepEqual(errors, []);

    // The actual standalone export must include the module and its metadata.
    await page.locator(".foot .utilities button").last().click();
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download standalone HTML", exact: true }).click();
    const file = join(folder, "projects.html");
    await (await pending).saveAs(file);
    const offline = await h.browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: "Asia/Tehran" });
    await offline.route("http**/*", (route) => route.abort());
    const off = await offline.newPage(), offlineErrors = [];
    off.on("pageerror", (error) => offlineErrors.push(error.message));
    await off.goto(pathToFileURL(file).href);
    await off.locator('.views [data-panel="projects"]').click();
    assert.equal(await off.locator(".dd-project-card").count(), 2);
    await off.locator('[data-project-id="outreach"]').getByRole("button", { name: "Details" }).click();
    await off.locator('[data-project-history="done"]').waitFor();
    assert.deepEqual(offlineErrors, []);
    await offline.close();

    // Mobile and mixed-direction copy, with the same underlying records.
    const mobile = await h.context(true);
    await fixture(mobile.page, h.origin);
    saved.setup.preferences.language = "fa";
    await mobile.page.evaluate((data) => { localStorage.setItem("debug-day:v2", JSON.stringify(data)); localStorage.setItem("debug-day:ui", JSON.stringify({ view: "projects" })); }, saved);
    await mobile.page.reload();
    await mobile.page.locator(".dd-projects").waitFor();
    assert.equal(await mobile.page.locator(".dd-projects").getAttribute("dir"), "rtl");
    assert.equal(await mobile.page.locator(".dd-project-card").count(), 2);
    assert.equal(await mobile.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await shot("projects-mobile-fa", mobile.page);
    assert.deepEqual(mobile.errors, []);
    await mobile.context.close();
    console.log("Projects: board menus, continuation, log, Engine, reload, stale refs, offline export and mobile passed");
  } finally { await h.stop(); rmSync(folder, { recursive: true }); }
})().catch((e) => { console.error(e); process.exit(1); });
