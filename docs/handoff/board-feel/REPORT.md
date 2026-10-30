# Board feel handoff — stopped at owner request, 2026-10-31

## Status and authorization
The owner explicitly requested that no more fixes be made and that all work be reported on GitHub for another agent. This snapshot is unfinished, NOT release-ready, and must NOT be merged as-is. No further feature work or test repairs were attempted after that request.

## Phase 5: completed and merged
- Rails PR: https://github.com/turiwworks-cell/debug-day/pull/46
- Merged into main as `2e24868b1f19698a9c3efe19582c60ea1f664358`, version 5.20.0.
- Before merge: 177 unit tests passed; all 20 browser suites passed locally. GitHub UI regression checks for the final rails head `c3b0e247e809d8e348c0ea4151c7c4c508a35d17` completed successfully (run 41132004671).
- Rails provide canonical goal/note connections, main-to-section ordering, today's shared habit controls/history, synced preferences, phone overlays and bilingual labels. See merged PR for full history.

## Current branch and scope
- Branch: `codex/board-feel-cards`, created from the merged Phase 5 main.
- Intended PR A: items 1–6 of the attached original brief. Proposed version is 5.21.0 in package.json, package-lock.json and Worker INFO; changelog/README updated.
- PR B (items 7–11: global/Board zoom interception, search fullscreen, nested labels, fixed-size ports and rounded elbow connectors) has NOT been implemented or started on a separate branch. Do not assume those requirements are done.
- The current code is preserved for inspection/continuation in this draft PR; no PR A production merge has happened.

## Work implemented in PR A, still requiring completion
1. Added `public/stickies.js`: pure height/width snapping, markdown formatting and to-do toggling; React rendering of bold, strike and checkboxes; creation-date label helper honoring the Calendar panel's `debug-day:review-calendar` preference; CSS for intrinsic content, footer, border resize bands and compact toolbar.
2. Board auto-height now measures intrinsic note-body content via ResizeObserver and a local height cache, uses max(width, content), ignores stored sticky height during layout, and expands derived Life parent bounds. Existing stored h is retained. Lane card layout also computes attached note height, but needs regression verification.
3. Sticky n/s handles removed. Side edges snap to base or 1.5×base; corner scaling stores `baseW` with a minimum 160. Added full border hit zones and 120ms width transition. Properties width changes also snap through board-core. These changes are not fully regression-safe yet; see failures below.
4. Selection toolbar shortened; removed edit, quick color, branch/group, duplicate, delete and zoom buttons. Context menu retains commands and adds moved details/add-step actions. Toolbar positioning helper increased above-selection gap from 14 to 24 pixels to leave room for handles.
5. Added B / strike / to-do toolbar actions and shortcuts. Editing keeps raw markdown; rendered checkbox updates canonical note text. Added last-empty-to-do hint. Engine changes are restricted to requested note-to-task markdown parsing: remove **/~~ and checkbox marks; completed to-do steps stay done. Board → Plan conversion now calls that parser too.
6. Added `at` and `baseW` to day-note/Life normalizers, creation/copy paths, and MCP note creation. New copies get today's date. Legacy day notes use day.date for display, legacy Life notes show no date. Transfer paths pass through existing fields.

## Key files
- New: public/stickies.js; tests/stickies.test.mjs; tests/browser/board-feel-cards.cjs.
- Product hooks: public/board.js; board-core.js; board-experience.js; index.html; life-board.js; engine.js; src/worker.js.
- Existing tests adjusted to new requested behavior: board-experience.test.mjs (toolbar gap), life-workspace.test.mjs (snapped width), browser board-controls.cjs (320→360), artist-planner.cjs (More → Add a step), connected-planner.cjs (activate actual Lanes UI after reload), life-unified.cjs (palette properties instead of removed quick-color dot).
- Existing playful.cjs and board-ux.cjs were left unchanged, as requested.
- No changes to public/rails.js, enterRoom, keepInRoom, or room navigation logic. Derived note/section sizing does affect their visible layout; regression checks remain necessary.

## Validation actually obtained
- Latest unit run: 182 tests, all passed. Five new sticky tests cover height/width rule, markdown, to-do toggles, note-to-Engine completion and date/base-width normalization.
- Latest new cards browser run: en desktop, fa desktop, en phone, fa phone all passed; no console errors collected. Checks include long Life note overflow visibility, n/s handle absence, date fallback, B/strike/todo controls, raw editor shortcut, checkbox without editing, duplicate date, toolbar removal and desktop side-band width snap.
- These focused checks DO NOT prove every requirement complete. Mobile edge/corner dragging, all toolbar clipping/clearance cases, legacy transfers, footer behavior across zoom, and full cross-view stability still need stronger checks.
- Latest targeted artist-planner rerun passed in en/fa after its Add-step selector was moved to More.
- Latest connected-planner rerun passed en desktop after explicitly selecting Lanes; then failed on phone waiting for removed `Card details` toolbar button (around line 239). Remaining languages/cases did not complete.
- An earlier complete independent browser sweep had the following results. Several test adaptations occurred AFTER this sweep, so this is evidence of observed failures, not a claim that every one remains reproducible on the final snapshot.

