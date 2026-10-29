/**
 * A room on a tile grid, Habbo-style: a floor slab floating in the dark, walls on all four sides, and the
 * two between the camera and the room lowered to a skirting so you can see in. Furniture is placed by
 * tile and turn; the grid knows what's blocked, and finds walking paths round it.
 */
import * as THREE from "three";
import { C } from "../../art/palette.ts";
import type { Asset } from "../furniture/furniture.ts";
import { canvasTexture, glow, Model, painted, planks, tint, toon, wallpaper } from "../kit/kit.ts";
import { invalidateBaked } from "../perf/bake.ts";
import { wallEase } from "./walls.ts";

export type Turn = 0 | 1 | 2 | 3;
export interface Placed {
  asset: Asset;
  x: number;
  z: number;
  turn: Turn;
  model: Model;
}

const WALL_H = 2.6;
/** How thick a room's walls are: they stand just outside its floor, their inner face on its edge. */
export const WALL_T = 0.15;

/** The sky through a window, by day or night. */
const skyTexture = (night: boolean) =>
  canvasTexture(8, 16, (g) => {
    const s = g.createLinearGradient(0, 0, 0, 16);
    s.addColorStop(0, night ? "#151a33" : "#7cc2f0");
    s.addColorStop(1, night ? "#2d2f5e" : "#d3eefc");
    g.fillStyle = s;
    g.fillRect(0, 0, 8, 16);
    g.fillStyle = night ? "#fbf7ef" : "#ffffff";
    // Two stars, or a cloud.
    for (const [x, y, w] of night
      ? [
          [5, 3, 1],
          [2, 7, 1],
        ]
      : [
          [1, 4, 4],
          [2, 3, 2],
        ])
      g.fillRect(x!, y!, w!, 1);
  });
const DAY_SKY = glow("#fff", skyTexture(false));
const NIGHT_SKY = glow("#fff", skyTexture(true));
const windows: THREE.Mesh[] = [];

const isNight = false;

/** A window on a wall's inner face; `at` is its bottom centre. */
function windowOn(wall: Model, x: number): void {
  const w = wall.part([x, 1.2, WALL_T / 2 + 0.01]);
  const pane = w.plane(0.9, 0.85, isNight ? NIGHT_SKY : DAY_SKY, [0, 0.45, 0]);
  pane.userData.nightGlow = { mesh: pane, day: DAY_SKY, night: NIGHT_SKY };
  windows.push(pane);
  w.box([1.02, 0.07, 0.07], C.white, [0, -0.04, 0], 0.015);
  w.box([1.02, 0.07, 0.05], C.white, [0, 0.86, 0], 0.015);
  for (const s of [-1, 0, 1]) w.box([0.06, 0.88, 0.05], C.white, [s * 0.48, 0.01, 0], 0.012);
  w.box([0.96, 0.04, 0.04], C.white, [0, 0.43, 0]);
  w.box([1.2, 0.05, 0.16], C.white, [0, -0.08, 0.05], 0.015);
  for (const s of [-1, 1]) w.box([0.22, 1.0, 0.04], "#6d7fc4", [s * 0.6, -0.08, 0.04], 0.02);
  w.box([1.4, 0.04, 0.06], C.woodDark, [0, 1.0, 0.04]);
}

function doorOn(wall: Model, x: number): void {
  const d = wall.part([x, 0, WALL_T / 2 + 0.01]);
  d.box([0.95, 2.05, 0.06], C.white, [0, 0, 0], 0.02);
  d.box([0.8, 1.95, 0.05], C.woodDark, [0, 0, 0.02], 0.02);
  for (const y of [0.2, 1.1]) d.box([0.6, 0.7, 0.02], C.wood, [0, y, 0.045], 0.02);
  d.ball(0.04, "#e9b73d", [0.3, 1.0, 0.09]);
}

export class Room {
  readonly group = new THREE.Group();
  readonly placed: Placed[] = [];
  private grid: (Placed | null)[];
  private walls: { model: Model; normal: THREE.Vector3; low?: boolean }[] = [];
  /** The floor slab and walls, rebuilt whenever the size or the decor changes. */
  private shell = new THREE.Group();
  private shellWindows: THREE.Mesh[] = [];
  private look: {
    floor: THREE.Texture;
    floorSpan: number;
    floorColor: string;
    wall: THREE.Texture;
    wallSpan: number;
  };

