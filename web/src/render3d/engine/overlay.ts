import * as THREE from "three";
import { BURST_MS } from "../../game/emoji.ts";
import { labelAlpha } from "../../game/near.ts";

const STYLE_ID = "r3d-style";

const CSS = `
#labels3d { position: fixed; inset: 0; pointer-events: none; overflow: hidden; }
#labels3d .label { position: absolute; left: 0; top: 0; white-space: nowrap; will-change: transform; color: #f4f1ea;
  font: 600 11px ui-monospace, SFMono-Regular, Menlo, monospace; }
#labels3d .r3-sign { padding: 1px 6px; border-radius: 4px; background: rgba(43, 36, 51, 0.7); font-size: 11px; font-weight: 600; }
#labels3d .r3-sign.own { background: rgba(251, 247, 239, 0.95); color: #2b2433; }
#labels3d .r3-sign.link { pointer-events: auto; cursor: pointer; }
#labels3d .r3-sign.gold { background: rgba(233, 183, 61, 0.95); color: #2b2433; }
#labels3d .r3-sign.green { background: rgba(157, 255, 138, 0.9); color: #2b2433; }
#labels3d .r3-sign.cyan { background: rgba(143, 227, 255, 0.95); color: #2b2433; }
#labels3d .r3-sign.bubble { max-width: 190px; white-space: normal; text-align: center; padding: 3px 7px; border-radius: 6px; background: #fbf7ef; color: #2b2433; border: 2px solid #2b2433; font-weight: 500; }
#labels3d .r3-sign.dark { background: rgba(20, 24, 34, 0.9); color: #ffd35c; }
#labels3d .r3-sign.dim { background: rgba(43, 36, 51, 0.6); color: #a7adbb; }
#labels3d .r3-sign.common { background: #7fcf6a; color: #2b2433; }
#labels3d .r3-sign.rare { background: #5aa8ff; color: #2b2433; }
#labels3d .r3-sign.epic { background: #b57cff; color: #2b2433; }
#labels3d .r3-sign.legendary { background: #ffc93c; color: #2b2433; }
#labels3d .r3-chips { display: flex; gap: 3px; }
#labels3d .r3-chip { padding: 0 5px; border-radius: 4px; background: rgba(27, 31, 42, 0.82); font-size: 10px; line-height: 14px; pointer-events: auto; cursor: pointer; }
#labels3d .r3-stack { display: flex; flex-direction: column; align-items: center; gap: 2px; }
#labels3d .r3-pill { padding: 0 6px; border-radius: 4px; font-size: 11px; line-height: 15px; font-weight: 600; }
#labels3d .r3-game { background: rgba(233, 183, 61, 0.95); color: #2b2433; }
#labels3d .r3-work { background: rgba(143, 227, 255, 0.95); color: #2b2433; }
#labels3d .r3-battle { background: rgba(179, 107, 255, 0.95); color: #fff; }
#labels3d .r3-bubble { max-width: 190px; white-space: normal; text-align: center; padding: 3px 7px; border-radius: 6px; background: #fbf7ef;
  color: #2b2433; border: 2px solid #2b2433; font-size: 12px; font-weight: 500; line-height: 15px; margin-bottom: 4px; position: relative; }
#labels3d .r3-bubble::after { content: ""; position: absolute; left: 50%; bottom: -7px; margin-left: -5px; border: 5px solid transparent;
  border-top-color: #2b2433; border-bottom: 0; }
#labels3d .r3-zzz { color: #fff; font-weight: 700; animation: r3z 1.8s ease-out infinite; }
@keyframes r3z { 0% { opacity: 1; transform: translate(8px, 0) scale(.9); } 100% { opacity: 0; transform: translate(16px, -14px) scale(1.3); } }
#labels3d .r3-emoji { position: absolute; left: 0; top: 0; font-size: 18px; will-change: transform; line-height: 1;
  font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif; }
#labels3d .r3-pet { font-size: 9px; font-weight: 600; color: #fff; text-shadow: 0 0 3px rgba(27,31,42,.9), 0 0 3px rgba(27,31,42,.9); }
#r3-fade { position: fixed; inset: 0; background: #1b1f2a; opacity: 0; pointer-events: none; }
`;

/** The DOM over the canvas: name tags, bubbles, signs and emoji bursts, positioned from the 3D scene. */
export class Overlay {
  readonly layer = document.createElement("div");
  readonly fade = document.createElement("div");
  private readonly v = new THREE.Vector3();
  width = 1;
  height = 1;
  /** Where `place` last put an element, in CSS pixels. */
  px = 0;
  py = 0;
  private fadeTo = 0;
  private fadeNow = 0;
  /** Where the labels over things are judged from, in world units: the player (NaN: all show), the pointed tile and its reveal. */
  private readonly focus = { x: NaN, z: NaN, hx: NaN, hz: NaN, hover: 0 };

