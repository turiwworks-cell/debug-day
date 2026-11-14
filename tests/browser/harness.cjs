const { chromium, devices } = require("playwright");
async function start() {
  const { startServer } = await import("./server.mjs");
  const server = await startServer();
  const browser = await chromium
    .launch({
      headless: true,
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? {
            executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
            args: [
              "--no-sandbox",
              "--no-zygote",
              "--disable-gpu",
              "--disable-software-rasterizer",
            ],
          }
        : {}),
    })
    .catch(async (error) => {
      await server.close();
      throw error;
    });
  async function context(mobile) {
    const context = await browser.newContext(
      mobile
        ? {
            ...devices["iPhone 13"],
            viewport: { width: 390, height: 844 },
            timezoneId: "Asia/Tehran",
          }
        : { viewport: { width: 1440, height: 900 }, timezoneId: "Asia/Tehran" },
    );
    // Phones open the Board full screen by default (5.41). Tests that use the
    // board inside the page keep that choice unless they set it themselves.
    if (mobile)
      await context.addInitScript(() => {
        try {
          if (localStorage.getItem("debug-day:board-start-fullscreen") === null)
            localStorage.setItem("debug-day:board-start-fullscreen", "false");
        } catch {}
      });
    const errors = [];
    await context.route("**/*", (route) =>
      new URL(route.request().url()).origin === server.origin
        ? route.continue()
        : route.fulfill({ status: 200, contentType: "text/css", body: "" }),
    );
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    return { context, page, errors };
  }
  return {
    browser,
    context,
    origin: server.origin,
    async stop() {
      await browser.close();
      await server.close();
    },
  };
}
async function fixture(page, origin) {
  // The app opens on the Board (5.67), and a Board remembers its camera when
  // the page goes away. Tests set their own data first, so the very first load
  // of a tab opens the Calendar; the Board then starts fresh when a test opens it.
  await page.addInitScript(() => {
    try {
      if (sessionStorage.getItem("dd-test-first-load")) return;
      sessionStorage.setItem("dd-test-first-load", "1");
      const ui = JSON.parse(localStorage.getItem("debug-day:ui") || "{}");
      localStorage.setItem("debug-day:ui", JSON.stringify({ ...ui, view: "calendar" }));
    } catch {}
  });
  await page.goto(origin);
  await page.waitForSelector(".views", { state: "attached" });
  return page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("debug-day:v2"));
    const date = new Date().toLocaleDateString("en-CA");
    const prev = new Date();
    prev.setDate(prev.getDate() - 7);
    const last = prev.toLocaleDateString("en-CA");
    data.setup.preferences.language = "en";
    const block = {
      id: "writing",
      name: "Portfolio writing",
      type: "writing",
      lane: "work",
      min: 180,
      note: "A searchable note",
      pri: 1,
      emo: "",
      done: false,
      expanded: true,
      subtasks: [
        {
          id: "sub",
          text: "A very long subtask name that must be readable on a phone without truncating the words",
          done: false,
          expanded: true,
          children: [
            { id: "nested", text: "Nested outline", done: false, children: [] },
          ],
        },
      ],
    };
    data.days[date] = {
      date,
      heavy: 0,
      tpl: "normal",
      focus: "Ship the portfolio",
      mood: "🙂",
      journal: "Journal",
      blocks: [
        block,
        {
          ...block,
          id: "long",
          name: "Long research",
          type: "research",
          min: 720,
          expanded: false,
          subtasks: [],
        },
      ],
      bugs: [
        {
          id: "feeling",
          text: "Creative uncertainty",
          type: "writing",
          on: "Portfolio",
          fixed: false,
          category: "creative",
          triggerTag: "ابهام_قدم_بعدی",
          antidote: "",
        },
      ],
      notes: [
        {
          id: "note",
          kind: "sticky",
          text: "Orbit idea",
          color: "#FFE27A",
          x: 80,
          y: 80,
        },
      ],
      canvas: null,
    };
    data.days[last] = {
      ...data.days[date],
      date: last,
      blocks: [
        { ...block, id: "archive", name: "Last week outreach", subtasks: [] },
      ],
      bugs: [],
      notes: [],
    };
    data.setup.feedbacks = [
      {
        id: "feedback",
        kind: "future_change",
        text: "Better capture",
        priority: "normal",
        emoji: "💡",
        done: false,
        createdAt: date,
        thread: [{ id: "reply", text: "Thread telescope", at: date }],
      },
    ];
    return { data, date, last };
  });
}

// The Engine has no page of its own any more (5.67): it opens over the Board.
async function openEngine(page) {
  if (await page.locator(".dd-engine").isVisible().catch(() => false)) return page.locator(".dd-engine");
  const tab = page.locator('.views button[data-panel="board"]');
  if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
  await page.locator(".b2").first().waitFor();
  await page.evaluate(() => import("./engine.js").then((m) => m.DDengineBus.request()));
  await page.locator(".dd-engine").waitFor();
  return page.locator(".dd-engine");
}

module.exports = { start, fixture, openEngine };
