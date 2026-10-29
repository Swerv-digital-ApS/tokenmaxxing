/**
 * Shared pieces of the pet store: animated pets, price tags, labels that face the camera, fences and the
 * small props (bowls, toys, a crown) the fixtures are dressed with.
 */
import * as THREE from "three";
import { C } from "../../art/palette.ts";
import { canvasTexture, glass, glow, Model, painted, ticks, tint } from "../kit/kit.ts";
import { panel } from "../kit/panel.ts";
import type { Pet3D, PetPose } from "../pets/pets3d.ts";

// MARK: Ticks

/**
 * Runs `fn` every frame. `transient` ones (item previews, built on demand) drop out once their model has
 * been out of every scene for a while; the store's own pets keep going.
 */
export function live(m: THREE.Object3D, fn: (t: number) => void, transient = false): void {
  let seen = performance.now() / 1000;
  const tick = (t: number) => {
    if (!transient) return fn(t);
    let o: THREE.Object3D = m;
    while (o.parent) o = o.parent;
    if (o.type === "Scene") {
      seen = t;
      fn(t);
    } else if (t - seen > 15) {
      const i = ticks.indexOf(tick);
      if (i >= 0) ticks.splice(i, 1);
    }
  };
  ticks.push(tick);
}

// MARK: Pets

export type Mood = "lively" | "sleepy" | PetPose;

/**
 * Gives a pet a life: it stands and wags, sits, naps, and now and then bounces. `seed` staggers it from
 * the others; a fixed pose holds still (still wagging, blinking and breathing).
 */
export function animate(pet: Pet3D, seed: number, mood: Mood, transient = false): void {
  live(
    pet.root,
    (t) => {
      if (mood === "stand" || mood === "sit" || mood === "sleep") pet.pose = mood;
      else {
        const k = (t / 40 + seed * 0.37) % 1;
        const [a, b] = mood === "lively" ? [0.5, 0.82] : [0.2, 0.45];
        pet.pose = k < a ? "stand" : k < b ? "sit" : "sleep";
      }
      pet.moving = pet.pose === "stand" && (t * 0.5 + seed * 3) % 7 < 0.8;
      pet.update(t);
    },
    transient,
  );
}

// MARK: Labels

/** A camera-facing quad (a Mesh, so the outline pass leaves it out). */
function billboard(w: number, h: number, tex: THREE.Texture): THREE.Mesh {
  const q = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  q.onBeforeRender = (_r, _s, camera) => q.quaternion.copy(camera.quaternion);
  q.renderOrder = 6;
  return q;
}

/** A name chip floating over a character. */
export function nameChip(text: string, sub: string): THREE.Mesh {
  const tex = canvasTexture(
    160,
    44,
    (g) => {
      g.fillStyle = "rgba(43,36,51,0.88)";
      g.beginPath();
      g.roundRect(0, 0, 160, 44, 12);
      g.fill();
      g.fillStyle = "#ffe28a";
      g.font = "800 17px system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(text, 80, 15);
      g.fillStyle = "#a8dcf7";
      g.font = "600 12px system-ui, sans-serif";
      g.fillText(sub, 80, 33);
    },
    true,
  );
  return billboard(0.8, 0.22, tex);
}

/** A speech bubble over a character that says each of `lines` in turn. */
export function bubble(lines: readonly string[]): THREE.Mesh {
  const W = 300;
  const H = 76;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  let shown = -1;
  const q = billboard(1.5, 0.38, tex);
  const draw = (text: string) => {
    const g = canvas.getContext("2d")!;
    g.clearRect(0, 0, W, H);
    g.fillStyle = "#fffaf0";
    g.strokeStyle = "#2b2433";
    g.lineWidth = 3;
    g.beginPath();
    g.roundRect(3, 3, W - 6, H - 20, 14);
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(W / 2 - 9, H - 18);
    g.lineTo(W / 2, H - 3);
    g.lineTo(W / 2 + 9, H - 18);
    g.closePath();
    g.fill();
    g.fillStyle = "#fffaf0";
    g.fillRect(W / 2 - 7, H - 21, 14, 5);
    g.fillStyle = "#2b2433";
    g.font = "700 17px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, W / 2, (H - 20) / 2 + 2, W - 24);
    tex.needsUpdate = true;
  };
  live(q, (t) => {
    const i = Math.floor(t / 6) % lines.length;
    if (i !== shown) {
      shown = i;
      draw(lines[i]!);
    }
    // Pops in at the start of each line, fades out at its end.
    const u = (t % 6) / 6;
    q.visible = u < 0.88;
    q.scale.setScalar(u < 0.05 ? 0.6 + 8 * u : 1);
  });
  return q;
}

