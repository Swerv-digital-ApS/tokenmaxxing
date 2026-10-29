/**
 * Four ways to draw a person, on one skeleton: legs and arms that swing from hips and shoulders, and a
 * head that carries a painted face. `Avatar` poses any of them the same way, so a look (skin, hair,
 * outfit, hat, species, age) can be worn in every style, and the whole town can switch.
 *
 * - chibi: Tuber Simulator's big round head on a small body.
 * - animal: Busytown, after Richard Scarry: chibi people next to cats, pigs and bunnies in overalls.
 * - grown: the same mix as adults, about four heads tall, in tees, hoodies, blazers and cardigans, at
 *   any age from twenties to grey.
 * - bot: a little robot with a screen for a face, for the agents.
 * - voxel: the grown-ups built from cubes (`voxel.ts`).
 */
import * as THREE from "three";
import { glow, type Model, tint, toon, type V3 } from "../kit/kit.ts";
import type { Avatar } from "./avatar.ts";
import { type FaceKind, faceTexture } from "./faces.ts";

export type CharStyle = "voxel" | "grown" | "animal" | "chibi" | "bot";

export type Animal = "cat" | "dog" | "bunny" | "bear" | "pig" | "fox" | "mouse";
export const ANIMALS: readonly Animal[] = ["cat", "dog", "bunny", "bear", "pig", "fox", "mouse"];
export type Species = "human" | Animal;

export type Age = "young" | "adult" | "senior";
export const AGES: readonly Age[] = ["young", "adult", "senior"];
export type Top = "tee" | "hoodie" | "blazer" | "cardigan";
/** A uniform, worn over the rest (voxel folk only, for now). */
export type Job = "chef" | "farmer" | "officer";

export type Hat = "none" | "cap" | "beanie" | "headphones" | "crown";
export interface Look {
  skin: string;
  hair: string;
  /** 0 short, 1 spiky, 2 bob, 3 bun, 4 ponytail. */
  style: number;
  outfit: [string, string];
  pants: string;
  hat: Hat;
  /** A person, or an animal in clothes. */
  species: Species;
  /** Grown-ups only, as are the rest. */
  age: Age;
  top: Top;
  /** 0 none, 1 a moustache, 2 a full beard. */
  beard: number;
  glasses: boolean;
  job?: Job;
  /** Hair is tucked away: a hat from `gear3d.ts` covers it. */
  covered?: boolean;
  /** Extra cosmetics (`gear3d.ts`: `lookFrom2D` fills this in); the base look draws without it. */
  gear?: Gear;
}

/** What `gear3d.ts` adds to an avatar: built once the body exists, then moved every frame. */
export interface Gear {
  dress(a: Avatar): void;
  update?(a: Avatar, dt: number, t: number): void;
  /** False when `update` has nothing to move (the avatar can then be frozen while it rests). */
  readonly animated?: boolean;
}

/** What a builder hands back to `Avatar`: the joints it poses, and the faces it repaints. */
export interface Rig {
  legs: [Model, Model];
  /** Knees, on legs long enough to bend. */
  knees?: [Model, Model];
  arms: [Model, Model];
  head: Model;
  /** Hip height: how far a sitter drops. */
  hip: number;
  /** Standing height, to the top of the head. */
  height: number;
  faces: { material: THREE.MeshToonMaterial | THREE.MeshBasicMaterial; kind: FaceKind }[];
  /** Anything that moves on its own (a bot's antenna light). */
  tick?: (t: number) => void;
}

export const WHITE = "#fbf7ef";
export const INK = "#2b2433";

/** The front of a sphere of radius 1, for a face to be painted on. */
const SPHERE_FACE = new THREE.SphereGeometry(1, 32, 16, Math.PI / 2 - 0.95, 1.9, Math.PI / 2 - 0.75, 1.5);

/** A face decal: lit like skin, or glowing like a screen. */
export function decal(
  geometry: THREE.BufferGeometry,
  kind: FaceKind,
  faces: Rig["faces"],
  lit = true,
): THREE.Mesh {
  const map = faceTexture("neutral", kind);
  const material = lit
    ? new THREE.MeshToonMaterial({
        map,
        transparent: true,
        depthWrite: false,
        gradientMap: toon(WHITE).gradientMap,
      })
    : new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false });
  faces.push({ material, kind });
  return new THREE.Mesh(geometry, material);
}

