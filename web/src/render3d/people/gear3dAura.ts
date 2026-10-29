/**
 * The Night Market case's four legendary auras in 3D (`core/src/case.ts`, slot "aura"): effects that move around
 * the wearer rather than sit on them. Each builder gets a frame at the middle of the body, scaled to the avatar's
 * height (one unit is one metre of a 0.95 m person), and registers a tick that moves its cubes. Loaded by
 * `gear3d.ts`. The 2D art is in `art/case-aura.ts`.
 */
import * as THREE from "three";
import { seeded } from "../kit/kit.ts";
import { lit, see } from "./gear3dHead.ts";

type Tick = (t: number, walking: boolean) => void;
export type AuraBuilder = (m: THREE.Object3D, tick: (fn: Tick) => void) => void;
export const AURA_BUILDERS: Record<string, AuraBuilder> = {};

const CUBE = new THREE.BoxGeometry(1, 1, 1);
/** A cube of `w`×`h`×`d` metres (it moves and scales, and stays out of the blocky swap). */
function cube(
  parent: THREE.Object3D,
  size: [number, number, number],
  mat: THREE.Material,
  at?: [number, number, number],
) {
  const o = new THREE.Mesh(CUBE, mat);
  o.scale.set(...size);
  o.userData.noBlock = true;
  if (at) o.position.set(...at);
  parent.add(o);
  return o;
}
/** A glowing cube with a soft see-through one round it. */
function glowing(parent: THREE.Object3D, size: number, core: string, halo: string, haloOpacity = 0.3) {
  const g = new THREE.Group();
  parent.add(g);
  cube(g, [size, size, size], lit(core));
  cube(g, [size * 2.4, size * 2.4, size * 2.4], see(halo, haloOpacity, true));
  return g;
}
const BASE = -0.5; // feet, from the middle of the body

// Lantern Sky: six paper lanterns drift round in a slow ring, bobbing, each a warm glow.
AURA_BUILDERS["Lantern Sky"] = (m, tick) => {
  const lanterns = Array.from({ length: 6 }, (_, i) => {
    const g = new THREE.Group();
    m.add(g);
    cube(g, [0.075, 0.095, 0.075], lit(i % 2 ? "#ff9a3c" : "#ff7a2e"));
    cube(g, [0.05, 0.06, 0.05], lit("#ffe0a0"));
    cube(g, [0.08, 0.016, 0.08], lit("#6b2418"), [0, 0.056, 0]);
    cube(g, [0.08, 0.016, 0.08], lit("#6b2418"), [0, -0.056, 0]);
    cube(g, [0.004, 0.05, 0.004], lit("#6b2418"), [0, 0.1, 0]);
    cube(g, [0.17, 0.2, 0.17], see("#ffb347", 0.2, true));
    return g;
  });
  tick((t, walking) => {
    lanterns.forEach((g, i) => {
      const a = t * (walking ? 0.6 : 0.42) + (i / lanterns.length) * Math.PI * 2;
      const r = 0.43 + Math.sin(t * 0.7 + i * 2) * 0.03;
      g.position.set(
        Math.cos(a) * r,
        0.02 + (i % 3) * 0.2 - 0.2 + Math.sin(t * 1.1 + i * 1.7) * 0.07,
        Math.sin(a) * r,
      );
      g.rotation.y = -a;
      g.scale.setScalar(1 + Math.sin(t * 7 + i * 3) * 0.05);
    });
  });
};

