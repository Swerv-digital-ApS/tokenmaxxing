/**
 * The modelling kit: every 3D asset is built in code from rounded boxes, cylinders and balls, shaded
 * with a few flat bands (toon), the way the 2D sprites are drawn from string grids. Textures (planks,
 * wallpaper, screens) are painted on small canvases. Surface texel edges are antialiased while pixel interiors stay sharp.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { addPatch } from "./patches.ts";

export type V3 = [number, number, number];

/**
 * Lamps, neon and screens set colours from `#rrggbb` strings every frame, and three parses each one with a regex and
 * a match array. `#rrggbb` is looked up instead (strings in the code are interned: the lookup allocates nothing).
 */
{
  const stock = THREE.Color.prototype.setStyle;
  const hex = new Map<string, number>();
  THREE.Color.prototype.setStyle = function (this: THREE.Color, style: string, colorSpace?: string) {
    if (style.length === 7 && style.charCodeAt(0) === 35) {
      let n = hex.get(style);
      if (n === undefined) {
        n = Number.parseInt(style.slice(1), 16);
        hex.set(style, n);
      }
      if (!Number.isNaN(n)) return this.setHex(n, colorSpace as THREE.ColorSpace | undefined);
    }
    return stock.call(this, style, colorSpace as THREE.ColorSpace | undefined);
  };
}
export type Paint = string | THREE.Material;

/** Three flat light bands: shadow, mid, lit. */
const BANDS = (() => {
  const t = new THREE.DataTexture(new Uint8Array([105, 175, 255]), 3, 1, THREE.RedFormat);
  t.userData.shared = true;
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

/**
 * Voxel (Plethora) style: the same bands become a smooth ramp, so every toon material shades like soft matte
 * diffuse paint. All toon materials share this one texture, so swapping its data swaps them all (and back).
 */
let smoothBands = false;
export function setSmoothBands(on: boolean): void {
  if (on === smoothBands) return;
  smoothBands = on;
  const n = on ? 128 : 3;
  const data = new Uint8Array(n);
  if (on) {
    for (let i = 0; i < n; i++) {
      const dotNL = (i / (n - 1)) * 2 - 1;
      data[i] = Math.round(255 * Math.min(1, Math.max(0, dotNL * 0.9 + 0.1)));
    }
  } else data.set([105, 175, 255]);
  BANDS.dispose();
  BANDS.image = { data, width: n, height: 1 };
  BANDS.minFilter = BANDS.magFilter = on ? THREE.LinearFilter : THREE.NearestFilter;
  BANDS.needsUpdate = true;
}

const toons = new Map<string, THREE.MeshToonMaterial>();
/** The one material most things use: a colour, lit in bands. */
export function toon(color: string): THREE.MeshToonMaterial {
  let m = toons.get(color);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: BANDS });
    m.userData.shared = true;
    toons.set(color, m);
  }
  return m;
}

/** Lit from inside: screens, lamps, neon. Ignores the lights. */
export function glow(color: string, map?: THREE.Texture): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color: map ? "#ffffff" : color, map: map ?? null });
}

export function glass(color: string, opacity = 0.45): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({
    color,
    gradientMap: BANDS,
    transparent: true,
    opacity,
    depthWrite: false,
  });
}

/** A toon material with a painted texture. */
export function painted(map: THREE.Texture, color = "#ffffff"): THREE.MeshToonMaterial {
  const material = new THREE.MeshToonMaterial({ color, map, gradientMap: BANDS });
  if (map.userData.pixelSurface) {
    addPatch(material, "pixel-surface", (shader) => {
      // Blend only the screen pixel that straddles a texel edge. Keep the original derivatives for mip selection.
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        /* glsl */ `
#ifdef USE_MAP
  vec2 surfaceSize = vec2(textureSize(map, 0));
  vec2 surfaceUv = vMapUv * surfaceSize;
  vec2 footprint = clamp(fwidth(surfaceUv), vec2(0.0001), vec2(1.0));
  vec2 phase = fract(surfaceUv);
  vec2 edge = phase - clamp(phase, footprint * 0.5, 1.0 - footprint * 0.5);
  vec2 filteredUv = (floor(surfaceUv) + 0.5 + edge / footprint) / surfaceSize;
#endif
${THREE.ShaderChunk.map_fragment.replace(
  "texture2D( map, vMapUv )",
  "textureGrad( map, filteredUv, dFdx(vMapUv), dFdy(vMapUv) )",
)}`,
      );
    });
  }
  return material;
}