/** Two legs from the hips, `hip` high; `build` draws one, its top at the joint. */
function legsOf(b: Model, hip: number, spread: number, build: (leg: Model) => void): [Model, Model] {
  return [-1, 1].map((s) => {
    const leg = b.part([s * spread, hip, 0]);
    build(leg);
    return leg;
  }) as [Model, Model];
}

function armsOf(b: Model, at: V3, build: (arm: Model, side: number) => void): [Model, Model] {
  return [-1, 1].map((s) => {
    const arm = b.part([s * at[0], at[1], at[2]]);
    build(arm, s);
    return arm;
  }) as [Model, Model];
}

// ——— Hats: drawn for a chibi head of radius 0.25; other heads scale them ———
const CHIBI_R = 0.25;

function hat(head: Model, look: Look): void {
  const [main, dark] = look.outfit;
  switch (look.hat) {
    case "cap": {
      const crown = new THREE.Mesh(
        new THREE.SphereGeometry(CHIBI_R * 1.1, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.42),
        toon(main),
      );
      crown.castShadow = true;
      crown.position.y = 0.03;
      head.add(crown);
      head.box([0.34, 0.025, 0.2], dark, [0, 0.12, 0.24], 0.01).rotation.x = -0.12;
      head.ball(0.025, dark, [0, 0.3, 0]);
      break;
    }
    case "beanie":
      head.ball(CHIBI_R * 1.1, "#e25d5d", [0, 0.08, -0.01], [1, 0.75, 1]);
      head.cyl(CHIBI_R * 1.08, 0.08, "#b8443f", [0, 0.05, -0.01], CHIBI_R * 1.08, 18);
      head.ball(0.06, WHITE, [0, 0.3, -0.02]);
      break;
    case "headphones": {
      const band = new THREE.Mesh(new THREE.TorusGeometry(CHIBI_R * 1.12, 0.022, 6, 20, Math.PI), toon(INK));
      band.castShadow = true;
      head.add(band);
      for (const s of [-1, 1]) {
        const cup = head.cyl(0.07, 0.07, INK, [s * 0.27, -0.02, 0], 0.07, 12);
        cup.rotation.z = (s * Math.PI) / 2;
        head.ball(0.045, "#3ddc84", [s * 0.31, -0.02, 0], [0.4, 1, 1]);
      }
      break;
    }
    case "crown": {
      head.cyl(0.13, 0.08, "#e9b73d", [0, 0.24, 0], 0.15, 10);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        head.cyl(0.03, 0.08, "#e9b73d", [Math.sin(a) * 0.13, 0.31, Math.cos(a) * 0.13], 0.002, 5);
      }
      head.ball(0.025, "#e25d5d", [0, 0.29, 0.15]);
      break;
    }
    case "none":
      break;
  }
}

/** A hat on a head of radius `r`, centred at `at`. */
function hatOn(head: Model, look: Look, r: number, at: V3): void {
  const g = head.part(at);
  g.scale.setScalar(r / CHIBI_R);
  hat(g, look);
}

// ——— Chibi ———
const HEAD_R = 0.25;

/** Hair for a head of radius `HEAD_R`; a receding hairline (`recede`) loses the fringe and the spikes. */
function chibiHair(head: Model, look: Look, c = look.hair, recede = false): void {
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(HEAD_R * 1.07, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
    toon(c),
  );
  cap.rotation.x = recede ? -1.05 : -0.62;
  cap.castShadow = true;
  head.add(cap);
  if (recede && look.style <= 1) return;
  // A fringe over the forehead.
  if (!recede) {
    head.ball(0.09, c, [-0.08, 0.17, 0.15], [1.3, 0.45, 0.7], 10);
    head.ball(0.08, c, [0.09, 0.18, 0.15], [1.2, 0.4, 0.7], 10);
  }
  switch (look.style) {
    case 1:
      for (let i = 0; i < 5; i++) {
        const a = -0.9 + i * 0.45;
        const spike = head.cyl(
          0.07,
          0.16,
          c,
          [Math.sin(a) * 0.12, 0.2, -0.03 + Math.cos(a) * 0.02],
          0.005,
          6,
        );
        spike.rotation.set(-0.5, 0, -a * 0.8);
      }
      break;
    case 2:
      head.box([0.54, 0.34, 0.3], c, [0, -0.2, -0.08], 0.12);
      break;
    case 3:
      head.ball(0.12, c, [0, 0.27, -0.1]);
      break;
    case 4: {
      head.ball(0.08, c, [0, 0.12, -0.26]);
      head.cyl(0.07, 0.3, c, [0, -0.2, -0.3], 0.04, 8).rotation.x = 0.2;
      break;
    }
  }
}

