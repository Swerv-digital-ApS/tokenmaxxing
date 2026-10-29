/**
 * Icons for the HUD, drawn from the same voxel models the world is built of: a piece of furniture, a pet in its
 * look, a character wearing an item, a company's merch, a trophy, a desk setup, a boss's shadow. One small
 * shared offscreen renderer draws each into a square canvas, lit as the pipeline lights a room (the voxel
 * style's warm sun, cool sky and far-side fill, a soft shadow under it), and `IconQueue` spreads the work over
 * frames and keeps the results in an LRU cache keyed by what was drawn, its size and the style.
 *
 * Loaded on demand by `hud/ItemIcon.tsx`, so the 2D tier never pays for three.
 */

import { casePieceOf } from "@tokenmaxxing/core/case-furniture.ts";
import { homePieceOf } from "@tokenmaxxing/core/home.ts";
import { COMPANY_FURNITURE } from "@tokenmaxxing/core/office.ts";
import { posterOf } from "@tokenmaxxing/core/posters.ts";
import * as THREE from "three";
import { graphics } from "../settings/graphics.ts";
import { storage } from "../storage.ts";
import { buildCaseBox, buildCaseKey } from "./case-box3d.ts";
import { buildBoss } from "./dungeon/bossvox.ts";
import { trophy } from "./dungeon/dungeon3d.ts";
import { disposeObject } from "./engine/dispose.ts";
import { type Asset, assetById } from "./furniture/furniture.ts";
import {
  CEILING_ASSET_IDS,
  deskTier,
  extraAssetById,
  type MerchCompany,
  type MerchKind,
  merchProp,
  WALL_ASSET_IDS,
} from "./furniture/furniture3d.ts";
import { iconKey } from "./icon-key.ts";
import { IconQueue, LruCache } from "./icon-queue.ts";
import { blockify } from "./kit/blocky.ts";
import { beginTickScope, dropTickScope, endTickScope, setSmoothBands } from "./kit/kit.ts";
import { avatarFor, type Look2D } from "./people/gear3d.ts";
import { view } from "./perf/freeze.ts";
import { petFrom2D } from "./pets/pets3d.ts";
import { assetOfChar, flat } from "./rooms/room-furnished.ts";

export type IconSpec =
  | { kind: "piece"; ch: string }
  | { kind: "pet"; pet: number; variant?: number; name?: string; wear?: number }
  | { kind: "avatar"; look: Look2D; focus?: "head" | "body"; facing?: "front" | "back" }
  | { kind: "merch"; company: MerchCompany; merch: MerchKind }
  | { kind: "trophy"; id: string; earned?: boolean }
  | { kind: "desk"; tier: number }
  | { kind: "boss"; id: string }
  | { kind: "case"; what: "closed" | "open" | "key"; caseId?: string };

export type IconSize = 64 | 128;

// MARK: Models

interface Built {
  root: THREE.Object3D;
  /** What the camera frames (the whole model by default). */
  focus?: THREE.Object3D;
  dispose: () => void;
}

const pieceAsset = (ch: string): Asset | undefined => {
  if (ch === "=" || ch === "e") return flat(ch);
  const art =
    posterOf(ch)?.art ??
    (homePieceOf(ch) ?? casePieceOf(ch))?.art ??
    COMPANY_FURNITURE.find((p) => p.ch === ch)?.art;
  return assetOfChar(ch) ?? (art ? (assetById.get(art) ?? extraAssetById.get(art)) : undefined);
};

/** Faces the model towards the camera (which looks along the azimuth π/4): +z turns to (+x, +z). */
const TO_CAMERA = Math.PI / 4;

