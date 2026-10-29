/**
 * Pets in 3D: every look of every pet in the 2D game (`web/src/art/pet-variants/*`, `art/pets.ts`,
 * `art/loot.ts`), built from the kit's boxes and balls with the colours of the 2D palettes, plus the
 * Easter-egg costumes (Penny, Nemo), pet gear, the Lv50 crown, a sitting and a sleeping pose
 * (`art/pet-sleep.ts`) and the pet bed (tile Q). Additive to `avatar.ts`'s `Pet`: a `Pet3D` has the same
 * `root` / `moving` / `update(t)`, so it can stand in for one.
 */
import * as THREE from "three";
import { C } from "../../art/palette.ts";
import { PET_NAME, PET_NAMED, PET_VARIANTS, PETWEAR, type Species, speciesAt } from "../data/pets.ts";
import type { Asset } from "../furniture/furniture.ts";
import { glow, liveModel, Model, toon } from "../kit/kit.ts";
import { gaitSettled, newGait, stepGait, walkPose } from "../people/motion.ts";
import { Freezer, TINY_PX, view } from "../perf/freeze.ts";
import { dragon, duck, ghost, goldfish, golem, orb, piggy } from "./pets3d-misc.ts";
import { crane, kitsune, koi, maneki, tanuki, tengu } from "./pets3d-night.ts";
import { fenrir, hildisvini, huginn, ratatoskr, sleipnir, tanngrisnir } from "./pets3d-norse.ts";
import { NUSANTARA_PETS } from "./pets3d-nusantara.ts";
import { POND_PETS } from "./pets3d-pond.ts";
import { quad } from "./pets3d-quad.ts";
import type { Rig } from "./petvox.ts";

export type { Species } from "../data/pets.ts";

/** The Ragnarok Eve case's pets (`pets3d-norse.ts`), by species. */
const NORSE = { huginn, ratatoskr, tanngrisnir, hildisvini, sleipnir, fenrir };
export type PetPose = "stand" | "sit" | "sleep";

type Mesh = THREE.Mesh;
const SIDES = [-1, 1] as const;

// MARK: Pet gear and the crown

