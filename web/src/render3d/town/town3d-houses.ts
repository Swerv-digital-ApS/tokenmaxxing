/**
 * The buildings of the town: a company's house by tier (basement hatch to mansion, in the company's own
 * colours, with its name on a sign and its logo on a plaque) and the Tavern. Faithful to
 * `web/src/art/buildings.ts`. Every model faces +z with its origin on the ground at the middle of its
 * front wall, the door in the middle: the door tile lies just in front of it.
 */
import * as THREE from "three";
import { C } from "../../art/palette.ts";
import { type Brand, HOUSE_TIER_NAMES } from "../data/town.ts";
import { light } from "../furniture/furniture.ts";
import { canvasTexture, glow, Model, ticks, tint, toon } from "../kit/kit.ts";
import { type Panel, panel } from "../kit/panel.ts";
import { bush, hedge, mailbox, nightGlow } from "./props.ts";

interface Style {
  wall: string;
  roof: string;
  trim: string;
}

/** The house styles of the 2D art, by tier (a company without a brand wears these). */
export const HOUSE_STYLES: readonly Style[] = [
  { wall: C.woodLight, roof: C.wood, trim: C.woodDark },
  { wall: C.woodLight, roof: "#7a5a44", trim: C.woodDark },
  { wall: "#f3e7cf", roof: C.roofRed, trim: C.woodDark },
  { wall: C.white, roof: "#4f7fd0", trim: "#3b62a8" },
  { wall: "#fbf4e6", roof: "#4a4f63", trim: "#8a6d3b" },
  { wall: "#f6ecd6", roof: "#3f7a78", trim: "#d4a93a" },
];

const FLOOR = 1.0;
const PLINTH = 0.2;

// MARK: Logos

const logos = new Map<string, HTMLImageElement | null>();
/** A company logo fitted into a box, smoothly; `again` runs once it has loaded. */
function drawLogo(g: CanvasRenderingContext2D, src: string, w: number, h: number, again: () => void): void {
  if (!logos.has(src)) {
    logos.set(src, null);
    const img = new Image();
    img.onload = () => {
      logos.set(src, img);
      again();
    };
    img.src = src;
  }
  const img = logos.get(src);
  if (!img) return;
  const s = Math.min(w / (img.naturalWidth || w), h / (img.naturalHeight || h));
  const iw = (img.naturalWidth || w) * s;
  const ih = (img.naturalHeight || h) * s;
  g.imageSmoothingEnabled = true;
  g.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
}

/** The logo plaque, `w`×`h`, standing on the floor of its own model. */
function plaque(brand: Brand, w: number, h: number, frame: string): Panel {
  const draw = (g: CanvasRenderingContext2D, cw: number, ch: number) => {
    g.fillStyle = brand.plaque;
    g.fillRect(0, 0, cw, ch);
    if (brand.logo) drawLogo(g, brand.logo, cw, ch, () => p.redraw(draw));
  };
  const p: Panel = panel(w, h, draw, { frame, px: 64, smooth: true });
  return p;
}

// MARK: Pieces

/** A gable roof over a `w`×`d` house with eaves at `y`; the ridge runs along x. Returns the rise. */
function gableRoof(m: Model, w: number, d: number, y: number, color: string, gable: string): number {
  const half = d / 2 + 0.2;
  const rise = Math.min(1.25, d * 0.42);
  const shape = new THREE.Shape();
  shape.moveTo(-half, 0);
  shape.lineTo(0, rise);
  shape.lineTo(half, 0);
  shape.lineTo(-half, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: w + 0.3, bevelEnabled: false });
  geo.translate(0, 0, -(w + 0.3) / 2);
  const mesh = new THREE.Mesh(geo, toon(color));
  mesh.rotation.y = Math.PI / 2;
  mesh.position.y = y;
  mesh.castShadow = mesh.receiveShadow = true;
  m.add(mesh);
  m.box([w + 0.36, 0.08, 0.14], tint(color, -0.25), [0, y + rise - 0.04, 0], 0.03);
  // Shingle courses on both slopes.
  for (const s of [-1, 1])
    for (const f of [0.3, 0.55, 0.8]) {
      const c = m.box(
        [w + 0.3, 0.025, 0.04],
        tint(color, -0.18),
        [0, y + rise * (1 - f) + 0.008, s * half * f],
        0.005,
      );
      c.rotation.x = s * Math.atan(rise / half);
      c.userData.detailSize = 0.025;
    }
  const end = new THREE.Shape();
  end.moveTo(-d / 2, 0);
  end.lineTo(0, rise - 0.12);
  end.lineTo(d / 2, 0);
  // End panels sit outside the roof caps; a second solid prism would overlap the roof's underside.
  const eg = new THREE.ShapeGeometry(end);
  for (const s of [-1, 1]) {
    const face = new THREE.Mesh(eg, toon(gable));
    face.rotation.y = (s * Math.PI) / 2;
    face.position.set(s * ((w + 0.3) / 2 + 0.008), y, 0);
    face.receiveShadow = true;
    m.add(face);
  }
  return rise;
}

