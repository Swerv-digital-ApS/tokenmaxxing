/**
 * The town's own props, one per tile character of the 2D map that isn't already in `props.ts`: the
 * leaderboard (N), the star counter (★), the chalkboard (K), the open-offices board (w), the coffee stand (o), the raid
 * dungeon's gate (G), plus the street life of `core/src/street.ts` (pølsevogn, build snail and goal flag,
 * paperboy on his bike, the morning paper).
 */
import * as THREE from "three";
import { C } from "../../art/palette.ts";
import { assetById, light } from "../furniture/furniture.ts";
import { canvasTexture, glass, glow, Model, painted, ticks, tint, toon } from "../kit/kit.ts";
import { type Panel, panel } from "../kit/panel.ts";
import { nightGlow } from "./props.ts";

export interface BoardRow {
  name: string;
  value: string;
}

const RANK = ["#f2c23a", "#cfd3da", "#c8734a", "#8fe3ff", "#8fe3ff"];
const SAMPLE_ROWS: BoardRow[] = [
  { name: "Nightshift Labs", value: "412M" },
  { name: "Pixel Forge", value: "188M" },
  { name: "Rubber Duck", value: "97M" },
  { name: "Solo", value: "41M" },
  { name: "Cellar Dwellers", value: "12M" },
];

// MARK: Boards

export interface Board extends Model {
  /** Repaint the board's rows (top five). */
  show: (rows: readonly BoardRow[]) => void;
  face: Panel;
}

/** The leaderboard on the square (tile N): a framed board on two posts under a little roof, a bolt on top. */
export function leaderboard(): Board {
  const m = new Model() as Board;
  const paint = (rows: readonly BoardRow[]) => (g: CanvasRenderingContext2D, w: number, h: number) => {
    g.fillStyle = "#1f2433";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#2f3650";
    g.fillRect(0, 0, w, 36);
    g.fillStyle = "#f2c23a";
    g.font = "900 24px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("LEADERBOARD", w / 2, 19);
    if (!rows.length) {
      g.fillStyle = "#8a93ad";
      g.font = "700 15px system-ui, sans-serif";
      g.fillText("Nobody yet today", w / 2, h / 2 + 14);
    }
    rows.slice(0, 5).forEach((r, i) => {
      const y = 44 + i * 27;
      g.fillStyle = i % 2 ? "#262c40" : "#2b3249";
      g.fillRect(6, y, w - 12, 24);
      g.fillStyle = RANK[i]!;
      g.font = "900 18px system-ui, sans-serif";
      g.textAlign = "left";
      g.fillText(`${i + 1}`, 14, y + 13);
      g.font = "700 16px system-ui, sans-serif";
      // The name gives way to the number: shortened until it ends a gap short of it.
      const room = w - 14 - g.measureText(r.value).width - 8 - 36;
      let name = r.name;
      while (name.length > 1 && g.measureText(name).width > room) name = name.slice(0, -1);
      g.fillStyle = "#e4f5fd";
      g.fillText(name === r.name ? name : `${name.slice(0, -1)}…`, 36, y + 13);
      g.fillStyle = "#8fe3ff";
      g.textAlign = "right";
      g.fillText(r.value, w - 14, y + 13);
    });
  };
  for (const x of [-0.6, 0.6]) m.box([0.09, 1.55, 0.09], C.woodDark, [x, 0, -0.04], 0.02);
  const face = panel(1.3, 1.1, paint(SAMPLE_ROWS), {
    frame: "#5b3a24",
    lift: 0.35,
    px: 130,
    smooth: true,
    lit: true,
  });
  face.position.z = 0.02;
  // Repainted with today's board (`show`), so batching leaves it be.
  face.userData.live = true;
  m.add(face);
  const roof = m.box([1.65, 0.1, 0.5], C.roofRed, [0, 1.62, 0.02], 0.03);
  roof.rotation.x = 0.12;
  m.box([1.45, 0.06, 0.3], tint(C.roofRed, -0.2), [0, 1.57, -0.02], 0.02);
  // A bolt on top, in gold, turning.
  const bolt = m.part([0, 1.78, 0]);
  const s = new THREE.Shape();
  for (const [x, y] of [
    [0.05, 0.4],
    [-0.1, 0.15],
    [0, 0.15],
    [-0.05, 0],
    [0.1, 0.25],
    [0.0, 0.25],
    [0.07, 0.4],
  ] as const)
    s.lineTo(x, y);
  const mesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false }),
    toon("#f2c23a"),
  );
  mesh.position.z = -0.025;
  bolt.add(mesh);
  ticks.push((t) => (bolt.rotation.y = t * 0.7));
  m.face = face;
  m.show = (rows) => face.redraw(paint(rows));
  return m;
}

