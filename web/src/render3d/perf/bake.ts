import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { blockMoves, blockStandIn } from "../kit/blocky.ts";
import { ticks } from "../kit/kit.ts";
import { isPropsNight, type NightGlow, onPropsNight } from "../town/props.ts";
import { type Atlas, atlasable, packAtlas, remapUv, syncAtlas, uvInside } from "./atlas.ts";
import type { DetailRange } from "./details.ts";

/**
 * Static batching. A room is hundreds to thousands of tiny meshes (a tree is a trunk and five balls), each its
 * own draw call, twice over once the shadow pass counts. `bakeStatic` folds everything that never moves into a
 * handful of merged meshes (per material and ~12 tile cell, so frustum culling still works), hides the
 * originals and keeps them as the source of truth. Anything that animates is found by running the kit's tick
 * functions at a few times and comparing world matrices, and stays live; so does whatever the builders flag
 * with `userData.live = true` (night swaps, walls that lower, anything a caller keeps a handle to).
 *
 * Two variants are kept per layer: the smooth meshes, and the blocky ones the Voxel style swaps in (see
 * `blocky.ts`), built on first use. `syncBaked` flips between them, so there is no per-frame traversal.
 */

export type BakeMode = "smooth" | "block";

/** Set on an object (or anything above it) to keep it out of the batches. */
export const LIVE = "live";
/**
 * Set on an object that moves as a whole (a wall that lowers) but whose insides are fixed relative to it: it
 * is batched on its own, in its own space, and the batch rides along.
 */
export const RIGID = "rigid";
/** Set on a room's root: `bakeScene` batches it. */
export const BAKE = "bake";

const cellSize = (): number => Number((globalThis as { __bakeCell?: number }).__bakeCell ?? 8);
/** The times (s) `sampleTicks` runs the tick functions and a root's `userData.sample` at. */
export const SAMPLE_TIMES = [0.37, 3.91, 11.3, 29.77];

/** `?nobake` turns batching off (to compare pictures, or to see what it costs). */
const disabled = typeof location !== "undefined" && new URLSearchParams(location.search).has("nobake");

/**
 * Merged static batches sit on this layer (and only this one): the baked shadow map draws just that layer, the small
 * per-frame one draws the default layer (everything that moves or was never merged). The camera sees both.
 */
export const STATIC_LAYER = 2;
let shadowEpoch = 0;
/** Bumps whenever the set of static shadow casters changed (a room was batched, dropped or invalidated). */
export const staticShadowEpoch = (): number => shadowEpoch;
export const bumpStaticShadow = (): void => void shadowEpoch++;

let epoch = 0;
/** Bumps whenever anything is added to or removed from an object: cheap way to know the scene graph may have changed. */
export const sceneEpoch = (): number => epoch;
let patched = false;
export function trackAdditions(): void {
  if (patched) return;
  patched = true;
  // A sleeping subtree (the hidden originals of a batch) is not walked for matrices at all: nothing in it moves.
  const update = THREE.Object3D.prototype.updateMatrixWorld;
  THREE.Object3D.prototype.updateMatrixWorld = function (this: THREE.Object3D, force?: boolean) {
    if ((this as { asleep?: boolean }).asleep === true) return;
    update.call(this, force);
  };
  const add = THREE.Object3D.prototype.add;
  THREE.Object3D.prototype.add = function (this: THREE.Object3D, ...objs: THREE.Object3D[]) {
    epoch++;
    return add.apply(this, objs);
  };
  const remove = THREE.Object3D.prototype.remove;
  THREE.Object3D.prototype.remove = function (this: THREE.Object3D, ...objs: THREE.Object3D[]) {
    epoch++;
    return remove.apply(this, objs);
  };
}

export interface BakeStats {
  sources: number;
  live: number;
  merged: Record<BakeMode, { meshes: number; triangles: number } | undefined>;
}

/** Batches of something that moves as a whole (a wall, a limb) stay on the default layer: they cast their own shadow every frame. */
function dynamicRoot(root: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = root; p; p = p.parent)
    if (p.userData[RIGID] || p.userData.actor) return true;
  return false;
}

