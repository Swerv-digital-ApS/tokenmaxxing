/**
 * The Clothes shop's catalogue as shop items: every outfit, hat, face piece, held item, back item and the
 * company merch, each with a small 3D `preview()` built from the same builders the avatars wear
 * (`gear3dHead.ts`, `gear3dBody.ts`, `merch3d.ts`). Plus the fitting-room hook `tryOn`.
 */

import { onSale } from "@tokenmaxxing/core/costumes.ts";
import { itemById } from "@tokenmaxxing/core/shop.ts";
import { type Model, ticks } from "../kit/kit.ts";
import { Avatar, type Look } from "../people/avatar.ts";
import { type Look2D, type LookOptions, lookFrom2D } from "../people/gear3d.ts";
import { BACK_BUILDERS, HELD_BUILDERS } from "../people/gear3dBody.ts";
import { band, FACE_BUILDERS, HAT_BUILDERS } from "../people/gear3dHead.ts";
import { merchProp } from "../people/merch3d.ts";
import { VoxModel } from "../people/voxgear.ts";
import { CLOTHES, type ClothesRow, FREE_OUTFIT_NAMES, MERCH_PIECES, type Rarity } from "./data/clothes.ts";

export interface ShopItem {
  id: string;
  name: string;
  price: number;
  level?: number;
  group?: string;
  /** A small 3D model of the item (for shelves/rails/pens and for the buy panel) */
  preview: () => Model;
}

/** What the shop knows about an item beyond the contract: rarity colour, locks, which slot. */
export interface ClothesMeta {
  slot: ClothesRow["slot"] | "merch";
  /** The value of `look[slot]` when worn (a merch piece's bit). */
  index: number;
  rarity: Rarity;
  /** Level reward (never sold) */
  level?: number;
  /** Raid loot: never sold, a boss drops it. */
  boss?: string;
  /** Free from the start (the eight plain tees). */
  free?: boolean;
}

export const metaOf = new Map<string, ClothesMeta>();

export const RARITY_HEX: Record<Rarity, string> = {
  common: "#c9ced6",
  uncommon: "#3ddc84",
  rare: "#4fa8ff",
  epic: "#c38bff",
  legendary: "#ffb347",
};
const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

/** Can the player not simply buy it? A level reward or a boss drop. */
export const isLocked = (id: string): boolean => {
  const m = metaOf.get(id);
  return !!m && (m.level !== undefined || m.boss !== undefined);
};

// MARK: Previews

/** Keeps `fn` running while `obj` is in a scene; stops once it has left (or never arrived). */
function alive(obj: Model, fn: (t: number) => void): void {
  let seen = false;
  let waited = 0;
  const tick = (t: number) => {
    let o: Model["parent"] = obj;
    while (o?.parent) o = o.parent;
    const inScene = !!o && (o as { isScene?: boolean }).isScene === true;
    if (inScene) {
      seen = true;
      fn(t);
      return;
    }
    if (seen || ++waited > 900) {
      const i = ticks.indexOf(tick);
      if (i >= 0) ticks.splice(i, 1);
    }
  };
  ticks.push(tick);
}

const MANNEQUIN = { skin: "#d9c4a0", hair: "#b79a6c" };
const HEAD_Y = 0.37;

/** A pale display head on a post, `0.5` across, its centre at `HEAD_Y`. */
function bust(m: Model): Model {
  m.cyl(0.16, 0.03, "#3a3040", [0, 0, 0], 0.16, 12);
  m.cyl(0.035, 0.14, "#6b5a7a", [0, 0.02, 0], 0.035, 8);
  m.ball(0.25, MANNEQUIN.skin, [0, HEAD_Y, 0], [1, 1.04, 1], 16);
  return m.part([0, HEAD_Y, 0]);
}

const CTX = (m: Model) => ({
  skin: MANNEQUIN.skin,
  hair: MANNEQUIN.hair,
  outfit: ["#8aa0c8", "#6b82ad"] as [string, string],
  pants: "#3d4a6b",
  tick: (fn: (t: number) => void) => alive(m, fn),
});

