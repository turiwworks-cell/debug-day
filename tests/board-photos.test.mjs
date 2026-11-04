import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { DDphotoFiles, DDnotePhoto, DDphotoWidth, DDphotoImageHeight, DDphotoCaptionHeight, DDphotoHeight, DDphotoSpots } from "../public/board-photos.js";
import { DDmediaList } from "../public/media.js";
import { DDgoalClean } from "../public/budgets.js";
import { DDnormalizeLife, DDlifeAdd } from "../public/life-board.js";
import { DDtags } from "../public/planner.js";

const plain = (v) => JSON.parse(JSON.stringify(v));
const photo = { id: "drivephoto0001", name: "wall.jpg", mime: "image/jpeg", size: 1000, w: 1600, h: 900 };

test("photo cards take only pictures and videos, a dozen at a time", () => {
  const files = [{ type: "image/png" }, { type: "application/pdf" }, { type: "video/mp4" }, null, { type: "" }];
  assert.deepEqual(DDphotoFiles(files).map((f) => f.type), ["image/png", "video/mp4"]);
  assert.equal(DDphotoFiles(Array.from({ length: 20 }, () => ({ type: "image/jpeg" }))).length, 12);
  assert.deepEqual(DDphotoFiles(undefined), []);
});

test("a picture's own size is kept with its Drive link, and nothing else changes", () => {
  assert.deepEqual(DDmediaList([photo]), [photo]);
  assert.deepEqual(DDmediaList([{ ...photo, w: -1, h: 900 }]), [{ id: photo.id, name: "wall.jpg", mime: "image/jpeg", size: 1000 }]);
  assert.deepEqual(DDmediaList([{ ...photo, w: 1.5 }])[0].w, undefined);
});

test("a note is a photo note when it holds a picture or a video", () => {
  assert.deepEqual(DDnotePhoto({ media: [{ id: "drivedoc00001", mime: "application/pdf" }, photo] }), photo);
  assert.equal(DDnotePhoto({ media: [{ id: "drivedoc00001", mime: "application/pdf" }] }), null);
  assert.equal(DDnotePhoto({}), null);
});

test("card size follows the picture: wide is wide, tall is capped, words add a strip", () => {
  assert.equal(DDphotoWidth({ w: 1600, h: 900 }), 360);
  assert.equal(DDphotoWidth({ w: 900, h: 1600 }), 240);
  assert.equal(DDphotoWidth(null), 360);
  assert.equal(DDphotoImageHeight(360, photo), 203);
  assert.equal(DDphotoImageHeight(240, { w: 100, h: 1000 }), 480, "never a tower");
  assert.equal(DDphotoImageHeight(240, {}), 180);
  assert.equal(DDphotoCaptionHeight(240, "  "), 0);
  assert.equal(DDphotoCaptionHeight(240, "Studio wall"), 41);
  assert.equal(DDphotoHeight(360, photo, ""), 203);
  assert.ok(DDphotoHeight(360, photo, "a\nb") > 203 + 41);
});

test("several photos dropped together sit side by side, three to a row, first one under the pointer", () => {
  const spots = DDphotoSpots({ x: 500, y: 300 }, [{ w: 240, h: 180 }, { w: 360, h: 200 }, { w: 240, h: 300 }, { w: 240, h: 180 }]);
  assert.deepEqual(spots[0], { x: 500, y: 300 });
  assert.deepEqual(spots[1], { x: 500 + 120 + 24 + 180, y: 210 + 100 });
  assert.equal(spots[3].x, 500, "fourth starts a new row");
  assert.equal(spots[3].y, 210 + 300 + 24 + 90);
});

test("photo notes keep their links on the day board and in the Feed", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const fn = html.match(/function Ve\(at\).*?(?=var He=)/s)[0];
  const c = { L: (v) => (typeof v === "string" ? v : ""), C: () => "id", Ie: Number.isFinite, Le: /^#[a-f0-9]{6}$/i, we: ["#FFE299"], DDtags, DDmediaList, DDgoalClean };
  runInNewContext(fn + ";this.note=Ve;", c);
  const once = c.note({ id: "n", kind: "sticky", text: "", media: [photo, { id: "bad" }] });
  assert.deepEqual(plain(once.media), [photo]);
  assert.deepEqual(plain(c.note(plain(once))), plain(once), "normalizing twice changes nothing");
  assert.equal(c.note({ id: "e", kind: "emoji", text: "🌱", media: [photo] }).media, undefined);
  assert.equal(c.note({ id: "m", kind: "sticky", media: [] }).media, undefined);
  const items = DDlifeAdd([], { id: "p1", type: "sticky", x: 10, y: 10, w: 360, h: 203, media: [photo] });
  assert.deepEqual(items[0].media, [photo]);
  const life = DDnormalizeLife({ items: [...items, { id: "s1", type: "section", media: [photo] }] });
  assert.deepEqual(life.items.find((i) => i.id === "p1").media, [photo]);
  assert.equal(life.items.find((i) => i.id === "s1").media, undefined, "sections hold no photos");
});

test("the board asks for a photo icon that is drawn", () => {
  const source = readFileSync(new URL("../public/board.js", import.meta.url), "utf8");
  assert.match(source, /item\("add-photo", "Add photo here"/);
});
