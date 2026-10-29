/**
 * Character cosmetics for the 3D world, additive to `avatar.ts`.
 *
 * `lookFrom2D(look)` turns a saved 2D `Look` (ids into the shop, the head pack, the wardrobe, raid loot and the
 * merchant's editions) into an `avatar.ts` `Look`, with a `gear` that dresses the avatar once its body exists: every
 * hat and face piece (`gear3dHead.ts`), outfit marks, merch, held and back items (`gear3dBody.ts`), and the
 * Lv 50 golden aura. `nameTag` is the chip stack that floats over a character: a name in its rarest item's
 * colour, a company tag, and badge and trophy chips.
 */

import { RARITIES, RARITY_COLOR, type Rarity, rarityOf, TIER_COLOR } from "@tokenmaxxing/core/rarity.ts";
import { ITEMS, type Item } from "@tokenmaxxing/core/shop.ts";
import * as THREE from "three";
import { knownColours } from "../../art/merch.ts";
import { HAIRS, OUTFITS, PANTS, SKINS } from "../../art/palette.ts";
import { EXTRA_OUTFITS, LEGENDARY_LEVEL, MERCH_PAIRS } from "../data/gear.ts";
import { Model, tint, toon } from "../kit/kit.ts";
import { Avatar, type CharStyle, type Gear, type Look } from "./avatar.ts";
import {
  BACK_BUILDERS,
  type BodyCtx,
  HELD_BUILDERS,
  type MerchLook,
  merchCap,
  merchTop,
  OUTFIT_BUILDERS,
} from "./gear3dBody.ts";
// The Night Market case adds its builders to the tables above when it loads.
import "./gear3dCase.ts";
// So does the Nusantara case.
import "./gear3dNusantara.ts";
// The Ragnarok Eve case (look indices 500 and up) does the same.
import "./gear3dRagnarok.ts";
// The pond treasures (look indices 600 and up, only fishing turns them up) too.
import "./gear3dFishing.ts";
import { AURA_BUILDERS } from "./gear3dAura.ts";
import { COVERS_HAIR, type Ctx, FACE_BUILDERS, HAT_BUILDERS, lit, ring, see } from "./gear3dHead.ts";
import type { Hat, Look as VLook } from "./styles.ts";
import { U, vpart } from "./voxgear.ts";

export { BACK_BUILDERS, HELD_BUILDERS, OUTFIT_BUILDERS } from "./gear3dBody.ts";
export { FACE_BUILDERS, HAT_BUILDERS } from "./gear3dHead.ts";
export { LEGENDARY_LEVEL, RARITY_COLOR, TIER_COLOR };

/** A saved 2D look: the fields of `core/src/world.ts` `Look` that dress a character. */
export interface Look2D {
  style: number;
  skin: number;
  hair: number;
  outfit: number;
  glasses?: number;
  hat?: number;
  held?: number;
  back?: number;
  /** A worn effect (the Night Market case's auras); absent or 0 is none. */
  aura?: number;
  /** Whose company merch they wear (a company id), and which pieces (`MERCH` bits: tee 1, hoodie 2, cap 4, mug 8). */
  merch?: number;
  merchWorn?: number;
}

export interface LookOptions {
  /** Their level: 50 lights the golden aura. */
  level?: number;
  /** A company's merch colours (`merchColours` in `art/merch.ts`); without it the world's companies, else a pair by id. */
  company?: MerchLook;
}

// MARK: Catalogue

type Slot = "hat" | "glasses" | "outfit" | "held" | "back" | "aura";
const bySlot = new Map<string, Item>();
for (const i of ITEMS)
  if (i.slot !== "furniture" && i.slot !== "merch") bySlot.set(`${i.slot}.${i.index}`, i);

/** The shop item behind a slot's index, if there is one. */
export const itemAt = (slot: Slot, index: number): Item | undefined => bySlot.get(`${slot}.${index}`);

/** Hats the avatar already draws itself. */
const BASE_HATS: Record<number, Hat> = { 1: "beanie", 2: "headphones", 3: "crown" };