/** Gear sits on the neck or the top of the head; sized by the pet's neck. */
function gear(wear: number, rig: Rig): { group: Model; spin?: THREE.Object3D } | null {
  const w = PETWEAR[wear - 1];
  if (!w) return null;
  const g = new Model();
  const r = rig.neckR;
  const gs = Math.max(0.6, r / 0.09);
  let spin: THREE.Object3D | undefined;
  switch (wear) {
    case 1: // Red bandana: a knot at the back and a point down the chest.
      g.cyl(r * 1.04, 0.035, "#d23c3c", [0, -0.03, 0], r * 1.04, 14);
      g.cyl(0.004, 0.1 * gs, "#d23c3c", [0, -0.14 * gs, r * 0.55], r * 0.95, 4).rotation.y = Math.PI / 4;
      g.ball(0.02, "#962626", [0, -0.015, -r], [1, 1, 1], 6);
      break;
    case 2: // Pink bow.
      for (const s of SIDES)
        g.ball(0.04 * gs, "#ff7fb0", [0.06 * gs + s * 0.04 * gs, 0.01, 0], [1.1, 0.8, 0.5], 8).rotation.z =
          s * 0.3;
      g.ball(0.02 * gs, "#c23a6b", [0.06 * gs, 0.01, 0.005], [1, 1, 1], 6);
      break;
    case 3: // Bow tie.
      for (const s of SIDES)
        g.cyl(0.001, 0.05 * gs, "#2a3a8a", [0, -0.04, r * 0.85], 0.025 * gs, 4).rotation.z =
          s * (Math.PI / 2);
      g.ball(0.016 * gs, "#f5c842", [0, -0.04, r * 0.88], [1, 1, 1], 6);
      break;
    case 4: // Party hat.
      g.cyl(0.05 * gs, 0.14 * gs, "#4f8fe0", [0, -0.005, 0], 0.004, 12);
      g.cyl(0.036 * gs, 0.02 * gs, "#f5d14a", [0, 0.04 * gs, 0], 0.032 * gs, 12);
      g.ball(0.02 * gs, C.white, [0, 0.14 * gs, 0], [1, 1, 1], 8);
      break;
    case 5: // Gold collar with its tag.
      g.cyl(r * 1.03, 0.028, "#f5c842", [0, -0.03, 0], r * 1.03, 14);
      g.ball(0.022, "#fff2a8", [0, -0.05, r * 1.02], [1, 1, 0.5], 8);
      break;
    case 6: {
      // Propeller cap: a yellow cap, three blades that spin.
      g.ball(0.052 * gs, "#f5d14a", [0, 0.0, 0], [1, 0.62, 1], 12);
      g.box([0.07 * gs, 0.012, 0.035 * gs], "#c9971f", [0, 0.0, 0.05 * gs], 0.004);
      g.cyl(0.006, 0.03, "#2b2433", [0, 0.025 * gs, 0], 0.006, 5);
      const hub = g.part([0, 0.055 * gs, 0]);
      (["#e0584f", "#3ddc84", "#4f8fe0"] as const).forEach((c, i) => {
        const blade = hub.part([0, 0, 0], (i * Math.PI * 2) / 3);
        blade.box([0.016, 0.006, 0.06 * gs], c, [0, 0, 0.032 * gs], 0.002);
      });
      spin = hub;
      break;
    }
    case 7: // Winter scarf: red and white rings, an end hanging down the shoulder.
      for (let i = 0; i < 3; i++)
        g.cyl(r * 1.08, 0.022, i % 2 ? C.white : "#d23c3c", [0, -0.055 + i * 0.02, 0], r * 1.08, 14);
      for (let i = 0; i < 4; i++)
        g.box(
          [0.03, 0.025, 0.012],
          i % 2 ? C.white : "#d23c3c",
          [r * 0.8, -0.1 - i * 0.025, r * 0.55],
          0.004,
        );
      break;
  }
  return { group: g, spin };
}

/** The Lv50 crown: gold with a red stone, and a few stars about it. */
function makeCrown(rig: Rig, lift: number): { group: Model; stars: Mesh[] } {
  const g = new Model();
  const s = Math.max(0.7, rig.neckR / 0.09);
  g.cyl(0.05 * s, 0.03 * s, "#c98e22", [0, lift, 0], 0.05 * s, 14);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.cyl(
      0.015 * s,
      0.045 * s,
      "#ffe066",
      [Math.cos(a) * 0.04 * s, lift + 0.02 * s, Math.sin(a) * 0.04 * s],
      0.002,
      4,
    );
  }
  g.ball(0.014 * s, glow("#e0405a"), [0, lift + 0.015 * s, 0.052 * s], [1, 1, 0.6], 8);
  const stars = [0, 1, 2].map(() => g.ball(0.011, glow("#fff1a8"), [0, 0, 0], [1, 1, 1], 4));
  return { group: g, stars };
}

/** A little lit "z" made of three bars. */
function zGlyph(): Model {
  const z = new Model();
  const lit = glow("#eef4ff");
  z.box([0.12, 0.035, 0.035], lit, [0, 0.1, 0], 0.008);
  z.box([0.12, 0.035, 0.035], lit, [0, 0, 0], 0.008);
  z.box([0.15, 0.035, 0.035], lit, [0, 0.05, 0], 0.008).rotation.z = 0.85;
  z.visible = false;
  return z;
}

// MARK: The pet