| Suite | Sweep result |
|---|---|
| `tests/browser/connected-planner.cjs` | FAIL |
| `tests/browser/playful.cjs` | FAIL |
| `tests/browser/board-ux.cjs` | FAIL |
| `tests/browser/board-controls.cjs` | FAIL |
| `tests/browser/artist-planner.cjs` | FAIL |
| `tests/browser/measure.cjs` | PASS |
| `tests/browser/habits.cjs` | PASS |
| `tests/browser/panels.cjs` | PASS |
| `tests/browser/day-review.cjs` | PASS |
| `tests/browser/offline.cjs` | PASS |
| `tests/browser/life-board.cjs` | FAIL |
| `tests/browser/section-interactions.cjs` | FAIL |
| `tests/browser/cursor.cjs` | PASS |
| `tests/browser/board-experience.cjs` | FAIL |
| `tests/browser/figjam-sections.cjs` | PASS |
| `tests/browser/figjam-notes.cjs` | FAIL |
| `tests/browser/engine.cjs` | PASS |
| `tests/browser/rooms.cjs` | PASS |
| `tests/browser/sources.cjs` | PASS |
| `tests/browser/rails.cjs` | FAIL |
| `tests/browser/board-feel-cards.cjs` | PASS |

## Failure details and investigation notes
- connected-planner initially failed lane membership (`work` instead of `life`, around line 385). Diagnostic showed Board still in Mind map after a test wrote localStorage mode before reload; existing pagehide camera save can overwrite that test injection. Test now activates real Lanes UI. En desktop then passed; phone still expects removed Card details button. Do not infer all lane behavior is validated.
- playful waits for removed `Zoom to selection` button. The brief says leave playful and board-ux unchanged; report those limitations rather than claiming green.
- board-ux sweep hit sticky header intercepting pointer events on phone. Header CSS was subsequently changed to retain only the move grip, with top padding; suite was not rerun after that change.
- board-controls expected width 320 but got the requested snapped 360. Expected value was adjusted; full suite not rerun afterward.
- artist-planner expected removed `[data-add-step]`; updated to More menu and rerun successfully.
- life-board wrapper/life-unified expected removed quick-color button. Changed to palette/Hex flow; not rerun after this last edit.
- section-interactions failed `native note resize persists` (around line 52). Unresolved.
- board-experience failed marquee selection assertion (around line 116). Unresolved.
- figjam-notes failed `corner scales up` (around line 84). Unresolved; corner snapping/base-width/anchor math needs review.
- rails passed en desktop then failed because selection toolbar intercepted right habit heading click (around line 93). Unresolved style overlap; do not change rails data logic to address it.

## Design/implementation risks to review
- Auto-height measurement initially created a growth loop because body stretched to card; fixed by intrinsic max-content body sizing and removing flex growth. Verify no observer feedback loops remain in editing, lane attachments and zoom.
- baseW default 240 and old odd widths should remain unchanged on load; first resize snaps. Check corner behavior and west-edge anchoring carefully. Generic core style width limit was raised from 1200 to 4000 to support larger sticky scales; review scope.
- Date footer is screen-scaled; observer watches footer dimensions. Check low zoom and long text so footer never covers content.
- Placeholder in raw editor is a hint below textarea; exact last-empty-line placement still needs UX review.
- Phone screenshots show selected card clipped by the deliberately fixed test camera in the first capture. The test was subsequently changed to fit selection before capture, but screenshots were NOT regenerated after that edit. Images are useful historical evidence, not final visual acceptance.
- Existing auto-growing Life layout is derived, not migrated/stored; ensure section containment and routing reflect every height change.

## Artifacts and reproduction
- Original full brief: [original-brief.txt](original-brief.txt).
- Complete captured sweep stdout/stderr: [browser-sweep.json](browser-sweep.json).
- Latest unit output: [unit-tests.txt](unit-tests.txt).
- Historical reviewed screenshots: cards-en-desktop.png, cards-fa-desktop.png, cards-en-phone.png, cards-fa-phone.png (same directory).
- Windows environment: Node 24, PowerShell, Playwright with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`. The brief's /opt Chromium path is not present on this Windows host.
- Run `npm test`, then each `node tests/browser/<suite>.cjs`. Browser harness uses disposable local data, not production.

## Suggested continuation for the next agent (not performed)
Review the preserved diff, reproduce the unresolved failures above, finish item 1–6 acceptance checks, regenerate/review screenshots at both sizes/languages, and only then finish PR A. Refresh main and verify next free MINOR before any merge. After PR A is merged, start PR B from latest main with its own changelog/version entry. The owner has stopped this agent's fixing work; this report is a handoff, not a release approval.
