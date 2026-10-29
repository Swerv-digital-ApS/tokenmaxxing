// bun scripts/qa/shimmer.mjs: with the camera frozen in town, how many pixels away from the player change while they
// take single steps, against the same pauses standing still (animations alone). OUT=file.json keeps the frames.
// Needs a local server and Playwright (see lib.mjs).
import { writeFileSync } from "node:fs";
import { openGame, playwright, portals, ready, signUp, through } from "./lib.mjs";

const tier = process.argv[2] ?? "high";
const pw = await playwright();
const browser = await pw.chromium.launch({
  headless: true,
  args: ["--use-angle=metal", "--ignore-gpu-blocklist"],
});
const page = await openGame(browser, await signUp("h"), tier, { viewport: { width: 960, height: 600 } });
await ready(page);
// SKY=2026-10-26T14:00: daylight (Copenhagen time) and clear weather, so the sun casts shadows.
if (process.env.SKY) {
  await page.goto(`${page.url().split("?")[0].split("#")[0]}?sky=${process.env.SKY}&weather=clear`);
  await ready(page);
}
if ((await page.evaluate(() => window.__tm.world.room)) !== "town") {
  const door = (await portals(page)).find((p) => p.ch === "x" || p.ch === "I");
  if (door) await through(page, door.x, door.y);
}
if ((await page.evaluate(() => window.__tm.world.room)) === "inn") {
  const door = (await portals(page)).find((p) => p.ch === "x");
  await through(page, door.x, door.y);
}
await page.addStyleTag({
  content: "#hud{visibility:hidden !important} .r3d-labels,.labels{display:none !important}",
});
await page.waitForTimeout(4000);
// The camera stays where it is from here on.
await page.evaluate(() => {
  window.__r3d.rig.update = () => {};
});
const grab = async () => (await page.screenshot({ type: "png" })).toString("base64");
const where = () =>
  page.evaluate(() => {
    const r = window.__r3d;
    const p = r.entities.positionOf(window.__tm.world.selfId);
    if (!p) return null;
    const v = r.rig.camera.position.clone().set(p[0], 0.8, p[1]).project(r.rig.camera);
    return [((v.x + 1) / 2) * 960, ((1 - v.y) / 2) * 600];
  });
const frames = [];
for (let i = 0; i < 5; i++) {
  await page.waitForTimeout(700);
  frames.push({ kind: "still", img: await grab(), me: await where() });
}
const me = await page.evaluate(() => [window.__tm.self().x, window.__tm.self().y]);
for (let i = 1; i <= 6; i++) {
  await page.evaluate(([x, y]) => window.__tm.walkTo(x, y), [me[0] + (i % 2), me[1]]);
  await page.waitForTimeout(700);
  frames.push({ kind: "walk", img: await grab(), me: await where() });
}
writeFileSync(process.env.OUT, JSON.stringify(frames));
console.log("frames", frames.length);
await browser.close();