export interface StarCounter extends Model {
  /** Repaint the count, and the milestone it is heading for. */
  show: (count: string, next: string) => void;
  face: Panel;
}

/** A five-pointed star's outline, `r` from its middle to a point. */
export function starShape(r: number): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 ? r * 0.45 : r;
    if (i === 0) s.moveTo(Math.cos(a) * d, Math.sin(a) * d);
    else s.lineTo(Math.cos(a) * d, Math.sin(a) * d);
  }
  return s;
}

/** The star counter on the square (tile ★): the repo's GitHub stars on a navy board, a gold star turning on top. */
export function starCounter(): StarCounter {
  const m = new Model() as StarCounter;
  const paint = (count: string, next: string) => (g: CanvasRenderingContext2D, w: number, h: number) => {
    g.fillStyle = "#1f2433";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#2f3650";
    g.fillRect(0, 0, w, 30);
    g.fillStyle = "#f2c23a";
    g.font = "900 19px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("GITHUB STARS", w / 2, 16);
    g.font = "900 40px system-ui, sans-serif";
    g.fillStyle = "#ffd23f";
    g.fillText(`★ ${count}`, w / 2, h / 2 + 8);
    g.font = "700 13px system-ui, sans-serif";
    g.fillStyle = "#8a93ad";
    g.fillText(next, w / 2, h - 13);
  };
  for (const x of [-0.42, 0.42]) m.box([0.09, 1.4, 0.09], C.woodDark, [x, 0, -0.04], 0.02);
  const face = panel(1.05, 0.85, paint("–", "Press E to star it"), {
    frame: "#2f3650",
    lift: 0.45,
    px: 130,
    smooth: true,
    lit: true,
  });
  face.position.z = 0.02;
  // Repainted with the count (`show`), so batching leaves it be.
  face.userData.live = true;
  m.add(face);
  const star = m.part([0, 1.62, 0]);
  const mesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(starShape(0.2), { depth: 0.06, bevelEnabled: false }),
    toon("#f2c23a"),
  );
  mesh.position.set(0, 0.2, -0.03);
  star.add(mesh);
  ticks.push((t) => (star.rotation.y = t * 0.9));
  m.face = face;
  m.show = (count, next) => face.redraw(paint(count, next));
  return m;
}

/** The open-offices board (`w`): offices open for visitors, a door icon per office. */
export function openOfficesBoard(): Board {
  const m = new Model() as Board;
  const paint = (rows: readonly BoardRow[]) => (g: CanvasRenderingContext2D, w: number, h: number) => {
    g.fillStyle = "#2a3a34";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#3d5a4a";
    g.fillRect(0, 0, w, 34);
    g.fillStyle = "#a5d977";
    g.font = "900 22px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("OPEN OFFICES", w / 2, 18);
    rows.slice(0, 4).forEach((r, i) => {
      const y = 42 + i * 30;
      g.fillStyle = "#3d5a4a";
      g.fillRect(8, y, 16, 22);
      g.fillStyle = "#a5d977";
      g.fillRect(10, y + 2, 12, 18);
      g.fillStyle = "#2a3a34";
      g.fillRect(18, y + 11, 2, 2);
      g.fillStyle = "#e4f5fd";
      g.font = "700 16px system-ui, sans-serif";
      g.textAlign = "left";
      g.fillText(r.name, 34, y + 12);
      g.fillStyle = "#a5d977";
      g.textAlign = "right";
      g.fillText(r.value, w - 12, y + 12);
    });
  };
  for (const x of [-0.5, 0.5]) m.box([0.08, 1.4, 0.08], C.woodDark, [x, 0, -0.04], 0.02);
  const face = panel(
    1.2,
    1.0,
    paint([
      { name: "Ada", value: "knock" },
      { name: "Linus", value: "knock" },
      { name: "Grace", value: "knock" },
    ]),
    { frame: "#4a3a26", lift: 0.35, px: 130, smooth: true },
  );
  face.position.z = 0.02;
  m.add(face);
  m.face = face;
  m.show = (rows) => face.redraw(paint(rows));
  return m;
}