/** A window on a wall face (a part looking along +z), centred at `x`, sill at `y`. */
function windowOn(face: Model, x: number, y: number, trim: string, box = false): void {
  face.box([0.5, 0.56, 0.05], C.white, [x, y - 0.04, 0], 0.015);
  const pane = face.box([0.38, 0.44, 0.05], "#a8dcf7", [x, y + 0.02, 0.01], 0.005);
  pane.userData.officeWindow = true;
  pane.castShadow = false;
  nightGlow(pane, "#ffd98a");
  face.box([0.03, 0.44, 0.06], C.white, [x, y + 0.02, 0.01]).userData.detailSize = 0.03;
  face.box([0.38, 0.03, 0.06], C.white, [x, y + 0.22, 0.01]).userData.detailSize = 0.03;
  face.box([0.58, 0.05, 0.1], C.white, [x, y - 0.06, 0.03], 0.01);
  for (const s of [-1, 1])
    face.box([0.1, 0.54, 0.03], tint(trim, 0.05), [x + s * 0.33, y - 0.03, 0.02], 0.01);
  if (box) face.box([0.5, 0.08, 0.12], C.leafLight, [x, y - 0.12, 0.08], 0.03);
}

/** The front door in the middle of a wall, in the company's trim colour. */
function doorOn(m: Model, trim: string, width = 0.62): void {
  m.box([width, 0.98, 0.07], C.white, [0, 0, 0.0], 0.02);
  m.box([width - 0.1, 0.9, 0.07], tint(trim, -0.1), [0, 0, 0.02], 0.015);
  for (const y of [0.1, 0.52]) m.box([width - 0.26, 0.32, 0.02], tint(trim, 0.12), [0, y, 0.06], 0.01);
  m.ball(0.03, "#e9b73d", [width / 2 - 0.12, 0.45, 0.1]);
  m.box([0.85, 0.08, 0.36], C.stoneLight, [0, 0, 0.1], 0.02);
  nightGlow(m.box([0.08, 0.16, 0.08], "#f4e6c0", [width / 2 + 0.18, 0.7, 0.07], 0.02), "#ffe28a");
}

/** One run of the lot's fence, the 2D art's: a thick rail and chunky posts every half tile, ink-edged light wood. */
function picket(m: Model, x0: number, x1: number, z: number, alongZ = false, solid = false): void {
  const part = alongZ ? m.part([z, 0, 0], -Math.PI / 2) : m.part([0, 0, z]);
  const a = Math.min(x0, x1);
  const len = Math.abs(x1 - x0);
  if (solid) {
    // The side runs are drawn solid in 2D: a board the length of the run.
    part.box([len, 0.34, 0.07], C.ink, [(x0 + x1) / 2, 0.05, 0], 0.01);
    part.box([len - 0.06, 0.28, 0.08], C.woodLight, [(x0 + x1) / 2, 0.08, 0], 0.005);
  }
  const n = Math.max(1, Math.round(len / 0.5));
  for (let i = 0; i <= n; i++) {
    // The side runs' end posts are the front and back runs' corner posts: leave them out so they don't share faces.
    if (alongZ && (i === 0 || i === n)) continue;
    const x = a + (i / n) * len;
    part.box([0.2, 0.42, 0.1], C.ink, [x, 0, 0], 0.01);
    part.box([0.1, 0.34, 0.12], C.woodLight, [x, 0.04, 0], 0.005);
  }
  if (!solid) {
    part.box([len, 0.14, 0.076], C.ink, [(x0 + x1) / 2, 0.22, 0.01], 0.005).userData.detailSize = 0.14;
    part.box(
      [len - 0.008, 0.06, 0.096],
      C.woodLight,
      [(x0 + x1) / 2, 0.26, 0.008],
      0.003,
    ).userData.detailSize = 0.06;
  }
}

