// bun scripts/qa/crowd.mjs [tiers, comma separated]: several clients on different tiers in one room, all talking at once; screenshots and bubble counts.
// Needs a local server and Playwright (see lib.mjs).
import { openGame, playwright, ready, signUp } from "./lib.mjs";

const pw = await playwright();
const browser = await pw.chromium.launch({
  headless: true,
  args: ["--use-angle=metal", "--ignore-gpu-blocklist"],
});
const tiers = (process.argv[2] ?? "high,low,medium,high,medium,low").split(",");
const pages = [];
for (const t of tiers) {
  const p = await openGame(browser, await signUp("m"), t, { viewport: { width: 900, height: 600 } });
  await ready(p);
  pages.push(p);
}
// all walk to the same spot
const _spot = await pages[0].evaluate(() => {
  const _m = window.__tm.world.map;
  return [13, 12];
});
await Promise.all(
  pages.map((p, i) =>
    p.evaluate(([x, y]) => window.__tm.walkTo(x + 0, y), [13 + (i % 3) - 1, 12 + Math.floor(i / 3)]),
  ),
);
await pages[0].waitForTimeout(6000);
// everyone talks
for (const [i, p] of pages.entries()) {
  await p.keyboard.press("Enter");
  await p.keyboard.type(`hi from ${tiers[i]} #${i}`);
  await p.keyboard.press("Enter");
}
await pages[0].waitForTimeout(1500);
await pages[1].keyboard.press("Enter");
for (const [i, p] of pages.entries())
  await p.screenshot({ path: `/tmp/v2-qa-shots/multi-${i}-${tiers[i]}.png` });
console.log(
  await pages[0].evaluate(() => ({
    room: window.__tm.world.room,
    avatars: window.__tm.world.avatars.size,
    bubbles: [...document.querySelectorAll(".r3-bubble")].map((e) => e.textContent),
  })),
);
console.log(
  await pages[1].evaluate(() => ({
    avatars: window.__tm.world.avatars.size,
    chat: [...window.__tm.world.avatars.values()].filter((a) => a.bubble).length,
  })),
);
for (const p of pages) if (p.errors.length) console.log(p.errors);
await browser.close();
process.exit(0);
