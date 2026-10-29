/**
 * The basement net cafe under the Tavern, as 3D props (2D: `web/src/art/basement.ts`, `game/basement.ts`,
 * `core/src/maps.ts` `basement`): five arcade cabinets (one per game), the livestream screen, the tournament
 * board, two wall terminals, PC desks, server racks, a neon sign, foosball, vending machine, sofa, stairs;
 * a LAN-party mode and the dim lighting. `buildBasement()` lays them out like the 2D map.
 */
import { MAPS } from "@tokenmaxxing/core/maps.ts";
import { pokerChairs, pokerTable } from "@tokenmaxxing/core/pokertable.ts";
import { rouletteSpots } from "@tokenmaxxing/core/roulettetable.ts";
import * as THREE from "three";
import { C } from "../../art/palette.ts";
import { type Asset, assetById, light } from "../furniture/furniture.ts";
import { canvasTexture, codeScreen, glow, Model, seeded, ticks, tint, type V3 } from "../kit/kit.ts";
import {
  type BoardRow,
  lanParty,
  liveScreen,
  onLanParty,
  paintLeaderboard,
  paintRaid,
  paintScreen,
  type ScreenFeed,
} from "../kit/livescreen.ts";
import { TABLE_ASSETS } from "../town/tables3d.ts";
import { buildStairs } from "./exits3d.ts";
import { type PokerModel, pokerChair, pokerTable3d } from "./poker3d.ts";
import { Room, type Turn } from "./room.ts";
import { type RouletteModel, rouletteMats, rouletteTable3d } from "./roulette3d.ts";

export type { BoardRow, BracketView, MatchRow, ScreenFeed } from "../kit/livescreen.ts";
export { isLanPartyAt, lanParty, setLanParty } from "../kit/livescreen.ts";

/** The turn that faces a chair the way a sitter looks (a chair at turn 0 faces +z, towards the table below it). */
const CHAIR_TURN: Record<"down" | "right" | "up" | "left", Turn> = { down: 0, right: 1, up: 2, left: 3 };

const INK = C.ink;
const NEON = "#ff46be";
const LAN_PINK = "#ff8fe6";

/** A light that is on in the basement day and night, and turns magenta at the LAN party. */
function roomLight(m: Model, at: V3, color: string, intensity: number, distance = 3): void {
  light(m, at, color, intensity, distance);
  const l = m.children.at(-1) as THREE.PointLight;
  l.intensity = intensity;
  onLanParty((on) => l.color.set(on ? "#ff5fd2" : color));
}

/** A glowing material whose colour multiplies a map, so ticks can dim it to flicker. */
const flick = (t: number, seed: number): number =>
  0.82 +
  0.18 * Math.sin(t * 9 + seed * 2.1) * Math.sin(t * 3.7 + seed) -
  (Math.sin(t * 1.3 + seed * 5) > 0.97 ? 0.3 : 0);

// ——— Cabinets ———
export const CABINET_GAMES = ["spr", "hype", "dice", "sprint", "tokenmaxxing"] as const;
export type CabinetGame = (typeof CABINET_GAMES)[number];
/** Each game's marquee name and glow (2D: `CABINET_NAME`, `CABINET_GLOW`). */
export const CABINET: Record<CabinetGame, { label: string; hex: string; rgb: string }> = {
  spr: { label: "SPR", hex: "#ff5a5a", rgb: "255,90,90" },
  hype: { label: "HYPE", hex: "#5ac8ff", rgb: "90,200,255" },
  dice: { label: "DICE", hex: "#ffd65a", rgb: "255,214,90" },
  sprint: { label: "SPRINT", hex: "#5affa0", rgb: "90,255,160" },
  tokenmaxxing: { label: "TOKEN", hex: "#c878ff", rgb: "200,120,255" },
};

