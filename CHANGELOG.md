## 5.27.0 — 2026-10-31
Branch: claude/project-thread-ix6zdi
- Every Board dock keeps only what you use most; the rest moved to a right-click on that dock, or its ⋯ button (on a phone too). Nothing was removed.
- Top bar keeps Undo, Timer, Search, Engine, Life, Sections and Full screen. Redo, Fit all, light / dark, Export SVG and Help moved to its ⋯.
- Tools dock keeps Select, Hand, Task, Note, Section and Stickers. Snap, Dot grid, Minimap and Canvas settings moved to its ⋯.
- Selection bar keeps Card details, Add a step, Color, → Plan, and for a section Open and Fold. Lock, a section's add / remove, and note styling (outside typing) are in ⋯. Bold, strike and to-do still show while you type in a note.
- Line bar keeps color, weight, the three line shapes, end arrow and Reverse. Text, dashes, start arrow, details and delete are in ⋯.
- Right-click the zoom box for its presets.
- New icons for all Board docks and menus, from one set (`public/board-icons.js`). Each action has its own picture: Full screen, Fit all and Life no longer look alike, the Engine is a gear and Canvas settings are sliders, Sections is a tree instead of "···", the Section tool is a titled frame instead of a task box, Snap is a magnet and the Minimap is a small map.
- Goals, Notes and Today's habits pills use the new icons (flag, page, repeat-check).
- Tests updated for the moved buttons.
- The Lanes drag test now waits for the board's camera to stop moving before it measures the lane, so it no longer fails now and then.

## 5.26.0 — 2026-10-31
Branch: claude/project-thread-bgfqx1
- The Sections list is now a flowchart, like After Effects' Tab flowchart: Main board, then top sections, then the sections inside them, joined by curved lines with arrows.
- Tab on the board opens it and Tab closes it (D, the Sections button and Ctrl+Space still work). Tab in the toolbar and fields still moves focus as before.
- The board you are in is a blue pill and the way to it is blue. Click any section to go into its board; Shift+click shows it on the board.
- Nothing from the list was lost: find (lights matches, opens folds), fold with − / +, note counts, colors and custom colors in the right-click / long-press menu, Family shade, and the Life area size tools behind ≡.
- Keyboard: arrows follow the lines, Home goes to Main board, Enter goes in, Shift+Enter shows. In Persian it runs right to left; on a phone it is a bottom sheet with 44px pills.
- On a desktop it opens just below the toolbar and the "where you are" bar.
- `public/sections-list.js` is replaced by `public/sections-flow.js`; tests moved to `tests/sections-flow.test.mjs` and `tests/browser/sections-flow.cjs`.

## 5.25.0 — 2026-10-31
Branch: claude/project-thread-slkpwv
- New look for the whole app ("Graphite"): calm graphite surfaces in dark mode and soft aluminium grey in light mode, soft rounded corners, light outlines, and one accent (lime in dark, orange in light).
- Easier to read: one typeface (Geist) everywhere, no more small spaced-out capitals, no label under 12px, numbers line up.
- Plan, Board and Calendar switches, filters and layouts are soft segmented controls; buttons, fields, cards, dialogs, search and the phone's Today card are rounded.
- In dark mode, cards and fields follow the dark theme instead of staying light.
- Sticky notes keep their design: nothing in the new look touches them.
- The Engine's section can be moved: drag its title. Today's tree moves with it, the spot is kept (a new day starts where the last one left it), and new tasks land inside it.
- The look lives in one file, `public/graphite.js`. Tests: unit test for the look and the saved Engine spot, browser test for moving the Engine.