/** The names the 2D game gives outfits that are only colours (0-7 are free; the rest are named in the catalogue). */
const FREE_OUTFIT_NAMES = [
  "Red tee",
  "Blue tee",
  "Green tee",
  "Yellow tee",
  "Purple tee",
  "Charcoal tee",
  "Pink tee",
  "White tee",
];
export const outfitName = (i: number): string =>
  FREE_OUTFIT_NAMES[i] ?? itemAt("outfit", i)?.name ?? `Outfit ${i}`;

/** Every outfit's colours: [main, dark] and trousers. */
export function outfitColours(i: number): { outfit: [string, string]; pants: string } {
  const extra = EXTRA_OUTFITS[i];
  if (extra) return { outfit: [extra[0], extra[1]], pants: extra[2] };
  return { outfit: OUTFITS[i] ?? OUTFITS[0]!, pants: PANTS[i] ?? PANTS[0]! };
}

/** Company merch as the world has it (the colours, initials and print 2D wears), else a pair picked by the id. */
export function merchFor(companyId: number, initials = "TM"): MerchLook {
  const known = knownColours(companyId);
  if (known)
    return {
      main: known.main,
      shade: known.shade,
      accent: known.accent,
      initials: known.initials,
      design: known.design?.rows ?? null,
    };
  const [main, accent] = MERCH_PAIRS[companyId % MERCH_PAIRS.length]!;
  return { main, shade: tint(main, -0.25), accent, initials };
}

/** What a 2D look is wearing, by name, for galleries and tooltips. */
export interface Worn {
  hat?: Item;
  glasses?: Item;
  outfit: string;
  held?: Item;
  back?: Item;
  aura?: Item;
  merch: { top: boolean; hoodie: boolean; cap: boolean; mug: boolean };
  /** The rarest thing they wear. */
  rarity: Rarity;
}
export function wornBy(look: Look2D): Worn {
  const bits = look.merch ? (look.merchWorn ?? 0) : 0;
  const worn: Worn = {
    outfit: outfitName(look.outfit),
    merch: { top: (bits & 3) > 0, hoodie: (bits & 2) > 0, cap: (bits & 4) > 0, mug: (bits & 8) > 0 },
    rarity: "common",
  };
  const set = (slot: "hat" | "glasses" | "held" | "back" | "aura", index = 0) => {
    const it = index ? itemAt(slot, index) : undefined;
    if (it) worn[slot] = it;
    return it;
  };
  set("hat", look.hat);
  set("glasses", look.glasses);
  set("held", look.held);
  set("back", look.back);
  set("aura", look.aura);
  const outfit = itemAt("outfit", look.outfit);
  const all = [worn.hat, worn.glasses, worn.held, worn.back, worn.aura, outfit].filter((x): x is Item => !!x);
  for (const it of all)
    if (RARITIES.indexOf(rarityOf(it)) > RARITIES.indexOf(worn.rarity)) worn.rarity = rarityOf(it);
  return worn;
}

// MARK: The gear

type Tick = (t: number, walking: boolean) => void;

class Dress implements Gear {
  private readonly ticks: Tick[] = [];
  constructor(
    private readonly look2d: Look2D,
    private readonly outfit: [string, string],
    private readonly pants: string,
    private readonly skin: string,
    private readonly hair: string,
    private readonly opts: LookOptions,
  ) {}

