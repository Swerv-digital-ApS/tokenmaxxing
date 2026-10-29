/**
 * THREAD & TOKEN, the Clothes shop: a walk-in boutique with every outfit, hat, face piece, held item, back
 * item and company-merch piece from the 2D catalogues physically on display.
 *
 * - Outfits (29) on wooden mannequins on rarity-ringed podiums, three rows deep; the locked ones (level
 *   rewards, boss drops) stand under glass with a padlock.
 * - Back items (7) on mannequins turned away so the cape or wings face you.
 * - Hats (45) on display heads on the north wall, face pieces (29) on the west wall, held items (10) below them.
 * - A merch table, a fitting-room curtain, and a mirror with a try-on spot: `tryOn` (clothes-items.ts) puts an
 *   item on a player's look.
 * - Bree, the stylist, behind the till.
 *
 * Tiles are the room's own (x east, z south, from the north-west corner); the integrator adds the inset.
 */
import * as THREE from "three";
import { C } from "../../art/palette.ts";
import { type Asset, assetById, light } from "../furniture/furniture.ts";
import { canvasTexture, glass, glow, Model, painted, ticks, tint } from "../kit/kit.ts";
import type { Avatar } from "../people/avatar.ts";
import { avatarFor, type Look2D } from "../people/gear3d.ts";
import { exitDoorway } from "../rooms/exits3d.ts";
import { Room, type Turn } from "../rooms/room.ts";
import { clothesExterior } from "./clothes-exterior.ts";
import {
  buildClothesItems,
  isLocked,
  mannequin,
  metaOf,
  RARITY_HEX,
  type ShopItem,
} from "./clothes-items.ts";
import { bubble, CREAM, GOLD, INK, lockFor, PINK, PLUM, priceTag, signBoard } from "./clothes-parts.ts";

export { tryOn, tryOnLook2D } from "./clothes-items.ts";

// MARK: Types (a local copy of the shared contract)

export type { ShopItem } from "./clothes-items.ts";
export interface ShopSpec {
  id: "furniture" | "clothes" | "barber" | "pets";
  name: string;
  sign: string;
  items: ShopItem[];
  exterior: () => Model;
  footprint: { w: number; d: number };
  buildInterior: () => {
    room: Room;
    displays: { item: ShopItem; at: [number, number] }[];
    shopkeeper: Avatar;
    counter: [number, number];
    door: [number, number];
  };
}

/** What the interior adds beyond the contract. */
export interface ClothesInterior {
  room: Room;
  displays: {
    item: ShopItem;
    at: [number, number];
    /** Room-local position of the item itself, for picking by ray. */ world: [number, number, number];
  }[];
  shopkeeper: Avatar;
  counter: [number, number];
  door: [number, number];
  /** The fitting-room mirror: stand on `spot` (a tile) to see yourself; `mirror` is the glass's centre. */
  fitting: { spot: [number, number]; mirror: [number, number, number]; curtain: [number, number] };
  /** Per-frame work the shop does by itself (the keeper's idle, her bubble). Also run from `kit.ticks`. */
  update: (dt: number, t: number) => void;
}

export const SHOPKEEPER = { name: "Bree", title: "Stylist" };

// MARK: Layout

const W = 22;
const D = 15;
const FLOOR = "#c8a47c";
const WALL = "#f3e6d6";
const STRIPE = "#e8d2c0";

const wood = "#a5784f";
const woodDark = "#6e4a30";

const asset = (id: string, w: number, d: number, build: () => Model): Asset => ({
  id,
  name: id,
  price: 0,
  w,
  d,
  build,
});

/** Shrinks a preview to fit a box, keeps its feet on the ground, and centres it. */
function fitted(preview: Model, maxW: number, maxH: number, cap = 1): Model {
  const holder = new Model();
  holder.add(preview);
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(preview);
  const size = box.getSize(new THREE.Vector3());
  const s = Math.min(cap, maxW / Math.max(size.x, 0.01), maxH / Math.max(size.y, 0.01));
  preview.scale.setScalar(s);
  holder.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(preview);
  preview.position.set(-(b2.min.x + b2.max.x) / 2, -b2.min.y, -(b2.min.z + b2.max.z) / 2);
  return holder;
}

