// bun scripts/qa/walls.mjs <tier> <room>: walks into `inn` (from town) or `upstairs` (from the Tavern) and records, from
// the first frame the room shows, the height of everything in it that is ever lowered (the walls drop to 6%). Prints
// how many frames saw a wall move and what each moving wall did. OUT=file.json keeps the timelines.
// Needs a local server and Playwright (see lib.mjs).
import { writeFileSync } from "node:fs";
import { openGame, playwright, portals, ready, room, signUp, through } from "./lib.mjs";

const [tier = "high", target = "inn"] = process.argv.slice(2);
const pw = await playwright();
const browser = await pw.chromium.launch({
  headless: true,
  args: ["--use-angle=metal", "--ignore-gpu-blocklist"],
});
const page = await openGame(browser, await signUp("w"), tier);
await ready(page);
const go = async (ch) => {
  const p = (await portals(page)).find((q) => q.ch === ch);
  if (!p) throw new Error(`no ${ch} in ${await room(page)}`);
  return through(page, p.x, p.y);
};
// Start one room before the target: town for the Tavern, the Tavern for upstairs.
const before = target === "inn" ? "town" : "inn";
if ((await room(page)) === "upstairs") await go("d");
if ((await room(page)) === "inn" && before === "town") await go("x");
if ((await room(page)) === "town" && before === "inn") await go("I");
if ((await room(page)) !== before) throw new Error(`in ${await room(page)}, wanted ${before}`);
await page.waitForTimeout(2000);
await page.evaluate((target) => {
  const r = window.__r3d;
  const w = window.__tm.world;
  const log = { frames: [], heights: new Map() };
  window.__walls = log;
  let scene = null;
  let t0 = 0;
  const loop = (t) => {
    const s = r.stage?.scene;
    if (w.room === target && s && r.stats.frames && !r.reveal) {
      if (s !== scene) {
        scene = s;
        t0 = t;
      }
      const actors = new Set();
      const row = new Map();
      s.traverse((o) => {
        if (o.userData.actor || (o.parent && actors.has(o.parent))) return void actors.add(o);
        if (o.scale.y < 0.999) row.set(o, o.scale.y);
      });
      log.frames.push([t - t0, row, r.overlay.faded]);
    }
    if (log.frames.length < 300) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}, target);
await go(target === "inn" ? "I" : "u");
await page.waitForTimeout(3000);
const result = await page.evaluate(() => {
  const { frames } = window.__walls;
  const walls = new Set();
  for (const [, row] of frames) for (const [o, y] of row) if (y < 0.15) walls.add(o);
  const series = [...walls].map((o) => frames.map(([, row]) => +(row.get(o) ?? 1).toFixed(3)));
  const times = frames.map(([t]) => Math.round(t));
  const fade = frames.map(([, , f]) => +f.toFixed(2));
  let moving = 0;
  for (let i = 1; i < frames.length; i++) if (series.some((s) => Math.abs(s[i] - s[i - 1]) > 0.002)) moving++;
  return { times, fade, series, moving, frames: frames.length };
});
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(result));
console.log(
  `${target}: ${result.series.length} lowerable walls, ${result.moving} of ${result.frames} frames with a wall moving`,
);
for (const s of result.series) {
  const changes = s
    .map((y, i) => (i && Math.abs(y - s[i - 1]) > 0.002 ? `${result.times[i]}ms→${y}` : null))
    .filter(Boolean);
  console.log(
    `  starts ${s[0]}, ends ${s.at(-1)}; moves: ${changes.slice(0, 8).join(" ")}${changes.length > 8 ? ` …(${changes.length})` : ""}`,
  );
}
await browser.close();
