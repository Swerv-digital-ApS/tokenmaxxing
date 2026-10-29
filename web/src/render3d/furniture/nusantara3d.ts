/**
 * The Nusantara case's furniture in 3D (`NUSANTARA_PIECES` in core/src/case-nusantara-furniture.ts), the same pieces as
 * `furniture-home.ts` draws in 2D: a batik hanging, a sawah rug, a warung stool, an angkringan cart, a bonang rack and a
 * pinisi on its stand. Built like the rest of `furniture3d.ts`: bottom centre at the origin, front along +z. The batik
 * hanging hangs on a wall, so (as the Night Market's lantern string) it is built against the wall at its own height.
 * Daylight colours: teak, batik indigo and cream, hibiscus red, bronze, sea turquoise.
 */
import * as THREE from "three";
import { canvasTexture, glass, Model, painted, ticks, toon } from "../kit/kit.ts";

const TEAK = "#8a5a2b";
const TEAK_DARK = "#5a3a1c";
const TEAK_LIGHT = "#b07a42";
const TURQUOISE = "#1fb5b0";
const DEEP_SEA = "#0f6e86";
const SAFFRON = "#f2b632";
const HIBISCUS = "#d6343a";
const CREAM = "#f1e3c2";
const INDIGO = "#243a73";
const SOGA = "#6b4226";
const RICE = "#6fbf4a";
const LEAF = "#2f7f3a";
const BRONZE = "#b9803a";
const BRONZE_DARK = "#7a5224";
const BAMBOO = "#d2b55a";
const BAMBOO_DARK = "#a8873a";

/** A flat shape (a sail, a pennant) extruded a little, in `color`, standing in the x-y plane. */
function cutout(
  m: Model,
  pts: [number, number][],
  depth: number,
  color: string,
  at: [number, number, number],
) {
  const shape = new THREE.Shape();
  for (const [i, [x, y]] of pts.entries()) i ? shape.lineTo(x, y) : shape.moveTo(x, y);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  const o = new THREE.Mesh(geo, toon(color));
  o.position.set(...at);
  o.castShadow = o.receiveShadow = true;
  m.add(o);
  return o;
}

// MARK: Batik hanging