const AXES = [0, 1, 2] as const;

/**
 * A box with a one-step bevel in 44 triangles (the rounded box of three's addons is 108 at its leanest and 300
 * at two steps): flat faces, a strip per edge turning from one face's normal to the next, a triangle per corner.
 * Centred on the origin, with box-style UVs.
 */
export function chamferBox(w: number, h: number, d: number, r: number): THREE.BufferGeometry {
  const half = [w / 2, h / 2, d / 2];
  const rr = Math.max(0, Math.min(r, ...half.map((x) => x - 1e-4)));
  const inner = half.map((x) => x - rr);
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const dirs = (axis: number, sign: number): number[] => {
    const n = [0, 0, 0];
    n[axis] = sign;
    return n;
  };
  const uvOf = (p: number[], n: number[]): [number, number] => {
    const ax = n.findIndex((x) => Math.abs(x) > 0.5);
    const sg = n[ax]!;
    const f = (i: number) => (p[i]! + half[i]!) / (half[i]! * 2);
    if (ax === 0) return [sg > 0 ? 1 - f(2) : f(2), f(1)];
    if (ax === 1) return [f(0), sg > 0 ? 1 - f(2) : f(2)];
    return [sg > 0 ? f(0) : 1 - f(0), f(1)];
  };
  const tri = (
    a: number[],
    b: number[],
    c: number[],
    na: number[],
    nb: number[],
    nc: number[],
    face: number[],
  ) => {
    // Wind counter-clockwise seen from outside.
    const e1 = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!];
    const e2 = [c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!];
    const cr = [
      e1[1]! * e2[2]! - e1[2]! * e2[1]!,
      e1[2]! * e2[0]! - e1[0]! * e2[2]!,
      e1[0]! * e2[1]! - e1[1]! * e2[0]!,
    ];
    const out =
      cr[0]! * (na[0]! + nb[0]! + nc[0]!) +
      cr[1]! * (na[1]! + nb[1]! + nc[1]!) +
      cr[2]! * (na[2]! + nb[2]! + nc[2]!);
    const v = out >= 0 ? [a, b, c] : [a, c, b];
    const n = out >= 0 ? [na, nb, nc] : [na, nc, nb];
    for (let i = 0; i < 3; i++) {
      pos.push(...v[i]!);
      nor.push(...n[i]!);
      uv.push(...uvOf(v[i]!, face));
    }
  };
  const quad = (
    a: number[],
    b: number[],
    c: number[],
    d2: number[],
    na: number[],
    nb: number[],
    face: number[],
  ) => {
    tri(a, b, c, na, na, nb, face);
    tri(a, c, d2, na, nb, nb, face);
  };
  const pt = (vals: [number, number, number]) => vals;
  for (const ax of AXES)
    for (const sg of [-1, 1]) {
      const n = dirs(ax, sg);
      const u = (ax + 1) % 3;
      const v = (ax + 2) % 3;
      const c = (a: number, b: number) => {
        const p = [0, 0, 0];
        p[ax] = sg * half[ax]!;
        p[u] = a * inner[u]!;
        p[v] = b * inner[v]!;
        return p;
      };
      quad(c(-1, -1), c(1, -1), c(1, 1), c(-1, 1), n, n, n);
    }
  // Edge strips: face A (axis a) meets face B (axis b); the edge runs along c.
  for (const [a, b, c] of [
    [0, 1, 2],
    [0, 2, 1],
    [1, 2, 0],
  ] as const)
    for (const sa of [-1, 1])
      for (const sb of [-1, 1]) {
        const na = dirs(a, sa);
        const nb = dirs(b, sb);
        const onA = (t: number) => {
          const p = [0, 0, 0];
          p[a] = sa * half[a]!;
          p[b] = sb * inner[b]!;
          p[c] = t * inner[c]!;
          return p;
        };
        const onB = (t: number) => {
          const p = [0, 0, 0];
          p[a] = sa * inner[a]!;
          p[b] = sb * half[b]!;
          p[c] = t * inner[c]!;
          return p;
        };
        quad(onA(-1), onA(1), onB(1), onB(-1), na, nb, na);
      }
  // Corners.
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1]) {
        const px = pt([sx * half[0]!, sy * inner[1]!, sz * inner[2]!]);
        const py = pt([sx * inner[0]!, sy * half[1]!, sz * inner[2]!]);
        const pz = pt([sx * inner[0]!, sy * inner[1]!, sz * half[2]!]);
        tri(px, py, pz, dirs(0, sx), dirs(1, sy), dirs(2, sz), dirs(2, sz));
      }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