// Sakura Storm: pink petals whirl up in a spiral and then drift down to settle round the feet.
AURA_BUILDERS["Sakura Storm"] = (m, tick) => {
  const rnd = seeded(77);
  const pinks = ["#ffb3cf", "#ff8fb8", "#ffd1e2", "#f77aa6"];
  const petals = Array.from({ length: 22 }, (_, i) => ({
    o: cube(m, [0.055, 0.012, 0.04], lit(pinks[i % pinks.length]!)),
    p: rnd(),
    r: 0.3 + rnd() * 0.16,
    s: 0.8 + rnd() * 0.5,
    spin: rnd() * 6,
  }));
  tick((t) => {
    for (const p of petals) {
      const k = (t * 0.1 * p.s + p.p) % 1;
      // Up fast with the wind, then down slowly: the swirl slows as it settles.
      const lift = k < 0.45 ? Math.sin((k / 0.45) * (Math.PI / 2)) : 1 - ((k - 0.45) / 0.55) ** 1.6;
      const a = (k < 0.45 ? k * 11 : 4.95 + (k - 0.45) * 3) + p.p * 6.28 + t * 0.35;
      const r = p.r * (k < 0.45 ? 0.7 + 0.3 * Math.sin((k / 0.45) * Math.PI) : 1);
      p.o.position.set(Math.cos(a) * r, BASE + 0.02 + lift * 1.05, Math.sin(a) * r);
      p.o.rotation.set(t * 2 + p.spin, t * 1.4 + p.spin, t * 1.7);
      const z = k > 0.97 ? 0.001 : 1.15;
      p.o.scale.set(0.055 * z, 0.012 * z, 0.04 * z);
    }
  });
};

// Firefly Swarm: small green-gold lights wander round the wearer and blink on and off.
AURA_BUILDERS["Firefly Swarm"] = (m, tick) => {
  const rnd = seeded(31);
  const flies = Array.from({ length: 15 }, (_, i) => ({
    g: glowing(m, 0.04, i % 3 ? "#d8ff5a" : "#ffe45e", i % 3 ? "#9be24a" : "#ffd84a", 0.32),
    ax: 0.28 + rnd() * 0.2,
    ay: 0.3 + rnd() * 0.25,
    fx: 0.25 + rnd() * 0.35,
    fy: 0.3 + rnd() * 0.4,
    fz: 0.2 + rnd() * 0.4,
    p: rnd() * 20,
    blink: 0.9 + rnd() * 1.3,
  }));
  tick((t) => {
    for (const f of flies) {
      const u = t + f.p;
      f.g.position.set(
        Math.sin(u * f.fx) * f.ax * 1.2,
        Math.sin(u * f.fy) * f.ay + 0.05,
        Math.cos(u * f.fz) * f.ax * 1.2,
      );
      const b = Math.max(0, Math.sin(u * f.blink * 2.2));
      f.g.scale.setScalar(0.1 + b ** 0.5 * 1.1);
    }
  });
};

// Koi Current: a ribbon of tiny koi follows one another round the wearer on a rolling ring, tails flicking.
AURA_BUILDERS["Koi Current"] = (m, tick) => {
  const skins: [string, string][] = [
    ["#ff7a2a", "#fff1e0"],
    ["#fff4e8", "#e8452a"],
    ["#ffb03a", "#fff4e8"],
  ];
  const koi = Array.from({ length: 10 }, (_, i) => {
    const g = new THREE.Group();
    g.scale.setScalar(1.35);
    m.add(g);
    const [main, patch] = skins[i % skins.length]!;
    cube(g, [0.09, 0.04, 0.036], lit(main));
    cube(g, [0.036, 0.042, 0.038], lit(patch), [0.01, 0.004, 0]);
    cube(g, [0.03, 0.03, 0.03], lit(main), [0.06, 0, 0]);
    cube(g, [0.012, 0.012, 0.012], lit("#2a1a14"), [0.066, 0.012, 0.016]);
    cube(g, [0.012, 0.012, 0.012], lit("#2a1a14"), [0.066, 0.012, -0.016]);
    cube(g, [0.01, 0.03, 0.07], lit(patch), [0, 0.03, 0]);
    const tail = new THREE.Group();
    tail.position.set(-0.045, 0, 0);
    g.add(tail);
    cube(tail, [0.04, 0.012, 0.05], lit(patch), [-0.02, 0, 0]);
    cube(g, [0.04, 0.05, 0.05], see("#9fe9ff", 0.16, true));
    return { g, tail };
  });
  tick((t, walking) => {
    koi.forEach(({ g, tail }, i) => {
      const a = t * (walking ? 1.1 : 0.8) - i * 0.34;
      const r = 0.42;
      g.position.set(Math.cos(a) * r, Math.sin(a * 2 + t * 0.6) * 0.16 + 0.05, Math.sin(a) * r);
      g.rotation.y = -a - Math.PI / 2;
      g.rotation.z = Math.cos(a * 2 + t * 0.6) * 0.35;
      tail.rotation.y = Math.sin(t * 9 + i) * 0.6;
    });
  });
};