/** The three hats the avatar draws itself, redrawn for a display head. */
const OWN_HATS: Record<string, (h: Model) => void> = {
  Beanie: (h) => {
    h.ball(0.27, "#d8553f", [0, 0.06, 0], [1, 0.85, 1], 16);
    h.cyl(0.275, 0.07, "#a8402f", [0, -0.01, 0], 0.275, 16);
    h.ball(0.05, "#f4efe4", [0, 0.28, 0]);
  },
  Headphones: (h) => {
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI;
      h.box([0.045, 0.045, 0.06], "#2b2f3a", [Math.cos(a) * 0.27, Math.sin(a) * 0.27 - 0.02, 0], 0.01);
    }
    for (const s of [-1, 1]) {
      const cup = h.cyl(0.095, 0.07, "#e0584f", [s * 0.27, -0.12, 0], 0.095, 14);
      cup.rotation.z = Math.PI / 2;
      cup.position.x = s * 0.27;
      cup.position.y = -0.12;
    }
  },
  Crown: (h) => {
    band(h, "#f5c842", 0.2, 0.1, 0.2);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      h.cyl(0.04, 0.1, "#f5c842", [Math.cos(a) * 0.19, 0.3, Math.sin(a) * 0.19], 0.0, 4);
      h.ball(0.022, i % 2 ? "#e0584f" : "#4fa8ff", [Math.cos(a) * 0.19, 0.4, Math.sin(a) * 0.19]);
    }
  },
};

function hatPreview(name: string): Model {
  const m = new VoxModel();
  const head = bust(m);
  const hat = head.part();
  (OWN_HATS[name] ?? HAT_BUILDERS[name])?.(hat, CTX(m));
  return m;
}
function facePreview(name: string): Model {
  const m = new VoxModel();
  const head = bust(m);
  FACE_BUILDERS[name]?.(head.part(), CTX(m));
  return m;
}
function heldPreview(name: string): Model {
  const m = new VoxModel();
  m.cyl(0.14, 0.04, "#3a3040", [0, 0, 0], 0.14, 12);
  const h = m.part([0, 0.1, 0]);
  h.scale.setScalar(2.6);
  HELD_BUILDERS[name]?.(h, (fn) => alive(m, fn));
  return m;
}
/** A torso seen from behind with the item on its back (the builders draw on the back face, `z = -0.1`). */
function backPreview(name: string): Model {
  const m = new VoxModel();
  const turn = m.part([0, 0, 0], Math.PI);
  turn.cyl(0.16, 0.03, "#3a3040", [0, 0, 0], 0.16, 12);
  turn.cyl(0.035, 0.3, "#6b5a7a", [0, 0.02, 0], 0.035, 8);
  const frame = turn.part([0, 0.1, 0]);
  frame.scale.set(1.05, 1.2, 0.9);
  frame.box([0.3, 0.26, 0.2], MANNEQUIN.skin, [0, 0.22, 0], 0.03);
  BACK_BUILDERS[name]?.(frame.part([0, 0.37, -0.1]), (fn) => alive(m, (t) => fn(t, false)));
  return m;
}

/** A mannequin: a voxel person in the shop's wood colours, dressed by `lookFrom2D`, in a neutral stance. */
export function mannequin(look: Look2D, opts?: LookOptions): Avatar {
  const l = lookFrom2D(look, opts);
  l.skin = MANNEQUIN.skin;
  l.hair = MANNEQUIN.hair;
  const a = new Avatar(l, "voxel");
  alive(a.root, (t) => a.look.gear?.update?.(a, 0, t));
  return a;
}
const BASE: Look2D = { style: 0, skin: 0, hair: 1, outfit: 1 };
function outfitPreview(index: number, back?: number): Model {
  return mannequin({ ...BASE, outfit: index, ...(back ? { back } : {}) }).root;
}

export const MERCH_COMPANIES = [
  { id: 1, name: "Token Co", brand: { roof: "#3a6fb8", plaque: "#f5d14a" } },
  { id: 2, name: "Ruby Labs", brand: { roof: "#c4544b", plaque: "#fbf7ef" } },
  { id: 3, name: "Fern AI", brand: { roof: "#3f8c50", plaque: "#f4efe4" } },
  { id: 4, name: "Nordlys", brand: { roof: "#5b3fbf", plaque: "#3ddc84" } },
] as const;

// MARK: The list

const GROUP: Record<string, string> = {
  outfit: "Outfits",
  hat: "Hats",
  glasses: "Face",
  held: "Held",
  back: "Back",
  merch: "Merch",
};