function isLive(o: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) {
    if (p.userData[LIVE] || p.userData.nobatch || p.userData.noBake || (p !== root && p.userData[RIGID]))
      return true;
    if (p === root) break;
  }
  return false;
}

function hiddenAbove(o: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) {
    if (p !== root && !p.visible) return true;
    if (p === root) break;
  }
  return false;
}

function bakeable(m: THREE.Mesh, literal = false): boolean {
  const mat = m.material;
  if (Array.isArray(mat) || (mat as THREE.Material).userData.dynamic) return false;
  if ((m as THREE.InstancedMesh).isInstancedMesh || (m as THREE.SkinnedMesh).isSkinnedMesh) return false;
  if (m.renderOrder !== 0 || m.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender) return false;
  const g = m.geometry;
  return (
    !!g.getAttribute("position") &&
    g.getAttribute("position").count > 0 &&
    !g.morphAttributes.position &&
    (literal || !blockMoves(m))
  );
}

const tex = (t: THREE.Texture | null | undefined): string =>
  t ? `${t.uuid}:${t.offset.x},${t.offset.y},${t.repeat.x},${t.repeat.y},${t.rotation}` : "-";

type Lit = THREE.MeshToonMaterial & { flatShading?: boolean; fog?: boolean };

/** Plain colour materials (no texture, no glow tricks) fold into one material per kind; their colour moves to the vertices. */
function foldable(m: THREE.Material): boolean {
  const a = m as Lit;
  if (m.type !== "MeshToonMaterial" && m.type !== "MeshBasicMaterial") return false;
  if (a.map || m.alphaTest || (m.opacity !== 1 && !m.transparent) || a.vertexColors) return false;
  return !a.emissive || a.emissive.getHex() === 0;
}

/** Two materials that look the same share a batch. */
function matKey(m: THREE.Material, atlased = false): string {
  const a = m as Lit;
  const fold = foldable(m);
  return [
    m.type,
    fold ? "vc" : (a.color?.getHexString() ?? ""),
    atlased ? "atlas" : tex(a.map),
    tex(a.gradientMap),
    a.emissive?.getHexString() ?? "",
    m.side,
    m.opacity,
    m.transparent ? 1 : 0,
    a.flatShading ? 1 : 0,
    m.alphaTest,
    a.vertexColors ? 1 : 0,
    a.fog ? 1 : 0,
    m.depthWrite ? 1 : 0,
  ].join("|");
}

/** The shared vertex-coloured stand-in for a folded material. */
function folded(m: THREE.Material): THREE.Material {
  const a = m as Lit;
  const c = m.clone() as Lit;
  c.vertexColors = true;
  c.color.set(0xffffff);
  c.userData.baked = true;
  // A snow or tint shader the scene taught the original keeps working on the batch.
  c.onBeforeCompile = m.onBeforeCompile;
  c.customProgramCacheKey = m.customProgramCacheKey;
  if (a.gradientMap) (c as THREE.MeshToonMaterial).gradientMap = a.gradientMap;
  return c;
}

function matState(m: THREE.Material): string {
  return `${matKey(m)}|${m.visible}`;
}

const tmp = new THREE.Matrix4();
const inv = new THREE.Matrix4();

interface Snap {
  m: Float32Array;
  state: string[];
}

function snapshot(root: THREE.Object3D, meshes: THREE.Mesh[]): Snap {
  root.updateMatrixWorld(true);
  const m = new Float32Array(meshes.length * 16);
  const state: string[] = [];
  // Relative to the root: a rigid root (a wall) may itself move, what is inside must not.
  inv.copy(root.matrixWorld).invert();
  meshes.forEach((mesh, i) => {
    m.set(tmp.multiplyMatrices(inv, mesh.matrixWorld).elements, i * 16);
    // A night glow's swap of materials is batched as a day and a night copy (`layerOf`): sampling the hours must not
    // count it as moving, or every lamp and window in town stays out of the batches.
    const glow = mesh.userData.nightGlow as NightGlow | undefined;
    state.push(`${mesh.visible}|${matState(glow ? glow.day : (mesh.material as THREE.Material))}`);
  });
  return { m, state };
}

