// bun scripts/qa/touch.mjs [tier]: two-finger pinch and twist on a phone-sized touch viewport, and a tap to walk.
// Needs a local server and Playwright (see lib.mjs).
import { openGame, playwright, ready, signUp } from "./lib.mjs";

const pw = await playwright();
const browser = await pw.chromium.launch({
  headless: true,
  args: ["--use-angle=metal", "--ignore-gpu-blocklist"],
});
const tier = process.argv[2] ?? "high";
const page = await openGame(browser, await signUp("tc"), tier, {
  viewport: { width: 844, height: 390 },
  touch: true,
});
await ready(page);
const cdp = await page.context().newCDPSession(page);
const state = () =>
  page.evaluate(() => ({
    level: window.__r3d?.rig.level,
    quarter: window.__r3d?.rig.quarter,
    me: (({ x, y }) => [x, y])(window.__tm.self()),
    ta: getComputedStyle(document.querySelector("#stage canvas")).touchAction,
  }));
console.log("start", JSON.stringify(await state()));
const touch = (type, pts) =>
  cdp.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: i })),
  });
// pinch out (zoom in)
await touch("touchStart", [
  [300, 200],
  [400, 200],
]);
for (let i = 1; i <= 8; i++)
  await touch("touchMove", [
    [300 - i * 12, 200],
    [400 + i * 12, 200],
  ]);
await touch("touchEnd", []);
await page.waitForTimeout(500);
console.log("after pinch out", JSON.stringify(await state()));
// twist
await touch("touchStart", [
  [300, 200],
  [400, 200],
]);
for (let i = 1; i <= 10; i++) {
  const a = (i * 12 * Math.PI) / 180;
  await touch("touchMove", [
    [350 - Math.cos(a) * 50, 200 - Math.sin(a) * 50],
    [350 + Math.cos(a) * 50, 200 + Math.sin(a) * 50],
  ]);
}
await touch("touchEnd", []);
await page.waitForTimeout(500);
console.log("after twist", JSON.stringify(await state()));
// tap to walk still works
const t = await page.evaluate(() => {
  const m = window.__tm.self(),
    map = window.__tm.world.map;
  for (const [dx, dy] of [
    [3, 0],
    [-3, 0],
    [0, 3],
    [0, -3],
  ]) {
    const x = m.x + dx,
      y = m.y + dy;
    if (map.walkable(x, y) && !map.kind(x, y).portal) {
      const s = window.__r3d.screenOf(x, y, 0);
      if (
        s &&
        s[0] > 0 &&
        s[0] < 844 &&
        s[1] > 0 &&
        s[1] < 390 &&
        document.elementFromPoint(s[0], s[1])?.tagName === "CANVAS"
      )
        return { x, y, s };
    }
  }
});
console.log("tap target", JSON.stringify(t));
if (t) {
  await page.touchscreen.tap(t.s[0], t.s[1]);
  await page.waitForTimeout(3000);
  console.log("after tap", JSON.stringify(await state()));
}
await page.screenshot({ path: `/tmp/v2-qa-shots/touch-${tier}.png` });
console.log(page.errors);
await browser.close();
process.exit(0);
