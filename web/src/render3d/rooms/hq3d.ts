/**
 * The company building (`hq`) as a 3D room: the 2D floor plan (`HQ_ROWS`) turned into placed assets, the
 * company wallet's furniture dropped on its slots (`COMPANY_FURNITURE`), the game posters hung along the
 * wall row, and the desks at the house-wide fleet tier (laptop to battlestation). The trophy case and the
 * rest come from `furniture.ts`; what it doesn't have yet (globe, plant wall, chandelier, Persian rug) is
 * built here and used only when `furniture.ts` has no piece by that name.
 */
import type { Rot } from "@tokenmaxxing/core/office.ts";
import * as THREE from "three";
import { C } from "../../art/palette.ts";
import { Pen } from "../../art/pixels.ts";
import { COMPANY_FURNITURE, DESKS, HQ_ROWS, POSTERS } from "../data/town.ts";
import { type Asset, assetById, light } from "../furniture/furniture.ts";
import { canvasTexture, codeScreen, glow, Model, painted, seeded, ticks, tint } from "../kit/kit.ts";
import { type Panel, panel } from "../kit/panel.ts";
import { exitDoorway } from "./exits3d.ts";
import { type Placed, Room, type Turn } from "./room.ts";

// MARK: Desks by fleet tier

function screen(
  m: Model,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  seed: number,
  turn = 0,
): void {
  const s = m.part([x, y, z], turn);
  s.box([0.1, 0.012, 0.08], C.metal, [0, 0, 0]);
  s.box([0.025, h * 0.35, 0.025], C.metal, [0, 0, -0.01]);
  s.box([w, h, 0.03], "#2b2433", [0, h * 0.3, 0]);
  s.plane(w - 0.03, h - 0.03, glow("#fff", codeScreen(seed)), [0, h * 0.3 + h / 2, 0.017]);
}