interface Placement {
  item: ShopItem;
  holder: THREE.Object3D;
  tile: [number, number];
}

// MARK: Wall shelves

interface ShelfOpts {
  w: number;
  tiers: number[];
  per: number;
  maxH: number;
  cap: number;
  tagH?: number;
}

/**
 * A pegboard wall with shelves, `w` tiles long and one deep (its back on `z = -0.5`). Items stand on the
 * boards in rows of `per`, a price tag on each board's lip and a padlock on what can't be bought.
 */
function shelfWall(
  items: ShopItem[],
  o: ShelfOpts,
): { model: Model; spots: { item: ShopItem; holder: THREE.Object3D; x: number }[] } {
  const m = new Model();
  const spots: { item: ShopItem; holder: THREE.Object3D; x: number }[] = [];
  const back = -0.5;
  m.box([o.w, 2.5, 0.044], "#ead7c4", [0, 0, back], 0.01);
  m.box([o.w + 0.1, 0.1, 0.12], woodDark, [0, 0, back + 0.03], 0.01);
  m.box([o.w + 0.1, 0.08, 0.12], woodDark, [0, 2.5, back + 0.03], 0.01);
  // Pegboard dots.
  const dots = canvasTexture(
    16,
    16,
    (g) => {
      g.fillStyle = "#ead7c4";
      g.fillRect(0, 0, 16, 16);
      g.fillStyle = "#d9bfa6";
      g.fillRect(3, 3, 2, 2);
      g.fillRect(11, 11, 2, 2);
    },
    false,
  );
  dots.wrapS = dots.wrapT = THREE.RepeatWrapping;
  dots.repeat.set(o.w * 3, 8);
  m.plane(o.w, 2.45, painted(dots), [0, 1.25, back + 0.036]);
  const gap = o.w / o.per;
  const tagH = o.tagH ?? 0.22;
  o.tiers.forEach((y, ti) => {
    m.box([o.w, 0.05, 0.38], wood, [0, y - 0.05, back + 0.2], 0.01);
    m.box([o.w, 0.03, 0.02], GOLD, [0, y - 0.04, back + 0.4], 0.004);
    for (let k = 0; k <= o.per; k += 3)
      m.box([0.04, 0.12, 0.3], woodDark, [-o.w / 2 + k * gap, y - 0.17, back + 0.2], 0.008);
    for (let c = 0; c < o.per; c++) {
      const item = items[ti * o.per + c];
      if (!item) continue;
      const x = -o.w / 2 + (c + 0.5) * gap;
      const rarity = RARITY_HEX[metaOf.get(item.id)?.rarity ?? "common"];
      const holder = fitted(item.preview(), gap * 0.82, o.maxH, o.cap);
      holder.position.set(x, y, back + 0.22);
      m.add(holder);
      m.cyl(gap * 0.3, 0.012, rarity, [x, y - 0.025, back + 0.22], gap * 0.3, 16);
      const tag = priceTag(item, gap - 0.06, tagH);
      tag.position.set(x, y - 0.08, back + 0.44);
      tag.rotation.x = -0.2;
      m.add(tag);
      if (isLocked(item.id)) {
        const lock = lockFor(item.id);
        lock.position.set(x + gap * 0.3, y + o.maxH * 0.72, back + 0.3);
        m.add(lock);
      }
      spots.push({ item, holder, x });
    }
  });
  return { model: m, spots };
}

// MARK: Podiums