export interface Chalkboard extends Model {
  /** Writes today's special on the board. */
  write: (lines: readonly string[]) => void;
}

/** The sandwich board outside the Tavern (tile K): today's special in chalk. */
export function chalkboard(): Chalkboard {
  const m = new Model() as Chalkboard;
  const paint = (lines: readonly string[]) => (g: CanvasRenderingContext2D, w: number, h: number) => {
    g.fillStyle = "#26302c";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(255,255,255,0.05)";
    for (let i = 0; i < 40; i++) g.fillRect((i * 37) % w, (i * 53) % h, 18, 2);
    g.fillStyle = "#f4efe4";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "900 22px system-ui, sans-serif";
    g.fillText("TODAY'S SPECIAL", w / 2, 22);
    g.fillRect(14, 38, w - 28, 2);
    g.font = "700 18px system-ui, sans-serif";
    g.fillStyle = "#ffe28a";
    lines.slice(0, 4).forEach((l, i) => {
      g.fillText(l, w / 2, 62 + i * 24);
    });
    g.fillStyle = "#f4efe4";
    g.fillRect(14, h - 20, w - 28, 2);
  };
  const lines = ["Stack Overflow Stew", "2 tokens"];
  const lean = 0.28;
  for (const s of [-1, 1]) {
    const side = m.part([0, 0, s * 0.3]);
    side.rotation.x = -s * lean;
    side.box([0.9, 1.1, 0.06], C.wood, [0, 0, 0], 0.02);
    if (s > 0) {
      const p = panel(0.76, 0.86, paint(lines), { frame: C.woodDark, lift: 0.1, px: 128, smooth: true });
      side.add(p);
      m.write = (l) => p.redraw(paint(l));
    }
  }
  m.cyl(0.015, 0.1, "#f4efe4", [0.3, 0.01, 0.33], 0.015, 6).rotation.z = Math.PI / 2;
  return m;
}

// MARK: The coffee stand and the gate

/** The coffee stand (tile o): a little striped kiosk with the machine on the counter. */
export function coffeeStand(): Model {
  const m = new Model();
  m.box([1.0, 0.75, 0.6], C.wood, [0, 0, 0], 0.03);
  m.box([1.1, 0.06, 0.7], C.woodLight, [0, 0.75, 0], 0.02);
  const machine = assetById.get("coffee")?.build();
  if (machine) {
    machine.scale.setScalar(0.8);
    machine.position.set(0.0, 0.78, -0.02);
    m.add(machine);
  }
  for (const x of [-0.45, 0.45]) m.cyl(0.025, 1.55, C.metal, [x, 0, -0.25], 0.025, 8);
  for (let i = 0; i < 6; i++) {
    const stripe = m.box(
      [0.2, 0.04, 0.75],
      i % 2 ? "#fbf7ef" : "#8c5c36",
      [-0.5 + 0.1 + i * 0.2, 1.6, 0.0],
      0.01,
    );
    stripe.rotation.x = -0.2;
  }
  const sign = canvasTexture(
    128,
    32,
    (g) => {
      g.fillStyle = "#3a2a1c";
      g.fillRect(0, 0, 128, 32);
      g.fillStyle = "#ffe28a";
      g.font = "900 20px system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("☕ COFFEE", 64, 17);
    },
    true,
  );
  m.plane(0.7, 0.18, glow("#fff", sign), [0, 0.45, 0.305]);
  m.cyl(0.05, 0.08, C.white, [-0.35, 0.81, 0.1], 0.04, 10);
  m.cyl(0.05, 0.08, C.white, [-0.25, 0.81, 0.18], 0.04, 10);
  return m;
}