/** The lot's fence, as in 2D: back, sides, and the front with a gap for the path to the door. */
function yard(m: Model): void {
  // On the 2D lot's lines, in the model's frame (its z = 0 is a quarter tile below the door tile's top): the
  // lot's rails sit 2.3 and 6.65 tiles down its 7 x 5 tiles, the posts a fifth of a tile in from the sides, the
  // gap is -0.75..+0.625 tile round the door.
  picket(m, -3.3, 3.3, -3.95);
  picket(m, -3.3, -0.75, 0.4);
  picket(m, 0.625, 3.3, 0.4);
  picket(m, -3.95, 0.4, -3.3, true, true);
  picket(m, -3.95, 0.4, 3.3, true, true);
}

/** A signpost in the front garden: the company's name on a plank. */
function nameSign(m: Model, name: string, at: [number, number], trim: string): void {
  m.box([0.07, 1.0, 0.07], C.woodDark, [at[0], 0, at[1]], 0.02);
  const tex = canvasTexture(
    320,
    72,
    (g) => {
      g.fillStyle = "#2b2433";
      g.beginPath();
      g.roundRect(0, 0, 320, 72, 14);
      g.fill();
      g.strokeStyle = trim;
      g.lineWidth = 4;
      g.strokeRect(5, 5, 310, 62);
      g.fillStyle = "#ffe28a";
      g.font = "800 34px system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(name.length > 16 ? `${name.slice(0, 15)}…` : name, 160, 38);
    },
    true,
  );
  const board = m.part([at[0], 0.7, at[1] + 0.05]);
  board.box([1.3, 0.3, 0.05], "#2b2433", [0, 0, 0], 0.01);
  board.plane(1.24, 0.28, glow("#fff", tex), [0, 0.15, 0.03]);
}

/** A name board over the door, on a facade. */
function nameBoard(m: Model, name: string, y: number, trim: string): void {
  const board = m.part([0, y, 0.02]);
  const tex = canvasTexture(
    320,
    64,
    (g) => {
      g.fillStyle = "#2b2433";
      g.beginPath();
      g.roundRect(0, 0, 320, 64, 14);
      g.fill();
      g.fillStyle = "#ffe28a";
      g.font = "800 34px system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(name.length > 16 ? `${name.slice(0, 15)}…` : name, 160, 34);
    },
    true,
  );
  board.box([1.4, 0.28, 0.05], trim, [0, 0, 0], 0.01);
  board.plane(1.3, 0.22, glow("#fff", tex), [0, 0.14, 0.03]);
}

/** A lantern on a post. */
function lantern(m: Model, x: number, z: number): void {
  m.box([0.05, 0.5, 0.05], C.woodDark, [x, 0, z]);
  nightGlow(m.box([0.14, 0.18, 0.14], C.lamp, [x, 0.5, z], 0.03), "#ffe28a");
  m.box([0.18, 0.04, 0.18], "#2b2433", [x, 0.68, z], 0.01);
}

// MARK: Houses

/**
 * A company's house by tier (0 basement hatch … 5 mansion) with the lot's yard, fence, bushes and mailbox.
 * `brand` recolours roof, walls and trim and hangs the logo plaque; without it the tier's own style.
 */