function build(s: IconSpec): Built {
  const root = new THREE.Group();
  let focus: THREE.Object3D | undefined;
  let dispose = () => {};
  switch (s.kind) {
    case "piece": {
      const a = pieceAsset(s.ch);
      if (!a) break;
      const m = a.build();
      // Wall and ceiling pieces are built flat against a wall: turn them a little towards the camera.
      if (WALL_ASSET_IDS.has(a.id) || CEILING_ASSET_IDS.has(a.id)) m.rotation.y = TO_CAMERA * 0.6;
      root.add(m);
      break;
    }
    case "pet": {
      const p = petFrom2D(s.pet, s.variant ?? 0, s.name ?? "");
      p.wear = s.wear ?? 0;
      // One pose pass dresses it and settles the eyes and the z's; the culling test must see it.
      const sees = view.sees;
      view.sees = () => true;
      p.update(1);
      view.sees = sees;
      p.root.rotation.y = TO_CAMERA * 0.5;
      root.add(p.root);
      dispose = () => p.dispose();
      break;
    }
    case "avatar": {
      const a = avatarFor(s.look);
      a.root.rotation.y = s.facing === "back" ? Math.PI + TO_CAMERA * 0.4 : 0;
      root.add(a.root);
      if (s.focus === "head") focus = a.head;
      dispose = () => a.dispose();
      break;
    }
    case "merch":
      root.add(merchProp(s.company, s.merch));
      break;
    case "trophy":
      root.add(trophy(s.id, s.earned !== false));
      break;
    case "desk":
      root.add(deskTier(s.tier));
      break;
    case "case":
      root.add(s.what === "key" ? buildCaseKey(s.caseId) : buildCaseBox(s.what === "open", s.caseId));
      break;
    case "boss": {
      const b = buildBoss(s.id, true);
      b.update({ t: 0, hurt: 0, attack: -1, fall: 0 });
      root.add(b.root);
      break;
    }
  }
  // A lamp's own light would change the shader for every material: the icon is lit by the sun alone.
  const lights: THREE.Object3D[] = [];
  root.traverse((o) => {
    if ((o as THREE.Light).isLight) lights.push(o);
  });
  for (const l of lights) l.removeFromParent();
  return { root, focus, dispose };
}

// MARK: The renderer

const ELEVATION = Math.atan(0.5);
const DISTANCE = 20;
const PAD = 1.12;
const HEMI_SKY = new THREE.Color("#b9d6ff");
const HEMI_GROUND = new THREE.Color("#b89a78");
const SUN_WARM = new THREE.Color("#ffd9a8");

class IconRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, DISTANCE * 3);
  private readonly hemi = new THREE.HemisphereLight("#fff4e0", "#7a6a8a", 1.6);
  private readonly sun = new THREE.DirectionalLight("#fff1d6", 2.4);
  private readonly fill = new THREE.DirectionalLight("#9ec4ff", 0.5);
  private readonly ground: THREE.Mesh;
  private readonly box = new THREE.Box3();
  private readonly corner = new THREE.Vector3();
  private readonly centre = new THREE.Vector3();
  lost = false;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: false,
      powerPreference: "low-power",
    });
    const r = this.renderer;
    r.setPixelRatio(1);
    r.setClearColor(0x000000, 0);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    const { scene, sun, fill, hemi } = this;
    sun.castShadow = true;
    sun.shadow.mapSize.set(512, 512);
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 3;
    scene.add(hemi, sun, sun.target, fill, fill.target);
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2),
      new THREE.ShadowMaterial({ opacity: 0.28 }),
    );
    this.ground.receiveShadow = true;
    scene.add(this.ground);
  }

  /** Lights as a room has them on this tier: the voxel pipeline's warm sun and cool sky, or the classic ones. */
  private light(voxel: boolean, shadow: boolean): void {
    const { hemi, sun, fill } = this;
    hemi.color.set("#fff4e0");
    hemi.groundColor.set("#7a6a8a");
    hemi.intensity = 1.6;
    sun.color.set("#fff1d6");
    sun.intensity = 2.4;
    if (voxel) {
      hemi.color.lerp(HEMI_SKY, 0.4);
      hemi.groundColor.lerp(HEMI_GROUND, 0.5);
      hemi.intensity *= 0.6;
      sun.color.lerp(SUN_WARM, 0.35);
      sun.intensity *= 1.4;
    }
    fill.intensity = voxel ? Math.min(1.2, sun.intensity * 0.22) : 0;
    sun.castShadow = shadow;
    this.ground.visible = shadow;
  }

  /** Frames `focus` (or the whole model): the camera on the game's iso angle, the frustum snug round it. */
  aim(root: THREE.Object3D, focus: THREE.Object3D, pad = PAD): void {
    this.aimAt(this.measure(root, focus), pad);
  }

  /** The box round `focus` (a unit cube for an empty model): what `aimAt` frames. */
  measure(root: THREE.Object3D, focus: THREE.Object3D, into = this.box): THREE.Box3 {
    root.updateMatrixWorld(true);
    const box = into.setFromObject(focus);
    if (box.isEmpty()) box.set(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5));
    return box;
  }

  /** The camera, sun and shadow catcher round `box`. The icons share them, so a kept model aims again each frame. */
  aimAt(box: THREE.Box3, pad = PAD): void {
    const c = box.getCenter(this.centre);
    const cam = this.camera;
    const az = Math.PI / 4;
    cam.position.set(
      c.x + DISTANCE * Math.cos(ELEVATION) * Math.sin(az),
      c.y + DISTANCE * Math.sin(ELEVATION),
      c.z + DISTANCE * Math.cos(ELEVATION) * Math.cos(az),
    );
    cam.lookAt(c);
    cam.updateMatrixWorld(true);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < 8; i++) {
      this.corner.set(
        i & 1 ? box.max.x : box.min.x,
        i & 2 ? box.max.y : box.min.y,
        i & 4 ? box.max.z : box.min.z,
      );
      this.corner.applyMatrix4(cam.matrixWorldInverse);
      minX = Math.min(minX, this.corner.x);
      maxX = Math.max(maxX, this.corner.x);
      minY = Math.min(minY, this.corner.y);
      maxY = Math.max(maxY, this.corner.y);
    }
    const half = (Math.max(maxX - minX, maxY - minY) / 2) * pad;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    cam.left = cx - half;
    cam.right = cx + half;
    cam.top = cy + half;
    cam.bottom = cy - half;
    cam.updateProjectionMatrix();
    // The sun from the room's side (high, from -x +z), its shadow camera just round the model.
    const r = box.getSize(this.corner).length() / 2 + 0.2;
    this.sun.target.position.copy(c);
    this.sun.position.set(c.x - r * 2.2, c.y + r * 4, c.z + r * 1.4);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -r;
    sc.right = sc.top = r;
    sc.near = 0.1;
    sc.far = r * 8;
    sc.updateProjectionMatrix();
    this.fill.target.position.copy(c);
    this.fill.position.set(c.x + r * 2.2, c.y + r * 2, c.z - r * 1.4);
    this.ground.position.y = box.min.y;
  }

  draw(spec: IconSpec, px: number, voxel: boolean, shadow: boolean): HTMLCanvasElement {
    const scope = beginTickScope();
    const built = build(spec);
    endTickScope(scope, built.root);
    dropTickScope(scope);
    const { scene, renderer } = this;
    try {
      scene.add(built.root);
      setSmoothBands(voxel);
      if (voxel) blockify(built.root);
      this.light(voxel, shadow);
      this.aim(built.root, built.focus ?? built.root);
      renderer.setSize(px, px, false);
      renderer.render(scene, this.camera);
      const out = document.createElement("canvas");
      out.width = out.height = px;
      out.getContext("2d")?.drawImage(renderer.domElement, 0, 0);
      return out;
    } finally {
      built.root.removeFromParent();
      built.dispose();
      disposeObject(built.root);
    }
  }

  /** Draws a model kept between frames (the Bag's stage) into `out`, `px` square, framed round `box`. */
  drawLive(
    root: THREE.Object3D,
    box: THREE.Box3,
    px: number,
    voxel: boolean,
    shadow: boolean,
    out: HTMLCanvasElement,
  ): void {
    const { scene, renderer } = this;
    scene.add(root);
    try {
      setSmoothBands(voxel);
      this.light(voxel, shadow);
      this.aimAt(box, STAGE_PAD);
      renderer.setSize(px, px, false);
      renderer.render(scene, this.camera);
      if (out.width !== px) out.width = out.height = px;
      const g = out.getContext("2d");
      g?.clearRect(0, 0, px, px);
      g?.drawImage(renderer.domElement, 0, 0);
    } finally {
      root.removeFromParent();
    }
  }

  dispose(): void {
    this.ground.geometry.dispose();
    (this.ground.material as THREE.Material).dispose();
    this.renderer.dispose();
  }
}

// MARK: The service

/** Entries are small (a 64 px icon at 2× is 16K pixels); the budget is for a long session of opening panels. */
const MAX_ENTRIES = 240;
const MAX_PIXELS = 12_000_000;
/** Milliseconds of a frame the queue may spend. */
export const FRAME_BUDGET_MS = 4;

