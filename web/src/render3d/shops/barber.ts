/**
 * The Barber: a walk-in barber shop and salon in the 3D town. Every look option of the 2D character creator
 * (`hud/Bag.tsx`, its You tab: style, skin, hair) and every face thing of the shop (glasses, masks, the moustache and
 * the beard) is physically on show: wigs on stands in every hairstyle and hair colour, a colour swatch wall,
 * a skin-tone chart, a moustache and beard bar and a rack of faces, plus chairs, mirrors, sinks, towels and
 * clippers. Figaro the barber minds the till; two apprentices trim customers under capes.
 *
 * The catalogue is `data/barber.ts`. `restyle(look, change)` is the hook the buy panel uses to apply a
 * purchase to a saved 2D `Look`.
 */
import { LOOK_OPTIONS, type Look } from "@tokenmaxxing/core/world.ts";
import * as THREE from "three";
import { C } from "../../art/palette.ts";
import { type Asset, assetById, light } from "../furniture/furniture.ts";
import { canvasTexture, checker, glass, glow, Model, painted, ticks, tint } from "../kit/kit.ts";
import { panel } from "../kit/panel.ts";
import type { Avatar } from "../people/avatar.ts";
import { exitDoorway } from "../rooms/exits3d.ts";
import { type Placed, Room, type Turn } from "../rooms/room.ts";
import { nightGlow } from "../town/props.ts";
import {
  animateApprentice,
  animateBarber,
  BLUE,
  barberChair,
  barberPole,
  broom,
  CHROME,
  CHROME_DARK,
  chatter,
  clippings,
  headOnStand,
  leanCard,
  lipCard,
  lookOf,
  makeApprentice,
  makeBarber,
  makeCustomer,
  makeReader,
  mirror,
  nameChip,
  priceCard,
  RED,
  shelfUnit,
  sinks,
  station,
  towelWarmer,
  wig,
} from "./barber-parts.ts";
import {
  type BarberRow,
  FACE_ROWS,
  FACIAL_HAIR_IDS,
  HAIR_COLOURS,
  HAIR_ROWS,
  SKIN_COLOURS,
  SKIN_ROWS,
  STYLE_ROWS,
} from "./data/barber.ts";

// MARK: The contract

export interface ShopItem {
  id: string;
  name: string;
  price: number;
  level?: number;
  group?: string;
  /** a small 3D model of the item (for shelves/rails/pens and for the buy panel) */
  preview: () => Model;
}

export interface ShopSpec {
  id: "furniture" | "clothes" | "barber" | "pets";
  name: string;
  sign: string;
  items: ShopItem[];
  /** The storefront for the town: a building about 5x4 tiles with a door on its south face, sign, awning, window displays. Built facing +z like other town buildings (see town3d-houses.ts / town3d.ts). */
  exterior: () => Model;
  footprint: { w: number; d: number };
  /** The walkable interior. */
  buildInterior: () => {
    room: Room;
    /** world-grid tiles where a click means 'browse this item' */
    displays: { item: ShopItem; at: [number, number] }[];
    shopkeeper: Avatar;
    counter: [number, number];
    door: [number, number];
  };
}

// MARK: Items

const group = (row: BarberRow): string =>
  row.slot === "style"
    ? "Hairstyles"
    : row.slot === "hair"
      ? "Hair colour"
      : row.slot === "skin"
        ? "Skin tone"
        : (FACIAL_HAIR_IDS as readonly string[]).includes(row.id)
          ? "Facial hair"
          : "Face";

const previewOf = (row: BarberRow): (() => Model) => {
  switch (row.slot) {
    case "style":
      return () => wig(row.index, 0);
    case "hair":
      return () => wig(0, row.index);
    case "skin":
      return () => headOnStand(lookOf(0, 0, row.index), { scale: 1.2 });
    case "glasses":
      return () => headOnStand(lookOf(0, 1, 1, row.index), { scale: 1.2, live: true });
  }
};

const toItem = (row: BarberRow): ShopItem => ({
  id: row.id,
  name: row.name,
  price: row.price,
  ...(row.level !== undefined && { level: row.level }),
  group: group(row),
  preview: previewOf(row),
});

const ROWS: readonly BarberRow[] = [...STYLE_ROWS, ...HAIR_ROWS, ...SKIN_ROWS, ...FACE_ROWS];
export const BARBER_ITEMS: ShopItem[] = ROWS.map(toItem);
const itemOf = (id: string): ShopItem => BARBER_ITEMS.find((i) => i.id === id)!;

// MARK: restyle

/** What to change on a look: the creator's numbers, and the face thing (`look.glasses`; 0 takes it off). */
export interface LookChange {
  style?: number;
  hair?: number;
  skin?: number;
  /** A face item's index (`glasses.<n>`): glasses, masks, the moustache, the beard. */
  face?: number;
}

const inRange = (n: number | undefined, count: number): n is number =>
  n !== undefined && Number.isInteger(n) && n >= 0 && n < count;

/**
 * A look with `change` applied: a new object, the old one untouched. Out-of-range numbers and face things
 * the barber does not stock are ignored. A level-locked face thing needs `opts.level`.
 */
