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