/** A pet from the 2D game. Same `root` / `moving` / `update(t)` as `avatar.ts`'s `Pet`, plus poses and gear. */
export class Pet3D {
  readonly root = liveModel();
  moving = false;
  pose: PetPose = "stand";
  /** `Look.petwear`: 0 is none, 1 to 7 the gear (`PETWEAR`). */
  wear = 0;
  /** An owner at Lv50 and above has their pet crowned. */
  crown = false;
  private readonly lift = this.root.part();
  private readonly body: THREE.Group;
  private readonly fore: THREE.Group;
  private readonly rig: Rig;
  private sit = 0;
  private sleep = 0;
  private last = 0;
  /** The trot: driven by the ground covered (`update`'s `moved`), assumed at `nominalSpeed` when not told. */
  private readonly gait = newGait(Math.random());
  nominalSpeed = 1.6;
  private readonly at = new THREE.Vector3();
  private blinkAt = 2;
  private worn = 0;
  private wornGroup?: THREE.Object3D;
  private spin?: THREE.Object3D;
  private crowned: {
    group: THREE.Object3D;
    stars: Mesh[];
    lifted: boolean;
  } | null = null;
  private readonly zs = [zGlyph(), zGlyph(), zGlyph()];
  private readonly freezer = new Freezer(this.root);

  constructor(
    readonly species: Species,
    readonly variant = "",
    /** The costume id when named like a 2D Easter egg. */
    readonly outfit: string | null = null,
  ) {
    const nusantara = (NUSANTARA_PETS as Partial<Record<Species, () => ReturnType<typeof koi>>>)[species];
    const pond = (POND_PETS as Partial<Record<Species, () => ReturnType<typeof koi>>>)[species];
    const built = nusantara
      ? nusantara()
      : pond
        ? pond()
        : species === "duck"
          ? duck(variant)
          : species === "dragon"
            ? dragon(variant)
            : species === "golem"
              ? golem()
              : species === "goldfish"
                ? goldfish()
                : species === "ghost"
                  ? ghost()
                  : species === "piggy"
                    ? piggy()
                    : species === "koi"
                      ? koi()
                      : species === "crane"
                        ? crane()
                        : species === "tanuki"
                          ? tanuki()
                          : species === "maneki"
                            ? maneki()
                            : species === "kitsune"
                              ? kitsune()
                              : species === "tengu"
                                ? tengu()
                                : species in NORSE
                                  ? NORSE[species as keyof typeof NORSE]()
                                  : species === "cat" ||
                                      species === "dog" ||
                                      species === "panda" ||
                                      species === "forkedcat"
                                    ? quad(species, variant, outfit)
                                    : orb();
    this.root.userData.actor = true;
    const { body: b, fore: f } = built;
    this.rig = built.rig;
    // Stand centred on the root, nose towards +z.
    b.position.z = f.position.z = -this.rig.span / 2;
    this.body = b;
    this.fore = f;
    this.lift.add(b, f);
    this.lift.position.y = this.rig.float ?? 0;
    for (const z of this.zs) this.root.add(z);
  }

  /** The tag a pet is shown under. */
  get label(): string {
    return PET_NAME[this.species];
  }

  update(t: number, moved?: number): void {
    const dt = Math.min(0.1, Math.max(0, t - this.last));
    const walking = this.moving && this.pose === "stand";
    stepGait(this.gait, moved ?? (walking ? this.nominalSpeed * dt : 0), dt, walking);
    const e = this.root.matrixWorld.elements;
    this.at.set(e[12]!, e[13]!, e[14]!);
    if (!view.sees(this.at, 1.5)) {
      this.freezer.touch();
      this.last = t;
      return;
    }
    // At rest (standing or sitting, nothing spinning or sparkling) a pet is merged into a few meshes.
    const settled = Math.abs(this.sit - (this.pose === "sit" ? 1 : 0)) < 0.01 && this.sleep < 0.01;
    const calm =
      !this.moving &&
      gaitSettled(this.gait) &&
      settled &&
      !this.crown &&
      !this.spin &&
      !this.rig.fx &&
      this.pose !== "sleep";
    // Far down the crowd, or a few pixels tall (a display in a shop window seen from the street): a stride, a breath or
    // a blink is invisible, so it is drawn frozen whatever it does. Height: about half a unit, times the scale it is drawn at.
    const tiny = Math.hypot(e[4]!, e[5]!, e[6]!) * 0.5 * view.pxPerUnit < TINY_PX;
    const far = (this.root.userData.lod || tiny) && !this.crown && !this.spin && !this.rig.fx;
    const key = far ? "far" : calm ? `${this.pose}:${this.wear}` : null;
    if (this.freezer.holds(key)) {
      this.last = t;
      return;
    }
    this.posed(t);
    this.freezer.settle(key);
  }

