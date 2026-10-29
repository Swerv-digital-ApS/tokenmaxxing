/**
 * The net cafe's roulette table as a 3D prop (2D: `♦` is the 3x2 table, `♥` the eight spots, four above it and four below where
 * the players stand): green felt in a wooden rim, the wheel on the left half (a bowl, a ring of 37 pockets in
 * `WHEEL` order coloured by `colorOf`, a gold cone and a little white ball, turning slowly) and the betting
 * layout on the right half, painted on a small canvas (0 on the left, the numbers in three rows).
 */
import { type Bet, colorOf, type RouletteState, SPIN_MS, WHEEL } from "@tokenmaxxing/core/roulette.ts";
import * as THREE from "three";
import { C } from "../../art/palette.ts";
import { canvasTexture, liveModel, Model, painted, tint } from "../kit/kit.ts";

const FELT = "#1f6b3f";
const POCKET = { red: "#c8352f", black: "#1d1a22", green: "#2f9a4f" } as const;
const FONT = "bold 9px ui-monospace, Menlo, Consolas, monospace";
/** The felt's top, and the wheel's centre on the left half. */
const TOP = 0.78;
const WHEEL_AT: [number, number] = [-0.75, 0];

/** The betting layout: 0, then three rows of numbers (3 on top) and the dozens under them. */
function layoutTexture() {
  const W = 262;
  const H = 98;
  return canvasTexture(W, H, (g) => {
    g.fillStyle = FELT;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = "#f2efe0";
    g.lineWidth = 1.5;
    g.font = FONT;
    g.textAlign = "center";
    g.textBaseline = "middle";
    const x0 = 6;
    const cw = 20;
    const ch = 20;
    const y0 = 6;
    const cell = (x: number, y: number, w: number, h: number, fill: string | null, text: string) => {
      if (fill) {
        g.fillStyle = fill;
        g.fillRect(x, y, w, h);
      }
      g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      g.fillStyle = "#f6f2e4";
      g.fillText(text, x + w / 2, y + h / 2 + 1);
    };
    cell(x0, y0, cw, ch * 3, POCKET.green, "0");
    for (let n = 1; n <= 36; n++) {
      const col = Math.floor((n - 1) / 3);
      const row = 2 - ((n - 1) % 3);
      cell(x0 + cw * (1 + col), y0 + ch * row, cw, ch, POCKET[colorOf(n)], String(n));
    }
    const dy = y0 + ch * 3;
    for (let i = 0; i < 3; i++)
      cell(x0 + cw * (1 + i * 4), dy, cw * 4, ch, null, `${i * 12 + 1}-${i * 12 + 12}`);
    const ey = dy + ch;
    const tags = ["1-18", "EVEN", "RED", "BLACK", "ODD", "19-36"];
    for (let i = 0; i < 6; i++)
      cell(
        x0 + cw * (1 + i * 2),
        ey,
        cw * 2,
        ch - 6,
        i === 2 ? POCKET.red : i === 3 ? POCKET.black : null,
        tags[i]!,
      );
  });
}

export interface RouletteModel extends Model {
  /** Where each spot's mat is, in the table's space (x, z): the chips and the glow go there. */
  setSpots(spots: readonly (readonly [number, number])[]): void;
  /** Drives the wheel, ball, result disc, history board, chips and glow from the server's state. */
  show(state: (RouletteState & { at: number }) | null, nowMs: number, dtSec: number): void;
}

/** One colour per seat: the same as the HUD's. */
const SEAT_COLORS = [
  "#3b82f6",
  "#a855f7",
  "#22c55e",
  "#f97316",
  "#facc15",
  "#ec4899",
  "#14b8a6",
  "#ef4444",
] as const;
const SHEET_W = 1.3;
const SHEET_AT = 0.75;