/** One tile of desk with the setup the company fleet (or a sitter) has (`DESKS`, by index), facing +z. */
export function fleetDesk(tier: number, seed = 1, base = true): Model {
  const m = new Model();
  const t = Math.max(0, Math.min(tier, DESKS.length - 1));
  const [w, d, h] = [0.96, 0.66, 0.62];
  // `base` false is the setup alone, to stand on a desk of another make (the raid's war desks).
  if (base) {
    m.box([w, 0.05, d], C.woodLight, [0, h, 0], 0.015);
    for (const sx of [-1, 1]) m.box([0.05, h, d - 0.08], C.wood, [sx * (w / 2 - 0.05), 0, 0]);
    m.box([w - 0.12, 0.3, 0.02], C.wood, [0, h - 0.3, -d / 2 + 0.04]);
  }
  const top = h + 0.05;
  // Keyboard and a mouse, and a mug.
  m.box([0.32, 0.015, 0.1], "#3c4454", [0, top, 0.16], 0.006);
  m.box([0.05, 0.02, 0.07], "#3c4454", [0.26, top, 0.17], 0.01);
  m.cyl(0.035, 0.07, "#e25d5d", [-0.36, top, 0.0], 0.035, 10);
  if (t === 0) {
    // A laptop covered in stickers.
    m.box([0.38, 0.018, 0.26], C.metalLight, [0, top, 0.0], 0.008);
    const lid = m.part([0, top + 0.01, -0.12]);
    lid.rotation.x = -0.25;
    lid.box([0.38, 0.26, 0.015], C.metalLight, [0, 0, 0], 0.006);
    lid.plane(0.34, 0.22, glow("#fff", codeScreen(seed)), [0, 0.13, 0.009]);
  } else if (t === 1) {
    screen(m, -0.22, top, -0.14, 0.4, 0.26, seed, 0.15);
    screen(m, 0.22, top, -0.14, 0.4, 0.26, seed + 1, -0.15);
  } else if (t === 2) {
    screen(m, 0, top, -0.2, 0.3, 0.22, seed);
    screen(m, -0.3, top, -0.14, 0.28, 0.22, seed + 1, 0.5);
    screen(m, 0.3, top, -0.14, 0.28, 0.22, seed + 2, -0.5);
  } else if (t === 3) {
    // One long curved screen, edge to edge.
    const tex = codeScreen(seed);
    m.box([0.07, 0.05, 0.09], C.metal, [0, top, -0.2]);
    m.box([0.025, 0.15, 0.025], C.metal, [0, top, -0.22]);
    for (const [i, x] of [-0.28, 0, 0.28].entries()) {
      const seg = m.part([x, top + 0.14, -0.24 + Math.abs(x) * 0.25], -x * 0.55);
      seg.box([0.3, 0.26, 0.025], "#1b1f2a", [0, 0, 0]);
      const face = seg.plane(0.28, 0.24, glow("#fff", tex.clone()), [0, 0.13, 0.014]);
      const map = (face.material as THREE.MeshBasicMaterial).map!;
      map.repeat.set(1 / 3, 1);
      map.offset.set(i / 3, 0);
      map.needsUpdate = true;
    }
  } else {
    // The battlestation: three screens, a glowing tower with a rainbow, RGB under the keys.
    screen(m, 0, top, -0.2, 0.32, 0.24, seed);
    screen(m, -0.31, top, -0.14, 0.28, 0.22, seed + 1, 0.5);
    screen(m, 0.31, top, -0.14, 0.28, 0.22, seed + 2, -0.5);
    const tower = m.part([0.36, top, 0.0]);
    tower.box([0.14, 0.34, 0.3], "#1b1f2a", [0, 0, 0], 0.01);
    const rgb = tower.plane(0.26, 0.28, glow("#8fe3ff"), [0.075, 0.17, 0]);
    rgb.rotation.y = Math.PI / 2;
    const strip = m.box([0.34, 0.012, 0.012], glow("#ff7ab6"), [0, top + 0.012, 0.22]);
    ticks.push((time) => {
      const c = new THREE.Color().setHSL((time * 0.25) % 1, 0.9, 0.6);
      (strip.material as THREE.MeshBasicMaterial).color.copy(c);
      (rgb.material as THREE.MeshBasicMaterial).color.copy(c);
    });
    light(m, [0, top + 0.4, 0.2], "#b47cff", 0.6, 2);
  }
  return m;
}

// MARK: Pieces the base furniture doesn't have

const persianRug = (w: number, d: number) => (): Model => {
  const m = new Model();
  const tex = canvasTexture(w * 16, d * 16, (g) => {
    const W = w * 16;
    const H = d * 16;
    g.fillStyle = "#7a2e2a";
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#e0a15a";
    g.fillRect(2, 2, W - 4, H - 4);
    g.fillStyle = "#2f4a7a";
    g.fillRect(4, 4, W - 8, H - 8);
    g.fillStyle = "#c4544b";
    g.beginPath();
    g.moveTo(W / 2, 6);
    g.lineTo(W - 8, H / 2);
    g.lineTo(W / 2, H - 6);
    g.lineTo(8, H / 2);
    g.fill();
    g.fillStyle = "#e0a15a";
    g.beginPath();
    g.moveTo(W / 2, H / 2 - 5);
    g.lineTo(W / 2 + 6, H / 2);
    g.lineTo(W / 2, H / 2 + 5);
    g.lineTo(W / 2 - 6, H / 2);
    g.fill();
    g.fillStyle = "#fbf7ef";
    for (let x = 6; x < W - 4; x += 5) g.fillRect(x, 3, 2, 1);
  });
  m.box([w - 0.1, 0.025, d - 0.1], painted(tex), [0, 0, 0], 0.008);
  return m;
};