let renderer: IconRenderer | null | undefined;

/** Whether this browser can draw them; false (and the 2D sprite stays) when WebGL refuses. */
export function iconsAvailable(): boolean {
  if (renderer !== undefined) return renderer !== null;
  try {
    const canvas = document.createElement("canvas");
    renderer = new IconRenderer(canvas);
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      if (renderer) renderer.lost = true;
      queue.pause();
    });
    canvas.addEventListener("webglcontextrestored", () => {
      if (renderer) renderer.lost = false;
      queue.resume();
    });
  } catch {
    renderer = null;
  }
  return renderer !== null;
}

const specs = new Map<string, { spec: IconSpec; px: number; voxel: boolean; shadow: boolean }>();

const cache = new LruCache<HTMLCanvasElement>(MAX_ENTRIES, MAX_PIXELS, (c) => c.width * c.height);
const queue = new IconQueue<HTMLCanvasElement>(
  cache,
  (key) => {
    const job = specs.get(key);
    specs.delete(key);
    if (!job || !renderer) throw new Error("icon: nothing to draw");
    return renderer.draw(job.spec, job.px, job.voxel, job.shadow);
  },
  {
    budgetMs: FRAME_BUDGET_MS,
    now: () => performance.now(),
    schedule: (fn) => requestAnimationFrame(fn),
  },
);

/** Device pixels for a CSS size, capped like the pipeline (`MAX_PIXEL_RATIO`). */
export const devicePixels = (size: IconSize, dpr = window.devicePixelRatio || 1): number =>
  Math.round(size * Math.min(2, Math.max(1, dpr)));

/**
 * The icon for `spec` at `size` CSS pixels (drawn at the device's ratio), from the cache or after its turn in
 * the queue. The style follows the tier in force: High and Ultra get the voxel look with a shadow, Medium the
 * classic bands (as its world has). Cancel when the asker goes away.
 */
export function requestIcon(spec: IconSpec, size: IconSize) {
  if (!iconsAvailable() || !renderer) throw new Error("icons unavailable");
  const voxel = graphics.tier() !== "medium";
  const px = devicePixels(size);
  const key = `${iconKey(spec)}@${px}${voxel ? "v" : "c"}`;
  if (!specs.has(key)) specs.set(key, { spec, px, voxel, shadow: voxel });
  const r = queue.request(key);
  return {
    promise: r.promise,
    cancel: () => {
      r.cancel();
      if (queue.pending === 0) specs.clear();
    },
  };
}

/** Frees the renderer and every cached icon (a tier change to 2D, tests). */
export function disposeIcons(): void {
  cache.clear();
  specs.clear();
  renderer?.dispose();
  renderer = undefined;
}

const idle = (fn: () => void) =>
  typeof requestIdleCallback === "function"
    ? requestIdleCallback(fn, { timeout: 8000 })
    : setTimeout(fn, 1500);

/**
 * Compiles the shaders the icons need (a dressed character, a pet, a piece) on tiny pictures in idle time, so the
 * first panel opened does not pay for it in one frame. Called when the 3D renderer starts.
 */
export function warmIcons(): void {
  if (!iconsAvailable() || !renderer) return;
  const steps: IconSpec[] = [
    { kind: "avatar", look: { style: 0, skin: 0, hair: 0, outfit: 8, hat: 1, glasses: 1, held: 1 } },
    { kind: "pet", pet: 1 },
    { kind: "piece", ch: "p" },
  ];
  const next = () => {
    const s = steps.shift();
    if (!s || !renderer || renderer.lost) return;
    // The style the tier draws icons in (as `requestIcon` picks it): its shaders are the ones to have ready.
    const voxel = graphics.tier() !== "medium";
    try {
      renderer.draw(s, 16, voxel, voxel);
    } catch {}
    idle(next);
  };
  idle(next);
}

// The 2D tier draws its own pictures: the renderer and its context go when the tier drops to Low.
graphics.subscribe(() => {
  if (graphics.tier() === "low" && renderer) disposeIcons();
});

// MARK: The stage

/** How far the stage's character turns each way on its own, and how long after a drag it starts again. */
const SWAY = 0.45;
const SWAY_AFTER_MS = 3000;
/** Where the pet stands: to the character's right on screen and a little in front, turned to the camera. */
const PET_AT = new THREE.Vector3(0.85, 0, -0.35);
/** Room round the stage's model to turn in, and for its shadow. */
const STAGE_PAD = 1.3;