  constructor() {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.append(style);
    }
    this.layer.id = "labels3d";
    this.fade.id = "r3-fade";
  }

  mount(host: HTMLElement): void {
    host.append(this.layer, this.fade);
  }

  dispose(): void {
    this.layer.remove();
    this.fade.remove();
  }

  resize(w: number, h: number): void {
    this.width = w;
    this.height = h;
  }

  /** A fresh label element in the layer. */
  make(cls: string, text = ""): HTMLDivElement {
    const el = document.createElement("div");
    el.className = `label ${cls}`;
    if (text) el.textContent = text;
    this.layer.append(el);
    return el;
  }

  /** Once a frame: who the `near` labels are near to (`null`: all show), and the pointed tile with its reveal (0 to 1). */
  focusAt(
    me: readonly [number, number] | null,
    hovered: readonly [number, number] | null,
    hover: number,
  ): void {
    const f = this.focus;
    f.x = me ? me[0] : NaN;
    f.z = me ? me[1] : NaN;
    f.hx = hovered ? hovered[0] : NaN;
    f.hz = hovered ? hovered[1] : NaN;
    f.hover = hover;
  }

  /**
   * Puts `el` at the screen position of a world point; false (and hidden) when it's off screen. A `near` label
   * (one over a thing, not a person) fades with the player's distance (see near.ts) and is hidden when far.
   */
  place(el: HTMLElement, at: THREE.Vector3, camera: THREE.Camera, dx = 0, dy = 0, near = false): boolean {
    this.v.copy(at).project(camera);
    const x = ((this.v.x + 1) / 2) * this.width + dx;
    const y = ((1 - this.v.y) / 2) * this.height + dy;
    let off = this.v.z > 1 || x < -240 || x > this.width + 240 || y < -80 || y > this.height + 200;
    let opacity = "";
    const f = this.focus;
    if (near && !off && !Number.isNaN(f.x)) {
      const a = labelAlpha(Math.hypot(at.x - f.x, at.z - f.z), Math.hypot(at.x - f.hx, at.z - f.hz), f.hover);
      if (a <= 0) off = true;
      else if (a < 0.995) opacity = (Math.round(a * 20) / 20).toFixed(2);
    }
    if (off) {
      if (el.style.display !== "none") el.style.display = "none";
      return false;
    }
    if (el.style.display === "none") el.style.display = "";
    if (near && el.style.opacity !== opacity) el.style.opacity = opacity;
    this.px = x;
    this.py = y;
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    return true;
  }

  /** Moves an element placed this frame to another screen point (a label lifted off the ones below). */
  lift(el: HTMLElement, x: number, y: number): void {
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
  }

  /** The screen point of a world position, in CSS pixels. */
  project(at: THREE.Vector3, camera: THREE.Camera): [number, number] {
    this.v.copy(at).project(camera);
    return [((this.v.x + 1) / 2) * this.width, ((1 - this.v.y) / 2) * this.height];
  }

  // MARK: Fade

  /** Fades the picture to the room colour (1) or back (0), over `ms` (a short blink between rooms). */
  fadeTowards(to: number, ms: number, now: number): void {
    if (to === this.fadeTo) return;
    this.fadeTo = to;
    this.fadeMs = ms;
    this.fadeFrom = this.fadeNow;
    this.fadeAt = now;
  }

  private fadeMs = 0;
  private fadeFrom = 0;
  private fadeAt = 0;

  stepFade(now: number): void {
    const t = this.fadeMs <= 0 ? 1 : Math.min(1, (now - this.fadeAt) / this.fadeMs);
    this.fadeNow = this.fadeFrom + (this.fadeTo - this.fadeFrom) * t;
    const o = this.fadeNow < 0.003 ? "0" : this.fadeNow.toFixed(3);
    if (this.fade.style.opacity !== o) this.fade.style.opacity = o;
  }

  /** Jumps to a fade level at once. */
  snapFade(to: number): void {
    this.fadeTo = this.fadeNow = this.fadeFrom = to;
    this.fadeMs = 0;
    this.stepFade(0);
  }

  get faded(): number {
    return this.fadeNow;
  }
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const BURST_COUNT = 10;

/** An emoji burst round someone's head (`labels.ts burst`): ten emoji fanned over the top, fading out. */
export class Burst {
  private readonly els: HTMLDivElement[] = [];
  private readonly key: string;

  constructor(
    overlay: Overlay,
    emojis: string[],
    private readonly at: number,
  ) {
    this.key = emojis.join();
    for (let i = 0; i < BURST_COUNT; i++) {
      const el = document.createElement("div");
      el.className = "r3-emoji";
      el.textContent = emojis[i % emojis.length]!;
      el.style.display = "none";
      overlay.layer.append(el);
      this.els.push(el);
    }
  }

  /** Moves the emoji for `now`; false once they have all faded. */
  step(now: number, cx: number, cy: number): boolean {
    const elapsed = now - this.at;
    if (elapsed > BURST_MS) return false;
    for (const [i, el] of this.els.entries()) {
      const delay = (i % 4) * 80;
      const t = Math.min(1, Math.max(0, (elapsed - delay) / (BURST_MS - 320)));
      if (t === 0) continue;
      const angle = -Math.PI / 2 + ((i + 0.5) / BURST_COUNT - 0.5) * Math.PI * 1.5;
      const reach = 14 + 38 * easeOut(t) + (i % 3) * 6;
      const x = cx + Math.cos(angle) * reach;
      const y = cy + Math.sin(angle) * reach * 0.8 - 22 * t;
      const pop = t < 0.15 ? t / 0.15 : 1;
      el.style.display = "";
      el.style.opacity = t < 0.7 ? "1" : String(1 - (t - 0.7) / 0.3);
      el.style.fontSize = `${12 + 8 * pop + (i % 2) * 3}px`;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
    }
    return true;
  }

  matches(emojis: string[], at: number): boolean {
    return this.at === at && this.key === emojis.join();
  }

  dispose(): void {
    for (const el of this.els) el.remove();
    this.els.length = 0;
  }
}
