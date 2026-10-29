/**
 * The game tables in town (`web/src/art/tables.ts`), in 3D: a square table per game with a seat on two
 * sides, something of its game on top, and a watcher-count billboard that floats over it when anyone is
 * watching. Plus the arena desk, a laptop whose screen glows brighter the harder its player burns tokens.
 */
import { C } from "../../art/palette.ts";
import type { Asset } from "../furniture/furniture.ts";
import { canvasTexture, glow, Model, type V3 } from "../kit/kit.ts";
import { liveScreen } from "../kit/livescreen.ts";

export type TableGame = "dice" | "hype" | "sprint" | "spr" | "tokenmaxxing";

export interface GameTable extends Model {
  /** Shows "👀 n" over the table; nothing when n is 0. */
  setWatchers: (n: number) => void;
}

/** Where the two sitters go (from the footprint centre) and which way they face: the table is between them. */
export const TABLE_SEATS: readonly { at: V3; turn: number }[] = [
  { at: [0, 0.38, 0.78], turn: Math.PI },
  { at: [0, 0.38, -0.78], turn: 0 },
];

function stool(m: Model, z: number, color: string): void {
  const back = z > 0 ? 1 : -1;
  m.cyl(0.03, 0.3, C.metalLight, [0, 0, z], 0.03, 8);
  m.cyl(0.2, 0.08, color, [0, 0.3, z], 0.2, 16);
  m.box([0.34, 0.3, 0.05], color, [0, 0.4, z + back * 0.2], 0.02);
}

function dice(m: Model, at: V3, turn: number): void {
  const d = m.box([0.1, 0.1, 0.1], C.white, at, 0.02);
  d.rotation.y = turn;
  const [x, y, z] = at;
  m.plane(0.025, 0.025, C.ink, [x, y + 0.1005, z]).rotation.x = -Math.PI / 2;
}

function topOf(m: Model, game: TableGame, h: number): void {
  if (game === "dice") {
    dice(m, [-0.12, h, -0.05], 0.4);
    dice(m, [0.14, h, 0.1], -0.3);
  } else if (game === "hype") {
    // A small screen with a green line shooting up.
    const tex = canvasTexture(20, 14, (g) => {
      g.fillStyle = "#1b1f2a";
      g.fillRect(0, 0, 20, 14);
      g.fillStyle = "#3ddc84";
      for (const [x, y] of [
        [2, 11],
        [5, 9],
        [8, 8],
        [11, 5],
        [14, 3],
        [17, 2],
      ] as const)
        g.fillRect(x, y, 2, 2);
    });
    m.box([0.34, 0.03, 0.2], C.metal, [0, h, 0]);
    m.box([0.04, 0.12, 0.04], C.metal, [0, h, -0.06]);
    m.box([0.4, 0.28, 0.03], C.ink, [0, h + 0.1, -0.1], 0.01).rotation.x = -0.12;
    m.plane(0.35, 0.23, glow("#fff", tex), [0, h + 0.24, -0.082]).rotation.x = -0.12;
  } else if (game === "sprint") {
    // A keyboard with a few keys lit.
    m.box([0.5, 0.04, 0.2], C.ink, [0, h, 0.05], 0.015);
    for (let i = 0; i < 9; i++)
      for (const r of [0, 1])
        m.box(
          [0.04, 0.02, 0.04],
          i % 3 === r ? C.lamp : C.metalLight,
          [-0.2 + i * 0.05, h + 0.04, 0.0 + r * 0.07],
          0.005,
        );
    m.box([0.3, 0.015, 0.03], C.white, [0, h + 0.04, 0.12]);
  } else {
    // A desk bell between two founders.
    m.cyl(0.09, 0.02, C.ink, [0, h, 0], 0.09);
    m.ball(0.075, "#e9b73d", [0, h + 0.03, 0], [1, 0.8, 1]);
    m.cyl(0.015, 0.03, C.ink, [0, h + 0.1, 0], 0.015, 6);
  }
}

const TABLE_TOP: Record<TableGame, { top: string; rim: string }> = {
  dice: { top: "#3f8f5a", rim: "#2c6b41" },
  hype: { top: C.wood, rim: C.woodDark },
  sprint: { top: C.wood, rim: C.woodDark },
  spr: { top: C.woodLight, rim: C.wood },
  tokenmaxxing: { top: C.woodLight, rim: C.wood },
};

