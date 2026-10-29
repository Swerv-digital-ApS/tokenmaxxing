/**
 * Street-life models for the 3D town (2D: `art/cop.ts`, `art/cart.ts`, `art/picnic.ts`, `art/street.ts`): Officer
 * 429's light bar and notepad, the roaming merchant's cart and signpost, the picnic blanket and basket, touched grass,
 * the build snail and its goal flag, the paperboy's bike and paper, the graveyard's tombstones. `town-events.ts` and `cop3d.ts` use them;
 * `FX_ASSETS` lists them for the catalogue.
 */

import * as THREE from "three";
import { light } from "../furniture/furniture.ts";
import { canvasTexture, glow, Model, painted, seeded, ticks, toon, type V3 } from "../kit/kit.ts";
import type { Avatar } from "../people/avatar.ts";
import { car } from "./props.ts";

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// MARK: Models

const ink = "#2b2433";

/** Officer 429's cap, badge, belt, notepad and siren, put on an `Avatar`. Returns the siren's parts. */
export function dressCop(a: Avatar) {
  // The voxel officer already has the cap, buttons and badge; this adds the light bar on top and the notepad.
  const cap = a.head.part([0, 0.4, 0]);
  cap.scale.setScalar(0.7);
  cap.box([0.2, 0.05, 0.07], ink, [0, 0.04, 0], 0.015);
  const red = new THREE.MeshBasicMaterial({ color: "#ff4a4a" });
  const blue = new THREE.MeshBasicMaterial({ color: "#4a9bff" });
  const l = cap.box([0.085, 0.06, 0.06], red, [-0.052, 0.08, 0], 0.01);
  const r = cap.box([0.085, 0.06, 0.06], blue, [0.052, 0.08, 0], 0.01);
  const b = a.body;
  const pad = new Model();
  pad.box([0.13, 0.17, 0.02], "#fbf7ef", [0, 0, 0], 0.01);
  pad.box([0.1, 0.01, 0.005], "#8fb3d9", [0, 0.06, 0.012]);
  pad.box([0.1, 0.01, 0.005], "#8fb3d9", [0, 0.1, 0.012]);
  pad.position.set(0.1, 0.55, 0.2);
  pad.rotation.x = -0.4;
  pad.visible = false;
  b.add(pad);
  const pencil = new Model();
  pencil.box([0.012, 0.11, 0.012], "#f0b53c", [0, 0, 0]);
  pencil.box([0.012, 0.02, 0.012], "#f19a8b", [0, 0.11, 0]);
  pencil.visible = false;
  b.add(pencil);
  return { red, blue, l, r, pad, pencil };
}

/** A gingham picnic blanket `w`×`d`, red or blue. */
export function blanketModel(w: number, d: number, i: number): Model {
  const [main, mix] = i % 2 ? ["#6f7fc9", "#b3bde6"] : ["#e2443a", "#ec9c8f"];
  const tex = canvasTexture(8, 8, (g) => {
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        const a = Math.floor(x / 2) % 2 === 0;
        const b = Math.floor(y / 2) % 2 === 0;
        g.fillStyle = a && b ? main! : a || b ? mix! : "#fbf7ef";
        g.fillRect(x, y, 1, 1);
      }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(w * 1.5, d * 1.5);
  const m = new Model();
  m.box([w, 0.03, d], painted(tex), [0, 0, 0], 0.008);
  // A plate of sandwiches and a cup of juice, in a front corner where nobody sits.
  const sx = i % 2 ? -1 : 1;
  m.cyl(0.13, 0.02, "#e8e4da", [sx * (w / 2 - 0.35), 0.03, d / 2 - 0.3], 0.13, 14);
  for (const o of [-0.05, 0.05]) {
    m.box([0.09, 0.012, 0.09], "#e6cc98", [sx * (w / 2 - 0.35) + o, 0.05, d / 2 - 0.3]);
    m.box([0.09, 0.01, 0.09], "#a5d977", [sx * (w / 2 - 0.35) + o, 0.062, d / 2 - 0.3]);
    m.box([0.09, 0.012, 0.09], "#cfae73", [sx * (w / 2 - 0.35) + o, 0.072, d / 2 - 0.3]);
  }
  m.cyl(0.04, 0.1, "#fbf7ef", [sx * (w / 2 - 0.7), 0.03, d / 2 - 0.3], 0.036, 10);
  m.cyl(0.036, 0.04, "#f0a53c", [sx * (w / 2 - 0.7), 0.09, d / 2 - 0.3], 0.036, 10);
  return m;
}

export function basketModel(): Model {
  const m = new Model();
  m.box([0.42, 0.26, 0.3], "#c9a36a", [0, 0, 0], 0.04);
  for (const y of [0.06, 0.14, 0.22]) m.box([0.43, 0.012, 0.31], "#a87648", [0, y, 0]);
  m.box([0.34, 0.03, 0.22], "#fbf7ef", [0, 0.26, 0]);
  m.box([0.05, 0.05, 0.05], "#e2443a", [-0.08, 0.28, 0.03]);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.015, 6, 12, Math.PI), toon("#a87648"));
  handle.position.set(0, 0.26, 0);
  handle.rotation.y = Math.PI / 2;
  m.add(handle);
  const baguette = m.cyl(0.035, 0.34, "#cfae73", [0.1, 0.24, 0], 0.035, 8);
  baguette.rotation.z = -0.3;
  return m;
}