const globe = (): Model => {
  const m = new Model();
  m.cyl(0.14, 0.04, "#5e3d28", [0, 0, 0], 0.16, 14);
  m.cyl(0.02, 0.16, C.woodDark, [0, 0.04, 0], 0.02, 8);
  const tex = canvasTexture(32, 16, (g) => {
    g.fillStyle = "#3f89c9";
    g.fillRect(0, 0, 32, 16);
    g.fillStyle = "#58b36a";
    for (const [x, y, w, h] of [
      [3, 3, 7, 6],
      [12, 4, 6, 8],
      [20, 3, 8, 5],
      [22, 10, 4, 3],
    ] as const)
      g.fillRect(x, y, w, h);
    g.fillStyle = "#e25d5d";
    g.fillRect(14, 6, 2, 2);
  });
  const ball = m.ball(0.2, painted(tex), [0, 0.42, 0], [1, 1, 1], 16);
  ball.rotation.z = 0.4;
  ticks.push((t) => (ball.rotation.y = t * 0.4));
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.012, 6, 24, Math.PI * 1.3),
    new THREE.MeshToonMaterial({ color: "#d4a93a" }),
  );
  ring.position.set(0, 0.42, 0);
  ring.rotation.set(0, Math.PI / 2, 0.4);
  m.add(ring);
  return m;
};

const plantWall = (): Model => {
  const m = new Model();
  m.box([1.9, 1.5, 0.12], "#3d5a3a", [0, 0.4, -0.2], 0.03);
  const rnd = seeded(14);
  const greens = ["#3f8f3a", "#4fa544", "#5fb84f", "#2f7a32", "#6aa84a"];
  for (let i = 0; i < 70; i++)
    m.ball(
      0.09 + rnd() * 0.07,
      greens[i % greens.length]!,
      [(rnd() - 0.5) * 1.8, 0.5 + rnd() * 1.3, -0.1 + rnd() * 0.08],
      [1, 0.9, 0.7],
      8,
    );
  for (let i = 0; i < 6; i++)
    m.ball(0.04, "#ff7ab6", [(rnd() - 0.5) * 1.7, 0.7 + rnd() * 1.0, -0.04], [1, 1, 1], 6);
  m.box([1.9, 0.32, 0.4], "#eeeae2", [0, 0, -0.1], 0.03);
  return m;
};

const chandelier = (): Model => {
  const m = new Model();
  m.cyl(0.015, 0.7, C.metal, [0, 1.9, 0], 0.015, 6);
  m.cyl(0.06, 0.05, "#d4a93a", [0, 1.85, 0], 0.06, 10);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.4, 0.02, 6, 24),
    new THREE.MeshToonMaterial({ color: "#d4a93a" }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.85;
  m.add(ring);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    m.cyl(0.012, 0.12, "#fbf7ef", [Math.cos(a) * 0.4, 1.86, Math.sin(a) * 0.4], 0.012, 6);
    m.ball(0.035, glow("#ffe28a"), [Math.cos(a) * 0.4, 2.0, Math.sin(a) * 0.4]);
    m.ball(0.03, glow("#e4f5fd"), [Math.cos(a) * 0.4, 1.78 - (i % 2) * 0.06, Math.sin(a) * 0.4]);
  }
  light(m, [0, 1.6, 0], "#ffe6a8", 1.5, 6);
  return m;
};

// MARK: Posters

type Painter = (g: CanvasRenderingContext2D, w: number, h: number) => void;

const fill = (g: CanvasRenderingContext2D, c: string, x: number, y: number, w: number, h: number) => {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
};
const title = (
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  text: string,
  color = "#fbf7ef",
  back = "rgba(0,0,0,0.55)",
) => {
  fill(g, back, 0, h - 22, w, 22);
  g.fillStyle = color;
  g.font = "900 13px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, w / 2, h - 10, w - 6);
};