  dispose(): void {
    this.freezer.dispose();
  }

  private posed(t: number): void {
    const dt = Math.min(0.1, Math.max(0, t - this.last));
    this.last = t;
    const r = this.rig;
    const k = 1 - Math.exp(-dt * 7);
    this.sit += ((this.pose === "sit" ? 1 : 0) - this.sit) * k;
    this.sleep += ((this.pose === "sleep" ? 1 : 0) - this.sleep) * k;
    const si = this.sit;
    const sl = this.sleep;
    const walk = this.moving && this.pose === "stand";
    const b = this.body;
    // Posture: sit back on the haunches (or settle); lie down curled up and breathe.
    const breath = Math.sin(t * 2.2) * 0.025 * sl;
    b.rotation.x = r.tilt ? -0.62 * si : 0;
    // The trot: the people's cycle at twice the cadence, settling to rest instead of stopping dead.
    const trot = walkPose(this.gait.phase * 2, this.gait.weight);
    b.rotation.z = trot.sway * 2;
    b.position.y = (r.tilt ? 0 : -0.07 * si) - 0.04 * sl + trot.bob * 1.6;
    b.scale.set(1 + 0.05 * sl, 1 - 0.28 * sl + breath, 1);
    this.fore.position.y = b.position.y;
    r.head.rotation.x = (r.tilt ? 0.55 * si : 0) + 0.6 * sl;
    const stretch = r.tilt ? 1 + (r.sitStretch ?? 1.3) * si : 1 - 0.2 * si;
    for (const l of r.fore) l.scale.y = l.userData.paw ? 1 : stretch * (1 - 0.7 * sl);
    for (const l of r.hind) l.scale.y = l.userData.paw ? 1 : (1 - 0.5 * si) * (1 - 0.7 * sl);
    this.lift.position.y = (r.float ?? 0) * (1 - 0.75 * sl) + (r.float ? Math.sin(t * 2) * 0.03 : 0);
    // Eyes: blink now and then, shut when asleep.
    if (t > this.blinkAt + 0.12) this.blinkAt = t + 2 + ((t * 7) % 3);
    const shut = Math.max(sl, t > this.blinkAt && t < this.blinkAt + 0.12 ? 1 : 0);
    for (const e of r.eyes) e.scale.y = (e.userData.sy ?? 1) * (1 - 0.88 * shut);
    for (const [i, tl] of r.tails.entries())
      tl.rotation.y = Math.sin(t * (walk ? 12 : 3) + i) * (0.5 - 0.35 * sl);
    r.fx?.(t, walk);
    // Gear and crown come off when asleep (the 2D pet curls up without them).
    this.syncGear();
    const dressed = sl < 0.5;
    if (this.wornGroup) this.wornGroup.visible = dressed;
    if (this.spin) this.spin.rotation.y = t * (walk ? 30 : 12);
    if (this.crowned) {
      this.crowned.group.visible = dressed;
      this.crowned.stars.forEach((s, i) => {
        const a = t * 2 + (i * Math.PI * 2) / 3;
        s.position.set(Math.cos(a) * 0.1, 0.08 + Math.sin(t * 3 + i) * 0.03, Math.sin(a) * 0.1);
        s.scale.setScalar(0.6 + 0.5 * Math.abs(Math.sin(t * 4 + i * 2)));
      });
    }
    // z, z, z.
    this.zs.forEach((z, i) => {
      const u = (t * 0.45 + i / 3) % 1;
      z.position.set(0.1 + u * 0.12, 0.28 + u * 0.3 + (r.float ?? 0), 0.04);
      z.scale.setScalar(1.1 + u * 0.8);
      z.rotation.y = Math.PI / 4;
      z.visible = sl > 0.6 && u < 0.92;
    });
  }