function noteMoved(a: Snap, b: Snap, moved: Set<number>): void {
  for (let i = 0; i < a.state.length; i++) {
    if (moved.has(i)) continue;
    if (a.state[i] !== b.state[i]) {
      moved.add(i);
      continue;
    }
    for (let k = i * 16; k < i * 16 + 16; k++)
      if (a.m[k] !== b.m[k]) {
        moved.add(i);
        break;
      }
  }
}

/** Runs every tick function at a few times and notes what they move (world matrices, materials). */
function sampleTicks(root: THREE.Object3D, meshes: THREE.Mesh[], moved: Set<number>): void {
  const base = snapshot(root, meshes);
  // Something above may animate its parts by its own means (an avatar's gear moves when it walks): it says how to sample that.
  let sample: ((t: number) => void) | undefined;
  for (let p: THREE.Object3D | null = root; p && !sample; p = p.parent)
    sample = p.userData.sample as typeof sample;
  if (sample)
    for (const t of SAMPLE_TIMES) {
      try {
        sample(t);
      } catch {
        /* a model torn down */
      }
      noteMoved(base, snapshot(root, meshes), moved);
    }
  for (const t of SAMPLE_TIMES) {
    for (const tick of ticks) {
      try {
        ((tick as { raw?: (t: number) => void }).raw ?? tick)(t);
      } catch {
        /* a tick that belongs to something torn down */
      }
    }
    noteMoved(base, snapshot(root, meshes), moved);
  }
}

function prepared(
  src: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
  color?: THREE.Color,
): THREE.BufferGeometry {
  const g = src.clone();
  for (const k of Object.keys(g.attributes))
    if (k !== "position" && k !== "normal" && k !== "uv" && !(k === "color" && !color)) g.deleteAttribute(k);
  if (!g.getAttribute("uv")) {
    g.setAttribute(
      "uv",
      new THREE.BufferAttribute(new Float32Array(g.getAttribute("position").count * 2), 2),
    );
  }
  if (!g.getAttribute("normal")) g.computeVertexNormals();
  g.clearGroups();
  if (color) {
    const n = g.getAttribute("position").count;
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      c[i * 3] = color.r;
      c[i * 3 + 1] = color.g;
      c[i * 3 + 2] = color.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(c, 3));
  }
  g.applyMatrix4(matrix);
  // The source piece's middle, for the see-through cut (`engine/seethrough.ts`): it decides per piece, not per pixel.
  g.computeBoundingBox();
  const at = g.boundingBox!.getCenter(new THREE.Vector3());
  const n = g.getAttribute("position").count;
  const seeAt = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) seeAt.set([at.x, at.y, at.z, 2], i * 4);
  g.setAttribute("seeAt", new THREE.BufferAttribute(seeAt, 4));
  if (matrix.determinant() < 0) {
    // A mirrored copy turns inside out: flip the winding.
    if (g.index) {
      const ix = g.index.array as Uint16Array | Uint32Array;
      for (let i = 0; i < ix.length; i += 3) {
        const t = ix[i + 1]!;
        ix[i + 1] = ix[i + 2]!;
        ix[i + 2] = t;
      }
    } else {
      for (const a of Object.values(g.attributes) as THREE.BufferAttribute[]) {
        const n = a.itemSize;
        const arr = a.array as Float32Array;
        for (let i = 0; i < a.count; i += 3)
          for (let k = 0; k < n; k++) {
            const t = arr[(i + 1) * n + k]!;
            arr[(i + 1) * n + k] = arr[(i + 2) * n + k]!;
            arr[(i + 2) * n + k] = t;
          }
      }
    }
  }
  return g;
}

interface Source {
  mesh: THREE.Mesh;
  key: string;
  cell: string;
  material: THREE.Material;
  /** The mesh's matrix relative to the root, when it was batched. */
  local: THREE.Matrix4;
  /** Set when the colour goes into the vertices. */
  color?: THREE.Color;
  /** A lamp or window that glows at night: one source per state, only the current one shows. */
  glow?: "day" | "night";
}

/** Frozen models: one variant, built from the geometry the meshes have right now (the Voxel swap already happened). */
interface LayerOptions {
  literal?: boolean;
}

