# Debug Day

A personal daily planner with a time-scaled board, mind maps, Persian/English UI, private multi-device sync, and an MCP server.

- `public/index.html` — legacy bundled interface and integration points; starts with an empty workspace.
- `public/playful.js`, `public/playful-art.js` — original animated vectors, bilingual sticker/emoji picker, shared task/day symbols, and reduced-motion interactions; included in offline exports.
- `public/search.js`, `public/capture.js`, `public/life.js` — readable source for universal search, capture/Today, and optional scheduling/pause tools.
- `public/planner.js`, `public/relations.js`, `public/connections.js` — shared tags and priority progress, canonical task membership, and live nearest-edge routing.
- `public/board.js`, `public/board-core.js`, `public/board-controls.js` — board gestures, pure object operations, and focused UI controls.
- `public/rails.js` — optional goal/note views of board connections and today’s shared habit controls.
- `public/board-experience.js` — board search, keyboard guide, selection helpers, shared wall-clock timer and board presentation.
- `public/sync.js` — content comparison that ignores JSON object key order.
- `public/measure.js` — how a card is measured: by time, by times (a tally) or as waiting.
- `public/habits.js` — habits: a daily tick plus minutes, four color levels, stats, and their Plan, Board and Settings panels.
- `public/life-board.js` — the shared Life section: sections and sticky notes kept in `setup.life`, shown on every day's board.
- `public/panels.js` — the list of panels (Engine, Plan, Board, Habits, Calendar, App changes), each with one color and icon, used by the tabs, headings, app map and Ctrl+Space.
- `public/engine.js` — the Engine: today's tasks by lane, brought over the Board with E or from Ctrl+Space, the earlier-day copy panel, and the Engine section's styles. It edits `day.blocks` directly.
- Download HTML embeds these modules and the planner snapshot into one offline file.
- `src/worker.js` — Cloudflare Worker for private sync and MCP.
- `src/oauth.js` — OAuth code + PKCE, consent, rotating refresh tokens, and scoped access.
- `upgrade-oauth.mjs` — upgrades an existing installation without replacing its D1 ID or keys.
- `schema.sql` — D1 schema and recent-revision recovery.
- `mcp-bridge.mjs` — stdio bridge for MCP clients.

## Deploy

Every push to `main` deploys automatically through Cloudflare Workers Builds (`npx wrangler deploy`). Worker secrets stay in Cloudflare and are not touched by deploys.

## Setup

Requires Node.js 22+ and a Cloudflare account.

```sh
npm install
npm run setup
```

Read the [full Persian setup guide](README-fa.md) for data migration, device sync, private keys, MCP configuration, and free-plan limits.

The repository contains application code. Planner data is stored privately in D1 after deployment. Sync and MCP keys are configured as Worker secrets and must stay outside Git.

## Upgrade an existing deployment for ChatGPT OAuth

Copy the updated `src/` directory, `schema.sql`, and `upgrade-oauth.mjs` into the **existing installed project folder**. Keep that folder's `wrangler.jsonc` and `PRIVATE-KEYS.txt`. Run:

```sh
node upgrade-oauth.mjs
```

Use OAuth in ChatGPT with the existing `/mcp` endpoint. On the consent page hosted by your own Worker, choose access and privately enter the corresponding MCP key. Existing Claude bearer connections remain supported. Never put keys in URLs, screenshots, or Git.

OAuth tests (Node.js 24): `node --test tests/oauth.test.mjs`.

## Photos and videos in Google Drive (5.34)

A task's edit panel (in Plan and in the Board card details) has **＋ Photo or video**. Files go to a “Debug Day” folder in your own Google Drive; the planner keeps only a small link (`block.media`: id, name, type, size), so the 1.5 MB sync limit is not touched and every view shows the same list. The app asks only for `drive.file`, so it sees the files it made and nothing else in your Drive. Removing a file from a task leaves it in Drive.