export function restyle(look: Look, change: LookChange, opts: { level?: number } = {}): Look {
  const out: Look = { ...look };
  if (inRange(change.style, LOOK_OPTIONS.style)) out.style = change.style;
  if (inRange(change.hair, LOOK_OPTIONS.hair)) out.hair = change.hair;
  if (inRange(change.skin, LOOK_OPTIONS.skin)) out.skin = change.skin;
  if (change.face === 0) out.glasses = 0;
  else if (change.face !== undefined) {
    const row = FACE_ROWS.find((r) => r.index === change.face);
    if (row && (row.level === undefined || (opts.level ?? 0) >= row.level)) out.glasses = row.index;
  }
  return out;
}

// MARK: Exterior

const BRICK = "#b5524a";
const TRIM = "#fbf7ef";

const stripes = (a: string, b: string, n = 8): THREE.CanvasTexture => {
  const t = canvasTexture(n * 4, 8, (g) => {
    for (let i = 0; i < n; i++) {
      g.fillStyle = i % 2 ? b : a;
      g.fillRect(i * 4, 0, 4, 8);
    }
  });
  return t;
};

const brickTexture = (): THREE.CanvasTexture => {
  const t = canvasTexture(16, 16, (g) => {
    g.fillStyle = BRICK;
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = tint(BRICK, -0.22);
    for (let r = 0; r < 4; r++) {
      g.fillRect(0, r * 4 + 3, 16, 1);
      const off = r % 2 ? 4 : 0;
      for (let x = off; x < 16; x += 8) g.fillRect(x, r * 4, 1, 3);
    }
    g.fillStyle = tint(BRICK, 0.1);
    for (let r = 0; r < 4; r++) g.fillRect(2 + (r % 2) * 4, r * 4, 2, 1);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};

/** The storefront: 5 tiles wide, red brick, a striped awning, two window displays, the pole and the sign. */
function exterior(): Model {
  const m = new Model();
  m.name = "building:barber";
  const [w, d, h] = [5, 3.6, 2.0];
  m.box([w + 0.2, 0.16, d + 0.2], C.stone, [0, 0, -d / 2], 0.02);
  const body = m.box([w, h - 0.26, d], tint(BRICK, -0.05), [0, 0.16, -d / 2], 0.02);
  body.receiveShadow = true;
  const brick = brickTexture();
  brick.repeat.set(w * 1.2, (h - 0.16) * 1.2);
  const front = m.plane(w, h - 0.16, painted(brick), [0, 0.16 + (h - 0.16) / 2, 0.012]);
  front.receiveShadow = true;
  for (const s of [-1, 1]) {
    const sideBrick = brickTexture();
    sideBrick.repeat.set(d * 1.2, (h - 0.16) * 1.2);
    const side = m.plane(d, h - 0.16, painted(sideBrick), [
      s * (w / 2 + 0.012),
      0.16 + (h - 0.16) / 2,
      -d / 2,
    ]);
    side.rotation.y = s * (Math.PI / 2);
  }
  // Roof slab, parapets and a cornice along the front.
  m.box([w, 0.06, d], "#5d6470", [0, h - 0.066, -d / 2], 0.005);
  m.box([w + 0.14, 0.1, 0.16], TRIM, [0, h - 0.1, 0.0], 0.02);
  m.box([w + 0.04, 0.22, 0.12], BRICK, [0, h - 0.04, -0.04], 0.02);
  m.box([w + 0.04, 0.22, 0.12], BRICK, [0, h - 0.04, -d + 0.04], 0.02);
  for (const s of [-1, 1]) m.box([0.12, 0.22, d], BRICK, [s * (w / 2 - 0.0), h - 0.04, -d / 2], 0.02);
  // Black-and-white tiles under the windows.
  const base = canvasTexture(8, 2, (g) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? "#2b2f3a" : "#f1ede0";
      g.fillRect(i, 0, 1, 1);
      g.fillStyle = i % 2 ? "#f1ede0" : "#2b2f3a";
      g.fillRect(i, 1, 1, 1);
    }
  });
  base.wrapS = base.wrapT = THREE.RepeatWrapping;
  base.repeat.set(w * 1.6, 1);
  m.plane(w, 0.3, painted(base), [0, 0.31, 0.025]);

  // The windows, with a wig head or two in each.
  const face = m.part([0, 0, 0.02]);
  const heads: Array<[number, number, number, number]> = [
    [-1.85, 0, 1, 3],
    [-1.2, 1, 3, 1],
    [1.2, 5, 0, 2],
    [1.85, 2, 2, 0],
  ];
  for (const sx of [-1.52, 1.52]) {
    face.box([1.24, 0.8, 0.08], TRIM, [sx, 0.36, 0], 0.02);
    const dark = face.box([1.1, 0.66, 0.06], "#3a2a2e", [sx, 0.43, 0.016], 0.01);
    dark.castShadow = false;
    const pane = face.box([1.08, 0.64, 0.02], glass("#cfe8f4", 0.28), [sx, 0.44, 0.07], 0.004);
    pane.castShadow = false;
    nightGlow(pane, "#ffd98a");
    face.box([1.3, 0.06, 0.16], TRIM, [sx, 0.3, 0.07], 0.015);
    face.box([1.1, 0.04, 0.26], C.woodDark, [sx, 0.46, -0.1], 0.01);
    const mi = mirror(0.36, 0.5, false);
    mi.scale.setScalar(0.8);
    mi.position.set(sx, 0.5, -0.2);
    face.add(mi);
  }
  for (const [x, hair, style, skin] of heads) {
    const hd = headOnStand(lookOf(style, hair, skin, 0, hair), {
      voxelStyle: style === 2 ? 3 : undefined,
      scale: 0.9,
    });
    hd.scale.setScalar(0.85);
    hd.position.set(x, 0.5, -0.05);
    face.add(hd);
  }
  // Flower boxes.
  for (const sx of [-1.52, 1.52]) {
    face.box([1.1, 0.12, 0.14], C.woodDark, [sx, 0.2, 0.14], 0.02);
    for (let i = 0; i < 6; i++)
      face.ball(
        0.05,
        ["#e8584f", "#f5d14a", "#ff7ab6"][i % 3]!,
        [sx - 0.45 + i * 0.18, 0.36, 0.14],
        [1, 1, 1],
        6,
      );
  }

  // The door: glass panel, kick plate, brass handle, and a hanging sign.
  const door = m.part([0, 0.16, 0.02]);
  door.box([0.88, 1.12, 0.08], TRIM, [0, 0, 0], 0.02);
  door.box([0.72, 1.02, 0.06], "#2e5fa8", [0, 0, 0.02], 0.015);
  const dpane = door.box([0.5, 0.6, 0.02], glass("#cfe8f4", 0.5), [0, 0.32, 0.06], 0.004);
  nightGlow(dpane, "#ffd98a");
  door.box([0.62, 0.2, 0.02], tint("#2e5fa8", -0.2), [0, 0.04, 0.06], 0.005);
  door.box([0.04, 0.2, 0.04], "#e9b73d", [0.27, 0.5, 0.1], 0.01);
  door.box([1.1, 0.08, 0.4], C.stoneLight, [0, 0, 0.16], 0.02);
  const open = door.part([-0.18, 0.62, 0.1]);
  open.box([0.28, 0.12, 0.02], "#fbf7ef", [0, 0, 0], 0.01);
  ticks.push((t) => (open.rotation.z = Math.sin(t * 1.5) * 0.04));

  // The awning: red and white, scalloped, over the whole front.
  const aw = m.part([0, 1.5, 0.03]);
  aw.rotation.x = 0.4;
  const tex = stripes(RED, "#fbf7ef", 20);
  tex.wrapS = THREE.RepeatWrapping;
  aw.box([w - 0.1, 0.05, 0.48], painted(tex), [0, -0.025, 0.24], 0.01);
  for (let i = 0; i < 20; i++) {
    const x = -((w - 0.1) / 2) + (i + 0.5) * ((w - 0.1) / 20);
    aw.cyl(0.125, 0.05, i % 2 ? "#fbf7ef" : RED, [x, -0.06, 0.5], 0.125, 3).rotation.x = Math.PI / 2;
  }

  // The sign above the awning: BARBER, with a pair of scissors each side.
  const sign = canvasTexture(
    512,
    96,
    (g) => {
      g.fillStyle = "#1f2a44";
      g.beginPath();
      g.roundRect(0, 0, 512, 96, 18);
      g.fill();
      g.strokeStyle = "#f5c842";
      g.lineWidth = 6;
      g.strokeRect(8, 8, 496, 80);
      g.fillStyle = "#fbf7ef";
      g.font = "900 52px system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("BARBER & SALON", 256, 40);
      g.fillStyle = "#f5c842";
      g.font = "700 20px system-ui, sans-serif";
      g.fillText("cuts  ·  colour  ·  beards  ·  faces", 256, 74);
    },
    true,
  );
  m.box([3.4, 0.4, 0.06], "#1f2a44", [0, 1.52, 0.03], 0.02);
  m.plane(3.34, 0.36, glow("#fff", sign), [0, 1.72, 0.07]);
  const roofPole = m.part([0, h + 0.3, -0.12]);
  for (const s of [-1, 1]) {
    const blade = roofPole.box([0.04, 0.5, 0.03], CHROME, [0, -0.1, 0], 0.005);
    blade.rotation.z = s * 0.28;
    roofPole.ball(0.07, RED, [-s * 0.14, -0.02, 0.0], [1, 1.2, 0.5], 8).rotation.z = 0;
  }

  // The barber pole on the wall, right of the right window, spinning.
  const bracket = m.part([2.32, 0.3, 0.06]);
  bracket.box([0.06, 0.06, 0.2], CHROME_DARK, [0, 0.0, 0.0], 0.01);
  bracket.box([0.06, 0.06, 0.2], CHROME_DARK, [0, 1.0, 0.0], 0.01);
  const pole = barberPole(1.05, 0.085, true);
  pole.position.set(0, 0, 0.14);
  bracket.add(pole);
  // A second, free-standing one on the kerb.
  const kerb = barberPole(0.7, 0.07);
  kerb.position.set(-2.2, 0, 0.7);
  m.add(kerb);
  m.box([0.24, 0.05, 0.24], "#2b2433", [-2.2, 0, 0.7], 0.01);

  // The chalkboard A-frame: today's walk-ins.
  const board = panel(
    0.9,
    1.05,
    (g, cw, ch) => {
      g.fillStyle = "#2f3b37";
      g.fillRect(0, 0, cw, ch);
      g.fillStyle = "#f1ede0";
      g.textAlign = "center";
      g.font = "bold 15px system-ui, sans-serif";
      g.fillText("WALK-INS", cw / 2, 22);
      g.font = "12px system-ui, sans-serif";
      g.fillStyle = "#ffe28a";
      for (const [i, l] of ["Trim", "Colour", "Beard", "New face"].entries())
        g.fillText(l, cw / 2, 44 + i * 18);
      g.fillStyle = "#f08a8a";
      g.fillText("free styles!", cw / 2, ch - 12);
    },
    { px: 96, frame: C.woodDark },
  );
  board.position.set(-1.2, 0, 0.8);
  m.add(board);

  // Lanterns each side of the door.
  for (const x of [-0.62, 0.62]) {
    m.box([0.04, 0.12, 0.04], C.metal, [x, 1.0, 0.07]);
    nightGlow(m.box([0.12, 0.16, 0.12], "#f5d98a", [x, 0.84, 0.1], 0.03), "#ffe28a");
  }
  light(m, [0, 1.0, 0.9], "#ffcf7a", 2.6, 6);
  return m;
}