  dress(a: Avatar): void {
    const l = this.look2d;
    const worn = wornBy(l);
    const tick = (fn: Tick) => this.ticks.push(fn);
    const merch = l.merch ? (this.opts.company ?? merchFor(l.merch)) : undefined;
    const ctx: Ctx = {
      skin: this.skin,
      hair: this.hair,
      outfit: this.outfit,
      pants: this.pants,
      tick: (fn) => tick((t) => fn(t)),
    };
    const vox = a.style === "voxel";
    const fit = headFit(a);

    // The head: a hat (or the company cap), then the face piece. Builders draw for a round head 0.5 across
    // with its centre at the origin; `headFit` scales and moves that frame onto this style's head.
    // Voxel folk wear cubes: their frames draw blocks (`voxgear.ts`) however the builder asks for a ball or a cone.
    const frame = (parent: Model, at: [number, number, number]): Model =>
      vox ? vpart(parent, at) : parent.part(at);
    const hat = frame(a.head, [0, fit.y + fit.lift, 0]);
    hat.scale.setScalar(fit.scale);
    const face = frame(a.head, [0, fit.y + fit.eyes, fit.front]);
    face.scale.set(fit.scale * fit.wide, fit.scale, fit.scale);
    if (merch && worn.merch.cap) merchCap(hat, merch);
    else {
      const build = worn.hat && !BASE_HATS[l.hat ?? 0] ? HAT_BUILDERS[worn.hat.name] : undefined;
      build?.(hat, ctx);
    }
    // Voxel folk wear these two drawn in cubes (`lookFrom2D` sets them on the look).
    const own = vox && worn.glasses && VOXEL_FACE[worn.glasses.name];
    if (worn.glasses && !own) FACE_BUILDERS[worn.glasses.name]?.(face, ctx);

    // The body, in the frame the builders know (a torso 0.3 wide, floor-up 0.22 to 0.48), stretched over the
    // blocky torso. Other styles' bodies are too different, so they skip the marks.
    const chest = a.arms[0].parent as Model | null;
    const sleeves = (color: string) => {
      if (vox) return;
      for (const arm of a.arms) {
        const sleeve = arm.children[0];
        if (sleeve instanceof Object && "material" in sleeve)
          (sleeve as unknown as { material: unknown }).material = toon(color);
      }
    };
    if (vox && chest) {
      const torso = vpart(chest, [0, 0, 0]);
      const body: BodyCtx = {
        body: torso,
        arms: a.arms as [Model, Model],
        main: this.outfit[0],
        dark: this.outfit[1],
        pants: this.pants,
        tick,
        sleeves,
      };
      if (merch && worn.merch.top) merchTop(body, merch, worn.merch.hoodie);
      else OUTFIT_BUILDERS[l.outfit]?.(body);
      if (worn.back) {
        const back = vpart(chest, [0, 8 * U, -2 * U]);
        BACK_BUILDERS[worn.back.name]?.(back, tick);
      }
    }

    // In the right hand.
    const heldIn = (): Model => {
      const hand = frame(a.arms[1], [0, fit.hand, 0.01]);
      hand.scale.setScalar(vox ? 1.4 : 1.5 * (a.height / 0.95));
      return hand;
    };
    if (worn.held) HELD_BUILDERS[worn.held.name]?.(heldIn(), (fn) => tick((t) => fn(t)));
    else if (merch && worn.merch.mug) mug(heldIn(), merch);

    // A case aura circles the middle of the body, scaled with the person.
    const wornAura = worn.aura && AURA_BUILDERS[worn.aura.name];
    if (wornAura) {
      const k = a.height / 0.95;
      const around = vox ? vpart(a.root, [0, a.height * 0.5, 0]) : a.root.part([0, a.height * 0.5, 0]);
      around.scale.setScalar(k);
      wornAura(around, (fn) => {
        // Posed once now, so an icon (which never ticks) shows the effect spread round them.
        fn(2, false);
        tick((t, walking) => fn(t, walking));
      });
    }

    if ((this.opts.level ?? 0) >= LEGENDARY_LEVEL) this.aura(a, fit.top, tick);
  }

