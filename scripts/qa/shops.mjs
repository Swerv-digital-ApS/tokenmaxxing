// bun scripts/qa/shops.mjs [tier]: in each shop, clicks every shelf that is on the canvas (not under the HUD) and expects the buy card.
// Needs a local server and Playwright (see lib.mjs).
import { openGame, playwright, portals, ready, room, signUp, through } from "./lib.mjs";

const pw = await playwright();
const browser = await pw.chromium.launch({
  headless: true,
  args: ["--use-angle=metal", "--ignore-gpu-blocklist"],
});
const tier = process.argv[2] ?? "high";
const page = await openGame(browser, await signUp("sh", 400_000), tier);
await ready(page);
const go = async (ch) => {
  const p = (await portals(page)).find((q) => q.ch === ch);
  if (!p) return console.log("no portal", ch, await room(page));
  return through(page, p.x, p.y);
};
const state = () =>
  page.evaluate(() => ({
    card: !document.getElementById("shopcard")?.hidden,
    panel: window.__tm.hud.get().panel?.kind ?? null,
    name: document.querySelector("#shopcard .shop-name .n")?.textContent,
  }));
await go("x");
for (const door of ["ƒ", "Ç", "Ð", "ð", "Ñ"]) {
  const r = await go(door);
  console.log("== shop", r);
  const disp = await page.evaluate(() => {
    const R = window.__r3d;
    const s = R?.stage?.view.shop;
    return s
      ? s.displays.map((d) => ({ id: d.item.id, tile: d.tile, screen: R.shelfScreen(d.item.id)?.at }))
      : null;
  });
  console.log("displays", disp?.length);
  let bad = 0,
    covered = 0,
    tried = 0;
  for (const d of disp ?? []) {
    await page.evaluate(() => {
      window.__tm.hud.set({ panel: null, dialog: null });
      document.querySelector("#shopcard .x")?.click();
    });
    if (!d.screen || d.screen[0] < 0 || d.screen[0] > 1280 || d.screen[1] < 0 || d.screen[1] > 800) {
      continue;
    }
    const top = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName, d.screen);
    if (top !== "CANVAS") {
      covered++;
      continue;
    }
    tried++;
    await page.mouse.click(d.screen[0], d.screen[1]);
    await page.waitForTimeout(350);
    const s = await state();
    if (!s.card) {
      bad++;
      console.log("  click no card", d.id, JSON.stringify(s), d.screen.map(Math.round));
    }
  }
  console.log("tried", tried, "covered by hud", covered, "click failures", bad);
  await page.evaluate(() => {
    document.querySelector("#shopcard .x")?.click();
  });
  await page.screenshot({ path: `/tmp/v2-qa-shots/shop-${tier}-${r}.png` });
  await go("x");
}
console.log(page.errors);
await browser.close();
process.exit(0);