## 5.24.0 — 2026-10-31
Branch: claude/project-thread-bgfqx1
- Sections opens a clear list again, instead of the card-file drawer (removed): Main board first, then every section in board order, right under its parent, with a guide line per level.
- Each family sits on its top section's color; rows show note counts, "You're here" marks the board you are in, and folding (list only, remembered) shows how many are folded away.
- Click a name to show it on the board, ↗ to go into its board; on a desktop the list stays open, on a phone it is a bottom sheet that closes after you pick.
- Find searches every level, keeps parents dimmed and marks the letters. Full keyboard, Persian right to left. The Life area size tools moved to the list's footer.
- Subsections now get their own shade of the family color (hue turned a little, a touch lighter, fixed by id) instead of the same color as their parent.
- Pick any color yourself from the list (palette, custom picker, or back to the family shade) or the board's color panel, for top sections and subsections. A subsection's own color is saved with `ownColor`; Claude's colors for subsections count too.
- Tests: new unit and browser tests for the list and colors; other browser tests now use the list.

## 5.23.0 — 2026-10-31
Branch: claude/project-thread-xu3qj6
- Browser zoom never resizes the app: Ctrl/Cmd with + = - 0 and Ctrl/Cmd+wheel are taken over everywhere. On the Board they zoom in, zoom out and fit all; Safari's pinch zooms the Board too.
- Opening the Board from search (Ctrl+Space results, Engine, Sections and Board panels, any board item) goes straight to full screen.
- Zoomed out, only the big sections keep their names: a section inside another hides its name and dots once it is under 260px wide on screen, and they come back when you zoom in.
- The "+" beside a selected note is a small dot with one size and distance on screen at any zoom, and becomes a "+" under the pointer. Connection points stay one small size too. Both hide under 35% zoom.
- Connectors are stronger: dark ink instead of faded blue or grey, never thinner than about 2.4px on screen, rounded elbow corners (dragged bends too), a filled arrowhead, and thicker and blue under the pointer. A line's own opacity setting now shows.
- New unit and browser tests for the zoom lock, search to full screen, section names, the "+" dot and connectors.

## 5.22.0 — 2026-10-31
Branch: claude/project-thread-xu3qj6 (started on codex/board-feel-cards)
- Sticky notes never scroll: they grow with their text and are at least square. Width has two shapes only, square or wide (1.5×), and snaps on release; a corner scales the whole note and its text.
- Resize from anywhere on a selected note's side or corner, not only the small handles.
- Shorter selection toolbar, sitting higher above the selection: Zoom, Edit, quick colour, Branch/Group, Duplicate and Delete moved to "…" (their keys still work). Tasks keep Card details and Add a step.
- Bold, strikethrough and to-do with real checkboxes in notes (B / S / ☑, Ctrl+B, Ctrl+Shift+X, Ctrl+Shift+9). A checkbox ticks without opening the note. Text stays plain markdown.
- Each note shows the date it was made at the bottom, in the chosen calendar. Older Life notes show none.
- Turning a note into a task drops the markdown marks and keeps ticked to-dos as done steps.
- The selection toolbar slides beside an open side rail instead of covering it.
- Tests updated for the new note sizes; new browser test for cards.

## 5.21.0 — 2026-10-31
Branch: claude/project-thread-bgfqx1
- New Section Drawer: a line-art card file of every section. Opens from the Sections button, the D key, or Ctrl+Space (right after Engine); Esc, D, a click outside or the same button closes it.
- Top sections are colored dividers ("CL III"), the sections inside are numbered cards filed behind them. Main board is always the front card and leaves a section board.
- Click a folder to open it, follow the path back, Backspace or ← goes up; ↗, a double-click or Enter goes into a section's board. Find a section across every level. Full keyboard, Persian right to left, phone bottom sheet with 44px tabs.
- Hover a card to lift it and see its notes, today's open tasks and its 14-day dots.
- Only top sections can be colored (right-click or long-press a divider: 8 soft colors, ink and paper). Sections inside take their root's color, a little lighter per level. One helper, DDsectionTint, colors board frames, drawer tabs, task chips, the Engine picker, the section record, Plan and search.
- Task chips show the whole path ("Growth › Learning", shortened in the middle when long), read live, now also in Plan, the Engine picker, the record and search results.
- The old Sections list is still there behind "☰ List" in the drawer, with the Life area size and Compact layout.
- Add unit tests for the tint, path shortening and filing, and a browser test for the drawer in en/fa desktop and fa phone.

