// bun scripts/qa/zscan.mjs [tier] [room ...]: finds what flickers in the real renderer, room by room.
//
// For each room (town inn upstairs basement dungeon hq office common shop-furniture shop-clothes shop-barber shop-pets) and
// each of the camera's four quarter turns: the world is frozen (the frame clock, the people, the camera's own easing), the
// camera is slid sideways by a sixth of a device pixel at a time for six frames, and every pixel's range over the six is
// taken. A flat area that changes between frames, away from any edge, is z-fighting (two surfaces on one plane), shadow
// acne or shading noise: something that shimmers as the camera moves. Each cluster of such pixels is raycast to say what is
// there. Edges are left out: an edge always changes a little between frames, which is no fault.
// OUT=dir keeps an overlay per room and turn (red: flickering pixels); JSON=file keeps the clusters.
// Needs a local server and Playwright (see lib.mjs).
import { mkdirSync, writeFileSync } from "node:fs";
import { openGame, playwright, portals, ready, room as roomOf, signUp, through } from "./lib.mjs";

const args = process.argv.slice(2);
const tier = ["low", "medium", "high", "ultra"].includes(args[0]) ? args.shift() : "high";
const ALL = [
  "town",
  "inn",
  "upstairs",
  "basement",
  "dungeon",
  "hq",
  "office",
  "common",
  "shop-furniture",
  "shop-clothes",
  "shop-barber",
  "shop-pets",
  "shop-natmarked",
];
const wanted = args.length ? args : ALL;