  /** The legendary level: a golden halo over the head, a soft glow round the body, sparkles drifting up. */
  private aura(a: Avatar, top: number, tick: (fn: Tick) => void): void {
    const k = a.height / 0.95;
    const base = top + 0.11 * k;
    const vox = a.style === "voxel";
    const halo = vox ? vpart(a.head, [0, base, 0]) : a.head.part([0, base, 0]);
    halo.scale.setScalar(0.9 * k);
    ring(halo, lit("#ffe066"), 0.15, 0.02);
    ring(halo, lit("#c98e22"), 0.15, 0.012, [0, -0.012, 0]);
    ring(halo, see("#fff3a8", 0.3, true), 0.15, 0.05);
    tick((t) => {
      halo.position.y = base + (Math.floor(t * 3.5) % 2) * 0.012;
      halo.rotation.y = t * 0.6;
    });
    const glowBody = vox ? vpart(a.root, [0, a.height * 0.5, 0]) : a.root.part([0, a.height * 0.5, 0]);
    glowBody.scale.setScalar(k * 1.05);
    const rings: THREE.Mesh[] = [];
    for (const [r, o] of [
      [0.5, 0.09],
      [0.4, 0.11],
      [0.3, 0.14],
    ] as const) {
      const m = new THREE.Mesh(
        vox ? new THREE.BoxGeometry(r * 1.7, r * 2.1, r * 1.5) : new THREE.SphereGeometry(r, 16, 12),
        see(o > 0.1 ? "#ffec96" : "#ffd64a", o, true),
      );
      m.userData.noBlock = true;
      glowBody.add(m);
      rings.push(m);
    }
    const sparks: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(vox ? sparkCube : sparkGeometry, lit(i % 2 ? "#ffe066" : "#fffbe0"));
      s.userData.noBlock = true;
      glowBody.add(s);
      sparks.push(s);
    }
    tick((t) => {
      rings[0]!.scale.setScalar(1 + Math.sin(t * 2.4) * 0.05);
      sparks.forEach((s, i) => {
        const k = (t * 0.55 + i / sparks.length) % 1;
        const ang = i * 2.4 + 0.5;
        s.position.set(Math.sin(ang) * (0.3 + (i % 3) * 0.04), -0.35 + k * 1.2, Math.cos(ang) * 0.25);
        s.scale.setScalar(Math.sin(k * Math.PI) * 1.1);
        s.rotation.y = t * 3 + i;
      });
    });
  }

  get animated(): boolean {
    return this.ticks.length > 0;
  }

  update(a: Avatar, _dt: number, t: number): void {
    const walking = a.pose === "walk";
    for (const fn of this.ticks) fn(t, walking);
  }
}

/** Where the head is, for the builders' round head (0.5 across, centred on the origin). */
interface HeadFit {
  /** Head-local height of its centre, and of its top. */
  y: number;
  top: number;
  scale: number;
  /** Extra height for a hat to clear the hair, and a step forward for flat faces (the builders curve round a ball). */
  lift: number;
  front: number;
  /** The eyes sit higher and wider on a voxel face than on the builders' ball.  */
  eyes: number;
  wide: number;
  /** Hand height, from the shoulder. */
  hand: number;
}
function headFit(a: Avatar): HeadFit {
  const hand = (() => {
    a.root.updateMatrixWorld(true);
    const arm = a.arms[1];
    const box = new THREE.Box3().setFromObject(arm);
    return box.min.y - arm.getWorldPosition(new THREE.Vector3()).y + 0.04;
  })();
  if (a.style === "voxel")
    return {
      y: 0.1575,
      top: 0.36,
      scale: 0.63,
      lift: 0.025,
      front: 0.035,
      eyes: 0.045,
      wide: 1.25,
      hand: -0.33,
    };
  a.root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(a.head);
  const c = a.head.worldToLocal(box.getCenter(new THREE.Vector3()));
  const top = a.head.worldToLocal(new THREE.Vector3(0, box.max.y, 0)).y;
  return {
    y: c.y,
    top,
    scale: Math.min(1.4, Math.max(0.4, box.getSize(new THREE.Vector3()).x / 0.5)),
    lift: 0,
    front: 0,
    eyes: 0,
    wide: 1,
    hand,
  };
}

/** The glasses and beards a voxel person draws in cubes themselves (`lookFrom2D` turns these on). */
const VOXEL_FACE: Record<string, Partial<VLook>> = {
  "Nerd specs": { glasses: true },
  "Pane glasses": { glasses: true },
  "Hygge moustache": { beard: 1 },
  "Viking beard": { beard: 2 },
};