/** The parody game posters, drawn small: a scene and the invented title (`POSTERS`). */
const POSTER_ART: Record<string, Painter> = {
  "super-merge": (g, w, h) => {
    fill(g, "#5c94fc", 0, 0, w, h);
    fill(g, "#00a800", 0, h - 50, w, 28);
    fill(g, "#c84c0c", 0, h - 30, w, 8);
    fill(g, "#00a800", w * 0.6, h - 80, 14, 30);
    fill(g, "#fbf7ef", 8, 10, 22, 8);
    fill(g, "#e25d5d", 18, h - 74, 10, 24);
    fill(g, "#f5d14a", w - 16, 30, 3, h - 80);
    title(g, w, h, "SUPER MERGE BROS");
  },
  "dark-deploys": (g, w, h) => {
    fill(g, "#0e0e12", 0, 0, w, h);
    fill(g, "#3a3a44", w / 2 - 12, h - 70, 24, 36);
    fill(g, "#2a2a32", w / 2 - 15, h - 38, 30, 6);
    g.fillStyle = "#8c1c1c";
    g.font = "900 15px serif";
    g.textAlign = "center";
    g.fillText("YOU DIED", w / 2, 30);
    fill(g, "#8c1c1c", 12, 40, w - 24, 1);
    title(g, w, h, "DARK DEPLOYS", "#c9b48a");
  },
  "slay-backlog": (g, w, h) => {
    fill(g, "#3a1d2a", 0, 0, w, h);
    ["#e25d5d", "#4f8fe0", "#f5d14a"].forEach((c, i) => {
      g.save();
      g.translate(w / 2 + (i - 1) * 16, h / 2 - 8);
      g.rotate((i - 1) * 0.25);
      fill(g, "#fbf7ef", -9, -14, 18, 28);
      fill(g, c, -6, -10, 12, 12);
      g.restore();
    });
    title(g, w, h, "SLAY THE BACKLOG");
  },
  "last-dev": (g, w, h) => {
    fill(g, "#4fb4e8", 0, 0, w, h);
    fill(g, "#e4f5fd", 6, 14, 18, 6);
    fill(g, "#f2c23a", w / 2 - 10, h - 66, 20, 8);
    fill(g, "#58b36a", w / 2 - 22, h - 40, 44, 14);
    fill(g, "#c8734a", w / 2 - 3, h - 58, 6, 16);
    title(g, w, h, "LAST DEV STANDING");
  },
  "pipeline-valley": (g, w, h) => {
    fill(g, "#a8dcf7", 0, 0, w, h);
    fill(g, "#86c35e", 0, h * 0.45, w, h);
    for (let i = 0; i < 8; i++)
      fill(g, i % 2 ? "#6aa84a" : "#a5d977", 4 + i * (w / 8), h * 0.55, w / 8 - 3, 22);
    fill(g, "#fbf7ef", w - 40, h * 0.4, 18, 10);
    fill(g, "#2b2433", w - 36, h * 0.42, 5, 5);
    fill(g, "#c8734a", 10, h * 0.28, 22, 18);
    fill(g, "#e25d5d", 8, h * 0.24, 26, 6);
    title(g, w, h, "PIPELINE VALLEY");
  },
  "deploy-league": (g, w, h) => {
    fill(g, "#1f6f3a", 0, 0, w, h);
    fill(g, "rgba(255,255,255,0.4)", w / 2 - 1, 0, 2, h);
    fill(g, "#4f8fe0", 14, h - 56, 34, 14);
    fill(g, "#8fe3ff", 40, h - 52, 8, 6);
    g.fillStyle = "#fbf7ef";
    g.beginPath();
    g.arc(w - 36, h - 62, 12, 0, 7);
    g.fill();
    fill(g, "#ff9a3c", 4, h - 50, 10, 4);
    title(g, w, h, "DEPLOY LEAGUE");
  },
  "counter-ci": (g, w, h) => {
    fill(g, "#c2a56b", 0, 0, w, h);
    fill(g, "#a38c5f", 0, h - 60, w, 40);
    fill(g, "#2b2433", w / 2 - 14, h - 76, 28, 22);
    fill(g, "#e25d5d", w / 2 - 10, h - 72, 20, 4);
    fill(g, "#e25d5d", w / 2 - 2, h - 90, 4, 14);
    g.fillStyle = "#e25d5d";
    g.font = "900 12px monospace";
    g.textAlign = "center";
    g.fillText("00:00", w / 2, h - 60);
    title(g, w, h, "COUNTER-CI: GLOBAL FLAKE");
  },
  "league-linters": (g, w, h) => {
    fill(g, "#1b2a4a", 0, 0, w, h);
    fill(g, "#3d5a8a", 0, h / 2 - 3, w, 6);
    fill(g, "#4f8fe0", 14, h - 50, 14, 14);
    fill(g, "#e25d5d", w - 28, 14, 14, 14);
    g.strokeStyle = "#f2c23a";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(w / 2 - 14, 20);
    g.lineTo(w / 2 + 14, h - 40);
    g.moveTo(w / 2 + 14, 20);
    g.lineTo(w / 2 - 14, h - 40);
    g.stroke();
    title(g, w, h, "LEAGUE OF LINTERS");
  },
  "defense-deps": (g, w, h) => {
    fill(g, "#2f4a2a", 0, 0, w, h);
    for (const x of [w * 0.2, w * 0.5, w * 0.8]) fill(g, "#6b5a3a", x - 3, 0, 6, h);
    fill(g, "#8a8682", w / 2 - 12, h - 70, 24, 36);
    fill(g, "#5d6470", w / 2 - 14, h - 76, 28, 8);
    fill(g, "#e25d5d", w / 2 - 3, h - 60, 6, 10);
    title(g, w, h, "DEFENSE OF THE DEPENDENCIES");
  },
  lootborn: (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#1c1924");
    bg.addColorStop(1, "#5b3fbf");
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    fill(g, "#f2c23a", w / 2 - 14, h - 80, 28, 22);
    fill(g, "#cfd3da", w / 2 - 14, h - 62, 28, 10);
    fill(g, "#2b2433", w / 2 - 8, h - 70, 16, 4);
    fill(g, "#e25d5d", w / 2 - 2, h - 90, 4, 12);
    title(g, w, h, "LOOTBORN", "#f2c23a");
  },
};

