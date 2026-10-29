/**
 * Voxel folk: people and animals built from cubes, like a MagicaVoxel character pack. Each body part is
 * one mesh of its cubes' outer faces, darker where cubes meet (ambient occlusion), and the face is pixel
 * art laid over the front of the head, so it still changes with the mood.
 *
 * In cubes: legs 9 tall (bending at the knee), a body 8 tall, a 7×7×7 head and a cube of hair on top.
 */
import * as THREE from "three";
import { type Model, tint, toon, type V3 } from "../kit/kit.ts";
import { type FaceKind, voxelGlasses } from "./faces.ts";
import { AGING, decal, greyed, INK, KINDS, type Kind, type Look, type Rig, WHITE } from "./styles.ts";

/** One cube, in metres. */
const V = 0.045;
const HIP = 9;
const BODY = 8;
const HEAD = 7;

const VOX = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toon(WHITE).gradientMap });

type Axis = 0 | 1 | 2;
/** The six sides of a cube: the axis it faces along, and its corners, wound to face outwards. */
const SIDES = ([0, 1, 2] as const).flatMap((axis) =>
  [1, -1].map((sign) => {
    const normal: V3 = [0, 0, 0];
    normal[axis] = sign;
    const corners = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    const [u, w] = [(axis + 1) % 3, (axis + 2) % 3] as Axis[];
    return { axis, sign, normal, u: u!, w: w!, corners: sign > 0 ? corners : corners.reverse() };
  }),
);

/** A grid of coloured cubes; the cube at (x, y, z) fills [x, x+1] on each axis. */
class Voxels {
  private readonly cells = new Map<string, THREE.Color>();

  has(x: number, y: number, z: number): boolean {
    return this.cells.has(`${x},${y},${z}`);
  }

  /** Fills the `w`×`h`×`d` box from (x, y, z). */
  fill(x: number, y: number, z: number, w: number, h: number, d: number, color: string): this {
    const c = new THREE.Color(color);
    for (let i = x; i < x + w; i++)
      for (let j = y; j < y + h; j++) for (let k = z; k < z + d; k++) this.cells.set(`${i},${j},${k}`, c);
    return this;
  }

  /** Recolours the cubes already in the box. */
  paint(x: number, y: number, z: number, w: number, h: number, d: number, color: string): this {
    const c = new THREE.Color(color);
    for (let i = x; i < x + w; i++)
      for (let j = y; j < y + h; j++)
        for (let k = z; k < z + d; k++) if (this.has(i, j, k)) this.cells.set(`${i},${j},${k}`, c);
    return this;
  }

