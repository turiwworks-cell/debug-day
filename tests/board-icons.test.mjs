import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DDboardIcons, DDboardIconAliases, DDboardIconPath } from "../public/board-icons.js";

test("every alias points at a real picture", () => {
  for (const [name, target] of Object.entries(DDboardIconAliases))
    assert.ok(DDboardIcons[target], name + " → " + target);
});

test("dock actions that used to look alike now each have their own picture", () => {
  const groups = [
    ["fitAll", "expand", "shrink", "leaf", "fit", "fitDay"],
    ["engine", "settings", "sun", "moon"],
    ["sections", "more"],
    ["section", "task", "info", "toPlan"],
    ["snap", "pin"],
    ["map", "eye"],
    ["sticker", "help"],
  ];
  for (const names of groups)
    assert.equal(new Set(names.map(DDboardIconPath)).size, names.length, names.join(", "));
});

test("every icon the Board asks for is drawn, never the ··· fallback", () => {
  const source = readFileSync(new URL("../public/board.js", import.meta.url), "utf8");
  const asked = new Set([
    ...[...source.matchAll(/toolButton\([^,]+,\s*"([A-Za-z]+)"/g)].map((m) => m[1]),
    ...[...source.matchAll(/item\(\s*"[^"]+",\s*"[^"]+",\s*"[^"]+",\s*"([A-Za-z]+)"/g)].map((m) => m[1]),
    ...[...source.matchAll(/controls\.Icon,\s*\{\s*React:\s*_,\s*name:\s*"([A-Za-z]+)"/g)].map((m) => m[1]),
  ]);
  assert.ok(asked.size > 20);
  for (const name of asked)
    if (name !== "more") assert.notEqual(DDboardIconPath(name), DDboardIcons.more, name);
});