const PENNANT = ["#e2443a", "#f5d14a", "#6f7fc9", "#a5d977", "#fbf7ef", "#f2a6c8"];

/** A string of bunting from `a` to `b`, sagging in the middle, a pennant every ~0.35. */
export function buntingModel(a: V3, b: V3, sag = 0.3): THREE.Group {
  const g = new THREE.Group();
  const A = v3(...a);
  const B = v3(...b);
  const len = A.distanceTo(B);
  const at = (f: number) =>
    A.clone()
      .lerp(B, f)
      .add(v3(0, -4 * sag * f * (1 - f), 0));
  const segs = Math.max(6, Math.round(len * 3));
  const cord = toon("#5e3d28");
  const seg = new THREE.BoxGeometry(1, 0.02, 0.02);
  for (let i = 0; i < segs; i++) {
    const p = at(i / segs);
    const q = at((i + 1) / segs);
    const m = new THREE.Mesh(seg, cord);
    m.position.copy(p.clone().add(q).multiplyScalar(0.5));
    m.scale.x = p.distanceTo(q);
    m.rotation.z = Math.atan2(q.y - p.y, Math.hypot(q.x - p.x, q.z - p.z));
    m.rotation.y = -Math.atan2(q.z - p.z, q.x - p.x);
    m.rotation.order = "YXZ";
    g.add(m);
  }
  const tri = new THREE.Shape();
  tri.moveTo(-0.1, 0);
  tri.lineTo(0.1, 0);
  tri.lineTo(0, -0.26);
  const geo = new THREE.ShapeGeometry(tri);
  const flags: THREE.Mesh[] = [];
  const n = Math.max(2, Math.round(len / 0.36));
  const dir = Math.atan2(B.x - A.x, B.z - A.z) - Math.PI / 2;
  for (let i = 1; i < n; i++) {
    const mat = new THREE.MeshToonMaterial({
      color: PENNANT[i % PENNANT.length]!,
      side: THREE.DoubleSide,
      gradientMap: toon("#fff").gradientMap,
    });
    const f = new THREE.Mesh(geo, mat);
    f.position.copy(at(i / n));
    f.rotation.y = dir + Math.PI / 2;
    f.castShadow = true;
    flags.push(f);
    g.add(f);
  }
  ticks.push((t) =>
    flags.forEach((f, i) => {
      f.rotation.x = Math.sin(t * 2.2 + i * 1.3) * 0.12;
    }),
  );
  return g;
}