function fromRow(r: ClothesRow): ShopItem {
  metaOf.set(r.id, { slot: r.slot, index: r.index, rarity: r.rarity, level: r.level, boss: r.boss });
  const preview = () =>
    r.slot === "outfit"
      ? outfitPreview(r.index)
      : r.slot === "hat"
        ? hatPreview(r.name)
        : r.slot === "glasses"
          ? facePreview(r.name)
          : r.slot === "held"
            ? heldPreview(r.name)
            : backPreview(r.name);
  return {
    id: r.id,
    name: r.name,
    price: r.price,
    ...(r.level !== undefined && { level: r.level }),
    group: r.boss ? `${GROUP[r.slot]} · ${r.boss} drop` : GROUP[r.slot],
    preview,
  };
}

/** Cheapest, commonest first: a shelf reads as a climb through the rarities. */
const bySale = (a: ClothesRow, b: ClothesRow) =>
  RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || a.price - b.price || a.index - b.index;

/** A slot's rows, the holiday costumes only in their season (the shop is built once a page). */
const rows = (slot: ClothesRow["slot"]) =>
  CLOTHES.filter((r) => r.slot === slot && onSale(itemById(r.id) ?? {}, Date.now()));

function freeOutfits(): ShopItem[] {
  return FREE_OUTFIT_NAMES.map((name, i) => {
    const id = `outfit.${i}`;
    metaOf.set(id, { slot: "outfit", index: i, rarity: "common", free: true });
    return { id, name, price: 0, group: "Outfits", preview: () => outfitPreview(i) };
  });
}

function merchItems(): ShopItem[] {
  return MERCH_PIECES.map((p, i) => {
    const c = MERCH_COMPANIES[i % MERCH_COMPANIES.length]!;
    const id = `merch.${c.id}.${p.kind}`;
    metaOf.set(id, { slot: "merch", index: p.bit, rarity: "common" });
    return {
      id,
      name: `${c.name} ${p.name.toLowerCase()}`,
      price: p.price,
      group: "Merch",
      preview: () => merchProp(c, p.kind),
    };
  });
}

/** Outfits in id order (the free tees, then the shop's), the rest by rarity then price. */
export function buildClothesItems(): {
  outfits: ShopItem[];
  hats: ShopItem[];
  faces: ShopItem[];
  held: ShopItem[];
  backs: ShopItem[];
  merch: ShopItem[];
} {
  metaOf.clear();
  const outfits = [...freeOutfits(), ...rows("outfit").map(fromRow)];
  return {
    outfits,
    hats: rows("hat").sort(bySale).map(fromRow),
    faces: rows("glasses").sort(bySale).map(fromRow),
    held: rows("held").sort(bySale).map(fromRow),
    backs: rows("back").sort(bySale).map(fromRow),
    merch: merchItems(),
  };
}

// MARK: The fitting room

const SLOT_OF = /^(outfit|hat|glasses|held|back)\.(\d+)$/;
const MERCH_OF = /^merch\.(\d+)\.([a-z]+)$/;

/** The 2D look with `item` put on: the fitting-room mirror's data. Pure; the input is untouched. */
export function tryOnLook2D(item: Pick<ShopItem, "id">, look: Look2D): Look2D {
  const slot = SLOT_OF.exec(item.id);
  if (slot) return { ...look, [slot[1]!]: Number(slot[2]) } as Look2D;
  const merch = MERCH_OF.exec(item.id);
  const piece = merch && MERCH_PIECES.find((p) => p.kind === merch[2]);
  if (merch && piece) {
    const same = look.merch === Number(merch[1]);
    // A hoodie goes over a tee: wearing one clears the other.
    const bits = same ? (look.merchWorn ?? 0) : 0;
    const next =
      piece.kind === "hoodie" ? (bits & ~1) | 2 : piece.kind === "tee" ? (bits & ~2) | 1 : bits | piece.bit;
    return { ...look, merch: Number(merch[1]), merchWorn: next };
  }
  return { ...look };
}

/**
 * Fitting-room hook: puts `item` on a player's saved 2D look and returns the avatar `Look` for it
 * (`lookFrom2D`), ready for `new Avatar(look)` or swapping onto the mirror's reflection.
 */
export function tryOn(item: Pick<ShopItem, "id">, look: Look2D, opts?: LookOptions): Look {
  return lookFrom2D(tryOnLook2D(item, look), opts);
}