/** The raid dungeon's gate (tile G): a dark stone arch with a swirling purple portal and torches. */
export function dungeonGate(): Model {
  const m = new Model();
  const stone = "#4a4459";
  m.box([1.7, 0.12, 0.7], "#2a2633", [0, 0, 0], 0.02);
  for (const x of [-0.65, 0.65]) {
    m.box([0.3, 1.9, 0.4], stone, [x, 0.12, 0], 0.03);
    m.box([0.38, 0.12, 0.48], "#3a3446", [x, 0.12, 0], 0.02);
    m.box([0.38, 0.12, 0.48], "#3a3446", [x, 2.02, 0], 0.02);
    for (const sx of [-1, 1]) m.cyl(0.05, 0.22, "#6b6480", [x + sx * 0.1, 2.14, 0.0], 0.01, 4);
  }
  m.box([1.6, 0.34, 0.44], stone, [0, 1.76, 0], 0.03);
  const swirl = canvasTexture(
    64,
    96,
    (g) => {
      const grad = g.createRadialGradient(32, 48, 4, 32, 48, 52);
      grad.addColorStop(0, "#f1d9ff");
      grad.addColorStop(0.35, "#b98cff");
      grad.addColorStop(1, "#3a1d6a");
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 96);
      g.strokeStyle = "rgba(255,255,255,0.45)";
      g.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.arc(32, 48, 10 + i * 11, i, i + 3.2);
        g.stroke();
      }
    },
    true,
  );
  const portal = m.plane(1.0, 1.65, glow("#fff", swirl), [0, 0.12 + 0.82, 0]);
  const back = m.plane(1.0, 1.65, glow("#fff", swirl), [0, 0.12 + 0.82, -0.01]);
  back.rotation.y = Math.PI;
  ticks.push((t) => {
    swirl.rotation = 0;
    swirl.center.set(0.5, 0.5);
    swirl.rotation = Math.sin(t * 0.8) * 0.25;
    portal.scale.x = 1 + Math.sin(t * 2) * 0.03;
  });
  const plate = canvasTexture(
    160,
    36,
    (g) => {
      g.fillStyle = "#1c1924";
      g.fillRect(0, 0, 160, 36);
      g.fillStyle = "#b98cff";
      g.font = "900 22px system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("RAID", 80, 19);
    },
    true,
  );
  m.plane(0.8, 0.18, glow("#fff", plate), [0, 1.76 + 0.17, 0.225]);
  // Torches either side.
  for (const x of [-1.05, 1.05]) {
    m.cyl(0.04, 0.9, C.woodDark, [x, 0, 0.1], 0.03, 8);
    const flame = m.ball(0.12, glow("#ff9a3c"), [x, 1.0, 0.1], [0.8, 1.4, 0.8], 8);
    ticks.push((t) => flame.scale.set(0.8, 1.3 + Math.sin(t * 9 + x) * 0.2, 0.8));
  }
  light(m, [0, 1.2, 0.8], "#b98cff", 3, 5);
  return m;
}

// MARK: Street life

