// bun scripts/qa/interact.mjs <tier> [portal chars, comma separated]: E on one tile of each kind in a room (boards, bar, jukebox...) and what opens; run it on low and high and diff.
// Needs a local server and Playwright (see lib.mjs).
import { openGame, playwright, portals, ready, room, signUp, through } from "./lib.mjs";

const pw = await playwright();
const browser = await pw.chromium.launch({
  headless: true,
  args: ["--use-angle=metal", "--ignore-gpu-blocklist"],
});
const tier = process.argv[2] ?? "medium";
const page = await openGame(browser, await signUp("i"), tier);
await ready(page);
for (const ch of (process.argv[3] ?? "").split(",").filter(Boolean)) {
  const p = (await portals(page)).find((q) => q.ch === ch);
  if (!p) {
    console.log("no portal", ch);
    break;
  }
  await through(page, p.x, p.y);
}
const here = await room(page);
const tiles = await page.evaluate(() => {
  const m = window.__tm.world.map;
  const seen = {};
  const out = [];
  for (let y = m.y0; y < m.y0 + m.height; y++)
    for (let x = m.x0; x < m.x0 + m.width; x++) {
      const k = m.kind(x, y);
      const ch = m.at(x, y);
      if (k.walk || k.portal || k.seat) continue;
      if (!seen[ch]) {
        seen[ch] = 1;
        out.push({
          x,
          y,
          ch,
          name: k.name,
          text: !!k.text,
          pours: !!k.pours,
          tosses: !!k.tosses,
          serves: !!k.serves,
        });
      }
    }
  return out;
});
console.log("room", here, tiles.length, "kinds");
for (const t of tiles) {
  await page.evaluate(() => window.__tm.hud.set({ panel: null, dialog: null }));
  await page.evaluate(([x, y]) => window.__tm.walkTo(x, y), [t.x, t.y]);
  await page.waitForTimeout(400);
  const r = await page
    .waitForFunction(
      () => {
        const h = window.__tm.hud.get();
        return h.panel || h.dialog;
      },
      null,
      { timeout: 12000 },
    )
    .then(
      async () =>
        page.evaluate(() => {
          const h = window.__tm.hud.get();
          return { panel: h.panel?.kind, dialog: h.dialog?.slice(0, 50) };
        }),
      () => null,
    );
  console.log(t.ch.padEnd(2), t.name.padEnd(22), JSON.stringify(r));
}
console.log(page.errors);
await browser.close();
process.exit(0);