/** A mannequin on a round podium with a rarity ring and a tag; under glass if it can't be bought. */
function podium(item: ShopItem, a: Avatar, turn: number): Model {
  const m = new Model();
  const rarity = RARITY_HEX[metaOf.get(item.id)?.rarity ?? "common"];
  m.cyl(0.46, 0.1, "#3a3040", [0, 0, 0], 0.46, 20);
  m.cyl(0.47, 0.02, rarity, [0, 0.1, 0], 0.47, 20);
  m.cyl(0.4, 0.015, "#5b4a68", [0, 0.12, 0], 0.4, 20);
  a.root.position.set(0, 0.135, 0);
  a.root.rotation.y = turn;
  m.add(a.root);
  const tag = priceTag(item, 1.15, 0.36);
  tag.position.set(0, 0.0, 0.62);
  tag.rotation.x = -0.55;
  m.add(tag);
  if (isLocked(item.id)) {
    m.cyl(0.52, 1.3, glass("#dff0ff", 0.22), [0, 0.12, 0], 0.52, 20);
    m.cyl(0.54, 0.04, GOLD, [0, 0.12, 0], 0.54, 20);
    const lock = lockFor(item.id);
    lock.scale.setScalar(1.8);
    lock.position.set(0, 1.62, 0);
    m.add(lock);
    ticks.push((t) => {
      if (lock.parent) lock.rotation.y = Math.sin(t * 1.4) * 0.5;
    });
  }
  return m;
}

/** A mannequin's stance by index: a little turn and a gesture, never an animation. */
function pose(a: Avatar, i: number): number {
  const stance = i % 5;
  if (stance === 1) a.arms[1].rotation.z = 0.55;
  if (stance === 2) a.arms[0].rotation.z = -0.5;
  if (stance === 3) {
    a.arms[0].rotation.x = -0.35;
    a.arms[1].rotation.x = 0.2;
  }
  if (stance === 4) a.legs[0].rotation.x = -0.15;
  return [0.3, -0.3, 0.12, -0.15, 0.4][stance]!;
}

// MARK: Other fixtures

function counterModel(w: number): Model {
  const m = new Model();
  m.box([w, 0.95, 0.7], woodDark, [0, 0, 0], 0.03);
  m.box([w + 0.12, 0.07, 0.86], "#f1e7d8", [0, 0.95, 0], 0.02);
  m.box([w - 0.2, 0.55, 0.02], PLUM, [0, 0.2, 0.36], 0.006);
  m.box([w - 0.2, 0.03, 0.025], GOLD, [0, 0.78, 0.37], 0.004);
  // The till.
  m.box([0.42, 0.18, 0.34], "#3a3040", [-w / 2 + 0.9, 1.02, 0.0], 0.02);
  m.box([0.34, 0.2, 0.04], "#a8dcf7", [-w / 2 + 0.9, 1.2, -0.08], 0.01).rotation.x = -0.4;
  // Gift bags, a card reader, a tape measure and a pin cushion.
  for (const [x, c] of [
    [0.7, PINK],
    [1.05, GOLD],
    [1.4, "#8fb8ff"],
  ] as const) {
    m.box([0.28, 0.4, 0.14], c, [x, 1.02, -0.05], 0.02);
    m.box([0.18, 0.02, 0.01], CREAM, [x, 1.38, -0.05]);
  }
  m.box([0.14, 0.04, 0.1], "#3a3040", [-0.4, 1.02, 0.12], 0.01);
  m.cyl(0.07, 0.03, "#f5d14a", [0.1, 1.02, 0.15], 0.07, 12);
  m.ball(0.07, "#d23c3c", [-1.1, 1.08, 0.12], [1, 0.7, 1], 10);
  for (let i = 0; i < 6; i++)
    m.cyl(0.004, 0.06, "#f4efe4", [-1.1 + Math.cos(i) * 0.03, 1.1, 0.12 + Math.sin(i) * 0.03], 0.004, 4);
  return m;
}

function table(w: number, d: number): Model {
  const m = new Model();
  m.box([w, 0.08, d], "#f1e7d8", [0, 0.72, 0], 0.02);
  m.box([w - 0.1, 0.3, d - 0.1], PLUM, [0, 0.42, 0], 0.02);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      m.cyl(0.04, 0.42, woodDark, [sx * (w / 2 - 0.12), 0, sz * (d / 2 - 0.12)], 0.04, 8);
  return m;
}

