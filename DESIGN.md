# Design rules for Debug Day

Read this before you change anything a person sees. Many agents work on this
app; these rules keep it one app with one voice. They come from the app's two
goals in `CLAUDE.md`: everything stays in sync, and it is a planner for
artists, not a rigid hour-by-hour scheduler.

## 1. Words

One word for each thing. Use these in labels, tooltips, toasts and tests.

| Say | Never say |
|---|---|
| **Task**: one piece of work on a day | block, time block, card, node |
| **Step**: a part of a task (steps can nest) | sub-node, sub-step, node |
| **Section**: a group in the Feed | room, folder |
| **Note**: a sticky note | sticky (in labels) |
| **Feed**: the board area that is the same on every day | Life (that was its old name) |
| **Engine**: the day's tasks (E on the Board, or Ctrl+Space; it opens over the Board, there is no Engine page since 5.67), in two columns: Today and Park | today box, Plan (the old page) |
| **Park**: tasks that are not for today and stay from day to day | Later tray, backlog |
| **After**: the order between tasks or steps ("Colour pass after Sketch"); a waiting task is never locked | depends on, blocked by, dependency |
| **Shortcut key**: one letter a section keeps for the Tab flowchart (Tab, then T for This App); Shift with it opens that section's Engine too | hotkey, binding |
| **Section tag**: the path of the section a task belongs to, on top of the task; a click goes into that section. It replaced categories: a task wears its section's colour | category, type, came from, folder, project |
| **Capture**: the one section where quick ideas land and wait until each goes to Today or Park; drawn apart in Tab (C) | Inbox (its old name), dump, queue |
| **Routine**: what each new day does by itself, only when chosen (bring or park the last day's open tasks, tasks that repeat every day) | automation, rules, schedule, recurrence |
| **Light, Steady, Full, Packed**: how full a day looks in the Calendar, always against your own usual day | busy, overloaded, capacity, utilisation, score |
| **Shape**: a note drawn as a shape (rectangle, circle, diamond, flowchart shapes…) with its own fill and stroke; it is still a note everywhere else | figure, object, element |
| **Eyedropper**: takes a color from anything on the Board (I) and gives it to what is picked, or to the next notes | color picker, sampler |
| **Text style**: Large heading, Heading, Normal, Small, Quote, Code block for the words in a note, text or shape | font style, paragraph format |
| **Tags** (on notes): the Tags menu finds, ticks, makes, renames and deletes tags; Rename and Delete change a tag everywhere | labels, categories |
| **Document**: a card on the Board for long writing, with a name; opens full size to read and write; Save as PDF, Word, Markdown or Text | page, file, doc |
| **To-do list**: a card on the Board of tick-box tasks, with an optional title, tasks in and out (Tab), a due date with an optional reminder time, and a bin next to done tasks; due tasks show in the Calendar | checklist, todo card |
| **Comment**: a free comment is a card on the board (Reply, Send, reactions); dragged onto a card it becomes a small marker that moves with the card | note, pin |
| **Back to**: the boards you were on last, 1 to 4 in the Tab flowchart | history, recents |
| **Focus**: the timer | Stillness |
| **Pause the day**: the "life happened" pause, on the Board's top bar | Life happened |
| **Lane**: kept only in the data (a task's old branch name). There is no Lanes view or lane picker any more (5.78); the board is always the mind map | track |

- "Life" is only ever a lane name the person chose. Do not use it for app features.
- Old labels that still pass through `DDUI` are rewritten in `public/words.js`.
  Add a new rename there (English and Persian) instead of editing every call.
- Short, calm, plain. "Add task", not "Create a new time block". No exclamation marks.
- Time is written one way everywhere: `45m`, `3h`, `1h 30m` (`DDduration` in `measure.js`).

## 2. Calm by default

- One main action per area. Everything else is quieter (ghost button, text button, or behind "…").
- A tool with nothing in it hides until it has something, or until "…" is open (`dd-quiet` class).
- No hour grids, Gantt bars or red "late" states. Time is a small number next to the name, and optional.
- Time focused with the timer is history, never a target (5.88): "45m focused" beside the task, a day's total, the week's "Focused" list. Nothing compares it with the planned time.
- No guilt: no red, no streak-loss warnings, no "you failed". Use neutral words ("not yet", "left").
- Budgets and goals are soft: "1h 30m / 6h · week", "12 of 35 · 9 days left". Green when reached, never red when over or behind.
- A goal with a date counts down quietly in the Goals rail ("◆ 12d 02:10:16 left"). Never red; a passed date just says "date passed".
- Reminders and deadlines work for any date. The Calendar's Reminders list shows everything coming ("This month" is one tap away).
- Every reminder is named on its day (5.84): in the month (a ring and the name, two lines at most), in the week and in the list. A to-do task with a time is a reminder too (a bell and its time). A tap opens it: the Calendar's own reminder opens in the day panel (title, day, repeat, note), and a to-do task or a note's deadline opens where it lives, on the Board. A day with reminders shows them first, under its name.
- Deadlines are soft too: "◆ 8 days left", "tomorrow", "date passed" (`deadlines.js`). On a note the badge sits above the paper, never on it.
- A task may be light or heavy (`energy.js`), never required. A tired day (😫 😕) offers the light ones first.
- The Week view and its look back count what happened; they never score it. Next week's focus is one line.
- The look back has a quiet "Pauses and feelings" list (5.89): the days you paused with Pause the day (with the outside event's own name once it has one), and the feelings and events you noted, in your own words, by how many days they came up. No "open" counts, no score; it hides in a quiet week.
- Help text fades away: show a hint once, then rely on `?` and tooltips.
- Words are written without their marks: **, ## or - [ ] never show while writing a note, text or shape (`live-text.js`); the saved text keeps them.
- A task in the Engine is one line. Details open with ⋯, steps open when asked.
- The Board's top bar keeps only the daily tools: Undo, the timer, light / dark, Pause the day, Full screen. Search, Engine, Feed and Sections wait in its ⋯. No standing key hints on the canvas.
- The Board's day sits at its top centre as plain words, never in a box: the day, then the Persian date and how much is done (5.82).
- Full screen is only ever the person's choice: moving to the Board from the Calendar, search or a row never turns it on.
- Back on the Board lives on the path under the top bar (← Main board › Section): it returns to where you were. Nothing beside the date.

## 3. Color

- The UI looks like iOS 27 (5.81): `public/glass.js` (`DDinstallGlass`, after `graphite.js`) sets the tokens
  (`--paper`, `--panel`, `--raise`, `--wash`, `--ink` to `--ink-4`, `--rule`, `--rule-2`) to the iOS system grays,
  and its labels to iOS label colors with alpha. Use the tokens; never a new hex for chrome.
- One accent: `--now`, the classic iOS blue (`#0088FF` light, `#0091FF` dark). It is one line in `glass.js` (`const tint`). Green `--ok` only for done and switches.
- The person can change that one accent (5.85): the round dot beside the Board timer opens 8 iOS colors and a custom one (a hue strip and a color code, never the system picker). It is `setup.look.accent`, the same value as Settings, so every view follows. The timer's digits use the accent.
- In capsule bars (the Board's path bar, "Main board"), the last word keeps at least 14px before the round end, and a pinned button never sits on a title written in either direction (use physical padding on the side the button is, not `padding-inline-end`).
- Liquid Glass only on things that float over content: the view tabs, the Board's bars and dock, menus, popovers,
  the selection bar and the phone tab bar (`--glass`, `--glass-strong`, `--glass-edge`, `--glass-shadow`).
  Cards and pages stay solid. Without transparency (`prefers-reduced-transparency`) they turn solid.
- Color belongs to the person's content: sections, notes, lanes, tags.
- Colors are picked from the app's own swatches (a round dot that opens them). Never open the system color picker (`input type=color`).
- The selection bar carries tools only: no name, icon or time copied from the card. A note's bar is Color, Align, Tags, Text style and ⋯.
- A line meets a card with a little air: an arrowhead stops short of the edge (`DDwireGap`).
- Every color works in light and dark. Never hard-code a hex for UI chrome.
- **Never change the sticky notes' look** (shape, colors, fold, font).

## 3b. Type

- Two faces: `--sans` (the system SF face, then Geist, Vazirmatn) for all words, `--title` (Fraunces, Markazi Text for Persian) for titles only: headings in notes and documents, document names, page titles. Section names keep `--sans` (5.80). Never for buttons, labels or body text.

## 4. Icons

- App icons are line icons: 16×16 viewBox, `stroke="currentColor"`, stroke 1.5, round caps.
  Panel icons live in `public/panels.js` (`DDpanelGlyph`), others in the bundle's icon set and `board-icons.js`.
- Icons read like SF Symbols (5.83): a clear line drawing, and where it helps a soft tinted body (`fill`, 22% of the color) or a small solid part (`solid`). Each picture shows what the thing is at a glance; no two actions share one.
- Every icon-only button on the Board's bars shows a small glass label when the pointer rests on it: its name, then its key (e.g. "Sticky note · S").
- Going back is a tinted chevron (‹), never a loud colored square. The header's back to where you were is a plain arrow, so it is never mistaken for the day's ‹ › chevrons.
- Emoji are only for the person's own content (task emoji, notes).
- The interface's own words (labels, buttons, titles, menus) can't be selected, like an app. Only what the person writes or reads can be: fields, the note and document editors, a document being read, comments, the day note and code (or anything with `.dd-selectable`).

## 5. Buttons and controls

- Heights: 28px quiet controls, 32–36px chips, 44px minimum on touch (`pointer:coarse`).
- Buttons are capsules on a soft fill (`--wash`); `btn solid` (the tint) for the one main action; `textbtn` for small links.
- A choice between a few options is a segmented capsule: a soft track, the picked part a raised capsule.
- On/off settings are iOS switches (green when on). Fields are filled, without outlines; focus shows a soft tint ring.
- Destructive actions ask once or offer Undo; prefer Undo. Feed deletes also wait 30 days in Recently deleted (`trash.js`).
- A nudge is one calm line with one button and "Not today" (`nudges.js`). It never moves anything on its own.

## 6. Panels and dialogs

- Popovers open next to their button and close on Esc and on a click outside.
- Dialogs have a title (`aria-label`), Esc closes, focus returns to the button that opened them.
- On a phone, sheets come from the bottom; the view tabs stay at the bottom.

## 7. Phone

- The tabs live at the bottom, as a floating glass bar a little above the edge; content fades out under it.
  Capture floats above them and never covers content.
- The Board opens full screen and ends above the tabs.
- The first time the app is opened on a new day, a phone shows the Engine's Today over the Board (5.87); Close is one tap back to the Board. Settings › Basics › "On a phone, open on Today" turns it off.
- In the Engine on a phone, Today comes right under quick add; leftovers, Capture and nudges wait under it.
- Every tap target is at least 44px.

## 8. Persian and right-to-left

- Every text a person types uses `dir="auto"`, so Persian starts from the right.
- Every new label has a Persian version (`t(en, fa)` or the Persian dictionary).
- Numbers in Persian UI use Persian digits where the rest of the line does.

## 9. Sync

- No view keeps its own copy of the truth. If Board can change it, the Engine,
  Calendar and the Feed show the change at once (see `CLAUDE.md` › 0).
- With sync on, the server keeps a copy of the planner for each of the last 30 days
  it changed, and its last 20 saves (5.90). Settings › Your data lists them: Download
  gives a backup file, Restore works like importing one (a recovery copy of how things
  are now is saved first, days added since stay). Restore always asks first.
- Old months can be archived (5.91): Settings › Your data moves a month before last
  month to the server. Its days keep only their light record (habits, mood, energy)
  in the planner; the Calendar says "in your archive" with Bring back, which joins
  them again. Archiving asks first and offers Undo; bringing back never passes the
  sync limit.
- Limits are measured in room, not in counts (5.88.1): new drawings stop only when
  the planner nears the 1.5 MB sync limit, or when one board holds more than it can
  show smoothly. Deleting, erasing and moving always work, and the message says what helps.