## 5.20.0 — 2026-10-31
Branch: codex/phase5-side-rails
- Add optional goal and note rails from existing board connections, ordered from the main board to the open section.
- Add today’s habits at the right edge with shared controls and inline history.
- Remember each rail in synced preferences; support English, Persian, keyboard toggles and phone overlays.
- Cover rails and offline export in browser tests; wait for the section camera before saving test coordinates.

## 5.19.0 — 2026-10-30
Branch: claude/project-thread-xu3qj6
- Every Engine task can say where it came from: a Life section or the main board. A task added inside a section's board, or made from a note that sat in a section, gets that section on its own. Change it from the "↖" picker on each Engine row.
- Task cards on the Board (mindmap and Lanes) show a small "↖ section" tag in the corner.
- Each section with tasks shows its last 14 days as dots beside its name (green = all done, half = some, red ring = none yet) and "done/total". Tap the dots to open the section's board. A big section also counts the tasks from sections inside it.
- Inside a section's board, a "Done and not done here" card under the section lists each day's tasks from it, newest first, with ✓ or ○ (7 days, "Show all" for more). It is read from the days, so it updates by itself and is the same on every day. It is not in Stats.
- Opening a section's board frames the card too, clear of the minimap.
- Add unit tests for sources, the per-section record and the 14-day strip, and en/fa desktop/phone browser tests for the tag, the dots, the record and the picker.

## 5.18.0 — 2026-10-30
Branch: claude/project-thread-xu3qj6
- Every Life section opens as its own board: the ↗ button on its name, the ↗ in the selection toolbar, or ↗ in the Sections list. The board shows only that section and what is inside it, with today's Engine beside it (under it on a phone).
- A path at the top shows where you are (Main board › section › inner section). Tap any step to go there; ← or Esc (with nothing selected) goes back one level. Each board keeps its own camera, and a reload keeps you where you were.
- Same data, nothing copied: edits inside a section show on the main board and every day. A note or section made inside stays in that section, and a note dragged past its edge stays in it too. Drag a note into the Engine to make it today's task, or press E.
- Inside a section's board, day notes and the Habits section stay on the main board. A section deleted elsewhere closes its board.
- Add unit tests for the section path and keep-inside rule, and en/fa desktop/phone browser tests for section boards.

## 5.17.0 — 2026-10-30
Branch: claude/project-thread-xu3qj6
- The Engine has its own section on the mindmap Board: a dashed orange area around today's tree, apart from Life. It grows with today's tasks, and its name pill has an "Open · E" button that brings the Engine over the board.
- Drop a note inside the Engine section and it becomes a task in the nearest lane: the first line is the task name, the other lines become its steps. The note is removed.
- Each day still starts with a fresh Engine. "Earlier Engine" inside the Engine shows the latest earlier day with tasks (‹ › steps further back); add one task to today or copy all open ones. Copies get new ids and start not done and unscored; tasks already in today are marked.
- At low zoom the Engine name sits on the section's top edge so it never covers the tasks.
- Add unit tests for note-to-task, earlier day, copy and duplicate check, and browser steps for the section, the earlier Engine and dropping a note.

## 5.16.0 — 2026-10-30
Branch: claude/project-thread-xu3qj6
- The Engine: today's tasks, each in one lane, are now called the Engine. Press E anywhere on the Board to bring it over the dimmed board; tick, score, mark waiting, rename, move a task to another lane or add one, then press E or Esc to go back. Same data as Plan and Lanes.
- An "Engine" button in the Board toolbar jumps to the day's Engine; the day's root node is named Engine.
- Ctrl+Space lists the Engine first; picking it opens the Board with the Engine on top, from any view. The app map shows an Engine card first, so its number keys move by one (1 Engine, 2 Plan, 3 Board, …).
- Three task kinds: tick (default, minutes stay optional), score out of 10 (done once scored; tap the same dot to clear) and waiting. Old counted cards keep working but are no longer offered.
- Stickers move from E to Shift+E.
- Feelings removed: no Feelings panel, Calendar section, Plan box, Board section, quick-capture option or search group. Saved feelings stay in the data. The day note is still written in Plan.
- Add unit and en/fa desktop/phone browser tests for the Engine, score kind and Feelings removal; older browser tests no longer expect Feelings.