/** The attract-mode picture on a cabinet's screen, 28x22 pixels, `t` seconds in. */
function attract(g: CanvasRenderingContext2D, game: CabinetGame, hex: string, t: number): void {
  g.fillStyle = "#10121c";
  g.fillRect(0, 0, 28, 22);
  g.fillStyle = hex;
  const beat = Math.floor(t * 3);
  if (game === "spr") {
    // Three fists take turns to be picked.
    for (let i = 0; i < 3; i++) {
      g.globalAlpha = beat % 3 === i ? 1 : 0.35;
      g.fillRect(3 + i * 8, 7, 6, i === 1 ? 6 : 5);
      if (i === 2) g.fillRect(6 + i * 8, 5, 1, 3);
    }
    g.globalAlpha = 1;
  } else if (game === "hype") {
    // A line climbing, then crashing.
    let y = 18;
    for (let x = 2; x < 26; x++) {
      y = Math.max(3, Math.min(19, y - 1 + ((x * 7 + beat * 3) % 5 === 0 ? 3 : 0)));
      g.fillRect(x, y, 1, 1);
    }
  } else if (game === "dice") {
    // Two dice, pips rolling.
    for (const [x0, k] of [
      [4, beat % 6],
      [15, (beat * 5) % 6],
    ] as const) {
      g.fillRect(x0, 6, 9, 9);
      g.fillStyle = "#10121c";
      for (let p = 0; p <= k; p++) g.fillRect(x0 + 1 + (p % 3) * 3, 7 + Math.floor(p / 3) * 4, 2, 2);
      g.fillStyle = hex;
    }
  } else if (game === "sprint") {
    // A typing race: two bars racing along.
    g.fillRect(2, 6, 3 + ((beat * 2) % 22), 3);
    g.fillRect(2, 13, 3 + ((beat * 3) % 22), 3);
    g.fillStyle = "#e4f5fd";
    g.fillRect(25, 4, 1, 14);
  } else {
    // Coins stacking into bars: tokens.
    for (let i = 0; i < 6; i++) {
      const h = 3 + ((beat + i * 2) % 8) + i;
      g.fillRect(3 + i * 4, 19 - h, 3, h);
    }
  }
  g.fillStyle = "#e4f5fd";
  if (beat % 2 === 0) g.fillRect(8, 20, 12, 1);
}

const cabinet = (i: number) => (): Model => {
  const game = CABINET_GAMES[i]!;
  const { label, hex } = CABINET[game];
  const m = new Model();
  const body = tint(hex, -0.62);
  m.box([0.76, 0.9, 0.7], body, [0, 0, 0], 0.02);
  m.box([0.78, 0.13, 0.42], "#2b2433", [0, 0.88, 0.14], 0.02).rotation.x = 0.22;
  m.box([0.76, 1.05, 0.46], body, [0, 0.9, -0.12], 0.02);
  m.box([0.8, 0.3, 0.6], body, [0, 1.85, -0.05], 0.02);
  // Side stripes in the game's colour, lit.
  const stripe = glow(hex);
  for (const x of [-0.385, 0.385]) {
    m.box([0.012, 1.8, 0.05], stripe, [x, 0.05, 0.3], 0.004);
    m.box([0.012, 0.05, 0.6], stripe, [x, 1.12, -0.05], 0.004);
  }
  // The screen: a lit canvas of attract mode.
  const canvas = canvasTexture(28, 22, (g) => attract(g, game, hex, 0));
  const g2 = (canvas.image as HTMLCanvasElement).getContext("2d")!;
  const screenMat = glow("#fff", canvas);
  m.box([0.6, 0.5, 0.05], INK, [0, 1.1, 0.09], 0.01).rotation.x = -0.18;
  m.plane(0.52, 0.41, screenMat, [0, 1.37, 0.123]).rotation.x = -0.18;
  // The marquee: the name in the game's colour.
  const marquee = canvasTexture(64, 16, (g) => {
    g.fillStyle = tint(hex, -0.7);
    g.fillRect(0, 0, 64, 16);
    g.fillStyle = hex;
    g.font = "bold 12px 'Arial Black', Arial, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(label, 32, 9);
    g.fillStyle = "#fff";
    g.globalAlpha = 0.5;
    g.fillRect(2, 1, 60, 1);
    g.fillRect(2, 14, 60, 1);
  });
  const marqueeMat = glow("#fff", marquee);
  m.plane(0.74, 0.26, marqueeMat, [0, 1.86, 0.2515]);
  // Stick, buttons and the coin slot.
  m.cyl(0.015, 0.08, "#2b2433", [-0.15, 0.97, 0.22], 0.015, 6);
  m.ball(0.032, "#e25d5d", [-0.15, 1.06, 0.22]);
  for (let b = 0; b < 3; b++)
    m.cyl(
      0.025,
      0.02,
      ["#f0b53c", "#4f8fe0", "#3ddc84"][b]!,
      [0.05 + b * 0.08, 0.99, 0.2 - b * 0.01],
      0.025,
      8,
    );
  m.box([0.1, 0.12, 0.02], "#2b2433", [0, 0.35, 0.355], 0.005);
  m.plane(0.03, 0.05, glow(hex), [0, 0.38, 0.367]);
  roomLight(m, [0, 1.5, 0.7], hex, 1.1, 2.6);
  let shown = -1;
  ticks.push((t) => {
    const k = flick(t, i);
    marqueeMat.color.setScalar(k);
    screenMat.color.setScalar(0.55 + 0.45 * k);
    const f = Math.floor(t * 6);
    if (f === shown) return;
    shown = f;
    g2.clearRect(0, 0, 28, 22);
    attract(g2, game, hex, t);
    canvas.needsUpdate = true;
  });
  return m;
};

