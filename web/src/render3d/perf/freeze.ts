import type * as THREE from "three";
import { type BakedLayer, freezeLayer, sweepFrozen } from "./bake.ts";

/**
 * What the camera sees right now, for the things that animate: how many pixels one world unit is, and which
 * people are inside the frame. The pipeline refreshes it every frame (`setView`); animation code reads it to skip work.
 */
export const view = {
  pxPerUnit: 40,
  frame: 0,
  /** Whether a point (an actor's feet, radius `r` around it) is inside the picture, as of the last render. */
  sees: (_p: THREE.Vector3, _r: number): boolean => true,
};

/** Models smaller than this many pixels tall are drawn frozen whatever they do: a stride is invisible at that size. */
export const TINY_PX = 20;

/** `?nofreeze` turns freezing off (to compare pictures). */
const disabled = typeof location !== "undefined" && new URLSearchParams(location.search).has("nofreeze");

const freezers = new Set<Freezer>();

/**
 * Holds a model frozen (`bake.ts`, `freezeLayer`) while it idles. The owner poses the model as usual and then reports
 * `settle(key)`, where `key` names a state worth freezing in (null while it animates); after a short rest the model is
 * merged, and `holds(key)` tells the owner it may skip posing until the state changes.
 */
export class Freezer {
  private readonly layers = new Map<string, BakedLayer>();
  private active: string | null = null;
  private rest = 0;
  seen = false;
  touched = false;
  private unattended = 0;
  mode: "smooth" | "block" = "smooth";

  constructor(
    private readonly root: THREE.Object3D,
    /** Frames of rest before freezing. */
    private readonly after = 24,
  ) {
    freezers.add(this);
    const off = root.userData.onDispose as (() => void) | undefined;
    root.userData.onDispose = () => {
      off?.();
      this.dispose();
    };
  }

  /** The owner posed (or deliberately skipped) this model this frame. */
  touch(): void {
    this.touched = true;
  }

  holds(key: string | null): boolean {
    this.touched = true;
    return key !== null && this.active === key;
  }

  get frozen(): boolean {
    return this.active !== null;
  }

  /** Once per frame: a model nobody has posed for a while is as good as still, and gets frozen too. */
  watch(): void {
    if (this.touched) this.unattended = 0;
    else if (++this.unattended > 30) this.settle("unattended");
    this.touched = false;
  }

  settle(key: string | null): void {
    this.touched = true;
    if (disabled) return;
    if (this.active !== null && this.active !== key) this.thaw();
    if (key === null) {
      this.rest = 0;
      return;
    }
    if (this.active === key || ++this.rest < this.after) return;
    let l = this.layers.get(key);
    if (l) l.resume(this.mode);
    else {
      l = freezeLayer(this.root, this.mode) ?? undefined;
      if (!l) {
        // Still being batched, or nothing to merge: look again in a while.
        this.rest = -120;
        return;
      }
      this.layers.set(key, l);
    }
    this.active = key;
  }

  thaw(): void {
    if (this.active) this.layers.get(this.active)?.suspend();
    this.active = null;
    this.rest = 0;
  }

  /** The model's parts changed (new gear): kept copies are wrong. */
  reset(): void {
    this.thaw();
    for (const l of this.layers.values()) l.dispose();
    this.layers.clear();
  }

  /** Whether the model is still part of a scene. */
  get attached(): boolean {
    let top: THREE.Object3D = this.root;
    while (top.parent) top = top.parent;
    return !!(top as THREE.Scene).isScene;
  }

  dispose(): void {
    this.reset();
    freezers.delete(this);
  }
}

/** The style changed (smooth to blocks or back): every frozen copy is the wrong shape. */
export function thawAll(mode: "smooth" | "block"): void {
  for (const f of freezers) {
    f.reset();
    f.mode = mode;
  }
}

/** Once per rendered frame. */
export function watchAll(): void {
  for (const f of freezers) f.watch();
}

export function sweep(): void {
  sweepFrozen();
  for (const f of freezers) {
    if (f.attached) f.seen = true;
    else if (f.seen) f.dispose();
  }
}
(globalThis as unknown as Record<string, unknown>).__freezers = freezers;
(globalThis as unknown as Record<string, unknown>).__view = view;