export class BakedLayer {
  readonly group = new THREE.Group();
  mode: BakeMode | null = null;
  private readonly variants: Partial<Record<BakeMode, THREE.Group>> = {};
  private sources: Source[] = [];
  liveCount = 0;
  private sealed = false;
  /** Subtrees made of nothing but batched meshes: switched off for the scene graph walks (see `seal`). */
  private readonly sleeping: THREE.Object3D[] = [];

  private offNight?: () => void;

  constructor(
    readonly root: THREE.Object3D,
    sources: Source[],
    private readonly options: LayerOptions = {},
  ) {
    this.sources = sources;
    if (sources.some((s) => s.glow)) this.offNight = onPropsNight((on) => this.setNight(on));
    this.group.name = "baked";
    this.group.matrixAutoUpdate = false;
    this.group.userData.noBake = true;
    this.group.userData.onDispose = () => this.dispose();
    root.add(this.group);
  }

  /** The static shadow map is stale, unless this batch belongs to something that moves (those cast their own shadow). */
  private bump(): void {
    if (!dynamicRoot(this.root)) shadowEpoch++;
  }

  get sourceMeshes(): THREE.Mesh[] {
    return this.sources.map((s) => s.mesh);
  }

  /** Lamps and windows: the day copies or the night copies. */
  setNight(on: boolean): void {
    for (const v of Object.values(this.variants))
      for (const c of v!.children) {
        const g = c.userData.glow as string | undefined;
        if (g) c.visible = g === (on ? "night" : "day");
      }
  }

  /** Shows the variant for `mode`, building it the first time. */
  show(mode: BakeMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    let v = this.variants[mode];
    if (!v) {
      v = this.build(mode);
      this.variants[mode] = v;
      this.group.add(v);
      this.bump();
      // Placed once: only a move of the room itself (a forced update) touches them again.
      this.group.updateMatrixWorld(true);
      // Batches of something that moves (an avatar's limb, a wall) ride along with it.
      if (!dynamicRoot(this.root)) for (const c of v.children) c.matrixWorldAutoUpdate = false;
    }
    for (const [m, g] of Object.entries(this.variants)) g!.visible = m === mode;
    this.bump();
    // Sources a variant left out keep drawing themselves, the rest are hidden behind the merged copy.
    if (!this.sealed) this.seal();
  }

  /**
   * The originals are out of the picture for good: hide them, and put the subtrees that hold nothing else to
   * sleep (no matrix updates, skipped by the draw-list walk), so a room of thousands of nodes costs a few hundred.
   */
  private seal(): void {
    this.sealed = true;
    const own = new Set(this.sources.map((s) => s.mesh));
    for (const m of own) {
      m.visible = false;
      m.userData.bakedSource = true;
    }
    const quiet = new Map<THREE.Object3D, boolean>();
    const isQuiet = (o: THREE.Object3D): boolean => {
      let q = quiet.get(o);
      if (q !== undefined) return q;
      if (o === this.group) q = false;
      else if ((o as THREE.Mesh).isMesh) q = own.has(o as THREE.Mesh);
      else if (
        o.userData[LIVE] ||
        o.userData.noBake ||
        (o as THREE.Light).isLight ||
        (o as THREE.Sprite).isSprite
      )
        q = false;
      else q = o.children.every(isQuiet);
      quiet.set(o, q);
      return q;
    };
    const sleep = (o: THREE.Object3D) => {
      for (const c of o.children) {
        if (c === this.group) continue;
        if (isQuiet(c)) {
          c.matrixAutoUpdate = false;
          c.matrixWorldAutoUpdate = false;
          c.visible = false;
          (c as { asleep?: boolean }).asleep = true;
          this.sleeping.push(c);
        } else sleep(c);
      }
    };
    this.root.updateMatrixWorld(true);
    sleep(this.root);
  }

