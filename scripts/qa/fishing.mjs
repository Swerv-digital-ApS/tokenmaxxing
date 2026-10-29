// bun scripts/qa/fishing.mjs [tier]: walks a new player to the pond, fishes a few casts through the panel, and
// screenshots the panel, the catch held up over the bank, and the journal. OUT=dir (default /tmp/fishing-qa).
// WATCH=1 also brings a second player to watch, and screenshots their view of the line, the bite and the catch.
// Needs a local server and Playwright (see lib.mjs).
import { mkdirSync } from "node:fs";
import { openGame, playwright, portals, ready, room, signUp, through, walkTile } from "./lib.mjs";

const tier = process.argv[2] ?? "high";
const out = process.env.OUT ?? "/tmp/fishing-qa";
mkdirSync(out, { recursive: true });
const pw = await playwright();
const browser = await pw.chromium.launch({
  headless: true,
  args: ["--use-angle=metal", "--ignore-gpu-blocklist"],
});
async function toTown(p) {
  await ready(p);
  for (const [from, ch] of [
    ["upstairs", "d"],
    ["inn", "x"],
  ])
    if ((await room(p)) === from) {
      const q = (await portals(p)).find((r) => r.ch === ch);
      await through(p, q.x, q.y);
    }
}
const page = await openGame(browser, await signUp("angler"), tier, {
  viewport: { width: 1280, height: 860 },
});
await toTown(page);
await walkTile(page, 2, 12);
// WATCH=1: a second player stands nearby and screenshots what they see of the angler.
const watcher = process.env.WATCH
  ? await openGame(browser, await signUp("watcher"), tier, { viewport: { width: 1280, height: 860 } })
  : null;
if (watcher) {
  await toTown(watcher);
  await walkTile(watcher, 2, 9);
  await watcher.evaluate(() => {
    for (let i = 0; i < 3; i++) window.__tm.viewHooks?.zoom?.(1);
  });
}
const watch = async (name) =>
  watcher?.screenshot({
    path: `${out}/${tier}-watcher-${name}.png`,
  });
await page.keyboard.down("ArrowRight");
await page.waitForTimeout(60);
await page.keyboard.up("ArrowRight");
await page.waitForTimeout(500);
// Closer in, so the catch reads (the 2D tier has no zoom hook).
await page.evaluate(() => {
  for (let i = 0; i < 3; i++) window.__tm.viewHooks?.zoom?.(1);
});
await page.evaluate(() => window.__tm.hud.set({ panel: { kind: "fishing" } }));
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/${tier}-panel.png` });
let caught = 0;
for (let i = 0; i < 6 && caught < 3; i++) {
  await page.getByRole("button", { name: "Cast a line" }).click();
  if (caught === 0) {
    await page.waitForTimeout(800);
    await watch("line");
  }
  await page.getByRole("button", { name: "Reel it in!" }).waitFor({ timeout: 12_000 });
  if (caught === 0) await watch("bite");
  await page.getByRole("button", { name: "Reel it in!" }).click();
  await page.waitForTimeout(450);
  if (caught === 0) {
    await page.waitForTimeout(500);
    await watch("catch");
  }
  caught++;
  if (caught === 1) {
    await page.screenshot({ path: `${out}/${tier}-catch-panel.png` });
    // The catch over the bank, with the panel out of the way.
    await page.addStyleTag({ content: ".modal,.modal-backdrop{visibility:hidden !important}" });
    for (const at of [0, 1, 2]) {
      await page.waitForTimeout(at === 0 ? 50 : 500);
      await page.screenshot({
        path: `${out}/${tier}-catch-world-${at}.png`,
        clip: { x: 340, y: 230, width: 600, height: 400 },
      });
    }
    await page.addStyleTag({ content: ".modal,.modal-backdrop{visibility:visible !important}" });
  }
  await page.waitForTimeout(2400);
}
await page.screenshot({ path: `${out}/${tier}-journal.png`, fullPage: true });
await page.getByRole("button", { name: "💎 Treasures" }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/${tier}-treasures.png` });
await page.getByRole("button", { name: "🏆 Pond records" }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/${tier}-records.png` });
console.log(JSON.stringify({ tier, caught, errors: page.errors, watcherErrors: watcher?.errors }, null, 1));
await browser.close();