/** A patch of grass that comes with the "Touched grass" badge: turf, tufts and a few daisies. */
export function grassPatch(): Model {
  const m = new Model();
  m.box([1.4, 0.08, 1.0], "#6cbf4e", [0, 0, 0], 0.04);
  const rnd = seeded(77);
  for (let i = 0; i < 26; i++) {
    const x = (rnd() - 0.5) * 1.25;
    const z = (rnd() - 0.5) * 0.85;
    m.cyl(0.03, 0.16 + rnd() * 0.1, rnd() < 0.5 ? "#4fa544" : "#86c35e", [x, 0.06, z], 0.004, 4);
  }
  for (const [x, z] of [
    [-0.4, 0.1],
    [0.3, -0.2],
    [0.1, 0.3],
  ] as const) {
    m.cyl(0.012, 0.18, "#4fa544", [x, 0.06, z], 0.012, 4);
    m.ball(0.05, "#fbf7ef", [x, 0.27, z], [1, 0.5, 1], 8);
    m.ball(0.025, "#f5d14a", [x, 0.29, z], [1, 0.6, 1], 6);
  }
  return m;
}

const ALL_FLAT = (s: THREE.Group) =>
  s.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = false;
  });

function gingham(c: string): THREE.CanvasTexture {
  return canvasTexture(
    16,
    4,
    (g) => {
      for (let x = 0; x < 16; x++) {
        g.fillStyle = Math.floor(x / 2) % 2 ? "#fbf7ef" : c;
        g.fillRect(x, 0, 1, 4);
      }
    },
    false,
  );
}

