# Debug Day

A personal daily planner with a time-scaled board, mind maps, Persian/English UI, private multi-device sync, and an MCP server.

- `public/index.html` — legacy bundled interface and integration points; starts with an empty workspace.
- `public/search.js`, `public/capture.js`, `public/life.js` — readable source for universal search, capture/Today, and optional scheduling/pause tools.
- `public/sync.js` — content comparison that ignores JSON object key order.
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

## Planner tools

Search (`Ctrl+Space` / `Cmd+K`) covers all days, nested subtasks, feelings, sticky notes, journals and feedback threads. Chips expose `>`, `#category`, `@lane`, `!priority`, `date:` (Gregorian or Jalali) and `is:done/open`. Use Tab for item actions or Shift+Enter to isolate matching results; Show all/Escape releases isolation. Empty search shows recent items and pinned commands.

Capture is available on every view. Worries live outside days, feed recurring-pattern statistics and can be closed or turned into tasks. Phones open a compact Today view; Full day restores all existing controls. Later holds unscheduled tasks, and task anchor times are optional. Life happened pauses the timer and offers continue, move remaining work or close today without fabricating completion.

MCP write tools include `create_day`, `set_day`, `add_worry`, `update_worry`, `add_later` and `schedule_later` in addition to block/note operations. Read `get_day` or `get_setup` first and pass the returned `expected_revision`. `anchor_time` uses `HH:MM` and can be cleared through `update_block`.

## Validation

Run all regression tests with Node.js 24: `node --test tests/*.test.mjs`.
Run the browser regressions with `npx playwright install chromium` followed by `npm run test:browser`. They use a disposable local SQLite planner and cover note movement versus connections, autosave before reload, keyboard deletion scope and undo, consistent completion, fixed-size touch targets, camera stability, and resuming a closed day. The same command also covers Persian and Gregorian date selection, per-day feeling drafts and edits, empty-day logging, recurring reminder occurrences, task moves, and a fresh offline HTML export. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` only when using an existing Chromium binary.
Before a frontend merge, check Chromium at 1440×900 and 390×844 with touch, in both UI languages. Confirm no document overflow or console errors, camera/mode persistence without sync writes, the ten-call MCP planning workflow, search actions, new-day reload, capture/worry/Later persistence, pause decisions, and downloaded HTML in a fresh offline context. A physical iPhone/Safari check is still separate from emulation.