  constructor(
    public W: number,
    public D: number,
    private readonly opts: {
      bare?: boolean;
      floor?: string;
      wall?: string;
      stripe?: string;
      /** Window x on the north wall, its door's x (null: no door), and window z on the west wall. */
      north?: number[];
      door?: number | null;
      west?: number[];
      /** An opening in the north wall, from x to x + width (a passage through to somewhere else). */
      gap?: [number, number];
    } = {},
  ) {
    this.grid = Array(W * D).fill(null);
    this.look = {
      floor: planks(this.opts.floor ?? C.floor, 4),
      floorSpan: 4,
      floorColor: this.opts.floor ?? C.floor,
      wall: wallpaper(this.opts.wall ?? C.wall, this.opts.stripe ?? C.wallDark),
      wallSpan: 1,
    };
    this.group.add(this.shell);
    this.build();
  }

  /** Re-skins the room: a floor texture (`span` tiles per repeat) and/or a wall one. Furniture stays. */
  setDecor(d: {
    floor?: { texture: THREE.Texture; span: number; color: string };
    wall?: { texture: THREE.Texture; span: number };
  }): void {
    if (d.floor) {
      this.look.floor = d.floor.texture;
      this.look.floorSpan = d.floor.span;
      this.look.floorColor = d.floor.color;
    }
    if (d.wall) {
      this.look.wall = d.wall.texture;
      this.look.wallSpan = d.wall.span;
    }
    this.build();
  }

  /** Grows or shrinks the room to `W`x`D` tiles. Furniture that no longer fits is hidden, and comes back if it does again. */
  resize(W: number, D: number): void {
    this.W = W;
    this.D = D;
    this.grid = Array(W * D).fill(null);
    for (const p of this.placed) {
      const [w, d] = Room.footprint(p.asset, p.turn);
      const fits = this.inside(p.x, p.z) && this.inside(p.x + w - 1, p.z + d - 1);
      p.model.visible = fits;
      if (!fits) continue;
      for (let i = 0; i < w; i++)
        for (let j = 0; j < d; j++) {
          const cell = (p.z + j) * W + p.x + i;
          if (p.asset.id !== "rug" || !this.grid[cell]) this.grid[cell] = p;
        }
    }
    this.build();
  }

