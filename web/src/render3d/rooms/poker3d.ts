/**
 * The net cafe's poker table as a 3D prop: a stadium of green felt in a padded rail and a wooden rim, on two
 * pedestals. Its size and the way round it are read off the map (`core/pokertable.ts`), so the chairs and
 * the chips always meet. `show()` lays what is going on onto the felt: the board as little face-up cards, each
 * seat's cards, bet and stack as chips, the pot and the dealer's button. Nothing here knows the game's rules.
 */
import { MAPS } from "@tokenmaxxing/core/maps.ts";
import { type Card, cardFace } from "@tokenmaxxing/core/poker.ts";
import { pokerChairs, pokerTable } from "@tokenmaxxing/core/pokertable.ts";
import { DIRS } from "@tokenmaxxing/core/world.ts";
import * as THREE from "three";
import { C } from "../../art/palette.ts";
import { canvasTexture, liveModel, Model, tint, type V3 } from "../kit/kit.ts";

const FELT = "#256b43";
const FELT_Y = 0.8;
const FONT = "ui-monospace, Menlo, Consolas, monospace";

/** What the felt shows: the board, the pot out of sight of the bets, and each seat (null: empty). */
export interface PokerScene {
  board: Card[];
  /** Coins in the middle: the pot without the bets still in front of the players. */
  pot: number;
  seats: (PokerSeatScene | null)[];
}

export interface PokerSeatScene {
  stack: number;
  /** Put in on this street. */
  bet: number;
  /** Holds two cards still in the hand: shown face down. */
  dealt: boolean;
  /** Their two cards, face up (showdown). */
  shown: Card[] | null;
  dealer: boolean;
}

export interface PokerModel extends Model {
  show(scene: PokerScene): void;
  /** Where seat `i` is in the world (the chair), for labels. */
  seatWorld(i: number, into: THREE.Vector3): THREE.Vector3;
  /** The middle of the felt in the world. */
  centreWorld(into: THREE.Vector3): THREE.Vector3;
}

// MARK: Cards and chips

const cardGeometry = (() => {
  let g: THREE.PlaneGeometry | null = null;
  return () => {
    g ??= new THREE.PlaneGeometry(0.3, 0.42);
    g.userData.shared = true;
    return g;
  };
})();

const faces = new Map<Card | "back" | "button", THREE.MeshBasicMaterial>();

/** A card's face (or its back, or the dealer's button) as a flat, unlit picture. Made once, shared by every table. */
function faceMaterial(which: Card | "back" | "button"): THREE.MeshBasicMaterial {
  let mat = faces.get(which);
  if (mat) return mat;
  const button = which === "button";
  const map = canvasTexture(
    60,
    button ? 60 : 84,
    (g) => {
      if (button) {
        g.fillStyle = "#fbf7ef";
        g.beginPath();
        g.arc(30, 30, 28, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = C.ink;
        g.lineWidth = 3;
        g.stroke();
        g.fillStyle = C.ink;
        g.font = `bold 34px ${FONT}`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText("D", 30, 32);
        return;
      }
      g.fillStyle = which === "back" ? "#7a2a3a" : "#fbf7ef";
      g.beginPath();
      g.roundRect(1, 1, 58, 82, 7);
      g.fill();
      g.strokeStyle = which === "back" ? "#f1e6d2" : C.ink;
      g.lineWidth = 3;
      g.stroke();
      if (which === "back") {
        g.strokeStyle = "#5e1f2d";
        g.lineWidth = 3;
        for (let i = -90; i < 90; i += 11) {
          g.beginPath();
          g.moveTo(i, 4);
          g.lineTo(i + 80, 80);
          g.stroke();
        }
        return;
      }
      const { rank, suit, red } = cardFace(which);
      g.fillStyle = red ? "#c0392b" : C.ink;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = `bold ${rank.length > 1 ? 26 : 32}px ${FONT}`;
      g.fillText(rank, 30, 22);
      g.font = `bold 44px ${FONT}`;
      g.fillText(suit, 30, 60);
    },
    true,
  );
  map.userData.shared = true;
  mat = new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide });
  mat.userData.shared = true;
  faces.set(which, mat);
  return mat;
}

/** A card or the button, lying on the felt at `at` with its top edge towards `towards` (an xz direction). */
function lay(
  parent: THREE.Object3D,
  which: Card | "back" | "button",
  at: V3,
  towards: [number, number],
): void {
  const q = new THREE.Mesh(cardGeometry(), faceMaterial(which));
  if (which === "button") {
    q.scale.set(0.5, 0.36, 1);
    q.position.set(at[0], at[1] + 0.012, at[2]);
  } else q.position.set(...at);
  q.rotation.order = "YXZ";
  q.rotation.x = -Math.PI / 2;
  q.rotation.y = Math.atan2(-towards[0], -towards[1]);
  parent.add(q);
}

const CHIP_COLOURS = { bet: "#c0392b", stack: "#2f6fb5", pot: "#e0a82e" } as const;

