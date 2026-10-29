/**
 * The way out of every room, drawn one way so it reads at a glance. A door is a recessed frame in the wall with a
 * wooden leaf ajar on the light beyond (daylight outside, a lamp-lit hall inside), a brass handle, a lamp over the
 * lintel pooling on the floor, a mat on the threshold and a plate beside it. Stairs are stepped treads between
 * stringers with a handrail, a dark well in the wall and an arrow plate. Everything is static: nothing here ticks,
 * so the batching merges it.
 *
 * Doors stand on the wall tile they are in, their face at +z (into the room) and the mat on the tile in front.
 * Stairs stand on the tile the treads cover, the wall behind them at -z.
 */
import * as THREE from "three";
import { C } from "../../art/palette.ts";
import { canvasTexture, glow, Model, tint } from "../kit/kit.ts";

/** The lamp's warm pool on the floor: one texture for every exit. */
let poolTexture: THREE.CanvasTexture | null = null;
function poolMaterial(): THREE.MeshBasicMaterial {
  poolTexture ??= canvasTexture(
    32,
    32,
    (g) => {
      const r = g.createRadialGradient(16, 16, 2, 16, 16, 16);
      r.addColorStop(0, "rgba(255,255,255,0.9)");
      r.addColorStop(0.6, "rgba(255,255,255,0.3)");
      r.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = r;
      g.fillRect(0, 0, 32, 32);
    },
    true,
  );
  return new THREE.MeshBasicMaterial({
    map: poolTexture,
    color: "#ffd9a0",
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

const plates = new Map<string, THREE.MeshBasicMaterial>();
/**
 * A small sign plate: an arrow (`up`, `down`, `out`: forward) and a word, white on dark. One material per
 * text, so the atlas packs it once.
 */
function plateMaterial(text: string, arrow: "up" | "down" | "out" | null): THREE.MeshBasicMaterial {
  const key = `${arrow}:${text}`;
  let m = plates.get(key);
  if (m) return m;
  const W = 64;
  const H = 28;
  const tex = canvasTexture(W, H, (g) => {
    g.fillStyle = "#2b2433";
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#4a4057";
    g.fillRect(1, 1, W - 2, H - 2);
    g.fillStyle = "#2b2433";
    g.fillRect(2, 2, W - 4, H - 4);
    g.fillStyle = "#fbf7ef";
    let left = 6;
    if (arrow) {
      g.beginPath();
      if (arrow === "up") {
        g.moveTo(8, 20);
        g.lineTo(14, 8);
        g.lineTo(20, 20);
      } else if (arrow === "down") {
        g.moveTo(8, 8);
        g.lineTo(14, 20);
        g.lineTo(20, 8);
      } else {
        g.moveTo(8, 8);
        g.lineTo(20, 14);
        g.lineTo(8, 20);
      }
      g.closePath();
      g.fill();
      left = 25;
    }
    g.font = "bold 12px ui-monospace, Menlo, monospace";
    g.textBaseline = "middle";
    g.fillText(text.slice(0, 6), left, H / 2 + 1);
  });
  m = glow("#fff", tex);
  plates.set(key, m);
  return m;
}

/** The plate on a wall: its centre at `at`, facing +z. */
export function exitPlate(
  m: Model,
  text: string,
  arrow: "up" | "down" | "out" | null,
  at: [number, number, number],
): void {
  m.box([0.46, 0.2, 0.02], "#2b2433", [at[0], at[1] - 0.1, at[2] - 0.012], 0.004);
  m.plane(0.44, 0.19, plateMaterial(text, arrow), at);
}

/** A lamp over a lintel: the shade, the lit bulb and its pool on the floor in front. `at` is the shade's bottom centre. */
function lintelLamp(m: Model, at: [number, number, number], poolZ: number): void {
  m.box([0.34, 0.08, 0.2], C.metal, [at[0], at[1], at[2]], 0.01);
  m.box([0.26, 0.05, 0.14], glow("#ffe9b0"), [at[0], at[1] - 0.05, at[2] + 0.02], 0.004);
  const pool = m.plane(1.5, 1.1, poolMaterial(), [at[0], 0.045, poolZ]);
  pool.rotation.x = -Math.PI / 2;
  pool.receiveShadow = false;
}

export interface DoorwayOpts {
  /** The door opens on daylight (a way outside); else on a lamp-lit hall. */
  outside?: boolean;
  /** Draw the wall tile itself (tile-drawn rooms); a `Room` has a thin wall of its own. */
  block?: boolean;
  wall?: string;
  /** The leaf's wood, a shade lighter than the wall's trim so it stands out. */
  leaf?: string;
  /** The plate beside the door; null for none. */
  plate?: string | null;
}

/**
 * A door in a wall: standing on the wall tile, face at +z, the mat on the tile in front (z = 1). The leaf is ajar
 * into the room so the light beyond shows in the gap.
 */
export function exitDoorway(opts: DoorwayOpts = {}): Model {
  const m = new Model();
  const wall = opts.wall ?? C.wall;
  const trim = C.woodDark;
  const leafWood = opts.leaf ?? C.woodLight;
  if (opts.block) {
    m.box([1, 2.6, 1], wall, [0, 0, 0], 0);
    m.box([1.02, 0.1, 1.02], C.wallTop, [0, 2.6, 0], 0.01);
  }
  // The recess: dark returns round the opening, open at the back, and the light beyond as a plane facing the room
  // (daylight, or a hall with a lamp). An exit in the wall the camera cuts away is seen from behind: through the
  // open frame the leaf shows, so it is a door from either side.
  const dark = tint(wall, -0.45);
  // A little shallower than the frame (z 0.21 to 0.55), so their backs don't share a plane and flicker when the
  // wall is lowered and the doorway is seen from behind.
  for (const s of [-1, 1]) m.box([0.06, 2.08, 0.254], dark, [s * 0.42, 0, 0.367], 0.004);
  m.box([0.9, 0.06, 0.254], dark, [0, 2.02, 0.367], 0.004);
  const beyond = opts.outside ? "#bfe6ff" : "#fff1c9";
  m.plane(0.84, 2.02, glow(beyond), [0, 1.03, 0.505]);
  if (opts.outside) m.plane(0.84, 0.5, glow("#8fcff5"), [0, 1.74, 0.507]);
  // The frame through the wall: jambs, lintel, a step.
  for (const s of [-1, 1]) m.box([0.1, 2.12, 0.34], trim, [s * 0.47, 0, 0.38], 0.015);
  m.box([1.04, 0.12, 0.34], trim, [0, 2.12, 0.38], 0.015);
  m.box([0.94, 0.04, 0.2], tint(trim, -0.15), [0, 0, 0.5], 0.004);
  // The leaf, ajar on its left hinge into the room (not so far that it covers the threshold), panels and a brass handle.
  const leaf = m.part([-0.41, 0, 0.5], -0.5);
  leaf.box([0.8, 2.0, 0.05], leafWood, [0.4, 0.02, 0], 0.012);
  for (const y of [0.2, 1.12]) leaf.box([0.56, 0.72, 0.02], tint(leafWood, 0.1), [0.4, y, 0.03], 0.01);
  leaf.box([0.56, 0.03, 0.03], tint(leafWood, -0.25), [0.4, 0.98, 0.035], 0.004);
  leaf.ball(0.04, "#e9b73d", [0.7, 1.0, 0.06]);
  leaf.box([0.04, 0.16, 0.03], "#e9b73d", [0.7, 0.92, 0.05], 0.006);
  // The lamp over the lintel, the mat on the threshold, the plate beside.
  lintelLamp(m, [0, 2.32, 0.5], 1.0);
  m.box([0.84, 0.025, 0.56], C.rugLight, [0, 0, 1.0], 0.006);
  m.box([0.72, 0.03, 0.44], C.rug, [0, 0, 1.0], 0.006);
  if (opts.plate !== null) exitPlate(m, opts.plate ?? "EXIT", "out", [0.78, 1.82, 0.515]);
  return m;
}

export interface StairsOpts {
  /** Up: the flight climbs to a lit opening in the wall. Down: a hatch in the floor, the flight falling out through the wall. */
  dir: "up" | "down";
  /** Treads in the flight (up: 4 to 8; down: how many show past the wall). */
  steps?: number;
  /** Draw the wall tile behind the opening (tile-drawn rooms). */
  block?: boolean;
  wall?: string;
  /** The stringers, rails, posts and frame: the room's trim. */
  wood?: string;
  /** The treads: a lighter wood than the trim. */
  tread?: string;
  /** The plate on the lintel; null for none. */
  plate?: string | null;
  /** The lamp over the opening and its pool on the floor. */
  lamp?: boolean;
  /**
   * Up only. `front` (default): the flight climbs straight to the wall. `side`: it runs along the wall, rising
   * toward +x, with solid stepped stringers and the risers facing -x, for walls the camera looks over.
   */
  layout?: "front" | "side";
}

/** The flight of `buildStairs` running along the wall (up, `layout: "side"`): the foot at x -0.5, the landing at +0.5. */
function sideFlight(m: Model, o: { wood: string; tread: string; wall: string; plate: string }): void {
  const { wood, tread } = o;
  const n = 6;
  const run = 0.9 / n;
  const rise = 0.15;
  const w = 0.64; // how far into the room the flight reaches
  const zc = -0.5 + w / 2;
  const riser = tint(tread, -0.18);
  const xAt = (i: number) => -0.5 + run * (i + 0.5);
  for (let i = 0; i < n; i++) {
    const h = rise * (i + 1);
    // The riser is a hair narrower than the stringers either side of it (and than the step itself): flush with them, its
    // side faces and ends lay on exactly their planes and the two fought over every pixel (a hatched, shimmering side).
    m.box([run - 0.012, h, w - 0.012], riser, [xAt(i), 0, zc], 0.004);
    m.box(
      [run + 0.01, 0.035, w + 0.01],
      i % 2 ? tint(tread, 0.22) : tint(tread, 0.04),
      [xAt(i), h, zc],
      0.004,
    );
    // Solid stepped stringers on both faces, the wall side the one the camera sees.
    for (const z of [-0.5 + 0.035, -0.5 + w - 0.035])
      m.box([run, h + 0.1, 0.07], wood, [xAt(i), 0, z], 0.004);
  }
  // The open side's rail: four posts on the stringer, a rail along their tops, a cap on the first.
  const zr = -0.5 + w - 0.035;
  const post = (i: number): [number, number] => [xAt(i), rise * (i + 1) + 0.1 + 0.5];
  const posts = [0, 2, 3, 5];
  for (const i of posts) m.box([0.06, 0.52, 0.06], wood, [xAt(i), rise * (i + 1) + 0.09, zr], 0.008);
  const a = post(0);
  const b = post(5);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const rail = m.box([len, 0.06, 0.06], tint(wood, 0.12), [0, 0, 0], 0.01);
  rail.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]);
  rail.position.set((a[0] + b[0]) / 2 - 0.0, (a[1] + b[1]) / 2 - 0.03 + 0.03, zr);
  // The landing: a lit doorway in the wall above the top step, framed, with the plate on its lintel both ways. It is
  // its own part (`userData.doorway`): a room whose wall it is in hangs it on that wall (`Room.attachToWall`), so it is
  // lowered with the wall instead of standing on its own over the steps when the camera looks over that wall.
  const top = rise * n;
  const dx = 0.3;
  const door = m.part();
  door.userData.doorway = true;
  door.box([0.5, 0.7, 0.02], glow("#3b2d3d"), [dx, top, -0.49], 0);
  door.box([0.5, 0.6, 0.02], glow("#ffe3a8"), [dx, top + 0.7, -0.49], 0);
  for (const s of [-1, 1]) door.box([0.07, 1.42, 0.1], wood, [dx + s * 0.285, top, -0.45], 0.008);
  door.box([0.64, 0.24, 0.1], wood, [dx, top + 1.3, -0.45], 0.008);
  exitPlate(door, o.plate, "up", [dx, top + 1.42, -0.395]);
  const back = door.part([dx, top + 1.42, -0.5], Math.PI);
  exitPlate(back, o.plate, "up", [0, 0, 0.105]);
  lintelLamp(door, [dx, top + 1.56, -0.42], 0.3);
  // A mat across the front of the flight.
  m.box([0.9, 0.025, 0.3], C.rugLight, [0, 0, 0.34], 0.006);
  m.box([0.8, 0.03, 0.22], C.rug, [0, 0, 0.34], 0.006);
}

/**
 * Stairs between rooms, in one tile with the wall behind at -z (the foot of the flight at +z). Up: stepped
 * blocks with a lighter tread on each riser, stepped stringers either side, a handrail on a newel post at the
 * foot and another at the top, spindles between, and at the top a lit opening in the wall under a lintel with
 * the arrow plate. Down: a hatch in the floor with the rim, a dark well whose treads fade into the dark, the
 * rails and posts, and past the wall (where the camera cuts it away) the flight going down and out. Everything
 * is static boxes of a few shared colours, so the batching merges the lot.
 */
export function buildStairs(opts: StairsOpts): Model {
  const m = new Model();
  const dir = opts.dir;
  const wall = opts.wall ?? C.wall;
  const wood = opts.wood ?? C.woodDark;
  const tread = opts.tread ?? C.woodLight;
  const riser = tint(tread, -0.28);
  const lit = tint(tread, 0.1);
  const dark = tint(wood, -0.3);
  if (opts.block) {
    m.box([1, 2.6, 1], wall, [0, 0, -1], 0);
    m.box([1.02, 0.1, 1.02], C.wallTop, [0, 2.6, -1], 0.01);
  }
  if (dir === "up" && opts.layout === "side") {
    sideFlight(m, { wood, tread, wall, plate: opts.plate ?? "UP" });
    return m;
  }
  // The opening in the wall: a dark well with the jambs and a lintel carrying the plate.
  m.plane(0.92, 2.0, glow("#1c1620"), [0, 1.0, -0.49]);
  for (const s of [-1, 1]) m.box([0.09, 2.24, 0.12], wood, [s * 0.47, 0, -0.44], 0.012);
  m.box([1.04, 0.24, 0.12], wood, [0, 2.0, -0.44], 0.012);
  if (opts.plate !== null) {
    const text = opts.plate ?? (dir === "up" ? "UP" : "DOWN");
    exitPlate(m, text, dir, [0, 2.12, -0.371]);
    // And the same plate on the wall's far face, for a camera looking over the wall.
    exitPlate(m.part([0, 2.12, -0.5], Math.PI), text, dir, [0, 0, 0.13]);
  }
  if (opts.lamp !== false) lintelLamp(m, [0, 2.3, -0.42], dir === "up" ? 0.3 : 0.2);
  if (dir === "up") {
    const n = Math.max(4, Math.min(8, opts.steps ?? 6));
    const run = 0.86 / n;
    // Shallow enough that the camera looking over the wall still sees every tread top.
    const rise = 0.7 / n;
    const zAt = (i: number) => 0.5 - run * (i + 0.5);
    // The landing above is lit: the hall beyond the opening.
    m.plane(0.84, 1.2, glow("#ffe3a8"), [0, 1.3, -0.47]);
    for (let i = 0; i < n; i++) {
      const h = rise * (i + 1);
      const z = zAt(i);
      m.box([0.8, h, run], riser, [0, 0, z], 0.006);
      m.box([0.8, 0.035, run + 0.012], i % 2 ? lit : tint(tread, -0.1), [0, h, z], 0.006);
      for (const s of [-1, 1]) m.box([0.07, h + 0.08, run], wood, [s * 0.435, 0, z], 0.006);
    }
    // Rail: a post at the foot, a post at the top, the rail between, spindles under it.
    const topH = rise * n;
    const foot = { z: 0.44, y: rise + 0.62 };
    const top = { z: zAt(n - 1), y: topH + 0.62 };
    const slope = Math.atan2(top.y - foot.y, foot.z - top.z);
    const railAt = (z: number) => foot.y + ((foot.z - z) / (foot.z - top.z)) * (top.y - foot.y);
    for (const s of [-1, 1]) {
      const x = s * 0.435;
      m.cyl(0.035, foot.y - rise + 0.06, wood, [x, rise - 0.02, foot.z], 0.035, 6);
      m.box([0.08, 0.05, 0.08], tint(wood, 0.12), [x, foot.y + 0.04, foot.z], 0.01);
      m.cyl(0.03, top.y - topH + 0.04, wood, [x, topH - 0.02, top.z], 0.03, 6);
      const len = Math.hypot(top.y - foot.y, foot.z - top.z);
      const rail = m.box([0.055, 0.055, len], tint(wood, 0.1), [x, 0, 0], 0.01);
      rail.rotation.x = slope;
      rail.position.set(x, (foot.y + top.y) / 2 - 0.03, (foot.z + top.z) / 2);
      for (let i = 1; i < n - 1; i += 2) {
        const h = rise * (i + 1);
        m.cyl(0.014, railAt(zAt(i)) - h - 0.02, dark, [x, h, zAt(i)], 0.014, 5);
      }
    }
  } else {
    // The hatch: a rim of low boards, the well and its treads fading into the dark, posts with the rails.
    m.box([0.92, 0.03, 0.96], "#14101a", [0, 0, 0], 0.003);
    // Seen from over the wall: the stairwell's rim, the treads on the well's floor fading into the dark, and a
    // solid rail down each side on four posts. (Nothing hangs past the wall: there is no floor to hold it.)
    const k = Math.max(4, Math.min(8, opts.steps ?? 6));
    const run = 0.8 / k;
    for (let i = 0; i < k; i++) {
      const fade = 0.1 - i * (0.3 / k);
      const z = 0.4 - run * (i + 0.5);
      m.box([0.76, 0.06, run - 0.02], tint(i % 2 ? lit : tread, fade), [0, 0.02, z], 0.004);
      // The nosing: a lighter edge on each tread, so the flight reads as steps and not a striped floor.
      m.box([0.76, 0.02, 0.035], tint(lit, fade + 0.12), [0, 0.08, z + (run - 0.02) / 2 - 0.02], 0.004);
    }
    for (const s of [-1, 1]) {
      m.box([0.08, 0.12, 0.96], wood, [s * 0.46, 0, 0], 0.008);
      const x = s * 0.46;
      for (const z of [0.42, 0.14, -0.14, -0.4]) m.box([0.07, 0.62, 0.07], wood, [x, 0.12, z], 0.008);
      m.box([0.09, 0.06, 0.92], tint(wood, 0.12), [x, 0.74, 0], 0.01);
      m.box([0.1, 0.07, 0.1], tint(wood, 0.2), [x, 0.74, 0.42], 0.01);
    }
    m.box([0.92, 0.07, 0.07], wood, [0, 0, 0.465], 0.008);
  }
  return m;
}

/** Stairs up or down with the house look (`buildStairs`). */
export const exitStairs = (dir: "up" | "down", opts: Omit<StairsOpts, "dir"> = {}): Model =>
  buildStairs({ ...opts, dir });