## 5.15.0 — 2026-10-30
Branch: claude/figjam-section-titles
- Section names sit in a pill inside the section's top-left corner, as in FigJam. Zoomed out the pill keeps one readable on-screen size; zoomed in it grows with the board.
- Drag anywhere on a section's empty area to move it with everything inside, not only by its name. Shift-drag still draws a selection box inside a section, and on touch the body still pans.
- The selection toolbar no longer reserves room above a section for its name.
- Select several items (for example several sections with Shift-click) and drag any of them to move all together; sections moved together no longer drop into each other.
- A selected note's "+" is also its connector start: click adds the next note, drag draws a connector. The circles behind the note's edges are gone while "+" shows. A selected note draws above its neighbours so its "+" is never covered.
- Board uses the normal system cursor instead of the custom arrow.
- Double-clicking empty board no longer creates a note; use the sticky tool (S) or "+".
- Ctrl+Space search opens on top of the full-screen Board.
- Extend the en/fa browser regressions with body dragging, the name size at different zooms, "+" connectors, group moves, no double-click notes and full-screen search.

## 5.14.0 — 2026-10-30
Branch: claude/figjam-notes-connectors
- Sections: no connection circles around them (they hid the resize handles); a click on a section's empty area selects it; titles stay readable at every zoom.
- Dock: remove the connector and feeling tools; connectors start from a note's side points or X / L.
- Sticky tool: a faint note follows the pointer and the note colors appear above the dock.
- Type straight onto the note with a "Type anything…" hint; the separate "Saves as you type / Done" bar is gone and empty notes show the same hint.
- Left/right edges change only a note's width; corners and top/bottom scale the whole note and its text together.
- A "+" on each side of a selected note previews and adds the next note one even gap away.
- Drag a connector from a note into empty space to create a connected note there, previewed while dragging.
- Connectors look like FigJam (grey, weighted with the canvas, arrowheads) and have FigJam's toolbar: color, weight, text, dashed, straight/elbow/curve, start and end arrows. The details panel opens only on request.
- On desktop the note's bottom bar is hidden; color and → Plan live in the selection toolbar. Resize handles now win over connection points when zoomed out.
- Add an en/fa browser regression for all of the above and update older tests to the new controls.

## 5.13.0 — 2026-10-30
Branch: claude/figjam-sections
- Draw a section around notes or other sections and it takes them in, like FigJam; growing a section over neighbours does the same, and moving it carries everything nested.
- Name new sections in order (Section 1, Section 2, …) and allow small sections; drawn sizes are no longer forced up to 320×160.
- Let a section shrink past its contents and stop growing it when a note is placed by hand near its edge; contents stay put and may hang over.
- Delete a section together with its contents on the Board and in search, with one Undo; Ctrl/Cmd+Shift+G (or the toolbar) removes only the frame. MCP delete still keeps children.
- Show each section's title at a steady on-screen size with a section icon, shorten it when the section is narrow, and keep the selection toolbar clear of it (below the section when there is no room above).
- Move section actions (collapse, add note, add section, remove frame) into the selection toolbar; the section itself no longer shows a second toolbar.
- Duplicate places the copy one even gap to the right on the same row instead of piling copies diagonally.
- Add unit and en/fa browser checks for nesting, numbering, toolbar clearance, carried moves, duplicate placement, delete and ungroup.