One-time setup:
1. In Google Cloud, create a project and enable the Google Drive API.
2. OAuth consent screen: External, add yourself as a test user.
3. Create an OAuth client of type *Web application*. Add your app's address (for example `https://debug-day.YOUR-ACCOUNT.workers.dev`) to *Authorized JavaScript origins*.
4. Put the Client ID in the Worker variable `GOOGLE_CLIENT_ID` (Cloudflare dashboard › Workers › debug-day › Settings › Variables, or `vars` in `wrangler.jsonc`). It is not a secret. No client secret is needed.

Uploads need the internet; a file that is already linked opens in Drive from any device.

## Planner tools

Search (`Ctrl+Space` / `Cmd+K`) covers all days, nested subtasks, feelings, sticky notes, journals and feedback threads. Chips expose `>`, `#category`, `@lane`, `!priority`, `date:` (Gregorian or Jalali) and `is:done/open`. Use Tab for item actions or Shift+Enter to isolate matching results; Show all/Escape releases isolation. Empty search shows recent items and pinned commands.

Capture is available on every view. Worries live outside days, feed recurring-pattern statistics and can be closed or turned into tasks. Phones open a compact Today view; Full day restores all existing controls. Later holds unscheduled tasks, and task anchor times are optional. Life happened pauses the timer and offers continue, move remaining work or close today without fabricating completion.

MCP write tools include `create_day`, `set_day`, `add_worry`, `update_worry`, `add_later` and `schedule_later` in addition to block/note operations. Read `get_day` or `get_setup` first and pass the returned `expected_revision`. `anchor_time` uses `HH:MM` and can be cleared through `update_block`.

## One connected planner

Task lane membership lives in `block.lane`; the nested step tree lives in `block.subtasks`. Plan, Board mind maps, Board Lanes and MCP edit those same fields. Connecting a task to a lane changes its membership, dropping it into another lane does the same, and deleting its lane connection parks it without deleting the task or steps. Structural lines are derived from these relationships; their styles can be edited, but a second decorative parent cannot override the real tree. Reparenting steps rejects cycles and preserves descendants. Changing membership clears stale positions in the other layout; a shared state boundary also reconciles settings and cloud changes.

Tags are shared with search and survive reload, copies, templates, sync and offline export. Quick add accepts arbitrary `#tags` alongside the first recognized `#category`. P1 is highest priority. Daily completion uses task weights: **P1 ×4, P2 ×3, P3 ×2, normal ×1**; parked tasks are excluded. Time, counted and waiting cards all count as work. Duration totals still report minutes separately. Plan, Board, Calendar, heatmaps, the mood/completion wave and MCP use the same completion helper. MCP `add_block`, `update_block` and `add_later` accept optional `priority` (0–3) and `tags` (up to 12).

Connections choose the closest facing edges from live node bounds on every drag frame. Curves and elbows can detour around intervening cards. Connection properties can lock the current sides or reset to a smart route. The main document reserves the scrollbar gutter so adding overflow does not shift the app. App Map buttons have been removed; existing keyboard navigation remains compatible.

## Board controls

Right-click a note, task, connection, multiple selected objects, or empty canvas for relevant actions. The menu stays inside the visible board, supports arrow keys, Home/End and Escape, and preserves a multiple selection when right-clicking a selected object. On touch, select an object and use More actions. Use Shift+F10 to open the menu from the keyboard.

Color & properties includes a live color picker, HEX/RGB, recent colors, screen eyedropper where supported, opacity, exact position, note size and text settings. Selected connections offer label, width, pattern, arrow and route controls. Copy/cut/paste and duplicate keep independent object IDs, nested steps, styles and connections between copied objects. Locked objects stay protected. Multi-selection offers alignment, even gaps, grouping and layer order.

Type a zoom percentage (Persian digits work), use exact zoom steps from 5% to 800%, Shift+1 to fit everything and Shift+2 to fit the selection. Space or the Hand tool pans; Ctrl/Cmd+wheel zooms at the pointer. Canvas settings controls dots, dot opacity/spacing, snapping, smart guides, minimap, wheel zoom and optional right-button panning. Camera and view preferences stay on this device and never consume planner revisions; object edits sync normally and support Undo.