/** The traveling merchant's wagon: striped awning, curtain, goods on the counter, an LTD board, a lantern. Faces +z. */
export function merchantCart(goods: readonly string[] = ["#c9b6ff", "#f5d14a", "#8fe3ff", "#ff7ab6"]): {
  model: Model;
  flame: THREE.Mesh;
  halo: THREE.Mesh;
} {
  const m = new Model();
  const W = 1.9;
  const D = 0.95;
  // The wheels, on the sides.
  for (const s of [-1, 1]) {
    const wheel = m.part([s * (W / 2 + 0.05), 0.3, 0.05]);
    const rim = wheel.cyl(0.3, 0.07, "#5e3d28", [0, -0.035, 0], 0.3, 18);
    rim.rotation.z = Math.PI / 2;
    const hub = wheel.cyl(0.12, 0.1, "#2b2433", [0, -0.05, 0], 0.12, 10);
    hub.rotation.z = Math.PI / 2;
    for (let i = 0; i < 4; i++) {
      const sp = wheel.box([0.035, 0.54, 0.03], "#a87648", [0, -0.27, 0], 0.005);
      const pivot = new THREE.Group();
      wheel.add(pivot);
      pivot.add(sp);
      pivot.rotation.x = (i * Math.PI) / 4;
    }
  }
  // Body: a wooden box with a lid line, the board on the front.
  m.box([W, 0.5, D], "#a87648", [0, 0.22, 0], 0.03);
  m.box([W + 0.06, 0.06, D + 0.06], "#c9a36a", [0, 0.72, 0], 0.02);
  for (const y of [0.34, 0.5]) m.box([W + 0.01, 0.02, D + 0.01], "#8a5f38", [0, y, 0]);
  const board = canvasTexture(
    60,
    28,
    (g) => {
      g.fillStyle = ink;
      g.fillRect(0, 0, 60, 28);
      g.fillStyle = "#5e3d28";
      g.fillRect(2, 2, 56, 24);
      g.fillStyle = "#f5d14a";
      g.font = "900 18px system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("LTD", 30, 15);
    },
    true,
  );
  m.plane(0.62, 0.3, glow("#fff", board), [0, 0.47, D / 2 + 0.012]);
  // Posts, curtain and awning.
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      m.cyl(0.035, 1.12, "#5e3d28", [sx * (W / 2 - 0.05), 0.75, sz * (D / 2 - 0.05)], 0.035, 8);
  m.box([W - 0.1, 0.95, 0.04], "#4b3f7a", [0, 0.75, -D / 2 + 0.05], 0.01);
  for (let x = -0.8; x <= 0.81; x += 0.2) m.box([0.025, 0.9, 0.05], "#6a5aa8", [x, 0.78, -D / 2 + 0.06]);
  const stripes = gingham("#e2443a");
  stripes.wrapS = THREE.RepeatWrapping;
  stripes.repeat.set(2, 1);
  const awn = m.box([W + 0.3, 0.06, D + 0.35], painted(stripes), [0, 1.86, 0.08], 0.01);
  awn.rotation.x = 0.1;
  const val = canvasTexture(
    32,
    6,
    (g) => {
      for (let i = 0; i < 8; i++) {
        g.fillStyle = i % 2 ? "#fbf7ef" : "#e2443a";
        g.fillRect(i * 4, 0, 4, 4);
        g.fillRect(i * 4 + 1, 4, 2, 1);
        g.fillRect(i * 4 + 1, 4, 2, 2);
      }
    },
    false,
  );
  const front = new THREE.Mesh(
    new THREE.PlaneGeometry(W + 0.3, 0.24),
    new THREE.MeshToonMaterial({
      map: val,
      transparent: true,
      alphaTest: 0.5,
      gradientMap: toon("#fff").gradientMap,
    }),
  );
  front.position.set(0, 1.72, D / 2 + 0.26);
  front.castShadow = true;
  m.add(front);
  // Bunting across the curtain.
  const bunt = buntingModel([-W / 2 + 0.1, 1.55, -D / 2 + 0.12], [W / 2 - 0.1, 1.55, -D / 2 + 0.12], 0.12);
  ALL_FLAT(bunt);
  m.add(bunt);
  // Goods on the counter.
  const shelf = [
    () =>
      m.box([0.2, 0.05, 0.14], goods[0]!, [-0.7, 0.75, 0.05], 0.01) &&
      m.box([0.17, 0.05, 0.12], "#fbf7ef", [-0.7, 0.8, 0.05], 0.01),
    () =>
      m.cyl(0.1, 0.06, goods[1]!, [-0.25, 0.75, 0.05], 0.1, 12) &&
      m.cyl(0.06, 0.1, goods[1]!, [-0.25, 0.81, 0.05], 0.03, 12),
    () => m.cyl(0.05, 0.2, goods[2]!, [0.2, 0.75, 0.05], 0.05, 10),
    () => m.ball(0.09, goods[3]!, [0.65, 0.84, 0.05]),
  ];
  for (const f of shelf) f();
  // The lantern on the right post.
  const post = m.part([W / 2 - 0.05, 1.3, D / 2 - 0.05]);
  post.box([0.02, 0.1, 0.02], ink, [0, 0.0, 0]);
  post.box([0.14, 0.02, 0.14], ink, [0, -0.2, 0], 0.005);
  const flame = post.box([0.09, 0.14, 0.09], glow("#ffe28a"), [0, -0.19, 0], 0.02);
  post.box([0.15, 0.02, 0.15], ink, [0, -0.06, 0], 0.005);
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 14, 10),
    new THREE.MeshBasicMaterial({
      color: "#ffe28a",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  halo.position.set(W / 2 - 0.05, 1.2, D / 2 - 0.05);
  m.add(halo);
  light(m, [W / 2 - 0.05, 1.2, D / 2 - 0.05], "#ffd27a", 3, 5);
  return { model: m, flame, halo };
}

/** The pitch while the cart is away: a little signpost with a cart on it. */
export function signpost(): Model {
  const m = new Model();
  m.cyl(0.04, 1.0, "#5e3d28", [0, 0, 0], 0.04, 8);
  const tex = canvasTexture(
    32,
    20,
    (g) => {
      g.fillStyle = ink;
      g.fillRect(0, 0, 32, 20);
      g.fillStyle = "#c9a36a";
      g.fillRect(1, 1, 30, 18);
      g.fillStyle = "#e2443a";
      g.fillRect(8, 5, 16, 4);
      g.fillStyle = "#5e3d28";
      g.fillRect(9, 9, 14, 5);
      g.fillStyle = ink;
      g.fillRect(10, 14, 3, 3);
      g.fillRect(19, 14, 3, 3);
    },
    false,
  );
  m.box([0.7, 0.4, 0.05], "#5e3d28", [0, 0.7, 0], 0.02);
  m.plane(0.62, 0.34, painted(tex), [0, 0.9, 0.03]);
  return m;
}

/** The build snail, facing +x, with a sign stick out of its shell. */
export function snailModel(): { model: Model; body: Model; sign: Model } {
  const m = new Model();
  const body = m.part();
  body.ball(0.13, "#b9c7a3", [0.02, 0.1, 0], [2.3, 0.55, 0.9]);
  body.ball(0.09, "#b9c7a3", [0.3, 0.16, 0], [1, 1.1, 0.9]);
  for (const z of [-0.04, 0.04]) {
    body.cyl(0.008, 0.12, "#b9c7a3", [0.34, 0.22, z], 0.008, 4);
    body.ball(0.022, ink, [0.34, 0.35, z]);
  }
  const shell = body.part([-0.05, 0.22, 0]);
  shell.ball(0.17, "#d98b45", [0, 0.05, 0], [1, 1, 0.9], 12);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 6, 14), toon("#f3c27a"));
  ring.position.set(0, 0.05, 0.14);
  shell.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.02, 6, 12), toon("#f3c27a"));
  ring2.position.set(0, 0.05, 0.16);
  shell.add(ring2);
  const sign = m.part([-0.05, 0.38, 0]);
  sign.cyl(0.012, 0.4, "#5e3d28", [0, 0, 0], 0.012, 5);
  return { model: m, body, sign };
}

