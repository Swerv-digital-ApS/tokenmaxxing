// bun scripts/qa/buy.mjs [tier]: buys a rug at the furniture shop in 3D, takes it to the player's Office and drops it there.
// Needs a local server and Playwright (see lib.mjs).
import { openGame, playwright, portals, ready, room, signUp, through } from "./lib.mjs";

const pw = await playwright();
const browser = await pw.chromium.launch({
  headless: true,
  args: ["--use-angle=metal", "--ignore-gpu-blocklist"],
});
const tier = process.argv[2] ?? "high";
const page = await openGame(browser, await signUp("b", 8_000_000, true), tier);
await ready(page);
const go = async (ch) => {
  const p = (await portals(page)).find((q) => q.ch === ch);
  return through(page, p.x, p.y);
};
const coins = () =>
  page.evaluate(() => ({ w: window.__tm.hud.get().wallet, items: window.__tm.hud.get().wallet?.items }));
console.log("coins before", JSON.stringify(await coins()));
await go("x");
await go("ƒ");
const item = await page.evaluate(() => {
  const R = window.__r3d;
  const ds = R.stage.view.shop.displays.filter((d) => d.item.price > 0 && d.item.price <= 15);
  const d = ds[0];
  R.shops.open(R.stage.view.shop.id, d.item);
  return { id: d.item.id, name: d.item.name, price: d.item.price };
});
console.log("opening", JSON.stringify(item));
await page.waitForTimeout(1200);
console.log(
  "buttons",
  await page.evaluate(() =>
    [...document.querySelectorAll("#shopcard .actions button")].map(
      (b) => b.textContent + (b.disabled ? "(disabled)" : ""),
    ),
  ),
);
console.log("state", await page.evaluate(() => document.querySelector("#shopcard .shop-state")?.textContent));
await page.click("#shopcard .actions button");
await page.waitForTimeout(2500);
console.log(
  "after",
  await page.evaluate(() => ({
    state: document.querySelector("#shopcard .shop-state")?.textContent,
    btns: [...document.querySelectorAll("#shopcard .actions button")].map((b) => b.textContent),
    dialog: window.__tm.hud.get().dialog,
    toast: document.querySelector(".shop-toast")?.textContent,
  })),
);
console.log("coins after", JSON.stringify(await coins()));
await page.click("#shopcard .actions button:nth-child(2)");
await page
  .waitForFunction(() => window.__tm.world.room.startsWith("office"), null, { timeout: 15000 })
  .catch(() => console.log("no office"));
await page.waitForTimeout(2500);
console.log(
  "room",
  await room(page),
  "dialog",
  await page.evaluate(() => window.__tm.hud.get().dialog),
  "placing",
  await page.evaluate(() => window.__r3d?.placer.active),
);
await page.screenshot({ path: `/tmp/v2-qa-shots/office-place-${tier}.png` });
const spot = await page.evaluate(() => {
  const R = window.__r3d,
    m = window.__tm.world.map;
  for (let y = m.y0 + 2; y < m.y0 + m.height; y++)
    for (let x = m.x0 + 2; x < m.x0 + m.width; x++)
      if (R.floorFree(x, y)) {
        const s = R.screenOf(x, y, 0);
        if (s && document.elementFromPoint(s[0], s[1])?.tagName === "CANVAS") return { x, y, s };
      }
});
console.log("spot", JSON.stringify(spot));
await page.mouse.move(spot.s[0], spot.s[1]);
await page.waitForTimeout(300);
await page.mouse.click(spot.s[0], spot.s[1]);
await page.waitForTimeout(5000);
console.log(
  "after place: dialog",
  await page.evaluate(() => window.__tm.hud.get().dialog),
  "items",
  (await coins()).items,
  "map at",
  await page.evaluate(([x, y]) => window.__tm.world.map.at(x, y), [spot.x, spot.y]),
);
await page.screenshot({ path: `/tmp/v2-qa-shots/office-placed-${tier}.png` });
console.log(page.errors);
await browser.close();
process.exit(0);