// MARK: Interior

const W = 20;
const D = 11;

const asset = (
  id: string,
  name: string,
  w: number,
  d: number,
  build: () => Model,
  extra: Partial<Asset> = {},
): Asset => ({
  id,
  name,
  price: 0,
  w,
  d,
  build,
  ...extra,
});

/** A header sign on top of a fixture: a lit board, `w` wide. */
function header(
  m: Model,
  text: string,
  sub: string,
  w: number,
  y: number,
  z: number,
  colour = "#1f2a44",
): void {
  const p = panel(
    w,
    0.26,
    (g, cw, ch) => {
      g.fillStyle = colour;
      g.fillRect(0, 0, cw, ch);
      g.fillStyle = "#f5c842";
      g.fillRect(0, ch - 3, cw, 3);
      g.fillStyle = "#fbf7ef";
      g.textAlign = "center";
      g.textBaseline = "middle";
      const fit = (size: number, weight: string, t: string) => {
        g.font = `${weight} ${size}px system-ui, sans-serif`;
        while (g.measureText(t).width > cw - 12 && size > 6)
          g.font = `${weight} ${--size}px system-ui, sans-serif`;
      };
      fit(14, "900", text);
      g.fillText(text, cw / 2, ch * 0.36);
      g.fillStyle = "#f5c842";
      fit(9, "600", sub);
      g.fillText(sub, cw / 2, ch * 0.76);
    },
    { px: 64, lit: true, frame: "#5b3a24" },
  );
  p.position.set(0, y, z);
  m.add(p);
}