export function companyHouse(tier: number, name: string, brand: Brand | null): Model {
  const t = Math.max(0, Math.min(tier, HOUSE_STYLES.length - 1));
  const base = HOUSE_STYLES[t]!;
  const s: Style = brand ? { wall: brand.wall, roof: brand.roof, trim: brand.trim } : base;
  const m = new Model();
  m.name = `house:${HOUSE_TIER_NAMES[t]}`;

  if (t === 0) return basement(m, name, s, brand);

  const spec = [
    null,
    { w: 3, d: 2.1, floors: 1 },
    { w: 5, d: 2.8, floors: 1 },
    { w: 5, d: 3.0, floors: 2 },
    { w: 7, d: 3.3, floors: 2 },
    { w: 7, d: 3.5, floors: 3 },
  ][t]!;
  const { w, d, floors } = spec;
  const h = floors * FLOOR + PLINTH + 0.05;
  const wide = t >= 4;

  if (!wide) yard(m);
  // Walls on a stone plinth, with a band between floors.
  m.box([w + 0.15, PLINTH, d + 0.15], C.stone, [0, 0, -d / 2], 0.02);
  if (t === 1) {
    // Planks.
    m.box([w, h - PLINTH, d], s.wall, [0, PLINTH, -d / 2], 0.02);
    for (let x = -w / 2 + 0.25; x < w / 2; x += 0.25)
      m.box([0.015, h - PLINTH - 0.04, 0.02], tint(s.wall, -0.14), [x, PLINTH + 0.02, 0.01]);
  } else {
    m.box([w - 0.008, h - PLINTH - 0.008, d - 0.016], s.wall, [0, PLINTH, -d / 2], 0.02);
    for (let y = PLINTH + 0.15; y < h - 0.1; y += 0.2)
      m.box([w + 0.005, 0.012, d + 0.005], tint(s.wall, -0.07), [0, y, -d / 2], 0.002);
  }
  for (let f = 1; f < floors; f++)
    m.box(
      [w + 0.05, 0.07, d + 0.05],
      t >= 4 ? s.trim : tint(s.wall, -0.14),
      [0, PLINTH + f * FLOOR, -d / 2],
      0.01,
    );
  const eave = h;
  const roofGroup = m.part([0, 0, -d / 2]);
  const rise = gableRoof(roofGroup, w, d, eave, s.roof, tint(s.wall, -0.04));
  if (t === 1) roofGroup.rotation.z = 0.035;

  // Windows: the most that fit, an odd number so the middle one sits over the door.
  let n = 1;
  while ((n + 2) * 0.5 + (n + 1) * 0.5 <= w - 0.3) n += 2;
  const step = (w - 0.6) / Math.max(1, n);
  const face = m.part([0, 0, 0]);
  for (let f = 0; f < floors; f++)
    for (let i = 0; i < n; i++) {
      if (f === 0 && i === (n - 1) / 2) continue;
      const x = n === 1 ? 0 : -((n - 1) * step * 1.0) / 2 + i * step;
      windowOn(face, x, 0.52 + PLINTH + f * FLOOR - 0.05, s.trim, f === 0 && t === 2);
    }
  const side = (sign: number) => {
    const sf = m.part([sign * (w / 2), 0, -d / 2], (sign * Math.PI) / 2);
    const cols = Math.max(1, Math.floor(d / 1.2));
    for (let f = 0; f < floors; f++)
      for (let c = 0; c < cols; c++)
        windowOn(sf, -((cols - 1) * 0.55) + c * 1.1, 0.52 + PLINTH + f * FLOOR - 0.05, s.trim);
  };
  side(1);
  side(-1);

  // The door, a chimney, flower boxes, a portico.
  const door = m.part([0, PLINTH, 0]);
  doorOn(door, s.trim);
  if (t <= 3) {
    const cx = w / 2 - 0.55;
    m.box(
      [0.36, 0.5 + rise + 0.25, 0.36],
      t === 1 ? C.metalLight : "#b0443a",
      [cx, eave, -d / 2 - 0.2],
      0.03,
    );
    m.box(
      [0.46, 0.08, 0.46],
      t === 1 ? C.metal : "#8a3a32",
      [cx, eave + 0.75 + rise * 0.5, -d / 2 - 0.2],
      0.02,
    );
  }
  if (wide) {
    // Two columns and a lintel framing the door, a balcony ledge over it.
    for (const x of [-0.62, 0.62]) {
      m.cyl(0.1, 1.15, C.white, [x, PLINTH, 0.28], 0.1, 14);
      m.box([0.28, 0.06, 0.28], C.stoneLight, [x, PLINTH, 0.28], 0.01);
    }
    m.box([1.6, 0.1, 0.5], s.trim, [0, PLINTH + 1.15, 0.2], 0.02);
    m.box([1.7, 0.05, 0.6], C.white, [0, PLINTH + 1.25, 0.2], 0.015);
    for (const x of [-0.78, -0.52, -0.26, 0, 0.26, 0.52, 0.78])
      m.box([0.03, 0.2, 0.03], C.white, [x, PLINTH + 1.3, 0.46]);
    m.box([1.7, 0.04, 0.04], C.white, [0, PLINTH + 1.5, 0.46]);
    for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) m.add(placed(bush(Math.round(x * 31) + t), x, 0.3));
    m.add(placed(hedge(2.0, 0.45, 0.4), -2.4, 0.5));
    m.add(placed(hedge(2.0, 0.45, 0.4), 2.4, 0.5));
    m.box([w + 0.08, 0.06, d + 0.08], s.trim, [0, h - 0.04, -d / 2], 0.01);
  } else {
    m.add(placed(bush(7 + t), -w / 2 - 0.2, 0.3));
    m.add(placed(bush(9 + t), w / 2 + 0.2, 0.3));
  }

  // The name on its sign; the logo on the roof, or the tower.
  if (floors >= 2) nameBoard(m, name, PLINTH + (wide ? 0.96 : 1.02), s.trim);
  else nameSign(m, name, [1.5, 0.35], s.trim);
  if (brand?.logo != null && t !== 5) {
    const half = d / 2 + 0.2;
    const slope = Math.atan(rise / half);
    const f = 0.42;
    const p = plaque(brand, 0.9, 0.5, s.trim);
    p.position.set(0, eave + rise * f - 0.3, -d / 2 + half - f * half + 0.05);
    p.rotation.x = -slope;
    m.add(p);
  }

  if (t === 5) tower(m, d, h, rise, s, brand);

  // The mailbox, in the company's colours.
  const mb = mailbox(brand?.roof ?? s.roof);
  mb.position.set(-1.35, 0, 0.5);
  m.add(mb);
  return m;
}