export function chibi(b: Model, look: Look): Rig {
  const HIP = 0.24;
  const NECK = 0.52;
  const [main, dark] = look.outfit;
  const faces: Rig["faces"] = [];
  const legs = legsOf(b, HIP, 0.075, (leg) => {
    leg.box([0.11, HIP - 0.04, 0.12], look.pants, [0, -HIP + 0.04, 0], 0.04);
    leg.box([0.12, 0.07, 0.17], INK, [0, -HIP, 0.025], 0.03);
  });
  b.box([0.3, 0.26, 0.2], main, [0, HIP - 0.02, 0], 0.08);
  b.box([0.31, 0.05, 0.21], dark, [0, HIP - 0.02, 0], 0.025);
  b.ball(0.06, dark, [0, NECK - 0.05, 0.06], [1.6, 0.5, 0.8]);
  const arms = armsOf(b, [0.18, NECK - 0.07, 0], (arm, s) => {
    arm.box([0.085, 0.16, 0.09], main, [0, -0.16, 0], 0.04).rotation.z = s * 0.08;
    arm.ball(0.05, look.skin, [s * 0.012, -0.19, 0]);
  });
  const head = b.part([0, NECK, 0]);
  const skull = head.ball(HEAD_R, look.skin, [0, HEAD_R * 0.86, 0], [1.05, 0.95, 1], 24);
  const face = decal(SPHERE_FACE, "chibi", faces);
  face.scale.setScalar(HEAD_R * 1.008);
  // Tipped down a little, so the eyes sit low and big under the fringe, as chibis' do.
  face.rotation.x = 0.26;
  skull.add(face);
  const top = head.part([0, HEAD_R * 0.86, 0]);
  chibiHair(top, look);
  hat(top, look);
  return { legs, arms, head, hip: HIP, height: NECK + HEAD_R * 1.81, faces };
}

// ——— Busytown animals ———
export interface Kind {
  fur: string;
  muzzle: string;
  nose: string;
  ears: "point" | "round" | "long" | "flop" | "pig" | "mouse";
  tail: "thin" | "bushy" | "puff" | "curl" | "stub";
  whiskers?: boolean;
  /** How much longer a grown-up's muzzle is. */
  snout?: number;
}

export const KINDS: Record<Animal, Kind> = {
  cat: { fur: "#f0a050", muzzle: "#fbe8d0", nose: "#f28bb2", ears: "point", tail: "thin", whiskers: true },
  dog: { fur: "#c98a4a", muzzle: "#f4e0c0", nose: INK, ears: "flop", tail: "stub", snout: 1.45 },
  bunny: { fur: "#eeeae6", muzzle: "#ffffff", nose: "#f28bb2", ears: "long", tail: "puff" },
  bear: { fur: "#8a5a3a", muzzle: "#d8b48a", nose: INK, ears: "round", tail: "stub", snout: 1.25 },
  pig: { fur: "#f5b0b8", muzzle: "#f08a9a", nose: "#e07a8a", ears: "pig", tail: "curl" },
  fox: { fur: "#e87a32", muzzle: "#fbf3e8", nose: INK, ears: "point", tail: "bushy", snout: 1.55 },
  mouse: { fur: "#a8a4b0", muzzle: "#e8e4ec", nose: "#f28bb2", ears: "mouse", tail: "thin", whiskers: true },
};

/** Busytown heads are this big; a smaller one is the same head, scaled. */
const ANIMAL_R = 0.23;