/** The wig wall: four hairstyle rows by six hair colours, 24 heads, a price card under each. */
/** What each display shows, by row id, as the racks put it out: where the pointer finds it (`buildInterior`). */
const spots = new Map<string, THREE.Object3D[]>();
const spot = (id: string, o: THREE.Object3D) => spots.set(id, [...(spots.get(id) ?? []), o]);

function wigWall(): Model {
  const m = new Model();
  const depth = 0.55;
  const tiers = [0.22, 0.84, 1.46, 2.08];
  const unit = shelfUnit(6, depth, tiers, { cabinet: 0.15, top: 2.62, back: "#f1e6d2" });
  unit.position.z = -0.5 + depth / 2;
  m.add(unit);
  const wall = m.part([0, 0, -0.5]);
  STYLE_ROWS.forEach((row, r) => {
    const y = tiers[r]!;
    leanCard(wall, row, [-2.62, y, 0.52], 0.66, 0.34);
    HAIR_ROWS.forEach((hair, c) => {
      const h = wig(row.index, hair.index);
      h.scale.setScalar(0.86);
      h.rotation.y = -0.5;
      h.position.set(-1.8 + c * 0.82, y, 0.25);
      wall.add(h);
      spot(row.id, h);
      leanCard(
        wall,
        { ...hair, name: hair.name.replace(" hair", "") },
        [-1.8 + c * 0.82, y, 0.52],
        0.76,
        0.2,
      );
    });
  });
  // Towels, wig caps and spare dummies in the cabinet doors' top; a hairdryer on the highest board.
  light(m, [0, 2.4, 0.6], "#fff0cf", 1.6, 5);
  return m;
}

