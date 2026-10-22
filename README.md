# Debug Day

A personal daily planner with a time-scaled board, mind maps, Persian/English UI, private multi-device sync, and an MCP server.

- `public/index.html` — self-contained app; starts with an empty workspace.
- `src/worker.js` — Cloudflare Worker for private sync and MCP.
- `schema.sql` — D1 schema and recent-revision recovery.
- `mcp-bridge.mjs` — stdio bridge for MCP clients.

## Setup

Requires Node.js 22+ and a Cloudflare account.

```sh
npm install
npm run setup
```

Read the [full Persian setup guide](README-fa.md) for data migration, device sync, private keys, MCP configuration, and free-plan limits.

The repository contains application code. Planner data is stored privately in D1 after deployment. Sync and MCP keys are configured as Worker secrets and must stay outside Git.