/** Where a bet sits on the felt, in the table's space (x, z): the centre of its cell in the painted layout. */
function betSpot(on: string): [number, number] | null {
  const x0 = 6;
  const y0 = 6;
  const cw = 20;
  const ch = 20;
  const dy = y0 + ch * 3;
  const ey = dy + ch;
  let px: number;
  let py: number;
  if (on.startsWith("n:")) {
    const n = Number(on.slice(2));
    if (n === 0) {
      px = x0 + cw / 2;
      py = y0 + (ch * 3) / 2;
    } else {
      px = x0 + cw * (1 + Math.floor((n - 1) / 3)) + cw / 2;
      py = y0 + ch * (2 - ((n - 1) % 3)) + ch / 2;
    }
  } else if (on === "d1" || on === "d2" || on === "d3") {
    px = x0 + cw * (1 + (Number(on[1]) - 1) * 4) + cw * 2;
    py = dy + ch / 2;
  } else if (on === "c1" || on === "c2" || on === "c3") {
    // The columns end the rows at the right; there is no cell drawn, so they sit on the last number of each row.
    px = x0 + cw * 12 + cw / 2;
    py = y0 + ch * (3 - Number(on[1])) + ch / 2;
  } else {
    const i = ["low", "even", "red", "black", "odd", "high"].indexOf(on);
    if (i < 0) return null;
    px = x0 + cw * (1 + i * 2) + cw;
    py = ey + (ch - 6) / 2;
  }
  return [SHEET_AT + ((px - 131) / 262) * SHEET_W, ((py - 49) / 98) * SHEET_W * (98 / 262)];
}

const MAX_CHIPS = 4 * 12 * 5;
const TAU = Math.PI * 2;
const DISC = { red: "#c8352f", black: "#1d1a22", green: "#2f9a4f" } as const;

function overlayMaterial(map: THREE.Texture): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false });
}

