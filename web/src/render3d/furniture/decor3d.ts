/**
 * Office decor in 3D: every wallpaper and floor of the 2D game (`core/src/decor.ts`, art in
 * `web/src/art/tiles.ts` on pr/company-house) as a painted texture, plus the three office sizes
 * (`core/src/office.ts`). The texture painters are ports of the 2D tile painters, 16 texels per tile.
 * Ids, names, prices and unlock levels are a snapshot of decor.ts.
 */
import { RepeatWrapping, type Texture } from "three";
import { C } from "../../art/palette.ts";
import { canvasTexture, planks, tint, wallpaper } from "../kit/kit.ts";
import type { Room } from "../rooms/room.ts";

const TILE = 16;

/** Same hash as the 2D tiles, so the speckles land where they do in the sprites. */
function hash(x: number, y: number, s = 0): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** The 2D `Pen`, on a canvas. */
interface Pen {
  rect(x: number, y: number, w: number, h: number, c: string): void;
  px(x: number, y: number, c: string): void;
}
const penOf = (g: CanvasRenderingContext2D): Pen => ({
  rect: (x, y, w, h, c) => {
    g.fillStyle = c;
    g.fillRect(x, y, w, h);
  },
  px: (x, y, c) => {
    g.fillStyle = c;
    g.fillRect(x, y, 1, 1);
  },
});
type Art = (p: Pen, ox: number, oy: number, x: number, y: number) => void;

// ——— Floors ———

function herringbone(p: Pen, ox: number, oy: number, x: number, y: number, base: string, line: string): void {
  p.rect(ox, oy, TILE, TILE, base);
  for (let j = 0; j < TILE; j++)
    for (let i = 0; i < TILE; i++) {
      const top = j % 8 < 4;
      const d = top ? i + j : i - j + 16;
      if (d % 4 === 0) p.px(ox + i, oy + j, line);
      else if (hash(x * TILE + i, y * TILE + j, 43) < 0.04) p.px(ox + i, oy + j, line);
    }
}