## 5.12.0 — 2026-10-30
Branch: codex/figjam-board-experience
- Add a Board timer shared with Plan, with editable duration, start/pause, reset and an extra minute; use wall time so background tabs do not slow the countdown.
- Add light/dark switching inside Board, direct full-screen entry, and a device preference to open Board full screen.
- Search all day tasks, nested steps and Life notes, including collapsed sections; normalize Persian/Arabic letters and digits and reveal the selected result.
- Center the compact tool dock, anchor the floating selection toolbar, refine note colors and selection states, and create new square notes without resizing existing ones.
- Add a bilingual keyboard guide and shortcuts for search, zoom, connectors, lock, alignment, text alignment, layer order and adjacent notes.
- Draw sections with a drag, select inside section backgrounds, resize from eight handles, keep section contents stationary during north/west resizing, and preserve native scrolling while editing text.
- Reuse connection paths while panning and zooming; keep shared Life data, history, offline exports and existing planner relationships intact.
- Separate Fit all (including Life) from Fit current day (Shift+3); keep the day readable when switching layouts.
- Add unit and desktop/mobile browser regressions for the new controls, saved data, search, timer, resizing and keyboard behavior.

## 5.11.1 — 2026-10-30
Branch: codex/fix-cursor-selector
- Apply the requested pink cursor to the actual Board viewport and native notes; keep hand/pan cursors intact.
- Add visible Life area enlargement (+25%) and editable shared width/height controls in the section navigator.
- Keep section navigator text readable in light and dark themes by pairing its background and foreground theme tokens.
- Add browser regressions for cursor rendering, SVG decoding and navigator text contrast in both themes.

## 5.11.0 — 2026-10-30
Branch: codex/unified-life-workspace
- Use the native Board engine for Life sections and notes: clear blue selection, keyboard selection/delete/nudge, multi-selection, clipboard, duplication, resizing and connectors.
- Keep Life Undo/Redo history across day and view changes. Transfer notes between a day and Life atomically, preserving text, size and connections.
- Store Life area geometry once in shared setup. Its outer frame cannot be selected or dragged; it has a resize handle.
- Add collapsible sections, a section navigator with direct jumps, and a stable compact-layout action that preserves content and hierarchy.
- Show editable Life sections and notes in Plan and index them once in global search, opening their native board objects.
- Add the quick color circle to every board note, larger mobile note controls, single-tap editing and the requested pink gradient cursor.
- Add get_life, add_life_item, update_life_item and delete_life_item MCP tools with read/write access checks, validated input and revision protection.
- Add unit and browser regressions for shared geometry, compaction, clipboard, cross-day undo, note transfer, connections, search, mobile gestures and MCP writes.

## 5.10.1 — 2026-10-30
Branch: codex/section-life-fixes
- Give Life sections soft family colors and separate, readable title tabs; choose colors directly from a palette.
- Render saved section frame colors and preserve the Life frame's position, appearance and connections after reload and sync.
- Move sections and their contents smoothly with one preview per animation frame; keep the final pointer position and cancel safely on Escape, pointer cancellation and lost focus.
- Stop overlapping sections from nesting accidentally or growing neighbours; keep contents visible when resizing and let empty frame space pan the board.
- Include shared Life changes in board Undo/Redo and keep repeated touch drags separate from pinch gestures.
- Add regression checks for section movement, color persistence, cancellation, resizing and bilingual controls.

## 5.10.0 — 2026-10-29
Branch: claude/project-thread-7xg0gy
- New Life section on every day's board (Mind map and Lanes): the planning board's sections and sticky notes, copied as they are. It is kept in settings, so a change on one day shows on all days.
- Sections work like FigJam: add one with the new Section tool (Shift+S) or the + on the Life section, nest sections inside sections, drag stickies in and out, rename, resize, recolor. Deleting a section keeps what was inside; deleting asks for a second press.
- Added a Life button in the board toolbar to jump to the section; Fit all no longer shrinks the day to make room for it.
- Added tests for the shared section, nesting, dragging between sections and showing it on another day.

## 5.9.0 — 2026-10-24
Branch: feat/connected-planner-priorities
- Keep Plan, Board, Lanes, settings and MCP on the same task/section relationships; discard stale positions after membership changes.
- Make lane connectors edit actual membership; park tasks when detaching, preserve nested steps, reject cycles and keep locked relationships protected.
- Add shared task tags and clear priority controls; use P1 ×4, P2 ×3, P3 ×2 and normal ×1 for daily completion in every view.
- Recompute connection endpoints at the nearest facing edges during dragging, route around intervening cards, and add automatic/fixed attachment controls.
- Reserve scrollbar space and remove App Map buttons.
- Preserve old connection labels and styles, and keep shared modules available in standalone offline HTML exports.
- Add regression coverage for alternating edits, MCP metadata, real touch dragging, live routing, undo/redo, persistence and scrollbar stability.