/** Chips for `coins` at `at` on the felt: stacks of up to eight, a chip for every ten coins. */
function chips(
  m: Model,
  coins: number,
  at: V3,
  kind: keyof typeof CHIP_COLOURS,
  across: [number, number],
): void {
  if (coins <= 0) return;
  const count = Math.min(24, Math.max(1, Math.round(coins / 10)));
  const colour = CHIP_COLOURS[kind];
  const stacks = Math.ceil(count / 8);
  for (let s = 0; s < stacks; s++) {
    const n = Math.min(8, count - s * 8);
    const k = s - (stacks - 1) / 2;
    const x = at[0] + across[0] * k * 0.17;
    const z = at[2] + across[1] * k * 0.17;
    for (let i = 0; i < n; i++) {
      m.cyl(0.07, 0.026, i % 2 === 0 ? colour : tint(colour, 0.25), [x, at[1] + i * 0.028, z], 0.07, 10);
    }
  }
}

// MARK: The table

/** The poker table, built from the map's table and chairs; `show` puts the game on it. */
export function pokerTable3d(): PokerModel {
  const m = new Model() as PokerModel;
  const spot = pokerTable(MAPS.basement) ?? { x: 0, y: 0, w: 4, h: 2 };
  const chairs = pokerChairs(MAPS.basement);
  const hw = spot.w / 2;
  const hd = spot.h / 2;
  // A stadium: a box between two discs.
  const r = hd - 0.03;
  const half = hw - r;
  const stadium = (radius: number, y: number, h: number, paint: string, shrink = 0) => {
    const rr = radius - shrink;
    m.box([half * 2, h, rr * 2], paint, [0, y, 0], 0.02);
    for (const s of [-1, 1]) m.cyl(rr, h, paint, [s * half, y, 0], rr, 28);
  };
  stadium(r - 0.03, 0.46, 0.14, C.woodDark);
  stadium(r, 0.6, 0.15, C.woodLight);
  stadium(r - 0.07, 0.75, 0.04, "#5e2a2a");
  stadium(r - 0.2, 0.78, 0.022, FELT);
  for (const s of [-1, 1]) {
    m.cyl(0.2, 0.46, C.woodDark, [s * half, 0, 0], 0.15, 12);
    m.cyl(0.32, 0.05, C.woodDark, [s * half, 0, 0], 0.3, 14);
  }
  m.box([half * 2, 0.07, 0.12], C.woodDark, [0, 0.12, 0], 0.02);

  // Where each seat sits, in the table's own space (a tile is a unit), and which way it faces.
  const cx = spot.x + hw;
  const cy = spot.y + hd;
  const seats = chairs.map((ch) => {
    const [fx, fz] = DIRS[ch.facing];
    return { x: ch.x + 0.5 - cx, z: ch.y + 0.5 - cy, f: [fx, fz] as [number, number] };
  });

  // What is on the felt changes with every hand, so it is a live model: the room neither merges it into its
  // static meshes nor puts the table's subtree to sleep (`perf/bake.ts`).
  const live = liveModel();
  live.position.y = FELT_Y + 0.012;
  m.add(live);
  let shown = "";
  m.show = (scene) => {
    const key = JSON.stringify(scene);
    if (key === shown) return;
    shown = key;
    live.clear();
    for (const [i, c] of scene.board.entries())
      lay(live, c, [(i - (scene.board.length - 1) / 2) * 0.37, 0, 0], [0, -1]);
    chips(live, scene.pot, [0, 0, -0.5], "pot", [1, 0]);
    for (const [i, seat] of scene.seats.entries()) {
      const s = seats[i];
      if (!seat || !s) continue;
      const vertical = s.f[0] === 0;
      const at = (dist: number, side = 0): V3 => [
        s.x + s.f[0] * dist - s.f[1] * side,
        0,
        s.z + s.f[1] * dist + s.f[0] * side,
      ];
      // Two cards side by side, tops towards the middle of the table; the dealer's button beside them.
      const cards = vertical ? 0.9 : 1.0;
      const across: [number, number] = [-s.f[1], s.f[0]];
      if (seat.shown || seat.dealt)
        for (const [k, side] of [-0.17, 0.17].entries())
          lay(live, seat.shown?.[k] ?? "back", at(cards, side), s.f);
      if (seat.dealer) lay(live, "button", at(cards, -0.52), s.f);
      chips(live, seat.bet, at(vertical ? 1.18 : 1.3), "bet", across);
      chips(live, seat.stack, at(cards, 0.55), "stack", across);
    }
  };

  const v = new THREE.Vector3();
  m.seatWorld = (i, into) => {
    const s = seats[i];
    v.set(s?.x ?? 0, 0, s?.z ?? 0);
    return into.copy(m.localToWorld(v));
  };
  m.centreWorld = (into) => into.copy(m.localToWorld(v.set(0, FELT_Y, 0)));
  return m;
}

/** A chair at the poker table: a wooden chair facing +z, with a red cushion. */
export function pokerChair(): Model {
  const m = new Model();
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) m.cyl(0.025, 0.4, C.woodDark, [sx * 0.17, 0, sz * 0.17], 0.025, 8);
  m.box([0.42, 0.06, 0.42], C.woodLight, [0, 0.4, 0], 0.02);
  for (const sx of [-1, 1]) m.box([0.04, 0.5, 0.04], C.woodDark, [sx * 0.17, 0.44, -0.18], 0.012);
  for (const y of [0.62, 0.76]) m.box([0.372, 0.07, 0.03], C.wood, [0, y, -0.18], 0.01);
  m.box([0.38, 0.05, 0.38], C.rug, [0, 0.455, 0.01], 0.02);
  return m;
}
