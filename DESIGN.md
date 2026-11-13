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
| **Engine**: the day's tasks (E on the Board, and the Engine tab), in two columns: Today and Park | today box, Plan (the old page) |
| **Park**: tasks that are not for today and stay from day to day | Later tray, backlog |
| **After**: the order between tasks or steps ("Colour pass after Sketch"); a waiting task is never locked | depends on, blocked by, dependency |
| **Focus**: the timer | Stillness |
| **Pause the day**: the "life happened" pause | Life happened |
| **Lane**: a row in Board Lanes (Work, Life…, the person's own names) | track |

- "Life" is only ever a lane name the person chose. Do not use it for app features.
- Old labels that still pass through `DDUI` are rewritten in `public/words.js`.
  Add a new rename there (English and Persian) instead of editing every call.
- Short, calm, plain. "Add task", not "Create a new time block". No exclamation marks.
- Time is written one way everywhere: `45m`, `3h`, `1h 30m` (`DDduration` in `measure.js`).

## 2. Calm by default

- One main action per area. Everything else is quieter (ghost button, text button, or behind "…").
- A tool with nothing in it hides until it has something, or until "…" is open (`dd-quiet` class).
- No hour grids, Gantt bars or red "late" states. Time is a small number next to the name, and optional.
- No guilt: no red, no streak-loss warnings, no "you failed". Use neutral words ("not yet", "left").
- Budgets and goals are soft: "1h 30m / 6h · week", "12 of 35 · 9 days left". Green when reached, never red when over or behind.
- Deadlines are soft too: "◆ 8 days left", "tomorrow", "date passed" (`deadlines.js`). On a note the badge sits above the paper, never on it.
- A task may be light or heavy (`energy.js`), never required. A tired day (😫 😕) offers the light ones first.
- The Week view and its look back count what happened; they never score it. Next week's focus is one line.
- Help text fades away: show a hint once, then rely on `?` and tooltips.
- A task in the Engine is one line. Details open with ⋯, steps open when asked.

## 3. Color

- The UI itself is gray (Graphite): use the tokens in `public/graphite.js`
  (`--paper`, `--panel`, `--wash`, `--ink` to `--ink-4`, `--rule`, `--rule-2`).
- One accent: `--now`. Green `--ok` only for done.
- Color belongs to the person's content: sections, notes, lanes, tags.
- Every color works in light and dark. Never hard-code a hex for UI chrome.
- **Never change the sticky notes' look** (shape, colors, fold, font).

## 4. Icons

- App icons are line icons: 16×16 viewBox, `stroke="currentColor"`, stroke 1.5, round caps.
  Panel icons live in `public/panels.js` (`DDpanelGlyph`), others in the bundle's icon set and `board-icons.js`.
- Emoji are only for the person's own content (task emoji, notes).

## 5. Buttons and controls

- Heights: 28px quiet controls, 32–36px chips, 44px minimum on touch (`pointer:coarse`).
- Pills (`dchip`, `dd-pill`) for tools; `btn solid` for the one main action; `textbtn` for small links.
- Destructive actions ask once or offer Undo; prefer Undo. Feed deletes also wait 30 days in Recently deleted (`trash.js`).
- A nudge is one calm line with one button and "Not today" (`nudges.js`). It never moves anything on its own.

## 6. Panels and dialogs

- Popovers open next to their button and close on Esc and on a click outside.
- Dialogs have a title (`aria-label`), Esc closes, focus returns to the button that opened them.
- On a phone, sheets come from the bottom; the view tabs stay at the bottom.

## 7. Phone

- The tabs live at the bottom. Capture floats above them and never covers content.
- The Board opens full screen and ends above the tabs.
- Every tap target is at least 44px.

## 8. Persian and right-to-left

- Every text a person types uses `dir="auto"`, so Persian starts from the right.
- Every new label has a Persian version (`t(en, fa)` or the Persian dictionary).
- Numbers in Persian UI use Persian digits where the rest of the line does.

## 9. Sync

- No view keeps its own copy of the truth. If Board can change it, the Engine, Lanes,
  Calendar and the Feed show the change at once (see `CLAUDE.md` › 0).