function animalTail(tail: Model, k: Kind, fur: string): void {
  switch (k.tail) {
    case "thin":
      tail.cyl(0.02, 0.32, fur, [0, 0, 0], 0.015, 6).rotation.x = -0.8;
      break;
    case "bushy":
      tail.ball(0.1, fur, [0, 0.08, -0.12], [0.8, 0.8, 1.6], 12);
      tail.ball(0.06, WHITE, [0, 0.13, -0.27], [0.9, 0.9, 1.2], 10);
      break;
    case "puff":
      tail.ball(0.07, WHITE, [0, 0, -0.02]);
      break;
    case "curl": {
      const curl = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 6, 12, Math.PI * 1.6), toon(fur));
      curl.position.set(0, 0.03, -0.04);
      curl.rotation.y = Math.PI / 2;
      tail.add(curl);
      break;
    }
    case "stub":
      tail.ball(0.045, fur, [0, 0.03, 0], [1, 1, 1.4]);
      break;
  }
}

/**
 * An animal's head of radius `ANIMAL_R`, centred on `g`: eyes painted on the skull, the mouth on a muzzle
 * `snout` times as long, a nose, whiskers and ears.
 */
function animalHead(
  g: Model,
  k: Kind,
  fur: string,
  faces: Rig["faces"],
  eyesKind: FaceKind,
  snout = 1,
): void {
  const R = ANIMAL_R;
  const skull = g.ball(R, fur, [0, 0, 0], [1.08, 0.95, 1], 24);
  const eyes = decal(SPHERE_FACE, eyesKind, faces);
  eyes.scale.setScalar(R * 1.008);
  eyes.rotation.x = -0.05;
  skull.add(eyes);
  const mz = R * 0.78 + (snout - 1) * 0.06;
  const muzzle = g.ball(0.1, k.muzzle, [0, -0.07, mz], [1.25, 0.8, 0.9 * snout], 18);
  const mouth = decal(SPHERE_FACE, "animal-mouth", faces);
  mouth.scale.set(0.101, 0.101, 0.101 / snout);
  muzzle.add(mouth);
  if (k.ears === "pig") {
    const snoutDisc = g.cyl(0.055, 0.05, k.nose, [0, -0.04, R * 0.95], 0.06, 16);
    snoutDisc.rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) g.ball(0.012, "#8a3a4a", [s * 0.02, -0.04, R * 0.95 + 0.055]);
  } else g.ball(0.035, k.nose, [0, -0.025 + (snout - 1) * 0.02, mz + 0.09 * snout + 0.01], [1.3, 0.9, 1]);
  if (k.whiskers)
    for (const s of [-1, 1])
      for (const tilt of [-0.15, 0.1]) {
        const w = g.cyl(0.004, 0.16, INK, [s * 0.1, -0.06, R * 0.85], 0.003, 3);
        w.rotation.set(0, 0, s * (Math.PI / 2 + tilt));
      }
  for (const s of [-1, 1]) {
    const e = g.part([s * R * 0.62, R * 0.7, -0.02]);
    switch (k.ears) {
      case "point":
        e.cyl(0.08, 0.14, fur, [0, 0, 0], 0.005, 4).rotation.set(0, Math.PI / 4, -s * 0.25);
        e.cyl(0.05, 0.09, "#f7c6d4", [0, 0.01, 0.025], 0.004, 4).rotation.set(0, Math.PI / 4, -s * 0.25);
        break;
      case "round":
        e.ball(0.065, fur, [s * 0.02, 0.02, 0], [1, 1, 0.6]);
        e.ball(0.04, k.muzzle, [s * 0.02, 0.02, 0.02], [1, 1, 0.5]);
        break;
      case "mouse":
        e.ball(0.1, fur, [s * 0.05, 0.04, 0], [1, 1, 0.35]);
        e.ball(0.07, "#f7c6d4", [s * 0.05, 0.04, 0.015], [1, 1, 0.3]);
        break;
      case "long":
        e.ball(0.06, fur, [s * 0.02, 0.18, 0], [0.8, 3, 0.5]).rotation.z = -s * 0.12;
        e.ball(0.035, "#f7c6d4", [s * 0.025, 0.18, 0.025], [0.8, 3.6, 0.4]).rotation.z = -s * 0.12;
        break;
      case "flop": {
        const flop = e.ball(0.08, tint(fur, -0.35), [s * 0.07, -0.13, 0.01], [0.55, 2.1, 0.9]);
        flop.rotation.z = s * 0.3;
        break;
      }
      case "pig":
        e.cyl(0.07, 0.09, fur, [0, 0, 0.02], 0.005, 4).rotation.set(0.5, Math.PI / 4, -s * 0.5);
        break;
    }
  }
}