// MARK: Price tags

export type TagKind = "price" | "variant" | "level" | "gear" | "info";

/**
 * A little standing card: a name over a price (a coin and an amount), the pet it comes with, or the level
 * that grants it. `lean` tips it back so the camera reads it from above.
 */
export function tag(
  title: string,
  line: string,
  kind: TagKind,
  opts: { w?: number; accent?: string; lean?: number; lift?: number } = {},
): Model {
  const { w = 0.62, accent = "#3fa7a0", lean = -0.45, lift = 0 } = opts;
  const h = w * 0.48;
  const m = new Model();
  const p = panel(
    w,
    h,
    (g, cw, ch) => {
      g.fillStyle = "#fff6df";
      g.fillRect(0, 0, cw, ch);
      g.fillStyle = accent;
      g.fillRect(0, 0, cw, Math.round(ch * 0.1));
      g.fillStyle = "#2b2433";
      g.textAlign = "center";
      g.textBaseline = "middle";
      const fs = Math.round(ch * 0.3);
      g.font = `800 ${fs}px system-ui, sans-serif`;
      g.fillText(title, cw / 2, ch * 0.36, cw - 8);
      const y = ch * 0.74;
      const coin = (x: number) => {
        g.fillStyle = "#e0a82e";
        g.beginPath();
        g.arc(x, y, ch * 0.15, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#fff1a8";
        g.beginPath();
        g.arc(x - ch * 0.04, y - ch * 0.04, ch * 0.06, 0, Math.PI * 2);
        g.fill();
      };
      if (kind === "price" || kind === "gear") {
        g.font = `800 ${Math.round(ch * 0.3)}px system-ui, sans-serif`;
        const tw = g.measureText(line).width;
        coin(cw / 2 - tw / 2 - ch * 0.12);
        g.fillStyle = "#8c5c36";
        g.fillText(line, cw / 2 + ch * 0.12, y, cw - 30);
      } else if (kind === "level") {
        g.font = `800 ${Math.round(ch * 0.3)}px system-ui, sans-serif`;
        g.fillStyle = "#6d4fc4";
        g.fillText(`\u{1F512} ${line}`, cw / 2, y, cw - 8);
      } else {
        g.font = `700 ${Math.round(ch * 0.24)}px system-ui, sans-serif`;
        g.fillStyle = "#6a7a80";
        g.fillText(line, cw / 2, y, cw - 8);
      }
    },
    { frame: "#7a5a3a", px: 132, smooth: true },
  );
  const tilt = m.part([0, lift, 0]);
  tilt.add(p);
  tilt.rotation.x = lean;
  return m;
}

// MARK: Surfaces

/** Straw, or any speckled floor, `w`×`d` tiles. */
export function speckle(
  base: string,
  fleck: string,
  w: number,
  d: number,
  seed: number,
): THREE.CanvasTexture {
  let s = seed;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const cw = Math.round(w * 12);
  const ch = Math.round(d * 12);
  return canvasTexture(cw, ch, (g) => {
    g.fillStyle = base;
    g.fillRect(0, 0, cw, ch);
    for (let i = 0; i < cw * ch * 0.05; i++) {
      g.fillStyle = rnd() < 0.5 ? fleck : tint(base, -0.12);
      g.fillRect(Math.floor(rnd() * cw), Math.floor(rnd() * ch), 2 + Math.floor(rnd() * 2), 1);
    }
  });
}

/** A low wooden fence round a `w`×`d` pen, centred on the origin. */
export function fence(
  m: Model,
  w: number,
  d: number,
  color: string,
  h = 0.5,
  gap?: { x: number; w: number },
): void {
  const post = tint(color, -0.15);
  const run = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / 0.8));
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      m.box([0.09, h + 0.06, 0.09], post, [x0 + (x1 - x0) * u, 0, z0 + (z1 - z0) * u], 0.02);
    }
    const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    for (const y of [h * 0.35, h * 0.78])
      m.box(along ? [len, 0.05, 0.04] : [0.04, 0.05, len], color, [(x0 + x1) / 2, y, (z0 + z1) / 2], 0.01);
  };
  const [x0, x1, z0, z1] = [-w / 2, w / 2, -d / 2, d / 2];
  run(x0, z0, x1, z0);
  run(x0, z0, x0, z1);
  run(x1, z0, x1, z1);
  if (gap) {
    run(x0, z1, gap.x - gap.w / 2, z1);
    run(gap.x + gap.w / 2, z1, x1, z1);
  } else run(x0, z1, x1, z1);
}

