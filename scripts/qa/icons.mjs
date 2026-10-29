// bun scripts/qa/icons.mjs [--tier high] [--tag after] [--out /tmp/v2-icons/shots] [--viewport 1280x900]
// Opens the Shop (furniture, clothes, pets), Bag, Collection and Merchant as a player with a bag of items, and for
// each: the time from opening the panel to its first paint, the frames while the 3D icons stream in (rAF deltas)
// and what the icon queue says it spent (`window.__tmIcons`, absent before this branch). Screenshots each panel.
// Needs a local server (QA_ORIGIN, default http://localhost:8840) started with ADMIN_TOKEN, and Playwright (lib.mjs).
import { mkdirSync, writeFileSync } from "node:fs";

process.env.QA_ORIGIN ??= "http://localhost:8840";
const { ORIGIN, openGame, playwright, ready, signUp } = await import("./lib.mjs");
const { createClient } = await import(
  Bun.resolveSync("rivetkit/client", new URL("../../server/", import.meta.url).pathname)
);

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const tier = arg("tier", "high");
const tag = arg("tag", "after");
const out = arg("out", "/tmp/v2-icons/shots");
const [vw, vh] = arg("viewport", "1280x900").split("x").map(Number);
const admin = process.env.ADMIN_TOKEN ?? "0123456789abcdef0123456789abcdef";
mkdirSync(out, { recursive: true });

// A player in a company (merch, an office), rich, with one of most things in the bag.
const user = await signUp("icons", 8_000_000, true);
const client = createClient({ endpoint: `${ORIGIN}/api/rivet` });
await client.town.getOrCreate(["main"], { params: { admin } }).adminSetCoins(user.userId, 100_000);
const town = client.town.getOrCreate(["main"], { params: { token: user.token } });
const items = [
  "outfit.8",
  "outfit.9",
  "glasses.2",
  "hat.1",
  "hat.2",
  "held.1",
  "held.3",
  "petwear.1",
  "pet.1",
  "pet.2",
  "pet.3",
  "pet.5",
  ...["p", "L", "c", "k", "B", "d", "o", "b", "s", "t"].map((ch) => `furn.${ch}`),
];
const bought = [];
for (const id of items) {
  try {
    await town.buy(id);
    bought.push(id);
  } catch (e) {
    console.error(`buy ${id}: ${e.message ?? e}`);
  }
}
console.log(`${bought.length} items bought`);

const pw = await playwright();
const browser = await pw.chromium.launch({
  headless: true,
  args: ["--use-angle=metal", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
});
const page = await openGame(browser, user, tier, { viewport: { width: vw, height: vh } });
await ready(page);
await page.waitForTimeout(1500);

const PANELS = [
  ["shop-furniture", { kind: "shop", tab: "furniture" }],
  ["shop-clothes", { kind: "shop", tab: "outfit" }],
  ["shop-pets", { kind: "shop", tab: "pet" }],
  ["shop-natmarked", { kind: "caseShop" }],
  ["bag", { kind: "bag" }],
  ["collection", { kind: "collection" }],
  ["merchant", { kind: "merchant" }],
  ["look", { kind: "look" }],
  ["desk", { kind: "desk" }],
  ["trophies", { kind: "trophies", userId: user.userId, name: "me" }],
];

const stats = () => page.evaluate(() => globalThis.__tmIcons?.stats() ?? null);
const results = [];
for (const [name, panel] of PANELS) {
  await page.evaluate(() => window.__tm.hud.set({ panel: null }));
  await page.waitForTimeout(400);
  const before = await stats();
  // Open, and time to the frame after the panel's first commit (its first paint), then watch frames for 2.5 s.
  const timing = await page.evaluate(
    (panel) =>
      new Promise((res) => {
        const t0 = performance.now();
        window.__tm.hud.set({ panel });
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const firstPaint = performance.now() - t0;
            const deltas = [];
            let last = performance.now();
            const stop = last + 2500;
            const loop = () => {
              const now = performance.now();
              deltas.push(now - last);
              last = now;
              if (now < stop) requestAnimationFrame(loop);
              else res({ firstPaint, deltas });
            };
            requestAnimationFrame(loop);
          });
        });
      }),
    panel,
  );
  // Let the queue finish (it is finished long before, normally) and the last icons swap in.
  await page
    .waitForFunction(() => (globalThis.__tmIcons?.stats().pending ?? 0) === 0, null, { timeout: 8000 })
    .catch(() => {});
  await page.waitForTimeout(300);
  const after = await stats();
  const modal = page.locator(".modal").first();
  const icons = await page.locator(".icon3d").count();
  const waiting = await page.locator(".icon3d.waiting").count();
  await modal.screenshot({ path: `${out}/${tag}-${tier}-${name}.png` });
  const d = timing.deltas.slice().sort((a, b) => a - b);
  const pct = (p) => d[Math.min(d.length - 1, Math.floor(d.length * p))];
  const q =
    before && after
      ? {
          rendered: after.rendered - before.rendered,
          frames: after.frames - before.frames,
          totalMs: +(after.totalMs - before.totalMs).toFixed(1),
          maxFrameMs: +after.maxFrameMs.toFixed(1),
          maxIconMs: +after.maxIconMs.toFixed(1),
          cached: after.cached,
        }
      : null;
  const row = {
    panel: name,
    icons,
    waiting,
    firstPaintMs: +timing.firstPaint.toFixed(1),
    frames: d.length,
    frameMeanMs: +(d.reduce((a, b) => a + b, 0) / d.length).toFixed(1),
    frameP95Ms: +pct(0.95).toFixed(1),
    frameMaxMs: +d[d.length - 1].toFixed(1),
    queue: q,
    errors: page.errors.splice(0),
  };
  results.push(row);
  console.log(JSON.stringify(row));
}
writeFileSync(`${out}/${tag}-${tier}-results.json`, JSON.stringify(results, null, 2));
await browser.close();
process.exit(results.some((r) => r.errors.length) ? 1 : 0);