/** Puts a model at a spot and gives it back. */
function placed<T extends THREE.Object3D>(o: T, x: number, z: number): T {
  o.position.set(x, 0, z);
  return o;
}

/** The mansion's tower: three windows high with a pointed roof, a flag in the plaque colour, and the logo. */
function tower(m: Model, d: number, h: number, rise: number, s: Style, brand: Brand | null): void {
  const tw = 1.7;
  const th = 1.9;
  const top = h + rise * 0.7;
  const t = m.part([0, 0, -d + 0.9]);
  t.box([tw, top + th - 0.2, tw], s.wall, [0, 0.1, 0], 0.02);
  t.box([tw + 0.1, 0.08, tw + 0.1], s.trim, [0, top + 0.2, 0], 0.01);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(tw * 0.85, 1.0, 4), toon(s.roof));
  roof.rotation.y = Math.PI / 4;
  roof.position.y = top + th + 0.35;
  roof.castShadow = true;
  t.add(roof);
  t.box([tw + 0.3, 0.1, tw + 0.3], s.trim, [0, top + th - 0.25, 0], 0.02);
  // The flag.
  t.cyl(0.015, 0.7, C.metal, [0, top + th + 0.8, 0], 0.015, 6);
  const flag = t.box([0.5, 0.3, 0.02], brand?.plaque ?? "#e25d5d", [0.26, top + th + 1.2, 0], 0.005);
  ticks.push((time) => (flag.rotation.y = Math.sin(time * 3) * 0.18));
  const face = t.part([0, 0, tw / 2]);
  windowOn(face, 0, top - 0.3, s.trim);
  if (brand?.logo != null) {
    const p = plaque(brand, 0.85, 0.55, s.trim);
    p.position.set(0, top + 0.55, tw / 2 - 0.02);
    t.add(p);
  } else windowOn(face, 0, top + 0.6, s.trim);
}

