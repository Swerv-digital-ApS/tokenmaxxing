// bun scripts/qa/tour.mjs [--tiers low,medium,high] [--out /tmp/v2-qa-shots] [--viewport 1280x800]
// Walks a fresh player through every room it can reach from the Tavern (taking each door and stairs once), on each
// graphics tier (`--company`: as a member of a company, so its house, common room and Office count too), and checks every room: no console errors, the canvas isn't blank, the renderer matches the tier.
// Exits 1 on any failure. Needs a local server (see lib.mjs).
import { mkdirSync } from "node:fs";
import { canvasInk, openGame, playwright, portals, ready, room, signUp, through } from "./lib.mjs";

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const tiers = arg("tiers", "low,medium,high").split(",");
const doorTimeout = Number(arg("door-timeout", "8000"));
const company = process.argv.includes("--company");
const out = arg("out", "/tmp/v2-qa-shots");
const [vw, vh] = arg("viewport", "1280x800").split("x").map(Number);
mkdirSync(out, { recursive: true });

const pw = await playwright();
const browser = await pw.chromium.launch({
  headless: true,
  args: ["--use-angle=metal", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
});
let failed = 0;
const report = [];

for (const tier of tiers) {
  const page = await openGame(
    browser,
    await (company ? signUp("tour", 8_000_000, true) : signUp("tour")),
    tier,
    { viewport: { width: vw, height: vh } },
  );
  await ready(page);
  const want = tier === "low" ? "2d" : "3d";
  const edges = {}; // room -> { "x,y": dest }
  const seen = new Set();
  const check = async (r) => {
    if (seen.has(r)) return;
    seen.add(r);
    if (want === "3d")
      await page.waitForFunction(
        () => {
          const renderer = window.__r3d;
          const fade = document.getElementById("r3-fade");
          return (
            renderer?.stage?.view.id === window.__tm.world.room &&
            !renderer.reveal &&
            (!fade || Number(fade.style.opacity) < 0.01)
          );
        },
        null,
        { timeout: 60_000 },
      );
    const ink = await canvasInk(page, `${out}/tour-${tier}-${r.replace(/[^\w]/g, "_")}.png`);
    const kind = await page.evaluate(() => window.__tm.perf.renderer);
    const errs = page.errors.splice(0);
    const ok = ink > 12 && errs.length === 0 && kind === want;
    if (!ok) failed++;
    report.push({ tier, room: r, ink, kind, ok, errs });
  };
  const shut = {};
  const known = {}; // room -> its portals
  const hop = (from) => {
    // The first door on the shortest known way to a room with a door not yet taken.
    const queue = [[from, null]];
    const done = new Set([from]);
    while (queue.length) {
      const [r, first] = queue.shift();
      if (r !== from && (known[r] ?? []).some((p) => !(`${p.x},${p.y}` in (edges[r] ?? {})))) return first;
      for (const [k, d] of Object.entries(edges[r] ?? {})) {
        if (!d || done.has(d)) continue;
        done.add(d);
        queue.push([d, first ?? k]);
      }
    }
    return null;
  };
  let here = await room(page);
  await check(here);
  for (let guard = 0; guard < 60; guard++) {
    here = await room(page);
    edges[here] ??= {};
    known[here] ??= await portals(page);
    // Other companies' house doors stay shut: two that fail are enough to skip the rest of their kind.
    const todo = known[here].filter(
      (p) => !(`${p.x},${p.y}` in edges[here]) && (shut[`${here}:${p.ch}`] ?? 0) < 2,
    );
    let key = null;
    if (todo.length) key = `${todo[0].x},${todo[0].y}`;
    else key = hop(here);
    if (!key) break;
    const [x, y] = key.split(",").map(Number);
    const dest = await through(page, x, y, doorTimeout);
    edges[here][key] = dest;
    if (!dest)
      shut[`${here}:${known[here].find((p) => `${p.x},${p.y}` === key)?.ch}`] =
        (shut[`${here}:${known[here].find((p) => `${p.x},${p.y}` === key)?.ch}`] ?? 0) + 1;
    if (dest) await check(dest);
  }
  await page.context().close();
}

for (const r of report)
  console.log(
    `${r.ok ? "ok  " : "FAIL"} ${r.tier.padEnd(6)} ${r.room.padEnd(16)} ink=${r.ink} ${r.kind}${r.errs.length ? ` ${r.errs.join(" | ")}` : ""}`,
  );
await browser.close();
process.exit(failed ? 1 : 0);