/** A sign on a post: a lit board with a title and a line under it. */
export function postSign(title: string, line: string, accent: string, w = 1.5): Model {
  const m = new Model();
  m.box([0.07, 0.95, 0.07], C.woodDark, [-w / 2 + 0.12, 0, 0], 0.02);
  m.box([0.07, 0.95, 0.07], C.woodDark, [w / 2 - 0.12, 0, 0], 0.02);
  const p = panel(
    w,
    0.46,
    (g, cw, ch) => {
      g.fillStyle = "#2b2433";
      g.fillRect(0, 0, cw, ch);
      g.fillStyle = accent;
      g.fillRect(0, 0, cw, 5);
      g.fillRect(0, ch - 5, cw, 5);
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = "#ffe28a";
      g.font = `900 ${Math.round(ch * 0.46)}px system-ui, sans-serif`;
      g.fillText(title, cw / 2, ch * 0.4, cw - 16);
      g.fillStyle = "#e8dcc4";
      g.font = `600 ${Math.round(ch * 0.22)}px system-ui, sans-serif`;
      g.fillText(line, cw / 2, ch * 0.8, cw - 16);
    },
    { frame: C.woodDark, lift: 0.78, px: 90, smooth: true },
  );
  m.add(p);
  return m;
}

// MARK: Props

/** A food or water bowl: steel, with kibble or water in it. */
export function bowl(kind: "kibble" | "water" | "fish", color = "#c8ced6"): Model {
  const m = new Model();
  m.cyl(0.17, 0.03, tint(color, -0.25), [0, 0, 0], 0.17, 16);
  m.cyl(0.2, 0.1, color, [0, 0.02, 0], 0.24, 16);
  m.cyl(0.19, 0.012, tint(color, -0.2), [0, 0.105, 0], 0.19, 16);
  if (kind === "water") m.cyl(0.194, 0.012, glass("#58a9e2", 0.85), [0, 0.106, 0], 0.194, 16);
  else {
    const c = kind === "fish" ? "#e07a4f" : "#8c5c36";
    for (let i = 0; i < 12; i++) {
      const a = i * 2.4;
      const r = 0.02 + (i % 4) * 0.035;
      m.ball(0.026, c, [Math.cos(a) * r, 0.12 + (i % 3) * 0.012, Math.sin(a) * r], [1, 0.7, 1], 5);
    }
  }
  return m;
}

/** A tennis ball. */
export function ball(m: Model, x: number, y: number, z: number, color = "#d6e64a"): void {
  m.ball(0.05, color, [x, y + 0.05, z], [1, 1, 1], 8);
  m.box([0.1, 0.012, 0.012], C.white, [x, y + 0.075, z + 0.02], 0.002);
}

/** A dog bone. */
export function bone(m: Model, x: number, y: number, z: number, turn = 0): void {
  const b = m.part([x, y, z], turn);
  b.box([0.2, 0.04, 0.05], "#f4ead2", [0, 0.02, 0], 0.012);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) b.ball(0.032, "#f4ead2", [sx * 0.1, 0.035, sz * 0.026], [1, 1, 1], 6);
}

/** A squeaky rubber toy: a yellow duck. */
export function squeakyDuck(m: Model, x: number, y: number, z: number, turn = 0): void {
  const d = m.part([x, y, z], turn);
  d.ball(0.065, "#ffd23c", [0, 0.055, 0], [1.1, 0.85, 1.3], 8);
  d.ball(0.045, "#ffd23c", [0, 0.115, 0.05], [1, 1, 1], 8);
  d.box([0.05, 0.015, 0.04], "#f08a2c", [0, 0.105, 0.1], 0.005);
}

/** A ball of yarn. */
export function yarn(m: Model, x: number, y: number, z: number, color = "#e0584f"): void {
  m.ball(0.06, color, [x, y + 0.06, z], [1, 1, 1], 8);
  m.box([0.1, 0.01, 0.01], tint(color, 0.3), [x, y + 0.08, z + 0.05], 0.002).rotation.y = 0.5;
}