# Changelog

Every change gets an entry here: version, date, branch, and what changed. Newest first. See `CLAUDE.md` for the rules.

## 5.8.0 — 2026-10-24
Branch: feat/animated-stickers-interactions
- Added eight original animated vector stickers and a bilingual emoji library with search, favorites, recent picks, and keyboard navigation.
- Day stickers and task icons share the existing planner data across Plan, Board, Lanes, Calendar, and Feelings; changes and removals stay in sync.
- Added sticker placement and editing from the board dock, context menu, and E shortcut, with clipboard, undo, resizing, and SVG export support.
- Added gentle reactions to completion, mood selection, and button presses, respecting both app and system reduced-motion settings.
- Kept stickers self-contained in offline HTML exports and added browser coverage on desktop, phone, Persian, English, dark theme, and reduced motion.
- Added portable GitHub Actions browser checks and screenshot artifacts.
- Prevented the touch gesture that opens the sticker picker from choosing a sticker, and kept day additions apart from existing notes.
- Kept task artwork when converting a card to a habit, including its Plan and Board details views.
- Step cards now measure wrapped words with the active font so fallback fonts do not cut off their text.

## 5.7.0 — 2026-10-23
Branch: claude/project-thread-pfxhqk
- Calendar, Feelings and Stats are now one Calendar panel with three sections: Day, Feelings and Stats. The header has one Calendar tab, and it opens the section you used last. The app map has one Calendar card again (1–5).
- Stats has its own section again, so the streaks, 6-month heatmap, mood wave, recurring patterns and done-by-type are easy to find. Each section can still be hidden in Settings.
- Ctrl+Space: a panel whose name matches what you typed comes first, so "stats" opens Stats, not Calendar.
- Dark theme: text and menus on light cards were light on light. Plan rows, the Habits panel, the feelings list, Board card details (the Category menu), Settings fields and the Stats patterns now use dark text on those cards.
- Stats fixes: a month right after the first column lost its label (May was missing); in Persian the heatmap's month labels pointed at the wrong weeks; the snapshot's Persian date was in English; "open · resolved", "/30d tracked", "no data", "bugs" and the pattern names now follow the app language; done-by-type counts minutes the same way as the done % (counted and waiting cards take none).
- Calendar cells say "1 feeling" / "1 task" instead of "1 feelings" / "1 tasks".

## 5.6.0 — 2026-10-23
Branch: claude/project-thread-xnja7m
- Every panel has its own color and icon: Plan 📋 blue, Board 🧠 purple, Habits 🌱 green, Feelings 💭 red, Calendar 📅 teal, App changes 🛠️ amber. They show on the view tabs, section headings, the app map, the isolate bar and the Board sections.
- Ctrl+Space opens on a "Panels" list: pick one and it is isolated right away (Calendar and Feelings open their page). Typing a panel's name finds it first. Rows already shown on the first page are not repeated below.
- The app map has one card per panel (the two feelings cards are now one). 1–6 isolates or opens, Shift+number shows it with the rest, 0 shows all.
- Each thing now has one home. Feelings page: mood, writing and editing feelings, worries and the day note for any day. Calendar: a read-only summary of that day's feelings and note, with "Open in Feelings". Plan: a quick one-line feeling box and a list you can tick closed, with "Details in Feelings". The focus is written only in the Plan header.
- The footer no longer repeats App map, Calendar and Feelings, which are already in the header.