/** The cellar of the lowest tier: a hatch with its doors swung open, a barred window and a signpost. */
function basement(m: Model, name: string, s: Style, brand: Brand | null): Model {
  yard(m);
  m.box([2.3, 0.2, 1.5], C.stoneDark, [0, 0, -0.35], 0.03);
  m.box([1.8, 0.02, 1.1], "#1f1b19", [0, 0.2, -0.35]);
  ["#5a5048", "#4a423c", "#3a3430", "#2c2724"].forEach((c, i) => {
    m.box([1.7, 0.012, 0.22], c, [0, 0.225 + i * 0.001, -0.02 - i * 0.26]);
  });
  for (const sx of [-1, 1]) {
    const door = m.part([sx * 1.45, 0.05, -0.35]);
    const leaf = door.box([0.12, 1.15, 0.75], s.roof, [0, 0, 0], 0.02);
    leaf.rotation.z = -sx * 0.0;
    door.rotation.z = sx * 1.1;
    door.position.y = 0.05;
    door.box([0.14, 0.04, 0.75], tint(s.roof, -0.25), [0, 0.6, 0]);
    door.position.x = sx * 1.55;
  }
  // The barred window in its stone box.
  m.box([1.0, 0.45, 0.55], C.stoneDark, [-2.25, 0, -0.2], 0.03);
  const win = m.part([-2.25, 0.12, 0.1]);
  win.box([0.7, 0.26, 0.04], "#9fd3ef", [0, 0, 0]);
  nightGlow(win.box([0.66, 0.22, 0.02], "#9fd3ef", [0, 0.02, 0.02], 0.005), "#ffd98a");
  for (const x of [-0.2, 0, 0.2]) win.box([0.02, 0.28, 0.04], C.ink, [x, 0, 0.03]);
  lantern(m, 1.45, 0.3);
  m.add(placed(bush(3), -3.0, 0.1));
  m.add(placed(bush(4), 3.0, 0.1));
  nameSign(m, name, [-1.7, 0.35], s.trim);
  if (brand?.logo != null) {
    m.box([0.07, 1.2, 0.07], C.woodDark, [2.7, 0, -0.3], 0.02);
    const p = plaque(brand, 0.8, 0.4, s.trim);
    p.position.set(2.7, 0.95, -0.25);
    m.add(p);
  }
  const mb = mailbox(brand?.roof ?? s.roof);
  mb.position.set(-1.0, 0, 0.5);
  m.add(mb);
  return m;
}

// MARK: The Tavern