/** A game poster to hang on the wall row: `w` tiles wide. Face looks along +z. */
export function posterModel(art: string, w: number, name: string): Panel {
  const paint = POSTER_ART[art];
  const pw = 0.9 * w - 0.1;
  return panel(
    pw,
    1.1,
    (g, cw, ch) => {
      if (paint) paint(g, cw, ch);
      else {
        fill(g, "#2b2433", 0, 0, cw, ch);
        title(g, cw, ch, name);
      }
    },
    // The scenes are laid out for a canvas about 110 high (the 2D prints' size): any less and their lower parts are cut off.
    { frame: "#3c2a1e", px: 100, smooth: true },
  );
}

// MARK: Assets

const wallAsset = (p: (typeof POSTERS)[number]): Asset => ({
  id: `poster:${p.art}`,
  name: `${p.name} poster`,
  price: 0,
  w: p.w,
  d: 1,
  build: () => posterModel(p.art, p.w, p.name),
});

/** What this slice adds to the catalog: the fleet desks, the posters and the pieces furniture.ts lacks. */
export const HQ_ASSETS: readonly Asset[] = [
  ...DESKS.map((d, i) => ({
    id: `hq:desk-${d.id}`,
    name: `${d.name} desk`,
    price: 0,
    w: 1,
    d: 1,
    build: () => fleetDesk(i, 3 + i),
  })),
  ...POSTERS.map(wallAsset),
  { id: "globe", name: "Desk globe", price: 90, w: 1, d: 1, build: globe },
  { id: "plant-wall", name: "Plant wall", price: 300, w: 2, d: 1, build: plantWall },
  { id: "chandelier", name: "Crystal chandelier", price: 900, w: 2, d: 1, build: chandelier },
  { id: "rug-persian", name: "Persian rug", price: 60, w: 3, d: 2, build: persianRug(3, 2) },
];

