// Exercise Cloudflare's actual fetch implementation, not Node's fetch or a
// mock fetcher. Miniflare ships with the repository's pinned Wrangler install.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const wranglerRequire = createRequire(import.meta.resolve("wrangler"));
const { Miniflare, convertV4MiniflareOptions } = await import(pathToFileURL(wranglerRequire.resolve("miniflare")));
const root = fileURLToPath(new URL("../", import.meta.url));
const block = { id: 123, type: "Image", title: "Worker reference", image: { width: 600, height: 400, medium: { src: "https://images.are.na/reference.jpg" } } };

test("Are.na reads run in workerd and never follow redirects with the account token", async () => {
  const sent = [];
  let redirect = false;
  const runtime = new Miniflare(convertV4MiniflareOptions({
    modulesRoot: root,
    modules: ["src/worker.js", ...["src", "public"].flatMap((dir) => readdirSync(resolve(root, dir)).filter((name) => name.endsWith(".js")).map((name) => dir + "/" + name)).filter((name) => name !== "src/worker.js")].map((name) => ({ type: "ESModule", path: resolve(root, name), contents: readFileSync(resolve(root, name), "utf8") })),
    compatibilityDate: "2026-10-22",
    bindings: { SYNC_TOKEN: "s".repeat(64), ARENA_ACCESS_TOKEN: "runtime-test-token" },
    outboundService: async (request) => {
      sent.push({ url: request.url, method: request.method, token: request.headers.get("Authorization") });
      if (redirect) return new Response(null, { status: 302, headers: { Location: "https://other.example/collect" } });
      return Response.json(new URL(request.url).pathname.includes("/blocks/") ? block : { data: [block], meta: { has_more_pages: false } });
    },
  }));
  const call = (query) => runtime.dispatchFetch("https://planner.example/api/arena?" + query, { headers: { Authorization: "Bearer " + "s".repeat(64) } });
  try {
    for (const query of ["op=block&id=123", "op=channel&id=art", "op=search&query=poster&type=Image"]) {
      const response = await call(query);
      const body = await response.json();
      assert.equal(response.status, 200, JSON.stringify(body));
      assert.equal(body.data[0].id, 123);
      assert.equal(body.data[0].image.medium.src, block.image.medium.src);
    }
    assert.equal(sent.length, 3);
    assert.ok(sent.every((r) => new URL(r.url).origin === "https://api.are.na" && r.method === "GET" && r.token === "Bearer runtime-test-token"));
    redirect = true;
    const denied = await call("op=block&id=123");
    assert.equal(denied.status, 502);
    assert.equal(sent.length, 4, "redirect target is never fetched");
    const deniedBody = await denied.text();
    assert.ok(!deniedBody.includes("runtime-test-token") && !deniedBody.includes("other.example"));
  } finally { await runtime.dispose(); }
});
