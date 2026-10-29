// bun scripts/qa/pick.mjs [tier]: click accuracy. For every walkable tile of each room, projects its middle to the screen and asks the renderer's pick for the tile back (also turned and zoomed). Tiles hidden behind a tall prop are skipped; anything listed in `bad` is a real mismatch.
// Needs a local server and Playwright (see lib.mjs).
import { openGame, playwright, portals, ready, room, signUp, through } from "./lib.mjs";

const pw = await playwright();
const browser = await pw.chromium.launch({
  headless: true,
  args: ["--use-angle=metal", "--ignore-gpu-blocklist"],
});
const tier = process.argv[2] ?? "medium";
const page = await openGame(browser, await signUp("p"), tier);
await ready(page);
async function sample(label) {
  const r = await page.evaluate(() => {
    const m = window.__tm.world.map,
      R = window.__r3d;
    const bad = [],
      total = { n: 0, off: 0, none: 0, offscreen: 0 };
    for (let y = m.y0; y < m.y0 + m.height; y++)
      for (let x = m.x0; x < m.x0 + m.width; x++) {
        if (!m.walkable(x, y) || m.kind(x, y).portal) continue;
        const s = R.screenOf(x, y, 0.0);
        if (!s) {
          total.none++;
          continue;
        }
        if (s[0] < 5 || s[1] < 5 || s[0] > innerWidth - 5 || s[1] > innerHeight - 5) {
          total.offscreen++;
          continue;
        }
        total.n++;
        const t = R.pick(s[0], s[1]);
        if ((!t || t.x !== x || t.y !== y) && !(t && !m.walkable(t.x, t.y))) {
          total.off++;
          if (bad.length < 12) bad.push([x, y, t && [t.x, t.y], m.at(t?.x ?? 0, t?.y ?? 0)]);
        }
      }
    return { total, bad, room: window.__tm.world.room };
  });
  console.log(label, tier, JSON.stringify(r));
}
await sample("start");
for (const [_x, _y] of [
  [1, 17],
  [26, 16],
]) {
}
// visit rooms
const seen = new Set([await room(page)]);
for (let i = 0; i < 14; i++) {
  const ps = await portals(page);
  let moved = false;
  for (const p of ps) {
    const _here = await room(page);
    const dest = await through(page, p.x, p.y);
    if (dest) {
      if (!seen.has(dest)) {
        seen.add(dest);
        await sample(`room ${dest}`);
      }
      moved = true;
      break;
    }
  }
  if (!moved) break;
}
await page.evaluate(() => window.__tm.viewHooks.rotate(1));
await page.waitForTimeout(1500);
await sample("rotated");
await page.evaluate(() => window.__tm.viewHooks.zoom(1));
await page.waitForTimeout(1500);
await sample("zoomed in");
await page.evaluate(() => window.__tm.viewHooks.zoom(-3));
await page.waitForTimeout(1500);
await sample("zoomed out");
console.log(page.errors);
await browser.close();
process.exit(0);