/** The goal flag at the end of the snail's run: chequered, on a pole. */
export function goalFlag(): Model {
  const m = new Model();
  m.cyl(0.03, 1.5, "#cfd3da", [0, 0, 0], 0.03, 8);
  m.ball(0.05, "#cfd3da", [0, 1.5, 0]);
  const flag = m.part([0.28, 1.2, 0]);
  const tex = canvasTexture(8, 6, (g) => {
    for (let y = 0; y < 6; y++)
      for (let x = 0; x < 8; x++) {
        g.fillStyle = (x + y) % 2 ? ink : "#fbf7ef";
        g.fillRect(x, y, 1, 1);
      }
  });
  const cloth = new THREE.Mesh(
    new THREE.PlaneGeometry(0.52, 0.36),
    new THREE.MeshToonMaterial({ map: tex, side: THREE.DoubleSide, gradientMap: toon("#fff").gradientMap }),
  );
  cloth.castShadow = true;
  flag.add(cloth);
  ticks.push((t) => {
    cloth.rotation.y = Math.sin(t * 2.4) * 0.25;
  });
  return m;
}

export function bikeModel(): { model: Model; wheels: THREE.Object3D[] } {
  const m = new Model();
  const wheels: THREE.Object3D[] = [];
  for (const x of [-0.34, 0.34]) {
    const w = new THREE.Group();
    w.position.set(x, 0.22, 0);
    const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 20), toon(ink));
    tyre.castShadow = true;
    w.add(tyre);
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.012, 0.012), toon("#cfd3da"));
    w.add(spoke);
    const spoke2 = spoke.clone();
    spoke2.rotation.z = Math.PI / 2;
    w.add(spoke2);
    // The wheels turn about z: the bike is seen side-on.
    m.add(w);
    wheels.push(w);
  }
  const red = "#d8343c";
  const bar = (a: V3, b: V3, c = red) => {
    const A = v3(...a);
    const B = v3(...b);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(A.distanceTo(B), 0.03, 0.03), toon(c));
    mesh.position.copy(A.clone().add(B).multiplyScalar(0.5));
    mesh.rotation.z = Math.atan2(B.y - A.y, B.x - A.x);
    mesh.castShadow = true;
    m.add(mesh);
  };
  bar([-0.34, 0.22, 0], [-0.04, 0.22, 0]);
  bar([-0.04, 0.22, 0], [-0.12, 0.5, 0]);
  bar([-0.12, 0.5, 0], [0.26, 0.48, 0]);
  bar([0.26, 0.48, 0], [0.34, 0.22, 0]);
  bar([-0.04, 0.22, 0], [0.26, 0.48, 0]);
  bar([0.26, 0.48, 0], [0.22, 0.62, 0], "#cfd3da");
  m.box([0.04, 0.03, 0.28], "#cfd3da", [0.22, 0.62, 0], 0.01);
  m.box([0.18, 0.04, 0.1], ink, [-0.14, 0.52, 0], 0.02);
  // Sack of papers on the rack.
  m.box([0.16, 0.2, 0.2], "#c9b48a", [-0.42, 0.34, 0.14], 0.04);
  m.box([0.1, 0.06, 0.1], "#fbf7ef", [-0.42, 0.54, 0.14], 0.01);
  return { model: m, wheels };
}