const kind = (id) => (id.includes(":") ? id.slice(0, id.indexOf(":")) : id);
// How to leave a kind of room for each neighbour: the exit tile's character, or "*" for any (a single exit).
const EDGES = {
  town: {
    inn: "I",
    dungeon: "G",
    "shop-furniture": "ƒ",
    "shop-clothes": "Ç",
    "shop-barber": "Ð",
    "shop-pets": "ð",
    "shop-natmarked": "Ñ",
    hq: "D",
  },
  inn: { town: "x", basement: "S", upstairs: "u" },
  basement: { inn: "*" },
  upstairs: { inn: "*" },
  dungeon: { town: "*" },
  "shop-furniture": { town: "*" },
  "shop-clothes": { town: "*" },
  "shop-barber": { town: "*" },
  "shop-pets": { town: "*" },
  "shop-natmarked": { town: "*" },
  hq: { town: "x", office: "R", common: "u" },
  office: { hq: "*" },
  common: { hq: "*" },
};
function path(from, to) {
  const seen = new Map([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const k = queue.shift();
    if (k === to) break;
    for (const n of Object.keys(EDGES[k] ?? {})) {
      if (seen.has(n)) continue;
      seen.set(n, k);
      queue.push(n);
    }
  }
  const out = [];
  for (let k = to; k && k !== from; k = seen.get(k)) out.unshift(k);
  return out;
}

const pw = await playwright();
const browser = await pw.chromium.launch({
  headless: true,
  args: ["--use-angle=metal", "--ignore-gpu-blocklist"],
});
const user = await signUp("z", 8_000_000, true);
const page = await openGame(browser, user, tier, { viewport: { width: 1200, height: 750 }, dpr: 2 });
await ready(page);
await page.goto(`${page.url().split("#")[0].split("?")[0]}?sky=2026-10-26T13:30&weather=clear`);
await ready(page);
await page.addStyleTag({ content: "#hud,.label,.r3-emoji{visibility:hidden !important}" });

async function hop(to) {
  const from = kind(await roomOf(page));
  const ch = EDGES[from][to];
  let doors = (await portals(page)).filter((p) => ch === "*" || p.ch === ch);
  const me = await page.evaluate(() => [window.__tm.self().x, window.__tm.self().y]);
  if (to === "office") {
    const own = await page.evaluate(() =>
      window.__tm.world.doors.find((d) => d.userId === window.__tm.world.selfId),
    );
    doors = doors.filter((p) => own && p.x === own.x && p.y === own.y);
  }
  doors.sort((a, b) => Math.hypot(a.x - me[0], a.y - me[1]) - Math.hypot(b.x - me[0], b.y - me[1]));
  for (const d of doors) {
    const at = await through(page, d.x, d.y, 15_000);
    if (at && kind(at) === to) return true;
    if (at && kind(at) !== from) await hop(from).catch(() => {});
  }
  return false;
}
async function reach(target) {
  for (const next of path(kind(await roomOf(page)), target)) if (!(await hop(next))) return false;
  return kind(await roomOf(page)) === target;
}

const results = {};
for (const target of wanted) {
  if (!(await reach(target))) {
    console.log(`\n== ${target}: could not get there`);
    continue;
  }
  await page.waitForTimeout(3500);
  // PREP=js: run in the page once the room is up, to try a change without rebuilding (an experiment).
  if (process.env.PREP) await page.evaluate(process.env.PREP);
  const out = [];
  for (let turn = 0; turn < 4; turn++) {
    // Turn the camera and let it settle, then freeze everything and take the frames.
    await page.evaluate(() => {
      const r = window.__r3d;
      if (r.__update) r.rig.update = r.__update;
      if (r.__realFrame) r.frame = r.__realFrame;
      window.__tm.viewHooks.rotate(1);
    });
    await page.waitForTimeout(1800);
    await page.evaluate(() => {
      const r = window.__r3d;
      r.__update = r.rig.update;
      r.__realFrame = r.frame;
      const real = r.frame.bind(r);
      const t = performance.now();
      r.frame = () => real(t);
      r.rig.update = () => {};
      r.__base = r.rig.camera.position.clone();
    });
    await page.waitForTimeout(500);
    const shots = [];
    for (let i = 0; i < 6; i++) {
      await page.evaluate((i) => {
        const r = window.__r3d;
        const c = r.rig.camera;
        const px = (c.top - c.bottom) / (innerHeight * devicePixelRatio);
        const right = c.position.clone().setFromMatrixColumn(c.matrixWorld, 0);
        c.position.copy(r.__base).addScaledVector(right, (px * i) / 6);
        c.updateMatrixWorld();
      }, i);
      await page.waitForTimeout(160);
      shots.push((await page.screenshot({ type: "png" })).toString("base64"));
    }
    // SHOTS=dir keeps the six raw frames of every view.
    if (process.env.SHOTS) {
      mkdirSync(process.env.SHOTS, { recursive: true });
      for (const [i, b] of shots.entries())
        writeFileSync(`${process.env.SHOTS}/${target}-${turn}-${i}.png`, Buffer.from(b, "base64"));
    }
    const res = await page.evaluate(async (shots) => {
      const load = async (b64) => {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const bmp = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
        const cv = new OffscreenCanvas(bmp.width, bmp.height);
        const g = cv.getContext("2d");
        g.drawImage(bmp, 0, 0);
        return g.getImageData(0, 0, bmp.width, bmp.height);
      };
      const imgs = await Promise.all(shots.map(load));
      const { width: W, height: H } = imgs[0];
      const lum = (d, i) => 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
      const range = new Uint8Array(W * H);
      for (let p = 0; p < W * H; p++) {
        let lo = 255,
          hi = 0;
        for (const im of imgs) {
          const l = lum(im.data, p * 4);
          if (l < lo) lo = l;
          if (l > hi) hi = l;
        }
        range[p] = hi - lo;
      }
      // Edges of the first frame, widened: what moves there is an edge moving, not a surface fighting.
      const d0 = imgs[0].data;
      const edge = new Uint8Array(W * H);
      for (let y = 1; y < H - 1; y++)
        for (let x = 1; x < W - 1; x++) {
          const p = y * W + x;
          const g =
            Math.abs(lum(d0, p * 4) - lum(d0, (p + 1) * 4)) + Math.abs(lum(d0, p * 4) - lum(d0, (p + W) * 4));
          if (g > 14) edge[p] = 1;
        }
      const near = new Uint8Array(W * H);
      const R = 4;
      for (let y = R; y < H - R; y++)
        for (let x = R; x < W - R; x++) {
          if (!edge[y * W + x]) continue;
          for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) near[(y + dy) * W + x + dx] = 1;
        }
      const flick = new Uint8Array(W * H);
      let count = 0;
      const limit = Number(window.__thresh ?? 10);
      for (let p = 0; p < W * H; p++) {
        if (range[p] <= limit || near[p]) continue;
        flick[p] = 1;
        count++;
      }
      // Clusters: 32-pixel cells holding enough of them, the heaviest first.
      const CELL = 32;
      const cells = new Map();
      for (let p = 0; p < W * H; p++)
        if (flick[p]) {
          const k = Math.floor(((p / W) | 0) / CELL) * 1000 + Math.floor((p % W) / CELL);
          cells.set(k, (cells.get(k) ?? 0) + 1);
        }
      const top = [...cells]
        .filter(([, n]) => n >= 40)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
      const r = window.__r3d;
      r.caster.layers.enableAll();
      const describe = (o) => {
        const path = [];
        for (let a = o; a && path.length < 4; a = a.parent) {
          const tags = Object.keys(a.userData).filter((k) => a.userData[k] === true);
          path.push(
            `${a.name || a.geometry?.type?.replace("Geometry", "") || a.type}${tags.length ? `{${tags.join(",")}}` : ""}`,
          );
        }
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        return `${path.join("<")} ${m?.type?.replace("Material", "") ?? ""}${m?.color ? ` #${m.color.getHexString()}` : ""}${m?.transparent ? " glass" : ""}${m?.map ? " tex" : ""}`;
      };
      const clusters = top.map(([k, n]) => {
        const cy = Math.floor(k / 1000) * CELL + CELL / 2;
        const cx = (k % 1000) * CELL + CELL / 2;
        const ndc = { x: (cx / W) * 2 - 1, y: -(cy / H) * 2 + 1 };
        r.caster.setFromCamera(ndc, r.rig.camera);
        const hit = r.caster
          .intersectObject(r.stage.scene, true)
          .find((h) => h.object.isMesh && h.object.visible);
        return {
          px: [Math.round(cx / 2), Math.round(cy / 2)],
          pixels: n,
          at: hit ? [hit.point.x, hit.point.y, hit.point.z].map((v) => +v.toFixed(2)) : null,
          normal: hit?.face
            ? [hit.face.normal.x, hit.face.normal.y, hit.face.normal.z].map((v) => +v.toFixed(2))
            : null,
          what: hit ? describe(hit.object) : "nothing",
        };
      });
      // An overlay: the first frame dimmed, flickering pixels red.
      const cv = new OffscreenCanvas(W / 2, H / 2);
      const g = cv.getContext("2d");
      const o = new ImageData(W, H);
      for (let p = 0; p < W * H; p++) {
        const f = flick[p];
        o.data[p * 4] = f ? 255 : d0[p * 4] / 3;
        o.data[p * 4 + 1] = f ? 30 : d0[p * 4 + 1] / 3;
        o.data[p * 4 + 2] = f ? 30 : d0[p * 4 + 2] / 3;
        o.data[p * 4 + 3] = 255;
      }
      const full = new OffscreenCanvas(W, H);
      full.getContext("2d").putImageData(o, 0, 0);
      g.drawImage(full, 0, 0, W / 2, H / 2);
      const blob = await cv.convertToBlob({ type: "image/png" });
      const buf = new Uint8Array(await blob.arrayBuffer());
      let s = "";
      for (const b of buf) s += String.fromCharCode(b);
      return { count, clusters, overlay: btoa(s) };
    }, shots);
    if (process.env.OUT) {
      mkdirSync(process.env.OUT, { recursive: true });
      writeFileSync(`${process.env.OUT}/${target}-${turn}.png`, Buffer.from(res.overlay, "base64"));
    }
    out.push({ turn, count: res.count, clusters: res.clusters });
  }
  results[target] = out;
  console.log(`\n== ${target}: flickering pixels per turn ${out.map((o) => o.count).join(" ")}`);
  for (const o of out)
    for (const c of o.clusters.slice(0, 3))
      console.log(
        `  turn ${o.turn} at screen ${c.px.join(",")}: ${c.pixels}px · ${c.what} · world ${c.at?.join(",")} n ${c.normal?.join(",")}`,
      );
}
if (process.env.JSON) writeFileSync(process.env.JSON, JSON.stringify(results, null, 1));
await browser.close();
process.exit(0);