/** A length of batik on a bamboo pole: indigo, soga brown and cream, a lattice of kawung rings and diamonds. */
const batikHanging = (): Model => {
  const m = new Model();
  const W = 1.78;
  const H = 1.0;
  const top = 2.3;
  const tex = canvasTexture(
    89,
    50,
    (g) => {
      g.fillStyle = INDIGO;
      g.fillRect(0, 0, 89, 50);
      // The border: soga brown bands with a cream line.
      for (const y of [0, 46]) {
        g.fillStyle = SOGA;
        g.fillRect(0, y, 89, 4);
        g.fillStyle = CREAM;
        g.fillRect(0, y + (y ? 0 : 3), 89, 1);
      }
      for (const x of [0, 85]) {
        g.fillStyle = SOGA;
        g.fillRect(x, 0, 4, 50);
        g.fillStyle = CREAM;
        g.fillRect(x + (x ? 0 : 3), 0, 1, 50);
      }
      // The field: kawung, four overlapping ovals round a centre, repeated in offset rows.
      const kawung = (cx: number, cy: number) => {
        g.fillStyle = CREAM;
        for (const [dx, dy, rx, ry] of [
          [0, -3.4, 1.9, 3.4],
          [0, 3.4, 1.9, 3.4],
          [-3.4, 0, 3.4, 1.9],
          [3.4, 0, 3.4, 1.9],
        ] as const) {
          g.beginPath();
          g.ellipse(cx + dx, cy + dy, rx, ry, 0, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = SOGA;
        for (const [dx, dy, rx, ry] of [
          [0, -3.4, 0.9, 2.3],
          [0, 3.4, 0.9, 2.3],
          [-3.4, 0, 2.3, 0.9],
          [3.4, 0, 2.3, 0.9],
        ] as const) {
          g.beginPath();
          g.ellipse(cx + dx, cy + dy, rx, ry, 0, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = CREAM;
        g.fillRect(cx - 1, cy - 1, 2, 2);
      };
      for (let j = 0, y = 12; y < 46; j++, y += 12)
        for (let x = j % 2 ? 22 : 11; x < 82; x += 22) kawung(x, y);
      // A dot between the rings.
      g.fillStyle = SOGA;
      for (let j = 0, y = 6; y < 46; j++, y += 12)
        for (let x = j % 2 ? 11 : 22; x < 86; x += 22) g.fillRect(x - 1, y - 1, 2, 2);
    },
    false,
  );
  // The pole, its two finials and the loops of cloth it hangs from.
  m.box([W + 0.2, 0.05, 0.05], BAMBOO, [0, top, 0.05], 0.015);
  for (const s of [-1, 1]) m.ball(0.04, BAMBOO_DARK, [s * (W / 2 + 0.11), top + 0.025, 0.05], [1, 1, 1], 8);
  for (const x of [-0.7, -0.35, 0, 0.35, 0.7]) m.box([0.07, 0.1, 0.02], SOGA, [x, top - 0.09, 0.05], 0.004);
  const cloth = m.part([0, top - 0.04, 0.05]);
  cloth.box([W, H, 0.012], "#1a2a58", [0, -H, -0.006], 0.003);
  cloth.plane(W, H, painted(tex), [0, -H / 2, 0.002]);
  // A fringe of short cream threads along the hem.
  for (let i = 0; i < 18; i++)
    cloth.box([0.014, 0.05, 0.01], CREAM, [-W / 2 + 0.05 + i * ((W - 0.1) / 17), -H - 0.05, 0], 0.002);
  ticks.push((t) => {
    cloth.rotation.x = Math.sin(t * 0.9) * 0.012;
  });
  return m;
};

// MARK: Sawah rug

/** Rice terraces woven into a rug: stepped green bands with water-blue lines between them and one patient buffalo. */
const sawahRug = (): Model => {
  const m = new Model();
  const W = 1.9;
  const D = 0.92;
  m.box([W + 0.06, 0.016, D + 0.06], SOGA, [0, 0, 0], 0.005);
  m.box([W, 0.024, D], "#e6d5a8", [0, 0, 0], 0.005);
  const tex = canvasTexture(
    95,
    46,
    (g) => {
      g.fillStyle = "#cfe9a0";
      g.fillRect(0, 0, 95, 46);
      // Terraces climbing the slope: wavy bands of green, each with a thin line of water where it steps down.
      const bands = [LEAF, RICE, "#8bd25a", RICE, LEAF, "#8bd25a", RICE];
      for (let i = 0; i < bands.length; i++) {
        const y0 = 4 + i * 6;
        g.fillStyle = bands[i]!;
        g.beginPath();
        g.moveTo(0, y0 + 6);
        for (let x = 0; x <= 95; x += 5) g.lineTo(x, y0 + Math.sin(x * 0.12 + i * 1.7) * 1.6);
        g.lineTo(95, y0 + 6);
        g.closePath();
        g.fill();
        g.strokeStyle = "#5cc7d9";
        g.lineWidth = 1.2;
        g.beginPath();
        for (let x = 0; x <= 95; x += 5) {
          const y = y0 + Math.sin(x * 0.12 + i * 1.7) * 1.6 + 0.4;
          if (x) g.lineTo(x, y);
          else g.moveTo(x, y);
        }
        g.stroke();
      }
      // The rows of young rice: dark flecks along each band.
      g.fillStyle = "#1f6a2c";
      for (let i = 0; i < 7; i++)
        for (let x = 3 + (i % 2) * 2; x < 92; x += 4)
          g.fillRect(x, 8 + i * 6 + Math.sin(x * 0.12 + i * 1.7) * 1.6, 1, 1);
    },
    false,
  );
  m.plane(W - 0.12, D - 0.12, painted(tex), [0, 0.03, 0]).rotation.x = -Math.PI / 2;
  // The buffalo: a dark grey carabao with swept horns, standing in the low paddy (one patient animal).
  const b = m.part([0.46, 0.03, 0.12], -0.4);
  b.box([0.2, 0.09, 0.09], "#4a4f5c", [0, 0.05, 0], 0.03);
  for (const [x, z] of [
    [-0.07, -0.03],
    [0.07, -0.03],
    [-0.07, 0.03],
    [0.07, 0.03],
  ] as const)
    b.box([0.025, 0.05, 0.025], "#3a3e49", [x, 0, z], 0.005);
  b.ball(0.05, "#4a4f5c", [0.12, 0.12, 0], [1.1, 1, 0.9], 8);
  b.box([0.06, 0.04, 0.05], "#6a6f7c", [0.18, 0.1, 0], 0.012);
  for (const s of [-1, 1]) {
    b.box([0.07, 0.014, 0.014], CREAM, [0.1, 0.17, s * 0.045], 0.004).rotation.y = s * 0.3;
    b.box([0.014, 0.04, 0.014], CREAM, [0.07, 0.17, s * 0.075], 0.004);
  }
  b.box([0.02, 0.07, 0.016], "#3a3e49", [-0.11, 0.0, 0], 0.004);
  // A reed hat on a post: someone is somewhere near.
  m.cyl(0.07, 0.03, "#e8cd7e", [-0.55, 0.03, -0.1], 0.005, 12);
  return m;
};

// MARK: Warung stool

/** The low red plastic stool of every roadside warung, with a glass of tea set on it. */
const warungStool = (): Model => {
  const m = new Model();
  const RED = "#d8383d";
  // One moulded piece: four chunky, slightly splayed legs, a thick seat with a lip, and the dimples cut in it.
  for (const [x, z] of [
    [-0.12, -0.12],
    [0.12, -0.12],
    [-0.12, 0.12],
    [0.12, 0.12],
  ] as const)
    m.box([0.09, 0.28, 0.09], "#b72a30", [x * 1.1, 0.0, z * 1.1], 0.02);
  m.box([0.36, 0.04, 0.36], "#b72a30", [0, 0.2, 0], 0.012);
  m.box([0.42, 0.07, 0.42], RED, [0, 0.27, 0], 0.03);
  m.box([0.44, 0.02, 0.44], "#ec5a5e", [0, 0.34, 0], 0.012);
  for (const [x, z] of [
    [-0.12, -0.12],
    [0.12, -0.12],
    [-0.12, 0.12],
  ] as const)
    m.cyl(0.026, 0.004, "#8a1f24", [x, 0.358, z], 0.026, 8);
  // A tall glass of sweet tea with a spoon and a little steam.
  m.cyl(0.06, 0.17, glass("#e8f6fb", 0.45), [0.05, 0.36, 0.03], 0.07, 12);
  m.cyl(0.055, 0.13, "#b5651d", [0.05, 0.362, 0.03], 0.064, 12);
  const spoon = m.box([0.012, 0.2, 0.012], "#c9ced6", [0.075, 0.37, 0.045], 0.002);
  spoon.rotation.z = -0.14;
  const steam = [0, 1, 2].map(() => m.ball(0.018, "#ffffff", [0.05, 0.56, 0.03], [1, 1, 1], 5));
  ticks.push((t) =>
    steam.forEach((s, i) => {
      const u = (t * 0.45 + i / 3) % 1;
      s.position.set(0.05 + Math.sin(u * 6 + i) * 0.015, 0.56 + u * 0.16, 0.03);
      s.scale.setScalar(1 - u * 0.6);
    }),
  );
  return m;
};

// MARK: Angkringan cart

/** An angkringan: a wooden cart with a glass cabinet of fried snacks, a red tarp, a hanging lamp and a hissing kettle. */
const angkringanCart = (): Model => {
  const m = new Model();
  const W = 1.7;
  const D = 0.7;
  // Wheels at each end (a big spoked disc on an axle).
  for (const s of [-1, 1] as const) {
    const wh = m.part([s * (W / 2 + 0.03), 0.26, 0]);
    wh.cyl(0.26, 0.05, TEAK_DARK, [0, -0.025, 0], 0.26, 16).rotation.z = Math.PI / 2;
    wh.cyl(0.2, 0.062, TEAK, [0, -0.031, 0], 0.2, 16).rotation.z = Math.PI / 2;
    for (let i = 0; i < 4; i++) {
      const sp = wh.part([0, 0, 0]);
      sp.rotation.x = (i * Math.PI) / 4;
      sp.box([0.03, 0.46, 0.03], TEAK_LIGHT, [0, -0.23, 0], 0.005);
    }
    wh.cyl(0.07, 0.09, SAFFRON, [0, -0.045, 0], 0.07, 8).rotation.z = Math.PI / 2;
  }
  m.box([W, 0.06, D], TEAK_DARK, [0, 0.4, 0], 0.01);
  m.box([W - 0.04, 0.34, D - 0.04], TEAK, [0, 0.46, 0], 0.02);
  for (const x of [-0.5, 0, 0.5]) m.box([0.012, 0.28, 0.012], TEAK_DARK, [x, 0.5, D / 2 - 0.018], 0.002);
  m.box([W + 0.04, 0.04, D + 0.04], TEAK_LIGHT, [0, 0.8, 0], 0.01);
  // The glass cabinet: a teak frame, glass on three sides, two shelves of brown fried snacks in neat rows.
  const cab = m.part([-0.18, 0.82, 0]);
  const CW = 1.1;
  const CD = D - 0.1;
  const CH = 0.5;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      cab.box([0.04, CH, 0.04], TEAK_DARK, [sx * (CW / 2 - 0.02), 0, sz * (CD / 2 - 0.02)], 0.005);
  cab.box([CW, 0.04, CD], TEAK_DARK, [0, CH, 0], 0.005);
  cab.box([CW - 0.04, CH - 0.04, 0.008], glass("#d8f0f8", 0.12), [0, 0.02, CD / 2 - 0.01], 0.002);
  cab.box([CW - 0.04, CH - 0.04, 0.008], glass("#bfe6f2", 0.16), [0, 0.02, -CD / 2 + 0.01], 0.002);
  for (const s of [-1, 1])
    cab.box([0.008, CH - 0.04, CD - 0.04], glass("#bfe6f2", 0.2), [s * (CW / 2 - 0.01), 0.02, 0], 0.002);
  for (const sy of [0.0, 0.24]) {
    cab.box([CW - 0.06, 0.012, CD - 0.08], BAMBOO, [0, sy, 0], 0.003);
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 3; j++) {
        const shade = (i + j) % 3 === 0 ? "#a8631f" : (i + j) % 3 === 1 ? "#c98a3a" : "#8a4f1a";
        const o = cab.ball(0.035, shade, [-0.44 + i * 0.145, sy + 0.04, -0.14 + j * 0.14], [1.2, 0.8, 1], 6);
        o.rotation.y = i * 0.7 + j;
      }
    }
  }
  // The red tarp over the top, sloping to the front, with a white stripe and a scalloped edge.
  const tarp = m.box([W + 0.1, 0.02, D + 0.12], HIBISCUS, [-0.05, 1.46, 0.0], 0.006);
  tarp.rotation.x = 0.08;
  const stripe = m.box([W + 0.102, 0.022, 0.08], CREAM, [-0.05, 1.47, 0.12], 0.004);
  stripe.rotation.x = 0.08;
  m.box([W + 0.1, 0.1, 0.012], HIBISCUS, [-0.05, 1.37, D / 2 + 0.06], 0.004);
  for (const x of [-0.78, -0.4, 0, 0.4, 0.7])
    m.box([0.015, 0.6, 0.015], TEAK_DARK, [x, 0.84, -D / 2 + 0.03], 0.003);
  for (const s of [-1, 1])
    m.box([0.03, 0.56, 0.03], TEAK_DARK, [-0.18 + s * (CW / 2 - 0.02), 0.84, D / 2 - 0.04], 0.004);
  // A bulb on a cord under the tarp, warm in the daytime too.
  m.box([0.006, 0.12, 0.006], "#222", [0.5, 1.28, 0.2], 0.001);
  const bulb = m.ball(0.04, "#ffe9a8", [0.5, 1.24, 0.2], [1, 1.2, 1], 8);
  (bulb.material as THREE.MeshToonMaterial).emissive = new THREE.Color("#ffd36a");
  // The kettle on a charcoal stove at the right end: a big aluminium kettle, hissing steam, two frames of it.
  m.box([0.34, 0.2, 0.3], "#3a3a40", [0.6, 0.84, -0.02], 0.02);
  m.box([0.3, 0.012, 0.26], "#e8591a", [0.6, 1.035, -0.02], 0.003);
  m.cyl(0.12, 0.2, "#c9ced6", [0.6, 1.04, -0.02], 0.1, 14);
  m.cyl(0.08, 0.04, "#aab0ba", [0.6, 1.24, -0.02], 0.02, 12);
  m.box([0.03, 0.03, 0.03], "#3a3a40", [0.6, 1.275, -0.02], 0.008);
  const spout = m.box([0.03, 0.12, 0.03], "#c9ced6", [0.7, 1.13, -0.02], 0.006);
  spout.rotation.z = -0.9;
  const handle = m.box([0.2, 0.012, 0.012], "#3a3a40", [0.6, 1.3, -0.02], 0.003);
  handle.rotation.z = 0.0;
  const puffs = [0, 1, 2, 3].map(() => m.ball(0.022, "#ffffff", [0.76, 1.2, -0.02], [1, 1, 1], 6));
  ticks.push((t) =>
    puffs.forEach((p, i) => {
      // Two beats of steam, as the 2D frames: it steps up and thins out.
      const u = Math.floor(((t * 0.8 + i / 4) % 1) * 5) / 5;
      p.position.set(0.76 + u * 0.1 + Math.sin(i * 2) * 0.015, 1.2 + u * 0.34, -0.02);
      p.scale.setScalar(1.1 - u * 0.7);
    }),
  );
  // Glasses and a thermos on the near ledge, a hanging bundle of snack packs at the cart's end.
  for (const x of [0.38, 0.5, 0.62])
    m.cyl(0.03, 0.07, glass("#e8f6fb", 0.5), [x - 0.85, 0.84, D / 2 - 0.12], 0.034, 8);
  for (const [i, c] of [HIBISCUS, SAFFRON, TURQUOISE, CREAM].entries())
    m.box([0.05, 0.08, 0.012], c, [-0.8 + i * 0.07, 1.1, D / 2 + 0.05], 0.003);
  m.box([0.34, 0.01, 0.01], TEAK_DARK, [-0.72, 1.16, D / 2 + 0.05], 0.002);
  return m;
};

// MARK: Bonang rack

/** A bonang: a dozen bronze pots with raised bosses on a rope bed in a carved red-and-gold frame, two mallets left lying in the middle. */
const bonangRack = (): Model => {
  const m = new Model();
  const W = 1.88;
  const D = 0.62;
  const RED = "#a8262c";
  // Four short turned legs and a carved frame with a gold trim and a curl at each end.
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      m.cyl(0.045, 0.26, RED, [sx * (W / 2 - 0.1), 0, sz * (D / 2 - 0.06)], 0.04, 8);
      m.ball(0.05, SAFFRON, [sx * (W / 2 - 0.1), 0.26, sz * (D / 2 - 0.06)], [1, 0.7, 1], 8);
    }
  m.box([W, 0.1, D], RED, [0, 0.26, 0], 0.02);
  // A gold trim round the top edge of the frame, and a gold rail along the front.
  for (const s of [-1, 1]) {
    m.box([W + 0.02, 0.03, 0.03], SAFFRON, [0, 0.36, s * (D / 2 - 0.005)], 0.006);
    m.box([0.03, 0.03, D], SAFFRON, [s * (W / 2 - 0.005), 0.36, 0], 0.006);
  }
  m.box([W - 0.04, 0.025, 0.02], SAFFRON, [0, 0.29, D / 2 + 0.003], 0.004);
  // Carved ends: gold scrolls (a stack of rings stepping up).
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++)
      m.ball(0.06 - i * 0.012, SAFFRON, [s * (W / 2 + 0.03), 0.36 + i * 0.07, 0], [0.5, 1, 1], 8);
    m.box([0.04, 0.12, D - 0.1], RED, [s * (W / 2 + 0.01), 0.3, 0], 0.01);
  }
  // The rope bed: a dark red cloth, two cords lengthwise with the pots resting on them.
  m.box([W - 0.1, 0.012, D - 0.1], "#6a1a20", [0, 0.36, 0], 0.003);
  for (const z of [-0.14, 0.14]) m.box([W - 0.1, 0.022, 0.022], "#d8b878", [0, 0.372, z], 0.005);
  for (let i = 0; i < 9; i++) m.box([0.014, 0.014, 0.3], "#e8cf98", [-0.82 + i * 0.205, 0.388, 0], 0.002);
  // Two rows of six bronze pots, a big one at the low end shrinking to a small one, each with a raised gold boss.
  const pot = (x: number, z: number, r: number) => {
    m.cyl(r, 0.09, BRONZE, [x, 0.395, z], r * 0.9, 14);
    m.cyl(r * 1.02, 0.03, BRONZE_DARK, [x, 0.395, z], r * 1.02, 14);
    m.cyl(r * 0.92, 0.02, "#cf9a4c", [x, 0.485, z], r * 0.92, 14);
    m.cyl(r * 0.5, 0.05, "#f2c870", [x, 0.505, z], r * 0.36, 10);
    m.ball(r * 0.22, "#fff0b8", [x, 0.555, z], [1, 0.8, 1], 6);
  };
  for (let i = 0; i < 6; i++) {
    const r = 0.135 - i * 0.012;
    pot(-0.78 + i * 0.3, 0.15, r);
    pot(-0.72 + i * 0.28, -0.15, r - 0.008);
  }
  // The two mallets: a wooden stick, a cord-wrapped padded head, laid across the middle rest of the front row.
  for (const [x, z, a] of [
    [0.1, 0.0, 0.4],
    [-0.1, 0.02, -0.25],
  ] as const) {
    const grp = m.part([x, 0.55, z], a);
    grp.box([0.014, 0.014, 0.4], BAMBOO, [0, 0, -0.18], 0.004);
    grp.ball(0.03, "#c9a265", [0, 0.012, 0.22], [1, 1, 1], 8);
    grp.cyl(0.032, 0.012, HIBISCUS, [0, 0.012, 0.19], 0.032, 8).rotation.x = Math.PI / 2;
  }
  return m;
};