export function animal(b: Model, look: Look): Rig {
  // People in Busytown are chibis.
  if (look.species === "human") return chibi(b, look);
  const k = KINDS[look.species];
  const HIP = 0.22;
  const NECK = 0.55;
  const R = ANIMAL_R;
  const [main, dark] = look.outfit;
  const faces: Rig["faces"] = [];
  const legs = legsOf(b, HIP, 0.08, (leg) => {
    leg.box([0.12, HIP - 0.05, 0.13], look.pants, [0, -HIP + 0.05, 0], 0.05);
    leg.box([0.13, 0.07, 0.19], "#6b4226", [0, -HIP, 0.03], 0.035);
  });
  // A round tummy in a shirt, under overalls with a bib and straps.
  b.ball(0.19, main, [0, HIP + 0.13, 0], [1, 1.05, 0.85], 18);
  b.box([0.34, 0.12, 0.27], look.pants, [0, HIP - 0.03, 0], 0.06);
  b.box([0.2, 0.15, 0.04], look.pants, [0, HIP + 0.07, 0.15], 0.02);
  for (const s of [-1, 1]) {
    const strap = b.box([0.04, 0.24, 0.03], look.pants, [s * 0.08, HIP + 0.12, 0.13], 0.01);
    strap.rotation.x = -0.25;
    b.ball(0.018, "#e9b73d", [s * 0.08, HIP + 0.19, 0.17]);
  }
  b.box([0.06, 0.04, 0.02], dark, [0, HIP + 0.15, 0.16], 0.01);
  animalTail(b.part([0, HIP + 0.04, -0.17]), k, k.fur);
  const arms = armsOf(b, [0.19, NECK - 0.1, 0], (arm, s) => {
    arm.box([0.09, 0.15, 0.1], main, [0, -0.14, 0], 0.045).rotation.z = s * 0.12;
    arm.ball(0.05, k.fur, [s * 0.02, -0.18, 0]);
  });
  const head = b.part([0, NECK, 0]);
  const c: V3 = [0, R * 0.85, 0];
  animalHead(head.part(c), k, k.fur, faces, "animal-eyes");
  hatOn(head, look, R * 1.05, c);
  return { legs, arms, head, hip: HIP, height: NECK + R * 1.8, faces };
}

// ——— Grown-ups: people and animals on one adult body, at any age ———
export const AGING: Record<Age, { width: number; grey: number; hunch: number }> = {
  young: { width: 0.94, grey: 0, hunch: 0 },
  adult: { width: 1.04, grey: 0, hunch: 0 },
  senior: { width: 1.06, grey: 0.7, hunch: 0.14 },
};
const GREY = new THREE.Color("#dcd8d4");
/** A colour gone `f` of the way to grey, as hair and fur do. */
export function greyed(hex: string, f: number): string {
  return `#${new THREE.Color(hex).lerp(GREY, f).getHexString()}`;
}

/** Round glasses, the lenses' centres `x` either side of the nose at height `y`, `z` out from the face. */
function glasses(g: Model, x: number, y: number, z: number, r: number): void {
  const ink = toon(INK);
  for (const s of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.16, 6, 18), ink);
    rim.position.set(s * x, y, z);
    g.add(rim);
    // The arm runs back from the rim's outer edge to the ear.
    g.box([r * 0.2, r * 0.2, z * 0.9], ink, [s * (x + r * 0.95), y - r * 0.1, z * 0.45], 0.002);
  }
  g.box([x * 2 - r * 2, r * 0.18, r * 0.2], ink, [0, y + r * 0.2, z], 0.002);
}

