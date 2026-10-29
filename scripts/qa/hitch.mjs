// bun scripts/qa/hitch.mjs [tier]: the longest frame while walking into each shop and the Tavern (a build in one frame is a hitch).
// Needs a local server and Playwright (see lib.mjs).
import { openGame, playwright, portals, ready, room, signUp, through } from "./lib.mjs";

const pw = await playwright();
const browser = await pw.chromium.launch({
  headless: true,
  args: ["--use-angle=metal", "--ignore-gpu-blocklist"],
});
const tier = process.argv[2] ?? "high";
const page = await openGame(browser, await signUp("ht", 400_000), tier);
await ready(page);
await page.evaluate(() => {
  window.__gaps = [];
  let last = performance.now();
  const tick = (now) => {
    window.__gaps.push(now - last);
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
const worst = () =>
  page.evaluate(() => {
    const g = window.__gaps.splice(0);
    return Math.round(Math.max(0, ...g));
  });
const go = async (ch) => {
  const p = (await portals(page)).find((q) => q.ch === ch);
  if (!p) return null;
  await worst();
  const r = await through(page, p.x, p.y);
  return r;
};
await go("x");
for (const [name, door] of [
  ["furniture", "ƒ"],
  ["clothes", "Ç"],
  ["barber", "Ð"],
  ["pets", "ð"],
  ["natmarked", "Ñ"],
]) {
  await worst();
  const r = await go(door);
  const w = await worst();
  console.log(name, "->", r, "worst frame ms:", w);
  (await go("x")) ?? (await go("X"));
  await page.waitForTimeout(1500);
  await worst();
}
console.log("errors", page.errors);
await browser.close();
