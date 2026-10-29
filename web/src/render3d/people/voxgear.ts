/**
 * Blocky gear: the voxel avatar's clothes and props are built from cubes on its own grid, not from smooth
 * primitives. A `VoxModel` is a `Model` whose shortcuts draw boxes: a ball is a cube, a cylinder a square
 * prism (a cone, a stack of narrowing blocks), a rounded box a sharp one. Everything it draws is flagged
 * `noBlock`, so the Voxel render style (`blocky.ts`) leaves it exactly as built.
 *
 * Also here: shapes drawn as cubes (rings, domes, hearts and stars, painted marks as raised pixels), and a
 * small `Vx` grid for placing blocks by cube coordinates.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Model, type Paint, toon, type V3 } from "../kit/kit.ts";

/** One body cube, in metres (`voxel.ts`). */
export const U = 0.045;

const geos = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geos.get(key);
  if (!g) {
    g = make();
    geos.set(key, g);
  }
  return g;
}
const material = (p: Paint): THREE.Material => (typeof p === "string" ? toon(p) : p);

type Cube = [number, number, number, number, number, number];
/** Merged boxes: each is [centre x, y, z, width, height, depth]. */
function boxes(list: Cube[]): THREE.BufferGeometry {
  const parts = list.map(([x, y, z, w, h, d]) =>
    new THREE.BoxGeometry(Math.max(w, 0.001), Math.max(h, 0.001), Math.max(d, 0.001))
      .translate(x, y, z)
      .toNonIndexed(),
  );
  const g = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  return g;
}

/** Places a mesh in `m`, flagged as already blocky. */
export function place(m: THREE.Object3D, g: THREE.BufferGeometry, p: Paint, at: V3 = [0, 0, 0]): THREE.Mesh {
  const o = new THREE.Mesh(g, material(p));
  o.position.set(...at);
  o.castShadow = true;
  o.userData.noBlock = true;
  if (m instanceof VoxModel) snapped(o);
  m.add(o);
  return o;
}

/** Keeps a block square to the grid: whatever tilt it is given snaps to the nearest quarter turn. */
function snapped(mesh: THREE.Mesh): void {
  const e = mesh.rotation as unknown as {
    _onChangeCallback: () => void;
    _x: number;
    _y: number;
    _z: number;
    _onChange(cb: () => void): void;
  };
  const keep = e._onChangeCallback;
  const q = Math.PI / 2;
  e._onChange(() => {
    e._x = Math.round(e._x / q) * q;
    e._y = Math.round(e._y / q) * q;
    e._z = Math.round(e._z / q) * q;
    keep();
  });
}

export class VoxModel extends Model {
  protected override put(mesh: THREE.Mesh, at: V3): THREE.Mesh {
    mesh.userData.noBlock = true;
    snapped(mesh);
    return super.put(mesh, at);
  }

