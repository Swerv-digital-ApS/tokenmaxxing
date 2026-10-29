// bun scripts/qa/sleep.mjs [tier]: a company member goes offline (asleep in a bed of the company house) after dropping a hat in the town; another member checks both are drawn in 3D (screenshots in /tmp/v2-qa-shots).
// Needs a local server and Playwright (see lib.mjs).
import { mkdirSync } from "node:fs";
import { openGame, playwright, ready, room, signUp } from "./lib.mjs";

const { ITEMS } = await import("../../core/src/shop.ts");
const { doorOf } = await import("../../core/src/maps.ts");
const pw = await playwright();
const browser = await pw.chromium.launch({
  headless: true,
  args: ["--use-angle=metal", "--ignore-gpu-blocklist"],
});
const tier = process.argv[2] ?? "high";
mkdirSync("/tmp/v2-qa-shots", { recursive: true });
const hat = ITEMS.filter((i) => i.slot === "hat" && i.tradeable && i.price > 0).sort(
  (a, b) => a.price - b.price,
)[0];

// A starts a company; B (usage that stopped half an hour ago, so asleep rather than at a desk) joins it.
const a = await openGame(browser, await signUp("lk", 400_000, true), tier);
await ready(a);
const company = await a.evaluate(() => {
  const c = window.__tm.hud.get().me?.company;
  return c && { id: c.id, plot: c.plot };
});
console.log("company", JSON.stringify(company));
const b = await openGame(browser, await signUp("sl", 8_000_000, false, 30), tier);
await ready(b);
const bId = await b.evaluate(() => window.__tm.world.selfId);
await b.evaluate((id) => window.__tmTown.apply(id), company.id);
await a.evaluate((id) => window.__tmTown.approve(id), bId);
await b.waitForTimeout(1500);
// Walk into the town and drop a hat there.
const toTown = async (page) => {
  await page.evaluate(() => {
    const m = window.__tm.world.map;
    for (let y = m.y0; y < m.y0 + m.height; y++)
      for (let x = m.x0; x < m.x0 + m.width; x++) if (m.at(x, y) === "x") window.__tm.walkTo(x, y);
  });
  await page.waitForFunction(() => window.__tm.world.room === "town", null, { timeout: 20000 });
  await page.waitForTimeout(1200);
};
await toTown(b);
const out = await b.evaluate(async (id) => {
  await window.__tmTown.buy(id);
  return window.__tmTown.drop(id);
}, hat.id);
console.log("drop", JSON.stringify(out).slice(0, 100));
await b.context().close();
await a.waitForTimeout(1500);

await toTown(a);
console.log(
  "town drops: world",
  await a.evaluate(() => window.__tm.world.drops.length),
  "drawn",
  await a.evaluate(() => window.__r3d?.drops?.group?.children.length ?? null),
);
await a.screenshot({ path: "/tmp/v2-qa-shots/sleep-drops.png" });
// Into the company house.
const [dx, dy] = doorOf(company.plot);
await a.evaluate(([x, y]) => window.__tm.walkTo(x, y), [dx, dy]);
await a
  .waitForFunction(() => window.__tm.world.room.startsWith("hq"), null, { timeout: 30000 })
  .catch(() => {});
await a.waitForTimeout(2500);
const house = await a.evaluate((id) => {
  const w = window.__tm.world;
  const sleepers = [...w.avatars.values()].filter((v) => v.info.id === id);
  const beds = [];
  const m = w.map;
  for (let y = m.y0; y < m.y0 + m.height; y++)
    for (let x = m.x0; x < m.x0 + m.width; x++) if (m.at(x, y) === "b") beds.push([x, y]);
  return {
    room: w.room,
    sleepers: sleepers.map((s) => ({
      state: s.state,
      x: s.x,
      y: s.y,
      onBed: beds.some(([x, y]) => x === s.x && y === s.y),
      drawnAt: window.__r3d.entities.positionOf(s.info.id),
    })),
    beds: beds.length,
  };
}, bId);
console.log("house", JSON.stringify(house));
await a.screenshot({ path: "/tmp/v2-qa-shots/sleep-house.png" });
console.log("errors", a.errors);
await browser.close();