function runner(w: number, d: number): Model {
  const m = new Model();
  m.box([w - 0.05, 0.025, d - 0.1], "#c76f8f", [0, 0, 0], 0.01);
  m.box([w - 0.2, 0.03, d - 0.28], "#d98aa6", [0, 0, 0], 0.01);
  m.box([w - 0.05, 0.032, 0.03], GOLD, [0, 0, (d - 0.1) / 2 - 0.05], 0.004);
  m.box([w - 0.05, 0.032, 0.03], GOLD, [0, 0, -(d - 0.1) / 2 + 0.05], 0.004);
  return m;
}

/** The merch table: one of each piece on a riser, a tag in front, a banner behind. */
function merchTable(items: ShopItem[], spots: { item: ShopItem; holder: THREE.Object3D }[]): Model {
  const m = table(5, 2);
  const gap = 5 / items.length;
  items.forEach((item, i) => {
    const x = -2.5 + (i + 0.5) * gap;
    const rarity = RARITY_HEX.common;
    m.cyl(0.38, 0.1, "#fbf4ea", [x, 0.76, -0.1], 0.38, 16);
    m.cyl(0.39, 0.02, rarity, [x, 0.85, -0.1], 0.39, 16);
    const holder = fitted(item.preview(), 0.7, 0.65, 2.4);
    holder.position.set(x, 0.87, -0.1);
    m.add(holder);
    const tag = priceTag(item, 0.95, 0.3);
    tag.position.set(x, 0.8, 0.62);
    tag.rotation.x = -0.45;
    m.add(tag);
    spots.push({ item, holder });
  });
  for (const s of [-1, 1]) m.cyl(0.03, 1.1, woodDark, [s * 2.2, 0.8, -0.8], 0.03, 8);
  const banner = signBoard("COMPANY MERCH", 3.6, 0.5, {
    sub: "every company's colours · outsiders pay, the company earns",
  });
  banner.position.set(0, 1.55, -0.85);
  m.add(banner);
  return m;
}

/** A tall mirror on the north wall with a gilt frame. */
function mirrorModel(w: number, h: number): Model {
  const m = new Model();
  const tex = canvasTexture(
    32,
    64,
    (g) => {
      const grad = g.createLinearGradient(0, 0, 32, 64);
      grad.addColorStop(0, "#e6f4ff");
      grad.addColorStop(0.5, "#b9d9ee");
      grad.addColorStop(1, "#9cc2dc");
      g.fillStyle = grad;
      g.fillRect(0, 0, 32, 64);
      g.fillStyle = "rgba(255,255,255,0.55)";
      for (const [x, wd] of [
        [6, 3],
        [12, 1],
      ] as const)
        for (let y = 0; y < 64; y++) g.fillRect(x + Math.floor(y / 4), y, wd, 1);
    },
    false,
  );
  m.box([w + 0.24, h + 0.24, 0.1], GOLD, [0, 0, 0], 0.03);
  m.box([w + 0.12, h + 0.12, 0.11], tint(GOLD, -0.25), [0, 0.0, 0.0], 0.02);
  m.plane(w, h, glow("#fff", tex), [0, (h + 0.12) / 2 - 0.0, 0.06]);
  m.ball(0.09, GOLD, [0, h + 0.28, 0.02]);
  return m;
}

/** A glowing try-on ring on the floor. */
function tryOnSpot(): Model {
  const m = new Model();
  m.cyl(0.62, 0.05, "#3a3040", [0, 0, 0], 0.62, 24);
  const ring = m.cyl(0.55, 0.06, glow(GOLD), [0, 0.0, 0], 0.55, 24);
  m.cyl(0.5, 0.07, "#5b4a68", [0, 0, 0], 0.5, 24);
  void ring;
  m.box([0.16, 0.01, 0.08], GOLD, [-0.1, 0.08, 0.1], 0.003);
  m.box([0.16, 0.01, 0.08], GOLD, [0.1, 0.08, 0.1], 0.003);
  return m;
}