/** The colour swatch wall: pegboard, six hair tresses, their cards, and a bottle of dye for each. */
function swatchWall(): Model {
  const m = new Model();
  const depth = 0.5;
  const unit = shelfUnit(4, depth, [0.55], { cabinet: 0.5, top: 2.45, wood: "#e6d8bd" });
  unit.position.z = -0.5 + depth / 2;
  m.add(unit);
  const wall = m.part([0, 0, -0.5]);
  // The pegboard: a grid of holes.
  const holes = canvasTexture(32, 24, (g) => {
    g.fillStyle = "#efe4cb";
    g.fillRect(0, 0, 32, 24);
    g.fillStyle = "#cdbd9c";
    for (let x = 1; x < 32; x += 2) for (let y = 1; y < 24; y += 2) g.fillRect(x, y, 1, 1);
  });
  m.plane(3.88, 1.82, painted(holes), [0, 1.5, -0.5 + 0.1]).position.z = -0.5 + 0.095;
  header(m, "HAIR COLOUR", "six shades, all free", 2.2, 2.15, -0.5 + 0.53);
  HAIR_ROWS.forEach((row, c) => {
    const x = -1.6 + c * 0.64;
    const col = HAIR_COLOURS[c]!;
    // The clip, then the tress: a wavy plait of cubes.
    for (let k = 0; k < 6; k++) {
      const seg = wall.box(
        [0.17 - k * 0.012, 0.11, 0.07],
        tint(col, k % 2 ? -0.12 : 0.08),
        [x + Math.sin(k * 1.4) * 0.022, 1.72 - k * 0.09, 0.13],
        0.015,
      );
      seg.castShadow = true;
    }
    spot(row.id, wall.box([0.07, 0.07, 0.06], tint(col, -0.2), [x, 1.17, 0.13], 0.02));
    spot(row.id, wall.box([0.22, 0.05, 0.05], CHROME, [x, 1.82, 0.12], 0.01));
    const card = priceCard({ ...row, name: row.name.replace(" hair", "") }, 0.56, 0.42);
    card.position.set(x, 0.74, 0.11);
    card.scale.setScalar(1);
    wall.add(card);
    // The dye bottle on the shelf, and a tub.
    wall.cyl(0.07, 0.24, glass(col, 0.9), [x - 0.1, 0.6, 0.3], 0.065, 10);
    wall.cyl(0.04, 0.05, "#fbf7ef", [x - 0.1, 0.84, 0.3], 0.03, 8);
    wall.cyl(0.1, 0.1, "#fbf7ef", [x + 0.1, 0.6, 0.26], 0.09, 10);
    wall.cyl(0.085, 0.015, col, [x + 0.1, 0.7, 0.26], 0.085, 10);
  });
  light(m, [0, 2.1, 0.5], "#fff0cf", 1.0, 4);
  return m;
}

/** The face rack: eighteen faces on three boards, a card on each board's lip, the sign on the cabinet. */
function faceRack(): Model {
  const m = new Model();
  const depth = 0.55;
  const tiers = [0.36, 1.12, 1.88];
  const unit = shelfUnit(6, depth, tiers, { cabinet: 0.3, top: 2.56, wood: "#bda27a", back: "#f1e6d2" });
  unit.position.z = -0.5 + depth / 2;
  m.add(unit);
  const wall = m.part([0, 0, -0.5]);
  header(m, "FACES", "glasses, masks & goggles, new for every day", 3.0, 0.04, -0.5 + depth + 0.03);
  const rows = FACE_ROWS.filter((r) => !(FACIAL_HAIR_IDS as readonly string[]).includes(r.id));
  rows.forEach((row, i) => {
    const tier = Math.floor(i / 6);
    const c = i % 6;
    const x = -2.5 + c;
    const hd = headOnStand(lookOf(i % 4, (i * 5) % 6, i % 4, row.index, i % 8), { scale: 0.95, live: true });
    hd.position.set(x, tiers[tier]!, 0.22);
    hd.rotation.y = -0.2;
    wall.add(hd);
    spot(row.id, hd);
    lipCard(wall, row, [x, tiers[tier]! - 0.3, depth + 0.012], 0.92, 0.26);
  });
  light(m, [0, 2.3, 0.6], "#fff0cf", 1.4, 5);
  return m;
}

/** The moustache and beard bar: both on show in two hair colours, plus the razors, brush, soap and strop. */
function beardBar(): Model {
  const m = new Model();
  const depth = 0.55;
  const tiers = [0.5, 1.4];
  const top = 2.5;
  const unit = shelfUnit(2, depth, tiers, { cabinet: 0.35, top, wood: "#7a5a44", back: "#e6d8bd" });
  unit.position.z = -0.5 + depth / 2;
  m.add(unit);
  const wall = m.part([0, 0, -0.5]);
  header(
    m,
    "MOUSTACHE & BEARD",
    "grown in your own hair colour",
    1.86,
    top - 0.3,
    -0.5 + depth + 0.03,
    "#3a2a1c",
  );
  const [hyg, vik] = FACE_ROWS.filter((r) => (FACIAL_HAIR_IDS as readonly string[]).includes(r.id)) as [
    BarberRow,
    BarberRow,
  ];
  // The shaving kit between the moustaches: a mug with its brush, a bar of soap, an open razor.
  const y0 = tiers[0]!;
  wall.cyl(0.06, 0.09, "#fbf7ef", [-0.07, y0, 0.36], 0.055, 12);
  wall.cyl(0.052, 0.012, "#f1f1f1", [-0.07, y0 + 0.09, 0.36], 0.05, 12);
  wall.cyl(0.011, 0.15, "#8c5c36", [-0.07, y0 + 0.09, 0.36], 0.011, 6);
  wall.ball(0.03, "#e8dcc4", [-0.07, y0 + 0.25, 0.36], [1, 1.3, 1], 8);
  wall.box([0.09, 0.035, 0.055], "#f5d98a", [0.09, y0, 0.38], 0.012);
  const razor = wall.part([0.0, y0 + 0.01, 0.15], 0.5);
  razor.box([0.18, 0.012, 0.03], CHROME, [0, 0, 0], 0.002);
  razor.box([0.09, 0.02, 0.025], "#2b2433", [0.13, 0, 0], 0.005);
  const rows: [BarberRow, readonly number[], number][] = [
    [hyg, [1, 3], tiers[0]!],
    [vik, [5, 4], tiers[1]!],
  ];
  for (const [row, hairs, y] of rows) {
    for (const [k, hair] of hairs.entries()) {
      const hd = headOnStand(lookOf(0, hair, k === 0 ? 1 : 2, row.index, 0), { scale: 1.0, live: true });
      hd.position.set(-0.5 + k * 1.0, y, 0.22);
      hd.rotation.y = k ? 0.15 : -0.15;
      wall.add(hd);
      spot(row.id, hd);
    }
    lipCard(wall, row, [0, y - 0.3, depth + 0.012], 0.92, 0.26);
  }
  return m;
}