/** The pølsevogn: a red and white cart with its brolly up while it is open (11 to 14) and furled otherwise. */
export interface Cart extends Model {
  setOpen: (open: boolean) => void;
}
export function polseCart(): Cart {
  const m = new Model() as Cart;
  m.box([1.4, 0.7, 0.7], "#fbf7ef", [0, 0.2, 0], 0.06);
  m.box([1.42, 0.12, 0.72], "#d8343c", [0, 0.2, 0], 0.03);
  m.box([1.42, 0.12, 0.72], "#d8343c", [0, 0.72, 0], 0.03);
  m.box([1.5, 0.06, 0.8], C.stoneLight, [0, 0.9, 0], 0.02);
  for (const x of [-0.45, 0.45]) {
    const wheel = m.cyl(0.22, 0.06, "#2b2433", [x, 0.22, 0.38], 0.22, 16);
    wheel.rotation.x = Math.PI / 2;
  }
  const bun = m.part([0, 0.5, 0.36]);
  bun.box([0.6, 0.1, 0.05], "#e8b06a", [0, 0, 0], 0.02);
  bun.box([0.64, 0.05, 0.05], "#d8343c", [0, 0.1, 0], 0.02);
  const sign = canvasTexture(
    128,
    40,
    (g) => {
      g.fillStyle = "#fbf7ef";
      g.beginPath();
      g.roundRect(2, 2, 124, 36, 10);
      g.fill();
      g.fillStyle = "#d8343c";
      g.font = "900 24px system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("PØLSER", 64, 22);
    },
    true,
  );
  m.plane(0.7, 0.2, glow("#fff", sign), [0, 0.6, 0.385]).position.y = 0.45;
  m.cyl(0.03, 1.45, "#cfd3da", [0.55, 0.9, -0.2], 0.03, 8);
  const open = m.part([0.55, 2.2, -0.2]);
  open.cyl(0.85, 0.32, "#d8343c", [0, -0.16, 0], 0.02, 8);
  open.cyl(0.86, 0.3, "#fbf7ef", [0, -0.17, 0], 0.02, 8).rotation.y = Math.PI / 8;
  const furled = m.part([0.55, 1.6, -0.2]);
  furled.cyl(0.1, 0.7, "#d8343c", [0, 0, 0], 0.03, 8);
  furled.cyl(0.1, 0.12, "#fbf7ef", [0, 0.2, 0], 0.1, 8);
  // The shutter, down when closed.
  const shutter = m.box([1.3, 0.22, 0.04], C.stoneLight, [0, 0.92, 0.3], 0.01);
  m.setOpen = (on) => {
    open.visible = on;
    furled.visible = !on;
    shutter.visible = !on;
  };
  m.setOpen(true);
  return m;
}

/** The build snail on its run, a sign on a stick over its shell: `inch` stretches it. */
export interface Snail extends Model {
  /** 0 to 1 along the run. */
  inch: (t: number) => void;
}
export function buildSnail(): Snail {
  const m = new Model() as Snail;
  const body = m.part([0, 0, 0], Math.PI / 2);
  const foot = body.ball(0.2, "#b9c7a3", [0, 0.12, 0], [2.1, 0.55, 1], 10);
  const shell = body.ball(0.2, "#d98b45", [-0.08, 0.34, 0], [1, 1, 0.85], 12);
  body.ball(0.11, "#f3c27a", [-0.08, 0.37, 0.12], [1, 1, 0.3], 8);
  for (const z of [-0.05, 0.05]) {
    body.cyl(0.01, 0.2, "#b9c7a3", [0.34, 0.2, z], 0.01, 5).rotation.z = -0.3;
    body.ball(0.025, C.ink, [0.4, 0.4, z]);
  }
  m.box([0.02, 0.7, 0.02], C.woodDark, [0, 0.2, 0]);
  const sign = canvasTexture(
    96,
    40,
    (g) => {
      g.fillStyle = "#fbf7ef";
      g.fillRect(0, 0, 96, 40);
      g.fillStyle = "#2b2433";
      g.font = "900 18px system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("BUILD", 48, 13);
      g.fillStyle = "#58b36a";
      g.fillRect(8, 26, 80, 8);
    },
    true,
  );
  const board = m.part([0, 0.9, 0]);
  board.box([0.5, 0.24, 0.03], "#2b2433", [0, 0, 0], 0.01);
  board.plane(0.46, 0.2, glow("#fff", sign), [0, 0.12, 0.02]);
  m.inch = (t) => {
    const s = 1 + Math.abs(Math.sin(t * 2.2)) * 0.18;
    foot.scale.x = 2.1 * s;
    shell.position.y = 0.34 + Math.sin(t * 4.4) * 0.01;
  };
  return m;
}