/** The fitting room: a corner stall 4 wide and 3 deep, partitions, a rail and a half-drawn curtain. */
function fittingRoom(): Model {
  const m = new Model();
  const w = 4;
  const d = 3;
  const h = 2.35;
  // Floor, the west partition and the lintel; the north and east sides are the room's own walls.
  m.box([w, 0.04, d], "#6b3f6e", [0, 0, 0], 0.01);
  m.box([0.12, h, d], "#8a5a86", [-w / 2 + 0.06, 0, 0], 0.02);
  m.box([w - 0.02, 0.5, 0.12], "#8a5a86", [0, h - 0.5, d / 2 - 0.06], 0.02);
  m.box([0.1, h - 0.004, 0.108], woodDark, [w / 2 - 0.05, 0, d / 2 - 0.06], 0.01);
  m.box([0.1, h - 0.004, 0.108], woodDark, [-w / 2 + 0.12, 0, d / 2 - 0.06], 0.01);
  // A bench, hooks with clothes, a little mirror, a bag on the floor.
  m.box([1.0, 0.1, 0.4], wood, [0.9, 0.4, -d / 2 + 0.4], 0.02);
  for (const x of [0.5, 1.3]) m.box([0.07, 0.4, 0.3], woodDark, [x, 0, -d / 2 + 0.4], 0.01);
  for (const [x, c] of [
    [-1.2, "#d98aa6"],
    [-0.8, "#8fb8ff"],
    [-0.4, GOLD],
  ] as const) {
    m.box([0.34, 0.6, 0.06], c, [x, 1.1, -d / 2 + 0.1], 0.02);
    m.box([0.2, 0.04, 0.04], woodDark, [x, 1.72, -d / 2 + 0.1]);
  }
  m.box([0.35, 0.22, 0.22], PINK, [0.9, 0.5, -d / 2 + 0.4], 0.04);
  // The rail and the curtains, drawn to the sides with a gap of about a tile and a half.
  m.cyl(0.02, w, woodDark, [0, h - 0.1, d / 2 - 0.02], 0.02, 6).rotation.z = Math.PI / 2;
  const sign = signBoard("FITTING ROOM", 1.6, 0.26);
  sign.position.set(0, h + 0.05, d / 2 - 0.02);
  m.add(sign);
  for (const s of [-1, 1]) {
    const folds = 6;
    for (let i = 0; i < folds; i++) {
      const x = s * (w / 2 - 0.15 - i * 0.2);
      if (Math.abs(x) < 0.7) break;
      const c = m.box([0.24, h - 0.4, 0.1], i % 2 ? "#e8789a" : "#c75a7e", [x, 0.12, d / 2 - 0.02], 0.02);
      c.scale.z = 1 + (i % 2) * 0.4;
    }
    m.cyl(0.03, 0.12, GOLD, [s * 0.72, 1.0, d / 2 + 0.03], 0.03, 6);
  }
  light(m, [0, 2.0, 0.3], "#ffd9a8", 1.6, 5);
  return m;
}

// MARK: The shopkeeper

const GREETINGS = [
  "Welcome to Thread & Token!",
  "Try anything on, darling.",
  "The Gold suit is you.",
  "Locked? Earn it, then wear it.",
  "Company merch is by the window.",
  "That hat? Stunning.",
];

function makeShopkeeper(): { avatar: Avatar; update: (dt: number, t: number) => void } {
  const look: Look2D = { style: 2, skin: 1, hair: 5, outfit: 28, glasses: 9 };
  const avatar = avatarFor(look, { level: 22 });
  // A pink silk scarf and a tape measure round the neck.
  const b = avatar.body;
  b.box([0.3, 0.06, 0.2], PINK, [0, 0.72, 0], 0.02);
  b.box([0.06, 0.26, 0.02], PINK, [0.06, 0.5, 0.11], 0.008);
  b.box([0.04, 0.3, 0.015], "#f5d14a", [-0.08, 0.48, 0.108], 0.004);
  const { sprite, say } = bubble(GREETINGS, `${SHOPKEEPER.name} · ${SHOPKEEPER.title}`);
  sprite.position.set(0, avatar.height + 0.12, 0);
  avatar.root.add(sprite);
  let i = 0;
  let next = 0;
  let wave = 0;
  return {
    avatar,
    update(dt, t) {
      if (t > next) {
        say(GREETINGS[i++ % GREETINGS.length]!);
        next = t + 6;
        wave = t + 1.6;
      }
      avatar.pose = t < wave ? "wave" : "stand";
      avatar.talking = t < wave;
      avatar.update(dt, t);
    },
  };
}