  private build(): void {
    const { W, D } = this;
    // The static batching holds copies of the old shell: let it go (and batch the new one).
    invalidateBaked(this.group);
    this.shell.removeFromParent();
    this.shell.traverse((o) => {
      if (o instanceof THREE.Mesh && o.geometry instanceof THREE.BoxGeometry) o.geometry.dispose();
    });
    for (const w of this.shellWindows) {
      const i = windows.indexOf(w);
      if (i >= 0) windows.splice(i, 1);
    }
    this.shellWindows = [];
    this.shell = new THREE.Group();
    this.group.add(this.shell);
    this.walls = [];

    const floor = this.look.floor.clone();
    floor.repeat.set(W / this.look.floorSpan, D / this.look.floorSpan);
    floor.needsUpdate = true;
    const side = toon(tint(this.look.floorColor, -0.35));
    const slab = new THREE.Mesh(new THREE.BoxGeometry(W, 0.35, D), [
      side,
      side,
      painted(floor),
      side,
      side,
      side,
    ]);
    slab.position.set(W / 2, -0.175, D / 2);
    slab.receiveShadow = true;
    this.shell.add(slab);

    const paper = this.look.wall;
    const wall = (length: number, at: [number, number], turn: number, normal: [number, number]) => {
      const m = new Model();
      m.position.set(at[0], 0, at[1]);
      m.rotation.y = turn;
      const tex = paper.clone();
      tex.repeat.set(length / this.look.wallSpan, 1);
      tex.needsUpdate = true;
      const face = m.box([length, WALL_H, WALL_T], painted(tex), [0, 0, 0], 0);
      face.castShadow = false;
      m.box([length + 0.02, 0.12, WALL_T + 0.04], C.woodDark, [0, 0, 0.01], 0.01);
      m.box([length + 0.04, 0.08, WALL_T + 0.06], C.wallTop, [0, WALL_H, 0], 0.01);
      this.shell.add(m);
      m.userData.rigid = true;
      this.walls.push({ model: m, normal: new THREE.Vector3(normal[0], 0, normal[1]) });
      return m;
    };
    const gap = this.opts.gap;
    let north: Model;
    if (gap) {
      // Two pieces of wall, the opening between them.
      const [g0, g1] = [gap[0], gap[0] + gap[1]];
      north = wall(g0 + WALL_T, [(g0 - WALL_T) / 2, -WALL_T / 2], 0, [0, 1]);
      wall(W + WALL_T - g1, [(g1 + W + WALL_T) / 2, -WALL_T / 2], 0, [0, 1]);
    } else north = wall(W + WALL_T * 2, [W / 2, -WALL_T / 2], 0, [0, 1]);
    const west = wall(D, [-WALL_T / 2, D / 2], Math.PI / 2, [1, 0]);
    wall(W + WALL_T * 2, [W / 2, D + WALL_T / 2], Math.PI, [0, -1]);
    wall(D, [W + WALL_T / 2, D / 2], -Math.PI / 2, [-1, 0]);
    // Windows and the door, in each wall's own coordinates (x along it, from its centre).
    if (this.opts.bare) return;
    const before = windows.length;
    const o = this.opts;
    for (const x of o.north ?? [3, 10.5]) windowOn(north, x - W / 2);
    if (o.door !== null) doorOn(north, (o.door ?? 7.5) - W / 2);
    for (const z of o.west ?? [5.5, 8.5]) windowOn(west, D / 2 - z);
    this.shellWindows = windows.slice(before);
  }

  /** Lowers the walls between the camera and the room; `view` points from the room to the camera. */
  facing(view: THREE.Vector3): void {
    for (const w of this.walls) {
      const front = w.low || w.normal.dot(view) < -0.01;
      const target = front ? 0.06 : 1;
      w.model.scale.y += (target - w.model.scale.y) * wallEase.k;
      w.model.visible = w.model.scale.y > 0.02;
    }
  }

  /**
   * Hangs `o` on the wall with this normal (as `[x, z]`), where it already stands: it is lowered and raised with the
   * wall (a doorway in it, say), instead of standing at full height when the wall goes down in front of the camera.
   */
  attachToWall(normal: [number, number], o: THREE.Object3D): void {
    const w = this.walls.find((q) => q.normal.x === normal[0] && q.normal.z === normal[1]);
    if (!w) return;
    this.group.updateMatrixWorld(true);
    w.model.attach(o);
  }

  /** Keeps the wall with this normal (as `[x, z]`) lowered whatever the camera does: a cutaway while someone is behind it. */
  cutaway(normal: [number, number], on: boolean): void {
    for (const w of this.walls) if (w.normal.x === normal[0] && w.normal.z === normal[1]) w.low = on;
  }

  static footprint(asset: Asset, turn: Turn): [number, number] {
    return turn % 2 ? [asset.d, asset.w] : [asset.w, asset.d];
  }

  at(x: number, z: number): Placed | null {
    if (x < 0 || z < 0 || x >= this.W || z >= this.D) return null;
    return this.grid[z * this.W + x]!;
  }

  inside(x: number, z: number): boolean {
    return x >= 0 && z >= 0 && x < this.W && z < this.D;
  }

  /** Whether you can walk on (`x`, `z`): rugs are flat. */
  open(x: number, z: number): boolean {
    if (!this.inside(x, z)) return false;
    const p = this.grid[z * this.W + x];
    return !p || p.asset.id === "rug";
  }

  fits(asset: Asset, x: number, z: number, turn: Turn): boolean {
    const [w, d] = Room.footprint(asset, turn);
    for (let i = 0; i < w; i++)
      for (let j = 0; j < d; j++) {
        if (!this.inside(x + i, z + j)) return false;
        const p = this.grid[(z + j) * this.W + x + i];
        if (p && p.asset.id !== "rug" && asset.id !== "rug") return false;
        if (p && p.asset.id === "rug" && asset.id === "rug") return false;
      }
    return true;
  }

