import { ALL_CASE_PIECES } from "@tokenmaxxing/core/case-furniture.ts";
import type { DecorKind } from "@tokenmaxxing/core/decor.ts";
import { HOME_PIECES } from "@tokenmaxxing/core/home.ts";
import type { GameMap } from "@tokenmaxxing/core/maps.ts";
import { isPoster, POSTERS } from "@tokenmaxxing/core/posters.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { typedSwitch, typedSwitchGroup } from "hanzio";
import { stairs } from "./basement.ts";
import { C } from "./palette.ts";
import { bake, cached, hash, Pen } from "./pixels.ts";

/** What a tile's ground is made of. Objects stand on whatever their neighbours are. */
type Ground =
  | "grass"
  | "path"
  | "plaza"
  | "flowers"
  | "water"
  | "floor"
  | "rug"
  | "wall"
  | "exit"
  | "stairs"
  | "stairsUp"
  | "stone"
  | "dais"
  | "stage";

const GROUND: Record<string, Ground> = {
  ".": "grass",
  // Posters hang on the wall, so their tile is wall underneath.
  ...Object.fromEntries(POSTERS.map((p) => [p.ch, "wall" as const])),
  // So do a personal office's frames and signs.
  ...Object.fromEntries(
    [...HOME_PIECES, ...ALL_CASE_PIECES].filter((p) => p.wall).map((p) => [p.ch, "wall" as const]),
  ),
  ",": "path",
  ":": "plaza",
  '"': "flowers",
  "~": "water",
  _: "floor",
  "=": "rug",
  W: "wall",
  x: "exit",
  S: "stairs",
  u: "stairsUp",
  R: "exit",
  q: "stone",
  Z: "dais",
  e: "stage",
  // The common room's windows and wall of wins hang in the wall's face.
  Ψ: "wall",
  Θ: "wall",
  // So do the Tavern's world clocks.
  "◷": "wall",
};

/** The dungeon's stone: darker than the square's, and lit by its torches. */
const DUNGEON = {
  floor: "#2f2b3a",
  floorDark: "#24212d",
  floorLight: "#3b3647",
  dais: "#4a4459",
  daisDark: "#2a2633",
  daisLight: "#5d5670",
  rune: "#b98cff",
  wall: "#3a3446",
  wallDark: "#2a2533",
  wallTop: "#1c1924",
  wallTopLight: "#2a2533",
};