/** The skin-tone chart: four tones on heads in a cabinet, a card under each, and a chip each on the doors. */
function skinChart(): Model {
  const m = new Model();
  const depth = 0.55;
  const tiers = [0.72, 1.5];
  const top = 2.4;
  const unit = shelfUnit(2, depth, tiers, { cabinet: 0.4, top, wood: "#e6d8bd" });
  unit.position.z = -0.5 + depth / 2;
  m.add(unit);
  const wall = m.part([0, 0, -0.5]);
  header(m, "SKIN TONE", "four shades, free", 1.5, top - 0.3, -0.5 + depth + 0.03);
  for (const [i, row] of SKIN_ROWS.entries()) {
    const tier = Math.floor(i / 2);
    const x = -0.5 + (i % 2) * 1.0;
    const hd = headOnStand(lookOf(0, 0, row.index, 0, 3), { scale: 1.0 });
    hd.position.set(x, tiers[tier]!, 0.22);
    hd.rotation.y = i % 2 ? 0.15 : -0.15;
    wall.add(hd);
    spot(row.id, hd);
    lipCard(
      wall,
      { ...row, name: row.name.replace(" skin", "") },
      [x, tiers[tier]! - 0.2, depth + 0.012],
      0.8,
      0.16,
    );
  }
  // The four tones as chips on the cabinet doors.
  for (let i = 0; i < 4; i++)
    wall.box([0.3, 0.2, 0.015], SKIN_COLOURS[i]!, [-0.66 + i * 0.44, 0.08, depth + 0.02], 0.006);
  return m;
}

// MARK: The counter and the rest

function counter(): Model {
  const m = new Model();
  const w = 4;
  m.box([w, 0.9, 0.7], "#f1ede0", [0, 0, 0], 0.03);
  m.box([w + 0.1, 0.06, 0.8], "#2b2f3a", [0, 0.9, 0], 0.02);
  m.box([w - 0.2, 0.7, 0.03], "#1f2a44", [0, 0.1, 0.36], 0.01);
  for (let i = 0; i < 8; i++)
    m.box([0.03, 0.7, 0.035], i % 2 ? RED : "#fbf7ef", [-w / 2 + 0.3 + i * 0.5, 0.1, 0.37], 0.004);
  // The till.
  m.box([0.5, 0.2, 0.4], "#8a93a1", [-1.2, 0.96, 0.0], 0.03);
  m.box([0.4, 0.22, 0.04], "#2b2433", [-1.2, 1.16, -0.12], 0.01).rotation.x = -0.35;
  m.box([0.3, 0.02, 0.1], "#3ddc84", [-1.2, 1.2, -0.1], 0.004);
  m.box([0.4, 0.04, 0.08], "#fbf7ef", [-1.2, 1.0, 0.17], 0.01);
  // A bell, a tip jar, business cards, a small pole and a jar of lollipops.
  m.cyl(0.06, 0.04, "#e9b73d", [-0.6, 0.96, 0.1], 0.03, 10);
  m.ball(0.03, "#e9b73d", [-0.6, 1.0, 0.1], [1, 1, 1], 6);
  m.cyl(0.08, 0.18, glass("#d6ecf6", 0.6), [-0.2, 0.96, 0.1], 0.08, 12);
  for (let i = 0; i < 4; i++) m.cyl(0.045, 0.012, "#f5c842", [-0.2, 0.97 + i * 0.012, 0.1], 0.045, 10);
  m.box([0.14, 0.02, 0.09], "#fbf7ef", [0.3, 0.96, 0.15], 0.004);
  m.box([0.14, 0.03, 0.09], "#f5d98a", [0.3, 0.98, 0.15], 0.004).rotation.y = 0.2;
  const pole = barberPole(0.5, 0.06);
  pole.position.set(1.4, 0.96, 0.0);
  m.add(pole);
  m.cyl(0.09, 0.22, glass("#fbd7e6", 0.6), [0.8, 0.96, 0.05], 0.09, 12);
  for (let i = 0; i < 5; i++) {
    const pop = m.ball(
      0.04,
      ["#e8584f", "#f5d14a", "#58b36a", "#4f8fe0", "#c86bd8"][i]!,
      [0.8 + (i - 2) * 0.03, 1.2 + (i % 2) * 0.03, 0.05],
      [1, 1, 0.5],
      8,
    );
    pop.castShadow = true;
    m.cyl(0.006, 0.12, "#fbf7ef", [0.8 + (i - 2) * 0.03, 1.1, 0.05], 0.006, 4);
  }
  light(m, [0, 1.9, -0.4], "#ffe3b0", 1.4, 5);
  return m;
}