const FLOOR_ART: Record<string, Art> = {
  linoleum: (p, ox, oy, x, y) => {
    p.rect(ox, oy, TILE, TILE, "#7fa88a");
    for (let j = 0; j < TILE; j++)
      for (let i = 0; i < TILE; i++) {
        const h = hash(x * TILE + i, y * TILE + j, 41);
        if (h < 0.06) p.px(ox + i, oy + j, "#6d9578");
        else if (h < 0.1) p.px(ox + i, oy + j, "#93bb9d");
      }
    p.rect(ox, oy + 7, TILE, 1, "#6d9578");
    p.rect(ox + 7, oy, 1, TILE, "#6d9578");
  },
  parquet: (p, ox, oy, x, y) => herringbone(p, ox, oy, x, y, "#8a5733", "#5e3519"),
  fiskebenet: (p, ox, oy, x, y) => herringbone(p, ox, oy, x, y, "#dcc08e", "#b8935c"),
  checker: (p, ox, oy) => {
    for (let q = 0; q < 4; q++)
      p.rect(
        ox + (q % 2) * 8,
        oy + Math.floor(q / 2) * 8,
        8,
        8,
        (q % 2) + Math.floor(q / 2) === 1 ? "#2b2b33" : "#ece8e0",
      );
  },
  terrazzo: (p, ox, oy, x, y) => {
    p.rect(ox, oy, TILE, TILE, "#e9e2d6");
    const chips = ["#c97b6b", "#7f9a8e", "#3e4452", "#d9b36a", "#b9b2a6"];
    for (let k = 0; k < 14; k++) {
      const cx = ox + Math.floor(hash(x * 16 + k, y, 71) * 14);
      const cy = oy + Math.floor(hash(x, y * 16 + k, 72) * 14);
      const c = chips[Math.floor(hash(k, x + y * 7, 73) * chips.length)]!;
      p.rect(cx, cy, k % 3 === 0 ? 2 : 1, k % 4 === 0 ? 2 : 1, c);
    }
  },
  klinker: (p, ox, oy, x, y) => {
    p.rect(ox, oy, TILE, TILE, "#c4a79a");
    for (let j = 0; j < 2; j++)
      for (let i = 0; i < 2; i++) {
        const h = hash(x * 2 + i, y * 2 + j, 74);
        const base = h < 0.33 ? "#a8553f" : h < 0.66 ? "#b4634a" : "#9a4a38";
        p.rect(ox + i * 8 + 1, oy + j * 8 + 1, 7, 7, base);
        p.rect(ox + i * 8 + 1, oy + j * 8 + 1, 7, 1, "#c27658");
        p.px(ox + i * 8 + 1 + Math.floor(h * 5), oy + j * 8 + 4, "#8a3f30");
      }
  },
  datacentre: (p, ox, oy) => {
    p.rect(ox, oy, TILE, TILE, "#9aa3ae");
    for (let q = 0; q < 4; q++) {
      const qx = ox + (q % 2) * 8;
      const qy = oy + Math.floor(q / 2) * 8;
      p.rect(qx + 1, qy + 1, 6, 6, "#b3bbc5");
      for (const [dx, dy] of [
        [2, 2],
        [4, 2],
        [3, 4],
        [5, 4],
        [2, 5],
        [4, 5],
      ] as const)
        p.px(qx + dx, qy + dy, "#5d6470");
    }
    p.rect(ox, oy + 7, TILE, 1, "#6e7783");
    p.rect(ox + 7, oy, 1, TILE, "#6e7783");
  },
  douglas: (p, ox, oy, x, y) => {
    p.rect(ox, oy, TILE, TILE, "#e3cba3");
    for (let j = 0; j < TILE; j += 8) {
      p.rect(ox, oy + j + 7, TILE, 1, "#c4a678");
      const joint = Math.floor(hash(x, y * 2 + j / 8, 75) * 12) + 2;
      p.rect(ox + joint, oy + j, 1, 7, "#c4a678");
      for (let k = 0; k < 3; k++)
        p.px(ox + Math.floor(hash(x * 3 + k, y + j, 76) * 15), oy + j + 1 + (k % 3) * 2, "#d3b88c");
    }
  },
  bornholm: (p, ox, oy, x, y) => {
    p.rect(ox, oy, TILE, TILE, "#6a6f78");
    for (let j = 0; j < 2; j++)
      for (let i = 0; i < 2; i++) {
        const h = hash(x * 2 + i, y * 2 + j, 42);
        p.rect(ox + i * 8 + 1, oy + j * 8 + 1, 6, 6, h < 0.5 ? "#8d939c" : "#7c828c");
        p.rect(ox + i * 8 + 1, oy + j * 8 + 1, 6, 1, "#a3a9b2");
      }
  },
};

// ——— Wallpapers ———

