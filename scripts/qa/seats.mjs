// bun scripts/qa/seats.mjs <tier> <room> <portal char> <every nth seat>: sits on seats of a room and checks the player is on the seat's tile and drawn on it (screenshots of the first ones in /tmp/v2-qa-shots).
// Needs a local server and Playwright (see lib.mjs).
import { openGame, playwright, portals, ready, room, signUp, through } from "./lib.mjs";

const pw = await playwright();
const browser = await pw.chromium.launch({
  headless: true,
  args: ["--use-angle=metal", "--ignore-gpu-blocklist"],
});
const tier = process.argv[2] ?? "high";
const roomName = process.argv[3] ?? "inn";
const page = await openGame(browser, await signUp("s"), tier);
await ready(page);
if (roomName !== "inn") {
  const ps = await portals(page);
  const p = ps.find((p) => p.ch === process.argv[4]);
  await through(page, p.x, p.y);
}
console.log("in", await room(page));
const seats = await page.evaluate(() => {
  const m = window.__tm.world.map;
  const out = [];
  for (let y = m.y0; y < m.y0 + m.height; y++)
    for (let x = m.x0; x < m.x0 + m.width; x++) {
      const k = m.kind(x, y);
      if (k.seat) out.push({ x, y, ch: m.at(x, y), kind: k.seat });
    }
  return out;
});
console.log("seats", seats.length);
const step = Number(process.argv[5] ?? 1);
let n = 0;
for (const s of seats.filter((_, i) => i % step === 0)) {
  await page.evaluate(([x, y]) => window.__tm.walkTo(x, y), [s.x, s.y]);
  const ok = await page
    .waitForFunction(
      ([x, y]) => {
        const m = window.__tm.self();
        return m.state === "sit" && m.x === x && m.y === y;
      },
      [s.x, s.y],
      { timeout: 30000 },
    )
    .then(
      () => true,
      () => false,
    );
  await page.waitForTimeout(700);
  const r = await page.evaluate(
    ([sx, sy]) => {
      const m = window.__tm.self(),
        R = window.__r3d;
      const p = R?.entities.positionOf(window.__tm.world.selfId);
      const want = R?.stage.view.toWorld(sx, sy);
      const _e = R?.entities;
      return {
        st: m.state,
        at: [m.x, m.y],
        facing: m.facing,
        drawn: p?.map((v) => +v.toFixed(2)),
        want: want?.map((v) => +v.toFixed(2)),
        px: R?.screenOf(sx, sy, 0.5),
      };
    },
    [s.x, s.y],
  );
  const bad =
    ok &&
    (r.at[0] !== s.x ||
      r.at[1] !== s.y ||
      (r.drawn && (Math.abs(r.drawn[0] - r.want[0]) > 0.25 || Math.abs(r.drawn[1] - r.want[1]) > 0.25)));
  console.log(bad ? "BAD" : ok ? "ok " : "NOSIT", s.ch, s.kind, s.x, s.y, JSON.stringify(r));
  if (n++ < 60 && r.px)
    await page.screenshot({
      path: `/tmp/v2-qa-shots/seat-${tier}-${roomName}-${n}.png`,
      clip: { x: Math.max(0, r.px[0] - 150), y: Math.max(0, r.px[1] - 120), width: 300, height: 240 },
    });
  // stand up
  await page.keyboard.press("ArrowDown");
  await page
    .waitForFunction(() => window.__tm.self().state === "idle", null, { timeout: 5000 })
    .catch(() => {});
  await page.waitForTimeout(500);
}
console.log(page.errors);
await browser.close();
process.exit(0);