// MARK: The Nusantara case (`core/src/case-nusantara.ts`, auras 400 to 403)

/** A flat extruded outline, `depth` thick, standing in the x-y plane (a cut-out silhouette). */
function plate(shape: THREE.Shape, depth: number): THREE.BufferGeometry {
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }).translate(0, 0, -depth / 2);
}

// Mega Mendung: batik clouds in four bands of indigo to pale blue drift round the wearer, one of them drizzling.
AURA_BUILDERS["Mega Mendung"] = (m, tick) => {
  const bands = ["#243a73", "#3a5fa6", "#6c97d4", "#b7d3f3"];
  const clouds = Array.from({ length: 4 }, () => {
    const g = new THREE.Group();
    m.add(g);
    // Stacked scallops: each band a little narrower and lighter than the one below it, with a bump at each end.
    bands.forEach((col, k) => {
      const w = 0.2 - k * 0.04;
      cube(g, [w, 0.03, 0.07], lit(col), [0, k * 0.032, 0]);
      cube(g, [w * 0.45, 0.03, 0.075], lit(col), [-w * 0.42, k * 0.032 + 0.012, 0]);
      cube(g, [w * 0.45, 0.03, 0.075], lit(col), [w * 0.42, k * 0.032 + 0.012, 0]);
    });
    return g;
  });
  const rnd = seeded(14);
  const drops = Array.from({ length: 8 }, (_, i) => ({
    o: cube(m, [0.014, 0.05, 0.014], lit("#8fb8ec")),
    cloud: i % 4,
    p: rnd(),
    dx: (rnd() - 0.5) * 0.12,
    v: 0.7 + rnd() * 0.5,
  }));
  tick((t, walking) => {
    clouds.forEach((g, i) => {
      const a = t * (walking ? 0.55 : 0.34) + (i / clouds.length) * Math.PI * 2;
      const r = 0.45 + Math.sin(t * 0.6 + i * 1.7) * 0.03;
      g.position.set(
        Math.cos(a) * r,
        0.22 + (i % 2) * 0.16 + Math.sin(t * 0.9 + i * 2.1) * 0.03,
        Math.sin(a) * r,
      );
      g.rotation.y = -a + Math.PI / 2;
      g.scale.setScalar(1.65 + Math.sin(t * 1.3 + i) * 0.06);
    });
    for (const d of drops) {
      const c = clouds[d.cloud]!;
      const k = (t * d.v * 0.8 + d.p) % 1;
      d.o.position.set(c.position.x + d.dx, c.position.y - 0.05 - k * 0.55, c.position.z);
      d.o.scale.set(0.014, 0.03 + k * 0.045, 0.014);
      d.o.visible = k > 0.04 && k < 0.92;
    }
  });
};