export function grown(b: Model, look: Look): Rig {
  const age = AGING[look.age];
  const kind = look.species === "human" ? undefined : KINDS[look.species];
  const HIP = 0.46;
  const KNEE = 0.24;
  const R = 0.145;
  const w = age.width;
  const skin = kind ? greyed(kind.fur, age.grey * 0.45) : look.skin;
  const hair = greyed(look.hair, age.grey);
  const [main, dark] = look.outfit;
  const senior = look.age === "senior";
  const shoe = senior ? "#5a3a2a" : INK;
  const faces: Rig["faces"] = [];
  const knees: Model[] = [];
  const legs = legsOf(b, HIP, 0.068, (leg) => {
    leg.box([0.105, HIP - KNEE, 0.115], look.pants, [0, -(HIP - KNEE), 0], 0.04);
    const knee = leg.part([0, -(HIP - KNEE), 0]);
    knee.box([0.1, KNEE - 0.05, 0.11], look.pants, [0, -KNEE + 0.05, 0], 0.035);
    knee.box([0.11, 0.07, 0.19], shoe, [0, -KNEE + 0.015, 0.03], 0.03);
    knee.box([0.115, 0.022, 0.2], senior ? "#2b2433" : WHITE, [0, -KNEE, 0.03], 0.008);
    knees.push(knee);
  });

  // Everything above the hips leans a little, with age.
  const chest = b.part([0, HIP, 0]);
  chest.rotation.x = age.hunch;
  chest.box([0.25 * w, 0.09, 0.16], look.pants, [0, -0.06, 0], 0.04);
  chest.box([0.29 * w, 0.34, 0.17], main, [0, 0, 0], 0.07);
  const short = look.top === "tee";
  switch (look.top) {
    case "tee":
      chest.cyl(0.065, 0.02, dark, [0, 0.33, 0], 0.065, 16);
      break;
    case "hoodie":
      chest.ball(0.1, tint(main, -0.1), [0, 0.32, -0.085], [1.5, 0.7, 1]);
      chest.box([0.2 * w, 0.09, 0.02], tint(main, -0.12), [0, 0.03, 0.08], 0.02);
      for (const s of [-1, 1]) chest.cyl(0.006, 0.08, WHITE, [s * 0.03, 0.22, 0.088], 0.006, 4);
      break;
    case "blazer":
      chest.box([0.08, 0.16, 0.02], WHITE, [0, 0.17, 0.075], 0.01);
      chest.box([0.026, 0.13, 0.01], dark, [0, 0.19, 0.088], 0.004);
      for (const s of [-1, 1]) {
        const lapel = chest.box([0.035, 0.17, 0.012], tint(main, -0.15), [s * 0.05, 0.16, 0.084], 0.005);
        lapel.rotation.z = s * 0.32;
      }
      for (const y of [0.06, 0.12]) chest.ball(0.012, dark, [0, y, 0.087]);
      break;
    case "cardigan":
      chest.box([0.09, 0.2, 0.02], WHITE, [0, 0.13, 0.072], 0.01);
      chest.box([0.3 * w, 0.045, 0.178], tint(main, -0.15), [0, 0, 0], 0.02);
      for (const y of [0.07, 0.13, 0.19]) chest.ball(0.011, dark, [0.03, y, 0.086]);
      break;
  }
  const arms = armsOf(chest, [0.175 * w, 0.3, 0], (arm, s) => {
    if (short) {
      arm.box([0.08, 0.12, 0.09], main, [0, -0.12, 0], 0.035).rotation.z = s * 0.06;
      arm.box([0.065, 0.2, 0.07], skin, [s * 0.008, -0.3, 0], 0.03).rotation.z = s * 0.06;
    } else arm.box([0.075, 0.29, 0.085], main, [0, -0.29, 0], 0.035).rotation.z = s * 0.06;
    arm.ball(0.042, skin, [s * 0.02, -0.32, 0]);
  });
  if (kind) animalTail(chest.part([0, -0.02, -0.09]), kind, skin);

  // The neck leans back as far as the back leans forward, so the head still looks ahead.
  const neck = chest.part([0, 0.33, 0]);
  neck.rotation.x = -age.hunch * 1.2;
  neck.cyl(0.045, 0.07, skin, [0, 0, 0], 0.045, 10);
  const head = neck.part([0, 0.05, 0]);
  const c: V3 = [0, R, 0];
  if (kind) {
    const g = head.part(c);
    g.scale.setScalar(R / ANIMAL_R);
    animalHead(g, kind, skin, faces, "adult-eyes", kind.snout);
    if (look.glasses) glasses(g, 0.083, 0.012, 0.225, 0.045);
  } else {
    const skull = head.ball(R, skin, c, [0.95, 1.1, 1], 24);
    const face = decal(SPHERE_FACE, "adult", faces);
    face.scale.setScalar(R * 1.008);
    skull.add(face);
    head.ball(0.024, tint(skin, -0.08), [0, c[1] - 0.03, R * 0.97], [0.85, 1.15, 0.9]);
    for (const s of [-1, 1]) head.ball(0.035, skin, [s * R * 0.92, c[1] - 0.01, -0.005], [0.45, 1, 0.75]);
    const top = head.part(c);
    top.scale.set((0.97 * R) / HEAD_R, (1.1 * R) / HEAD_R, R / HEAD_R);
    if (look.hat === "none" || look.hat === "headphones") chibiHair(top, look, hair, senior);
    if (look.beard >= 1) head.box([0.075, 0.017, 0.03], hair, [0, c[1] - 0.062, R * 0.92], 0.008);
    if (look.beard >= 2) {
      const beard = new THREE.Mesh(
        new THREE.SphereGeometry(R * 1.04, 20, 8, 0, Math.PI * 2, Math.PI * 0.7, Math.PI * 0.3),
        toon(hair),
      );
      beard.scale.set(0.97, 1.1, 1.02);
      beard.position.set(...c);
      beard.castShadow = true;
      head.add(beard);
    }
    if (look.glasses) glasses(head, 0.046, c[1] - 0.008, R * 1.02, 0.03);
  }
  hatOn(head, look, R * 1.05, [0, c[1] + R * 0.12, 0]);
  return {
    legs,
    knees: knees as [Model, Model],
    arms,
    head,
    hip: HIP,
    height: HIP + 0.38 + R * 2.1,
    faces,
  };
}