  private syncGear(): void {
    const r = this.rig;
    const hat = PETWEAR[this.wear - 1]?.at === "top";
    if (this.worn !== this.wear) {
      this.wornGroup?.removeFromParent();
      this.wornGroup = this.spin = undefined;
      const g = gear(this.wear, r);
      if (g) {
        g.group.position.set(...(PETWEAR[this.wear - 1]?.at === "top" ? r.top : r.neck));
        r.head.add(g.group);
        this.wornGroup = g.group;
        this.spin = g.spin;
      }
      this.worn = this.wear;
    }
    if (this.crown !== !!this.crowned || (this.crowned && this.crowned.lifted !== hat)) {
      this.crowned?.group.removeFromParent();
      this.crowned = null;
      if (this.crown) {
        const c = makeCrown(r, hat ? 0.12 : 0);
        c.group.position.set(...r.top);
        r.head.add(c.group);
        this.crowned = { ...c, lifted: hat };
      }
    }
  }
}

/**
 * The 3D twin of a 2D pet. `species` is `Look.pet` (1 duck, 2 cat, 3 dog, 4 dragon, 5 panda, 6 Singularity
 * orb, 7 to 11 the boss-loot pets, 300 to 305 the Night Market case's, 400 to 405 the Nusantara case's, 500 to 505
 * Ragnarok Eve's, 600 and 601 the pond's) or its name; `variant` is `Look.petVariant` (0 the original, n the
 * n-th of `PET_VARIANTS`) or the variation's id; `name` is the pet's name, which dresses Penny and Nemo.
 */
export function petFrom2D(species: number | string, variant: number | string = 0, name = ""): Pet3D {
  const sp: Species = (typeof species === "number" ? speciesAt(species) : (species as Species)) ?? "duck";
  const id =
    typeof variant === "number" ? (variant > 0 ? (PET_VARIANTS[sp]?.[variant - 1] ?? "") : "") : variant;
  const clean = name.trim().toLowerCase();
  const outfit = clean
    ? (PET_NAMED.find((n) => n.name.toLowerCase() === clean && n.species === sp && n.variant === id)?.art ??
      null)
    : null;
  return new Pet3D(sp === "none" ? "duck" : sp, id, outfit);
}

// MARK: Pet bed (tile Q)

/** A round cushion basket: woven wall, blue cushion with a few pillow dots. */
function petBed(): Model {
  const m = new Model();
  m.cyl(0.4, 0.05, C.woodDark, [0, 0, 0], 0.4, 24);
  const ring = (r: number, tube: number, y: number, c: string) => {
    const t = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 28), toon(c));
    t.rotation.x = Math.PI / 2;
    t.position.y = y;
    t.castShadow = t.receiveShadow = true;
    m.add(t);
  };
  ring(0.36, 0.085, 0.12, C.woodDark);
  ring(0.36, 0.03, 0.2, C.woodLight);
  // The weave: short uprights round the outside.
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    m.box([0.03, 0.12, 0.03], C.wood, [Math.cos(a) * 0.43, 0.04, Math.sin(a) * 0.43], 0.008).rotation.y = -a;
  }
  m.cyl(0.31, 0.1, C.fabric, [0, 0.03, 0], 0.31, 24);
  m.cyl(0.314, 0.012, C.fabricDark, [0, 0.12, 0], 0.314, 24);
  m.cyl(0.24, 0.012, C.fabric, [0, 0.128, 0], 0.24, 24);
  for (const [x, z] of [
    [-0.12, 0.08],
    [0.1, -0.12],
    [0.15, 0.1],
  ] as const)
    m.ball(0.022, C.pillow, [x, 0.145, z], [1, 0.4, 1], 6);
  return m;
}

export const PETS_ASSETS: readonly Asset[] = [
  {
    id: "tile:Q",
    name: "Pet bed",
    price: 0,
    w: 1,
    d: 1,
    build: petBed,
    bed: [0, 0.12, 0],
  },
];