const sparkCube = new THREE.BoxGeometry(0.045, 0.045, 0.045);
const sparkGeometry = new THREE.OctahedronGeometry(0.035).scale(0.7, 1.3, 0.7);

/** The company mug, in the hand. */
function mug(h: Model, m: MerchLook): void {
  ring(h, "#f4efe4", 0.026, 0.008, [0.05, 0.04, 0.06], false);
  h.cyl(0.04, 0.085, "#f4efe4", [0, 0, 0.06], 0.045, 14);
  h.box([0.04, 0.04, 0.012], m.accent, [0, 0.02, 0.102], 0.004);
  h.cyl(0.0415, 0.02, m.main, [0, 0.04, 0.06], 0.0415, 14);
  h.cyl(0.036, 0.004, "#5b3a24", [0, 0.083, 0.06], 0.036, 12);
}

// MARK: The mapper

/**
 * A saved 2D look as an `avatar.ts` one. The base look (skin, hair, outfit colours, the avatar's own beanie,
 * headphones and crown) is plain `avatar.ts`; `gear` adds the rest.
 */
export function lookFrom2D(look: Look2D, opts: LookOptions = {}): Look {
  const { outfit, pants } = outfitColours(look.outfit);
  const bits = look.merch ? (look.merchWorn ?? 0) : 0;
  const company = look.merch ? (opts.company ?? merchFor(look.merch)) : undefined;
  const wearsTop = !!company && (bits & 3) > 0;
  const colours: [string, string] = wearsTop ? [company!.main, company!.shade] : outfit;
  const hat = look.hat ?? 0;
  const base: Hat = BASE_HATS[hat] ?? (look.style === 1 && !hat ? "cap" : "none");
  const worn = wornBy(look);
  const out: Look = {
    skin: SKINS[look.skin] ?? SKINS[0]!,
    hair: HAIRS[look.hair] ?? HAIRS[0]!,
    // 2D: short, cap, spiky, long. Long is a bob or a ponytail, by hair colour.
    style: look.style === 3 ? (look.hair % 2 ? 4 : 2) : ([0, 0, 1][look.style] ?? 0),
    outfit: colours,
    pants,
    hat: bits & 4 ? "none" : base,
    // The 2D head is a person, in a tee; the beards and glasses the voxel face draws itself are its own.
    species: "human",
    age: "adult",
    top: bits & 2 && wearsTop ? "hoodie" : "tee",
    beard: 0,
    glasses: false,
    // Under a hat that covers the crown, the hair's fringe, spikes and bun are tucked away.
    covered: !!(bits & 4 || (worn.hat && COVERS_HAIR.has(worn.hat.name))),
  };
  const own = worn.glasses ? VOXEL_FACE[worn.glasses.name] : undefined;
  if (own) Object.assign(out, own);
  out.gear = new Dress(look, colours, pants, out.skin, out.hair, opts);
  return out;
}

/** A 3D avatar for a saved 2D look. */
export const avatarFor = (look: Look2D, opts?: LookOptions, style: CharStyle = "voxel"): Avatar =>
  new Avatar(lookFrom2D(look, opts), style);

/** The crown the legendary level puts on a pet, to add to a `Pet`'s `root` at its head. */
export function petCrown(): Model {
  const m = new Model();
  m.cyl(0.06, 0.03, "#ffe066", [0, 0, 0], 0.065, 8);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    m.cyl(0.015, 0.035, "#ffe066", [Math.sin(a) * 0.055, 0.03, Math.cos(a) * 0.055], 0.002, 4);
  }
  m.ball(0.012, "#e0405a", [0, 0.015, 0.063]);
  return m;
}

/** How far over a character's head a name tag should float, in world units: higher over a halo. */
export const tagLift = (level = 0, pose = "stand"): number =>
  (pose === "sleep" ? 0.55 : pose === "sit" || pose === "type" ? 0.97 : 1.35) +
  (level >= LEGENDARY_LEVEL ? 0.14 : 0);

