// The app says what happened and lets you take it back (5.85.4): a long step is
// readable on its card, deleting a task in the Engine offers Undo (on a phone
// too), and a planner over the sync limit says so in plain words.
const assert = require("node:assert/strict");
const { start, fixture, openEngine } = require("./harness.cjs");

(async () => {
  const h = await start();
  try {
    for (const mobile of [false, true]) {
      const { context, page, errors } = await h.context(mobile);
      const f = await fixture(page, h.origin);
      const writing = f.data.days[f.date].blocks[0];
      writing.subtasks.push(
        { id: "short", text: "Short", done: false, expanded: true, children: [] },
        { id: "gallery", text: "Ask the gallery whether the frames should be oak or walnut, and whether they can deliver before the opening night next Thursday evening", done: false, expanded: true, children: [] },
      );
      f.data.days[f.date].notes = [];
      await page.evaluate((d) => localStorage.setItem("debug-day:v2", JSON.stringify(d)), f.data);
      await page.reload();
      await page.waitForSelector(".views", { state: "attached" });

      // Steps: every word fits its card, or the card ends with "…"; cards never overlap.
      await page.locator('.views button[data-panel="board"]').click();
      await page.locator(".b4").waitFor();
      if (mobile && !(await page.locator(".b4").getAttribute("class")).includes("focus-mode"))
        await page.getByRole("button", { name: "Full screen", exact: true }).click();
      await page.locator(".b4-node.b4-subtask").first().waitFor();
      const steps = await page.evaluate(() =>
        [...document.querySelectorAll(".b4-node.b4-subtask")].map((n) => {
          const title = n.querySelector(".b4-node-title"), box = n.getBoundingClientRect();
          return { text: title.textContent, fits: title.scrollHeight <= title.clientHeight + 1, top: box.top, bottom: box.bottom, left: box.left };
        }),
      );
      for (const step of steps) assert.ok(step.fits, "a step's words fit its card: " + step.text.slice(0, 30));
      const column = steps.filter((s) => Math.abs(s.left - steps.find((x) => x.text === "Short").left) < 2).sort((a, b) => a.top - b.top);
      for (let i = 1; i < column.length; i++) assert.ok(column[i].top >= column[i - 1].bottom - 1, "steps in one column do not overlap");

      // Delete in the Engine: a calm message with Undo, and Undo brings it all back.
      const engine = await openEngine(page);
      await engine.getByRole("button", { name: "More for: Long research", exact: true }).click();
      await engine.getByRole("button", { name: "Delete", exact: true }).click();
      const toast = page.locator(".toast");
      await toast.waitFor();
      assert.match(await toast.innerText(), /Task deleted/i);
      const undo = toast.getByRole("button", { name: "Undo", exact: true }), box = await undo.boundingBox();
      assert.equal(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest(".toast"), { x: box.x + box.width / 2, y: box.y + box.height / 2 }), true, "Undo is on top, above the Engine");
      assert.equal((await page.evaluate((date) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date].blocks.map((b) => b.id), f.date)).includes("long"), false);
      await undo.click();
      await page.waitForFunction((date) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date].blocks.some((b) => b.id === "long"), f.date);
      const back = await page.evaluate((date) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date].blocks.find((b) => b.id === "long"), f.date);
      assert.equal(back.name, "Long research");
      assert.equal(back.min, 720, "it comes back as it was");
      await engine.locator('[data-engine-task="long"]').waitFor();
      await page.keyboard.press("Escape");
      await page.locator(".dd-engine").waitFor({ state: "detached" });
      assert.deepEqual(errors, []);
      await context.close();
    }

    // Over the sync limit: the reason in plain words, and nothing is lost.
    {
      const { context, page } = await h.context(false);
      const f = await fixture(page, h.origin);
      await page.evaluate((d) => localStorage.setItem("debug-day:v2", JSON.stringify(d)), f.data);
      await page.route("**/api/sync", (route) =>
        route.request().method() === "PUT"
          ? route.fulfill({ status: 413, contentType: "application/json", body: JSON.stringify({ error: "Planner exceeds the 1.5 MB sync limit." }) })
          : route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ revision: 0, data: null }) }),
      );
      await page.evaluate((origin) => localStorage.setItem("debug-day:cloud-config", JSON.stringify({ url: origin, key: "s".repeat(64) })), h.origin);
      await page.reload();
      await page.waitForSelector(".views", { state: "attached" });
      const badge = page.locator(".dd-cloud-mini").first();
      await page.waitForFunction(() => document.querySelector(".dd-cloud-mini")?.dataset.status === "error");
      assert.match(await badge.innerText(), /Sync paused · over 1\.5 MB/);
      // Hovering "Sync paused" tells why.
      const cloud = await badge.getAttribute("title");
      assert.match(cloud, /over the 1\.5 MB sync limit/);
      assert.match(cloud, /Nothing is lost/);
      assert.doesNotMatch(cloud, /backup is invalid/i, "it no longer blames a backup");
      assert.equal(await page.evaluate((date) => !!JSON.parse(localStorage.getItem("debug-day:v2")).days[date], f.date), true, "the planner stays on this device");
      await context.close();
    }
    console.log("undo and limits: readable steps, Undo after delete, plain sync-limit message");
  } finally {
    await h.stop();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
