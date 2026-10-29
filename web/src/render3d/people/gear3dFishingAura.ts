/**
 * The pond treasures' legendary aura in 3D (`core/src/fishing-loot.ts`, slot "aura"): Bubble stream. Like the cases'
 * (`gear3dAura.ts`, `gear3dRagnarokAura.ts`) the builder gets a frame at the middle of the body, scaled to the avatar's
 * height (one unit is one metre of a 0.95 m person), and registers a tick that moves its parts. Loaded by
 * `gear3dFishing.ts`.
 */
import * as THREE from "three";
import { seeded } from "../kit/kit.ts";
import { AURA_BUILDERS } from "./gear3dAura.ts";
import { isVox } from "./voxgear.ts";

const SPHERE = new THREE.SphereGeometry(0.5, 12, 8);
const CUBE = new THREE.BoxGeometry(1, 1, 1);

/** Materials every wearer shares: one per colour and opacity, never disposed with a model. */
const shared = new Map<string, THREE.Material>();
function basic(color: string, opacity: number): THREE.Material {
  const key = `${color}/${opacity}`;
  let m = shared.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    m.userData.shared = true;
    shared.set(key, m);
  }
  return m;
}

const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

// Bubble stream: translucent bubbles lift off the feet and rise round the wearer, wobbling, each with a bright glint.
// At the top of the climb a bubble swells and pops in a few droplets, and a new one is born small at the feet.
AURA_BUILDERS["Bubble stream"] = (m, tick) => {
  const geo = isVox(m) ? CUBE : SPHERE;
  const rnd = seeded(600);
  const N = 14;
  const bubbles = Array.from({ length: N }, (_, i) => {
    const o = new THREE.Mesh(geo, basic(i % 3 ? "#bfeeff" : "#d8f6ff", 0.3));
    o.userData.noBlock = true;
    m.add(o);
    // The glint sits on the upper-left of the bubble, in the bubble's own units, so it wobbles with it.
    const glint = new THREE.Mesh(geo, basic("#ffffff", 0.9));
    glint.userData.noBlock = true;
    glint.position.set(-0.2, 0.22, 0.3);
    glint.scale.setScalar(0.2);
    o.add(glint);
    const drops = [0, 1].map((j) => {
      const d = new THREE.Mesh(CUBE, basic("#ffffff", 0.85));
      d.userData.noBlock = true;
      d.visible = false;
      m.add(d);
      return { o: d, dx: j ? 0.8 : -0.9, dy: j ? 0.5 : 0.9, dz: j ? -0.4 : 0.5 };
    });
    return {
      o,
      glint,
      drops,
      p: i / N + (rnd() - 0.5) * 0.04,
      a: rnd() * Math.PI * 2,
      r: 0.3 + rnd() * 0.18,
      d: 0.05 + rnd() * 0.06,
      w: rnd() * 6,
      s: 0.9 + rnd() * 0.3,
    };
  });
  const cubes = isVox(m) ? 0.85 : 1;
  tick((t, walking) => {
    const pace = walking ? 1.4 : 1;
    for (let i = 0; i < bubbles.length; i++) {
      const b = bubbles[i]!;
      const k = (t * 0.1 * b.s * pace + b.p) % 1;
      // Up from the feet (-0.5) to just over the head (0.58), drifting round and in and out as it climbs.
      const a = b.a + t * 0.45 + k * 2.5;
      const r = b.r + Math.sin(k * 7 + b.w) * 0.035;
      const x = Math.sin(a) * r;
      const y = -0.5 + k * 1.08;
      const z = Math.cos(a) * r;
      b.o.position.set(x, y, z);
      // Born small, full size most of its life, swelling and vanishing in the pop.
      const pop = smooth(0.94, 0.965, k);
      const swell = 1 + smooth(0.9, 0.96, k) * 0.35;
      const size = b.d * Math.min(smooth(0, 0.06, k), 1 - pop) * swell * cubes;
      const wob = Math.sin(t * 5 + b.w) * 0.09;
      b.o.scale.set(size * (1 + wob), size * (1 - wob), size);
      b.o.visible = size > 0.002;
      // The droplets of the pop fly out and shrink.
      const fly = smooth(0.95, 1, k);
      for (let j = 0; j < 2; j++) {
        const d = b.drops[j]!;
        d.o.visible = k > 0.95 && fly < 1;
        d.o.position.set(x + d.dx * fly * 0.08, y + d.dy * fly * 0.08, z + d.dz * fly * 0.08);
        d.o.scale.setScalar(0.014 * (1 - fly) + 0.001);
      }
    }
  });
};
