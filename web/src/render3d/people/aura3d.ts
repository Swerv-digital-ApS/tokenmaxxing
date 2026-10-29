import * as THREE from "three";
import { disposeObject } from "../engine/dispose.ts";

/**
 * An aura dance's aura (`dances.ts` in core): two shells of rising flame streaks and a ring on the floor, in the
 * dance's colour, added onto what's behind. It grows taller and brighter as it is farmed. The shapes and the streaks'
 * picture are shared by every aura; each one has its own materials, for its colour and strength.
 */

let shapes: { inner: THREE.BufferGeometry; outer: THREE.BufferGeometry; ring: THREE.BufferGeometry } | null =
  null;
let streaks: THREE.Texture | null = null;

const shared = <T extends { userData: Record<string, unknown> }>(thing: T): T => {
  thing.userData.shared = true;
  return thing;
};

/** Bright at the bottom, gone at the top, in uneven vertical streaks: flames, once it wraps a shell. */
function streakTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d")!;
  for (let x = 0; x < 64; x++) {
    // A fixed pattern: tall and short streaks along the circle.
    const tall = 0.45 + 0.55 * Math.abs(Math.sin(x * 0.37) * Math.cos(x * 0.13));
    const grad = g.createLinearGradient(0, 64, 0, 64 * (1 - tall));
    grad.addColorStop(0, "rgba(255,255,255,0.95)");
    grad.addColorStop(0.5, "rgba(255,255,255,0.35)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(x, 0, 1, 64);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  return shared(t);
}

const material = (map: THREE.Texture | null): THREE.MeshBasicMaterial =>
  new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

export class Aura {
  private readonly group = new THREE.Group();
  private readonly inner: THREE.Mesh;
  private readonly outer: THREE.Mesh;
  private readonly ring: THREE.Mesh;
  private colour = "";

  constructor(parent: THREE.Object3D) {
    shapes ??= {
      inner: shared(new THREE.CylinderGeometry(0.34, 0.46, 1.5, 20, 1, true).translate(0, 0.75, 0)),
      outer: shared(new THREE.CylinderGeometry(0.44, 0.58, 1.9, 20, 1, true).translate(0, 0.95, 0)),
      ring: shared(new THREE.RingGeometry(0.42, 0.7, 32).rotateX(-Math.PI / 2).translate(0, 0.03, 0)),
    };
    streaks ??= streakTexture();
    this.inner = new THREE.Mesh(shapes.inner, material(streaks));
    this.outer = new THREE.Mesh(shapes.outer, material(streaks));
    this.ring = new THREE.Mesh(shapes.ring, material(null));
    for (const m of [this.inner, this.outer, this.ring]) {
      m.userData.nopick = true;
      m.userData.noBlock = true;
      m.renderOrder = 2;
      this.group.add(m);
    }
    this.group.userData.live = true;
    parent.add(this.group);
  }

  /** In `colour`, `k` of the way farmed (0 to 1), at `t` seconds; `calm` (reduce motion) holds it still. */
  update(colour: string, k: number, t: number, calm: boolean): void {
    if (colour !== this.colour) {
      this.colour = colour;
      for (const m of [this.inner, this.outer, this.ring])
        (m.material as THREE.MeshBasicMaterial).color.set(colour);
    }
    const flicker = calm ? 1 : 0.85 + 0.15 * Math.sin(t * 11) * Math.sin(t * 7.3);
    const grow = 0.55 + 0.45 * k;
    this.group.scale.set(0.85 + 0.25 * k, grow, 0.85 + 0.25 * k);
    if (!calm) {
      this.inner.rotation.y = t * 1.3;
      this.outer.rotation.y = -t * 0.9;
    }
    (this.inner.material as THREE.MeshBasicMaterial).opacity = (0.2 + 0.3 * k) * flicker;
    (this.outer.material as THREE.MeshBasicMaterial).opacity = (0.1 + 0.25 * k) * flicker;
    (this.ring.material as THREE.MeshBasicMaterial).opacity =
      (0.2 + 0.4 * k) * (calm ? 1 : 0.8 + 0.2 * Math.sin(t * 4));
  }

  dispose(): void {
    this.group.removeFromParent();
    disposeObject(this.group);
  }
}