// ——— Bots ———
export function bot(b: Model, look: Look): Rig {
  const HIP = 0.2;
  const NECK = 0.48;
  const [main, dark] = look.outfit;
  const shell = "#eef0f4";
  const joint = "#5d6470";
  const faces: Rig["faces"] = [];
  const legs = legsOf(b, HIP, 0.08, (leg) => {
    leg.cyl(0.035, HIP - 0.04, joint, [0, -HIP + 0.05, 0], 0.035, 8);
    leg.box([0.12, 0.07, 0.17], main, [0, -HIP, 0.02], 0.035);
  });
  b.box([0.3, 0.26, 0.22], main, [0, HIP - 0.02, 0], 0.09);
  b.box([0.18, 0.09, 0.02], "#1b1f2a", [0, HIP + 0.08, 0.105], 0.02);
  const lights = [0, 1, 2].map((i) => {
    const m = glow("#3ddc84");
    b.box([0.035, 0.035, 0.01], m, [-0.05 + i * 0.05, HIP + 0.105, 0.118], 0.004);
    return m;
  });
  b.cyl(0.05, 0.05, joint, [0, NECK - 0.06, 0], 0.04, 10);
  const arms = armsOf(b, [0.17, NECK - 0.1, 0], (arm, s) => {
    arm.ball(0.045, joint, [0, 0, 0]);
    arm.cyl(0.025, 0.14, joint, [s * 0.01, -0.17, 0], 0.025, 8);
    arm.ball(0.05, dark, [s * 0.012, -0.19, 0]);
  });
  const head = b.part([0, NECK, 0]);
  head.box([0.46, 0.34, 0.32], shell, [0, 0, 0], 0.1);
  head.box([0.38, 0.25, 0.02], "#14171f", [0, 0.045, 0.155], 0.06);
  const face = decal(new THREE.PlaneGeometry(0.36, 0.18), "bot", faces, false);
  face.position.set(0, 0.17, 0.168);
  head.add(face);
  for (const s of [-1, 1]) {
    const ear = head.cyl(0.06, 0.04, main, [s * 0.24, 0.17, 0], 0.06, 14);
    ear.rotation.z = (s * Math.PI) / 2;
  }
  head.cyl(0.012, 0.14, joint, [0.08, 0.34, 0], 0.012, 6);
  const tip = glow("#ff7ab6");
  head.ball(0.035, tip, [0.08, 0.49, 0]);
  if (look.hat === "crown" || look.hat === "headphones") hatOn(head, look, 0.24, [0, 0.12, 0]);
  const seed = Math.random() * 10;
  return {
    legs,
    arms,
    head,
    hip: HIP,
    height: NECK + 0.38,
    faces,
    tick: (t) => {
      tip.color.set(Math.sin(t * 3 + seed) > 0 ? "#ff7ab6" : "#5a2a40");
      lights.forEach((m, i) => {
        m.color.set(Math.sin(t * 5 + i * 1.7 + seed) > 0 ? "#3ddc84" : "#1b3a2a");
      });
    },
  };
}