// MARK: Pinisi

/** A pinisi under full sail on its wooden cradle: a teak hull, two masts, seven sails and a pennant that streams. */
const pinisi = (): Model => {
  const m = new Model();
  // The cradle: two cross-members and four posts holding the hull off the floor.
  for (const x of [-0.6, 0.6]) {
    m.box([0.12, 0.05, 0.62], TEAK_DARK, [x, 0.0, 0.0], 0.01);
    for (const z of [-0.26, 0.26])
      m.box([0.06, 0.28, 0.06], TEAK_LIGHT, [x, 0.04, z], 0.01).rotation.z = z * 0.0;
    m.box([0.18, 0.08, 0.5], TEAK, [x, 0.3, 0], 0.02);
  }
  m.box([2.3, 0.04, 0.08], TEAK_DARK, [0, 0.03, -0.28], 0.008);
  m.box([2.3, 0.04, 0.08], TEAK_DARK, [0, 0.03, 0.28], 0.008);
  // The hull: layers stepping out from the keel to the gunwale, long and deep-sided, a raised stern with a high post,
  // a bow that sweeps up and forward to the bowsprit. The bow points +x, so the boat shows its side to the front.
  const layer = (y: number, h: number, len: number, w: number, x: number, c: string) =>
    m.box([len, h, w], c, [x, y, 0], 0.03);
  layer(0.34, 0.1, 1.6, 0.26, 0.05, TEAK_DARK);
  layer(0.42, 0.12, 2.0, 0.42, 0.0, TEAK);
  layer(0.52, 0.12, 2.2, 0.58, 0.0, TEAK_LIGHT);
  layer(0.62, 0.12, 2.3, 0.64, 0.0, TEAK);
  // The strake in turquoise and cream, painted along the side.
  for (const s of [-1, 1]) {
    m.box([2.28, 0.04, 0.012], TURQUOISE, [0.0, 0.65, s * 0.322], 0.002);
    m.box([2.26, 0.014, 0.012], CREAM, [0.0, 0.7, s * 0.322], 0.002);
  }
  // The raised stern deck and its rail, the stem curving up at the bow, and the bowsprit angling out.
  m.box([0.7, 0.14, 0.58], TEAK, [-0.82, 0.74, 0], 0.02);
  m.box([0.04, 0.4, 0.5], TEAK_DARK, [-1.16, 0.74, 0], 0.01);
  for (const s of [-1, 1]) m.box([0.7, 0.04, 0.03], TEAK_DARK, [-0.82, 0.92, s * 0.28], 0.006);
  m.box([0.26, 0.38, 0.5], TEAK_LIGHT, [1.08, 0.7, 0], 0.03);
  m.box([0.2, 0.3, 0.34], TEAK, [1.22, 0.9, 0], 0.03);
  const spar = m.box([0.8, 0.045, 0.05], TEAK_DARK, [1.28, 1.15, 0], 0.01);
  spar.rotation.z = 0.28;
  // The deck: planks and a little cabin aft with a window row.
  m.box([1.8, 0.02, 0.5], BAMBOO_DARK, [0.1, 0.74, 0], 0.003);
  m.box([0.5, 0.2, 0.42], CREAM, [-0.7, 0.88, 0], 0.02);
  m.box([0.54, 0.03, 0.46], HIBISCUS, [-0.7, 1.08, 0], 0.01);
  for (const x of [-0.82, -0.7, -0.58]) m.box([0.07, 0.07, 0.01], DEEP_SEA, [x, 0.93, 0.212], 0.002);
  // Two masts: tall, a little raked, each with yards and booms for the sails to hang from.
  const mast = (x: number, h: number, rake: number) => {
    const g = m.part([x, 0.74, 0]);
    g.rotation.z = rake;
    g.cyl(0.032, h, TEAK_DARK, [0, 0, 0], 0.02, 8);
    return g;
  };
  const front = mast(0.18, 1.7, -0.03);
  const aft = mast(-0.3, 1.45, -0.03);
  // The sails: white and cream triangles and quads between the masts, the bowsprit and the stern, the big ones on the mainmast.
  const sail = (parent: Model, pts: [number, number][], c: string, z: number) =>
    cutout(parent, pts, 0.012, c, [0, 0, z]);
  sail(
    front,
    [
      [0.04, 0.2],
      [0.04, 1.62],
      [0.62, 0.2],
    ],
    "#fbf7ec",
    0.03,
  );
  sail(
    front,
    [
      [-0.04, 0.2],
      [-0.04, 1.5],
      [-0.52, 0.2],
    ],
    CREAM,
    -0.04,
  );
  sail(
    front,
    [
      [0.05, 1.0],
      [0.05, 1.7],
      [0.34, 1.0],
    ],
    "#ffffff",
    -0.01,
  );
  sail(
    aft,
    [
      [0.04, 0.2],
      [0.04, 1.32],
      [0.5, 0.2],
    ],
    CREAM,
    0.03,
  );
  sail(
    aft,
    [
      [-0.04, 0.2],
      [-0.04, 1.2],
      [-0.46, 0.2],
    ],
    "#fbf7ec",
    -0.04,
  );
  // The headsails: from the foremast head down to the bowsprit, two flying jibs.
  cutout(
    m,
    [
      [0.2, 2.35],
      [1.38, 1.36],
      [0.2, 1.0],
    ],
    0.01,
    "#fbf7ec",
    [0, 0, 0.0],
  );
  cutout(
    m,
    [
      [0.2, 1.8],
      [1.0, 1.1],
      [0.2, 0.95],
    ],
    0.01,
    CREAM,
    [0, 0, 0.03],
  );
  // Spars: booms and gaffs holding the sails out.
  for (const [g, len, y] of [
    [front, 0.7, 0.2],
    [aft, 0.62, 0.2],
  ] as const) {
    g.box([len, 0.025, 0.025], TEAK_DARK, [len / 2 - 0.1, y, 0], 0.005);
    g.box([0.48, 0.02, 0.02], TEAK_DARK, [-0.12, y, 0], 0.005);
  }
  // The pennant at the top of the foremast: red, it streams and flaps in two beats.
  const pole = front.part([0, 1.7, 0]);
  const flag = cutout(
    pole,
    [
      [0, 0.0],
      [0.34, -0.05],
      [0, -0.1],
    ],
    0.012,
    HIBISCUS,
    [0, 0.0, 0],
  );
  const flag2 = cutout(
    pole,
    [
      [0, 0.0],
      [0.3, 0.02],
      [0.05, -0.1],
    ],
    0.012,
    "#b82a30",
    [0, 0.0, 0],
  );
  pole.box([0.006, 0.12, 0.006], TEAK_DARK, [0, 0, 0], 0.001);
  const aftFlag = cutout(
    aft,
    [
      [0, 1.45],
      [0.22, 1.42],
      [0, 1.38],
    ],
    0.012,
    TURQUOISE,
    [0, 0, 0],
  );
  ticks.push((t) => {
    const k = Math.floor(t * 3) % 2 === 0;
    flag.visible = k;
    flag2.visible = !k;
    pole.rotation.y = Math.sin(t * 2.2) * 0.12;
    aftFlag.rotation.y = Math.sin(t * 2.6 + 1) * 0.15;
  });
  // Rigging: lines from the mast heads to the bow and the stern.
  const line = (x0: number, y0: number, x1: number, y1: number) => {
    const l = m.box(
      [Math.hypot(x1 - x0, y1 - y0), 0.008, 0.008],
      "#6b4a2a",
      [(x0 + x1) / 2, (y0 + y1) / 2, 0.0],
      0.001,
    );
    l.rotation.z = Math.atan2(y1 - y0, x1 - x0);
  };
  line(0.2, 2.4, 1.38, 1.35);
  line(0.2, 2.4, -1.15, 0.95);
  line(-0.3, 2.14, -1.15, 0.95);
  return m;
};

export const NUSANTARA_ASSETS: readonly {
  id: string;
  name: string;
  w: number;
  d: number;
  build: () => Model;
}[] = [
  { id: "nus-batik-hanging", name: "Batik hanging", w: 2, d: 1, build: batikHanging },
  { id: "nus-sawah-rug", name: "Sawah rug", w: 2, d: 1, build: sawahRug },
  { id: "nus-warung-stool", name: "Warung stool", w: 1, d: 1, build: warungStool },
  { id: "nus-angkringan-cart", name: "Angkringan cart", w: 2, d: 1, build: angkringanCart },
  { id: "nus-bonang-rack", name: "Bonang rack", w: 2, d: 1, build: bonangRack },
  { id: "nus-pinisi", name: "Pinisi on the stand", w: 3, d: 1, build: pinisi },
];