  stats(): BakeStats {
    const of = (m: BakeMode) => {
      const v = this.variants[m];
      if (!v) return undefined;
      let tris = 0;
      for (const c of v.children) {
        const g = (c as THREE.Mesh).geometry;
        tris += (g.index ? g.index.count : g.getAttribute("position").count) / 3;
      }
      return { meshes: v.children.length, triangles: tris };
    };
    return {
      sources: this.sources.length,
      live: this.liveCount,
      merged: { smooth: of("smooth"), block: of("block") },
    };
  }

  private readonly atlases: Atlas[] = [];

  get hasPictures(): boolean {
    return this.atlases.length > 0;
  }

  private build(mode: BakeMode): THREE.Group {
    const out = new THREE.Group();
    out.matrixAutoUpdate = false;
    const groups = new Map<
      string,
      {
        parts: { geometry: THREE.BufferGeometry; detail: number }[];
        mat: THREE.Material;
        cast: boolean;
        recv: boolean;
        glow?: "day" | "night";
      }
    >();
    const items = this.sources.map((s) => {
      const m = s.mesh;
      const geo = (mode === "block" && !this.options.literal ? blockStandIn(m) : null) ?? m.geometry;
      return { s, geo, atlased: false };
    });
    // Small painted textures share one atlas (and so one batch per material setup).
    const pictures = items.filter(({ s, geo }) => atlasable((s.material as Lit).map) && uvInside(geo));
    const atlas = packAtlas(pictures.map(({ s }) => (s.material as Lit).map as THREE.Texture));
    if (atlas) {
      this.atlases.push(atlas);
      for (const it of pictures) it.atlased = atlas.rects.has((it.s.material as Lit).map as THREE.Texture);
    }
    const atlasMats = new Map<string, THREE.Material>();
    for (const { s, geo, atlased } of items) {
      const m = s.mesh;
      tmp.copy(s.local);
      let key = `${s.key}|${m.castShadow ? 1 : 0}${m.receiveShadow ? 1 : 0}|${s.cell}${s.glow ? `|${s.glow}` : ""}`;
      let material = s.material;
      if (atlased && atlas) {
        const shade = matKey(s.material, true);
        key = `${shade}|${m.castShadow ? 1 : 0}${m.receiveShadow ? 1 : 0}|${s.cell}${s.glow ? `|${s.glow}` : ""}|atlas`;
        let am = atlasMats.get(shade);
        if (!am) {
          am = s.material.clone();
          (am as Lit).map = atlas.texture;
          am.userData.baked = true;
          am.onBeforeCompile = s.material.onBeforeCompile;
          am.customProgramCacheKey = s.material.customProgramCacheKey;
          atlasMats.set(shade, am);
        }
        material = am;
      }
      let grp = groups.get(key);
      if (!grp) {
        grp = { parts: [], mat: material, cast: m.castShadow, recv: m.receiveShadow, glow: s.glow };
        groups.set(key, grp);
      }
      const part = prepared(geo, tmp, s.color);
      if (atlased && atlas) remapUv(part, atlas.rects.get((s.material as Lit).map as THREE.Texture)!, atlas);
      const scale = new THREE.Vector3().setFromMatrixScale(tmp);
      const detail = (m.userData.detailSize as number | undefined) ?? 0;
      grp.parts.push({ geometry: part, detail: detail * Math.min(scale.x, scale.y, scale.z) });
    }
    for (const [key, grp] of groups) {
      grp.parts.sort((a, b) => {
        if (a.detail === b.detail) return 0;
        return (b.detail || Infinity) - (a.detail || Infinity);
      });
      const indexed = grp.parts.every((p) => p.geometry.index);
      const flat = grp.parts.map(({ geometry }) =>
        indexed || !geometry.index ? geometry : geometry.toNonIndexed(),
      );
      const ranges: DetailRange[] = [];
      let end = 0;
      for (let i = 0; i < flat.length; i++) {
        const geometry = flat[i]!;
        end += geometry.index?.count ?? geometry.getAttribute("position").count;
        const size = grp.parts[i]!.detail;
        const last = ranges.at(-1);
        if (last && last.size === size) last.end = end;
        else ranges.push({ size, end });
      }
      const merged = mergeGeometries(flat, false);
      for (let i = 0; i < flat.length; i++) {
        flat[i]!.dispose();
        if (flat[i] !== grp.parts[i]!.geometry) grp.parts[i]!.geometry.dispose();
      }
      if (!merged) continue;
      merged.computeBoundingBox();
      const mesh = new THREE.Mesh(merged, grp.mat);
      if (ranges.some((r) => r.size > 0)) mesh.userData.detailRanges = ranges;
      if (grp.mat.transparent) {
        // Blended things are drawn back to front by where their object sits: put the batch in the middle of what it holds.
        const c = merged.boundingBox!.getCenter(new THREE.Vector3());
        merged.translate(-c.x, -c.y, -c.z);
        merged.computeBoundingBox();
        mesh.position.copy(c);
        mesh.updateMatrix();
      }
      merged.computeBoundingSphere();
      mesh.castShadow = grp.cast;
      mesh.receiveShadow = grp.recv;
      mesh.matrixAutoUpdate = false;
      mesh.name = `baked:${key.split("|").slice(0, 2).join(":")}`;
      if (grp.glow) {
        mesh.userData.glow = grp.glow;
        mesh.visible = grp.glow === (isPropsNight() ? "night" : "day");
      }
      mesh.userData.noBake = true;
      if (!dynamicRoot(this.root)) mesh.layers.set(STATIC_LAYER);
      out.add(mesh);
    }
    return out;
  }

