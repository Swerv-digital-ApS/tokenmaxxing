// bun scripts/qa/stairs.mjs: the company house's stairs up to the common room, close up, the world frozen, the camera
// slid a sixth of a device pixel per frame. Prints pixels that change in the stairs' box and saves the frames and the
// change map. OUT=dir. Needs a local server and Playwright (see lib.mjs).
import { mkdirSync, writeFileSync } from "node:fs";
import { openGame, playwright, portals, ready, room, signUp, through } from "./lib.mjs";

const pw = await playwright();
const browser = await pw.chromium.launch({
  headless: true,
  args: ["--use-angle=metal", "--ignore-gpu-blocklist"],
});
const page = await openGame(browser, await signUp("t", 8_000_000, true), process.argv[2] ?? "high", {
  viewport: { width: 960, height: 600 },
  dpr: 2,
});
await ready(page);
await page.goto(`${page.url().split("#")[0].split("?")[0]}?sky=2026-10-26T13:30&weather=clear`);
await ready(page);
for (const [from, ch] of [
  ["upstairs", "d"],
  ["inn", "x"],
])
  if ((await room(page)) === from) {
    const p = (await portals(page)).find((q) => q.ch === ch);
    await through(page, p.x, p.y);
  }
if (!(await room(page)).startsWith("hq:")) {
  const doors = await page.evaluate(() => {
    const m = window.__tm.world.map,
      me = window.__tm.self();
    return m
      .find("D")
      .filter(([x, y]) => window.__tm.route(m, [me.x, me.y], [x, y]))
      .sort((a, b) => Math.hypot(a[0] - me.x, a[1] - me.y) - Math.hypot(b[0] - me.x, b[1] - me.y));
  });
  for (const [x, y] of doors) {
    await through(page, x, y, 12000);
    if ((await room(page)).startsWith("hq:")) break;
  }
}
if (!(await room(page)).startsWith("hq:")) throw new Error(`in ${await room(page)}`);
await page.addStyleTag({ content: "#hud,.label,.r3-emoji{visibility:hidden !important}" });
for (let i = 0; i < 4; i++) await page.evaluate(() => window.__tm.viewHooks.zoom(1));
await page.waitForTimeout(3000);
const box = await page.evaluate(() => {
  const r = window.__r3d,
    m = window.__tm.world.map;
  const [ux, uy] = m.find("u")[0];
  const [fx, fz] = r.stage.view.toWorld(ux, uy);
  const t = performance.now();
  const real = r.frame.bind(r);
  r.frame = () => real(t);
  r.rig.update = () => {};
  const c = r.rig.camera;
  const look = c.position.clone().add(c.getWorldDirection(c.position.clone()).multiplyScalar(60));
  c.position.add(c.position.clone().set(fx - look.x, 0, fz - 0.5 - look.z));
  c.updateMatrixWorld();
  r.__base = c.position.clone();
  const p = c.position
    .clone()
    .set(fx, 0.6, fz - 0.5)
    .project(c);
  return { x: ((p.x + 1) / 2) * innerWidth, y: ((1 - p.y) / 2) * innerHeight };
});
await page.waitForTimeout(600);
const clip = { x: Math.max(0, box.x - 130), y: Math.max(0, box.y - 150), width: 260, height: 230 };
const shots = [];
for (let i = 0; i < 6; i++) {
  await page.evaluate((i) => {
    const r = window.__r3d,
      c = r.rig.camera;
    const px = (c.top - c.bottom) / (innerHeight * devicePixelRatio);
    const right = c.position.clone().setFromMatrixColumn(c.matrixWorld, 0);
    c.position.copy(r.__base).addScaledVector(right, (px * i) / 6);
    c.updateMatrixWorld();
  }, i);
  await page.waitForTimeout(160);
  shots.push(await page.screenshot({ type: "png", clip }));
}
if (process.env.OUT) {
  mkdirSync(process.env.OUT, { recursive: true });
  for (const [i, s] of shots.entries()) writeFileSync(`${process.env.OUT}/${i}.png`, s);
}
await browser.close();
process.exit(0);