/** The Tavern: a green-roofed inn, seven tiles wide, with its sign, lanterns and barrels. The door goes to `inn`. */
export function tavernBuilding(): Model {
  const m = new Model();
  m.name = "building:inn";
  const [w, d, h] = [6.8, 3.2, 1.9];
  const wall = "#e9d7b5";
  const roofC = "#4f9b6a";
  m.box([w + 0.2, 0.22, d + 0.2], C.stone, [0, 0, -d / 2], 0.02);
  m.box([w, h - 0.22, d], wall, [0, 0.22, -d / 2], 0.02);
  // Timber framing.
  for (let x = -w / 2; x <= w / 2 + 0.01; x += w / 8)
    m.box([0.12, h - 0.22, 0.05], C.woodDark, [x, 0.22, 0.0], 0.01);
  m.box([w + 0.05, 0.12, 0.06], C.woodDark, [0, h - 0.14, 0.0], 0.01);
  m.box([w + 0.05, 0.1, 0.06], C.woodDark, [0, 0.22, 0.0], 0.01);
  const roofGroup = m.part([0, 0, -d / 2]);
  const rise = gableRoof(roofGroup, w, d, h, roofC, tint(wall, -0.04));
  // Windows: two a side of the door.
  const face = m.part([0, 0, 0.02]);
  for (const x of [-2.7, -1.5, 1.5, 2.7]) windowOn(face, x, 0.7, C.woodDark, true);
  const side = m.part([w / 2, 0, -d / 2], Math.PI / 2);
  windowOn(side, 0, 0.7, C.woodDark);
  const west = m.part([-w / 2, 0, -d / 2], -Math.PI / 2);
  windowOn(west, 0, 0.7, C.woodDark);
  // The double door, arched, with a lit lantern each side.
  const door = m.part([0, 0.22, 0.02]);
  door.box([1.3, 1.25, 0.08], C.woodDark, [0, 0, 0], 0.03);
  for (const x of [-0.31, 0.31]) {
    door.box([0.56, 1.1, 0.06], C.wood, [x, 0, 0.03], 0.02);
    door.box([0.36, 0.4, 0.02], C.woodLight, [x, 0.55, 0.07], 0.01);
    door.ball(0.03, "#e9b73d", [x > 0 ? -0.07 : 0.07, 0.55, 0.1]);
  }
  door.cyl(0.65, 0.08, C.woodDark, [0, 1.2, 0.0], 0.65, 3).rotation.z = 0;
  door.box([1.7, 0.12, 0.5], C.stoneLight, [0, 0, 0.18], 0.02);
  for (const x of [-1.05, 1.05]) {
    m.box([0.05, 0.18, 0.05], C.metal, [x, 1.02, 0.1]);
    nightGlow(m.box([0.16, 0.22, 0.16], "#f5d98a", [x, 0.82, 0.14], 0.04), "#ffe28a");
  }
  // THE TAVERN above the door, and the hanging sign.
  const sign = canvasTexture(
    384,
    80,
    (g) => {
      g.fillStyle = "#3a2a1c";
      g.beginPath();
      g.roundRect(0, 0, 384, 80, 16);
      g.fill();
      g.strokeStyle = "#d4a93a";
      g.lineWidth = 5;
      g.strokeRect(6, 6, 372, 68);
      g.fillStyle = "#ffe28a";
      g.font = "900 46px system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("THE TAVERN", 192, 44);
    },
    true,
  );
  m.box([1.9, 0.38, 0.066], "#3a2a1c", [0, h - 0.72, 0.033], 0.02);
  m.plane(1.84, 0.36, glow("#fff", sign), [0, h - 0.72 + 0.19, 0.07]);
  const hang = m.part([2.05, h - 0.35, 0.3]);
  hang.box([0.04, 0.04, 0.5], C.woodDark, [0, 0.1, -0.2]);
  const swing = hang.part([0, 0, 0.0]);
  swing.box([0.5, 0.42, 0.05], C.flowerYellow, [0, -0.45, 0.0], 0.02);
  swing.box([0.14, 0.18, 0.06], "#b57c4b", [-0.04, -0.4, 0.04], 0.02);
  swing.box([0.1, 0.05, 0.07], C.white, [-0.04, -0.2, 0.04]);
  ticks.push((time) => (swing.rotation.z = Math.sin(time * 1.6) * 0.08));
  // The chimney, with smoke.
  m.box([0.45, 1.1, 0.45], "#a36a50", [-2.3, h, -d / 2 - 0.5], 0.03);
  m.box([0.55, 0.08, 0.55], "#7a4a38", [-2.3, h + 1.1, -d / 2 - 0.5], 0.02);
  const puffs = [0, 1, 2].map(() => {
    const p = m.ball(0.14, "#f1efe9", [-2.3, h + 1.3, -d / 2 - 0.5], [1, 0.8, 1], 8);
    return p;
  });
  ticks.push((time) => {
    puffs.forEach((p, i) => {
      const f = (time * 0.3 + i / 3) % 1;
      p.position.set(-2.3 + f * 0.5, h + 1.3 + f * 1.1, -d / 2 - 0.5);
      p.scale.setScalar(0.7 + f * 1.1);
    });
  });
  // Barrels and a bench by the door.
  for (const [x, z] of [
    [-2.2, 0.45],
    [-1.9, 0.62],
  ] as const) {
    m.cyl(0.2, 0.42, C.wood, [x, 0, z], 0.22, 12);
    m.cyl(0.215, 0.03, C.ink, [x, 0.12, z], 0.215, 12);
    m.cyl(0.215, 0.03, C.ink, [x, 0.3, z], 0.215, 12);
  }
  m.box([0.9, 0.06, 0.3], C.woodLight, [2.2, 0.32, 0.5], 0.02);
  for (const x of [1.8, 2.6]) m.box([0.06, 0.32, 0.26], C.woodDark, [x, 0, 0.5], 0.01);
  light(m, [0, 1.0, 0.8], "#ffcf7a", 3, 6);
  void rise;
  return m;
}