  disposed = false;

  /** Pictures in this layer's atlases that were repainted since (a board updated by the game) are painted in again. */
  syncPictures(): void {
    for (const a of this.atlases) {
      syncAtlas(a);
      // One that keeps changing (a screen the warm-up never saw move) is taken out of the atlas for good.
      if (a.repaints > 24) {
        for (const t of a.rects.keys())
          if (a.seen.get(t) !== undefined && t.version > 2) t.userData.animated = true;
        a.repaints = 0;
        invalidateBaked(this.root);
        return;
      }
    }
  }

  /** Puts the originals back in the picture and hides the merged copy (it keeps its geometry for `resume`). */
  suspend(): void {
    this.bump();
    for (const v of Object.values(this.variants)) v!.visible = false;
    this.unseal();
    this.mode = null;
  }

  /** Hides the originals again behind the kept merged copy. */
  resume(mode: BakeMode): void {
    if (this.disposed) return;
    this.show(mode);
  }

  private unseal(): void {
    this.sealed = false;
    for (const o of this.sleeping) {
      (o as { asleep?: boolean }).asleep = false;
      o.matrixAutoUpdate = true;
      o.matrixWorldAutoUpdate = true;
      o.visible = true;
    }
    this.sleeping.length = 0;
    for (const s of this.sources) {
      s.mesh.visible = true;
      s.mesh.userData.bakedSource = false;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    frozen.delete(this);
    this.bump();
    const materials = new Set<THREE.Material>();
    for (const v of Object.values(this.variants)) {
      for (const c of v!.children) {
        const mesh = c as THREE.Mesh;
        mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material;
        if (mat.userData.baked) materials.add(mat);
      }
    }
    for (const s of this.sources) if (s.material.userData.baked) materials.add(s.material);
    for (const mat of materials) mat.dispose();
    this.group.removeFromParent();
    this.offNight?.();
    for (const a of this.atlases) a.texture.dispose();
    this.atlases.length = 0;
    this.unseal();
  }
}

function collect(root: THREE.Object3D): {
  meshes: THREE.Mesh[];
  why: Record<string, number>;
  rigids: THREE.Object3D[];
} {
  const meshes: THREE.Mesh[] = [];
  const rigids: THREE.Object3D[] = [];
  const why = { live: 0, hidden: 0, unbakeable: 0, moving: 0, baked: 0 };
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (o !== root && o.userData[RIGID]) {
      let nested = false;
      for (let p = o.parent; p && p !== root; p = p.parent) nested ||= !!p.userData[RIGID];
      if (!nested) rigids.push(o);
    }
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (isLive(m, root)) why.live++;
    else if (hiddenAbove(m, root)) why.hidden++;
    else if (!bakeable(m)) why.unbakeable++;
    else meshes.push(m);
  });
  return { meshes, why, rigids };
}