// MARK: Overhead chips

export interface BadgeChip {
  emoji: string;
  title?: string;
  /** The frame (`TIER_COLOR` in rarity.ts). */
  frame?: keyof typeof TIER_COLOR;
}
export interface TagOptions {
  name: string;
  level: number;
  /** Colours the tag: the rarest thing they wear (`wornBy(look).rarity`). */
  rarity?: Rarity;
  online?: boolean;
  /** Their company, as a coloured tag. */
  company?: { name: string; color: string };
  badges?: readonly BadgeChip[];
  trophies?: readonly { emoji?: string; title: string }[];
}

let styled = false;
function ensureStyle(): void {
  if (styled) return;
  styled = true;
  const s = document.createElement("style");
  s.textContent = `
.gear-tag { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.gear-tag .name { padding: 1px 7px; border-radius: 5px; background: rgba(27,31,42,.84); font-size: 11px; font-weight: 700; border: 1.5px solid var(--rar, transparent); box-shadow: 0 0 6px -1px var(--rar, transparent); }
.gear-tag .name.off { opacity: .55; }
.gear-tag .name .gem { display: inline-block; width: 6px; height: 6px; margin-right: 5px; border-radius: 1px; transform: rotate(45deg); background: var(--rar, #888); vertical-align: 1px; }
.gear-tag .name .lv { opacity: .75; font-weight: 600; }
.gear-tag .chips { display: flex; gap: 3px; align-items: center; }
.gear-tag .co { padding: 0 6px; border-radius: 4px; font-size: 10px; font-weight: 700; color: #fff; background: var(--co); box-shadow: 0 1px 0 rgba(0,0,0,.35); text-shadow: 0 1px 0 rgba(0,0,0,.4); }
.gear-tag .chip { min-width: 16px; height: 16px; padding: 0 2px; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; border-radius: 4px; background: rgba(27,31,42,.8); border: 1.5px solid var(--frame, #666); }
.gear-tag .chip.trophy { --frame: #ffd75e; background: rgba(60,48,12,.85); }
`;
  document.head.append(s);
}

/**
 * The stack over a character: name and level (outlined in the colour of their rarest item), a company
 * tag, then a row of badge and trophy chips. Add it to the `#labels` layer like any label.
 */
export function nameTag(o: TagOptions): HTMLDivElement {
  ensureStyle();
  const el = document.createElement("div");
  el.className = "label gear-tag";
  const name = document.createElement("div");
  name.className = `name${o.online === false ? " off" : ""}`;
  if (o.rarity) name.style.setProperty("--rar", RARITY_COLOR[o.rarity]);
  const gem = o.rarity && o.rarity !== "common" ? '<span class="gem"></span>' : "";
  name.innerHTML = `${gem}${escapeHtml(o.name)} <span class="lv">· Lv${o.level}${o.level >= LEGENDARY_LEVEL ? " ✦" : ""}</span>`;
  el.append(name);
  if (o.company) {
    const c = document.createElement("div");
    c.className = "chips";
    const co = document.createElement("span");
    co.className = "co";
    co.style.setProperty("--co", o.company.color);
    co.textContent = o.company.name;
    c.append(co);
    el.prepend(c);
  }
  if (o.badges?.length || o.trophies?.length) {
    const row = document.createElement("div");
    row.className = "chips";
    for (const b of o.badges ?? []) {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.style.setProperty("--frame", TIER_COLOR[b.frame ?? "bronze"]);
      chip.textContent = b.emoji;
      if (b.title) chip.title = b.title;
      row.append(chip);
    }
    for (const t of o.trophies ?? []) {
      const chip = document.createElement("span");
      chip.className = "chip trophy";
      chip.textContent = t.emoji ?? "🏆";
      chip.title = t.title;
      row.append(chip);
    }
    el.prepend(row);
  }
  return el;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