const asMaterial = (p: Paint) => (typeof p === "string" ? toon(p) : p);

const geometries = new Map<string, THREE.BufferGeometry>();
function geometry(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geometries.get(key);
  if (!g) {
    g = make();
    g.userData.shared = true;
    geometries.set(key, g);
  }
  return g;
}

/**
 * Round things are a few pixels across at game scale: a 0.1 ball needs 6 segments, not 14 (a 14 x 11 sphere
 * is 308 triangles). Scales with the radius, never above what the asset asked for.
 */
function segmentsFor(radius: number, wanted: number): number {
  return detail === 0
    ? Math.max(5, Math.min(wanted, Math.round(radius * 28)))
    : Math.max(6, Math.min(wanted, Math.round(radius * 44)));
}

/**
 * Geometry detail for rooms built from now on: 0 is the lean set for the Medium tier (plain boxes, fewer round
 * segments), 1 the normal one. Rooms already built keep what they have, so set it before building.
 */
let detail: 0 | 1 = 1;
export function setGeometryDetail(level: 0 | 1): void {
  detail = level;
}
/** The detail rooms are being built with (0 on Medium): the busy rooms thin their crowds by it. */
export const geometryDetail = (): 0 | 1 => detail;

/** A group with shortcuts for the shapes assets are made of. Positions are bottom-centres unless noted. */
/** Where in the code a piece was made (`userData.src`), for `web/scripts/zfight.ts` to say what to look at: off unless asked for. */
function callSite(): string {
  const lines = new Error().stack?.split("\n") ?? [];
  for (const l of lines.slice(1))
    if (!l.includes("/kit/kit.ts") && !l.includes("callSite"))
      return l
        .replace(/^\s*at\s+/, "")
        .replace(/.*\/(src\/render3d\/)/, "$1")
        .replace(/\)$/, "");
  return "";
}

export class Model extends THREE.Group {
  protected put(mesh: THREE.Mesh, at: V3): THREE.Mesh {
    mesh.position.set(...at);
    mesh.castShadow = mesh.receiveShadow = true;
    if ((globalThis as { __traceSrc?: boolean }).__traceSrc) mesh.userData.src = callSite();
    this.add(mesh);
    return mesh;
  }

  /** A box with rounded edges, its bottom centre at `at`. */
  box(size: V3, paint: Paint, at: V3 = [0, 0, 0], r = 0.025): THREE.Mesh {
    const [w, h, d] = size;
    const radius = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
    const g = geometry(`box${w},${h},${d},${radius},${detail}`, () => {
      // Small bevels (nearly all of them) are a chamfer: a third of the triangles of the rounded box, same look at game scale.
      const b =
        detail === 0 && radius < 0.06
          ? new THREE.BoxGeometry(w, h, d)
          : radius > 0.004 && radius < 0.06
            ? chamferBox(w, h, d, radius)
            : radius > 0.004
              ? new RoundedBoxGeometry(w, h, d, 2, radius)
              : new THREE.BoxGeometry(w, h, d);
      b.translate(0, h / 2, 0);
      return b;
    });
    return this.put(new THREE.Mesh(g, asMaterial(paint)), at);
  }

  /** A cylinder (or a cone, with `top`), its bottom centre at `at`. */
  cyl(radius: number, h: number, paint: Paint, at: V3 = [0, 0, 0], top = radius, seg = 14): THREE.Mesh {
    seg = segmentsFor(Math.max(radius, top), seg);
    const g = geometry(`cyl${radius},${h},${top},${seg}`, () => {
      const c = new THREE.CylinderGeometry(top, radius, h, seg);
      c.translate(0, h / 2, 0);
      return c;
    });
    return this.put(new THREE.Mesh(g, asMaterial(paint)), at);
  }

  /** A ball, its centre at `at`, squashed by `scale`. */
  ball(radius: number, paint: Paint, at: V3 = [0, 0, 0], scale: V3 = [1, 1, 1], seg = 14): THREE.Mesh {
    seg = segmentsFor(radius * Math.max(...scale), seg);
    const g = geometry(
      `ball${radius},${seg}`,
      () => new THREE.SphereGeometry(radius, seg, Math.round(seg * 0.75)),
    );
    const m = this.put(new THREE.Mesh(g, asMaterial(paint)), at);
    m.scale.set(...scale);
    return m;
  }