/** A rolled paper held with a red rubber band. */
export function paperModel(): Model {
  const m = new Model();
  const roll = m.cyl(0.05, 0.3, "#fbf7ef", [0, 0.05, 0], 0.05, 10);
  roll.rotation.z = Math.PI / 2;
  roll.position.x = -0.15;
  m.cyl(0.056, 0.05, "#d8343c", [0, 0.05, 0], 0.056, 10).rotation.z = Math.PI / 2;
  m.box([0.1, 0.012, 0.05], "#8a8d99", [-0.1, 0.1, 0]);
  return m;
}

// MARK: The launch stand

/** The rainbow awning's stripes, when more than one provider has something out (2D: `art/launch.ts`). */
const RAINBOW = ["#e8434b", "#f28c28", "#f5d14a", "#58b36a", "#3f89c9", "#8e63d8"];

/**
 * The launch stand (`game/launch.ts`) on its two by two tiles: a counter with a NEW board, four posts and
 * a striped awning in the provider's colour and white, or every colour of the rainbow (`accent` null) when
 * several providers have something out. Its front faces +z.
 */
export function launchStand(accent: string | null): Model {
  const m = new Model();
  const W = 1.7;
  const D = 1.1;
  const colour = (i: number) => accent ?? RAINBOW[i % RAINBOW.length]!;
  // The counter, at the front, with a band in the stand's colours.
  m.box([W, 0.8, 0.6], "#a87648", [0, 0.4, D / 2 - 0.3], 0.03);
  m.box([W + 0.08, 0.06, 0.7], "#c9a36a", [0, 0.83, D / 2 - 0.3], 0.02);
  const band = canvasTexture(
    24,
    2,
    (g) => {
      for (let i = 0; i < 6; i++) {
        g.fillStyle = colour(i);
        g.fillRect(i * 4, 0, 4, 2);
      }
    },
    false,
  );
  m.plane(W, 0.1, glow("#fff", band), [0, 0.72, D / 2 + 0.011]);
  // The NEW board, with a star.
  const board = canvasTexture(
    64,
    28,
    (g) => {
      g.fillStyle = ink;
      g.fillRect(0, 0, 64, 28);
      g.fillStyle = "#fbf7ef";
      g.fillRect(2, 2, 60, 24);
      g.fillStyle = "#f5c84a";
      g.font = "900 13px system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("★", 10, 15);
      g.fillText("★", 54, 15);
      g.fillStyle = ink;
      g.font = "900 15px system-ui, sans-serif";
      g.fillText("NEW", 32, 15);
    },
    true,
  );
  m.plane(0.72, 0.32, glow("#fff", board), [0, 0.4, D / 2 + 0.012]);
  // Four posts.
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      m.cyl(0.035, 1.6, "#5e3d28", [sx * (W / 2 - 0.05), 0.8, sz * (D / 2 - 0.05)], 0.035, 8);
  // The awning: stripes, and a scalloped valance along the front.
  const stripes = canvasTexture(
    48,
    4,
    (g) => {
      for (let i = 0; i < 12; i++) {
        g.fillStyle = accent ? (i % 2 ? "#fbf7ef" : accent) : colour(i);
        g.fillRect(i * 4, 0, 4, 4);
      }
    },
    false,
  );
  const awn = m.box([W + 0.3, 0.06, D + 0.3], painted(stripes), [0, 1.66, 0.05], 0.01);
  awn.rotation.x = 0.1;
  const val = canvasTexture(
    48,
    6,
    (g) => {
      for (let i = 0; i < 12; i++) {
        g.fillStyle = accent ? (i % 2 ? "#fbf7ef" : accent) : colour(i);
        g.fillRect(i * 4, 0, 4, 4);
        g.fillRect(i * 4 + 1, 4, 2, 2);
      }
    },
    false,
  );
  const front = new THREE.Mesh(
    new THREE.PlaneGeometry(W + 0.3, 0.22),
    new THREE.MeshToonMaterial({
      map: val,
      transparent: true,
      alphaTest: 0.5,
      gradientMap: toon("#fff").gradientMap,
    }),
  );
  front.position.set(0, 1.52, D / 2 + 0.22);
  front.castShadow = true;
  m.add(front);
  // A stack of pamphlets on the counter.
  for (let i = 0; i < 3; i++)
    m.box([0.22, 0.015, 0.16], i % 2 ? "#fbf7ef" : colour(i), [0.55, 0.875 + i * 0.016, D / 2 - 0.3], 0.004);
  return m;
}

