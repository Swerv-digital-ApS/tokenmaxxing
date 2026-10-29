// bun scripts/qa/governor.mjs: Auto tier with every animation frame slowed by 70 ms; prints the governor's steps (scale, then tier) and its toast each 6 s.
// Needs a local server and Playwright (see lib.mjs).
import { openGame, playwright, ready, signUp } from "./lib.mjs";

const pw = await playwright();
const browser = await pw.chromium.launch({
  headless: true,
  args: ["--use-angle=metal", "--ignore-gpu-blocklist"],
});
const page = await openGame(browser, await signUp("g"), "auto", {
  extra: async (ctx) => {
    await ctx.addInitScript(() => {
      window.__slow = 0;
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (cb) =>
        raf((t) => {
          const e = performance.now() + window.__slow;
          while (performance.now() < e);
          cb(t);
        });
    });
  },
});
await ready(page);
const snap = () =>
  page.evaluate(() => {
    const g = window.__tm.graphics;
    const r = g.get().runtime;
    const _s = g.effective();
    return {
      tier: g.tier(),
      gov: r.governed,
      mul: r.scaleMul,
      quick: r.quick,
      det: g.get().detected?.tier,
      toast: r.toast?.text,
      fps: window.__tm.perf.fps,
      rend: window.__tm.perf.renderer,
      p95: Math.round(window.__tm.perf.p95),
    };
  });
console.log("auto start", JSON.stringify(await snap()));
await page.waitForTimeout(8000);
console.log("auto +8s", JSON.stringify(await snap()));
await page.evaluate(() => (window.__slow = 70));
for (let i = 0; i < 9; i++) {
  await page.waitForTimeout(6000);
  console.log("slow", i, JSON.stringify(await snap()));
}
await page.evaluate(() => (window.__slow = 0));
await browser.close();
process.exit(0);