  /** A flat picture facing +z, its centre at `at`. */
  plane(w: number, h: number, paint: Paint, at: V3 = [0, 0, 0]): THREE.Mesh {
    const g = geometry(`plane${w},${h}`, () => new THREE.PlaneGeometry(w, h));
    const m = this.put(new THREE.Mesh(g, asMaterial(paint)), at);
    m.castShadow = false;
    return m;
  }

  /** A child model at `at`, turned `turn` radians about y. */
  part(at: V3 = [0, 0, 0], turn = 0): Model {
    const m = new Model();
    m.position.set(...at);
    m.rotation.y = turn;
    this.add(m);
    return m;
  }
}

/** A model something will animate (an avatar, a pet, a boss): the static batching leaves it alone. */
export function liveModel(): Model {
  const m = new Model();
  m.userData.live = true;
  return m;
}

let textureEdge = 2048;
/** The longest edge a painted smooth texture may have, for rooms built from now on (Medium keeps them at 1024). */
export function setTextureCap(px: number): void {
  textureEdge = Math.max(256, px);
}
export const textureCap = (): number => textureEdge;

/** A canvas texture, painted once, sampled as pixels (or smoothly, for the big HD surfaces). */
export function canvasTexture(
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D) => void,
  smooth = false,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  // A big smooth surface is painted smaller when the tier caps textures: the drawing code keeps its own coordinates.
  const k = smooth && Math.max(w, h) > textureEdge ? textureEdge / Math.max(w, h) : 1;
  canvas.width = Math.max(1, Math.round(w * k));
  canvas.height = Math.max(1, Math.round(h * k));
  const g = canvas.getContext("2d")!;
  if (k !== 1) g.scale(k, k);
  draw(g);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  if (smooth) {
    t.anisotropy = 4;
    return t;
  }
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}

/** A small deterministic noise, so painted textures look the same every load. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Moves `#rrggbb` towards white (`f` > 0) or black (`f` < 0). */
export function tint(hex: string, f: number): string {
  const c = new THREE.Color(hex);
  c.lerp(new THREE.Color(f > 0 ? "#ffffff" : "#000000"), Math.abs(f));
  return `#${c.getHexString()}`;
}

/** Pixel interiors stay sharp; trilinear mipmaps and anisotropy smooth receding surfaces. */
function pixelSurface(t: THREE.CanvasTexture) {
  t.userData.pixelSurface = true;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 4;
  t.generateMipmaps = true;
  return t;
}