// MARK: The room

export function buildClothesInterior(items = buildClothesItems()): ClothesInterior {
  const room = new Room(W, D, { floor: FLOOR, wall: WALL, stripe: STRIPE, bare: true });
  const placements: Placement[] = [];
  const put = (a: Asset, x: number, z: number, turn: Turn = 0, model?: Model) =>
    room.place(a, x, z, turn, model);

  // Runners under the aisles between the mannequin rows.
  for (const z of [5, 7, 9])
    put(
      asset("rug", 20, 1, () => runner(20, 1)),
      1,
      z,
    );
  put(
    asset("rug", 3, 3, () => runner(3, 3)),
    15,
    1,
  );
  put(
    asset("rug", 5, 2, () => runner(5, 2)),
    8,
    13,
  );

  // Hats along the north wall, face pieces and held items down the west.
  const hats = shelfWall(items.hats, {
    w: 13,
    tiers: [0.42, 1.2, 1.98],
    per: 15,
    maxH: 0.62,
    cap: 0.72,
    tagH: 0.2,
  });
  put(
    asset("hat-wall", 13, 1, () => hats.model),
    1,
    0,
    0,
    hats.model,
  );
  const faces = shelfWall(items.faces, {
    w: 7,
    tiers: [0.42, 1.2, 1.98],
    per: 10,
    maxH: 0.58,
    cap: 0.66,
    tagH: 0.2,
  });
  put(
    asset("face-wall", 7, 1, () => faces.model),
    0,
    1,
    1,
    faces.model,
  );
  const held = shelfWall(items.held, { w: 7, tiers: [0.6, 1.5], per: 5, maxH: 0.7, cap: 1, tagH: 0.26 });
  put(
    asset("held-wall", 7, 1, () => held.model),
    0,
    8,
    1,
    held.model,
  );
  for (const s of hats.spots)
    placements.push({ item: s.item, holder: s.holder, tile: [Math.floor(1 + 6.5 + s.x), 0] });
  for (const s of faces.spots) {
    // The west wall runs along z; the shelf's local x maps to world z (turned a quarter).
    placements.push({ item: s.item, holder: s.holder, tile: [0, Math.floor(1 + 3.5 - s.x)] });
  }
  for (const s of held.spots)
    placements.push({ item: s.item, holder: s.holder, tile: [0, Math.floor(8 + 3.5 - s.x)] });

  // Outfit mannequins, ten to a row, three rows.
  items.outfits.forEach((item, i) => {
    const row = Math.floor(i / 10);
    const x = 2 + (i % 10) * 2;
    const z = 4 + row * 2;
    const meta = metaOf.get(item.id)!;
    const a = mannequin({ style: 0, skin: 0, hair: 1, outfit: meta.index });
    const m = podium(item, a, pose(a, i));
    put(
      asset(`pod:${item.id}`, 1, 1, () => m),
      x,
      z,
      0,
      m,
    );
    placements.push({ item, holder: a.root, tile: [x, z] });
  });
  // Back items, their mannequins turned away so the cape faces the room.
  items.backs.forEach((item, i) => {
    const meta = metaOf.get(item.id)!;
    const x = 2 + i * 2;
    const a = mannequin({ style: 0, skin: 0, hair: 1, outfit: 13 + ((i * 3) % 6), back: meta.index });
    const m = podium(item, a, Math.PI + [0.25, -0.2, 0.1, -0.3][i % 4]!);
    put(
      asset(`pod:${item.id}`, 1, 1, () => m),
      x,
      10,
      0,
      m,
    );
    placements.push({ item, holder: a.root, tile: [x, 10] });
  });

  // The merch table.
  const merchSpots: { item: ShopItem; holder: THREE.Object3D }[] = [];
  const mt = merchTable(items.merch, merchSpots);
  put(
    asset("merch-table", 5, 2, () => mt),
    16,
    10,
    0,
    mt,
  );
  for (const s of merchSpots)
    placements.push({
      item: s.item,
      holder: s.holder,
      tile: [16 + Math.floor((merchSpots.indexOf(s) + 0.5) * (5 / merchSpots.length)), 10],
    });

  // The till, with Bree behind it (north of the counter, facing the customers).
  put(
    asset("counter", 6, 1, () => counterModel(6)),
    8,
    12,
    0,
  );
  const keeper = makeShopkeeper();
  keeper.avatar.root.position.set(14.6, 0.02, 12.6);
  room.group.add(keeper.avatar.root);
  const counterSign = signBoard("THREAD & TOKEN", 1.5, 0.26);
  counterSign.position.set(12.2, 1.02, 12.25);

  // The fitting room, the mirror and the try-on spot.
  const stall = fittingRoom();
  put(
    asset("fitting-room", 4, 3, () => stall),
    18,
    0,
    0,
    stall,
  );
  const mirror = mirrorModel(2.2, 1.7);
  mirror.position.set(16.5, 0.55, 0.06);
  room.group.add(mirror);
  const spot = tryOnSpot();
  spot.position.set(16.5, 0, 1.7);
  room.group.add(spot);
  const mirrorSign = signBoard("TRY IT ON", 1.3, 0.2);
  mirrorSign.position.set(16.5, 2.55, 0.06);
  room.group.add(mirrorSign);

  // The way out, plants, lamps.
  const door = exitDoorway({ outside: true, wall: WALL, leaf: PLUM });
  door.position.set(5.5, 0, D + 0.5);
  door.rotation.y = Math.PI;
  room.group.add(door);
  for (const [x, z] of [
    [0, 0],
    [1, 14],
    [21, 14],
    [21, 9],
  ] as const)
    put(assetById.get("plant")!, x, z);
  const lamps = new Model();
  for (const [x, y, z, c, i] of [
    [4, 2.3, 1.6, "#ffd9a8", 2.2],
    [11, 2.3, 1.6, "#ffd9a8", 2.2],
    [1.5, 2.3, 5, "#ffd9a8", 2],
    [1.5, 2.3, 11, "#ffd9a8", 2],
    [8, 2.3, 7, "#ffe6c4", 2.4],
    [15, 2.3, 7, "#ffe6c4", 2.4],
    [11, 2.0, 13, "#ffe6c4", 2],
    [18.5, 2.0, 9.4, "#ffe6c4", 1.8],
    [16.5, 2.2, 2.4, "#fff0d8", 2],
  ] as const)
    light(lamps, [x, y, z], c, i * 1.8, 9);
  room.group.add(lamps, counterSign);

  // Positions of what's on display, in the room's own frame: the middle of each model, where the pointer finds
  // it (its holder is the foot of its stand, a shelf lower than the thing itself).
  room.group.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const displays = placements.map((p) => {
    const v = box.setFromObject(p.holder).getCenter(new THREE.Vector3());
    return { item: p.item, at: p.tile, world: [v.x, v.y, v.z] as [number, number, number] };
  });

  const update = (dt: number, t: number) => keeper.update(dt, t);
  let last = performance.now() / 1000;
  const tick = (t: number) => {
    if (!keeper.avatar.root.parent) return;
    update(Math.min(0.1, t - last), t);
    last = t;
  };
  ticks.push(tick);

  return {
    room,
    displays,
    shopkeeper: keeper.avatar,
    counter: [11, 12],
    door: [5, D - 1],
    fitting: { spot: [16, 1], mirror: [16.5, 1.4, 0.1], curtain: [20, 3] },
    update,
  };
}

// MARK: The spec

const catalogue = buildClothesItems();
export const CLOTHES_ITEMS: ShopItem[] = [
  ...catalogue.outfits,
  ...catalogue.hats,
  ...catalogue.faces,
  ...catalogue.held,
  ...catalogue.backs,
  ...catalogue.merch,
];

export const SHOP_CLOTHES: ShopSpec = {
  id: "clothes",
  name: "Thread & Token",
  sign: "THREAD & TOKEN",
  items: CLOTHES_ITEMS,
  exterior: clothesExterior,
  footprint: { w: 5, d: 4 },
  buildInterior: () => buildClothesInterior(catalogue),
};

void C;
void CREAM;
void INK;
void PLUM;