// Gamelan Echo: gold ripples spread out from the wearer's feet, and four bronze gongs on a ring take turns being struck.
AURA_BUILDERS["Gamelan Echo"] = (m, tick) => {
  const ripples = Array.from({ length: 3 }, () => {
    const mat = new THREE.MeshBasicMaterial({
      color: "#f2c24a",
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    const o = new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 6, 40), mat);
    o.rotation.x = Math.PI / 2;
    o.userData.noBlock = true;
    m.add(o);
    return { o, mat };
  });
  // Four gongs: a bronze disc with a darker rim and a bright boss, laid flat round the wearer.
  const gongs = Array.from({ length: 4 }, () => {
    const g = new THREE.Group();
    m.add(g);
    // They lie flat like the pots of a bonang, a bronze disc with a darker rim and a bright knob.
    const disc = (r: number, h: number, col: THREE.Material, y = 0) => {
      const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), col);
      o.position.y = y;
      o.userData.noBlock = true;
      g.add(o);
      return o;
    };
    disc(0.1, 0.03, lit("#8a5a24"));
    disc(0.088, 0.036, lit("#c28a3c"), 0.003);
    disc(0.042, 0.05, lit("#f2c870"), 0.008);
    disc(0.017, 0.06, lit("#fff0b8"), 0.012);
    return g;
  });
  tick((t, walking) => {
    ripples.forEach(({ o, mat }, i) => {
      // Each ring is born at the feet and spreads, fading.
      const k = (t * (walking ? 0.5 : 0.36) + i / ripples.length) % 1;
      o.position.y = BASE + 0.03;
      o.scale.setScalar(0.18 + k * 0.75);
      mat.opacity = 0.75 * (1 - k) ** 1.2;
    });
    gongs.forEach((g, i) => {
      const a = (i / gongs.length) * Math.PI * 2 + t * 0.22;
      g.position.set(
        Math.cos(a) * 0.46,
        0.0 + (i % 2) * 0.14 + Math.sin(t * 1.3 + i * 1.6) * 0.03,
        Math.sin(a) * 0.46,
      );
      g.rotation.z = Math.sin(t * 1.1 + i) * 0.1;
      // Struck in turn: a quick swell that rings out.
      const strike = Math.max(0, Math.sin(t * 2.2 - i * (Math.PI / 2)));
      g.scale.setScalar(1.25 + strike ** 6 * 0.4);
    });
  });
};

// Wayang Shadows: warm lamplight ringed round the wearer, and four cut-out silhouettes (a leaf, a bird, a tree and a
// tall figure) with gold edges drifting round it.
AURA_BUILDERS["Wayang Shadows"] = (m, tick) => {
  // The lamp's warm ring, on the ground and again at the chest.
  for (const [y, r] of [
    [BASE + 0.04, 0.46],
    [0.18, 0.5],
  ] as const) {
    const o = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.03, 6, 40),
      new THREE.MeshBasicMaterial({ color: "#ffb347", transparent: true, opacity: 0.28, depthWrite: false }),
    );
    o.rotation.x = Math.PI / 2;
    o.position.y = y;
    o.userData.noBlock = true;
    m.add(o);
  }
  const leaf = new THREE.Shape();
  leaf.moveTo(0, -0.1);
  leaf.bezierCurveTo(0.09, -0.04, 0.08, 0.06, 0, 0.12);
  leaf.bezierCurveTo(-0.08, 0.06, -0.09, -0.04, 0, -0.1);
  const bird = new THREE.Shape();
  bird.moveTo(0.1, 0.02);
  bird.lineTo(0.05, 0.04);
  bird.lineTo(0.03, 0.1);
  bird.lineTo(-0.0, 0.05);
  bird.lineTo(-0.06, 0.04);
  bird.lineTo(-0.11, 0.07);
  bird.lineTo(-0.08, 0.0);
  bird.lineTo(-0.1, -0.06);
  bird.lineTo(-0.02, -0.03);
  bird.lineTo(0.05, -0.04);
  bird.lineTo(0.08, 0.0);
  bird.lineTo(0.12, -0.01);
  const tree = new THREE.Shape();
  tree.moveTo(-0.012, -0.12);
  tree.lineTo(-0.012, -0.02);
  tree.bezierCurveTo(-0.1, -0.02, -0.1, 0.08, -0.04, 0.09);
  tree.bezierCurveTo(-0.05, 0.14, 0.05, 0.14, 0.04, 0.09);
  tree.bezierCurveTo(0.1, 0.08, 0.1, -0.02, 0.012, -0.02);
  tree.lineTo(0.012, -0.12);
  const figure = new THREE.Shape();
  figure.moveTo(-0.025, -0.18);
  figure.lineTo(-0.03, -0.02);
  figure.lineTo(-0.06, 0.02);
  figure.lineTo(-0.045, 0.08);
  figure.lineTo(-0.02, 0.08);
  figure.lineTo(-0.025, 0.12);
  figure.bezierCurveTo(-0.03, 0.18, 0.03, 0.18, 0.025, 0.12);
  figure.lineTo(0.02, 0.08);
  figure.lineTo(0.045, 0.08);
  figure.lineTo(0.06, 0.02);
  figure.lineTo(0.03, -0.02);
  figure.lineTo(0.025, -0.18);
  const pieces = [leaf, bird, tree, figure].map((shape, i) => {
    const g = new THREE.Group();
    m.add(g);
    const gold = new THREE.Mesh(plate(shape, 0.012), lit("#e8b23a"));
    gold.scale.set(1.14, 1.12, 1);
    const ink = new THREE.Mesh(plate(shape, 0.02), new THREE.MeshBasicMaterial({ color: "#14100e" }));
    for (const o of [gold, ink]) {
      o.userData.noBlock = true;
      g.add(o);
    }
    g.scale.setScalar(i === 3 ? 1.3 : 1.45);
    return g;
  });
  tick((t, walking) => {
    pieces.forEach((g, i) => {
      const a = t * (walking ? 0.55 : 0.4) + (i / pieces.length) * Math.PI * 2;
      const r = 0.47;
      g.position.set(
        Math.cos(a) * r,
        0.1 + (i % 2) * 0.1 + Math.sin(t * 1.1 + i * 1.9) * 0.04,
        Math.sin(a) * r,
      );
      // They face outward, edge to the wearer, like figures passing in front of a lamp.
      g.rotation.y = -a + Math.PI / 2;
      g.rotation.z = Math.sin(t * 1.5 + i) * 0.07;
    });
  });
};