/** Wood planks, one tile per 16 texels. */
export function planks(base: string, seed = 1): THREE.CanvasTexture {
  const rnd = seeded(seed);
  const t = canvasTexture(64, 64, (g) => {
    for (let row = 0; row < 8; row++) {
      let x = -Math.floor(rnd() * 24);
      while (x < 64) {
        const len = 18 + Math.floor(rnd() * 22);
        g.fillStyle = tint(base, (rnd() - 0.5) * 0.12);
        g.fillRect(x, row * 8, len, 8);
        g.fillStyle = tint(base, -0.08);
        for (let i = 0; i < 3; i++)
          g.fillRect(x + 2 + Math.floor(rnd() * (len - 4)), row * 8 + 2 + Math.floor(rnd() * 4), 3, 1);
        g.fillStyle = tint(base, -0.28);
        g.fillRect(x, row * 8, 1, 8);
        x += len;
      }
      g.fillStyle = tint(base, -0.22);
      g.fillRect(0, row * 8 + 7, 64, 1);
      g.fillStyle = tint(base, 0.1);
      g.fillRect(0, row * 8, 64, 1);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return pixelSurface(t);
}

/** Striped wallpaper with a dado rail, one tile wide per 16 texels. */
export function wallpaper(base: string, stripe: string): THREE.CanvasTexture {
  const t = canvasTexture(16, 48, (g) => {
    g.fillStyle = base;
    g.fillRect(0, 0, 16, 48);
    g.fillStyle = stripe;
    g.fillRect(3, 0, 2, 30);
    g.fillRect(11, 0, 2, 30);
    g.fillStyle = tint(stripe, -0.1);
    g.fillRect(0, 30, 16, 2);
    g.fillStyle = tint(base, -0.06);
    g.fillRect(0, 32, 16, 16);
    g.fillStyle = tint(base, -0.14);
    for (let x = 0; x < 16; x += 4) g.fillRect(x, 32, 1, 16);
  });
  t.wrapS = THREE.RepeatWrapping;
  return pixelSurface(t);
}

/** A checker of two colours, `n`×`n` squares over the texture. */
export function checker(a: string, b: string, n = 4): THREE.CanvasTexture {
  const t = canvasTexture(n * 4, n * 4, (g) => {
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        g.fillStyle = (x + y) % 2 ? a : b;
        g.fillRect(x * 4, y * 4, 4, 4);
      }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return pixelSurface(t);
}

/** Something that moves on its own: a screen scrolling code, a fish swimming. */
export type Tick = (t: number) => void;
type Scoped = Tick & { raw: Tick };

/** Ticks registered while a room is being built belong to it, and only run while that room is on screen. */
export interface TickScope {
  root: THREE.Object3D | null;
  fns: Tick[];
}
let building: TickScope | null = null;
const enclosingScopes = new WeakMap<TickScope, TickScope | null>();
let onScreen: THREE.Object3D | null = null;

export function beginTickScope(): TickScope {
  const scope: TickScope = { root: null, fns: [] };
  enclosingScopes.set(scope, building);
  building = scope;
  return scope;
}
export function endTickScope(scope: TickScope, root: THREE.Object3D): void {
  scope.root = root;
  if (building === scope) building = enclosingScopes.get(scope) ?? null;
  enclosingScopes.delete(scope);
}
/** A room that is no longer kept: its ticks stop running (and stop holding its models alive). */
export function dropTickScope(scope: TickScope): void {
  const gone = new Set(scope.fns);
  for (let i = ticks.length - 1; i >= 0; i--)
    if (gone.has(ticks[i]!)) Array.prototype.splice.call(ticks, i, 1);
  scope.fns.length = 0;
}
/** The scene being drawn: ticks of rooms in any other scene sit out. Null runs everything. */
export function setActiveScene(scene: THREE.Object3D | null): void {
  onScreen = scene;
}
function inActive(root: THREE.Object3D): boolean {
  let o: THREE.Object3D | null = root;
  while (o) {
    if (o === onScreen) return true;
    o = o.parent;
  }
  return false;
}

class TickList extends Array<Tick> {
  override push(...fns: Tick[]): number {
    const scope = building;
    return super.push(
      ...fns.map((fn) => {
        if (!scope) return fn;
        const w = ((t: number) => {
          if (onScreen && scope.root && !inActive(scope.root)) return;
          fn(t);
        }) as Scoped;
        w.raw = fn;
        scope.fns.push(w);
        return w;
      }),
    );
  }
  override indexOf(fn: Tick, from?: number): number {
    const i = super.indexOf(fn, from);
    return i >= 0 ? i : this.findIndex((t) => (t as Partial<Scoped>).raw === fn);
  }
}
export const ticks: Tick[] = new TickList();

const CODE_COLOURS = ["#ff7ab6", "#8fe3ff", "#ffe28a", "#a5d977", "#c9b6ff", "#e4f5fd"];
/** A monitor showing an agent writing code, scrolling a line at a time. */
export function codeScreen(seed: number, bg = "#1b1f2a"): THREE.CanvasTexture {
  const rnd = seeded(seed);
  const lines = Array.from({ length: 24 }, () => {
    const indent = Math.floor(rnd() * 4) * 2;
    const words = Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => ({
      w: 2 + Math.floor(rnd() * 6),
      c: CODE_COLOURS[Math.floor(rnd() * CODE_COLOURS.length)]!,
    }));
    return { indent, words };
  });
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 20;
  const g = canvas.getContext("2d")!;
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  let shown = -1;
  const speed = 2 + rnd() * 3;
  const draw = (top: number) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, 32, 20);
    for (let i = 0; i < 6; i++) {
      const line = lines[(top + i) % lines.length]!;
      let x = 2 + line.indent;
      for (const w of line.words) {
        g.fillStyle = w.c;
        g.fillRect(x, 2 + i * 3, w.w, 1);
        x += w.w + 1;
      }
    }
    g.fillStyle = "#3ddc84";
    g.fillRect(2, 18, 6, 1);
    t.needsUpdate = true;
  };
  draw(0);
  ticks.push((time) => {
    const top = Math.floor(time * speed);
    if (top === shown) return;
    shown = top;
    draw(top);
  });
  return t;
}