  /** The faces no other cube covers, as one mesh, with `origin` (in cubes) at its local origin. */
  mesh(origin: V3): THREE.Mesh {
    const position: number[] = [];
    const normal: number[] = [];
    const color: number[] = [];
    const index: number[] = [];
    for (const [key, c] of this.cells) {
      const cell = key.split(",").map(Number) as V3;
      for (const side of SIDES) {
        const out: V3 = [...cell];
        out[side.axis] += side.sign;
        if (this.has(...out)) continue;
        const base = position.length / 3;
        for (const [du, dw] of side.corners) {
          const p: V3 = [...cell];
          if (side.sign > 0) p[side.axis] += 1;
          p[side.u] += du!;
          p[side.w] += dw!;
          position.push((p[0] - origin[0]) * V, (p[1] - origin[1]) * V, (p[2] - origin[2]) * V);
          normal.push(...side.normal);
          // A corner is darker for each cube beside it in the layer the face looks into.
          const a: V3 = [...out];
          a[side.u] += du ? 1 : -1;
          const b: V3 = [...out];
          b[side.w] += dw ? 1 : -1;
          const ab: V3 = [...a];
          ab[side.w] += dw ? 1 : -1;
          const [sa, sb] = [this.has(...a), this.has(...b)];
          const open = sa && sb ? 0 : 3 - Number(sa) - Number(sb) - Number(this.has(...ab));
          const f = 0.7 + (0.3 * open) / 3;
          color.push(c.r * f, c.g * f, c.b * f);
        }
        index.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(normal, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(color, 3));
    g.setIndex(index);
    const m = new THREE.Mesh(g, VOX);
    m.castShadow = m.receiveShadow = true;
    // Already cubes: the Voxel render style leaves them be.
    m.userData.noBlock = true;
    return m;
  }
}

/** The 7×7 front of a head, for a pixel face. */
const FACE = new THREE.PlaneGeometry(HEAD * V, HEAD * V).translate(0, (HEAD * V) / 2, 0);

function face(head: Model, kind: FaceKind, faces: Rig["faces"], z: number): void {
  const m = decal(FACE, kind, faces);
  m.position.z = z * V + 0.002;
  head.add(m);
}

// ——— The body ———
function torso(look: Look, skin: string): Voxels {
  const [main, dark] = look.outfit;
  const t = new Voxels().fill(-3, 0, -2, 7, BODY, 4, main);
  // The front is the layer at z = 1.
  const front = (x: number, y: number, w: number, h: number, c: string) => t.paint(x, y, 1, w, h, 1, c);
  t.paint(-3, 0, -2, 7, 1, 4, look.pants);
  switch (look.job) {
    case "chef":
      t.paint(-3, 1, -2, 7, BODY - 1, 4, WHITE);
      for (const y of [2, 4, 6]) for (const x of [-1, 1]) front(x, y, 1, 1, "#9aa0aa");
      front(-1, 7, 3, 1, "#e25d5d");
      return t;
    case "officer": {
      const navy = "#2c3e6b";
      t.paint(-3, 1, -2, 7, BODY - 1, 4, navy);
      t.paint(-3, 0, -2, 7, 1, 4, INK);
      for (const y of [2, 4, 6]) front(0, y, 1, 1, "#e9b73d");
      front(-2, 5, 1, 1, "#e9b73d");
      front(-1, 7, 3, 1, WHITE);
      return t;
    }
    case "farmer":
      // Overalls over a tee.
      t.paint(-3, 0, -2, 7, 4, 4, look.pants);
      front(-2, 4, 5, 2, look.pants);
      front(-2, 6, 1, 2, look.pants);
      front(2, 6, 1, 2, look.pants);
      t.paint(-2, 4, -2, 1, 4, 1, look.pants).paint(2, 4, -2, 1, 4, 1, look.pants);
      front(-2, 5, 1, 1, "#e9b73d");
      front(2, 5, 1, 1, "#e9b73d");
      front(-1, 7, 3, 1, skin);
      return t;
    case undefined:
      break;
  }
  switch (look.top) {
    case "tee":
      front(-1, 7, 3, 1, skin);
      front(0, 6, 1, 1, skin);
      break;
    case "hoodie": {
      const shade = tint(main, -0.15);
      t.fill(-2, 5, -3, 5, 3, 1, shade);
      front(-2, 1, 5, 2, shade);
      front(-1, 5, 1, 2, WHITE);
      front(1, 5, 1, 2, WHITE);
      front(0, 7, 1, 1, skin);
      break;
    }
    case "blazer":
      front(0, 2, 1, 6, WHITE);
      front(0, 3, 1, 4, dark);
      front(-1, 5, 1, 3, tint(main, -0.2));
      front(1, 5, 1, 3, tint(main, -0.2));
      break;
    case "cardigan":
      t.paint(-3, 1, -2, 7, 1, 4, tint(main, -0.15));
      front(-1, 7, 3, 1, WHITE);
      front(0, 6, 1, 1, WHITE);
      for (const y of [2, 4]) front(0, y, 1, 1, dark);
      break;
  }
  return t;
}

/** Long sleeves end in hands; a tee's stop short of the elbow. */
function arm(look: Look, skin: string, cane: boolean): Voxels {
  const [main] = look.outfit;
  const sleeve = look.job === "chef" ? WHITE : look.job === "officer" ? "#2c3e6b" : main;
  const short = !look.job && look.top === "tee";
  const a = new Voxels().fill(-1, -8, -1, 2, 8, 2, skin);
  a.paint(-1, short ? -3 : -6, -1, 2, short ? 3 : 6, 2, sleeve);
  // A walking stick, from the hand to the floor.
  if (cane) a.fill(-1, -17, 1, 1, 10, 1, "#7a4a2a").fill(-1, -7, 1, 1, 1, 1, "#7a4a2a");
  return a;
}

function tail(t: Voxels, k: Kind, fur: string): void {
  switch (k.tail) {
    case "thin":
      t.fill(0, 0, -3, 1, 1, 1, fur).fill(0, 1, -4, 1, 2, 1, fur).fill(0, 3, -5, 1, 1, 1, fur);
      break;
    case "bushy":
      t.fill(-1, 0, -4, 2, 2, 2, fur).fill(-1, 1, -5, 2, 2, 1, fur).fill(-1, 2, -6, 2, 1, 1, WHITE);
      break;
    case "puff":
      t.fill(-1, 0, -3, 2, 2, 1, WHITE);
      break;
    case "curl":
      t.fill(0, 1, -3, 1, 1, 1, fur).fill(0, 2, -4, 1, 1, 1, fur).fill(0, 1, -5, 1, 1, 1, fur);
      break;
    case "stub":
      t.fill(0, 1, -3, 1, 1, 1, fur);
      break;
  }
}

// ——— Heads: the cube is x and z from -3 to 3, y from 0 to 6; the face is the z = 3 layer ———
function hair(h: Voxels, look: Look, c: string, recede: boolean, hatted: boolean): void {
  if (recede) {
    h.paint(-3, 2, -3, 7, 4, 1, c);
    h.paint(-3, 3, -3, 1, 3, 4, c).paint(3, 3, -3, 1, 3, 4, c);
    return;
  }
  h.fill(-3, 7, -3, 7, 1, 7, c);
  h.paint(-3, 6, -3, 7, 1, 7, c);
  h.paint(-3, 2, -3, 7, 5, 1, c);
  h.paint(-3, 4, -3, 1, 3, 7, c).paint(3, 4, -3, 1, 3, 7, c);
  if (hatted) return;
  switch (look.style) {
    case 1:
      for (let x = -3; x <= 3; x++)
        for (let z = -3; z <= 3; z++) if ((x * 3 + z * 5 + 9) % 4 === 0) h.fill(x, 8, z, 1, 1, 1, c);
      break;
    case 2:
      h.fill(-4, 1, -3, 1, 7, 6, c).fill(4, 1, -3, 1, 7, 6, c).fill(-3, 0, -4, 7, 8, 1, c);
      h.paint(-3, 5, 3, 2, 1, 1, c).paint(2, 5, 3, 2, 1, 1, c);
      break;
    case 3:
      h.fill(-1, 8, -2, 3, 2, 3, c);
      break;
    case 4:
      h.fill(-1, 6, -4, 3, 1, 1, c).fill(0, 1, -4, 1, 5, 1, c);
      break;
  }
}

function hat(h: Voxels, look: Look): void {
  const [main, dark] = look.outfit;
  switch (look.job) {
    case "chef":
      h.fill(-3, 7, -3, 7, 1, 7, WHITE).fill(-4, 8, -4, 9, 3, 9, WHITE);
      return;
    case "farmer": {
      const straw = "#e9c46a";
      h.fill(-5, 7, -5, 11, 1, 11, straw)
        .fill(-3, 8, -3, 7, 2, 7, straw)
        .paint(-3, 8, -3, 7, 1, 7, "#c0392b");
      return;
    }
    case "officer":
      h.fill(-3, 7, -3, 7, 2, 7, "#2c3e6b").fill(-3, 7, 4, 7, 1, 1, INK).paint(0, 8, 3, 1, 1, 1, "#e9b73d");
      return;
    case undefined:
      break;
  }
  switch (look.hat) {
    case "cap":
      h.fill(-3, 7, -3, 7, 2, 7, main).fill(-3, 7, 4, 7, 1, 2, dark);
      break;
    case "beanie":
      h.fill(-3, 7, -3, 7, 2, 7, "#e25d5d").fill(-2, 9, -2, 5, 1, 5, "#e25d5d");
      h.paint(-3, 6, -3, 7, 1, 7, "#b8443f").fill(0, 10, 0, 1, 1, 1, WHITE);
      break;
    case "headphones":
      h.fill(-3, 8, 0, 7, 1, 1, INK).fill(-4, 4, 0, 1, 4, 1, INK).fill(4, 4, 0, 1, 4, 1, INK);
      h.fill(-4, 2, -1, 1, 3, 3, INK).fill(4, 2, -1, 1, 3, 3, INK);
      h.fill(-5, 3, 0, 1, 1, 1, "#3ddc84").fill(5, 3, 0, 1, 1, 1, "#3ddc84");
      break;
    case "crown": {
      const gold = "#e9b73d";
      for (let x = -3; x <= 3; x++)
        for (let z = -3; z <= 3; z++)
          if (Math.abs(x) === 3 || Math.abs(z) === 3) h.fill(x, 7, z, 1, 1, 1, gold);
      for (const [x, z] of [
        [-3, -3],
        [3, -3],
        [-3, 3],
        [3, 3],
        [0, 3],
        [0, -3],
        [-3, 0],
        [3, 0],
      ] as const)
        h.fill(x, 8, z, 1, 1, 1, gold);
      h.paint(0, 7, 3, 1, 1, 1, "#e25d5d");
      break;
    }
    case "none":
      break;
  }
}

/**
 * A handlebar: a bar one cube proud of the face across the nose's row, its ends dropping a row and then
 * curling up past the cheeks, a cube out at each side. Wider than the mouth, which is the row below.
 */
function moustache(h: Voxels, hair: string): void {
  const tip = tint(hair, -0.18);
  h.fill(-3, 2, 4, 3, 1, 1, hair).fill(1, 2, 4, 3, 1, 1, hair);
  h.fill(-3, 1, 4, 1, 1, 1, hair).fill(3, 1, 4, 1, 1, 1, hair);
  h.fill(-4, 2, 3, 1, 2, 1, tip).fill(4, 2, 3, 1, 2, 1, tip);
}

function humanHead(h: Voxels, look: Look, skin: string, hairColor: string): void {
  h.fill(0, 2, 4, 1, 1, 1, tint(skin, -0.1));
  h.fill(-4, 2, 0, 1, 2, 1, skin).fill(4, 2, 0, 1, 2, 1, skin);
  const hatted = look.hat !== "none" || !!look.job || !!look.covered;
  hair(h, look, hairColor, look.age === "senior" && look.style <= 1, hatted && look.hat !== "headphones");
  if (look.beard >= 1) moustache(h, hairColor);
  if (look.beard >= 2) {
    h.paint(-3, 0, 3, 7, 1, 1, hairColor);
    h.paint(-3, 1, 3, 2, 1, 1, hairColor).paint(2, 1, 3, 2, 1, 1, hairColor);
    h.paint(-3, 0, -2, 1, 4, 6, hairColor).paint(3, 0, -2, 1, 4, 6, hairColor);
    h.fill(-2, -1, 1, 5, 1, 3, hairColor);
  }
  hat(h, look);
}

/** An animal's head; returns how far its muzzle sticks out, if the mouth is on it. */
function animalHead(h: Voxels, k: Kind, fur: string): number {
  const inner = "#f7c6d4";
  const muzzle = k.snout ? Math.round(k.snout * 2 - 1.5) : 0;
  if (k.ears === "pig") h.fill(-1, 2, 4, 3, 1, 1, k.nose);
  else if (muzzle) {
    h.fill(-1, 0, 4, 3, 2, muzzle, k.muzzle).fill(0, 2, 3 + muzzle, 1, 1, 1, k.nose);
    h.paint(-1, 2, 4, 3, 1, muzzle - 1, k.muzzle);
  } else h.paint(-1, 0, 3, 3, 3, 1, k.muzzle).fill(0, 2, 4, 1, 1, 1, k.nose);
  for (const s of [-1, 1]) {
    switch (k.ears) {
      case "point":
        h.fill(s > 0 ? 2 : -3, 7, -1, 2, 1, 2, fur).fill(s > 0 ? 3 : -3, 8, -1, 1, 1, 2, fur);
        h.paint(s > 0 ? 2 : -2, 7, 0, 1, 1, 1, inner);
        break;
      case "round":
        h.fill(s > 0 ? 2 : -3, 7, -1, 2, 2, 1, fur).paint(s > 0 ? 2 : -2, 7, -1, 1, 1, 1, k.muzzle);
        break;
      case "mouse":
        h.fill(s > 0 ? 3 : -5, 6, -1, 3, 3, 1, fur).paint(s > 0 ? 4 : -4, 7, -1, 1, 1, 1, inner);
        break;
      case "long":
        h.fill(s > 0 ? 1 : -2, 7, -1, 2, 5, 1, fur).paint(s > 0 ? 1 : -1, 8, -1, 1, 3, 1, inner);
        break;
      case "flop":
        h.fill(s * 4, 2, -1, 1, 5, 2, tint(fur, -0.3));
        break;
      case "pig":
        h.fill(s > 0 ? 2 : -3, 7, 0, 2, 1, 2, fur);
        break;
    }
  }
  return k.ears === "pig" ? 0 : muzzle;
}

export function voxel(b: Model, look: Look): Rig {
  const age = AGING[look.age];
  const kind = look.species === "human" ? undefined : KINDS[look.species];
  const senior = look.age === "senior";
  const skin = kind ? greyed(kind.fur, age.grey * 0.45) : look.skin;
  const faces: Rig["faces"] = [];

  const knees: Model[] = [];
  const shoe = senior ? "#5a3a2a" : look.job === "officer" ? INK : "#3a3a48";
  const legs = [-1, 1].map((s) => {
    const leg = b.part([s * 2 * V, HIP * V, 0]);
    leg.add(new Voxels().fill(-1, -4, -1, 3, 4, 3, look.pants).mesh([0.5, 0, 0.5]));
    const knee = leg.part([0, -4 * V, 0]);
    const shin = new Voxels().fill(-1, -5, -1, 3, 5, 3, look.pants).fill(-1, -5, -1, 3, 2, 4, shoe);
    if (!senior) shin.paint(-1, -5, -1, 3, 1, 4, WHITE);
    knee.add(shin.mesh([0.5, 0, 0.5]));
    knees.push(knee);
    return leg;
  }) as [Model, Model];

  const chest = b.part([0, HIP * V, 0]);
  chest.rotation.x = age.hunch;
  const body = torso(look, skin);
  if (kind) tail(body, kind, skin);
  chest.add(body.mesh([0.5, 0, 0]));
  const arms = [-1, 1].map((s) => {
    const a = chest.part([s * 4.5 * V, BODY * V, 0]);
    a.add(arm(look, skin, senior && s > 0).mesh([0, 0, 0]));
    return a;
  }) as [Model, Model];

  const neck = chest.part([0, BODY * V, 0]);
  neck.rotation.x = -age.hunch * 1.2;
  const head = neck.part();
  const h = new Voxels().fill(-3, 0, -3, HEAD, HEAD, HEAD, skin);
  if (kind) {
    const muzzle = animalHead(h, kind, skin);
    face(head, muzzle ? "voxel-eyes" : "voxel", faces, 3.5);
    if (muzzle) face(head, "voxel-mouth", faces, 3.5 + muzzle);
  } else {
    humanHead(h, look, skin, greyed(look.hair, age.grey));
    face(head, "voxel", faces, 3.5);
  }
  if (look.glasses) {
    const specs = new THREE.Mesh(
      FACE,
      new THREE.MeshToonMaterial({ map: voxelGlasses(), transparent: true, depthWrite: false }),
    );
    specs.position.z = 3.5 * V + 0.004;
    head.add(specs);
  }
  head.add(h.mesh([0.5, 0, 0.5]));
  return {
    legs,
    knees: knees as [Model, Model],
    arms,
    head,
    hip: HIP * V,
    height: (HIP + BODY + HEAD + 1) * V,
    faces,
  };
}
