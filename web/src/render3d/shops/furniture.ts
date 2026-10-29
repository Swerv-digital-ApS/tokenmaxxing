/**
 * Møbelhuset, the furniture showroom: every piece the 2D furniture shop sells, standing in a walk-in store.
 * Staged room-sets (a lounge corner, a home office, a kitchenette, a bedroom nook, a games corner), a row
 * of desk setups, a poster wall, a wall of wallpaper samples and a board of floor samples, and a shelf bank
 * of small things, each piece with a price placard. Freja the shopkeeper minds the counter.
 *
 * `SHOP_FURNITURE` follows the shared shop contract (`ShopSpec`, a local copy of the shape every store
 * implements; the integrator unifies them). `displays[].at` are world-grid tiles: the room's own tile plus
 * `INSET` (the two wall rows on top and one column on the left, as for every hand-built room), and so are
 * `counter` (the tile a customer stands on to talk to the shopkeeper) and `door`.
 */
import { SUPPLIES_DESK } from "@tokenmaxxing/core/shoprooms.ts";
import * as THREE from "three";
import { FLOORS, WALLPAPERS } from "../furniture/decor3d.ts";
import { type Asset, assetById, light } from "../furniture/furniture.ts";
import { DESK_TIER_ASSETS, extraAssetById } from "../furniture/furniture3d.ts";
import { glow, Model, painted, ticks } from "../kit/kit.ts";
import type { Avatar } from "../people/avatar.ts";
import { exitDoorway } from "../rooms/exits3d.ts";
import { type Placed, Room, type Turn } from "../rooms/room.ts";
import {
  DESK_ROWS,
  FLOOR_ROWS,
  FURNITURE_SHOP_ROWS,
  type FurnRow,
  POSTER_ROWS,
  WALLPAPER_ROWS,
} from "./data/furniture.ts";
import {
  counter,
  furnitureStorefront,
  headerBoard,
  makeShopkeeper,
  priceTag,
  samplePanel,
  setSign,
  shelfBank,
  suppliesDesk,
  wallpaperRolls,
  wallTag,
  windowOf,
} from "./furniture-parts.ts";

// MARK: Contract

export interface ShopItem {
  id: string;
  name: string;
  price: number;
  level?: number;
  group?: string;
  /** A small 3D model of the item (for shelves/rails/pens and for the buy panel). */
  preview: () => Model;
}

export interface ShopSpec {
  id: "furniture" | "clothes" | "barber" | "pets" | "natmarked" | "market";
  name: string;
  sign: string;
  items: ShopItem[];
  /** The storefront for the town: about 5x4 tiles, a door on its south face. Built facing +z. */
  exterior: () => Model;
  footprint: { w: number; d: number };
  /** The walkable interior. */
  buildInterior: () => {
    room: Room;
    /** World-grid tiles where a click means 'browse this item'. */
    displays: { item: ShopItem; at: [number, number] }[];
    shopkeeper: Avatar;
    counter: [number, number];
    door: [number, number];
  };
  /** The same interior built in slices (a yield between pieces), for shops heavy enough to hitch a frame. */
  slices?: () => Generator<void, ReturnType<ShopSpec["buildInterior"]>, void>;
}

/** How far the room sits in the world grid: two wall rows on top, one column on the left. */
export const INSET: [number, number] = [1, 2];

// MARK: Previews

const lookById = <T extends { id: string }>(list: readonly T[], id: string): T =>
  list.find((l) => l.id === id)!;

/** A small free-standing sample of a wallpaper: a framed board. */
function wallpaperPreview(id: string): Model {
  const look = lookById(WALLPAPERS, id);
  const m = new Model();
  m.box([1.0, 1.0, 0.08], "#3a2a1c", [0, 0, 0], 0.015);
  const t = windowOf(look.texture(), 1.0 / look.span, 0.3, 0, 0.3);
  m.plane(0.9, 0.9, glow("#fff", t), [0, 0.5, 0.05]);
  return m;
}

/** A small slab of a flooring, with the pattern on top. */
function floorPreview(id: string): Model {
  const look = lookById(FLOORS, id);
  const m = new Model();
  m.box([1.0, 0.12, 1.0], "#3a2a1c", [0, 0, 0], 0.015);
  const t = windowOf(look.texture(), 0.3, 0.3, 0, 0);
  const top = m.plane(0.94, 0.94, painted(t), [0, 0.125, 0]);
  top.rotation.x = -Math.PI / 2;
  top.userData.noBlock = true;
  return m;
}