function groundAt(map: GameMap, x: number, y: number): Ground {
  const own = GROUND[map.at(x, y)];
  if (own) return own;
  // Furniture and scenery: take the most common walkable ground around it.
  const counts = new Map<Ground, number>();
  for (const [dx, dy] of [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
    [1, 1],
    [-1, 1],
  ] as const) {
    const g = GROUND[map.at(x + dx, y + dy)];
    if (g && g !== "wall" && g !== "water" && g !== "exit" && g !== "stairs" && g !== "stairsUp")
      counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  const best = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (best) return best;
  return typedSwitch(map.id, {
    town: () => "grass",
    dungeon: () => "stone",
    ...typedSwitchGroup(
      map.id,
      [
        "hq",
        "common",
        "inn",
        "upstairs",
        "basement",
        "office",
        "shop-furniture",
        "shop-clothes",
        "shop-barber",
        "shop-pets",
        "shop-natmarked",
        "shop-market",
      ],
      (): Ground => "floor",
    ),
  });
}

function grass(p: Pen, ox: number, oy: number, x: number, y: number): void {
  p.rect(ox, oy, TILE, TILE, C.grass);
  for (let j = 0; j < TILE; j++)
    for (let i = 0; i < TILE; i++) {
      const h = hash(x * TILE + i, y * TILE + j, 1);
      if (h < 0.035) {
        p.px(ox + i, oy + j, C.grassDark);
        if (j > 0) p.px(ox + i, oy + j - 1, C.grassDark);
      } else if (h < 0.06) p.px(ox + i, oy + j, C.grassLight);
    }
}

function flowers(p: Pen, ox: number, oy: number, x: number, y: number): void {
  grass(p, ox, oy, x, y);
  const colors = [C.flowerRed, C.flowerYellow, C.flowerWhite];
  for (let k = 0; k < 4; k++) {
    const fx = 2 + Math.floor(hash(x, y, 10 + k) * 11);
    const fy = 2 + Math.floor(hash(x, y, 20 + k) * 11);
    const c = colors[Math.floor(hash(x, y, 30 + k) * 3)]!;
    p.rect(ox + fx - 1, oy + fy, 3, 1, c);
    p.rect(ox + fx, oy + fy - 1, 1, 3, c);
    p.px(ox + fx, oy + fy, C.flowerYellow === c ? C.flowerRed : C.flowerYellow);
    p.px(ox + fx, oy + fy + 2, C.leafDark);
  }
}

function speckle(
  p: Pen,
  ox: number,
  oy: number,
  x: number,
  y: number,
  base: string,
  dark: string,
  light: string,
) {
  p.rect(ox, oy, TILE, TILE, base);
  for (let j = 0; j < TILE; j++)
    for (let i = 0; i < TILE; i++) {
      const h = hash(x * TILE + i, y * TILE + j, 2);
      if (h < 0.05) p.px(ox + i, oy + j, dark);
      else if (h < 0.09) p.px(ox + i, oy + j, light);
    }
}

function plaza(p: Pen, ox: number, oy: number, x: number, y: number): void {
  p.rect(ox, oy, TILE, TILE, C.plaza);
  for (let j = 0; j < TILE; j++) {
    const gy = y * TILE + j;
    const offset = Math.floor(gy / 8) % 2 === 0 ? 0 : 4;
    for (let i = 0; i < TILE; i++) {
      const gx = x * TILE + i;
      if (gy % 8 === 0 || (gx + offset) % 8 === 0) p.px(ox + i, oy + j, C.plazaDark);
      else if (gy % 8 === 1 || (gx + offset) % 8 === 1) p.px(ox + i, oy + j, C.plazaLight);
    }
  }
}

function water(p: Pen, map: GameMap, ox: number, oy: number, x: number, y: number): void {
  p.rect(ox, oy, TILE, TILE, C.water);
  for (let j = 0; j < TILE; j++)
    for (let i = 0; i < TILE; i++)
      if (hash(x * TILE + i, y * TILE + j, 3) < 0.04) p.px(ox + i, oy + j, C.waterDark);
  // Shore: foam and a dark lip wherever the water meets land.
  const land = (dx: number, dy: number) => map.at(x + dx, y + dy) !== "~";
  if (land(0, -1)) {
    p.rect(ox, oy, TILE, 2, C.foam);
    p.rect(ox, oy + 2, TILE, 1, C.waterLight);
  }
  if (land(0, 1)) p.rect(ox, oy + TILE - 2, TILE, 2, C.waterDark);
  if (land(-1, 0)) p.rect(ox, oy, 2, TILE, C.foam);
  if (land(1, 0)) p.rect(ox + TILE - 2, oy, 2, TILE, C.foam);
}

/** An office floor by id (`decor.ts`): each paints a whole tile and repeats at 8 pixels, so tiles meet. */
export const FLOOR_ART: Record<string, (p: Pen, ox: number, oy: number, x: number, y: number) => void> = {
  // Natmarked's hall: dark, worn planks with a few paper scraps.
  natmarked: (p, ox, oy, x, y) => {
    p.rect(ox, oy, TILE, TILE, "#3a2a24");
    for (let j = 0; j < TILE; j += 4) {
      p.rect(ox, oy + j + 3, TILE, 1, "#26191a");
      const joint = Math.floor(hash(x, y * 4 + j, 4) * TILE);
      p.rect(ox + joint, oy + j, 1, 3, "#2e201b");
    }
    if (hash(x, y, 71) < 0.07) p.rect(ox + 4 + Math.floor(hash(y, x, 72) * 8), oy + 5, 3, 2, "#a42a22");
  },
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

/** Boards laid in a herringbone: diagonal planks, the other way up in the bottom half of each 8-pixel block. */
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

function floor(p: Pen, ox: number, oy: number, x: number, y: number, decor?: string): void {
  const art = decor ? FLOOR_ART[decor] : undefined;
  if (art) {
    art(p, ox, oy, x, y);
    return;
  }
  p.rect(ox, oy, TILE, TILE, C.floor);
  for (let j = 0; j < TILE; j += 4) {
    p.rect(ox, oy + j + 3, TILE, 1, C.floorLine);
    const joint = Math.floor(hash(x, y * 4 + j, 4) * TILE);
    p.rect(ox + joint, oy + j, 1, 3, C.floorDark);
  }
}

/** Flagstones, offset every other row like the plaza but rougher. */
function stone(p: Pen, ox: number, oy: number, x: number, y: number): void {
  p.rect(ox, oy, TILE, TILE, DUNGEON.floor);
  for (let j = 0; j < TILE; j++)
    for (let i = 0; i < TILE; i++) {
      const gx = x * TILE + i;
      const gy = y * TILE + j;
      const offset = Math.floor(gy / 8) % 2 === 0 ? 0 : 4;
      if (gy % 8 === 0 || (gx + offset) % 8 === 0) p.px(ox + i, oy + j, DUNGEON.floorDark);
      else if (hash(gx, gy, 6) < 0.05) p.px(ox + i, oy + j, DUNGEON.floorLight);
    }
}

/** The boss's dais: raised, with a lip and a front face, and runes along its edge. */
function dais(p: Pen, map: GameMap, ox: number, oy: number, x: number, y: number): void {
  const off = (dx: number, dy: number) => map.at(x + dx, y + dy) !== "Z";
  p.rect(ox, oy, TILE, TILE, DUNGEON.dais);
  if (off(0, -1)) p.rect(ox, oy, TILE, 2, DUNGEON.daisLight);
  if (off(-1, 0)) p.rect(ox, oy, 2, TILE, DUNGEON.daisLight);
  if (off(1, 0)) p.rect(ox + TILE - 2, oy, 2, TILE, DUNGEON.daisDark);
  if (off(0, 1)) {
    p.rect(ox, oy + TILE - 5, TILE, 5, DUNGEON.daisDark);
    p.rect(ox + 3, oy + TILE - 3, 2, 1, DUNGEON.rune);
    p.rect(ox + 10, oy + TILE - 3, 2, 1, DUNGEON.rune);
  }
}

function rug(p: Pen, map: GameMap, ox: number, oy: number, x: number, y: number): void {
  p.rect(ox, oy, TILE, TILE, C.rug);
  const edge = (dx: number, dy: number) => !"=tsμΩ".includes(map.at(x + dx, y + dy));
  if (edge(0, -1)) p.rect(ox, oy, TILE, 2, C.rugDark);
  if (edge(0, 1)) p.rect(ox, oy + TILE - 2, TILE, 2, C.rugDark);
  if (edge(-1, 0)) p.rect(ox, oy, 2, TILE, C.rugDark);
  if (edge(1, 0)) p.rect(ox + TILE - 2, oy, 2, TILE, C.rugDark);
  if ((x + y) % 2 === 0) {
    p.rect(ox + 7, oy + 4, 2, 8, C.rugLight);
    p.rect(ox + 4, oy + 7, 8, 2, C.rugLight);
  }
}

/** The Tavern's stage: raised boards, darker than the floor, with a lit lip along its front. */
function stage(p: Pen, map: GameMap, ox: number, oy: number, x: number, y: number): void {
  const off = (dx: number, dy: number) => map.at(x + dx, y + dy) !== "e";
  p.rect(ox, oy, TILE, TILE, C.woodDark);
  for (let i = 0; i < TILE; i += 4) p.rect(ox + i + 3, oy, 1, TILE, C.trunkDark);
  for (let j = 0; j < TILE; j += 8) p.px(ox + ((x * 5 + j) % 14), oy + j + 2, C.wood);
  if (off(0, -1)) p.rect(ox, oy, TILE, 1, C.wood);
  if (off(0, 1)) {
    p.rect(ox, oy + TILE - 3, TILE, 3, C.trunkDark);
    p.rect(ox, oy + TILE - 3, TILE, 1, C.woodLight);
  }
  if (off(-1, 0)) p.rect(ox, oy, 1, TILE, C.trunkDark);
  if (off(1, 0)) p.rect(ox + TILE - 1, oy, 1, TILE, C.trunkDark);
}

function wall(p: Pen, map: GameMap, ox: number, oy: number, x: number, y: number): void {
  const dark = map.id === "dungeon";
  const top = dark ? DUNGEON.wallTop : C.wallTop;
  const topLight = dark ? DUNGEON.wallTopLight : C.wallTopLight;
  // The office door is in the wall's face, so the wall above it stays a wall top.
  const below = map.at(x, y + 1);
  const face = !"WRΨΘ".includes(below) && !isPoster(below) && map.contains(x, y + 1);
  if (!face) {
    p.rect(ox, oy, TILE, TILE, top);
    if (hash(x, y, 5) < 0.3) p.rect(ox + 3, oy + 6, 6, 1, topLight);
    return;
  }
  if (dark) {
    // Stone blocks.
    p.rect(ox, oy, TILE, TILE, DUNGEON.wall);
    for (let j = 0; j < TILE; j += 5) {
      p.rect(ox, oy + j, TILE, 1, DUNGEON.wallDark);
      p.rect(ox + ((x * 7 + j) % 8) + (j % 10 === 0 ? 0 : 4), oy + j, 1, 5, DUNGEON.wallDark);
    }
    p.rect(ox, oy, TILE, 2, topLight);
    return;
  }
  const paper = map.decor?.wall ? WALL_ART[map.decor.wall] : undefined;
  if (paper) paper(p, ox, oy, x, y);
  else {
    p.rect(ox, oy, TILE, TILE, C.wall);
    for (let i = 0; i < TILE; i += 4) p.rect(ox + i, oy + 2, 1, TILE - 5, C.wallDark);
  }
  p.rect(ox, oy, TILE, 2, C.wallTopLight);
  p.rect(ox, oy + TILE - 3, TILE, 3, C.woodDark);
}

/** An office's wallpaper by id (`decor.ts`), on the wall's face; the top lip and the skirting are drawn over it. */
export const WALL_ART: Record<string, (p: Pen, ox: number, oy: number, x: number, y: number) => void> = {
  // Natmarked's hall: dark upright boards with a faint red paper-lantern glow along the top.
  natmarked: (p, ox, oy, x, y) => {
    p.rect(ox, oy, TILE, TILE, "#43302b");
    for (let i = 0; i < TILE; i += 4) p.rect(ox + i, oy + 2, 1, TILE - 5, "#2f2019");
    if (hash(x, y, 33) < 0.3) p.rect(ox + 5, oy + 7, 6, 1, "#5a3f36");
    p.rect(ox, oy + 2, TILE, 1, "#5a2a26");
  },
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
    // Tall pale panels, one every other tile, like a door in his rooms.
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
    const n = notes[(x * 3 + 1) % notes.length]!;
    p.rect(ox + 3, oy + 3, 5, 5, n);
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

function exit(p: Pen, map: GameMap, ox: number, oy: number, x: number, y: number): void {
  // The basement's way out is the stairs up, not a doormat; upstairs it is the stairs down.
  if (map.id === "basement" || map.id === "upstairs" || map.id === "common") {
    stairTile(p, ox, oy, x, y, map.id !== "basement");
    return;
  }
  if (map.id === "dungeon") stone(p, ox, oy, x, y);
  else floor(p, ox, oy, x, y, map.decor?.floor);
  p.rect(ox, oy, 2, TILE, C.woodDark);
  p.rect(ox + TILE - 2, oy, 2, TILE, C.woodDark);
  p.rect(ox + 3, oy + 4, TILE - 6, 8, C.rugLight);
  p.rect(ox + 4, oy + 5, TILE - 8, 6, C.rug);
}

/** Stairs (`S` down and `u` up in the Tavern, the basement's `x` up and upstairs' down): floor under the steps' landing. */
function stairTile(p: Pen, ox: number, oy: number, x: number, y: number, down: boolean): void {
  floor(p, ox, oy, x, y);
  p.g.drawImage(stairs(down), ox, oy);
}

/** One tile's ground, in its place on a canvas of the whole map. */
function paintTile(p: Pen, map: GameMap, x: number, y: number): void {
  const ox = (x - map.x0) * TILE;
  const oy = (y - map.y0) * TILE;
  typedSwitch(groundAt(map, x, y), {
    grass: () => grass(p, ox, oy, x, y),
    flowers: () => flowers(p, ox, oy, x, y),
    path: () => speckle(p, ox, oy, x, y, C.path, C.pathDark, C.pathLight),
    plaza: () => plaza(p, ox, oy, x, y),
    water: () => water(p, map, ox, oy, x, y),
    floor: () => floor(p, ox, oy, x, y, map.decor?.floor),
    rug: () => rug(p, map, ox, oy, x, y),
    wall: () => wall(p, map, ox, oy, x, y),
    exit: () => exit(p, map, ox, oy, x, y),
    stone: () => stone(p, ox, oy, x, y),
    stairs: () => stairTile(p, ox, oy, x, y, true),
    stairsUp: () => stairTile(p, ox, oy, x, y, false),
    dais: () => dais(p, map, ox, oy, x, y),
    stage: () => stage(p, map, ox, oy, x, y),
  });
}

/** The whole map's ground as one canvas; scenery and people are drawn over it every frame. */
export function bakeGround(map: GameMap): HTMLCanvasElement {
  return bake(map.width * TILE, map.height * TILE, (p) => {
    for (let y = map.y0; y < map.y0 + map.height; y++)
      for (let x = map.x0; x < map.x0 + map.width; x++) paintTile(p, map, x, y);
  });
}

/** Paints just these tiles again, on a ground baked for the same map before a drop came or went. */
export function repaintGround(canvas: HTMLCanvasElement, map: GameMap, tiles: [number, number][]): void {
  const p = new Pen(canvas.getContext("2d")!);
  for (const [x, y] of tiles) {
    if (!map.contains(x, y)) continue;
    p.g.clearRect((x - map.x0) * TILE, (y - map.y0) * TILE, TILE, TILE);
    paintTile(p, map, x, y);
  }
}

/** Moving glints on water, drawn per frame on top of the baked ground. */
export function drawWaterGlints(g: CanvasRenderingContext2D, map: GameMap, t: number): void {
  g.fillStyle = C.waterLight;
  const phase = Math.floor(t / 600);
  for (const [x, y] of map.find("~")) {
    if (hash(x, y, phase % 7) > 0.5) continue;
    const i = 2 + Math.floor(hash(x, y, phase) * 9);
    const j = 4 + Math.floor(hash(y, x, phase) * 8);
    g.fillRect(x * TILE + i, y * TILE + j, 3, 1);
  }
}

/**
 * A wallpaper or floor as a sample for the shop: three tiles across, two deep. A wall is shown the way a
 * room draws it (its face, the lip on top, the skirting below); an id nobody knows is the plain one.
 */
export const decorSwatch = cached(
  (kind: DecorKind, id: string) => `${kind}.${id}`,
  (kind, id) =>
    bake(3 * TILE, 2 * TILE, (p) => {
      for (let y = 0; y < 2; y++)
        for (let x = 0; x < 3; x++) {
          const [ox, oy] = [x * TILE, y * TILE];
          if (kind === "floor") {
            floor(p, ox, oy, x, y, id);
            continue;
          }
          const paper = WALL_ART[id];
          if (paper) paper(p, ox, oy, x, y);
          else {
            p.rect(ox, oy, TILE, TILE, C.wall);
            for (let i = 0; i < TILE; i += 4) p.rect(ox + i, oy + 2, 1, TILE - 5, C.wallDark);
          }
          if (y === 0) p.rect(ox, oy, TILE, 2, C.wallTopLight);
          if (y === 1) p.rect(ox, oy + TILE - 3, TILE, 3, C.woodDark);
        }
    }),
);