const WALL_ART: Record<string, Art> = {
  hygge: (p, ox, oy, x, y) => {
    for (let j = 0; j < TILE; j++)
      p.rect(ox, oy + j, TILE, 1, j < 5 ? "#f0d8aa" : j < 10 ? "#f5e3bd" : "#f9ecd0");
    if (hash(x, y, 51) < 0.5) {
      p.rect(ox + 6, oy + 6, 3, 3, "#fff3cf");
      p.px(ox + 7, oy + 5, "#ffd36b");
    }
  },
  nyhavn: (p, ox, oy) => {
    const stripe = ["#c8503c", "#e8c14a", "#3d6f9e", "#e8c14a"];
    for (let i = 0; i < TILE; i += 4) p.rect(ox + i, oy, 4, TILE, stripe[i / 4]!);
  },
  rundetaarn: (p, ox, oy, x, y) => {
    p.rect(ox, oy, TILE, TILE, "#a14d3b");
    for (let j = 0; j < TILE; j += 4) {
      p.rect(ox, oy + j + 3, TILE, 1, "#cdb9a2");
      const shift = (j / 4) % 2 === 0 ? 0 : 4;
      for (let i = shift; i < TILE; i += 8) p.rect(ox + i, oy + j, 1, 3, "#cdb9a2");
    }
    for (let k = 0; k < 3; k++)
      p.px(ox + Math.floor(hash(x, y, 52 + k) * TILE), oy + Math.floor(hash(y, x, 55 + k) * 12), "#8a3f30");
  },
  jacobsen: (p, ox, oy) => {
    p.rect(ox, oy, TILE, TILE, "#9fb59a");
    p.rect(ox, oy + 2, TILE, 1, "#92a98d");
  },
  skagen: (p, ox, oy, x, y) => {
    for (let j = 0; j < TILE; j++)
      p.rect(ox, oy + j, TILE, 1, j < 6 ? "#f0cf6e" : j < 11 ? "#f3d983" : "#f6e19a");
    p.rect(ox, oy + 8, TILE, 1, "#e9c460");
    if (hash(x, y, 77) < 0.4) p.rect(ox + 5, oy + 4, 6, 1, "#fbeab5");
  },
  hammershoi: (p, ox, oy, x) => {
    p.rect(ox, oy, TILE, TILE, "#a9b3bd");
    if (x % 2 === 0) {
      p.rect(ox + 2, oy + 2, 12, 11, "#b9c2cb");
      p.rect(ox + 2, oy + 2, 12, 1, "#cdd5dc");
      p.rect(ox + 2, oy + 12, 12, 1, "#94a0ab");
    } else p.rect(ox, oy + 6, TILE, 1, "#9ba6b0");
  },
  terminal: (p, ox, oy, x, y) => {
    p.rect(ox, oy, TILE, TILE, "#10151a");
    for (let j = 3; j < 12; j += 3) {
      const len = 3 + Math.floor(hash(x, y + j, 78) * 9);
      p.rect(ox + 1, oy + j, len, 1, j === 9 ? "#3ddc84" : "#2a8f57");
    }
    if (x % 3 === 0) p.rect(ox + 11, oy + 9, 3, 2, "#3ddc84");
  },
  kanban: (p, ox, oy, x, y) => {
    p.rect(ox, oy, TILE, TILE, "#b88a58");
    for (let k = 0; k < 6; k++)
      p.px(
        ox + Math.floor(hash(x * 6 + k, y, 79) * 15),
        oy + Math.floor(hash(x, y * 6 + k, 80) * 12),
        "#a07548",
      );
    const notes = ["#f5d14a", "#f28bb2", "#7fe3ff", "#9fe08a"];
    p.rect(ox + 3, oy + 3, 5, 5, notes[(x * 3 + 1) % notes.length]!);
    p.px(ox + 5, oy + 2, "#e8584f");
    p.rect(ox + 4, oy + 5, 3, 1, "#8c6a2f");
    if (x % 2 === 0) {
      p.rect(ox + 9, oy + 6, 5, 5, notes[(x + 2) % notes.length]!);
      p.px(ox + 11, oy + 5, "#4f8fe0");
    }
  },
  tivoli: (p, ox, oy, x, y) => {
    p.rect(ox, oy, TILE, TILE, "#1f2a54");
    for (let k = 0; k < 4; k++)
      p.px(
        ox + 1 + Math.floor(hash(x, y, 60 + k) * 14),
        oy + 3 + Math.floor(hash(y, x, 64 + k) * 9),
        "#f2c94c",
      );
  },
};

// ——— Tables ———

export interface Look<T> {
  id: string;
  name: string;
  /** Coins; 0 for the plain one and for earned ones. */
  price: number;
  /** Earned at this level and never sold. */
  level?: number;
  /** The colour of the thumbnail and (floors) of the slab's sides. */
  color: string;
  /** A fresh texture. */
  texture(): T;
  /** World tiles one repeat of the texture covers. */
  span: number;
}

const FLOOR_SPAN = 4;
const floorLook = (
  id: string,
  name: string,
  price: number,
  color: string,
  level?: number,
): Look<Texture> => ({
  id,
  name,
  price,
  level,
  color,
  span: FLOOR_SPAN,
  texture: () => {
    const art = FLOOR_ART[id]!;
    const t = canvasTexture(TILE * FLOOR_SPAN, TILE * FLOOR_SPAN, (g) => {
      const p = penOf(g);
      for (let y = 0; y < FLOOR_SPAN; y++)
        for (let x = 0; x < FLOOR_SPAN; x++) art(p, x * TILE, y * TILE, x, y);
    });
    t.wrapS = t.wrapT = RepeatWrapping;
    return t;
  },
});

