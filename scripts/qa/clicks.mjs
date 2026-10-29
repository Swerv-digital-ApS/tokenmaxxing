// bun scripts/qa/clicks.mjs [tier]: clicking a company's sign opens its card; clicking another player opens theirs.
// Needs a local server and Playwright (see lib.mjs).
import { openGame, playwright, portals, ready, room, signUp, through } from "./lib.mjs";

const pw = await playwright();
const browser = await pw.chromium.launch({
  headless: true,
  args: ["--use-angle=metal", "--ignore-gpu-blocklist"],
});
const tier = process.argv[2] ?? "high";
const a = await openGame(browser, await signUp("ca", 8_000_000, true), tier, {
  viewport: { width: 1500, height: 900 },
});
const b = await openGame(browser, await signUp("cb"), tier);
await ready(a);
await ready(b);
const toTown = async (p) => {
  const q = (await portals(p)).find((x) => x.ch === "x");
  await through(p, q.x, q.y);
};
await toTown(a);
await toTown(b);
await a.waitForTimeout(2000);
// b stands next to a
await b.evaluate(() => {
  const _m = window.__tm.self();
});
const me = await a.evaluate(() => {
  const m = window.__tm.self();
  return [m.x, m.y];
});
console.log(
  "a at",
  me,
  await room(a),
  "b at",
  await b.evaluate(() => {
    const m = window.__tm.self();
    return [m.x, m.y];
  }),
);
const links = await a.evaluate(() =>
  [...document.querySelectorAll("#labels3d .r3-sign.link")].map((e) => {
    const r = e.getBoundingClientRect();
    return {
      t: e.textContent,
      x: r.x + r.width / 2,
      y: r.y + r.height / 2,
      top: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === e,
    };
  }),
);
console.log("link signs", links.length, JSON.stringify(links.slice(0, 3)));
const vis = links.find((l) => l.top && l.x > 0 && l.y > 0);
if (vis) {
  await a.mouse.click(vis.x, vis.y);
  await a.waitForTimeout(500);
  console.log("sign click ->", await a.evaluate(() => window.__tm.hud.get().panel?.kind));
  await a.evaluate(() => window.__tm.hud.set({ panel: null }));
}
await b.evaluate(([x, y]) => window.__tm.walkTo(x, y), [me[0] + 2, me[1]]);
await b
  .waitForFunction(
    ([x, y]) => {
      const m = window.__tm.self();
      return m.x === x && m.y === y;
    },
    [me[0] + 2, me[1]],
    { timeout: 60000 },
  )
  .catch(() => console.log("b did not arrive"));
await a.waitForTimeout(1500);
// click on b's avatar
const bid = await b.evaluate(() => window.__tm.world.selfId);
const s = await a.evaluate((id) => {
  const av = window.__tm.world.avatars.get(id);
  if (!av) return null;
  return window.__r3d.screenOf(av.x, av.y, 0.7);
}, bid);
console.log("b on screen", s);
if (s) {
  await a.mouse.click(s[0], s[1]);
  await a.waitForTimeout(500);
  console.log("avatar click ->", JSON.stringify(await a.evaluate(() => window.__tm.hud.get().panel)));
}
console.log(a.errors, b.errors);
await browser.close();
process.exit(0);