// ——— The big screen ———
export interface BigScreen extends Model {
  /** Paints the livestream: live rows, "+N more", the empty state, or a bracket. */
  show: (feed: ScreenFeed) => void;
}

/** The livestream screen over the back wall: a run of 6 tiles, a bezel and the live glass. */
const bigScreen = (): BigScreen => {
  const m = new Model() as BigScreen;
  const z = -0.4;
  m.box([5.9, 2.4, 0.14], C.metal, [0, 0.62, z], 0.04);
  m.box([5.9, 0.03, 0.15], C.metalLight, [0, 3.0, z], 0.01);
  const screen = liveScreen<ScreenFeed>(
    5.52,
    2.0,
    { matches: [] },
    (g, w, h, feed, t) => paintScreen(g, w, h, feed, t),
    {
      px: 64,
      frame: INK,
      lift: 0.78,
      fps: 3,
    },
  );
  screen.position.set(0, 0, z + 0.04);
  m.add(screen);
  // A shelf of cables and the mounting bar under it; the standby LED.
  m.box([5.4, 0.1, 0.12], INK, [0, 0.52, z], 0.02);
  m.box([5.3, 0.04, 0.1], C.metal, [0, 0.56, z + 0.01]);
  m.plane(0.05, 0.05, glow("#3ddc84"), [2.78, 0.68, z + 0.081]);
  const wash = new THREE.PointLight("#46aaff", 1.6, 7, 1.4);
  wash.position.set(0, 1.9, 0.6);
  wash.userData.night = 1.6;
  m.add(wash);
  const rewash = (on: boolean) => wash.color.set(on ? "#ff50d2" : "#46aaff");
  onLanParty(rewash);
  ticks.push((t) => {
    wash.intensity = 1.6 * flick(t / 3, 7);
  });
  m.show = screen.set;
  screen.set({ matches: [] });
  return m;
};

// ——— The tournament board ———
export interface BoardPairing {
  a: string | null;
  b: string | null;
  winner: "a" | "b" | null;
}
export interface TournamentBoardView {
  /** Rounds, first to last (the last has one match). Absent: the chalk sketch of a bracket. */
  rounds?: BoardPairing[][] | null;
  champion?: string | null;
}
export interface TournamentBoard extends Model {
  show: (view: TournamentBoardView) => void;
}

const CHALK = "#d8e4dc";

