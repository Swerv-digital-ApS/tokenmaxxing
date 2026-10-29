// QA_ADMIN=<the server's ADMIN_TOKEN> bun scripts/qa/dances.mjs [tier] [--out /tmp/dance-shots] [--only boat,floss]
// The dances end to end: a fresh player is given the coins (from the admin page's side), buys every dance, and
// starts each one from the dance bar over the chat, on the given tier ("high" by default; "low" is the 2D take). A
// few close-up frames of each, and a sheet of them all (`<tier>-sheet.png`) to look over. Exits 1 on a console
// error or a dance the bar didn't start. Needs a local server and Playwright (see lib.mjs).
import { mkdirSync, readFileSync } from "node:fs";
import { ORIGIN, openGame, playwright, ready, signUp, walkTile } from "./lib.mjs";

const { createClient } = await import(
  Bun.resolveSync("rivetkit/client", new URL("../../server/", import.meta.url).pathname)
);
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const tier = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "high";
const out = arg("out", "/tmp/dance-shots");
const only = arg("only", "")
  .split(",")
  .filter((s) => s);
mkdirSync(out, { recursive: true });

const user = await signUp("dance");
const admin = createClient({ endpoint: `${ORIGIN}/api/rivet` }).town.getOrCreate(["main"], {
  params: { admin: process.env.QA_ADMIN },
});
await admin.adminSetCoins(user.userId, 50_000);

const pw = await playwright();
const browser = await pw.chromium.launch({
  headless: true,
  args: ["--use-angle=metal", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
});
const page = await openGame(browser, user, tier, { viewport: { width: 900, height: 700 }, dpr: 2 });
await ready(page);
// Out in the open: the walkable tile nearest the room's middle with all eight neighbours free.
const open = await page.evaluate(() => {
  const m = window.__tm.world.map;
  const me = window.__tm.self();
  const [cx, cy] = [m.x0 + m.width / 2, m.y0 + m.height / 2];
  let best = null;
  for (let y = m.y0 + 1; y < m.y0 + m.height - 1; y++)
    for (let x = m.x0 + 1; x < m.x0 + m.width - 1; x++) {
      let free = true;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) free &&= m.walkable(x + dx, y + dy);
      const d = Math.hypot(x - cx, y - cy);
      if (free && (!best || d < best.d) && window.__tm.route(m, [me.x, me.y], [x, y])) best = { x, y, d };
    }
  return best;
});
if (open) await walkTile(page, open.x, open.y);
// Every dance on sale, bought at once (the server allows it from anywhere with SHOPS_ANYWHERE=1).
const dances = await page.evaluate(async () => {
  for (const d of window.__tm.dances) if (d.price > 0) await window.__tmTown.buy(`dance.${d.index}`);
  window.__tm.hud.set({ wallet: await window.__tmTown.wallet() });
  return window.__tm.dances;
});
// Close in on the player.
await page.evaluate(() => {
  for (let i = 0; i < 6; i++) window.__tm.viewHooks.zoom?.(1);
});
await page.waitForTimeout(2500);
// Where the player is on screen: through the 3D camera, or the 2D game's middle of the picture.
const clipNow = async () => {
  const at = await page.evaluate(() => {
    const r = window.__r3d;
    const p = r?.entities.positionOf(window.__tm.world.selfId);
    if (!p) return { x: innerWidth / 2, y: innerHeight / 2 };
    const v = r.rig.camera.position.clone().set(p[0], 0.7, p[1]).project(r.rig.camera);
    return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight };
  });
  return { x: at.x - 90, y: at.y - 120, width: 180, height: 200 };
};
const shown = dances.filter((d) => !only.length || only.includes(d.move));
let missed = 0;
const file = (d, f) => `${out}/${tier}-${String(d.index).padStart(2, "0")}-${d.move}-${f}.png`;
for (const d of shown) {
  // Forced: at software rendering's couple of frames a second, Playwright rarely sees anything "stable".
  await page.click(`.dance-bar button[aria-label="Dance ${d.name}"]`, { force: true });
  // The server's word on it, not the tab's own guess.
  const on = await page
    .waitForFunction((i) => window.__tm.hud.get().dancing === i, d.index, { timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (!on) {
    missed++;
    console.log(`${d.name}: the bar didn't start it`);
  }
  // An aura dance farms its aura for a while first.
  await page.waitForTimeout(d.aura ? 9000 : 900);
  for (const f of [0, 1, 2]) {
    if (f) await page.waitForTimeout(350);
    await page.screenshot({ path: file(d, f), clip: await clipNow() });
  }
}
// The lit button bobs to the beat: never "stable" to Playwright.
await page.click(`.dance-bar button[aria-pressed="true"]`, { force: true });
await page.waitForFunction(() => window.__tm.hud.get().dancing === 0, null, { timeout: 5000 });
// One sheet of them all, a row a dance.
const sheet = await browser.newPage({ viewport: { width: 700, height: 300 } });
const rows = shown.map(
  (d) =>
    `<div><b>${d.index} ${d.name}</b>${[0, 1, 2]
      .map((f) => `<img src="data:image/png;base64,${readFileSync(file(d, f)).toString("base64")}">`)
      .join("")}</div>`,
);
await sheet.setContent(
  `<style>body{margin:0;font:14px sans-serif;background:#222;color:#fff}div{display:flex;align-items:center;gap:4px}b{width:120px}img{width:180px}</style>${rows.join("")}`,
);
await sheet.screenshot({ path: `${out}/${tier}-sheet.png`, fullPage: true });
const errors = page.errors.splice(0);
for (const e of errors) console.log(e);
console.log(`${out}: ${shown.length} dances on ${tier}, ${missed} not started, ${errors.length} errors`);
await browser.close();
process.exit(errors.length || missed ? 1 : 0);
