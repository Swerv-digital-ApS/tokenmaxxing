// bun scripts/qa/outside.mjs [tier] [mode]: times walking out of the Tavern into town, frame by frame.
// mode "cold": reload in the Tavern so this page has never built the town, then walk out (the first way out after
// opening the game indoors). "warm": out, back in, stand still a while, then out again (the town kept).
// Prints the server's round trip (door taken → room changed), every frame over 50 ms after it, the build, the shader
// programs compiled meanwhile, and WebGL errors. OUT=file.json saves the raw frame times; CAST=dir saves the frames.
// Needs a local server and Playwright (see lib.mjs).
import { mkdirSync, writeFileSync } from "node:fs";
import { openGame, playwright, portals, ready, room, signUp, through } from "./lib.mjs";

const tier = process.argv[2] ?? "high";
const mode = process.argv[3] ?? "cold";
const pw = await playwright();
const browser = await pw.chromium.launch({
  headless: true,
  args: ["--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"],
});
const page = await openGame(browser, await signUp("o"), tier);
let glErrors = 0;
page.on("console", (m) => m.text().includes("GL_INVALID") && glErrors++);
await ready(page);

/** Out of the Tavern's front door (`x`; `S` and `u` are its stairs). */
async function walkOut() {
  const door = (await portals(page)).find((p) => p.ch === "x");
  return door ? through(page, door.x, door.y) : null;
}
async function walkIn() {
  const inn = (await portals(page)).find((p) => p.ch === "I");
  if (!inn || (await through(page, inn.x, inn.y)) !== "inn")
    throw new Error("could not walk into the Tavern");
}
// New players wake up in the dorm or in town, depending on their agents: into the Tavern either way.
if ((await room(page)) !== "inn") await walkIn();
if (mode === "cold") {
  // Straight for the door once the world is in, as someone who opened the game to go outside would.
  await page.reload();
  await page.waitForFunction(
    () => window.__tm?.world.selfId && window.__tm.self() && window.__r3d?.stats.frames > 0,
    null,
    {
      timeout: 30_000,
    },
  );
  await page.evaluate(() => window.__tm.hud.set({ panel: null, dialog: null }));
  if ((await room(page)) !== "inn") throw new Error("not in the Tavern after the reload");
} else {
  if ((await walkOut()) !== "town") throw new Error("could not walk out");
  await page.waitForTimeout(1500);
  await walkIn();
  await page.waitForTimeout(6000);
}
if (mode !== "cold") await page.waitForTimeout(500);

// Every rAF gap, and when the door was taken, the room changed, the stage was built, shader programs were added.
await page.evaluate(() => {
  const w = window.__tm.world;
  const r = window.__r3d;
  const log = { gaps: [], ev: [] };
  window.__log = log;
  let last = performance.now();
  let pending = false;
  let here = w.room;
  let builds = r.stats.builds;
  let programs = r.pipe.renderer.info.programs.length;
  const loop = (t) => {
    log.gaps.push([t, t - last]);
    last = t;
    if (w.portalPending !== pending) {
      pending = w.portalPending;
      log.ev.push([t, `pending=${pending}`]);
    }
    if (w.room !== here) {
      here = w.room;
      log.ev.push([t, `room=${here}`]);
    }
    const n = r.pipe.renderer.info.programs.length;
    if (n > programs) log.ev.push([t, `+${n - programs} shader programs`]);
    programs = n;
    if (r.stats.builds !== builds) {
      builds = r.stats.builds;
      log.ev.push([t, `stage ready in ${r.stats.lastBuildMs.toFixed(1)} ms`]);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
});

let frames = 0;
const cast = process.env.CAST ? await page.context().newCDPSession(page) : null;
if (cast) {
  mkdirSync(process.env.CAST, { recursive: true });
  const c0 = Date.now();
  cast.on("Page.screencastFrame", async (f) => {
    const name = `${String(frames++).padStart(4, "0")}-${Date.now() - c0}.jpg`;
    writeFileSync(`${process.env.CAST}/${name}`, Buffer.from(f.data, "base64"));
    await cast.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  await cast.send("Page.startScreencast", { format: "jpeg", quality: 85, maxWidth: 640, maxHeight: 400 });
}
const out = await walkOut();
await page.waitForTimeout(3000);
if (cast) await cast.send("Page.stopScreencast");

const { gaps, ev } = await page.evaluate(() => window.__log);
const t0 = ev.find((e) => e[1] === "pending=true")?.[0] ?? gaps[0][0];
const after = gaps.filter(([t]) => t >= t0);
const long = after.filter(([, g]) => g > 50);
console.log(`gpu tier ${tier}, ${mode}: reached ${out}, gl errors ${glErrors}`);
for (const [t, e] of ev) console.log(`  +${(t - t0).toFixed(0)}ms ${e}`);
console.log(
  `  frames over 50 ms: ${long.map(([t, g]) => `+${(t - t0).toFixed(0)}:${g.toFixed(0)}`).join(" ") || "none"}`,
);
if (process.env.OUT)
  writeFileSync(
    process.env.OUT,
    JSON.stringify({
      tier,
      mode,
      out,
      glErrors,
      ev: ev.map(([t, e]) => [t - t0, e]),
      gaps: after.map(([t, g]) => [t - t0, g]),
    }),
  );
await browser.close();