/** The pamphlet the presenter flicks you: a folded sheet. */
export function pamphletModel(): Model {
  const m = new Model();
  m.box([0.22, 0.02, 0.16], "#fbf7ef", [0, 0, 0], 0.004);
  m.box([0.22, 0.021, 0.04], "#e8434b", [0, 0.001, -0.05], 0.004);
  return m;
}

// MARK: The model graveyard

/**
 * A tombstone in the model graveyard (`game/graveyard.ts`; 2D: `art/graveyard.ts`): a stepped grey
 * headstone with RIP carved in its face, on a mound of earth with flowers in its maker's colour. Its
 * front faces +z.
 */
export function tombstoneModel(accent: string): Model {
  const m = new Model();
  const stone = "#aeaaa5";
  m.box([0.84, 0.05, 0.62], "#6b4a33", [0, 0, 0.08], 0.02);
  m.box([0.7, 0.08, 0.22], "#8a8682", [0, 0.04, -0.06], 0.01);
  m.box([0.56, 0.5, 0.14], stone, [0, 0.1, -0.06], 0.02);
  m.box([0.46, 0.08, 0.14], stone, [0, 0.6, -0.06], 0.02);
  m.box([0.3, 0.06, 0.14], stone, [0, 0.68, -0.06], 0.02);
  const face = canvasTexture(
    32,
    32,
    (g) => {
      g.fillStyle = stone;
      g.fillRect(0, 0, 32, 32);
      g.fillStyle = ink;
      g.font = "900 11px system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("RIP", 16, 11);
      g.fillStyle = "#8a8682";
      g.fillRect(7, 21, 18, 2);
      g.fillRect(10, 26, 12, 2);
    },
    true,
  );
  m.plane(0.46, 0.42, painted(face), [0, 0.38, 0.011]);
  // Flowers laid at its foot.
  for (const [x, z] of [
    [-0.26, 0.22],
    [0.22, 0.26],
    [0.02, 0.3],
  ] as const) {
    m.cyl(0.012, 0.12, "#3a7b2f", [x, 0.05, z], 0.012, 5);
    m.ball(0.045, accent, [x, 0.18, z]);
  }
  return m;
}

// MARK: Catalogue

const asset = (id: string, name: string, w: number, d: number, build: () => Model) => ({
  id,
  name,
  price: 0,
  w,
  d,
  build,
});

// MARK: The statue of the #1 model (`statue3d.ts`)

const STONE = "#aeaaa5";
const STONE_DARK = "#8a8682";
const STONE_LIGHT = "#cfccc7";
const MARBLE = "#ece7de";
const GOLD = "#e3b341";
const VELVET = "#8e1b2e";
/** The plinth's top, where the figure (and the drape) stand. */
export const STATUE_TOP = 0.92;

