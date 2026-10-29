// bun scripts/qa/exits.mjs [tier] [--out /tmp/v2-doors/shots/after] [--viewport 1280x800]
// Every room's exits, seen: a company member with an Office walks through the whole world (town, house, Office,
// common room, Tavern, dorm, basement, dungeon, the four shops), stands beside each portal tile of each room and
// takes a screenshot of it (HUD on, so the "▼ E" prompt shows). Prints each room's portals as it goes. Needs a
// local server and Playwright (see lib.mjs).
import { mkdirSync } from "node:fs";
import { openGame, playwright, portals, ready, room, signUp, through } from "./lib.mjs";

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const tier = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "high";
const out = arg("out", "/tmp/v2-doors/shots/after");
const [vw, vh] = arg("viewport", "1280x800").split("x").map(Number);
mkdirSync(out, { recursive: true });

const pw = await playwright();
const browser = await pw.chromium.launch({
  headless: true,
  args: ["--use-angle=metal", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
});
const page = await openGame(browser, await signUp("ex", 8_000_000, true), tier, {
  viewport: { width: vw, height: vh },
});
await ready(page);
const inventory = [];

/** A walkable tile beside (x, y), nearest to where we stand. */
const beside = (x, y) =>
  page.evaluate(
    ([x, y]) => {
      const m = window.__tm.world.map;
      const me = window.__tm.self();
      const c = [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ]
        .map(([dx, dy]) => [x + dx, y + dy])
        .filter(([nx, ny]) => m.walkable(nx, ny))
        .sort((a, b) => Math.hypot(a[0] - me.x, a[1] - me.y) - Math.hypot(b[0] - me.x, b[1] - me.y));
      return c[0] ?? null;
    },
    [x, y],
  );

const stand = async (x, y) => {
  await page.evaluate(([x, y]) => window.__tm.walkTo(x, y), [x, y]);
  await page
    .waitForFunction(
      ([x, y]) => {
        const me = window.__tm.self();
        return me && me.x === x && me.y === y && !me.from;
      },
      [x, y],
      { timeout: 15_000 },
    )
    .catch(() => {});
  await page.waitForTimeout(900);
};

/** Screenshots every portal of the room we are in. `only`: just these portal chars (the town has many house doors). */
async function shootHere(only = null) {
  const here = await room(page);
  const list = (await portals(page)).filter((p) => !only || only.includes(p.ch));
  const seen = new Set();
  for (const p of list) {
    if (only === null && seen.has(p.ch)) continue;
    seen.add(p.ch);
    const b = await beside(p.x, p.y);
    if (!b) {
      inventory.push({ room: here, ch: p.ch, x: p.x, y: p.y, shot: null, note: "no walkable neighbour" });
      continue;
    }
    await stand(b[0], b[1]);
    const prompt = await page.evaluate(() => document.querySelector(".hints, .status")?.textContent ?? "");
    const file = `${out}/${tier}-${here.replace(/[^\w]/g, "_")}-${encodeURIComponent(p.ch)}-${p.x}_${p.y}.png`;
    await page.screenshot({ path: file });
    inventory.push({ room: here, ch: p.ch, x: p.x, y: p.y, shot: file, prompt: prompt.slice(0, 40) });
    console.log(here, p.ch, `${p.x},${p.y}`, "->", file);
  }
}

/** Takes the first portal of this character; returns the room we land in. */
async function take(ch, pick = 0) {
  const list = (await portals(page)).filter((p) => p.ch === ch);
  const p = list[pick];
  if (!p) {
    console.log("no portal", ch, "in", await room(page));
    return null;
  }
  // A long walk (a far shop) may outlast the wait: the room we are in afterwards is the answer.
  const r = (await through(page, p.x, p.y, 25_000)) ?? (await room(page));
  console.log("through", ch, "->", r);
  return r;
}

const me = await page.evaluate(() => ({ id: window.__tm.world.selfId, room: window.__tm.world.room }));
console.log("player", me, "errors so far", page.errors.length);
// Start in town: whatever room we woke in, leave it.
let here = await room(page);
for (let guard = 0; here !== "town" && guard < 4; guard++) here = await take("x");

// The town's doors: the Tavern, the gate, our own house, the four shops.
const ownDoor = await page.evaluate(() => {
  const w = window.__tm.world;
  const me = w.avatars.get(w.selfId);
  const co = me?.info?.companyId ?? me?.companyId ?? null;
  const c = co === null ? null : w.companies.get(co);
  return c ? c.plot : null;
});
console.log("own plot", ownDoor);
await shootHere(["I", "G", "ƒ", "Ç", "Ð", "ð"]);
// Our house's door: the D nearest the plot.
const houseDoor = [((ownDoor % 1000) - 500) * 10 + 5, (Math.floor(ownDoor / 1000) - 500) * 9 + 6];
{
  const b = await beside(houseDoor[0], houseDoor[1]);
  if (b) {
    await stand(b[0], b[1]);
    const file = `${out}/${tier}-town-D-${houseDoor[0]}_${houseDoor[1]}.png`;
    await page.screenshot({ path: file });
    inventory.push({ room: "town", ch: "D", x: houseDoor[0], y: houseDoor[1], shot: file });
    console.log("town D", houseDoor, "->", file);
  }
}

// The house: its exit, the stairs up, our office door.
const r = await through(page, houseDoor[0], houseDoor[1], 15_000);
console.log("through D ->", r);
if (r?.startsWith("hq:")) {
  await shootHere();
  // The way up to the hallways: from the floor below the passage, in the passage, and in the corridor.
  for (const [name, x, y] of [
    ["floor", 14, 2],
    ["passage", 14, 0],
    ["corridor", 8, -1],
  ]) {
    await stand(x, y);
    const file = `${out}/${tier}-hq-way-${name}.png`;
    await page.screenshot({ path: file });
    inventory.push({ room: r, ch: "passage", x, y, shot: file });
    console.log("hq way", name, "->", file);
  }
  if ((await take("R"))?.startsWith("office:")) {
    await shootHere();
    await take("x");
  }
  if ((await take("u"))?.startsWith("common:")) {
    await shootHere();
    await take("x");
  }
  await take("x");
}

// The Tavern, the basement and the dorm.
if ((await take("I")) === "inn") {
  await shootHere();
  if ((await take("S")) === "basement") {
    await shootHere();
    await take("x");
  }
  if ((await take("u")) === "upstairs") {
    await shootHere();
    await take("x");
  }
  await take("x");
}

// The dungeon.
if ((await take("G")) === "dungeon") {
  await shootHere();
  await take("x");
}

// The four shops.
for (const ch of ["ƒ", "Ç", "Ð", "ð"]) {
  const r = await take(ch);
  if (r?.startsWith("shop-")) {
    await shootHere();
    await take("x");
  }
}

console.log("\nINVENTORY");
for (const i of inventory) console.log(JSON.stringify(i));
console.log("errors:", page.errors.slice(0, 10));
await browser.close();
