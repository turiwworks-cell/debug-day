import test from "node:test";
import assert from "node:assert/strict";
import { DDdropperHex, DDdropperNodeColor } from "../public/eyedropper.js";

test("colors read from the page become one hex form", () => {
  assert.equal(DDdropperHex("#ffe08a"), "#FFE08A");
  assert.equal(DDdropperHex("#abc"), "#AABBCC");
  assert.equal(DDdropperHex("rgb(13, 153, 255)"), "#0D99FF");
  assert.equal(DDdropperHex("rgba(13, 153, 255, 0.5)"), "#0D99FF");
  assert.equal(DDdropperHex("rgba(0, 0, 0, 0)"), null, "see-through is no color");
  assert.equal(DDdropperHex("var(--ink)"), null);
});

test("each board object gives the color it shows", () => {
  assert.equal(DDdropperNodeColor({ color: "#FFE08A" }), "#FFE08A");
  assert.equal(DDdropperNodeColor({ shape: "ellipse", color: "#BDE3FF" }), "#BDE3FF");
  assert.equal(DDdropperNodeColor({ shape: "ellipse", fillMode: "none", color: "#FFFFFF", stroke: "#F24822" }), "#F24822", "an empty shape gives its stroke");
  assert.equal(DDdropperNodeColor({ plain: true, color: "#FFE08A", textColor: "#9747FF" }), "#9747FF", "a text object gives its words' color");
  assert.equal(DDdropperNodeColor({ plain: true, textColor: "var(--ink)" }), null);
  assert.equal(DDdropperNodeColor(null), null);
});