const assetOf = (id: string): Asset | undefined => assetById.get(id) ?? extraAssetById.get(id);

function previewOf(row: FurnRow): () => Model {
  switch (row.group) {
    case "Wallpaper":
      return () => wallpaperPreview(row.asset);
    case "Floors":
      return () => floorPreview(row.asset);
    case "Desks":
      return () => DESK_TIER_ASSETS[Number(row.asset)]!.build();
    default:
      return () => (assetOf(row.asset) ?? assetById.get("plant")!).build();
  }
}

const ITEMS: ShopItem[] = FURNITURE_SHOP_ROWS.map((r) => ({
  id: r.id,
  name: r.name,
  price: r.price,
  level: r.level,
  group: r.group,
  preview: previewOf(r),
}));
const itemOf = new Map(ITEMS.map((i) => [i.id, i]));
const rowOf = new Map(FURNITURE_SHOP_ROWS.map((r) => [r.asset + (r.group === "Desks" ? ":desk" : ""), r]));
const rowByAsset = (asset: string): FurnRow => {
  const r = rowOf.get(asset);
  if (!r) throw new Error(`furniture shop: no catalogue row for ${asset}`);
  return r;
};

// MARK: Layout

const W = 29;
const D = 18;
const WALL_H = 2.6;

/** Rugs lie flat: they take the id Room treats as walk-over-able. */
const RUGS = new Set(["rug", "rug-persian", "wool-rug"]);

