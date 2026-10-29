// bun scripts/qa/edge.mjs [tier]: a real mouse click walks; resizing, a phone viewport and DPR changes; a hidden then visible tab; switching tiers live (also in a burst); a lost WebGL context falling back to 2D. Prints the canvas count, renderer and size after each.
// Needs a local server and Playwright (see lib.mjs).
import { canvasInk, openGame, playwright, ready, signUp } from "./lib.mjs";

const pw = await playwright();
const browser = await pw.chromium.launch({
  headless: true,
  args: ["--use-angle=metal", "--ignore-gpu-blocklist"],
});
const log = (...a) => console.log(...a);
const tier = process.argv[2] ?? "medium";
const page = await openGame(browser, await signUp("e"), tier);
await ready(page);
const info = () =>
  page.evaluate(() => ({
    canv: document.querySelectorAll("#stage canvas").length,
    c: (() => {
      const c = document.querySelector("#stage canvas");
      return c && [c.width, c.height, c.clientWidth, c.clientHeight];
    })(),
    r: window.__tm.perf.renderer,
    tier: window.__tm.graphics.tier(),
    dpr: devicePixelRatio,
    fail: window.__tm.graphics.get().runtime.failed3d,
    toast: window.__tm.graphics.get().runtime.toast?.text,
    overlays: document.querySelectorAll("#stage > div").length,
  }));
log("init", JSON.stringify(await info()));

// 1 real mouse click walks
{
  const me0 = await page.evaluate(() => {
    const m = window.__tm.self();
    return [m.x, m.y];
  });
  const r = await page.evaluate(() => {
    const m = window.__tm.self(),
      map = window.__tm.world.map;
    for (const [dx, dy] of [
      [3, 0],
      [-3, 0],
      [0, 3],
      [0, -3],
      [2, 2],
      [-2, -2],
    ]) {
      const x = m.x + dx,
        y = m.y + dy;
      if (map.walkable(x, y) && !map.kind(x, y).portal)
        return [x, y, ...(window.__r3d?.screenOf(x, y, 0) ?? [0, 0])];
    }
  });
  log("click target", r);
  if (tier !== "low") {
    await page.mouse.click(r[2], r[3]);
    await page.waitForTimeout(2500);
    log(
      "after click",
      me0,
      await page.evaluate(() => {
        const m = window.__tm.self();
        return [m.x, m.y];
      }),
    );
  }
}
// 2 resize
await page.setViewportSize({ width: 700, height: 500 });
await page.waitForTimeout(700);
log("resize", JSON.stringify(await info()), page.errors.splice(0));
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(700);
log("phone", JSON.stringify(await info()));
await page.screenshot({ path: `/tmp/v2-qa-shots/edge-${tier}-phone.png` });
await page.setViewportSize({ width: 1280, height: 800 });
await page.waitForTimeout(500);
// DPR change
const cdp = await page.context().newCDPSession(page);
await cdp.send("Emulation.setDeviceMetricsOverride", {
  width: 1280,
  height: 800,
  deviceScaleFactor: 2,
  mobile: false,
});
await page.waitForTimeout(900);
log("dpr2", JSON.stringify(await info()), await canvasInk(page));
await cdp.send("Emulation.setDeviceMetricsOverride", {
  width: 1280,
  height: 800,
  deviceScaleFactor: 1,
  mobile: false,
});
await page.waitForTimeout(900);
log("dpr1", JSON.stringify(await info()));
// 3 tab hidden
await page.evaluate(() => {
  Object.defineProperty(document, "hidden", { value: true, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
});
await page.waitForTimeout(2000);
await page.evaluate(() => {
  Object.defineProperty(document, "hidden", { value: false, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
});
await page.waitForTimeout(1500);
log("hidden/visible fps", await page.evaluate(() => window.__tm.perf.fps), page.errors.splice(0));
// 4 tier switching
for (const t of ["high", "low", "medium", "low", "high", "medium", "low", "medium"]) {
  await page.evaluate((t) => window.__tm.graphics.setChoice(t), t);
  await page.waitForTimeout(t === "low" ? 600 : 1800);
  const i = await info();
  log("switch ->", t, JSON.stringify(i), await canvasInk(page));
}
// rapid switching
for (let k = 0; k < 6; k++) {
  await page.evaluate((k) => window.__tm.graphics.setChoice(["high", "low", "medium"][k % 3]), k);
  await page.waitForTimeout(30);
}
await page.evaluate(() => window.__tm.graphics.setChoice("low"));
await page.waitForTimeout(3000);
log("rapid ->low", JSON.stringify(await info()));
await page.evaluate(() => window.__tm.graphics.setChoice("high"));
await page.waitForTimeout(3000);
log("->high", JSON.stringify(await info()), page.errors.splice(0));
// 5 context loss
await page.evaluate(() => {
  const c = document.querySelector("#stage canvas");
  c.getContext("webgl2").getExtension("WEBGL_lose_context").loseContext();
});
await page.waitForTimeout(2500);
log(
  "ctx lost",
  JSON.stringify(await info()),
  await canvasInk(page, `/tmp/v2-qa-shots/edge-contextlost.png`),
  page.errors.splice(0),
);
await browser.close();
process.exit(0);
