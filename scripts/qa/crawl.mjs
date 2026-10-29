// bun scripts/qa/crawl.mjs <tier>: how much the picture flickers as the camera glides, as it does while you walk.
// Town, by day, the world frozen (people, the clock): the camera is slid sideways a quarter of a pixel at a time and each
// frame compared with the last. A clean picture changes a little at edges; noisy shading changes far more. Run with the
// pipeline as the tier sets it and with one thing changed at a time (AO off, MSAA on). OUT=dir saves crops.
// Needs a local server and Playwright (see lib.mjs).
import { mkdirSync, writeFileSync } from "node:fs";
import { openGame, playwright, portals, ready, room, signUp, through } from "./lib.mjs";

const tier = process.argv[2] ?? "high";
const pw = await playwright();
const browser = await pw.chromium.launch({
  headless: true,
  args: ["--use-angle=metal", "--ignore-gpu-blocklist"],
});
const page = await openGame(browser, await signUp("c"), tier, {
  viewport: { width: 960, height: 600 },
  dpr: 2,
});
await ready(page);
await page.goto(`${page.url().split("#")[0].split("?")[0]}?sky=2026-10-26T13:30&weather=clear`);
await ready(page);
// ROOM=upstairs measures the dorm instead of the town.
const want = process.env.ROOM ?? "town";
const go = async (ch) => {
  const p = (await portals(page)).find((q) => q.ch === ch);
  if (p) await through(page, p.x, p.y);
};
if (want === "town") {
  if ((await room(page)) === "upstairs") await go("d");
  if ((await room(page)) === "inn") await go("x");
} else {
  if ((await room(page)) === "town") await go("I");
  if ((await room(page)) === "inn") await go("u");
}
if ((await room(page)) !== want) throw new Error(`in ${await room(page)}, wanted ${want}`);
// NEAR=fountain: stand next to the first tile of that name first (the town square's fountain).
if (process.env.NEAR) {
  const spot = await page.evaluate((name) => {
    const m = window.__tm.world.map,
      me = window.__tm.self();
    for (let y = m.y0; y < m.y0 + m.height; y++)
      for (let x = m.x0; x < m.x0 + m.width; x++)
        if (m.kind(x, y).name === name)
          for (const [dx, dy] of [
            [0, 2],
            [1, 2],
            [-1, 2],
            [0, 3],
          ])
            if (m.walkable(x + dx, y + dy) && window.__tm.route(m, [me.x, me.y], [x + dx, y + dy]))
              return [x + dx, y + dy];
    return null;
  }, process.env.NEAR);
  if (!spot) throw new Error(`nothing called ${process.env.NEAR}`);
  await page.evaluate(([x, y]) => window.__tm.walkTo(x, y), spot);
  await page.waitForTimeout(6000);
}
await page.addStyleTag({ content: "#hud{visibility:hidden !important}" });
// ZOOM=n: that many steps closer (z-fighting shows best up close).
await page.evaluate(
  (n) => {
    for (let i = 0; i < n; i++) window.__tm.viewHooks.zoom(1);
  },
  Number(process.env.ZOOM ?? 0),
);
await page.waitForTimeout(3000);

/** Freezes everything that moves by itself: the clock the scene animates by, the rig, and the people. */
await page.evaluate(() => {
  const r = window.__r3d;
  r.rig.update = () => {};
  const t = performance.now();
  r.__frozen = t;
  const real = r.frame.bind(r);
  r.frame = () => real(t);
});
await page.waitForTimeout(500);

async function run(label, setup, step = 0.25) {
  await page.evaluate(setup);
  await page.waitForTimeout(400);
  const diffs = [];
  let prev = null;
  for (let i = 0; i <= 8; i++) {
    await page.evaluate(
      ([i, step]) => {
        const r = window.__r3d;
        const c = r.rig.camera;
        // A quarter of a device pixel to the right per step.
        const px = (c.top - c.bottom) / (window.innerHeight * window.devicePixelRatio);
        if (r.__base === undefined) r.__base = c.position.clone();
        const right = c.position.clone().setFromMatrixColumn(c.matrixWorld, 0);
        c.position.copy(r.__base).addScaledVector(right, px * step * i);
        c.updateMatrixWorld();
      },
      [i, step],
    );
    await page.waitForTimeout(150);
    const png = await page.screenshot({ type: "png", clip: { x: 160, y: 100, width: 640, height: 400 } });
    if (process.env.OUT && (i === 3 || i === 4)) {
      mkdirSync(process.env.OUT, { recursive: true });
      writeFileSync(`${process.env.OUT}/${label}-${i}.png`, png);
    }
    if (prev)
      diffs.push(
        await page.evaluate(
          async ([a, b]) => {
            const load = async (s) => {
              const img = new Image();
              img.src = `data:image/png;base64,${s}`;
              await img.decode();
              const c = new OffscreenCanvas(img.width, img.height);
              const g = c.getContext("2d");
              g.drawImage(img, 0, 0);
              return g.getImageData(0, 0, img.width, img.height).data;
            };
            const [x, y] = await Promise.all([load(a), load(b)]);
            let flick = 0;
            for (let k = 0; k < x.length; k += 4) {
              const d = Math.max(
                Math.abs(x[k] - y[k]),
                Math.abs(x[k + 1] - y[k + 1]),
                Math.abs(x[k + 2] - y[k + 2]),
              );
              if (d > 20) flick++;
            }
            return flick;
          },
          [prev, png.toString("base64")],
        ),
      );
    prev = png.toString("base64");
  }
  await page.evaluate(() => {
    const r = window.__r3d;
    r.rig.camera.position.copy(r.__base);
    r.rig.camera.updateMatrixWorld();
  });
  diffs.sort((a, b) => a - b);
  console.log(
    `${label.padEnd(22)} pixels flickering per quarter-pixel camera step: median ${diffs[4]}, worst ${diffs.at(-1)}`,
  );
}

const opts = await page.evaluate(() => ({ ...window.__r3d.pipe.opts }));
await run("as the tier sets it", () => {});
await run("still (no camera move)", () => {}, 0);
await run("AO off", () => window.__r3d.pipe.configure({ aoSamples: 0 }));
await run("AO off, MSAA 4x", () => window.__r3d.pipe.configure({ aoSamples: 0, msaa: 4 }));
await run("AO on, MSAA 4x", () => window.__r3d.pipe.configure({ aoSamples: 10, msaa: 4 }));
console.log(
  "tier options:",
  JSON.stringify({ ao: opts.aoSamples, aoScale: opts.aoScale, msaa: opts.msaa, shadow: opts.shadowSize }),
);
await browser.close();