function paintBoard(g: CanvasRenderingContext2D, w: number, h: number, view: TournamentBoardView): void {
  g.fillStyle = "#1c2b2a";
  g.fillRect(0, 0, w, h);
  g.fillStyle = CHALK;
  g.strokeStyle = CHALK;
  g.lineWidth = 1.5;
  const rounds = view.rounds;
  if (!rounds) {
    // Four lines into two into one, and a gold star: the 2D board's chalk sketch.
    const ys = [0.22, 0.4, 0.62, 0.8].map((v) => v * h);
    g.beginPath();
    for (const y of ys) {
      g.moveTo(w * 0.1, y);
      g.lineTo(w * 0.32, y);
    }
    g.moveTo(w * 0.32, ys[0]!);
    g.lineTo(w * 0.32, ys[1]!);
    g.moveTo(w * 0.32, ys[2]!);
    g.lineTo(w * 0.32, ys[3]!);
    g.moveTo(w * 0.32, (ys[0]! + ys[1]!) / 2);
    g.lineTo(w * 0.5, (ys[0]! + ys[1]!) / 2);
    g.moveTo(w * 0.32, (ys[2]! + ys[3]!) / 2);
    g.lineTo(w * 0.5, (ys[2]! + ys[3]!) / 2);
    g.moveTo(w * 0.5, (ys[0]! + ys[1]!) / 2);
    g.lineTo(w * 0.5, (ys[2]! + ys[3]!) / 2);
    g.moveTo(w * 0.5, h * 0.5);
    g.lineTo(w * 0.64, h * 0.5);
    g.stroke();
    g.fillStyle = "#ffd75a";
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? h * 0.09 : h * 0.2;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      g.lineTo(w * 0.8 + Math.cos(a) * r, h * 0.5 + Math.sin(a) * r);
    }
    g.fill();
    return;
  }
  // A live bracket: names in chalk, a winner underlined.
  const colW = w / rounds.length;
  g.font = `700 ${Math.max(6, h * 0.075)}px 'Trebuchet MS', Arial, sans-serif`;
  g.textBaseline = "middle";
  g.textAlign = "left";
  for (const [r, round] of rounds.entries()) {
    const slot = h / (round.length * 2);
    for (const [i, m] of round.entries()) {
      for (const [side, name] of [
        ["a", m.a],
        ["b", m.b],
      ] as const) {
        const y = (i * 2 + (side === "a" ? 0.5 : 1.5)) * slot;
        const won = m.winner === side;
        g.fillStyle = won ? "#ffd75a" : CHALK;
        g.globalAlpha = name ? 1 : 0.4;
        g.fillText(cutText(g, name ?? "…", colW - 8), r * colW + 4, y);
        g.globalAlpha = 1;
        g.fillRect(r * colW + 3, y + h * 0.045, colW - 8, 1);
      }
    }
  }
}

function cutText(g: CanvasRenderingContext2D, text: string, maxW: number): string {
  while (text.length > 2 && g.measureText(text).width > maxW) text = `${text.slice(0, -2)}…`;
  return text;
}

/** A crown that turns over the board once there is a champion. */
function crown(): Model {
  const m = new Model();
  const gold = "#ffd75a";
  m.cyl(0.14, 0.08, gold, [0, 0, 0], 0.14, 12);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    m.cyl(0.04, 0.14, gold, [Math.cos(a) * 0.11, 0.07, Math.sin(a) * 0.11], 0.005, 6);
    m.ball(0.022, "#e25d5d", [Math.cos(a) * 0.11, 0.22, Math.sin(a) * 0.11], [1, 1, 1], 6);
  }
  return m;
}

