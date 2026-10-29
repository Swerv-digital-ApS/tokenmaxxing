// bun scripts/qa/fallback.mjs: no WebGL2 (Auto and High both end on 2D, with the toast), reduced motion, the saved graphics settings across a reload and a corrupt one.
// Needs a local server and Playwright (see lib.mjs).
import { canvasInk, openGame, playwright, ready, signUp } from "./lib.mjs";

const pw = await playwright();
const browser = await pw.chromium.launch({
  headless: true,
  args: ["--disable-gpu", "--disable-3d-apis", "--disable-webgl", "--disable-webgl2"],
});
for (const choice of ["auto", "high"]) {
  const page = await openGame(browser, await signUp("ng"), choice);
  await ready(page);
  await page.waitForTimeout(3000);
  console.log(
    choice,
    JSON.stringify(
      await page.evaluate(() => {
        const g = window.__tm.graphics;
        return {
          webgl2: !!document.createElement("canvas").getContext("webgl2"),
          tier: g.tier(),
          r: window.__tm.perf.renderer,
          failed: g.get().runtime.failed3d,
          toast: g.get().runtime.toast?.text,
          det: g.get().detected?.tier,
          reasons: g.get().detected?.reasons,
        };
      }),
    ),
    await canvasInk(page, `/tmp/v2-qa-shots/nogl-${choice}.png`),
    page.errors,
  );
  await page.context().close();
}
// reduced motion + persistence
const _ctx = await browser.newContext({ reducedMotion: "reduce" });
await browser.close();
const b2 = await pw.chromium.launch({
  headless: true,
  args: ["--use-angle=metal", "--ignore-gpu-blocklist"],
});
const u = await signUp("rm");
const page = await openGame(b2, u, "high", {
  extra: async (_ctx, page) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  },
});
await ready(page);
console.log("reduce", await page.evaluate(() => window.__tm.graphics.effective().reduceMotion));
await page.evaluate(() => {
  window.__tm.graphics.setChoice("medium");
  window.__tm.graphics.override("shadows", "low");
  window.__tm.graphics.override("fpsCap", 60);
});
await page.reload();
await ready(page);
console.log(
  "persist",
  await page.evaluate(() => ({
    choice: window.__tm.graphics.get().choice,
    ov: window.__tm.graphics.get().overrides,
    r: window.__tm.perf.renderer,
    raw: localStorage.getItem("tokenmaxxing.graphics")?.slice(0, 160),
  })),
);
await page.evaluate(() => localStorage.setItem("tokenmaxxing.graphics", "{not json"));
await page.reload();
await ready(page);
console.log(
  "corrupt",
  await page.evaluate(() => ({ choice: window.__tm.graphics.get().choice, r: window.__tm.perf.renderer })),
  page.errors,
);
await b2.close();
process.exit(0);
