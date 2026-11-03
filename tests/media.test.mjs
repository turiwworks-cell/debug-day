import test from "node:test";
import assert from "node:assert/strict";
import { DDmediaList, DDmediaKind, DDmediaViewUrl, DDmediaSize, DDmediaConfig } from "../public/media.js";
import worker from "../src/worker.js";

test("media links keep only well-formed Drive files", () => {
  const list = DDmediaList([
    { id: "abcDEF123_-xyz", name: " sketch.jpg ", mime: "image/jpeg", size: 2048 },
    { id: "abcDEF123_-xyz", name: "duplicate" },
    { id: "short" },
    { id: "../../etc/passwd" },
    null,
    { id: "video000000001", mime: "not a mime", size: -4 },
  ]);
  assert.deepEqual(list, [
    { id: "abcDEF123_-xyz", name: "sketch.jpg", mime: "image/jpeg", size: 2048 },
    { id: "video000000001", name: "file", mime: "", size: 0 },
  ]);
  assert.deepEqual(DDmediaList("nope"), []);
  assert.equal(DDmediaList(Array.from({ length: 40 }, (_, i) => ({ id: "file" + String(i).padStart(8, "0") }))).length, 30);
});

test("media helpers", () => {
  assert.equal(DDmediaKind({ mime: "video/mp4" }), "video");
  assert.equal(DDmediaKind({ mime: "image/png" }), "image");
  assert.equal(DDmediaKind({ mime: "" }), "file");
  assert.equal(DDmediaViewUrl({ id: "abcDEF123_-xyz" }), "https://drive.google.com/file/d/abcDEF123_-xyz/view");
  assert.equal(DDmediaSize(1536, "en"), "1.5 KB");
  assert.equal(DDmediaSize(0, "en"), "");
});

test("media config comes from the worker and is empty when not set up", async () => {
  const get = (env) => worker.fetch(new Request("https://dd.test/api/media-config"), env);
  assert.deepEqual(await (await get({})).json(), { googleClientId: "" });
  assert.deepEqual(await (await get({ GOOGLE_CLIENT_ID: "123.apps.googleusercontent.com" })).json(), {
    googleClientId: "123.apps.googleusercontent.com",
  });
  const config = await DDmediaConfig(async () => ({ ok: true, json: async () => ({ googleClientId: 42 }) }));
  assert.deepEqual(config, { clientId: "" });
});