/** The roulette table, 3 tiles by 2, its bottom centre at the origin. */
export function rouletteTable3d(): RouletteModel {
  const m = new Model() as RouletteModel;
  // Base and legs, the rim, the felt.
  m.box([2.8, 0.1, 1.8], C.woodDark, [0, 0.12, 0], 0.02);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) m.cyl(0.07, 0.62, C.woodDark, [sx * 1.25, 0, sz * 0.75], 0.06, 8);
  m.box([2.9, 0.12, 1.9], C.woodDark, [0, 0.62, 0], 0.02);
  m.box([2.94, 0.06, 1.94], C.woodLight, [0, 0.72, 0], 0.02);
  m.box([2.7, 0.025, 1.7], "#5e2a2a", [0, 0.775, 0], 0.01);
  m.box([2.62, 0.02, 1.62], FELT, [0, 0.79, 0], 0.005);
  const felt = TOP + 0.03;

  // The layout, flat on the right half.
  const tex = layoutTexture();
  const sheet = m.plane(1.3, 1.3 * (98 / 262), painted(tex), [0.75, felt + 0.002, 0]);
  sheet.rotation.x = -Math.PI / 2;
  sheet.castShadow = false;

  // The wheel: a still bowl and rim, and the turning part (pockets, cone, ball).
  const [wx, wz] = WHEEL_AT;
  m.cyl(0.52, 0.07, C.woodDark, [wx, felt, wz], 0.5, 28);
  m.cyl(0.46, 0.1, C.woodLight, [wx, felt + 0.05, wz], 0.4, 28);
  m.cyl(0.42, 0.03, "#7a4a2a", [wx, felt + 0.13, wz], 0.34, 28);
  const spin = liveModel();
  spin.position.set(wx, felt + 0.15, wz);
  const n = WHEEL.length;
  const R = 0.3;
  const rim = (2 * Math.PI * R) / n;
  WHEEL.forEach((pocket, i) => {
    const a = (i / n) * Math.PI * 2;
    const b = spin.box(
      [0.05, 0.022, rim * 0.92],
      POCKET[colorOf(pocket)],
      [Math.cos(a) * R, 0, Math.sin(a) * R],
      0.003,
    );
    b.rotation.y = -a;
  });
  spin.cyl(0.24, 0.03, "#3a2a1c", [0, -0.01, 0], 0.22, 24);
  spin.cyl(0.07, 0.07, "#e9b930", [0, 0.01, 0], 0.012, 12);
  m.add(spin);
  // The white ball runs round the bowl the other way, then drops into its pocket.
  const ball = liveModel();
  ball.position.set(wx, felt + 0.18, wz);
  const bead = ball.ball(0.017, "#ffffff", [0.37, 0, 0]);
  m.add(ball);

  // Over the table: the landed number on a disc, and a little board at the back edge with the last pockets.
  const numTex = canvasTexture(64, 64, () => {});
  const numMat = overlayMaterial(numTex);
  const numPlane = m.plane(0.5, 0.5, numMat, [wx, felt + 0.95, wz + 0.1]);
  numPlane.visible = false;
  numPlane.rotation.x = -0.35;
  const HIST = 6;
  const histTex = canvasTexture(96, 20, () => {});
  const histMat = overlayMaterial(histTex);
  const histPlane = m.plane(0.62, 0.13, histMat, [0.75, felt + 0.1, -0.82]);
  histPlane.rotation.x = -0.4;
  const drawHistory = (history: readonly number[]) => {
    const g = (histTex.image as HTMLCanvasElement).getContext("2d")!;
    g.clearRect(0, 0, 96, 20);
    g.fillStyle = "#2a1c1c";
    g.fillRect(0, 0, 96, 20);
    g.strokeStyle = "#e9b930";
    g.strokeRect(0.5, 0.5, 95, 19);
    for (let i = 0; i < HIST; i++) {
      const p = history[i];
      g.fillStyle = p === undefined ? "#3a3030" : DISC[colorOf(p)];
      g.beginPath();
      g.arc(9 + i * 15.5, 10, i === 0 ? 6.5 : 5, 0, TAU);
      g.fill();
      if (p !== undefined && i === 0) {
        g.strokeStyle = "#ffffff";
        g.lineWidth = 1.5;
        g.stroke();
      }
    }
    histTex.needsUpdate = true;
  };
  drawHistory([]);

  // Chips on the felt (one instanced mesh), a glow and a "ready" dot per seated spot.
  const props = liveModel();
  m.add(props);
  const chipMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.034, 0.034, 0.012, 10),
    new THREE.MeshBasicMaterial(),
    MAX_CHIPS,
  );
  chipMesh.count = 0;
  chipMesh.frustumCulled = false;
  chipMesh.userData.live = true;
  props.add(chipMesh);
  const glows: THREE.Mesh[] = [];
  const dots: THREE.Mesh[] = [];
  const glowMat = new THREE.MeshBasicMaterial({
    color: "#ffb35a",
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const dotMat = new THREE.MeshBasicMaterial({ color: "#4ade80" });
  m.setSpots = (spots) => {
    for (const o of [...glows, ...dots]) o.removeFromParent();
    glows.length = dots.length = 0;
    for (const [sx, sz] of spots) {
      const glow = props.cyl(0.46, 0.006, glowMat, [sx, 0.035, sz], 0.46, 24);
      glow.visible = false;
      glows.push(glow);
      const dot = props.ball(0.07, dotMat, [sx, 1.85, sz]);
      dot.visible = false;
      dots.push(dot);
    }
  };
  const tmp = new THREE.Object3D();
  const col = new THREE.Color();
  let chipKey = "";
  const putChips = (state: RouletteState | null) => {
    const players = state?.players ?? [];
    const key = JSON.stringify(players.map((p) => [p.userId, p.bets]));
    if (key === chipKey) return;
    chipKey = key;
    let k = 0;
    for (const p of players) {
      const seat = state!.seats.find((s) => s.userId === p.userId)?.spot ?? 0;
      col.set(SEAT_COLORS[seat % SEAT_COLORS.length]!);
      for (const b of p.bets as Bet[]) {
        const at = betSpot(b.on);
        if (!at) continue;
        const h = Math.min(5, Math.max(1, Math.ceil(b.stake / 25)));
        for (let c = 0; c < h && k < MAX_CHIPS; c++) {
          tmp.position.set(at[0] + (seat - 3.5) * 0.03, felt + 0.008 + c * 0.013, at[1] + (seat % 2) * 0.012);
          tmp.updateMatrix();
          chipMesh.setMatrixAt(k, tmp.matrix);
          chipMesh.setColorAt(k, col);
          k++;
        }
      }
    }
    chipMesh.count = k;
    chipMesh.instanceMatrix.needsUpdate = true;
    if (chipMesh.instanceColor) chipMesh.instanceColor.needsUpdate = true;
  };

  // Animation state.
  let theta = 0;
  let labelKey = "";
  let histKey = "";
  const IDLE = 0.35;

  const drawLabel = (text: string, fill: string) => {
    const g = (numTex.image as HTMLCanvasElement).getContext("2d")!;
    g.clearRect(0, 0, 64, 64);
    g.fillStyle = "#f2efe0";
    g.beginPath();
    g.arc(32, 32, 30, 0, TAU);
    g.fill();
    g.fillStyle = fill;
    g.beginPath();
    g.arc(32, 32, 26, 0, TAU);
    g.fill();
    g.fillStyle = "#ffffff";
    g.font = "bold 30px ui-monospace, Menlo, Consolas, monospace";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, 32, 34);
    numTex.needsUpdate = true;
  };

  m.show = (state, now, dt) => {
    const phase = state?.phase ?? "idle";
    const last = state?.last ?? null;
    // The server's clock, from when this state was sent.
    const server = state ? state.now + (now - state.at) : now;
    const key = state ? state.history.slice(0, HIST).join(",") : "";
    if (key !== histKey) {
      histKey = key;
      drawHistory(state?.history ?? []);
    }
    putChips(state);

    // Wheel and ball.
    let speed = IDLE;
    let ballAngle: number | null = null;
    let drop = 0;
    const idx = last ? WHEEL.indexOf(last.pocket as (typeof WHEEL)[number]) : -1;
    if (phase === "spinning" && last && idx >= 0 && state) {
      const t = Math.min(1, Math.max(0, 1 - (state.phaseEndsAt - server) / SPIN_MS));
      speed = IDLE + 5 * (1 - t) ** 2;
      const e = 1 - (1 - t) ** 3;
      theta -= speed * dt;
      // Pocket i sits at angle a - theta in the table's xz plane; the ball closes in on it from three laps behind.
      ballAngle = (idx / n) * TAU - theta + (1 - e) * TAU * 3;
      drop = Math.max(0, (t - 0.7) / 0.3);
    } else {
      theta -= speed * dt;
      if (idx >= 0) {
        ballAngle = (idx / n) * TAU - theta;
        drop = 1;
      }
    }
    spin.rotation.y = theta;
    if (ballAngle === null) ballAngle = (-now / 1000) * 1.1;
    ball.rotation.y = -ballAngle;
    bead.position.x = 0.37 - 0.07 * drop;
    bead.position.y = -0.012 * drop;

    // The label over the table: the clock while bets are open, "..." while it spins, the number once it landed.
    let text = "";
    let fill: string = "#3a3a46";
    if (state && phase === "betting")
      text = String(Math.max(0, Math.ceil((state.phaseEndsAt - server) / 1000)));
    else if (phase === "spinning") text = "...";
    else if (phase === "result" && last) {
      text = String(last.pocket);
      fill = DISC[colorOf(last.pocket)];
    }
    if (text && text + fill !== labelKey) {
      labelKey = text + fill;
      drawLabel(text, fill);
    }
    numPlane.visible = text !== "";

    // Seated players.
    const taken = new Set(state?.seats.map((s) => s.spot) ?? []);
    const ready = new Set(
      (state?.players ?? [])
        .filter((p) => p.ready)
        .map((p) => state!.seats.find((s) => s.userId === p.userId)?.spot),
    );
    const pulse = 0.8 + 0.2 * Math.sin(now / 400);
    glowMat.opacity = 0.45 * pulse;
    glows.forEach((gl, i) => {
      gl.visible = taken.has(i);
      if (dots[i]) dots[i].visible = ready.has(i);
    });
  };
  return m;
}

/** A faint round mat (a stack of chips) under each spot, `at` in room tiles: flat, so it never blocks the way. */
export function rouletteMats(spots: readonly (readonly [number, number])[]): Model {
  const m = new Model();
  for (const [x, z] of spots) {
    m.cyl(0.34, 0.012, tint("#7a2f3a", 0.1), [x + 0.5, 0.012, z + 0.5], 0.34, 20);
    m.cyl(0.25, 0.016, "#3a2a2f", [x + 0.5, 0.024, z + 0.5], 0.25, 20);
    for (let i = 0; i < 3; i++)
      m.cyl(0.07, 0.025, [C.rug, "#f2efe0", "#2a2a33"][i]!, [x + 0.5, 0.03 + i * 0.026, z + 0.5], 0.07, 10);
  }
  return m;
}
