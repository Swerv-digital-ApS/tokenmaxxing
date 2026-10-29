// bun scripts/qa/fountain.mjs: the town fountain up close, the world frozen, the camera aimed at it and slid a quarter of
// a device pixel at a time. Counts pixels inside a box round the fountain that change by more than a little between
// steps (z-fighting shows as many; a clean picture changes only along edges). OUT=dir saves frames and the change map.
// Needs a local server and Playwright (see lib.mjs).
import { mkdirSync, writeFileSync } from "node:fs";
import { openGame, playwright, portals, ready, room, signUp, through } from "./lib.mjs";

const pw = await playwright();
const browser = await pw.chromium.launch({
  headless: true,
  args: ["--use-angle=metal", "--ignore-gpu-blocklist"],
});
const page = await openGame(browser, await signUp("u"), process.argv[2] ?? "high", {
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
await page.addStyleTag({ content: "#hud,.label,.r3-emoji{visibility:hidden !important}" });
await page.evaluate(() => {
  for (let i = 0; i < 4; i++) window.__tm.viewHooks.zoom(1);
});
await page.waitForTimeout(2500);
// Freeze, then aim at the fountain: the middle of its tiles, the camera moved by the same offset as its look point.
const box = await page.evaluate(() => {
  const r = window.__r3d,
    m = window.__tm.world.map;
  const tiles = [];
  for (let y = m.y0; y < m.y0 + m.height; y++)
    for (let x = m.x0; x < m.x0 + m.width; x++) if (m.kind(x, y).name === "fountain") tiles.push([x, y]);
  const cx = tiles.reduce((a, t) => a + t[0], 0) / tiles.length;
  const cy = tiles.reduce((a, t) => a + t[1], 0) / tiles.length;
  const [fx, fz] = r.stage.view.toWorld(cx, cy);
  const t = performance.now();
  const real = r.frame.bind(r);
  r.frame = () => real(t);
  r.rig.update = () => {};
  const c = r.rig.camera;
  const look = c.position.clone().add(c.getWorldDirection(c.position.clone()).multiplyScalar(60));
  c.position.add(c.position.clone().set(fx - look.x, 0, fz - look.z));
  c.updateMatrixWorld();
  r.__base = c.position.clone();
  const p = c.position.clone().set(fx, 1.2, fz).project(c);
  return { x: ((p.x + 1) / 2) * innerWidth, y: ((1 - p.y) / 2) * innerHeight };
});
const clip = { x: box.x - 170, y: box.y - 150, width: 340, height: 260 };
await page.waitForTimeout(600);
const shots = [];
for (let i = 0; i <= 8; i++) {
  await page.evaluate((i) => {
    const r = window.__r3d,
      c = r.rig.camera;
    const px = (c.top - c.bottom) / (innerHeight * devicePixelRatio);
    const right = c.position.clone().setFromMatrixColumn(c.matrixWorld, 0);
    c.position.copy(r.__base).addScaledVector(right, px * 0.25 * i);
    c.updateMatrixWorld();
  }, i);
  await page.waitForTimeout(150);
  shots.push(await page.screenshot({ type: "png", clip }));
}
if (process.env.OUT) {
  mkdirSync(process.env.OUT, { recursive: true });
  for (const [i, s] of shots.entries()) writeFileSync(`${process.env.OUT}/${i}.png`, s);
}
await browser.close();
