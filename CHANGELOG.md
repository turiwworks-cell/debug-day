## 5.45.0 — 2026-11-04
Branch: claude/project-thread-pbgoz7
- Safety and gentle nudges from the full app review (part 6 of 7).
- Recently deleted: notes and sections deleted from the Feed wait 30 days. Board › top "…" › Recently deleted lists them ("Ideas + 4 more · 3 days ago"); one click puts them back inside their section (or at the same place if the section is gone), with their lines. Undo of the delete also takes the entry away. It syncs with the Feed and stays small.
- A note closed with nothing in it goes away (Undo brings it back). Photo, synced, tagged and goal notes stay.
- Days no longer keep their own copies of Feed note places (about 50 per day before); they are dropped when a day loads and when the board saves.
- The sync badge says "Synced · 2 min ago" with a small dot (green synced, orange waiting).
- Settings › Data backup shows the space used: "Space used: 340 KB of 1.5 MB (23%)".
- Plan (and the phone's Today card) starts with yesterday's leftovers when there are any: "1 left from Wed 28 Oct · Bring it / Not today".
- A very full day (more than 10h, or 12 open tasks) shows one line: "This day is very full (11h 30m) · Move “Emails” / It’s fine". It offers the lowest-priority task and moves it to tomorrow, the same task in every view.
- DESIGN.md: Recently deleted and nudges.
- Test: new upkeep unit test and tests/browser/upkeep.cjs (desktop and phone). figjam-notes, section-lines and section-interactions now type a word into the notes they create, since empty notes go away.

## 5.44.0 — 2026-11-04
Branch: claude/project-thread-pbgoz7
- Soft budgets, goal counters and "→ Today" from the full app review (part 5 of 6).
- A section can have a soft budget (right-click › Soft budget: 1–8h a day, 2–40h a week, or 1, 3 or 5 times a week). Beside its name it shows "1h 30m / 6h · week", added up from the done tasks that came from it and the sections inside it. Green when reached, never red. Nothing new is stored on the days.
- A section also shows how many of this day's tasks came from it ("2 today").
- "→ Today" on a note in the Feed adds it to the day as a task (first line = name, other lines = steps, from the note's section) and keeps the note. The note then shows "● Today" ("✓ Today" when done); a second tap doesn't add it twice. Day notes keep "→ Plan". Also in the note's menu: "Add to this day (note stays)".
- A goal note can count up in the Goals rail: − / + and an optional target and date ("12 of 35 · 9 days left").
- Tasks keep the note they came from (noteRef) and day notes keep their goal after a reload.
- DESIGN.md: budgets and goals are soft.
- Test: new budgets unit test and tests/browser/budgets.cjs (desktop and phone).

## 5.43.0 — 2026-11-03
Branch: claude/project-thread-pbgoz7
- One set of words and line icons from the full app review (part 4 of 6).
- The app says Task and Step: "Add task", "Find a task or step", "1/2 steps", "+ Step", "↗ Task", "Task tool" and more (English and Persian). Renames live in the new public/words.js, which DDUI reads first.
- The timer is "Focus" (was "Stillness"); "Life happened" is "Pause the day" ("روز را نگه دار").
- The Board's name is its day ("Wed 4 Nov" with "40% completed" under it) instead of "Creative board". The Feed no longer says "Same on every day".
- Board cards show time and steps; the kind of work is already in the card's icon and color.
- View tabs, panel titles and Search rows use line icons instead of emoji (📋🧠📅🌱). Emoji stay for your own content.
- Search no longer offers "Open app map".
- New DESIGN.md: words, calm-by-default rules, color, icons, buttons, panels, phone, Persian and sync. CLAUDE.md points to it.
- Test: new words unit test (renames, Persian, panel line icons); board-ux, timer and calm-plan use the new words.

## 5.42.0 — 2026-11-03
Branch: claude/project-thread-pbgoz7
- Calm Plan from the full app review (part 3 of 6).
- A task in Plan is one line: name, time and steps. The colored hour bar under each task is gone (time is the small number; − and + still change it).
- Steps open only when you ask: the steps button opens the field, ready to type, and Esc closes it. A task without steps never shows an empty step area, and the "Break this block into smaller mind-map steps…" line is gone. Open steps show a small "+ Add a step" instead of a field.
- On a computer the − / + buttons and an empty task's steps button show when the pointer is on the row.
- The kind of work ("Deep work") is no longer repeated on every Plan row; the row's icon and color still show it.
- Day tools with nothing in them wait behind a "…" button: the Template chip when there is only one template, Worry parking with no worries, an empty Later tray, and Life happened while the day is not paused. "…" shows them all. On a phone the Worry and Later pills follow the same rule.
- A day without stickers shows only a small "Stickers & emoji" button in the Plan's header instead of the "A little you, in your day" box (same in the Calendar and phone Today).
- The Plan's hint is short: "Right-click a task for more" (the hour sample and the resize hint are gone).
- Test: new calm-plan browser test; board-ux opens "…" before Life happened on a computer.

## 5.41.0 — 2026-11-03
Branch: claude/project-thread-pbgoz7
- Phone and Board room from the full app review (part 2 of 6).
- Board view gives the board the whole window: the Plan's rows (template, timer, worry, later, pause, day note, find, quick add) step aside there, since the board has its own tools. The Plan view keeps them all.
- Phone: the Board opens full screen by default, and the tabs stay at the bottom under it, so Plan is one tap away. Canvas settings › Open full screen still turns it off, and a saved choice is kept.
- Phone: the Board inside the page ends above the tabs, so its tools are never under them.
- Phone: the view tabs (Plan, Board, Lanes, Calendar…) sit at the bottom under the thumb. Capture floats just above them.
- Capture has a third kind, Idea: it lands as a note in an "Inbox" section of the Feed (made the first time). Rename or move the section and it stays the Inbox. The kind you used last is remembered.
- Capture's date picker shows only for a task, and "Later / no day" is always one of its choices.
- Test: capture unit test checks an idea goes to the Inbox, the section is made once and keeps its new name.
- Test: new phone-board browser test (board room on a computer, phone full screen with tabs, idea to Inbox). Phone browser tests keep the board in the page unless they ask for full screen; the Sections sheet test measures from the board's bottom edge.

## 5.40.0 — 2026-11-03
Branch: claude/project-thread-pbgoz7
- Clean-up from the full app review (part 1 of 6).
- Add block no longer leaves a "New block" behind: it opens the quick-add line already set to that lane ("@Work "). Type a name and press Enter; close it and nothing is made.
- Tasks can be as short as 5 minutes (was 15). The − and + buttons move by 5 minutes up to half an hour, then by 15. Dragging a card's edge snaps to 5 minutes.
- Time reads the same everywhere: "45m", "3h", "1h 30m" (new DDduration in measure.js). Phone Today, Later, the Calendar day and its task list used "180 min" before.
- A done task is the tick, the line through the name and the dim text. The extra "Done" pill on Plan rows and Board cards is gone.
- Persian steps in Plan start next to their tick instead of the far right.
- The step field's hint is short: "Add a step… (a > b nests it)".
- Board: "Today's habits" starts closed (its button still opens it; a saved choice is kept).
- Board: when the Engine sits on the Feed's corner, the Feed's name moves past the Engine so the two names never cover each other.
- Left over from removed features: the "Alt+M App Map" hint under Plan, the pinned "Open app map" in Search, "Feelings page" and "Day feelings & events" in Settings › Show, and the Calendar's "Feelings & events 0" and "how they felt" text. Old feelings still show in the Calendar if a day has some.
- Phone: pages leave room at the bottom so the Capture button never covers dates or settings. The calendar picker shows "Gregorian" in full.
- Test: rails unit test expects habits closed by default.

## 5.39.1 — 2026-11-03
Branch: claude/project-thread-d5d9gg
- Alt-drag to copy now looks like a copy: the original stays where it was and the copy-to-be follows the pointer half see-through with a dashed outline, and the cursor shows "copy". Drop it and the copy lands there, as before.
- board-trust browser test checks the original stays in sight, the see-through copy while dragging, and that both go away after the drop.

## 5.39.0 — 2026-11-03
Branch: claude/project-thread-d5d9gg
- Parent notes: a small dark badge on the note's top corner with the number of its sub-notes ("↳ 2"). Nothing shows under the note any more. Click the badge to see its sub-notes (and parent) and jump to one. A picked sub-note shows a small "↑" badge that does the same.
- "Badge only" is the new default parent look; Soft stack, Page edges and Soft ring stay in Tools ⋯ → Parent note look.
- Note tags sit above the note now, as solid coloured chips with readable words (dark or light, picked from the colour).
- Tag colours can be changed: right-click a tag on the board, or click its dot in the tag field. Twelve colours, ↺ gives the tag back its own colour. One colour per tag for the whole planner (any spelling), saved with the Feed (`life.tagColors`), synced, undoable.
- Tag several notes at once: pick them, then Tags in the selection bar (or right-click → More → Tags…). Adding a tag adds it to all of them, removing takes it off all of them. One undo per change.
- The tag field still opens just under the note while you type, so it never hides behind the top bar.
- Tests: board-tools browser test updated for the badge, tags above, tag colours and tagging many notes; new unit tests for tag colours (normalizer, sync merge, Worker).

## 5.38.2 — 2026-11-03
Branch: claude/project-thread-d5d9gg
- Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y now work while the Align panel is open (after clicking one of its buttons). Before, you had to leave the panel first.
- Align opens by itself when you pick two or more things on a computer. Close it and it stays closed until the selection drops below two; the bar's Align button still opens it. On a phone it stays behind the button so it doesn't cover the board.
- The selection bar sits above the Align panel, so its colour and weight pickers are never hidden under it.

## 5.38.1 — 2026-11-03
Branch: claude/project-thread-d5d9gg
- Lines inside a section: dragging a note's + (or connection point) into the section's empty inside now makes the new note there with a line to it. Before, the line got stuck to the section's frame and no note appeared.
- Elbow lines between notes inside a section stay inside it. Before, they went around the outer frame (down to its bottom) and jumped at the smallest move.
- Dropping a line end on a section's edge still connects to the section.
- New unit test in `tests/board-canvas.test.mjs` and browser test `tests/browser/section-lines.cjs`.

## 5.38.0 — 2026-11-03
Branch: claude/project-thread-00fdop
- Photos straight on the Board, like a mood board: drop image or video files on the canvas, or paste one (Ctrl/Cmd+V), and a photo card lands where you dropped it. Several at once sit side by side.
- The file goes to your Google Drive "Debug Day" folder (same as task photos); the card is a normal note that keeps only the Drive link (`media`), so it saves with the day, moves in and out of the Feed, survives reloads and shows in search and the Day review by its file name.
- Card shape follows the picture (wide pictures get a wider card). Double-click adds a caption under the photo. ↗ opens it in Drive.
- While uploading, a preview shows the progress and nothing is saved yet, so a failed upload never leaves a blank note. Not signed in to Drive yet: the preview asks for one tap on "Save to Drive" (a drop can't open Google's window by itself); × leaves it out.
- Also from the Tools dock ⋯ → "Photo or video…" (works on phone) and the canvas right-click → More → "Add photo here". New photo icon.
- New module `public/board-photos.js`; board.js only hooks it in. media.js exposes connect/upload/thumbnail for it and keeps a picture's width and height.

## 5.37.0 — 2026-11-03
Branch: claude/project-thread-b1dsgs
- Engine sections: sections you draw inside the Engine's frame (outside the Feed) now count as the Engine's own. Nothing new is saved; it is read from where they sit.
- In the Tab flowchart they leave the main tree and sit last, in one quiet folded row: "⚙ Engine · 3", with their names. Click it (or ↓ from Main board, then Enter) to open; the choice is remembered. A search that finds one, or being inside one, opens it.
- On the board they are a light dashed outline with a small grey name, so today's tasks stand out. Notes inside them look the same as before.
- Drag a section out of the Engine and it is an ordinary section again, in Tab and on the board.
- An empty Engine shows "↺ N still open" on its title. In the Engine a soft line offers yesterday's open tasks and waiting tasks left on older days: Bring them (one undo takes it back), Choose… (Earlier Engine), or × Not today.
- A waiting task brought in keeps waiting since the same day, so it no longer stays behind on the day you started waiting.
- Calmer Engine rows: the name, minutes or score, and where it came from stay in sight; kind, lane and "show on the board" appear on hover, on focus or with ⋯ (always there on a phone).
- New unit test `tests/engine-quiet.test.mjs` and browser test `tests/browser/engine-quiet.cjs`.

## 5.36.0 — 2026-11-03
Branch: claude/project-thread-yo360t
- Comments on the Board: press M (or the Comment tool) and click a card or an empty spot to leave a short note. Write, reply, edit, resolve (hides it) or delete.
- A comment on a card follows the card. A free comment inside a section belongs to the section (Feed, the same every day). Any other free comment belongs to that day's board.
- The Comments list (Shift+M, or Comments in the top ⋯ menu) shows open and resolved comments for this day and the Feed. A click goes there; Back (Alt+←) returns.
- On a phone a thread opens as a sheet at the bottom.
- Pen: press P (or the Pen tool) to draw with a mouse, pen or finger. Six colours, three widths, smooth and sharp at any zoom. Two fingers still move the board.
- The eraser removes a whole stroke with one touch. With the pen off, click a drawing to pick it, drag to move it, Delete to remove it. Undo and redo work for drawings and comments.
- A drawing inside a section belongs to the section; anywhere else it belongs to the day. Points are saved simplified and compact.
- Tags on day notes and Feed notes, the same tags as tasks: add or remove them from the note's toolbar (tag button) or right-click → More → Tags…. They show under the note, in the side rails, in the day review and in search results.
- "#tag" in Board search (Ctrl+F) and app search (Ctrl+Space) finds notes and tasks with that tag.
- Parent notes and sub-notes come from the arrows you already draw: A → B makes B a sub-note of A. A parent note gets a soft stack of sheets behind it and a small count of its sub-notes under it; the note itself is unchanged.
- A picked note shows its parent and sub-notes under it; a click goes there and Back returns. Select branch (right-click → More) takes the sub-notes along.
- Three calm parent looks to choose from: Soft stack (default), Page edges, Soft ring. Tools dock ⋯ → Parent note look.
- Comments, drawings and note tags are saved with the planner, sync between devices and survive every clean-up. MCP edits keep them, and removing a Feed section keeps its drawings and free comments where they were.
- The tools dock fits on a phone with the two new tools; the selection toolbar keeps clear of a note's tags and family.
- Synced notes (5.35) keep their tags in every copy: linked copies now read and write tags through the same tag functions, and day notes keep their tags when saved.
- New browser test `tests/browser/board-tools.cjs` (desktop and phone) and unit test `tests/board-tools.test.mjs`.

## 5.35.0 — 2026-11-03
Branch: claude/project-thread-88x2ih
- Synced notes: a note can have synced copies on any day and in the Feed. Change the words, color or text look of one, and every copy changes. Each copy keeps its own place and size.
- Synced sections: one section seen in two places. Its name, color, size, the notes and sections inside it and the lines between them match in every copy. Each copy keeps its own place and its own fold.
- Deleting a note inside one copy of a section deletes it in the other copy too. Deleting a whole copy keeps the others.
- Right-click a note or section → "Synced copy…": Make a synced copy (Ctrl/Cmd+Shift+D), Copy as synced (paste it on any day or in any section), Sync with notes that already have the same words, a list of the other copies that takes you there, and Unsync this copy.
- Copy and Paste of a synced note gives another synced copy. Duplicate (Ctrl/Cmd+D) and Alt+drag still make a copy that stands on its own.
- A small mark with the number of copies sits just above a synced note's top-right corner, outside the paper. The note itself looks the same. Clicking the mark opens its copies.
- Undo takes an edit back in every copy. Plan, Lanes, search, sync between devices and Claude (MCP) all see the same words, because every copy is saved as a normal note.
- Edits made by Claude through MCP also reach every copy.
- Fix: after a search took you to a note, a later change in the Feed no longer pulls the board back to that note.
- Going to a copy on another day keeps the board full screen.
- New unit test `tests/linked.test.mjs` and browser test `tests/browser/linked-copies.cjs`.

## 5.34.0 — 2026-11-03
Branch: claude/project-thread-6lgo93
- Photos and videos on a task: “＋ Photo or video” in the task edit panel (Plan and Board card details) saves files to a “Debug Day” folder in your own Google Drive.
- The planner keeps only a small link per file (`block.media`), so the 1.5 MB sync limit stays free for text, and Plan, Board and every other view show the same files.
- Tiles show a preview (once Drive is connected in this tab) or a photo / video icon; a tap opens the file in Drive. Videos upload in one resumable stream with a progress line.
- × on a tile only takes the file off the task; it stays in Drive. Plan cards show a 📎 count.
- The app asks only for Google's `drive.file` permission, so it sees just the files it made.
- Google Client ID is set in `wrangler.jsonc` vars. New `/api/media-config` gives the page the Google Client ID from the Worker variable `GOOGLE_CLIENT_ID`. Without it, the button says Drive isn't set up yet.
- Setup steps in README (English and Persian). New tests `tests/media.test.mjs` and `tests/browser/media.cjs`.

## 5.33.0 — 2026-11-03
Branch: claude/project-thread-88x2ih
- Back to where you were: the app remembers each place you visit (the tab, the section board that was open, and where the board was looking) and takes you back with one click.
- A Back button sits next to the tabs (on a phone, at the start of the tabs row). It says where it goes, for example “Back to Board · Creative life”. In full-screen Board it sits at the top left of the board.
- Keyboard: Alt+← goes back, Alt+→ goes forward again, Alt+↑ / Alt+↓ go to the previous / next tab. Inside a text field these keys stay with the text. Plain arrows keep their old jobs (days in Plan, nudging on the Board).
- The browser's own back / forward (and the mouse's side buttons in Chrome, Edge and Firefox) walk the same trail.
- A new place starts on a jump: another tab, into or out of a section, a search result, the Sections list or Go to Feed. Panning and zooming only update the place you are in, so the trail stays short. Going back never changes the day you are looking at.
- Board search finds things on other boards too: a day note seen from inside a section, or a Feed note in another section, opens that board and shows it.
- New browser test `tests/browser/places.cjs` and unit test `tests/places.test.mjs`.

## 5.32.0 — 2026-11-03
Branch: claude/project-thread-88x2ih
- Renaming a section: double-click its name and it opens at a readable size (16px or more on screen) at any zoom, with the old name selected so you can just type.
- Writing when zoomed out: the board glides close to the card so you can read what you type, then glides back to where you were when you finish. If you move the board yourself while writing, it stays where you put it. “Automatically zoom in to edit” in Settings turns this off; Reduce motion makes it a jump.
- Text align on the note's bar: one button that goes left, center, right.
- New Text tool (T, or “Add text here” on a right-click): words straight on the board, with no note paper, good for titles. It is still a note, so it shows in Plan and everywhere notes do; More › “Show as a note” gives it its paper back. An empty text goes away when you finish.
- Right-click is shorter and shows only what fits: quick colors in one row, Color & properties, Edit text, “Send to section…”, Convert note to task, section actions, Align, Group, Copy, Duplicate, Lock, Delete. Everything else waits in More. The empty-canvas menu is shorter too.
- “Send to section…” moves notes and sections into any section (it finds a free spot inside and the section grows to fit), or out of their section. A note of the day that goes into a section becomes a section note, like a drop does, and its lines come along.
- Align panel, like a design app (Align & space on the bar, or right-click): align left / center / right / top / middle / bottom, space evenly, and same width / same height.
- Lines: the color and weight you pick last are what new lines get. Lines caught in a selection box get Line color and Line weight on the bar, so many lines change at once. The line right-click has quick colors too.
- Undo / redo messages and the name of a task made on the board are in English now.
- New browser test `tests/browser/board-writing.cjs`; older board tests follow the new menus.

## 5.31.0 — 2026-11-03
Branch: claude/project-thread-88x2ih
- Each habit has its own daily goal, for example sport 60 minutes and writing 30. A day is “Good” at half the goal, “Enough” at the goal and “Too much” at twice the goal, so 60 minutes of sport is enough while 60 minutes of writing is too much. A habit without its own goal keeps the old shared levels.
- “Manage habits” sits next to the habit list in Plan: rename, change the color, set the goal and remove (it asks once first), all in one place. The goal can also be set from a habit's details on the Board.
- The Habits section is gone from Settings.
- Settings start with plain options: Basics (block length, focus timer, reduce motion), Board, and “Where your data is saved” with Download a backup and Save a recovery copy. Server, keys, MCP and storage details are under Advanced, closed by default.
- The app is in English only. A saved Persian UI choice now shows English. Your own notes, titles and Persian text stay as they are.
- Browser tests now run in English only. New unit test for habit goals; `tests/browser/habits.cjs` covers Manage habits, goals, Settings and the English-only UI.

## 5.30.0 — 2026-11-03
Branch: claude/project-thread-88x2ih
- The timer keeps going after a page refresh. A paused timer keeps its time too, and a second open tab shows the same clock.
- New timer look, the same in Board and Plan: a big clock, the time it ends, and calmer buttons.
- When time is up you notice it, even in another app: a system notice (the browser asks once, the first time you start), a soft chime, a blinking tab title, and a banner that stays until you press Done or +5 min.
- If the timer ended while Debug Day was closed, the banner says when it ended, without a late sound.
- Bar mode: the clock becomes a bar with no numbers, for when you only want a feel for how much time is left. The Board button, the Plan chip and the Today view follow it.
- Presets on the timer itself: 15, 25, 45, 60 and 90 minutes start with one click. In Plan, the small arrow next to Stillness opens the full timer.
- +5 min instead of +1 min. Start after the end starts the same length again.
- Sound can be turned off on the timer. Changing the default length in Settings no longer resets a timer you are using.
- New browser test `tests/browser/timer.cjs` and unit tests `tests/timer.test.mjs`.

## 5.29.1 — 2026-11-03
Branch: claude/project-thread-88x2ih
- Folded sections: a note dropped in the empty space under a folded section stays there. Only a drop on the folded section's name bar puts it inside, and the board then says which section it went into.
- A section that grew around a long note keeps that size, so a note placed in the grown part belongs to the section and moves with it.
- Groups: adding a note to a group makes one bigger group instead of a second group beside it. Grabbing any member picks up the whole group (older boards with overlapping groups count as one).
- Undo takes back only your last action. A note that came in from the phone or another tab since then stays, and changes from sync are no longer undo steps of their own.
- Paste brings what you copied last. From the right-click menu (or a Persian keyboard) the board's own copy goes straight in while it is still the latest; if you copied something in another app, that is pasted instead. No more "press Ctrl/Cmd+V" message when the board already has what you copied.
- Lines between pasted notes no longer get lost when the notes land in a Feed section or on a section's own board.
- Alt-drag (Option-drag on a Mac) leaves the original where it was and drops a copy.
- Reset appearance on a Feed note now clears its text size, color, alignment and opacity too.
- A note pasted into a Feed section keeps its text size, color and alignment.
- Reversing a two-way line keeps both arrows; the two ends swap.
- Elbow lines: the middle handle always sits on the line. Dragging it moves the line along the way it can move; dragging across does nothing, so the handle never drifts away from the line.
- Lines between Feed notes keep their shape on a section's own board.
- Zoomed out, lines get a little thinner, so they no longer look heavier than the notes.
- Before your data is replaced (importing a file or taking the cloud version), a recovery copy must be saved. If the browser storage is full, nothing is replaced and the app says why. A recovery copy now drops the oldest copy when there is no room for two.
- New browser test `tests/browser/board-trust.cjs` and unit tests `tests/board-history.test.mjs`.

## 5.29.0 — 2026-10-31
Branch: claude/project-thread-slkpwv
- Notes: while you type, a note grows with its text. The text field was squeezed to the note's old size and scrolled inside it, so lines were cut in half at the top and bottom and long notes were hard to edit. The text also no longer shifts when you start typing.
- A section's own board is all of it. Notes and sections made anywhere there, outside the section's frame too, belong to the section and stay where you made them (before, they were pulled into the frame). What sits outside the frame shows only on that board; the main board shows what is inside the frame, and the section's ↗ button counts the rest ("↗ 2").
- Sections inside a section's board open as their own boards too. Search and the Sections flowchart open the board a thing lives on.
- Making a section smaller never hides anything: what ends up outside drops onto the board it sits on.
- A section drawn on the board outside the Feed stays right there; the Feed no longer stretches to take it in. Notes of the day inside it join it. Moving the Feed leaves it in place; dragging it into the Feed makes it part of the Feed again.
- Grabbing a section's corner resizes both ways (the bottom edge used to cover the corner).

## 5.28.0 — 2026-10-31
Branch: claude/project-thread-slkpwv
- Notes: a to-do list no longer breaks the note. The tick box was stretched across the note and squeezed the words into one letter per line; now each task sits on one line beside a small box. Turning lines into to-dos never doubles a box ("- [ ] - [ ]") or touches blank lines.
- Notes: text is larger and firmer (×1.15, medium weight, darker), and a note without its own size now reads at 16px like new notes.
- Notes keep their size at every zoom. Zooming out no longer makes notes taller (their date line used to grow with zoom-out and stretch them).
- Double-click (or double-tap) anywhere makes a note there, ready to type: empty board, inside a section, the Engine or the Feed. A double-click on a section's name still renames it; on a note or card it still edits.
- Notes are made on sections: the Note tool (S) now works over a section and the note joins that section.
- Sections and selection: a section's name always drags it. On its empty area a click selects it, a drag draws a selection box (so you can pick notes and sections inside it together), and once it is selected a drag there moves everything selected. Shift-click still adds or removes.
- Section names follow one rule at every zoom: they shrink with the board only down to a readable size, never run past their section (long names end in "…"), always sit above the notes inside, and when two names would overlap the bigger section keeps its name until there is room again. No more huge names zoomed out, or names that vanish right away.
- The Life section is now called Feed (فید): its pill, the toolbar, search and the size tools. Your Life lane is unchanged.
- The Feed moves: drag its name pill. It keeps its spot on every day. The Feed and the Engine both grow from a corner grip (bottom-right); the Engine keeps the size you give it, and a new day starts with the same size.
- Habits are no longer a section under the Engine on the board; the habits rail beside the board (Shift+H) is where they live.
- Plan no longer shows the Feed list.
- App changes is removed: no section, no panel, no search results, no Settings entry. Old notes stay saved.
- The selection bar shows "3 objects" or a section's name in full instead of cutting it after a few letters.
- New browser test `tests/browser/board-fixes.cjs`; tests for habits, panels, rails, search, sections, notes and section names updated.

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