function priceBoard(): Model {
  const m = new Model();
  const p = panel(
    1.3,
    1.5,
    (g, cw, ch) => {
      g.fillStyle = "#2f3b37";
      g.fillRect(0, 0, cw, ch);
      g.strokeStyle = "#c98e22";
      g.lineWidth = 2;
      g.strokeRect(3, 3, cw - 6, ch - 6);
      g.fillStyle = "#ffe28a";
      g.textAlign = "center";
      g.font = "bold 18px system-ui, sans-serif";
      g.fillText("THE MENU", cw / 2, 28);
      g.font = "12px system-ui, sans-serif";
      g.fillStyle = "#f1ede0";
      const lines = [
        ["Hairstyle", "free"],
        ["Hair colour", "free"],
        ["Skin tone", "free"],
        ["Hygge moustache", "100"],
        ["Viking beard", "380"],
        ["Nerd specs", "60"],
        ["Shades", "100"],
        ["Heart glasses", "150"],
        ["Bot mask", "950"],
        ["Laser eyes", "1800"],
      ] as const;
      lines.forEach(([a, b], i) => {
        g.textAlign = "left";
        g.fillText(a, 12, 56 + i * 17);
        g.textAlign = "right";
        g.fillStyle = b === "free" ? "#8fe3a0" : "#f5c842";
        g.fillText(b, cw - 12, 56 + i * 17);
        g.fillStyle = "#f1ede0";
      });
    },
    { px: 96, frame: "#5b3a24" },
  );
  p.position.set(0, 0.5, 0.0);
  m.add(p);
  m.box([0.05, 0.5, 0.05], C.woodDark, [-0.5, 0, -0.04], 0.01);
  m.box([0.05, 0.5, 0.05], C.woodDark, [0.5, 0, -0.04], 0.01);
  return m;
}

function magazineTable(): Model {
  const m = new Model();
  m.cyl(0.35, 0.05, C.woodDark, [0, 0.4, 0], 0.35, 14);
  m.cyl(0.04, 0.4, C.woodDark, [0, 0, 0], 0.04, 8);
  m.cyl(0.18, 0.03, C.woodDark, [0, 0, 0], 0.18, 10);
  for (const [i, c] of [RED, BLUE, "#f5c842"].entries()) {
    const mag = m.box([0.22, 0.012, 0.3], c, [-0.1 + i * 0.1, 0.45 + i * 0.012, 0], 0.003);
    mag.rotation.y = i * 0.5 - 0.4;
  }
  return m;
}

// MARK: The room