function buildInterior(): ReturnType<ShopSpec["buildInterior"]> {
  const room = new Room(W, D, { floor: "#d6b27a", wall: "#efe3cc", stripe: "#e0d0b2", bare: true });
  const displays: { item: ShopItem; at: [number, number]; world?: [number, number, number] }[] = [];
  /** The model each display shows, where it has one: the pointer finds the middle of it, not its tile. */
  const shown: (THREE.Object3D | undefined)[] = [];
  const seen = new Set<string>();
  const used = new Set<number>();
  const tile = (x: number, z: number) => z * W + x;
  const show = (r: FurnRow, x: number, z: number, model?: THREE.Object3D) => {
    seen.add(r.id);
    displays.push({ item: itemOf.get(r.id)!, at: [x + INSET[0], z + INSET[1]] });
    shown.push(model);
  };

  // — Floor pieces, by asset id and top-left tile —
  const floorPlaced: { p: Placed; row: FurnRow }[] = [];
  const put = (id: string, x: number, z: number, turn: Turn = 0, row = rowByAsset(id)) => {
    const base = assetOf(id);
    if (!base) throw new Error(`furniture shop: no 3D asset ${id}`);
    const asset: Asset = RUGS.has(id) ? { ...base, id: "rug" } : base;
    if (!room.fits(asset, x, z, turn)) throw new Error(`furniture shop: ${id} does not fit at ${x},${z}`);
    const p = room.place(asset, x, z, turn);
    if (RUGS.has(id)) p.model.position.y = 0.012;
    floorPlaced.push({ p, row });
    show(row, x, z, p.model);
    return p;
  };
  const putDesk = (tier: number, x: number, z: number) => {
    const row = DESK_ROWS[tier]!;
    const asset = DESK_TIER_ASSETS[tier]!;
    const p = room.place(asset, x, z, 0);
    floorPlaced.push({ p, row });
    show(row, x, z, p.model);
    return p;
  };

  // Desk setups along the north wall.
  [2, 5, 8, 11, 14].forEach((x, i) => {
    putDesk(i, x, 1);
  });

  // The lounge corner: a Persian rug, a Chesterfield and a table, a TV nook.
  put("rug-persian", 6, 5);
  put("sofa-chesterfield", 6, 4);
  put("coffee-table", 6, 6);
  put("lounge-chair", 9, 5, 3);
  put("beanbag", 5, 6, 1);
  put("arc-lamp", 5, 4);
  put("monstera", 3, 4);
  put("record-player", 3, 6);
  put("tv", 3, 8, 1);
  put("rug", 4, 8);
  put("sofa", 7, 8, 3);
  put("bench", 10, 7, 3);
  put("chair", 10, 8, 3);

  // The bedroom nook.
  put("bed", 3, 12);
  put("floor-lamp", 4, 12);
  put("wool-rug", 5, 13);
  put("bean-bag", 6, 12, 2);
  put("fiddle-fig", 8, 12);
  put("bookcase", 9, 12);

  // The games corner and the big pieces down the middle.
  put("ping-pong", 13, 4);
  put("arcade-cabinet", 17, 4);
  put("server-rack", 18, 4);
  put("foosball", 13, 8);
  put("gong", 16, 8);
  put("aquarium", 13, 10);
  put("trophy-case", 16, 10);
  put("touched-grass", 13, 12);
  const chand = put("chandelier", 16, 12);
  // The chandelier hangs from a beam, since there is no ceiling here.
  const beam = new Model();
  beam.box([2.4, 0.12, 0.3], "#8c5c36", [0, 2.6, 0], 0.02);
  for (const s of [-1, 1]) beam.box([0.1, 0.5, 0.1], "#8c5c36", [s * 1.15, 2.12, 0], 0.01);
  beam.position.set(chand.x + 1, 0, chand.z + 0.5);
  room.group.add(beam);

  // The home office, top right.
  put("desk", 19, 2);
  put("chair", 20, 3, 2);
  put("standing-desk", 22, 2);
  put("whiteboard", 25, 2);
  put("bookshelf-library", 19, 5);
  put("keyboard-case", 22, 5);
  put("shelf", 25, 5);

  // The kitchenette: a checker floor patch and a run of appliances.
  const checker = new Model();
  checker.box([9, 0.02, 3], "#e8e2d4", [0, 0, 0], 0.002);
  for (let i = 0; i < 9; i++)
    for (let j = 0; j < 3; j++)
      if ((i + j) % 2)
        checker
          .box([0.99, 0.025, 0.99], "#3b3f50", [-4 + i + 0.0 - 0.0 + 0.0, 0, -1 + j + 0.0], 0.001)
          .position.set(-4 + i, 0.002, -1 + j);
  checker.position.set(23.5, 0.005, 11.5);
  room.group.add(checker);
  put("coffee", 20, 10);
  put("espresso-bar", 21, 10);
  put("water-cooler", 23, 10);
  put("mini-fridge", 24, 10);
  put("home-fridge", 25, 10);
  put("vending-machine", 26, 10);

  // — The small-things shelf bank —
  const BANK_X = 19;
  const BANK_Z = 7;
  const bankIds = [
    "duck-shelf",
    "bonsai-stand",
    "plant",
    "lamp",
    "lava-lamp",
    "globe",
    "cactus",
    "bonsai",
    "rubber-duck-statue",
  ];
  const slots = bankIds.map((id) => {
    const row = rowByAsset(id);
    return { id, model: assetOf(id)!.build(), row };
  });
  const bank = shelfBank(4, slots);
  const bankAsset: Asset = {
    id: "shop:bank",
    name: "Shelf bank",
    price: 0,
    w: 4,
    d: 1,
    build: () => bank.model,
  };
  room.place(bankAsset, BANK_X, BANK_Z, 0, bank.model);
  slots.forEach((s, i) => {
    show(s.row, BANK_X + bank.cols[i]!, BANK_Z, s.model);
  });

  // — The counter, the till and Freja —
  const CTR_X = 22;
  const CTR_Z = 14;
  const ctrAsset: Asset = {
    id: "shop:counter",
    name: "Counter",
    price: 0,
    w: 6,
    d: 1,
    build: () => counter(6),
  };
  room.place(ctrAsset, CTR_X, CTR_Z, 0);
  const rolls = wallpaperRolls();
  const rollsAsset: Asset = {
    id: "shop:rolls",
    name: "Wallpaper rolls",
    price: 0,
    w: 1,
    d: 1,
    build: () => rolls,
  };
  room.place(rollsAsset, 20, 13, 0, rolls);
  // The company-supplies catalogue desk by the door: E on it opens the Company tab (`SUPPLIES_DESK` in core).
  const supplies = suppliesDesk();
  room.place(
    { id: "shop:supplies", name: "Company supplies", price: 0, w: 2, d: 1, build: () => supplies },
    SUPPLIES_DESK[0] - INSET[0],
    SUPPLIES_DESK[1] - INSET[1],
    0,
    supplies,
  );
  const keeper = makeShopkeeper();
  keeper.avatar.root.position.set(CTR_X - 0.9, 0.02, CTR_Z + 0.55);
  keeper.avatar.root.rotation.y = 0.35;
  room.group.add(keeper.avatar.root);
  // Her idle runs with the world's clock when nobody calls `update` on her.
  let last = performance.now() / 1000;
  ticks.push((t) => {
    const dt = Math.min(0.1, Math.max(0, t - last));
    last = t;
    keeper.avatar.update(dt, t);
  });

  // — The way out —
  const DOOR_X = 10;
  const door = exitDoorway({ outside: true, wall: "#efe3cc", leaf: "#2c5f5a" });
  door.position.set(DOOR_X + 0.5, 0, D + 0.5);
  door.rotation.y = Math.PI;
  room.group.add(door);

  // — Wall pieces on the north wall: posters, then the hangings —
  const measure = (m: Model): THREE.Box3 => {
    m.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(m);
  };
  const hangNorth = (m: Model, centre: number, bottom: number) => {
    const b = measure(m);
    m.position.set(centre - (b.min.x + b.max.x) / 2, bottom - b.min.y, 0.01);
    room.group.add(m);
    return measure(m);
  };

  let px = 1.0;
  for (const r of POSTER_ROWS) {
    const m = assetOf(r.asset)!.build();
    const w = measure(m).getSize(new THREE.Vector3()).x;
    const b = hangNorth(m, px + w / 2, 0.85);
    const tag = wallTag(r, Math.max(1.0, w));
    tag.position.set(px + w / 2, b.max.y + 0.06, 0.02);
    room.group.add(tag);
    show(r, Math.floor(px + w / 2), 0, m);
    px += w + 0.3;
  }
  const hangings = [
    "certificate",
    "hanging-plant",
    "wall-whiteboard",
    "wall-neon",
    "neon-sign",
    "plant-wall",
  ];
  let hx = 18.1;
  for (const id of hangings) {
    const r = rowByAsset(id);
    const m = assetOf(id)!.build();
    const w = measure(m).getSize(new THREE.Vector3()).x;
    const b = hangNorth(m, hx + w / 2, 1.0);
    const tag = wallTag(r, Math.max(1.0, Math.min(w, 1.5)));
    tag.position.set(hx + w / 2, b.min.y - 0.45, 0.02);
    room.group.add(tag);
    show(r, Math.floor(hx + w / 2), 0, m);
    hx += w + 0.22;
  }

  // — Samples on the west wall: wallpaper in two rows of five, floors in two rows of five —
  const PANEL = { w: 1.35, h: 1.0 };
  const PITCH = 1.55;
  const west = (m: Model, zc: number, y: number) => {
    m.position.set(0.04, y, zc);
    m.rotation.y = Math.PI / 2;
    room.group.add(m);
  };
  const sampleBlock = (
    rows: readonly FurnRow[],
    z0: number,
    make: (r: FurnRow) => THREE.Texture,
    thick: number,
  ) => {
    rows.forEach((r, i) => {
      const col = i % 5;
      const rowIdx = Math.floor(i / 5);
      const zc = z0 + PANEL.w / 2 + col * PITCH;
      const m = samplePanel(r, make(r), PANEL, thick);
      west(m, zc, 0.12 + rowIdx * 1.12);
      show(r, 0, Math.min(D - 2, Math.floor(zc)), m);
    });
  };
  sampleBlock(
    WALLPAPER_ROWS,
    1.0,
    (r) => {
      const look = lookById(WALLPAPERS, r.asset);
      const plain = r.asset === "plain";
      return windowOf(look.texture(), PANEL.w / look.span, plain ? 0.5 : 0.7 / WALL_H, 0, plain ? 0.2 : 0.3);
    },
    0.05,
  );
  sampleBlock(
    FLOOR_ROWS,
    9.7,
    (r) => windowOf(lookById(FLOORS, r.asset).texture(), 0.45, 0.234, 0, 0.1),
    0.1,
  );
  const hdrW = headerBoard("WALLPAPER", "10 patterns · E to browse", 7.8, 0.28);
  west(hdrW, 1.0 + 3.9, 2.38 - 0.0);
  const hdrF = headerBoard("FLOOR SAMPLES", "10 floors · E to browse", 7.8, 0.28);
  west(hdrF, 9.7 + 3.9, 2.38 - 0.0);
  const hdrP = headerBoard("POSTER WALL", "10 prints", 3.2, 0.26);
  hdrP.position.set(4.2, 2.36, 0.012);
  // (the poster wall is labelled by its own tags; no extra header)

  // — Placards for the floor pieces —
  const tileOpen = (x: number, z: number) =>
    room.inside(x, z) && room.open(x, z) && !used.has(tile(x, z)) && z < D - 1;
  for (const { p, row } of floorPlaced) {
    const [fw, fd] = Room.footprint(p.asset, p.turn);
    const front = p.z + fd;
    const spots: { cx: number; z: number; tiles: number[] }[] = [];
    spots.push({
      cx: p.x + fw / 2,
      z: front,
      tiles: Array.from({ length: fw === 1 ? 1 : 2 }, (_, i) =>
        fw === 1 ? p.x : Math.floor(p.x + fw / 2) - 1 + i,
      ),
    });
    for (let i = 0; i < fw; i++) spots.push({ cx: p.x + i + 0.5, z: front, tiles: [p.x + i] });
    spots.push(
      { cx: p.x - 0.5, z: front - 0.0, tiles: [p.x - 1] },
      { cx: p.x + fw + 0.5, z: front, tiles: [p.x + fw] },
    );
    let spot = spots.find((s) => s.tiles.every((x) => tileOpen(x, front)));
    spot ??= spots[0]!;
    for (const x of spot.tiles) used.add(tile(x, front));
    const tag = priceTag(row);
    tag.position.set(spot.cx, 0, spot.z + 0.28);
    room.group.add(tag);
  }

  // — Section signs —
  const signs: [string, string, number, number][] = [
    ["MONITORS", "desk setups · laptop to battlestation", 17.3, 2.4],
    ["COMPANY SUPPLIES", "furniture · posters · house desks", 15.5, 14.7],
    ["THE LOUNGE", "sofas · rugs · TV", 11.9, 5.0],
    ["BEDROOM NOOK", "bed · lamp · books", 6.5, 15.4],
    ["GAMES & BIG PIECES", "ping-pong to gong", 15.5, 7.1],
    ["HOME OFFICE", "desks · shelves · boards", 23.6, 4.5],
    ["KITCHENETTE", "coffee · fridges · vending", 24.0, 12.2],
  ];
  for (const [title, sub, x, z] of signs) {
    const s = setSign(title, sub);
    s.position.set(x, 0, z);
    room.group.add(s);
  }

  // — Warm light for the night, and the shop windows —
  const lamps = new Model();
  for (const [x, z] of [
    [7, 7],
    [6, 14],
    [15, 6],
    [15, 12],
    [22, 5],
    [24, 11],
    [22, 14],
    [10, 15],
    [4, 2],
    [10, 2],
  ] as const)
    light(lamps, [x, 2.2, z], "#ffd9a0", 4, 9);
  room.group.add(lamps);

  // — Every catalogue item has a display, and none is missing —
  const missing = ITEMS.filter((i) => !seen.has(i.id));
  if (missing.length)
    throw new Error(`furniture shop: not on display: ${missing.map((m) => m.id).join(", ")}`);

  room.group.updateMatrixWorld(true);
  const box = new THREE.Box3();
  displays.forEach((d, i) => {
    const m = shown[i];
    if (!m || box.setFromObject(m).isEmpty()) return;
    const v = box.getCenter(new THREE.Vector3());
    d.world = [v.x, v.y, v.z];
  });

  return {
    room,
    displays,
    shopkeeper: keeper.avatar,
    counter: [CTR_X + 3 + INSET[0], CTR_Z + 1 + INSET[1]],
    door: [DOOR_X + INSET[0], D - 1 + INSET[1]],
  };
}

export const SHOP_FURNITURE: ShopSpec = {
  id: "furniture",
  name: "Møbelhuset",
  sign: "MØBELHUSET",
  items: ITEMS,
  exterior: furnitureStorefront,
  footprint: { w: 5, d: 4 },
  buildInterior,
};