/** A toy mouse with a tail. */
export function toyMouse(m: Model, x: number, y: number, z: number, turn = 0): void {
  const t = m.part([x, y, z], turn);
  t.ball(0.05, "#b8b2ad", [0, 0.04, 0], [1.3, 0.9, 1], 8);
  t.ball(0.012, "#2b2433", [0.06, 0.05, 0.02], [1, 1, 1], 4);
  t.ball(0.022, "#f28bb2", [0.035, 0.085, 0], [1, 1, 0.4], 6);
  t.box([0.09, 0.008, 0.008], "#f28bb2", [-0.1, 0.02, 0], 0.002);
}

/** A tin of treats: a coloured drum with a label stripe. */
export function tin(m: Model, x: number, y: number, z: number, color: string): void {
  m.cyl(0.07, 0.17, color, [x, y, z], 0.07, 12);
  m.cyl(0.072, 0.05, C.white, [x, y + 0.06, z], 0.072, 12);
  m.cyl(0.075, 0.02, tint(color, -0.25), [x, y + 0.17, z], 0.075, 12);
}

/** A bag of pet food with a paw on it. */
export function foodBag(m: Model, x: number, y: number, z: number, color: string): void {
  m.box([0.26, 0.34, 0.12], color, [x, y, z], 0.04);
  m.box([0.26, 0.04, 0.12], tint(color, -0.3), [x, y + 0.32, z], 0.015);
  m.box([0.14, 0.1, 0.01], C.white, [x, y + 0.1, z + 0.062], 0.003);
  m.ball(0.025, tint(color, -0.35), [x, y + 0.2, z + 0.066], [1.2, 1, 0.2], 6);
}

/** The pet crown (gold, red stone), stood on the floor of its own model. */
export function crownProp(scale = 1): Model {
  const m = new Model();
  const s = scale;
  m.cyl(0.17 * s, 0.07 * s, "#c98e22", [0, 0, 0], 0.17 * s, 18);
  m.cyl(0.17 * s, 0.015 * s, "#fff1a8", [0, 0.07 * s, 0], 0.17 * s, 18);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    m.cyl(
      0.05 * s,
      0.14 * s,
      "#ffe066",
      [Math.cos(a) * 0.14 * s, 0.07 * s, Math.sin(a) * 0.14 * s],
      0.005,
      4,
    );
    m.ball(
      0.022 * s,
      glow("#fff1a8"),
      [Math.cos(a) * 0.14 * s, 0.22 * s, Math.sin(a) * 0.14 * s],
      [1, 1, 1],
      6,
    );
  }
  m.ball(0.04 * s, glow("#e0405a"), [0, 0.035 * s, 0.18 * s], [1, 1, 0.6], 8);
  return m;
}

/** A round red velvet cushion with gold piping and tassels. */
export function cushion(r = 0.3): Model {
  const m = new Model();
  m.cyl(r, 0.12, "#a3243b", [0, 0, 0], r * 0.9, 20);
  m.cyl(r * 0.93, 0.03, "#c53a52", [0, 0.11, 0], r * 0.7, 20);
  m.cyl(r + 0.005, 0.016, "#e0a82e", [0, 0.045, 0], r + 0.005, 20);
  for (const a of [0.8, 2.4, 3.9, 5.5]) {
    const x = Math.cos(a) * r * 0.95;
    const z = Math.sin(a) * r * 0.95;
    m.cyl(0.012, 0.07, "#e0a82e", [x, -0.05, z], 0.012, 5);
    m.ball(0.026, "#e0a82e", [x, -0.07, z], [1, 1.3, 1], 6);
  }
  return m;
}

/** Sparkles that circle a point, for the crown and the orb. */
export function sparkles(m: Model, at: [number, number, number], r: number, n = 4, color = "#fff1a8"): void {
  const stars = Array.from({ length: n }, () => m.ball(0.018, glow(color), at, [1, 1, 1], 4));
  live(m, (t) =>
    stars.forEach((s, i) => {
      const a = t * 1.6 + (i * Math.PI * 2) / n;
      s.position.set(
        at[0] + Math.cos(a) * r,
        at[1] + Math.sin(t * 2.6 + i * 2) * 0.07,
        at[2] + Math.sin(a) * r,
      );
      s.scale.setScalar(0.6 + 0.6 * Math.abs(Math.sin(t * 3.3 + i * 1.7)));
    }),
  );
}

export { painted };
