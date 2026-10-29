import * as THREE from "three";
import { storage } from "../../storage.ts";
import { approach } from "../people/motion.ts";

/** The floor a room covers, in world units, and how tall its walls are. */
export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
}

/** How a room wants to be seen. */
export interface Framing {
  /** The picture's height in world units when the player hasn't zoomed. */
  view: number;
  bounds: Bounds;
}

const BASE_AZIMUTH = Math.PI / 4;
const ELEVATION = Math.atan(0.5);
const SIN_EL = Math.sin(ELEVATION);
const COS_EL = Math.cos(ELEVATION);
const DISTANCE = 60;
const ZOOM_STEP = 0.8;
const MIN_VIEW = 3.5;
/** The player stands this far (of the free height) below its middle: what lies ahead, up the screen, is what you need to see. */
const LOW_BIAS = 0.14;
const ZOOM_KEY = "tokenmaxxing.zoom3d";

const rightOf = (az: number): [number, number] => [Math.cos(az), -Math.sin(az)];
const awayOf = (az: number): [number, number] => [-Math.sin(az), -Math.cos(az)];

/**
 * The picture height (world units) at which a room's whole floor fits at `azimuth` for `aspect` (width over
 * height), walls included. Zooming out stops here: past it there is only void.
 */
export function fitView(b: Bounds, aspect: number, azimuth = BASE_AZIMUTH): number {
  const [rx, rz] = rightOf(azimuth);
  const [ax, az] = awayOf(azimuth);
  let r0 = Infinity;
  let r1 = -Infinity;
  let a0 = Infinity;
  let a1 = -Infinity;
  for (const [x, z] of [
    [b.minX, b.minZ],
    [b.maxX, b.minZ],
    [b.minX, b.maxZ],
    [b.maxX, b.maxZ],
  ] as const) {
    const r = x * rx + z * rz;
    const a = x * ax + z * az;
    r0 = Math.min(r0, r);
    r1 = Math.max(r1, r);
    a0 = Math.min(a0, a);
    a1 = Math.max(a1, a);
  }
  return Math.max(((a1 - a0) * SIN_EL + b.height * COS_EL) * 1.06, ((r1 - r0) / aspect) * 1.06);
}

/**
 * The isometric orthographic camera of the 3D game: it follows a point on the floor, turns a quarter at a
 * time, zooms in steps, can be panned off the player for a look round, and never shows past the room.
 */
