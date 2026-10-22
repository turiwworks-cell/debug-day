# Debug Day

A personal daily planner with a time-scaled board, mind maps, Persian/English UI, private multi-device sync, and an MCP server.

- `public/index.html` — self-contained app; starts with an empty workspace.
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