export const FLOORS: readonly Look<Texture>[] = [
  { id: "boards", name: "Boards", price: 0, color: C.floor, span: 4, texture: () => planks(C.floor, 4) },
  floorLook("linoleum", "Linoleum", 60, "#7fa88a"),
  floorLook("parquet", "Parquet", 150, "#8a5733"),
  floorLook("fiskebenet", "Fiskebenet", 270, "#dcc08e"),
  floorLook("checker", "Checker", 450, "#8d8d90"),
  floorLook("terrazzo", "Terrazzo", 90, "#e9e2d6"),
  floorLook("klinker", "Klinker", 135, "#b4634a"),
  floorLook("datacentre", "Server room", 210, "#9aa3ae"),
  floorLook("douglas", "Douglas planks", 360, "#e3cba3"),
  floorLook("bornholm", "Bornholm cobble", 0, "#6a6f78", 40),
];

const WALL_COLS = 2;
const wallLook = (id: string, name: string, price: number, color: string, level?: number): Look<Texture> => ({
  id,
  name,
  price,
  level,
  color,
  span: WALL_COLS,
  texture: () => {
    // The wall is ~3 tiles tall in 2D terms: paint three rows of tiles, two columns wide (some papers alternate).
    const t = canvasTexture(TILE * WALL_COLS, TILE * 3, (g) => {
      const p = penOf(g);
      const art = WALL_ART[id]!;
      for (let y = 0; y < 3; y++) for (let x = 0; x < WALL_COLS; x++) art(p, x * TILE, y * TILE, x, y);
      // The lip at the top of a wall, and the skirting, as in 2D.
      p.rect(0, 0, TILE * WALL_COLS, 2, C.wallTopLight);
    });
    t.wrapS = RepeatWrapping;
    return t;
  },
});

export const WALLPAPERS: readonly Look<Texture>[] = [
  {
    id: "plain",
    name: "Cream panels",
    price: 0,
    color: C.wall,
    span: 1,
    texture: () => wallpaper(C.wall, C.wallDark),
  },
  wallLook("hygge", "Hygge", 60, "#f5e3bd"),
  wallLook("nyhavn", "Nyhavn", 120, "#c8503c"),
  wallLook("rundetaarn", "Rundetårn", 180, "#a14d3b"),
  wallLook("jacobsen", "Arne Jacobsen", 240, "#9fb59a"),
  wallLook("skagen", "Skagen yellow", 90, "#f3d983"),
  wallLook("hammershoi", "Hammershøi", 150, "#a9b3bd"),
  wallLook("terminal", "Terminal", 210, "#10151a"),
  wallLook("kanban", "Kanban", 330, "#b88a58"),
  wallLook("tivoli", "Tivoli", 0, "#1f2a54", 25),
];

// ——— Applying ———

const cache = new Map<string, Texture>();
const cached = (kind: string, look: Look<Texture>) => {
  const key = `${kind}.${look.id}`;
  let t = cache.get(key);
  if (!t) {
    t = look.texture();
    cache.set(key, t);
  }
  return t;
};

/** An id nobody knows is the plain one, as in 2D. */
export const wallpaperOf = (id?: string | null) => WALLPAPERS.find((w) => w.id === id) ?? WALLPAPERS[0]!;
export const floorOf = (id?: string | null) => FLOORS.find((f) => f.id === id) ?? FLOORS[0]!;

/** Re-skins a room live. Furniture stays. */
export function applyDecor(room: Room, d: { wall?: string; floor?: string }): void {
  const wall = d.wall === undefined ? undefined : wallpaperOf(d.wall);
  const floor = d.floor === undefined ? undefined : floorOf(d.floor);
  if (!wall && !floor) return;
  room.setDecor({
    wall: wall && { texture: cached("wall", wall), span: wall.span },
    floor: floor && { texture: cached("floor", floor), span: floor.span, color: tint(floor.color, 0) },
  });
}