Ctrl/Cmd+F searches the board's tasks, nested steps and Life notes, even inside collapsed sections. Enter reveals and selects a result. Use the timer button for the same countdown as Plan, the moon button to switch themes, or the full-screen button beside the view tabs to enter Board directly. Canvas settings can make full-screen entry the default on this device. The timer stays in memory while changing views; a page reload resets it.

Fit all (Shift+1) includes Life. Shift+3 or the canvas menu fits only the current day's objects; opening a new layout uses that closer day view.

Press `?` for the bilingual keyboard guide. New bindings include V/H/S/Shift+S for select/hand/note/section, X or Shift+L for bent connectors, L for straight connectors, Ctrl/Cmd+Enter for an adjacent note, Ctrl/Cmd+Shift+L for lock, Alt+A/D/W/S and Alt+H/V for alignment, Ctrl/Cmd+Alt+L/T/R for text alignment, and Ctrl/Cmd+Shift+F for full-screen Board. Object shortcuts yield to text fields. With Select, drag a Life section's empty space to move it, or Shift-drag there to select objects; with Hand or Space, drag to pan. New notes are 240×240; saved notes keep their dimensions.

## Validation

Run all regression tests with Node.js 24: `node --test tests/*.test.mjs`.
Run the browser regressions with `npx playwright install chromium` followed by `npm run test:browser`. They use a disposable local SQLite planner and cover note movement versus connections, autosave before reload, keyboard deletion scope and undo, consistent completion, fixed-size touch targets, camera stability, and resuming a closed day. The same command also covers Persian and Gregorian date selection, per-day feeling drafts and edits, empty-day logging, recurring reminder occurrences, task moves, and a fresh offline HTML export. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` only when using an existing Chromium binary.
Before a frontend merge, check Chromium at 1440×900 and 390×844 with touch, in both UI languages. Confirm no document overflow or console errors, camera/mode persistence without sync writes, the ten-call MCP planning workflow, search actions, new-day reload, capture/worry/Later persistence, pause decisions, and downloaded HTML in a fresh offline context. A physical iPhone/Safari check is still separate from emulation.

### Engine (5.16)

The Engine is today's tasks, each in exactly one lane (`block.lane`). Press E anywhere on the Board, use the toolbar's Engine button, or pick Engine (the first row) in Ctrl+Space. The board stays behind it, dimmed. Tick, score or mark a task waiting, rename it, move it to another lane, add tasks per lane, or jump to a task on the board; E or Esc closes it. Tasks have three kinds: tick (default, optional minutes), score out of 10 (`measure: "score"`, `score`), and waiting. Older counted cards still work. Stickers moved to Shift+E. Feelings were removed from the interface; saved feelings stay in the data.

On the mindmap Board the Engine has its own section (5.17), a dashed area around today's tree that is separate from Life. Drop a note inside it to turn it into a task in the nearest lane (first line = name, other lines = steps). Every day starts with a fresh Engine; "Earlier Engine" in the overlay shows the latest earlier day with tasks, and copies one task or all open ones into today with new ids, not done and unscored.

### Section boards (5.18)

Every Life section opens as its own board (↗ on its name, in the selection toolbar, or in the Sections flowchart). The Board then lays out only that section and its contents, placed beside today's Engine (under it on a phone); it is the same `setup.life` data, shifted on screen, so nothing is copied. The path bar (`.dd-room-bar`) leads back; Esc with nothing selected steps out one level. While inside, `DDlifeKeepIn` keeps anything made or moved there inside the section, and new day notes become notes in it. The open section id is kept in `sessionStorage` (`debug-day:board-room`), so a reload stays inside.

### Where tasks come from (5.19)

An Engine task can carry `block.from`, the id of the Life section it came from (no `from` = the main board). It is set when a task is added inside a section's board or made from a note in a section, and changed with the "↖" picker on each Engine row. `DDengineSourceHistory` reads every day and returns, per section, each day's tasks from it or from sections inside it; nothing extra is stored. Sections show the last 14 days as dots beside their name (`DDengineStrip`), and a section's board lists the record under the section. The record is kept out of Stats on purpose.

### Shared Life workspace (5.11)

Life notes use the native board tools: select, multi-select, copy/paste, resize, connect and move notes between the current day and Life. Shared content and frame geometry live in setup; the outer Life area only pans or resizes. Undo/Redo survives switching days or returning from Plan.

Use **Sections** to jump to a section or **Compact layout** to remove empty space without discarding content. Select a section and use its toolbar arrow to collapse its contents. Life is editable in Plan and searchable across the app.

Sections behave like FigJam (5.13): drawing or growing a section around notes or other sections takes them in, and moving it carries everything nested. Delete removes a section with its contents (one Undo restores it); Ctrl/Cmd+Shift+G removes only the frame and keeps what was inside. Duplicate places the copy one gap to the right. Since 5.15 the name sits in a pill inside the top-left corner that keeps a readable size when zoomed out and grows when zoomed in, and dragging a section's empty area moves it. Several selected items drag together; a selected note's "+" adds a note on click and draws a connector on drag. Double-click no longer adds notes, and Ctrl+Space search works in full-screen Board.

Sticky notes and connectors follow FigJam (5.14): the sticky tool previews the note and offers colors above the dock, you type straight onto the note, the "+" beside a selected note adds the next one, side edges change only width while corners scale the note with its text, and dragging a connector into empty space creates a connected note. A selected line has its own toolbar for color, weight, text, dashes, line type and arrows. The dock no longer has connector or feeling tools; press X or L for connectors.

MCP clients can read `get_life` and, with a write key, call `add_life_item`, `update_life_item` or `delete_life_item`. Every write needs the latest `expected_revision`; invalid parents, cycles, dimensions and colors are rejected. Deleting a section preserves its children.


## Board side rails (5.20)

Right-click a day or Life sticky note (or select it and use More actions) and choose **Make it the goal** / **هدف کن** or **Make it a note** / **نوت کن**. Choose the same role again to remove it. The left rails show those notes and their directly connected objects; either direction of a connection counts. Click a row to reveal the original object on its board. Goals and notes follow the main board, then each section down to the section you are inside. A note belongs to its nearest section, so nested goals appear once.

The right rail shows **today’s habits**, including while you explore an older day or a section. Its ticks, minutes and levels use the same records and controls as Habits and Plan. Click a habit’s name for its history in that corner.

Use the edge buttons or **G** (goals), **Shift+G** (notes), **Shift+H** (habits). **H** still selects the hand tool; **E** and **Shift+E** keep their Engine and sticker shortcuts. Each toggle syncs through setup preferences and survives reloads and standalone HTML export. Phones start with closed rails and open one overlay at a time below the header and section path, above the bottom tools. Press Escape inside a rail to close it. Rails tuck away while drawing and in the locked Board preview.

Rail regression coverage: `node --test tests/rails.test.mjs` and `node tests/browser/rails.cjs` (both languages at 1440×900 and 390×844).

## Sections flowchart and section colors (5.26)

Press **Tab** on the board (like After Effects), the **D** key, **Sections** in the Board toolbar, or pick **Sections** (right after Engine) in Ctrl+Space. The flowchart comes up over the board (a bottom sheet on a phone) and shows every section at once: **Main board** on the start side, its top sections branching off it, and each section's own sections further along, joined by curved lines with arrowheads that point back to the parent. Each level is a column; a section sits in the middle of the sections inside it, and siblings keep board order (top to bottom, then left to right). In Persian it runs right to left. The board you are in is a blue pill and the way to it is blue; hovering or focusing a section lights its way too. Each pill has its section's color dot and note count; a section with nothing inside ends in ⊣, and the − / + toggle folds what is inside (the board is not touched) and shows how many are folded away. Folds are remembered on the device.

Click a section to go into its board; the flowchart closes, like picking a comp in After Effects. Shift+click shows the section on the board instead. Right-click (long-press on a phone, or the ContextMenu key / Shift+F10) opens a small menu: **Open its board**, **Show on the board**, and the colors. **Find a section…** searches every level (words can come from different levels), lights the matches, dims the rest, opens the folds on the way and marks the matching letters; Enter goes into the first match, Shift+Enter shows it. Typing a name on a pill starts a search. Keys: → / ← follow the lines (→ unfolds or steps in, ← folds or goes to the parent; swapped in Persian), ↑ / ↓ move within a column, Home goes to Main board, Enter goes in, Shift+Enter shows, / finds, Esc closes the menu, the tools or the search first and then the flowchart, Tab or D closes. Tab only opens it from the canvas or a board item, so Tab still walks through the toolbar and fields. The Life area tools (Enlarge +25%, width and height, Compact layout) are behind the ≡ button, **Life area size & layout**.

Colors: the right-click menu has eight soft colors plus ink black and paper white, a **Custom** color picker, and, on a subsection, **Family shade**. A top section's color moves its whole family. A subsection shows its own shade of its parent's color (the hue turned a little and a touch lighter, chosen from its id, so moving or renaming it never changes it) until it gets a color of its own; that color is saved with `ownColor: true` and its children then take shades of it. The board's color panel works the same way for subsections, with "Use the family shade again". Claude's `update_life_item` color on a subsection is its own color too. `DDsectionTint(items, id)` in `public/life-board.js` returns `{ fill, ink, line, own }` for every place a section shows: board frames and name pills, the flowchart, task chips in Mindmap, Lanes and Plan, the Engine "from" picker, the section record and search results. Task chips show the whole path ("Growth › Learning", or "Growth › … › Learning" when long), read live from `block.from`.

The flowchart lives in `public/sections-flow.js` (`DDsectionsFlow` lays it out, `DDflowCurve` draws the lines). Coverage: `node --test tests/sections-flow.test.mjs` and `node tests/browser/sections-flow.cjs` (en and fa at 1440×900, fa at 390×844). It replaced the 5.24 Sections list; the 5.21 card-file drawer was removed in 5.24.

## Sticky cards (5.22)

Sticky text grows the card automatically; saved legacy heights remain in the data. Side resizing chooses square or wide; corners scale the base and text together, with a minimum base of 160. Selected edges are full resize bands. The shorter toolbar keeps connection, palette, More, Plan and lock actions, plus section actions and, for tasks, Card details and Add a step. It moves beside an open side rail instead of covering it. Other commands remain in More and retain their keyboard shortcuts.

Use **B**, **S̶**, **☑** or Ctrl/Cmd+B, Ctrl/Cmd+Shift+X, Ctrl/Cmd+Shift+9 for light markdown formatting. Checkboxes update the same plain note text; editing shows that text directly. New notes and duplicates show their creation date in the chosen calendar. Older day notes use their day; older Life notes have no invented date. `public/stickies.js` contains the pure formatting/sizing helpers and presentation.

## Board canvas feel (5.23)

Browser zoom never resizes the app: Ctrl/Cmd with **+ = - 0** and Ctrl/Cmd+wheel are caught everywhere, and on the Board they zoom in, zoom out and fit all (Safari's pinch zooms the Board as well). Opening the Board from search goes straight to full screen. Zoomed out, a section inside another hides its name and dots once it is under 260px wide on screen, so only the big sections' names stay. The "+" beside a selected note and the connection points are small dots of one size on screen, a "+" under the pointer, and hide under 35%. Connectors are dark ink with rounded elbows and a filled arrow, never thinner than about 2.4px on screen, and turn thicker and blue under the pointer. Coverage: `node --test tests/board-canvas.test.mjs` and `node tests/browser/board-canvas.cjs`.
