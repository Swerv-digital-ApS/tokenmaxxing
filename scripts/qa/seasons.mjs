// bun scripts/qa/seasons.mjs [tier]: screenshots of the town in each season (`?season=`), by day, in clear weather, stood
// near a tree. OUT=dir saves them (default /tmp/seasons). Needs a local server and Playwright (see lib.mjs).
import { mkdirSync } from "node:fs";
import { openGame, playwright, portals, ready, room, signUp, through, walkTile } from "./lib.mjs";

const tier = process.argv[2] ?? "high";
const out = process.env.OUT ?? "/tmp/seasons";
mkdirSync(out, { recursive: true });
const pw = await playwright();
const browser = await pw.chromium.launch({ headless: true, args: ["--ignore-gpu-blocklist"] });
const page = await openGame(browser, await signUp("s"), tier, { viewport: { width: 1100, height: 700 } });
await ready(page);
const go = async (ch) => {
  const p = (await portals(page)).find((q) => q.ch === ch);
  if (p) await through(page, p.x, p.y);
};
for (const season of (process.env.SEASONS ?? "summer,spring,autumn,11-15,winter").split(",")) {
  await page.goto(
    `${page.url().split("#")[0].split("?")[0]}?sky=2026-10-26T13:30&weather=clear&season=${season}`,
  );
  await ready(page);
  if ((await room(page)) === "upstairs") await go("d");
  if ((await room(page)) === "inn") await go("x");
  if ((await room(page)) !== "town") throw new Error(`in ${await room(page)}, wanted the town`);
  // Next to the tree nearest the square's middle.
  const spot = await page.evaluate(() => {
    const m = window.__tm.world.map;
    let best = null;
    for (let y = m.y0; y < m.y0 + m.height; y++)
      for (let x = m.x0; x < m.x0 + m.width; x++)
        if (m.at(x, y) === "T" && m.at(x, y + 1) !== "T" && m.kind(x, y + 1).walk !== false) {
          const d = Math.hypot(x - 14, y - 6);
          if (!best || d < best.d) best = { x, y: y + 1, d };
        }
    return best;
  });
  if (spot) await walkTile(page, spot.x, spot.y);
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${out}/${tier}-${season}.png` });
  console.log(`${out}/${tier}-${season}.png`, page.errors.slice(-3));
}
await browser.close();