/** The tournament board on the wall: a chalk slate, the champion's name and a crown under it. */
const tournamentBoard = (): TournamentBoard => {
  const m = new Model() as TournamentBoard;
  const z = -0.4;
  const slate = liveScreen<TournamentBoardView>(1.4, 0.95, {}, (g, w, h, v) => paintBoard(g, w, h, v), {
    px: 80,
    frame: C.woodDark,
    lift: 1.25,
    lit: false,
  });
  slate.position.set(0, 0, z + 0.04);
  m.add(slate);
  m.box([1.5, 0.04, 0.12], C.woodDark, [0, 1.2, z + 0.04]);
  const plate = liveScreen<string>(
    1.2,
    0.2,
    "",
    (g, w, h, name) => {
      g.fillStyle = "#0a081c";
      g.fillRect(0, 0, w, h);
      g.fillStyle = "#ffd75a";
      g.font = `700 ${h * 0.62}px 'Trebuchet MS', Arial, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(cutText(g, `👑 ${name}`, w - 8), w / 2, h / 2 + 1);
    },
    { px: 64, frame: C.woodDark, lift: 0.88 },
  );
  plate.position.set(0, 0, z + 0.07);
  plate.visible = false;
  m.add(plate);
  const c = crown();
  c.position.set(0, 2.5, z + 0.1);
  c.visible = false;
  m.add(c);
  ticks.push((t) => {
    c.rotation.y = t * 1.2;
    c.position.y = 2.5 + Math.sin(t * 2) * 0.03;
  });
  m.show = (view) => {
    slate.set(view);
    plate.visible = c.visible = !!view.champion;
    if (view.champion) plate.set(view.champion);
  };
  slate.set({});
  return m;
};

// ——— Wall terminals ———
export interface Terminal extends Model {
  /** The leaderboard terminal takes rows (today's top by tokens); the raid one takes the boss's HP share. */
  show: (value: BoardRow[] | number | null) => void;
}

const terminal = (kind: "board" | "raid") => (): Terminal => {
  const m = new Model() as Terminal;
  const z = -0.35;
  // A green-glass CRT on a bracket.
  m.box([0.2, 0.2, 0.2], C.metal, [0, 0.98, z - 0.02], 0.02);
  m.box([0.86, 0.74, 0.3], C.metal, [0, 1.08, z + 0.1], 0.04);
  m.box([0.88, 0.05, 0.3], C.metalLight, [0, 1.8, z + 0.1], 0.015);
  m.box([0.5, 0.06, 0.1], INK, [0, 1.0, z + 0.26]);
  const state: { v: BoardRow[] | number | null } = { v: kind === "board" ? [] : null };
  const screen = liveScreen<typeof state>(
    0.68,
    0.5,
    state,
    (g, w, h, s, t) =>
      kind === "board"
        ? paintLeaderboard(g, w, h, (s.v as BoardRow[]) ?? [], t)
        : paintRaid(g, w, h, s.v as number | null, t),
    { px: 64, frame: INK, lift: 1.2, fps: 2, smooth: false },
  );
  screen.position.set(0, 0, z + 0.23);
  m.add(screen);
  roomLight(m, [0, 1.5, 0.3], "#46ff96", 0.6, 2);
  m.show = (v) => screen.set({ v });
  return m;
};

// ——— PC desks, chairs, racks ———
const PC_HUES = ["#bfe9ff", "#c8ffd8", "#ffc8f0"] as const;
const PC_LIGHT = ["#5ad2ff", "#5aff9f", "#ff64dc"] as const;
let pcs = 0;

/** A PC pair: two screens on a standing desk (2D `ζ`), each in its own colour and flickering slowly. */
const pcDesk = (): Model => {
  const n = pcs++;
  const m = new Model();
  for (const x of [-0.7, 0.7]) {
    m.box([0.08, 0.04, 0.6], INK, [x, 0, 0]);
    m.box([0.07, 0.75, 0.07], C.metalLight, [x, 0.04, 0]);
  }
  m.box([1.85, 0.05, 0.72], "#3c4454", [0, 0.8, 0], 0.015);
  const mats: THREE.MeshBasicMaterial[] = [];
  for (const [j, x] of [-0.45, 0.45].entries()) {
    const seed = n * 2 + j + 21;
    m.box([0.16, 0.012, 0.1], C.metal, [x, 0.85, -0.17]);
    m.box([0.03, 0.14, 0.03], C.metal, [x, 0.85, -0.19]);
    m.box([0.5, 0.31, 0.035], INK, [x, 0.96, -0.17]);
    const mat = glow("#fff", codeScreen(seed, "#10141f"));
    m.plane(0.46, 0.27, mat, [x, 1.115, -0.151]);
    mats.push(mat);
    m.box([0.38, 0.02, 0.12], "#2b2433", [x, 0.85, 0.12], 0.008);
    m.box([0.07, 0.025, 0.1], "#2b2433", [x + 0.28, 0.85, 0.13], 0.012);
  }
  const hue = n % PC_HUES.length;
  const paint = (on: boolean, t = 0) => {
    for (const mat of mats)
      mat.color.set(on ? LAN_PINK : PC_HUES[hue]!).multiplyScalar(0.7 + 0.3 * flick(t, n));
  };
  paint(lanParty());
  onLanParty((on) => paint(on));
  ticks.push((t) => paint(lanParty(), t / 4));
  roomLight(m, [0, 1.1, 0.5], PC_LIGHT[hue]!, 0.5, 2);
  return m;
};

const rack = (): Model => {
  const m = new Model();
  const id = pcs + Math.floor(Math.random() * 1000);
  const rnd = seeded(id);
  m.box([0.8, 1.95, 0.7], "#343c4c", [0, 0, 0], 0.03);
  const leds: { mat: THREE.MeshBasicMaterial; on: string; period: number; phase: number }[] = [];
  for (let i = 0; i < 9; i++) {
    m.box([0.68, 0.16, 0.02], "#3c4454", [0, 0.1 + i * 0.2, 0.35], 0.01);
    for (let j = 0; j < 3; j++) {
      const amber = rnd() < 0.3;
      leds.push({
        mat: glow("#1b3a2a"),
        on: amber ? "#ffbe3c" : "#50ff8c",
        period: 0.26 + rnd() * 0.3,
        phase: rnd() * 5,
      });
      m.plane(0.03, 0.03, leds.at(-1)!.mat, [-0.28 + j * 0.06, 0.18 + i * 0.2, 0.361]);
    }
    for (let k = 0; k < 5; k++)
      m.box([0.06, 0.08, 0.005], "#1b1f2a", [0.04 + k * 0.05, 0.14 + i * 0.2, 0.362], 0.002);
  }
  ticks.push((t) => {
    for (const l of leds) l.mat.color.set(Math.floor((t + l.phase) / l.period) % 2 === 0 ? l.on : "#183021");
  });
  roomLight(m, [0, 1.2, 0.8], "#50ff8c", 0.9, 2.4);
  return m;
};

// ——— Neon sign ———
const neon = (): Model => {
  const m = new Model();
  const tex = canvasTexture(72, 22, (g) => {
    g.fillStyle = "#1b1f2a";
    g.fillRect(0, 0, 72, 22);
    g.strokeStyle = NEON;
    g.lineWidth = 1;
    g.strokeRect(2.5, 2.5, 67, 17);
    g.fillStyle = "#ffd3f1";
    g.font = "bold 12px 'Arial Black', Arial, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.shadowColor = NEON;
    g.shadowBlur = 4;
    g.fillText("NET CAFE", 36, 12);
  });
  const mat = glow("#fff", tex);
  const z = -0.42;
  m.box([1.9, 0.62, 0.05], "#1b1f2a", [0, 1.45, z], 0.02);
  m.plane(1.84, 0.56, mat, [0, 1.75, z + 0.026]);
  const l = new THREE.PointLight(NEON, 1.4, 5, 1.4);
  l.position.set(0, 1.7, 0.4);
  l.userData.night = 1.4;
  m.add(l);
  ticks.push((t) => {
    // 2D: 0.65 + 0.35 sin(now / 650 ms), or / 180 at the LAN party.
    const k = 0.65 + 0.35 * Math.sin((t * 1000) / (lanParty() ? 180 : 650));
    mat.color.setScalar(0.45 + 0.55 * k);
    l.intensity = 1.4 * k;
  });
  onLanParty((on) => l.color.set(on ? "#ff2fd0" : NEON));
  return m;
};

// ——— Stairs ———
/** The stairs tile (the shared `buildStairs`, wall at -z; the room turns it to the south wall): up is the basement's `x`; down is the dark hatch. */
const stairs = (down: boolean) => (): Model =>
  buildStairs({
    dir: down ? "down" : "up",
    wall: "#2a2744",
    wood: C.woodDark,
    tread: "#be804e",
    plate: down ? null : undefined,
  });

// ——— Catalogue ———
const tile = (
  ch: string,
  name: string,
  w: number,
  d: number,
  build: () => Model,
  extra: Partial<Asset> = {},
): Asset => ({ id: `tile:${ch}`, name, price: 0, w, d, build, ...extra });

const reuse = (id: string): (() => Model) => assetById.get(id)!.build;

export const BASEMENT_ASSETS: readonly Asset[] = [
  ...CABINET_GAMES.map((g, i) => tile(`C:${g}`, `${CABINET[g].label} cabinet`, 1, 1, cabinet(i))),
  tile("E", "Big screen", 6, 1, bigScreen),
  tile("M", "Wall terminal (leaderboard)", 1, 1, terminal("board")),
  tile("M:raid", "Wall terminal (raid)", 1, 1, terminal("raid")),
  tile("i", "Tournament board", 1, 1, tournamentBoard),
  tile("η", "Server rack", 1, 1, rack),
  tile("ζ", "PC pair", 2, 1, pcDesk),
  tile("c", "Office chair", 1, 1, reuse("chair"), { seat: assetById.get("chair")!.seat! }),
  tile("δ", "Neon sign", 2, 1, neon),
  tile("φ", "Foosball table", 2, 1, reuse("foosball")),
  tile("Π", "Vending machine", 1, 1, reuse("vending-machine")),
  tile("s", "Sofa", 2, 1, reuse("sofa"), { seat: assetById.get("sofa")!.seat! }),
  tile("♠", "Poker table", 4, 2, pokerTable3d),
  tile("♣", "Card-room chair", 1, 1, pokerChair, { seat: { at: [0, 0.5, 0.03], turn: 0 } }),
  tile("♦", "Roulette table", 3, 2, rouletteTable3d),
  tile("x", "Stairs up", 1, 1, stairs(false)),
  { id: "stairs:down", name: "Stairs down", price: 0, w: 1, d: 1, build: stairs(true) },
  ...TABLE_ASSETS,
];

// ——— The room ———
/** Dim lights for the basement scene: a low constant, point lights always on (cabinets, screens, neon). */
export function dimBasement(
  scene: THREE.Scene,
  hemi: THREE.HemisphereLight,
  sun: THREE.DirectionalLight,
): void {
  hemi.intensity = 0.95;
  hemi.color.set("#8d86d8");
  sun.intensity = 0.28;
  sun.color.set("#aab0ff");
  (scene.background as THREE.Color).set("#0b0a16");
  scene.traverse((o) => {
    if (o instanceof THREE.PointLight) o.intensity = o.userData.night ?? o.intensity;
  });
}

export interface BasementScene {
  room: Room;
  screen: BigScreen;
  board: TournamentBoard;
  terminals: [Terminal, Terminal];
  /** The poker table, for the game on it (`show`); null if the map has none. */
  poker: PokerModel | null;
  /** The roulette table, for its wheel and seated players; null if the map has none. */
  roulette: RouletteModel | null;
}

/** The basement laid out like the 2D map (`core/src/maps.ts`), 20×12 tiles, every prop placed. */
export function buildBasement(): BasementScene {
  const room = new Room(20, 12, { floor: "#3b3454", wall: "#2a2744", stripe: "#35315a", bare: true });
  const at = (id: string, x: number, z: number, turn: Turn = 0) =>
    room.place(
      BASEMENT_ASSETS.find((a) => a.id === id)!,
      x,
      z,
      turn,
    );
  for (let x = 0; x < 6; x++) at("tile:η", x, 0);
  const screenP = at("tile:E", 6, 0);
  const [t1, t2] = [at("tile:M", 12, 0), at("tile:M:raid", 13, 0)];
  const boardP = at("tile:i", 14, 0);
  at("tile:δ", 15, 0);
  for (let i = 0; i < 5; i++) at(`tile:C:${CABINET_GAMES[i]}`, 1 + i, 2);
  at("tile:Π", 18, 2);
  at("tile:φ", 1, 4);
  for (const x of [7, 10, 13, 16]) {
    at("tile:ζ", x, 4);
    at("tile:c", x, 5, 2);
    at("tile:c", x + 1, 5, 2);
  }
  // The two plants in the corners the map has (`p`).
  for (const [px, pz] of [
    [19, 0],
    [18, 10],
  ] as const)
    room.place(assetById.get("plant")!, px, pz);
  at("tile:s", 1, 10, 2);
  at("tile:s", 3, 10, 2);
  at("tile:x", 9, 11, 2);
  at("stairs:down", 18, 11, 2);
  // The poker table and its six chairs, then the roulette table and a mat under each of its spots, where the map says.
  const map = MAPS.basement;
  const [ix, iz] = [1, 2];
  const felt = pokerTable(map);
  let poker: PokerModel | null = null;
  if (felt) {
    poker = at("tile:♠", felt.x - ix, felt.y - iz).model as PokerModel;
    for (const ch of pokerChairs(map)) at("tile:♣", ch.x - ix, ch.y - iz, CHAIR_TURN[ch.facing]);
  }
  const wheel = map.find("♦");
  const spots = rouletteSpots(map).map(([px, py]) => [px - ix, py - iz] as const);
  let roulette: RouletteModel | null = null;
  if (wheel.length) {
    const x = Math.min(...wheel.map(([px]) => px));
    const z = Math.min(...wheel.map(([, py]) => py));
    roulette = at("tile:♦", x - ix, z - iz).model as RouletteModel;
    // The table's middle (3x2 tiles) is the origin of its own space.
    roulette.setSpots(spots.map(([sx, sz]) => [sx + 0.5 - (x - ix + 1.5), sz + 0.5 - (z - iz + 1)] as const));
  }
  if (spots.length) room.group.add(rouletteMats(spots));
  const screen = screenP.model as BigScreen;
  const board = boardP.model as TournamentBoard;
  const terminals: [Terminal, Terminal] = [t1.model as Terminal, t2.model as Terminal];
  board.show({ rounds: null });
  return { room, screen, board, terminals, poker, roulette };
}