export class CameraRig {
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 160);
  /** Quarter turns from the default view; the shown azimuth catches up with it. */
  quarter = 0;
  azimuth = BASE_AZIMUTH;
  /** Zoom steps in (+) or out (-) from the room's own framing; saved. */
  level = 0;
  /** Where the picture's middle is on the floor (x, z) and how big it is. */
  readonly focus = new THREE.Vector2();
  viewShown = 10;
  private pan: [number, number] = [0, 0];
  /** The floor point followed last frame: a pan only goes as far as the picture can. */
  private followed: [number, number] = [0, 0];
  private framing: Framing = { view: 10, bounds: { minX: 0, maxX: 10, minZ: 0, maxZ: 10, height: 2.6 } };
  private aspect = 1.6;
  /** The part of the screen the HUD leaves free (fractions of the width and height) and its centre's offset from the screen's, in half-screens. */
  private free = { fx: 1, fy: 1, cx: 0, cy: 0 };
  private freeTo = { fx: 1, fy: 1, cx: 0, cy: 0 };
  private placed = false;

  constructor(store: Pick<Storage, "getItem"> | undefined = storage) {
    const saved = Number(store?.getItem(ZOOM_KEY));
    if (Number.isFinite(saved)) this.level = Math.max(-6, Math.min(8, Math.round(saved)));
  }

  /** A new room: its framing, and the picture jumps to the player instead of gliding. */
  frame(f: Framing): void {
    this.framing = f;
    this.pan = [0, 0];
    this.placed = false;
  }

  setAspect(aspect: number): void {
    this.aspect = Math.max(0.2, aspect);
  }

  /**
   * The HUD's panels cover `left`/`top`/`right`/`bottom` pixels of a w x h screen: the player and the room's
   * framing then centre in what is left. The picture eases there.
   */
  setInsets(left: number, top: number, right: number, bottom: number, w: number, h: number): void {
    const fx = Math.max(0.4, 1 - (left + right) / w);
    const fy = Math.max(0.4, 1 - (top + bottom) / h);
    this.freeTo = { fx, fy, cx: (left - right) / w, cy: (top - bottom) / h };
  }

  /** The levels the player can zoom to in this room: out to the whole room, in to a close-up. */
  private range(): { base: number; min: number; max: number } {
    const fit = this.fitNow();
    const base = Math.min(this.framing.view, fit);
    const ln = Math.log(ZOOM_STEP);
    return {
      base,
      min: Math.min(0, Math.ceil(Math.log(fit / base) / ln - 1e-9)),
      max: Math.max(0, Math.floor(Math.log(Math.min(MIN_VIEW, base) / base) / ln + 1e-9)),
    };
  }

  /** The view height asked for: the room's own, zoomed, never wider than the room. */
  targetView(): number {
    const { base, min, max } = this.range();
    return (base * ZOOM_STEP ** Math.max(min, Math.min(max, this.level))) / this.free.fy;
  }

  /** One step in (+1) or out (-1); 0 puts the zoom back. */
  zoom(step: 1 | -1 | 0): void {
    const { min, max } = this.range();
    this.level =
      step === 0 ? 0 : Math.max(min, Math.min(max, Math.max(min, Math.min(max, this.level)) + step));
    try {
      storage.setItem(ZOOM_KEY, String(this.level));
    } catch {}
  }

  private fitNow(): number {
    return fitView(
      this.framing.bounds,
      (this.aspect * this.free.fx) / this.free.fy,
      BASE_AZIMUTH + (this.quarter * Math.PI) / 2,
    );
  }

  rotate(step: 1 | -1): void {
    this.quarter = (((this.quarter + step) % 4) + 4) % 4;
  }

  /** Moves the look-at point by screen pixels (a drag). `h` is the window height in pixels. */
  panBy(dx: number, dy: number, h: number): void {
    const per = this.viewShown / h;
    const [rx, rz] = rightOf(this.azimuth);
    const [ax, az] = awayOf(this.azimuth);
    const r = -dx * per;
    const a = (dy * per) / SIN_EL;
    const [x, z] = this.followed;
    const [cx, cz] = this.clamp(x + this.pan[0] + rx * r + ax * a, z + this.pan[1] + rz * r + az * a);
    this.pan = [cx - x, cz - z];
  }

  panned(): boolean {
    return this.pan[0] !== 0 || this.pan[1] !== 0;
  }

  resetPan(): void {
    this.pan = [0, 0];
  }

  /** Eases the pan back to the player (they walked on). */
  easePan(dtMs: number): void {
    this.pan = [approach(this.pan[0], 0, dtMs, 260), approach(this.pan[1], 0, dtMs, 260)];
    if (Math.hypot(...this.pan) < 0.01) this.pan = [0, 0];
  }

  /**
   * Moves the camera for a frame of `dtMs` following the floor point (`x`, `z`). `snap` jumps there.
   * Returns nothing: read `camera`.
   */
  update(dtMs: number, x: number, z: number, snap = false): void {
    const jump = snap || !this.placed;
    const tau = jump ? 0 : dtMs;
    // The turn: the shown azimuth takes the short way to the nearest equivalent of the target.
    const target = BASE_AZIMUTH + (this.quarter * Math.PI) / 2;
    let delta = (target - this.azimuth) % (Math.PI * 2);
    if (delta > Math.PI) delta -= Math.PI * 2;
    else if (delta < -Math.PI) delta += Math.PI * 2;
    this.azimuth = jump ? target : this.azimuth + delta * (1 - Math.exp(-tau / 85));
    if (Math.abs(delta) < 0.0005) this.azimuth = target;
    const f = this.free;
    const to = this.freeTo;
    if (jump) this.free = { ...to };
    else
      this.free = {
        fx: approach(f.fx, to.fx, tau, 140),
        fy: approach(f.fy, to.fy, tau, 140),
        cx: approach(f.cx, to.cx, tau, 140),
        cy: approach(f.cy, to.cy, tau, 140),
      };
    this.viewShown = jump ? this.targetView() : approach(this.viewShown, this.targetView(), tau, 110);

    this.followed = [x, z];
    const [fx, fz] = this.clamp(x + this.pan[0], z + this.pan[1]);
    if (jump) this.focus.set(fx, fz);
    else this.focus.set(approach(this.focus.x, fx, tau, 120), approach(this.focus.y, fz, tau, 120));
    this.placed = true;
    this.aim();
  }

  /** Keeps the picture inside the room (centred, on an axis where the room is smaller than the picture). */
  private clamp(x: number, z: number): [number, number] {
    const { bounds: b } = this.framing;
    const [rx, rz] = rightOf(this.azimuth);
    const [ax, az] = awayOf(this.azimuth);
    const hw = (this.viewShown / 2) * this.aspect * this.free.fx;
    const hf = (this.viewShown / 2 / SIN_EL) * this.free.fy;
    let r0 = Infinity;
    let r1 = -Infinity;
    let a0 = Infinity;
    let a1 = -Infinity;
    for (const [cx, cz] of [
      [b.minX, b.minZ],
      [b.maxX, b.minZ],
      [b.minX, b.maxZ],
      [b.maxX, b.maxZ],
    ] as const) {
      const r = cx * rx + cz * rz;
      const a = cx * ax + cz * az;
      r0 = Math.min(r0, r);
      r1 = Math.max(r1, r);
      a0 = Math.min(a0, a);
      a1 = Math.max(a1, a);
    }
    // Walls at the far side rise into the picture: their tops are further "away" on screen.
    a1 += b.height * (COS_EL / SIN_EL);
    const fit = (v: number, lo: number, hi: number, half: number) =>
      hi - lo <= half * 2 ? (lo + hi) / 2 : Math.max(lo + half, Math.min(hi - half, v));
    const r = fit(x * rx + z * rz, r0, r1, hw);
    const a = fit(x * ax + z * az, a0, a1, hf);
    return [r * rx + a * ax, r * rz + a * az];
  }

  /** Puts the camera where `focus` and the angles say, and sizes the frustum. */
  private aim(): void {
    const c = this.camera;
    const t = new THREE.Vector3(this.focus.x, 0.5, this.focus.y);
    c.position.set(
      t.x + DISTANCE * COS_EL * Math.sin(this.azimuth),
      t.y + DISTANCE * SIN_EL,
      t.z + DISTANCE * COS_EL * Math.cos(this.azimuth),
    );
    c.lookAt(t);
    const half = this.viewShown / 2;
    // The HUD's free area is not the screen's middle: slide the window so the look-at point lands in its middle.
    const sx = -this.free.cx * half * this.aspect;
    const sy = (this.free.cy + LOW_BIAS * this.free.fy) * half;
    c.left = -half * this.aspect + sx;
    c.right = half * this.aspect + sx;
    c.top = half + sy;
    c.bottom = -half + sy;
    c.updateProjectionMatrix();
    c.updateMatrixWorld();
  }

  /** The direction from the room to the camera on the floor (for lowering the walls in front). */
  towardCamera(): THREE.Vector3 {
    return new THREE.Vector3(Math.sin(this.azimuth), 0, Math.cos(this.azimuth));
  }

  /** The key directions follow the quarter. */
  get turns(): number {
    return this.quarter;
  }
}
