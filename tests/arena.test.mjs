import test from "node:test";
import assert from "node:assert/strict";
import worker, { validate } from "../src/worker.js";
import { arenaRead } from "../src/arena.js";
import { DDarenaInput, DDarenaMedia, DDarenaImageURL, DDarenaRequest } from "../public/arena.js";
import { DDmediaList, DDmediaViewUrl } from "../public/media.js";
import { DDnormalizeLife, DDlifeAdd } from "../public/life-board.js";
const image = { id: 123, type: "Image", title: "Reference", image: { width: 1200, height: 800, src: "https://d2w9rnfcy7mm78.cloudfront.net/123/original.jpg", medium: { src: "https://d2w9rnfcy7mm78.cloudfront.net/123/display.jpg" } } };
const request = (query, method = "GET", token = "s".repeat(64), origin) => new Request("https://planner.example/api/arena?" + query, { method, headers: { Authorization: "Bearer " + token, ...(origin ? { Origin: origin } : {}) } });

test("Are.na links are parsed without accepting unrelated URLs or arbitrary API paths", () => {
  assert.deepEqual(DDarenaInput("https://www.are.na/block/123"), { op: "block", id: "123" });
  assert.deepEqual(DDarenaInput("https://www.are.na/person/my-channel?x=1"), { op: "channel", id: "my-channel" });
  assert.deepEqual(DDarenaInput("پوستر"), { op: "search", query: "پوستر" });
  for (const s of ["", "https://evil.test/person/channel", "https://user@are.na/person/channel", "https://are.na/settings/tokens"]) assert.throws(() => DDarenaInput(s));
  for (const s of ["javascript:alert(1)", "https://evil.test/x.jpg", "https://d2w9rnfcy7mm78.cloudfront.net.evil.test/a", "http://images.are.na/a", "https://images.are.na:8443/a"]) assert.equal(DDarenaImageURL(s), "");
});
test("reference metadata survives normalization, Feed edits and server validation without image bytes", () => {
  const m = DDarenaMedia(image);
  assert.equal(m.src, image.image.medium.src);
  assert.deepEqual(DDmediaList([m, m]), [m]);
  assert.deepEqual(DDmediaList([{ ...m, blockId: 999 }]), []);
  assert.deepEqual(DDmediaList([{ ...m, src: "data:image/png;base64,AA" }]), []);
  const life = DDnormalizeLife({ items: DDlifeAdd([], { id: "art", type: "sticky", x: 0, y: 0, media: [m] }) });
  assert.deepEqual(life.items[0].media, [m]);
  validate({ setup: { life }, days: {} });
  assert.equal(DDmediaViewUrl(m), "https://www.are.na/block/123");
  assert.equal(DDarenaMedia({ ...image, type: "Link" }), null);
});
test("Worker requires planner authentication and rejects cross-origin and non-GET requests", async () => {
  const env = { SYNC_TOKEN: "s".repeat(64) };
  assert.equal((await worker.fetch(request("op=block&id=123", "GET", "wrong"), env)).status, 401);
  assert.equal((await worker.fetch(request("op=block&id=123", "GET", env.SYNC_TOKEN, "https://evil.test"), env)).status, 403);
  assert.equal((await worker.fetch(request("op=block&id=123", "POST"), env)).status, 405);
  assert.equal((await worker.fetch(request("op=search&query=test"), env)).status, 503);
});
test("API requests are bounded, read-only and pass the token only to the fixed Are.na host", async () => {
  let calls = 0;
  const fake = async (url, options) => {
    calls++;
    assert.equal(new URL(url).origin, "https://api.are.na");
    assert.equal(new URL(url).pathname, "/v3/search");
    assert.equal(new URL(url).searchParams.get("per"), "24");
    assert.equal(new URL(url).searchParams.get("page"), "2");
    assert.equal(options.method, "GET"); assert.equal(options.redirect, "error");
    assert.equal(options.headers.Authorization, "Bearer secret-test");
    return Response.json({ data: [image, { type: "Text", content: "do not expose" }], meta: { has_more_pages: true }, private: "do not expose" });
  };
  const r = await arenaRead(request("op=search&query=poster&page=2"), { ARENA_ACCESS_TOKEN: "secret-test" }, fake);
  const body = await r.json();
  assert.equal(body.data.length, 1); assert.equal(body.meta.has_more_pages, true);
  assert.equal(JSON.stringify(body).includes("secret-test"), false);
  assert.equal(JSON.stringify(body).includes("do not expose"), false);
  assert.equal(r.headers.get("Cache-Control"), "no-store");
  for (const q of ["op=channel&id=../me", "op=block&id=https://evil.test", "op=search&query=x&type=User", "op=channel&id=art&page=-1"]) assert.equal((await arenaRead(request(q), { ARENA_ACCESS_TOKEN: "secret-test" }, fake)).status, 400);
  assert.equal(calls, 1);
});
test("public channel reads work without an Are.na token; private data is never cached", async () => {
  const r = await arenaRead(request("op=channel&id=art"), {}, async (url, o) => {
    assert.equal(o.headers.Authorization, undefined);
    return Response.json({ data: [image], meta: { has_more_pages: false } });
  });
  assert.equal(r.status, 200); assert.equal((await r.json()).data[0].id, 123);
  const channel = { id: 9, base_type: "Channel", title: "Art", slug: "art" };
  const c = await arenaRead(request("op=search&query=art&type=Channel"), { ARENA_ACCESS_TOKEN: "t" }, async () => Response.json({ data: [channel] }));
  assert.deepEqual((await c.json()).data, [channel]);
});
test("API failures preserve useful status and retry information without leaking response bodies", async () => {
  for (const status of [401, 403, 404, 429, 500]) {
    const r = await arenaRead(request("op=block&id=123"), {}, async () => new Response("sensitive upstream detail", { status, headers: { "Retry-After": "30" } }));
    assert.equal(r.status, status === 500 ? 502 : status);
    assert.equal(r.headers.get("Retry-After"), "30");
    assert.equal((await r.text()).includes("sensitive"), false);
  }
  const r = await arenaRead(request("op=block&id=123"), {}, async () => { throw Error("token secret"); });
  assert.equal(r.status, 502); assert.equal((await r.text()).includes("secret"), false);
});