  place(asset: Asset, x: number, z: number, turn: Turn = 0, model = asset.build()): Placed {
    const [w, d] = Room.footprint(asset, turn);
    model.position.set(x + w / 2, 0, z + d / 2);
    model.rotation.y = (turn * Math.PI) / 2;
    this.group.add(model);
    const p: Placed = { asset, x, z, turn, model };
    this.placed.push(p);
    for (let i = 0; i < w; i++)
      for (let j = 0; j < d; j++) {
        const cell = (z + j) * this.W + x + i;
        // A rug stays under whatever is put on it.
        if (asset.id !== "rug" || !this.grid[cell]) this.grid[cell] = p;
      }
    return p;
  }

  /**
   * Places a piece that is turned `rot` quarter turns clockwise (F) on top of its own `turn`, over the `tiles` map tiles
   * from (`x`, `z`): along its row, or down its column when it is turned sideways, so what is drawn and what blocks
   * the way are the tiles the map says.
   */
  placeTurned(
    asset: Asset,
    x: number,
    z: number,
    turn: Turn,
    rot: number,
    tiles: number,
    model = asset.build(),
  ): Placed {
    const quarter = (((turn - rot) % 4) + 4) % 4;
    if (rot % 2 === 0) return this.place(asset, x, z, quarter as Turn, model);
    // Lying down its column: centred on its `tiles` map tiles, whatever depth its art has.
    model.position.set(x + 0.5, 0, z + tiles / 2);
    model.rotation.y = (quarter * Math.PI) / 2;
    this.group.add(model);
    const p: Placed = { asset, x, z, turn: quarter as Turn, model };
    this.placed.push(p);
    for (let j = 0; j < tiles; j++) {
      const cell = (z + j) * this.W + x;
      if (asset.id !== "rug" || !this.grid[cell]) this.grid[cell] = p;
    }
    return p;
  }

  /** Something hung on a wall: `x` along the north wall, `y` up it. */
  hang(model: Model, x: number, y: number): void {
    model.position.set(x, y, 0.01);
    this.group.add(model);
  }

  /** Where a seat's sitter goes, and which way they face. */
  seatOf(p: Placed): { at: THREE.Vector3; turn: number } | null {
    if (!p.asset.seat) return null;
    p.model.updateMatrixWorld();
    return {
      at: p.model.localToWorld(new THREE.Vector3(...p.asset.seat.at)),
      turn: p.model.rotation.y + p.asset.seat.turn,
    };
  }

  bedOf(p: Placed): { at: THREE.Vector3; turn: number } | null {
    if (!p.asset.bed) return null;
    p.model.updateMatrixWorld();
    return { at: p.model.localToWorld(new THREE.Vector3(...p.asset.bed)), turn: p.model.rotation.y };
  }

  /** The shortest walk from one tile to another (8 ways, no cutting corners), or null. `goal` may be a seat. */
  path(from: [number, number], goal: [number, number]): [number, number][] | null {
    const key = (x: number, z: number) => z * this.W + x;
    const prev = new Map<number, number>([[key(...from), -1]]);
    const queue: [number, number][] = [from];
    const target = key(...goal);
    while (queue.length) {
      const [x, z] = queue.shift()!;
      if (key(x, z) === target) break;
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ] as const) {
        const nx = x + dx;
        const nz = z + dz;
        const k = key(nx, nz);
        if (!this.inside(nx, nz) || prev.has(k)) continue;
        if (!this.open(nx, nz) && k !== target) continue;
        if (dx && dz && (!this.open(x + dx, z) || !this.open(x, z + dz))) continue;
        prev.set(k, key(x, z));
        queue.push([nx, nz]);
      }
    }
    if (!prev.has(target)) return null;
    const out: [number, number][] = [];
    for (let k = target; k !== -1; k = prev.get(k)!) out.unshift([k % this.W, Math.floor(k / this.W)]);
    return out;
  }
}