/**
 * The Bag's live picture: you, big, breathing and turning slowly (drag to turn yourself), with your pet beside
 * you. It keeps the models between frames and draws them through the icons' renderer into `out`, so it costs
 * no WebGL context of its own. Null when the browser can't draw them.
 */
export class IconStage {
  private root: THREE.Group | null = null;
  /** What the camera frames, measured once facing front: framing each frame would breathe with the turn. */
  private readonly box = new THREE.Box3();
  private avatar: ReturnType<typeof avatarFor> | null = null;
  private pet: ReturnType<typeof petFrom2D> | null = null;
  private turn = 0;
  private draggedAt = -Infinity;
  private sway = 0;
  private last = 0;

  private constructor(private readonly out: HTMLCanvasElement) {}

  static open(out: HTMLCanvasElement): IconStage | null {
    return iconsAvailable() ? new IconStage(out) : null;
  }

  /** Dresses the stage: a new look rebuilds it. */
  set(look: Look2D, pet: { pet: number; variant: number; name: string; wear: number } | null): void {
    this.clear();
    if (!renderer) return;
    const root = new THREE.Group();
    const scope = beginTickScope();
    const avatar = avatarFor(look);
    root.add(avatar.root);
    let p: ReturnType<typeof petFrom2D> | null = null;
    if (pet && pet.pet > 0) {
      p = petFrom2D(pet.pet, pet.variant, pet.name);
      p.wear = pet.wear;
      p.root.position.copy(PET_AT);
      p.root.rotation.y = TO_CAMERA;
      root.add(p.root);
    }
    endTickScope(scope, root);
    dropTickScope(scope);
    // A lamp's own light would change the shader for every material: lit by the sun alone, like the icons.
    const lights: THREE.Object3D[] = [];
    root.traverse((o) => {
      if ((o as THREE.Light).isLight) lights.push(o);
    });
    for (const l of lights) l.removeFromParent();
    if (graphics.tier() !== "medium") blockify(root);
    this.pose(avatar, p, 0, 1 / 60);
    renderer.measure(root, root, this.box);
    this.root = root;
    this.avatar = avatar;
    this.pet = p;
  }

  /** A drag across the picture turns the character with it. */
  spin(dxCss: number): void {
    this.turn += dxCss * 0.012;
    this.draggedAt = performance.now();
  }

  /** One frame: `now` is the page's clock in ms. `px` is the canvas's size in device pixels. */
  frame(now: number, px: number): void {
    const { root, avatar } = this;
    if (!root || !avatar || !renderer || renderer.lost) return;
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    const idle = now - this.draggedAt > SWAY_AFTER_MS;
    this.sway += ((idle ? 1 : 0) - this.sway) * Math.min(1, dt * 1.5);
    avatar.root.rotation.y = this.turn + Math.sin(now / 1600) * SWAY * this.sway;
    this.pose(avatar, this.pet, now / 1000, dt);
    const voxel = graphics.tier() !== "medium";
    renderer.drawLive(root, this.box, px, voxel, voxel, this.out);
  }

  /** Breathing and blinking: the culling test has no camera here, so it must see them. */
  private pose(
    avatar: ReturnType<typeof avatarFor>,
    pet: ReturnType<typeof petFrom2D> | null,
    t: number,
    dt: number,
  ) {
    const sees = view.sees;
    view.sees = () => true;
    try {
      avatar.root.updateMatrixWorld(true);
      avatar.update(dt, t);
      pet?.update(t);
    } finally {
      view.sees = sees;
    }
  }

  private clear(): void {
    this.avatar?.dispose();
    this.pet?.dispose();
    if (this.root) disposeObject(this.root);
    this.root = this.avatar = this.pet = null;
  }

  dispose(): void {
    this.clear();
  }
}

/** What the queue did, for the QA scripts and the perf harness. */
export const iconStats = () => ({
  ...queue.stats,
  cached: cache.size,
  pixels: cache.cost,
  pending: queue.pending,
});

if (storage.getItem("tokenmaxxing.qa") === "1")
  (globalThis as unknown as { __tmIcons: unknown }).__tmIcons = { stats: iconStats, request: requestIcon };