const own = new Map(HQ_ASSETS.map((a) => [a.id, a]));
/** The asset for a 2D art name: `furniture.ts`'s piece if it has one, else this slice's. */
function assetFor(art: string): Asset | undefined {
  return (
    assetById.get(art) ??
    own.get(art) ??
    (art === "bookshelf-library" ? assetById.get("bookshelf") : undefined)
  );
}

/**
 * The office directory (`ς` on the floor, `MAPS.hq`): a wooden board on two posts, a little door per office
 * on its face and "OFFICES" over them. Facing south, where you stand to read it.
 */
export function directoryBoard(): Model {
  const m = new Model();
  for (const x of [-0.42, 0.42]) m.box([0.07, 1.2, 0.07], C.woodDark, [x, 0, 0], 0.015);
  const face = panel(
    1.15,
    0.8,
    (g, w, h) => {
      const p = new Pen(g);
      p.rect(0, 0, w, h, "#c89460");
      p.rect(0, 0, w, 1, "#dcab76");
      const title = "OFFICES";
      p.text(title, Math.round((w - (title.length * 4 - 1)) / 2), 3, C.ink);
      for (let i = 0; i < 5; i++) {
        const x = 7 + i * 10;
        p.rect(x, 11, 5, 9, C.woodDark);
        p.rect(x + 1, 12, 3, 7, i % 2 ? "#f8c43a" : "#8a5a36");
        p.px(x + 3, 16, C.ink);
      }
    },
    { frame: "#4a3a26", lift: 0.5, px: 52 },
  );
  face.position.z = 0.05;
  m.add(face);
  return m;
}

// MARK: The room

export interface HqOptions {
  /** The wallet's desk tier (`CompanyInfo.deskFleet`), 0 the laptop. */
  fleet?: number;
  /** The company's dropped pieces and posters, by map character and tile (`Placed`, `rot`: turned); none: the plain floor. */
  placed?: { ch: string; x: number; y: number; rot?: Rot }[];
  /** Walls and floor; the company's own colours by default. */
  floor?: string;
  wall?: string;
  stripe?: string;
  /** An opening in the north wall (room tiles: x, width) where the passage to the hallways leaves the floor. */
  gap?: [number, number];
}

export interface Hq {
  room: Room;
  /** Room tile (x, z) and where to put the exit marker: the building's door, in the south wall. */
  exit: { x: number; z: number };
  /** Every desk's chair, in reading order, for sitters. */
  chairs: Placed[];
  beds: Placed[];
  /** The posters on the wall row. */
  posters: Placed[];
  /** Convert a map tile of the 2D `hq` to a room tile. */
  tile: (x: number, y: number) => [number, number];
}

const flatBig: Asset = { id: "rug", name: "Rug", price: 15, w: 6, d: 3, build: persianRug(6, 3) };

