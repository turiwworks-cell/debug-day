const assert = require("node:assert/strict");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { pathToFileURL } = require("node:url");
const { start, fixture } = require("./harness.cjs");
(async () => {
  const h = await start(),
    folder = mkdtempSync(join(tmpdir(), "debug-day-offline-"));
  try {
    const { page, context, errors } = await h.context(false),
      f = await fixture(page, h.origin);
    await page.evaluate(
      (f) => localStorage.setItem("debug-day:v2", JSON.stringify(f.data)),
      f,
    );
    await page.reload();
    await page.locator(".foot .utilities button").last().click();
    const pending = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download standalone HTML", exact: true })
      .click();
    const download = await pending,
      file = join(folder, "debug-day.html");
    await download.saveAs(file);
    assert.deepEqual(errors, []);
    await context.close();
    const offline = await h.browser.newContext({
        viewport: { width: 390, height: 844 },
      }),
      p = await offline.newPage(),
      offlineErrors = [];
    await offline.route("http**/*", (route) => route.abort());
    p.on("pageerror", (error) => offlineErrors.push(error.message));
    await p.goto(pathToFileURL(file).href);
    await p.waitForSelector(".views");
    await p.getByRole("button", { name: "Search", exact: true }).click();
    await p
      .getByRole("combobox", { name: "Search everything", exact: true })
      .fill("Portfolio writing");
    await p
      .getByRole("listbox")
      .getByRole("option")
      .filter({ hasText: "Portfolio writing" })
      .first()
      .waitFor();
    await p.getByRole("button", { name: "Close search", exact: true }).click();
    await p.locator(".views button").nth(2).click();
    assert.equal(await p.locator("[data-review-date]").count(), 42);
    assert.equal(
      await p.locator(".dd-review-day time").getAttribute("dateTime"),
      f.date,
    );
    await p.locator(".views button").nth(3).click();
    await p
      .getByRole("textbox", { name: "Feeling text", exact: true })
      .fill("An offline feeling");
    await p.getByRole("button", { name: "Save feeling", exact: true }).click();
    await p.reload();
    await p.locator(".views button").nth(3).click();
    assert.match(
      await p.locator(".dd-review-feelings").innerText(),
      /An offline feeling/,
    );
    assert.equal(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      true,
    );
    assert.deepEqual(offlineErrors, []);
    await offline.close();
    console.log(
      "Standalone HTML works without network: search, calendar, feelings, save and reload",
    );
  } finally {
    await h.stop();
    rmSync(folder, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