function buildInterior(): ReturnType<ShopSpec["buildInterior"]> {
  const room = new Room(W, D, { floor: "#3b4150", wall: "#c3e0d4", stripe: "#a6cdbd", bare: true });
  room.setDecor({ floor: { texture: checker("#eee6d4", "#3b4150", 4), span: 4, color: "#9aa3ad" } });
  const displays: { item: ShopItem; at: [number, number]; world?: [number, number, number] }[] = [];
  spots.clear();
  const put = (a: Asset, x: number, z: number, turn: Turn = 0) => room.place(a, x, z, turn);

  // North wall: wigs, swatches, faces, beards, skin.
  put(asset("barber:wigs", "Wig wall", 6, 1, wigWall), 0, 0);
  put(asset("barber:swatches", "Colour swatch wall", 4, 1, swatchWall), 6, 0);
  put(asset("barber:faces", "Face rack", 6, 1, faceRack), 10, 0);
  put(asset("barber:beards", "Moustache and beard bar", 2, 1, beardBar), 16, 0);
  put(asset("barber:skin", "Skin-tone chart", 2, 1, skinChart), 18, 0);

  const show = (row: BarberRow, at: [number, number]) => {
    displays.push({ item: itemOf(row.id), at });
  };
  for (const [i, r] of STYLE_ROWS.entries()) show(r, [1 + i, 1]);
  for (const [i, r] of HAIR_ROWS.entries()) show(r, [6 + Math.round((i * 3) / 5), 1]);
  const plainFaces = FACE_ROWS.filter((r) => !(FACIAL_HAIR_IDS as readonly string[]).includes(r.id));
  for (const [i, r] of plainFaces.entries()) show(r, [10 + (i % 6), 1]);
  for (const [i, id] of FACIAL_HAIR_IDS.entries())
    show(
      FACE_ROWS.find((r) => r.id === id)!,
      [16 + i, 1],
    );
  for (const [i, r] of SKIN_ROWS.entries()) show(r, [18 + (i % 2), 1]);

  // West wall: three mirror stations, a chair each, the shampoo sinks and the towel warmer.
  const chairs: Placed[] = [];
  for (const [i, z] of [1, 3, 5].entries()) {
    put(
      asset(`barber:station-${i}`, "Mirror station", 2, 1, () => station(i)),
      0,
      z,
      1,
    );
    chairs.push(
      put(
        asset(`barber:chair-${i}`, "Barber chair", 2, 1, barberChair, {
          seat: { at: [0, 0.52, 0], turn: 0 },
        }),
        1,
        z,
        3,
      ),
    );
  }
  put(asset("barber:sinks", "Shampoo sinks", 2, 1, sinks), 0, 7, 1);
  put(asset("barber:towels", "Hot towel cabinet", 1, 1, towelWarmer), 0, 9, 1);
  put(assetById.get("plant")!, 0, 10);

  // The seats' customers and the apprentices.
  const hairFloor: [number, number][] = [];
  const customers: { avatar: Avatar; update: (dt: number, t: number) => void }[] = [];
  const helpers: { a: Avatar; phase: number }[] = [];
  const seatAt = (p: Placed) => {
    const c = room.seatOf(p)!;
    return c.at;
  };
  const cust = [
    { skin: SKIN_COLOURS[2]!, hair: HAIR_COLOURS[4]!, style: 0, cape: BLUE, trim: "#fbf7ef", beard: 1 },
    { skin: SKIN_COLOURS[0]!, hair: HAIR_COLOURS[2]!, style: 2, cape: "#2b2433", trim: "#f5c842", beard: 0 },
  ];
  cust.forEach((c, i) => {
    const chair = chairs[i]!;
    const at = seatAt(chair);
    const s = makeCustomer(c.skin, c.hair, c.style, c.cape, c.trim, c.beard, i);
    s.avatar.root.position.set(at.x + 0.1, 0.5, at.z);
    s.avatar.root.rotation.y = -Math.PI / 2;
    room.group.add(s.avatar.root);
    customers.push(s);
    const ap = makeApprentice(
      i ? SKIN_COLOURS[1]! : SKIN_COLOURS[3]!,
      i ? HAIR_COLOURS[1]! : HAIR_COLOURS[0]!,
    );
    ap.root.position.set(at.x + 0.62, 0.02, at.z + (i ? -0.1 : 0.1));
    ap.root.rotation.y = -Math.PI / 2;
    room.group.add(ap.root);
    helpers.push({ a: ap, phase: i * 1.7 });
    nameChip(ap, i ? "Mads" : "Freja", "apprentice");
    hairFloor.push([at.x + 0.2, at.z]);
  });
  // The third chair waits, with a cape folded on it.
  hairFloor.push([seatAt(chairs[2]!).x + 0.2, seatAt(chairs[2]!).z]);
  const cape = new Model();
  cape.box([0.46, 0.04, 0.34], RED, [0, 0, 0], 0.015);
  const capeAt = seatAt(chairs[2]!);
  cape.position.set(capeAt.x, 0.52, capeAt.z);
  room.group.add(cape);
  const floor = new Model();
  clippings(floor, [...HAIR_COLOURS], hairFloor[0]!, 3);
  clippings(floor, [HAIR_COLOURS[2]!, HAIR_COLOURS[0]!], hairFloor[1]!, 5);
  clippings(floor, [HAIR_COLOURS[1]!], hairFloor[2]!, 9);
  room.group.add(floor);
  const sweeper = broom();
  sweeper.position.set(1.0, 0.02, 8.9);
  sweeper.rotation.set(0, 0.4, 0.7);
  room.group.add(sweeper);

  // South-east: the counter, the shopkeeper behind it, the menu, the door.
  const counterAt: [number, number] = [15, 8];
  put(asset("barber:counter", "Counter", 4, 1, counter), 14, 8);
  put(asset("barber:menu", "The menu", 1, 1, priceBoard), 18, 8);
  put(assetById.get("plant")!, 19, 9);
  const doorAt: [number, number] = [10, 10];
  const door = exitDoorway({ outside: true, wall: "#c3e0d4", leaf: BLUE });
  door.position.set(10.5, 0, D + 0.5);
  door.rotation.y = Math.PI;
  room.group.add(door);
  put(assetById.get("lamp")!, 12, 10);

  // The waiting corner, east: sofa, magazine table, plant, and someone waiting.
  const sofa = put(assetById.get("sofa")!, 18, 3, 3);
  put(asset("barber:mag-table", "Magazine table", 1, 1, magazineTable), 16, 4);
  put(assetById.get("plant")!, 19, 1);
  put(assetById.get("rug")!, 16, 2);
  put(assetById.get("rug")!, 9, 8);
  const reader = makeReader();
  const seat = room.seatOf(sofa)!;
  reader.avatar.root.position.set(seat.at.x, seat.at.y - 0.02, seat.at.z);
  reader.avatar.root.rotation.y = seat.turn;
  room.group.add(reader.avatar.root);

  // Figaro, at the till.
  const barber = makeBarber();
  barber.root.position.set(16.0, 0.02, 7.55);
  room.group.add(barber.root);
  nameChip(barber, "Figaro", "barber");
  chatter(barber, [
    "Welcome in! Trim, colour or a brand new face?",
    "Every style is free. The moustache is a hundred coins.",
    "Lean back, I will have you looking sharp.",
    "Hot towel with every beard.",
  ]);

  // Everyone moves.
  let last = 0;
  ticks.push((t) => {
    const dt = Math.min(0.1, Math.max(0, t - last));
    last = t;
    animateBarber(barber, dt, t);
    for (const c of customers) c.update(dt, t);
    reader.update(dt, t);
    for (const h of helpers) animateApprentice(h.a, dt, t, h.phase);
  });

  // Each display where its things stand, in the room's own frame: the middle of all of them (a style's row of wigs,
  // a moustache's two heads), not its floor tile.
  room.group.updateMatrixWorld(true);
  const box = new THREE.Box3();
  for (const d of displays) {
    const on = spots.get(d.item.id);
    if (!on) continue;
    box.makeEmpty();
    for (const o of on) box.expandByObject(o);
    const v = box.getCenter(new THREE.Vector3());
    d.world = [v.x, v.y, v.z];
  }

  return { room, displays, shopkeeper: barber, counter: counterAt, door: doorAt };
}

export const SHOP_BARBER: ShopSpec = {
  id: "barber",
  name: "The Barber",
  sign: "BARBER & SALON",
  items: BARBER_ITEMS,
  exterior,
  footprint: { w: 5, d: 4 },
  buildInterior,
};
