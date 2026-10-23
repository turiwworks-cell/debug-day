# Changelog

Every change gets an entry here: version, date, branch, and what changed. Newest first. See `CLAUDE.md` for the rules.

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