/** A stool at the origin: the seat of someone at a table (`gameTable` with `stools` off leaves the seating to the caller). */
export function seatStool(): Model {
  const m = new Model();
  m.cyl(0.03, 0.3, C.metalLight, [0, 0, 0], 0.03, 8);
  m.cyl(0.2, 0.08, C.fabric, [0, 0.3, 0], 0.2, 16);
  return m;
}

/** A square table for `game`, footprint 2×2, with a stool on two sides (unless `stools` is off) and the watcher billboard. */
export const gameTable =
  (game: TableGame, stools = true) =>
  (): GameTable => {
    const m = new Model() as GameTable;
    const h = 0.62;
    const { top, rim } = TABLE_TOP[game];
    m.cyl(0.05, h, C.woodDark, [0, 0, 0], 0.05, 8);
    m.box([0.5, 0.04, 0.5], C.woodDark, [0, 0, 0], 0.01);
    m.box([0.98, 0.07, 0.98], rim, [0, h - 0.07, 0], 0.025);
    m.box([0.9, 0.02, 0.9], top, [0, h, 0], 0.008);
    topOf(m, game, h + 0.02);
    if (stools) {
      stool(m, 0.78, C.fabric);
      stool(m, -0.78, C.fabric);
    }
    // The billboard: a sign on a post by the table's corner.
    const sign = liveScreen<number>(
      0.7,
      0.26,
      0,
      (g, w, hh, n) => {
        g.fillStyle = "#1b1f2a";
        g.fillRect(0, 0, w, hh);
        g.fillStyle = "#ffe28a";
        g.font = `700 ${hh * 0.62}px 'Trebuchet MS', Arial, sans-serif`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(`👀 ${n}`, w / 2, hh / 2 + 1);
      },
      { px: 48, frame: "#2b2433", lift: 0, lit: true },
    );
    sign.position.set(0.5, 1.45, 0.5);
    sign.visible = false;
    const post = m.cyl(0.02, 1.45, C.metal, [0.5, 0, 0.5], 0.02, 6);
    post.visible = false;
    m.add(sign);
    m.setWatchers = (n) => {
      sign.visible = post.visible = n > 0;
      if (n > 0) sign.set(n);
    };
    return m;
  };

const GLOWS = ["#2a3a55", "#3f6fb0", "#6fb8ff", "#bfe9ff"] as const;

export interface ArenaDesk extends Model {
  /** 0-3: how hard the player is burning tokens. */
  setGlow: (level: number) => void;
}

export const arenaDesk = (): ArenaDesk => {
  const m = new Model() as ArenaDesk;
  m.box([0.9, 0.05, 0.6], C.woodLight, [0, 0.5, 0], 0.02);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) m.box([0.06, 0.5, 0.06], C.woodDark, [sx * 0.4, 0, sz * 0.24]);
  m.box([0.42, 0.015, 0.3], C.metalLight, [0, 0.55, 0.05], 0.005);
  const lid = m.box([0.42, 0.3, 0.02], C.ink, [0, 0.56, -0.1], 0.008);
  lid.rotation.x = -0.15;
  const mat = glow(GLOWS[0]);
  m.plane(0.37, 0.25, mat, [0, 0.7, -0.088]).rotation.x = -0.15;
  m.setGlow = (level) => mat.color.set(GLOWS[Math.max(0, Math.min(3, Math.round(level)))]!);
  m.setGlow(2);
  return m;
};

const tableAsset = (game: TableGame, name: string): Asset => ({
  id: `table:${game}`,
  name,
  price: 0,
  w: 2,
  d: 2,
  build: gameTable(game),
  seat: { at: TABLE_SEATS[0]!.at, turn: TABLE_SEATS[0]!.turn },
});

export const TABLE_ASSETS: readonly Asset[] = [
  tableAsset("dice", "Dice table"),
  tableAsset("hype", "Hype table"),
  tableAsset("sprint", "Sprint table"),
  tableAsset("spr", "Rock-paper-scissors table"),
  tableAsset("tokenmaxxing", "Tokenmaxxing table"),
  { id: "arena-desk", name: "Arena desk", price: 0, w: 1, d: 1, build: arenaDesk },
];
