// Runs one part of the browser tests, so CI can run the parts side by side.
// Usage: node tests/browser/shard.mjs <part> <parts>   (part counts from 1)
// The list is the one in package.json "test:browser", so it stays the only
// place a new test is added. Tests are dealt out in turn and run one by one.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const [part, parts] = process.argv.slice(2).map(Number);
if (!(parts >= 1 && part >= 1 && part <= parts)) {
  console.error("usage: node tests/browser/shard.mjs <part> <parts>");
  process.exit(2);
}
const script = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url))).scripts["test:browser"];
const files = [...script.matchAll(/node (tests\/browser\/[\w-]+\.cjs)/g)].map((m) => m[1]);
const mine = files.filter((_, i) => i % parts === part - 1);
console.log(`part ${part}/${parts}: ${mine.length} of ${files.length} tests`);
for (const file of mine) {
  const started = Date.now();
  const run = spawnSync(process.execPath, [file], { stdio: "inherit" });
  console.log(`${run.status === 0 ? "ok" : "FAILED"} ${file} (${Math.round((Date.now() - started) / 1000)}s)`);
  if (run.status !== 0) process.exit(run.status || 1);
}
