// A calm weekly look at Pauses and feelings (5.89.0): the week's look back
// shows the days paused with Pause the day (with the outside event's name once
// it has one) and the feelings & events noted, in your own words, by how many
// days. A pause on the Board shows there at once. (The app runs in English;
// the Persian words are checked in tests/week.test.mjs.)
const assert = require("node:assert/strict");
const { start, fixture } = require("./harness.cjs");

const event = (id, text) => ({ id, text, type: "", on: "", fixed: true, category: "plan", triggerTag: "outside-event", antidote: "" });
const feel = (id, text) => ({ id, text, type: "", on: "", fixed: false, category: "inner", triggerTag: "general-friction", antidote: "" });

(async () => {
  const h = await start();
  try {
    for (const mobile of [false, true]) {
      const { context, page, errors } = await h.context(mobile);
      await page.clock.install({ time: new Date("2026-11-21T12:00:00+03:30") });
      const f = await fixture(page, h.origin);
      const empty = (date) => ({ date, blocks: [], notes: [], bugs: [] });
      f.data.days[f.date].bugs = [];
      f.data.days["2026-11-17"] = { ...empty("2026-11-17"), pause: { active: false, closed: false, at: "2026-11-17T08:00:00.000Z", wasRunning: false, eventId: "ev1", count: 2 }, bugs: [event("ev1", "Doctor visit"), feel("t1", "Tired")] };
      f.data.days["2026-11-19"] = { ...empty("2026-11-19"), pause: { active: false, closed: true, at: "2026-11-19T08:00:00.000Z", wasRunning: false, eventId: "ev2", count: 1 }, bugs: [event("ev2", "Outside event"), feel("t2", "tired"), feel("p1", "Phone again")] };
      f.data.days["2026-11-20"] = { ...empty("2026-11-20"), bugs: [feel("p2", "Phone again"), feel("p3", "Phone again")] };
      await page.evaluate((d) => {
        localStorage.setItem("debug-day:v2", JSON.stringify(d));
        localStorage.setItem("debug-day:calendar-mode", JSON.stringify("week"));
        localStorage.setItem("debug-day:review-calendar", JSON.stringify("gregory"));
      }, f.data);
      await page.reload();
      await page.waitForSelector(".views", { state: "attached" });

      const look = page.locator("[data-week-pauses]");
      const openWeek = async () => {
        await page.locator('.views button[data-panel="calendar"]').click();
        await look.waitFor();
      };
      await openWeek();
      const rows = () => look.locator("li").evaluateAll((lis) => lis.map((li) => [li.querySelector("span").textContent, li.querySelector("b").textContent]));
      const heading = () => look.locator("h3").evaluate((h3) => [h3.firstChild.textContent, h3.querySelector("small").textContent]);
      assert.deepEqual(await heading(), ["Pauses and feelings", "2 days paused · 5 noted"]);
      assert.deepEqual(await rows(), [["Tuesday · Doctor visit", "Paused 2×"], ["Thursday", "Paused"], ["Phone again", "2 days"], ["Tired", "2 days"]]);
      assert.equal(await look.locator("li span").first().getAttribute("dir"), "auto", "your words keep their own direction");

      {
        // Pause the day on the Board, then continue: the week shows it at once.
        await page.locator('.views button[data-panel="board"]').click();
        await page.locator(".b2").first().waitFor();
        const pause = page.locator("[data-pause-day]");
        if (mobile && !(await pause.isVisible())) await page.locator('.b2-top-actions [aria-label="More"], .b2-top-actions .b2-more').first().click().catch(() => {});
        await pause.click();
        const dialog = page.getByRole("dialog", { name: "Pause the day", exact: true });
        await dialog.waitFor();
        await dialog.getByRole("button", { name: "Continue the day", exact: true }).click();
        await page.waitForFunction((date) => JSON.parse(localStorage.getItem("debug-day:v2")).days[date].pause?.active === false, f.date);
        await openWeek();
        await page.waitForFunction(() => /3 days paused/.test(document.querySelector("[data-week-pauses] h3")?.textContent || ""));
        assert.deepEqual((await rows()).slice(0, 3), [["Tuesday · Doctor visit", "Paused 2×"], ["Thursday", "Paused"], ["Saturday", "Paused"]]);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false, "no sideways scroll");
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log("week pauses: the week looks back at Pauses and feelings, calmly, on desktop and phone");
  } finally {
    await h.stop();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