function layerOf(
  root: THREE.Object3D,
  meshes: THREE.Mesh[],
  moved: Set<number>,
  why: Record<string, number>,
): BakedLayer | null {
  const reps = new Map<string, THREE.Material>();
  const sources: Source[] = [];
  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const p = new THREE.Vector3();
  const add = (m: THREE.Mesh, mat: THREE.Material, glow?: "day" | "night") => {
    const key = matKey(mat);
    const fold = foldable(mat);
    if (!reps.has(key)) reps.set(key, fold ? folded(mat) : mat);
    p.setFromMatrixPosition(m.matrixWorld).applyMatrix4(inverse);
    sources.push({
      mesh: m,
      key,
      cell: `${Math.floor(p.x / cellSize())},${Math.floor(p.z / cellSize())}`,
      material: reps.get(key)!,
      local: new THREE.Matrix4().multiplyMatrices(inverse, m.matrixWorld),
      color: fold ? (mat as Lit).color : undefined,
      glow,
    });
  };
  meshes.forEach((m, i) => {
    if (moved.has(i)) return;
    const g = m.userData.nightGlow as NightGlow | undefined;
    if (g) {
      add(m, g.day, "day");
      add(m, g.night, "night");
    } else add(m, m.material as THREE.Material);
  });
  why.baked = new Set(sources.map((x) => x.mesh)).size;
  why.moving = meshes.length - why.baked;
  if (why.baked < 2) return null;
  const layer = new BakedLayer(root, sources);
  layer.liveCount = why.moving;
  return layer;
}

/** Batches the static meshes under `root` right now, trusting the tick sampling and the `live` flags. */
export function bakeStatic(root: THREE.Object3D): BakedLayer | null {
  const { meshes, why, rigids } = collect(root);
  for (const r of rigids) bakeStatic(r)?.show("smooth");
  if (!meshes.length) return null;
  const moved = new Set<number>();
  sampleTicks(root, meshes, moved);
  return layerOf(root, meshes, moved, why);
}

const watching = new Map<THREE.Object3D, Watch>();
const rushed = new WeakSet<THREE.Object3D>();

/**
 * A root that is complete the moment it is built (the real game's rooms) skips the warm-up frames: the next `syncBaked`
 * batches it from the tick sampling alone, so the first picture of a room is already batched.
 */
export const batchWithoutWarmup = (root: THREE.Object3D): void => void rushed.add(root);

/** Frames a room is watched before it is batched: whatever an actor or animation moves in that time stays live. */
const WARMUP = [3, 10, 24];

interface Watch {
  meshes: THREE.Mesh[];
  why: Record<string, number>;
  base: Snap;
  moved: Set<number>;
  frames: number;
  orphan: number;
}

const layers = new WeakMap<THREE.Object3D, BakedLayer | null>();

/**
 * Something under a batched root changed shape (a room re-skinned, a prop removed): drop that root's batches so
 * the originals draw again and the root is watched and batched afresh a moment later.
 */
export function invalidateBaked(obj: THREE.Object3D): void {
  shadowEpoch++;
  for (let p: THREE.Object3D | null = obj; p; p = p.parent) {
    const l = layers.get(p);
    if (l) {
      l.dispose();
      layers.delete(p);
    }
    watching.delete(p);
  }
}
/** True while a root of `scene` is still being watched (not yet batched): its shadow can't be split into baked and live yet. */
export function bakePending(scene: THREE.Object3D): boolean {
  if (!watching.size) return false;
  for (const root of watching.keys()) {
    let top: THREE.Object3D | null = root;
    while (top?.parent) top = top.parent;
    if (top === scene) return true;
  }
  return false;
}

/** Release pending probes before a room or actor is detached. */
export function dropBaked(root: THREE.Object3D): void {
  root.traverse((o) => {
    watching.delete(o);
    layers.delete(o);
  });
  if ((root as THREE.Scene).isScene) seen.delete(root as THREE.Scene);
}

const seen = new WeakMap<THREE.Scene, { epoch: number; mode: BakeMode | null; layers: BakedLayer[] }>();

/**
 * Called every frame by the pipeline: finds roots flagged `userData.bake`, watches each for a few frames of
 * real animation, batches the still ones, and shows the variant for `mode`. Does nothing once it has settled.
 */
