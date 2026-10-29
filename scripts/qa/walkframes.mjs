// bun scripts/qa/walkframes.mjs <tier> <room>: frame times while walking back and forth (town by day, or `upstairs`),
// and what the renderer did on the slow ones (static shadow bakes, live shadow redraws). OUT=file.json keeps them.
// Needs a local server and Playwright (see lib.mjs).
import { writeFileSync } from "node:fs";
import { openGame, playwright, portals, ready, room, signUp, through } from "./lib.mjs";

const [tier = "high", want = "town"] = process.argv.slice(2);
const pw = await playwright();
const browser = await pw.chromium.launch({
  headless: true,
  args: ["--use-angle=metal", "--ignore-gpu-blocklist"],
});
const page = await openGame(browser, await signUp("j"), tier, {
  viewport: { width: 1280, height: 800 },
  dpr: 2,
});
await ready(page);
await page.goto(`${page.url().split("#")[0].split("?")[0]}?sky=2026-10-26T13:30&weather=clear`);
await ready(page);
const go = async (ch) => {
  const p = (await portals(page)).find((q) => q.ch === ch);
  if (p) await through(page, p.x, p.y);
};
if (want === "town") {
  if ((await room(page)) === "upstairs") await go("d");
  if ((await room(page)) === "inn") await go("x");
} else {
  if ((await room(page)) === "town") await go("I");
  if ((await room(page)) === "inn") await go("u");
}
if ((await room(page)) !== want) throw new Error(`in ${await room(page)}`);
await page.waitForTimeout(3000);
// A straight walkable run of 8 tiles from where we stand, along x.
const run = await page.evaluate(() => {
  const m = window.__tm.world.map,
    me = window.__tm.self();
  for (let y = me.y; y < m.y0 + m.height; y++)
    for (let x = m.x0; x < m.x0 + m.width - 8; x++) {
      let ok = true;
      for (let i = 0; i < 8; i++) if (!m.walkable(x + i, y)) ok = false;
      if (ok && window.__tm.route(m, [me.x, me.y], [x, y])) return [x, y];
    }
  return null;
});
await page.evaluate(([x, y]) => window.__tm.walkTo(x, y), run);
await page.waitForTimeout(4000);
await page.evaluate(() => {
  const r = window.__r3d;
  const log = [];
  window.__wf = log;
  let last = performance.now();
  let bakes = r.pipe.last.staticBakes ?? 0;
  const loop = (t) => {
    const b = r.pipe.last.staticBakes ?? 0;
    log.push([t - last, b - bakes, r.pipe.last.shadowUpdated ? 1 : 0]);
    bakes = b;
    last = t;
    if (log.length < 2000) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
});
for (let k = 0; k < 4; k++) {
  await page.evaluate(([x, y, k]) => window.__tm.walkTo(k % 2 ? x : x + 7, y), [...run, k]);
  await page.waitForTimeout(2600);
}
const log = await page.evaluate(() => window.__wf);
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(log));
const g = log.map((e) => e[0]).sort((a, b) => a - b);
const pct = (p) => g[Math.floor(g.length * p)].toFixed(1);
const slow = log.filter((e) => e[0] > 25);
const bakes = log.reduce((a, e) => a + e[1], 0);
console.log(
  `${want} ${tier}: ${log.length} frames walking · median ${pct(0.5)} ms · p95 ${pct(0.95)} · p99 ${pct(0.99)} · worst ${g.at(-1).toFixed(1)} · over 25 ms: ${slow.length} · static shadow bakes: ${bakes} (on slow frames: ${slow.filter((e) => e[1]).length})`,
);
await browser.close();