/** The goal flag at the end of the snail's run: chequered, on a pole. */
export function goalFlag(): Model {
  const m = new Model();
  m.cyl(0.03, 1.5, C.metal, [0, 0, 0], 0.03, 8);
  m.ball(0.06, C.metalLight, [0, 1.5, 0]);
  const tex = canvasTexture(32, 24, (g) => {
    for (let y = 0; y < 3; y++)
      for (let x = 0; x < 4; x++) {
        g.fillStyle = (x + y) % 2 ? C.ink : C.white;
        g.fillRect(x * 8, y * 8, 8, 8);
      }
  });
  const flag = m.plane(0.6, 0.45, painted(tex), [0.32, 1.25, 0]);
  (flag.material as THREE.MeshToonMaterial).side = THREE.DoubleSide;
  ticks.push((t) => (flag.rotation.y = Math.sin(t * 3) * 0.2));
  return m;
}

/** The paperboy on his bike, facing +x, a sack of papers on the rack; `pedal` turns the cranks. */
export interface Bike extends Model {
  pedal: (t: number) => void;
}
export function paperBike(): Bike {
  const m = new Bike0();
  return m;
}
class Bike0 extends Model implements Bike {
  private readonly wheels: THREE.Mesh[] = [];
  private readonly crank: Model;
  constructor() {
    super();
    const tyre = toon("#2b2433");
    for (const x of [-0.4, 0.4]) {
      const w = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 16), tyre);
      w.position.set(x, 0.25, 0);
      w.castShadow = true;
      this.add(w);
      this.wheels.push(w);
    }
    this.box([0.8, 0.04, 0.04], "#d8343c", [0, 0.38, 0]);
    this.box([0.04, 0.4, 0.04], "#d8343c", [-0.1, 0.25, 0]);
    this.box([0.04, 0.45, 0.04], "#d8343c", [0.33, 0.25, 0]);
    this.box([0.16, 0.04, 0.1], C.ink, [-0.12, 0.65, 0]);
    this.box([0.04, 0.04, 0.3], C.ink, [0.36, 0.7, 0]);
    this.crank = this.part([0, 0.22, 0]);
    [-1, 1].map((s) => this.crank.box([0.05, 0.3, 0.05], "#3d4a6b", [0, -0.15, s * 0.08]));
    // The rider: yellow jacket, beanie.
    this.box([0.22, 0.4, 0.3], "#f0b53c", [-0.05, 0.62, 0], 0.06).rotation.z = -0.25;
    this.ball(0.11, "#f6d3b3", [0.08, 1.12, 0]);
    this.ball(0.12, "#2f6b66", [0.08, 1.18, 0], [1, 0.7, 1]);
    // The sack on the rack.
    this.box([0.3, 0.28, 0.22], "#c9b48a", [-0.42, 0.5, 0], 0.06);
    this.box([0.1, 0.1, 0.08], C.white, [-0.42, 0.78, 0.02]).rotation.z = 0.3;
  }
  pedal(t: number): void {
    for (const w of this.wheels) w.rotation.z = -t * 9;
    this.crank.rotation.z = -t * 9;
  }
}

/** A rolled paper on the grass, held with a red rubber band. */
export function paperRoll(): Model {
  const m = new Model();
  m.cyl(0.07, 0.34, "#fbf7ef", [0, 0.06, 0], 0.07, 10).rotation.z = Math.PI / 2;
  m.cyl(0.075, 0.05, "#e8584f", [0, 0.06, 0], 0.075, 10).rotation.z = Math.PI / 2;
  return m;
}

void glass;
void nightGlow;