export function syncBaked(scene: THREE.Scene, mode: BakeMode): BakedLayer[] {
  if (disabled) return [];
  let s = seen.get(scene);
  if (!s) {
    s = { epoch: -1, mode: null, layers: [] };
    seen.set(scene, s);
  }
  if (s.epoch !== epoch) {
    s.epoch = epoch;
    s.layers = s.layers.filter((l) => !l.disposed);
    // Flagged roots sit near the top of the scene: no need to walk every mesh each time something is added.
    const watch = (o: THREE.Object3D) => {
      if (layers.has(o) || watching.has(o)) return;
      const { meshes, why, rigids } = collect(o);
      watching.set(o, { meshes, why, base: snapshot(o, meshes), moved: new Set(), frames: 0, orphan: 0 });
      for (const r of rigids) watch(r);
    };
    const look = (o: THREE.Object3D, depth: number) => {
      if (o.userData[BAKE]) watch(o);
      else if (depth < 3) for (const c of o.children) look(c, depth + 1);
    };
    look(scene, 0);
    s.epoch = epoch;
  }
  if (watching.size) {
    for (const [root, w] of [...watching]) {
      let top: THREE.Object3D | null = root;
      while (top?.parent) top = top.parent;
      if (top !== scene) {
        // Never reached the scene (or left it): don't carry it for ever.
        if (++w.orphan > 900) watching.delete(root);
        continue;
      }
      w.frames++;
      if (WARMUP.includes(w.frames)) noteMoved(w.base, snapshot(root, w.meshes), w.moved);
      if (w.frames < WARMUP.at(-1)! && !rushed.has(root)) continue;
      watching.delete(root);
      sampleTicks(root, w.meshes, w.moved);
      const l = layerOf(root, w.meshes, w.moved, w.why);
      layers.set(root, l);
      if (l) s.layers.push(l);
      s.epoch = epoch;
      s.mode = null;
    }
  }
  for (const l of s.layers) if (l.hasPictures) l.syncPictures();
  if (s.mode !== mode) {
    s.mode = mode;
    for (const l of s.layers) l.show(mode);
    s.epoch = epoch;
  }
  return s.layers;
}

// MARK: Frozen models

const frozen = new Set<BakedLayer>();

function underRoot(o: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p === root) return true;
  return false;
}

/**
 * Merges everything under `root` that can be merged, in the pose it is in right now, and hides the originals: a person
 * standing still costs two draw calls instead of fifteen. `layer.suspend()` gives the live parts back, `resume` hides
 * them again. Null while the model's own limbs are still being watched for batching, or when there is nothing to merge.
 */
export function freezeLayer(root: THREE.Object3D, mode: BakeMode = "smooth"): BakedLayer | null {
  if (disabled) return null;
  for (const w of watching.keys()) if (underRoot(w, root)) return null;
  root.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const reps = new Map<string, THREE.Material>();
  const sources: Source[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.userData.bakedSource || hiddenAbove(m, root) || !bakeable(m, true)) return;
    const mat = m.material as THREE.Material;
    const key = matKey(mat);
    const fold = foldable(mat);
    if (!reps.has(key)) reps.set(key, fold ? folded(mat) : mat);
    sources.push({
      mesh: m,
      key,
      cell: "0",
      material: reps.get(key)!,
      local: new THREE.Matrix4().multiplyMatrices(inverse, m.matrixWorld),
      color: fold ? (mat as Lit).color : undefined,
    });
  });
  if (sources.length < 3) return null;
  const layer = new BakedLayer(root, sources, { literal: true });
  layer.show(mode);
  frozen.add(layer);
  return layer;
}

/** Frozen layers of models that have left every scene are freed (a person who left, a pet that was removed). */
export function sweepFrozen(): void {
  for (const l of frozen) {
    let top: THREE.Object3D = l.root;
    while (top.parent) top = top.parent;
    if (!(top as THREE.Scene).isScene) {
      l.dispose();
      frozen.delete(l);
    }
  }
}

export const frozenCount = (): number => frozen.size;