/** The plinth, its plaque in `accent`, and (unless `bare`) the figure. Faces +z, the camera's side. */
export function statueModel(accent: string, bare = false): Model {
  const m = new Model();
  m.box([0.96, 0.14, 0.96], STONE_DARK, [0, 0, 0], 0.02);
  m.box([0.74, 0.7, 0.74], STONE, [0, 0.14, 0], 0.02);
  // A band in the maker's colour under the cap.
  m.box([0.78, 0.1, 0.78], accent, [0, 0.72, 0], 0.01);
  m.box([0.86, 0.08, 0.86], STONE_LIGHT, [0, 0.84, 0], 0.02);
  const plate = canvasTexture(
    48,
    24,
    (g) => {
      g.fillStyle = GOLD;
      g.fillRect(0, 0, 48, 24);
      g.fillStyle = accent;
      g.fillRect(3, 3, 42, 18);
      g.fillStyle = "#fbf7ef";
      g.font = "900 14px system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("#1", 24, 13);
    },
    true,
  );
  m.plane(0.48, 0.24, glow("#fff", plate), [0, 0.38, 0.371]);
  if (bare) return m;
  // The figure: a robe belted in the maker's colour, shoulders, the head with a laurel, an arm holding a cup up.
  const fig = m.part([0, STATUE_TOP, 0]);
  fig.cyl(0.27, 0.6, MARBLE, [0, 0, 0], 0.17, 14);
  fig.cyl(0.22, 0.09, accent, [0, 0.25, 0], 0.205, 14);
  fig.box([0.46, 0.12, 0.26], MARBLE, [0, 0.56, 0], 0.05);
  fig.ball(0.16, MARBLE, [0, 0.82, 0]);
  fig.cyl(0.165, 0.05, GOLD, [0, 0.86, 0], 0.165, 14);
  fig.box([0.1, 0.4, 0.1], MARBLE, [0.25, 0.6, 0], 0.04);
  fig.cyl(0.05, 0.08, GOLD, [0.25, 1.0, 0], 0.03, 8);
  fig.cyl(0.07, 0.16, GOLD, [0.25, 1.08, 0], 0.12, 10);
  return m;
}

/** The velvet drape, tied with a gold cord: wider and taller than the figure, the cup it holds up included. */
export function drapeModel(): Model {
  const m = new Model();
  m.cyl(0.44, 1.3, VELVET, [0.04, 0, 0], 0.4, 14);
  m.ball(0.4, VELVET, [0.04, 1.3, 0], [1, 0.45, 1]);
  m.cyl(0.44, 0.05, GOLD, [0.04, 0.5, 0], 0.44, 14);
  return m;
}

/** The street-life pieces as assets, for the catalogue. */
export const FX_ASSETS = [
  asset("fx:merchant-cart", "Merchant cart", 2, 1, () => merchantCart().model),
  asset("fx:launch-stand", "Launch stand", 2, 2, () => launchStand("#d97757")),
  asset("fx:launch-stand-rainbow", "Launch stand (several providers)", 2, 2, () => launchStand(null)),
  asset("fx:statue", "Statue of the #1 model", 1, 1, () => statueModel("#d97757")),
  asset("fx:statue-draped", "Statue of the #1 model (draped)", 1, 1, () => {
    const m = statueModel("#9a6a3a", true);
    m.part([0, STATUE_TOP, 0]).add(drapeModel());
    return m;
  }),
  asset("fx:signpost", "Merchant signpost", 1, 1, signpost),
  asset("fx:picnic-blanket", "Picnic blanket", 3, 2, () => blanketModel(2.4, 1.5, 0)),
  asset("fx:picnic-basket", "Picnic basket", 1, 1, basketModel),
  asset("furn.g", "Touched grass", 2, 1, grassPatch),
  asset("fx:snail", "Build snail", 1, 1, () => snailModel().model),
  asset("fx:goal-flag", "Goal flag", 1, 1, goalFlag),
  asset("fx:paperboy-bike", "Paperboy's bike", 1, 1, () => bikeModel().model),
  asset("fx:paper", "Morning paper", 1, 1, paperModel),
  asset("fx:cop-car", "Patrol car", 2, 1, () => car("#2f4f9f")),
  asset("fx:tombstone", "Tombstone", 1, 1, () => tombstoneModel("#d97757")),
] as const;