/** The 2D `hq` floor as a `Room`. Room tile (x, z) is map tile (x + 1, y + 2): the walls are the room's own. */
export function buildHq(opts: HqOptions = {}): Hq {
  const rows = HQ_ROWS;
  const W = rows[0]!.length - 2;
  const D = rows.length - 3;
  const room = new Room(W, D, {
    floor: opts.floor ?? "#c9a574",
    wall: opts.wall ?? "#efe4cf",
    stripe: opts.stripe ?? "#e1d3b6",
    north: [],
    door: null,
    west: [3.5, 7.5],
    gap: opts.gap,
  });
  const tile = (x: number, y: number): [number, number] => [x - 1, y - 2];
  const chairs: Placed[] = [];
  const beds: Placed[] = [];
  const posters: Placed[] = [];
  const get = (id: string) => assetById.get(id);
  const put = (
    id: string,
    x: number,
    y: number,
    turn: Turn = 0,
    asset: Asset | undefined = get(id),
  ): Placed | null => {
    if (!asset) return null;
    const [rx, rz] = tile(x, y);
    if (!room.fits(asset, rx, rz, turn)) return null;
    return room.place(asset, rx, rz, turn);
  };

  // The base floor plan.
  const fleet = Math.max(0, Math.min(opts.fleet ?? 0, DESKS.length - 1));
  const deskAsset: Asset = {
    id: "desk",
    name: `${DESKS[fleet]!.name} desk`,
    price: 0,
    w: 1,
    d: 1,
    build: () => fleetDesk(fleet),
  };
  let seed = 3;
  const seen = new Set<string>();
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]!;
      const key = `${x},${y}`;
      if (seen.has(key)) continue;
      switch (ch) {
        case "k":
          put("shelf", x, y);
          break;
        case "b":
          // A bed is two tiles deep: the map writes `b` on both.
          beds.push(put("bed", x, y)!);
          seen.add(`${x},${y + 1}`);
          break;
        case "p":
          put("plant", x, y);
          break;
        case "o":
          put("coffee", x, y);
          break;
        case "d": {
          const [rx, rz] = tile(x, y);
          const m = fleetDesk(fleet, seed++);
          if (room.fits(deskAsset, rx, rz, 0)) room.place(deskAsset, rx, rz, 0, m);
          break;
        }
        case "c": {
          const c = put("chair", x, y, 2);
          if (c) chairs.push(c);
          break;
        }
        case "t":
          put("tv", x, y);
          seen.add(`${x + 1},${y}`);
          break;
        case "s":
          put("sofa", x, y, 2);
          seen.add(`${x + 1},${y}`);
          break;
        default:
      }
    }
  });
  // The rug under the tv and sofas, drawn as one.
  {
    const [rx, rz] = tile(3, 9);
    room.place(flatBig, rx, rz, 0);
  }

  // The company's own pieces and posters.
  for (const p of opts.placed ?? []) {
    const poster = POSTERS.find((q) => q.ch === p.ch);
    if (poster) {
      const a = assetFor(`poster:${poster.art}`) ?? wallAsset(poster);
      const model = a.build();
      room.hang(model, p.x - 1 + poster.w / 2, 0.95);
      posters.push({ asset: a, x: p.x - 1, z: 0, turn: 0, model });
      continue;
    }
    const piece = COMPANY_FURNITURE.find((q) => q.ch === p.ch);
    if (!piece) continue;
    if (piece.art === "chandelier") {
      const m = assetFor("chandelier")!.build();
      const [rx, rz] = tile(p.x, p.y);
      m.position.set(rx + piece.w / 2, 0, rz + 0.5);
      m.rotation.y = -((p.rot ?? 0) * Math.PI) / 2;
      room.group.add(m);
      continue;
    }
    const a = assetFor(piece.art);
    if (!a) continue;
    const [rx, rz] = tile(p.x, p.y);
    // Turned (F): a quarter turn lies it down its column, half or three quarters round it stays along its row.
    const rot = p.rot ?? 0;
    const tiles = piece.w ?? 1;
    const [fw, fd] = rot % 2 ? [1, tiles] : Room.footprint(a, 0);
    if (!room.fits({ ...a, w: fw, d: fd }, rx, rz, 0)) continue;
    room.placeTurned(a, rx, rz, 0, rot, tiles);
  }

  // The exit: the front door in the south wall's door tile, opening on daylight, with its lamp and mat.
  const [ex, ez] = tile(11, 13);
  const front = exitDoorway({ outside: true, wall: opts.wall ?? "#efe4cf" });
  front.position.set(ex + 0.5, 0, ez + 0.5);
  front.rotation.y = Math.PI;
  room.group.add(front);
  void tint;
  return { room, exit: { x: ex, z: ez }, chairs, beds, posters, tile };
}