  override box(size: V3, paint: Paint, at: V3 = [0, 0, 0], _r = 0): THREE.Mesh {
    const [w, h, d] = size;
    const g = cached(`vb${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0));
    return this.put(new THREE.Mesh(g, material(paint)), at);
  }

  /** A ball is a cube of the same width (a touch smaller, so it keeps the ball's mass). */
  override ball(
    radius: number,
    paint: Paint,
    at: V3 = [0, 0, 0],
    scale: V3 = [1, 1, 1],
    _seg = 0,
  ): THREE.Mesh {
    const s = radius * 1.8;
    const g = cached(`vl${s}`, () => new THREE.BoxGeometry(s, s, s));
    const o = this.put(new THREE.Mesh(g, material(paint)), at);
    o.scale.set(...scale);
    return o;
  }

  /** A cylinder is a square prism; a cone, a stack of narrowing blocks. */
  override cyl(
    radius: number,
    h: number,
    paint: Paint,
    at: V3 = [0, 0, 0],
    top = radius,
    _seg = 0,
  ): THREE.Mesh {
    const g = cached(`vc${radius},${h},${top}`, () => prismOrSteps(radius, top, h));
    return this.put(new THREE.Mesh(g, material(paint)), at);
  }

  override part(at: V3 = [0, 0, 0], turn = 0): VoxModel {
    const m = new VoxModel();
    m.position.set(...at);
    m.rotation.y = turn;
    this.add(m);
    return m;
  }
}

/** A new blocky frame inside `parent`. */
export function vpart(parent: THREE.Object3D, at: V3 = [0, 0, 0]): VoxModel {
  const m = new VoxModel();
  m.position.set(...at);
  parent.add(m);
  return m;
}

export const isVox = (m: THREE.Object3D): m is VoxModel => m instanceof VoxModel;

/** Applies a tilt only to smooth models: blocks stay square to the grid. */
export function tilt<T extends THREE.Object3D>(m: THREE.Object3D, o: T, x = 0, y = 0, z = 0): T {
  if (!isVox(m)) o.rotation.set(x, y, z);
  return o;
}

function prismOrSteps(radius: number, top: number, h: number): THREE.BufferGeometry {
  const w = Math.max(radius, top);
  if (top >= radius * 0.8 && top <= radius * 1.25) {
    const s = Math.max(w * 1.84, 0.012);
    return new THREE.BoxGeometry(s, h, s).translate(0, h / 2, 0);
  }
  const n = Math.max(2, Math.min(5, Math.round(h / 0.055)));
  const list: Cube[] = [];
  for (let i = 0; i < n; i++) {
    const r = radius + (top - radius) * ((i + 0.5) / n);
    const s = Math.max(r * 1.84, 0.014);
    list.push([0, ((i + 0.5) * h) / n, 0, s, h / n, s]);
  }
  return boxes(list);
}

// MARK: Rings, domes, bands

/** A square ring of blocks, flat (a halo, a brim) or standing up, `R` to its centre line. */
export function boxRing(
  m: THREE.Object3D,
  p: Paint,
  R: number,
  tube: number,
  at: V3 = [0, 0, 0],
  flat = true,
): THREE.Mesh {
  const t = Math.max(tube * 2, 0.022);
  const r = R * 0.95;
  const g = cached(`vring${r},${t},${flat}`, () => {
    const a = r + t / 2;
    const l: Cube[] = [
      [0, 0, -r, 2 * a, t, t],
      [0, 0, r, 2 * a, t, t],
      [-r, 0, 0, t, t, 2 * r - t],
      [r, 0, 0, t, t, 2 * r - t],
    ];
    const g2 = boxes(l);
    if (!flat) g2.rotateX(Math.PI / 2);
    return g2;
  });
  return place(m, g, p, at);
}

/** A hollow square tube of blocks from `y` up `h`, `r` out to the wall's middle. */
export function boxBand(m: THREE.Object3D, p: Paint, r: number, h: number, y: number): THREE.Mesh {
  const t = Math.max(0.025, h * 0.5);
  const q = r * 0.92;
  const g = cached(`vband${q},${h},${t}`, () =>
    boxes([
      [0, h / 2, -q, 2 * q + t, h, t],
      [0, h / 2, q, 2 * q + t, h, t],
      [-q, h / 2, 0, t, h, 2 * q - t],
      [q, h / 2, 0, t, h, 2 * q - t],
    ]),
  );
  return place(m, g, p, [0, y, 0]);
}

/** A dome as stacked slabs, `cut` of a ball's height, narrowing upwards. A quadrant when `from`..`to` is given. */
export function stepDome(
  m: THREE.Object3D,
  p: Paint,
  r: number,
  y: number,
  cut: number,
  from = 0,
  to = Math.PI * 2,
): THREE.Mesh {
  const n = cut >= 0.4 ? 3 : 2;
  const g = cached(`vdome${r},${cut},${from},${to}`, () => {
    const list: Cube[] = [];
    const mid = (from + to) / 2;
    const quarter = to - from < Math.PI * 1.5;
    const sx = quarter ? -Math.sign(Math.cos(mid)) : 0;
    const sz = quarter ? Math.sign(Math.sin(mid)) : 0;
    for (let j = 0; j < n; j++) {
      const t0 = (Math.PI * cut * j) / n;
      const t1 = (Math.PI * cut * (j + 1)) / n;
      const y0 = r * Math.cos(t1);
      const y1 = r * Math.cos(t0);
      const half = r * Math.sin(t1);
      const w = quarter ? half : half * 2;
      list.push([(sx * half) / 2, (y0 + y1) / 2, (sz * half) / 2, w, y1 - y0, w]);
    }
    return boxes(list);
  });
  return place(m, g, p, [0, y, 0]);
}

/** A flat square lens or panel facing +z. */
export function squarePane(m: THREE.Object3D, r: number, p: Paint, at: V3): THREE.Mesh {
  const g = cached(`vpane${r}`, () => new THREE.PlaneGeometry(r * 1.8, r * 1.8));
  return place(m, g, p, at);
}

// MARK: Shapes and pixels

/** A flat shape (heart, star, wedge) rebuilt from cubes about `cell` wide, its depth along z. */
export function voxShape(
  m: THREE.Object3D,
  key: string,
  shape: THREE.Shape,
  depth: number,
  p: Paint,
  at: V3,
  cell = 0.03,
): THREE.Mesh {
  const g = cached(`vshape${key}${cell}${depth}`, () => {
    const pts = shape.getPoints(24);
    const box = new THREE.Box2().setFromPoints(pts);
    const size = box.getSize(new THREE.Vector2());
    const n = Math.max(3, Math.round(Math.max(size.x, size.y) / cell));
    const c = Math.max(size.x, size.y) / n;
    const nx = Math.max(1, Math.round(size.x / c));
    const ny = Math.max(1, Math.round(size.y / c));
    const inside = (x: number, y: number) => {
      let on = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const a = pts[i]!;
        const b = pts[j]!;
        if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) on = !on;
      }
      return on;
    };
    const centre = box.getCenter(new THREE.Vector2());
    const list: Cube[] = [];
    for (let j = 0; j < ny; j++) {
      let run = -1;
      for (let i = 0; i <= nx; i++) {
        const x = box.min.x + (i + 0.5) * (size.x / nx);
        const y = box.min.y + (j + 0.5) * (size.y / ny);
        const on = i < nx && inside(x, y);
        if (on && run < 0) run = i;
        if (!on && run >= 0) {
          const w = ((i - run) * size.x) / nx;
          list.push([
            box.min.x + (run * size.x) / nx + w / 2 - centre.x,
            box.min.y + (j + 0.5) * (size.y / ny) - centre.y,
            0,
            w,
            size.y / ny,
            Math.max(depth, 0.02),
          ]);
          run = -1;
        }
      }
    }
    return list.length ? boxes(list) : new THREE.BoxGeometry(c, c, depth);
  });
  return place(m, g, p, at);
}

const vertexToon = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toon("#fff").gradientMap });
const vertexLit = new THREE.MeshBasicMaterial({ vertexColors: true });

/**
 * A painted design as raised cubes: `draw` paints a canvas (`cw` × `ch` texels), which is read down to
 * `cols` × `rows` cubes of `cell` metres, each the commonest opaque colour in its block, standing `depth`
 * proud of z = 0 (facing +z). Neighbouring cubes of one colour merge into bars.
 */
export function pixelPatch(
  m: THREE.Object3D,
  o: {
    cols: number;
    rows: number;
    cell: number;
    depth: number;
    draw: (g: CanvasRenderingContext2D, w: number, h: number) => void;
    scale?: number;
    fill?: number;
    lit?: boolean;
    at: V3;
  },
): THREE.Mesh {
  const k = o.scale ?? 3;
  const cw = o.cols * k;
  const ch = o.rows * k;
  const c = document.createElement("canvas");
  c.width = cw;
  c.height = ch;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.imageSmoothingEnabled = false;
  o.draw(g, cw, ch);
  const data = g.getImageData(0, 0, cw, ch).data;
  const colour = new THREE.Color();
  const parts: THREE.BufferGeometry[] = [];
  const cellAt = (i: number, j: number): string | null => {
    const count = new Map<string, number>();
    let solid = 0;
    for (let y = 0; y < k; y++)
      for (let x = 0; x < k; x++) {
        const q = ((j * k + y) * cw + i * k + x) * 4;
        if (data[q + 3]! < 110) continue;
        solid++;
        const key = `${data[q]! >> 3},${data[q + 1]! >> 3},${data[q + 2]! >> 3}`;
        count.set(key, (count.get(key) ?? 0) + 1);
      }
    if (solid < k * k * (o.fill ?? 0.34)) return null;
    let best = "";
    let n = 0;
    for (const [key, v] of count) if (v > n) [best, n] = [key, v];
    const [r, gg, b] = best.split(",").map((s) => (Number(s) << 3) + 4);
    return `${r},${gg},${b}`;
  };
  for (let j = 0; j < o.rows; j++) {
    let run = -1;
    let cur: string | null = null;
    for (let i = 0; i <= o.cols; i++) {
      const col = i < o.cols ? cellAt(i, j) : null;
      if (run >= 0 && col !== cur) {
        const w = (i - run) * o.cell;
        const box = new THREE.BoxGeometry(w, o.cell, o.depth).toNonIndexed();
        box.translate(
          (run - o.cols / 2) * o.cell + w / 2,
          (o.rows - 1 - j - o.rows / 2) * o.cell + o.cell / 2,
          o.depth / 2,
        );
        const [r, gg, b] = cur!.split(",").map(Number);
        colour.setRGB(r! / 255, gg! / 255, b! / 255, THREE.SRGBColorSpace);
        const arr = new Float32Array(box.getAttribute("position").count * 3);
        for (let q = 0; q < arr.length; q += 3)
          [arr[q], arr[q + 1], arr[q + 2]] = [colour.r, colour.g, colour.b];
        box.setAttribute("color", new THREE.BufferAttribute(arr, 3));
        parts.push(box);
        run = -1;
      }
      if (col && run < 0) {
        run = i;
        cur = col;
      }
    }
  }
  const geo = parts.length ? mergeGeometries(parts)! : new THREE.BufferGeometry();
  for (const p of parts) p.dispose();
  const mesh = place(m, geo, o.lit ? vertexLit : vertexToon, o.at);
  mesh.castShadow = false;
  return mesh;
}

// MARK: Grid placement

/**
 * Blocks by cube coordinates: (x, y, z) is a box's low corner and (w, h, d) its size, all in `unit` metres,
 * relative to `origin` (which is the frame `parent` already is).
 */
export class Vx {
  constructor(
    readonly parent: VoxModel,
    readonly unit = U,
  ) {}

  b(x: number, y: number, z: number, w: number, h: number, d: number, paint: Paint): THREE.Mesh {
    const u = this.unit;
    return this.parent.box([w * u, h * u, d * u], paint, [(x + w / 2) * u, y * u, (z + d / 2) * u]);
  }

  /** A box with its own pivot at its top-centre (for hanging, swaying things). */
  hang(w: number, h: number, d: number, paint: Paint): VoxModel {
    const u = this.unit;
    const p = new VoxModel();
    p.box([w * u, h * u, d * u], paint, [0, -h * u, 0]);
    return p;
  }
}