## 5.5.0 — 2026-10-23
Branch: claude/project-thread-xnja7m
- Added habits (like writing): tick them each day and add minutes if you like. Each day gets a color level: done, good (15m), enough (30m), too much (60m). The minutes for each level can be changed in Settings › Habits.
- Plan has a Habits panel with tick, minutes, a +15 button and the last two weeks; tap a habit's name to see its last 8 weeks, total time and streak.
- The Board has its own Feelings and Habits sections, in both Mind map and Lanes. Press + in a section to add one there.
- Drop a card into Habits to turn it into a habit. In the mind map, drop a feeling on a card to link it, or into Feelings to unlink it.
- Selecting a feeling on the Board opens a panel with the same words as the Feelings page: topic, related card, what could help, "It passed" and delete. Feeling cards show their topic and a heart instead of "!".
- Removed the old feelings box under the Board, since feelings now live inside it.
- Right-click or right-drag on a Board section works like the empty canvas.

## 5.4.0 — 2026-10-23
Branch: claude/project-thread-xnja7m
- Cards can be measured by time, by times ("3 times", with a tally to tap) or as waiting (like waiting for an email reply). Only timed cards use up hours in the day.
- Pick the measure in Plan's card editor or in the Board card details panel; it shows the same everywhere (Plan, Board, Lanes, Calendar, search).
- Quick add understands "3x", "3 times", "۳ بار" or "دفعه" for counted cards, and "⏳", "منتظر…" or "waiting for…" for waiting cards.
- Waiting cards show since when you have been waiting and have an "Arrived" button. Ticking a counted card fills its tally.
- New days from a template start counted cards at zero.
- Fixed a stray "0" showing on Board cards without hours.

## 5.3.0 — 2026-10-23
Branch: claude/project-thread-xnja7m
- Lanes no longer draw any lines. Each card is now a section that holds its own steps, feelings and linked notes, so what belongs together is shown by placement.
- Cards in Lanes have a fixed width instead of growing with their hours; time is shown as text and can be changed in the card details panel.
- Free feelings and free notes get their own "Feelings" and "Notes" sections in Lanes.
- Drag a note or feeling onto a card to attach it; drag it out of the card to detach it. Steps and attached items move with their card.
- Notes resize from both bottom corners (Shift keeps the shape), show their size while resizing, and fit their text on double-click of a handle.
- Notes moved in Lanes keep their own place there and no longer jump around in the mind map.

## 5.2.0 — 2026-10-23
Branch: claude/project-thread-xnja7m
- Board steps now show their whole text, wrap onto more lines, and read clearly as steps ("Step 1/3" label and a checkbox).
- Selecting a card opens a details panel with its category, note, steps (tick them there) and linked notes and feelings. It can be hidden.
- Added "Step" to the selection bar, so a step can be added without zooming in.
- When zoomed out, hovering or selecting a card shows its buttons at a usable size instead of hiding them.
- Block cards in the mind map show their category name.
- Shortcuts (Ctrl/Cmd+Z, Y, C, X, V, D, G, A, Ctrl+K, Alt+M and tool keys) now work with the Persian keyboard layout.

## 5.1.0 — 2026-10-23
Branch: feat/board-interaction-controls
- Added contextual right-click menus with icons, keyboard navigation, clipboard actions, alignment, grouping, locking, and layer order.
- Added custom HEX/RGB colors, live color preview, object and line opacity, note sizing, and connection appearance controls.
- Added exact numeric and stepped zoom, smart alignment guides, local canvas preferences, and clearer board buttons.
- Fixed small-zoom connection handles covering task buttons, right-click minimap jumps, and accidental Escape field commits.
- Extracted the board into readable modules and added browser and pure-operation regression coverage.

## 5.0.1 — 2026-10-23
Branch: claude/project-thread-xnja7m
- Added the app's core purpose to `CLAUDE.md`: everything stays in sync across Board, Lanes, Plan and every view; and the app is an artist's planner, not a rigid hour-by-hour scheduler.

## 5.0.0 — 2026-10-23
Branch: claude/project-thread-xnja7m
- Baseline: starting the changelog from the current version (5.0.0).
- Added `CLAUDE.md` with rules for all agents: work on a separate branch and merge, and log version + changes here after every change.