// Padi Gold: a ring of rice stalks with heavy golden heads sways round the feet, and grains of gold lift off and fade.
AURA_BUILDERS["Padi Gold"] = (m, tick) => {
  const rnd = seeded(58);
  const stalks = Array.from({ length: 12 }, (_, i) => {
    const g = new THREE.Group();
    const a = (i / 12) * Math.PI * 2 + rnd() * 0.15;
    const r = 0.36 + (i % 2) * 0.07;
    g.position.set(Math.cos(a) * r, BASE, Math.sin(a) * r);
    g.rotation.y = -a;
    m.add(g);
    const hgt = 0.3 + rnd() * 0.12;
    cube(g, [0.011, hgt, 0.011], lit(i % 3 ? "#6fbf4a" : "#2f7f3a"), [0, hgt / 2, 0]);
    // A leaf blade, and the head: golden grains drooping off to one side.
    cube(g, [0.007, 0.1, 0.03], lit("#4a9f3a"), [0, hgt * 0.35, 0.012]).rotation.x = 0.3;
    const head = new THREE.Group();
    head.position.set(0, hgt, 0);
    g.add(head);
    for (let k = 0; k < 3; k++)
      cube(head, [0.02, 0.026, 0.02], lit(k % 2 ? "#f2b632" : "#ffd25a"), [
        0.012 + k * 0.011,
        -k * 0.012 + 0.016,
        0,
      ]);
    return { g, head, p: rnd() * 6.28, hgt };
  });
  const grains = Array.from({ length: 12 }, () => ({
    o: cube(m, [0.016, 0.016, 0.016], lit("#ffd25a")),
    a: rnd() * Math.PI * 2,
    r: 0.3 + rnd() * 0.2,
    p: rnd(),
    s: 0.7 + rnd() * 0.5,
  }));
  tick((t, walking) => {
    for (const s of stalks) {
      // Out of phase, so a wave runs round the ring.
      const w = Math.sin(t * (walking ? 3.2 : 1.7) + s.p);
      s.g.rotation.z = w * (walking ? 0.18 : 0.1);
      s.head.rotation.z = -0.5 + w * 0.2;
    }
    for (const gr of grains) {
      const k = (t * 0.2 * gr.s + gr.p) % 1;
      gr.o.position.set(
        Math.cos(gr.a + t * 0.3) * gr.r,
        BASE + 0.1 + k * 1.1,
        Math.sin(gr.a + t * 0.3) * gr.r,
      );
      const z = Math.sin(k * Math.PI);
      gr.o.scale.set(0.016 * z, 0.016 * z, 0.016 * z);
      gr.o.rotation.y = t * 2 + gr.a;
    }
  });
};
