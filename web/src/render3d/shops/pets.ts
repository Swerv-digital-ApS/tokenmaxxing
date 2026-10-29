/**
 * The pet store: a walk-in shop where every pet of the 2D shop (five species, all of their looks), the seven
 * pieces of pet gear, the Lv30 Singularity orb and the Lv50 crown stand on display, alive. Catalog from
 * `shops/data/pets.ts`; the pets are the real `petFrom2D` models.
 */
import * as THREE from "three";
import { C, HAIRS, SKINS } from "../../art/palette.ts";
import { disposeObject } from "../engine/dispose.ts";
import { light } from "../furniture/furniture.ts";
import { glass, Model, ticks, tint, toon } from "../kit/kit.ts";
import { panel } from "../kit/panel.ts";
import { Avatar, personLook } from "../people/avatar.ts";
import { PETS_ASSETS, petFrom2D } from "../pets/pets3d.ts";
import { exitDoorway } from "../rooms/exits3d.ts";
import { Room, type Turn } from "../rooms/room.ts";
import { nightGlow } from "../town/props.ts";
import { CATALOG_PETS, CROWN_LEVEL, SHOP_PETWEAR, SHOP_VARIANTS } from "./data/pets.ts";
import {
  catCondo,
  counter,
  crownDome,
  dome,
  dropPrebuiltPets,
  type Entry,
  fishTank,
  petPen,
  prebuildPet,
  type Reg,
  terrariums,
  toyShelf,
  wearRack,
} from "./pets-fixtures.ts";
import { animate, bowl, bubble, crownProp, cushion, live, nameChip, sparkles } from "./pets-parts.ts";

// MARK: The contract (a local copy; the integrator unifies it)

interface ShopItem {
  id: string;
  name: string;
  price: number;
  level?: number;
  group?: string;
  /** A small 3D model of the item (for shelves/rails/pens and for the buy panel). */
  preview: () => Model;
}
type Avatar3D = Avatar;
interface ShopSpec {
  id: "furniture" | "clothes" | "barber" | "pets";
  name: string;
  sign: string;
  items: ShopItem[];
  exterior: () => Model;
  footprint: { w: number; d: number };
  buildInterior: () => {
    room: Room;
    displays: { item: ShopItem; at: [number, number] }[];
    shopkeeper: Avatar3D;
    counter: [number, number];
    door: [number, number];
  };
  slices?: () => Generator<void, Interior, void>;
}

// MARK: The catalog

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const VARIANT_NAME: Record<string, string> = {
  greytabby: "Grey tabby",
  jackolantern: "Jack-o'-lantern",
  chowchow: "Chow chow",
  frenchie: "Frenchie",
  qinling: "Qinling",
  duckling: "Duckling",
  pekin: "Pekin",
};
const looks = (v: string) => VARIANT_NAME[v] ?? cap(v);

/** A pet standing on a plinth-less spot, for the buy panel. */
function petPreview(
  species: string,
  variant: string,
  opts: { wear?: number; crown?: boolean; pose?: "stand" | "sit" } = {},
): Model {
  const m = new Model();
  const p = petFrom2D(species, variant);
  p.wear = opts.wear ?? 0;
  p.crown = !!opts.crown;
  p.pose = opts.pose ?? "stand";
  m.add(p.root);
  animate(p, 3, opts.pose ?? "lively", true);
  return m;
}

function crownPreview(): Model {
  const m = new Model();
  const c = cushion(0.28);
  m.add(c);
  const cr = crownProp(1.15);
  cr.position.y = 0.12;
  m.add(cr);
  live(cr, (t) => (cr.rotation.y = t * 0.6), true);
  return m;
}

const GEAR_PETS: [string, string][] = [
  ["dog", "shiba"],
  ["cat", "calico"],
  ["dog", "pug"],
  ["panda", "qinling"],
  ["dog", "golden"],
  ["duck", "pekin"],
  ["dog", "husky"],
];

const ITEMS: ShopItem[] = [];
/** One entry per item: which pet to build and what its card says. */
const ENTRY = new Map<string, Entry>();

function add(item: ShopItem, e: Omit<Entry, "id" | "title">, title?: string): void {
  ITEMS.push(item);
  ENTRY.set(item.id, { ...e, id: item.id, title: title ?? item.name });
}

for (const p of CATALOG_PETS) {
  const priced = p.price > 0;
  add(
    {
      id: p.id,
      name: p.name,
      price: p.price,
      level: p.level,
      group: "Pets",
      preview: () => petPreview(p.species, ""),
    },
    {
      species: p.species,
      variant: "",
      line: priced ? `${p.price}` : `Lv ${p.level}`,
      kind: priced ? "price" : "level",
    },
    p.species === "orb" ? "Orb" : `${p.name}`,
  );
  if (p.species === "orb") continue;
  for (const v of SHOP_VARIANTS[p.species]) {
    add(
      {
        id: `${p.id}.${v}`,
        name: `${looks(v)} ${p.name.toLowerCase()}`,
        price: 0,
        group: `${p.name} looks`,
        preview: () => petPreview(p.species, v),
      },
      { species: p.species, variant: v, line: `with ${p.name}`, kind: "variant" },
      looks(v),
    );
  }
}
SHOP_PETWEAR.forEach((w, i) => {
  const [species, variant] = GEAR_PETS[i]!;
  add(
    {
      id: w.id,
      name: w.name,
      price: w.price,
      group: "Pet gear",
      preview: () => petPreview(species, variant, { wear: w.index, pose: "sit" }),
    },
    { species, variant, line: `${w.price}`, kind: "gear", wear: w.index, mood: "sit" },
    w.name,
  );
});
ITEMS.push({
  id: "crown.lv50",
  name: "Pet crown",
  price: 0,
  level: CROWN_LEVEL,
  group: "Rewards",
  preview: crownPreview,
});

const item = (id: string): ShopItem => ITEMS.find((i) => i.id === id)!;
const entries = (prefix: string, exact = false): Entry[] =>
  ITEMS.filter((i) => (exact ? i.id === prefix : i.id === prefix || i.id.startsWith(`${prefix}.`))).map((i) =>
    ENTRY.get(i.id)!,
  );

// MARK: The keeper

const TEAL = "#3fa7a0";

/** Wren the pet keeper: an apron over a cream shirt, a cat on one shoulder, a wave now and then. */
function makeKeeper(): Avatar {
  const look = personLook({
    skin: SKINS[1]!,
    hair: HAIRS[2]!,
    style: 4,
    outfit: ["#f4efe4", "#cfc7b4"],
    pants: "#4a4f63",
    hat: "none",
  });
  const avatar = new Avatar(look);
  const b = avatar.body;
  // The apron: a bib, two straps and a skirt, with a paw on the pocket.
  b.box([0.25, 0.22, 0.02], TEAL, [0, 0.55, 0.1], 0.008);
  b.box([0.28, 0.3, 0.02], TEAL, [0, 0.14, 0.095], 0.008);
  for (const s of [-1, 1]) {
    b.box([0.04, 0.03, 0.2], TEAL, [s * 0.09, 0.755, 0], 0.006);
    b.box([0.04, 0.2, 0.02], TEAL, [s * 0.09, 0.66, 0.1], 0.006);
  }
  b.box([0.1, 0.07, 0.01], "#2f8a84", [0, 0.2, 0.112], 0.004);
  b.ball(0.016, "#fff6df", [0, 0.2, 0.12], [1.4, 1, 0.3], 6);
  for (const x of [-0.03, 0, 0.03]) b.ball(0.007, "#fff6df", [x, 0.23, 0.12], [1, 1.2, 0.3], 4);
  // The cat on the left shoulder, calico, sitting up and wagging.
  const cat = petFrom2D("cat", "calico");
  cat.pose = "sit";
  cat.root.scale.setScalar(0.5);
  cat.root.position.set(0.2, 0.8, 0.0);
  cat.root.rotation.y = -0.3;
  b.add(cat.root);
  animate(cat, 5, "sit");
  // A name chip and a bubble.
  const chip = nameChip("Wren", "Pet keeper");
  chip.position.set(0, avatar.height + 0.22, 0);
  avatar.root.add(chip);
  const say = bubble([
    "Welcome in! Pet anyone you like.",
    "Every look comes with its pet.",
    "Ask me about the gear!",
    "Mind the dragons, they sneeze.",
  ]);
  say.position.set(0, avatar.height + 0.6, 0);
  avatar.root.add(say);
  let last = 0;
  live(avatar.root, (t) => {
    const dt = Math.min(0.1, Math.max(0, t - last));
    last = t;
    const waving = t % 14 < 2.4;
    avatar.pose = waving ? "wave" : "stand";
    avatar.talking = (t % 6) / 6 < 0.8 && t % 6 > 0.3;
    avatar.update(dt, t);
  });
  return avatar;
}

// MARK: The exterior

const gable = (m: Model, w: number, d: number, y: number, color: string, wall: string): void => {
  const half = d / 2 + 0.2;
  const rise = 0.95;
  const shape = new THREE.Shape();
  shape.moveTo(-half, 0);
  shape.lineTo(0, rise);
  shape.lineTo(half, 0);
  shape.lineTo(-half, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: w + 0.3, bevelEnabled: false });
  geo.translate(0, 0, -(w + 0.3) / 2);
  const mesh = new THREE.Mesh(geo, toon(color));
  mesh.rotation.y = Math.PI / 2;
  mesh.position.y = y;
  mesh.castShadow = mesh.receiveShadow = true;
  m.add(mesh);
  m.box([w + 0.36, 0.08, 0.14], tint(color, -0.25), [0, y + rise - 0.04, 0], 0.03);
  for (const s of [-1, 1])
    for (const f of [0.3, 0.55, 0.8]) {
      const c = m.box(
        [w + 0.3, 0.025, 0.04],
        tint(color, -0.18),
        [0, y + rise * (1 - f), s * half * f],
        0.005,
      );
      c.rotation.x = s * Math.atan(rise / half);
    }
  const end = new THREE.Shape();
  end.moveTo(-d / 2, 0);
  end.lineTo(0, rise - 0.12);
  end.lineTo(d / 2, 0);
  const eg = new THREE.ExtrudeGeometry(end, { depth: w - 0.02, bevelEnabled: false });
  eg.translate(0, 0, -(w - 0.02) / 2);
  const ends = new THREE.Mesh(eg, toon(wall));
  ends.rotation.y = Math.PI / 2;
  ends.position.y = y;
  m.add(ends);
};

/** A glass display box on the front wall with live pets in it. */
function windowCase(x: number, pets: [string, string, number][], seed: number): Model {
  const m = new Model();
  m.position.set(x, 0.42, 0.04);
  m.box([1.5, 0.12, 0.5], tint(C.woodLight, 0.1), [0, 0, 0.2], 0.02);
  m.box([1.5, 0.05, 0.5], "#c4544b", [0, 0.12, 0.2], 0.01);
  m.box([1.4, 0.03, 0.4], "#f4efe4", [0, 0.17, 0.2], 0.01);
  const g = m.box([1.46, 0.85, 0.46], glass("#d8f0fa", 0.18), [0, 0.12, 0.2], 0.01);
  g.renderOrder = 3;
  for (const s of [-1, 1]) m.box([0.05, 0.9, 0.05], C.white, [s * 0.74, 0.12, 0.43], 0.01);
  m.box([1.56, 0.06, 0.56], C.white, [0, 1.0, 0.2], 0.015);
  pets.forEach(([species, variant, sc], i) => {
    const p = petFrom2D(species, variant);
    p.root.position.set(-0.4 + i * 0.8, 0.19, 0.2);
    p.root.scale.setScalar(sc);
    p.root.rotation.y = i ? -0.3 : 0.3;
    m.add(p.root);
    animate(p, seed + i, i ? "sleepy" : "lively");
  });
  return m;
}

/** The storefront for the town: about 5×4 tiles, door on its south face (+z), origin at the middle of the front wall. */
function petsExterior(): Model {
  const m = new Model();
  m.name = "building:pets";
  const [w, d, h] = [5, 4, 2.0];
  const wall = "#f9e2c4";
  m.box([w + 0.2, 0.2, d + 0.2], C.stone, [0, 0, -d / 2], 0.02);
  m.box([w, h - 0.2, d], wall, [0, 0.2, -d / 2], 0.02);
  m.box([w + 0.04, 0.5, 0.06], TEAL, [0, 0.2, 0.0], 0.01);
  m.box([w + 0.06, 0.12, 0.08], C.white, [0, h - 0.14, 0.0], 0.01);
  for (const x of [-w / 2, w / 2]) m.box([0.14, h - 0.2, 0.1], C.white, [x, 0.2, 0.0], 0.02);
  gable(m.part([0, 0, -d / 2]), w, d, h, "#c4544b", tint(wall, -0.04));
  // Two window cases, either side of the door, with live pets.
  m.add(
    windowCase(
      -1.45,
      [
        ["cat", "siamese", 0.8],
        ["dog", "corgi", 0.75],
      ],
      11,
    ),
  );
  m.add(
    windowCase(
      1.45,
      [
        ["dog", "pug", 0.75],
        ["duck", "duckling", 0.9],
      ],
      21,
    ),
  );
  // The door.
  const door = m.part([0, 0.2, 0.04]);
  door.box([1.0, 1.2, 0.08], C.white, [0, 0, 0], 0.03);
  door.box([0.84, 1.12, 0.06], TEAL, [0, 0, 0.03], 0.02);
  door.box([0.5, 0.5, 0.02], "#a8dcf7", [0, 0.5, 0.07], 0.01);
  door.box([0.5, 0.04, 0.03], C.white, [0, 0.72, 0.075]);
  door.ball(0.035, "#e9b73d", [0.3, 0.55, 0.1]);
  door.box([1.3, 0.1, 0.45], C.stoneLight, [0, 0, 0.18], 0.02);
  // The striped awning.
  const awn = m.part([0, 1.5, 0.06]);
  awn.rotation.x = 0.5;
  for (let i = 0; i < 10; i++)
    awn.box([0.52, 0.05, 0.62], i % 2 ? C.white : TEAL, [-2.34 + i * 0.52, 0, 0], 0.01);
  for (let i = 0; i < 10; i++)
    awn.box([0.52, 0.12, 0.04], i % 2 ? C.white : TEAL, [-2.34 + i * 0.52, -0.05, 0.62], 0.01);
  // The sign.
  const sign = panel(
    3.4,
    0.46,
    (g, cw, ch) => {
      g.fillStyle = "#2b2433";
      g.beginPath();
      g.roundRect(0, 0, cw, ch, 14);
      g.fill();
      g.strokeStyle = "#e0a82e";
      g.lineWidth = 5;
      g.strokeRect(6, 6, cw - 12, ch - 12);
      g.fillStyle = "#ffe28a";
      g.font = `900 ${Math.round(ch * 0.56)}px system-ui, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("PET SHOP", cw / 2 + 18, ch / 2 + 2, cw - 100);
      // A paw on each side.
      g.fillStyle = "#3fa7a0";
      for (const x of [cw * 0.1, cw * 0.9]) {
        g.beginPath();
        g.ellipse(x, ch * 0.62, ch * 0.16, ch * 0.13, 0, 0, Math.PI * 2);
        g.fill();
        for (const dx of [-0.2, -0.07, 0.07, 0.2]) {
          g.beginPath();
          g.ellipse(
            x + dx * ch,
            ch * (0.4 - (Math.abs(dx) < 0.1 ? 0.04 : 0)),
            ch * 0.045,
            ch * 0.065,
            0,
            0,
            Math.PI * 2,
          );
          g.fill();
        }
      }
    },
    { frame: C.woodDark, px: 70, smooth: true, lit: true, lift: h - 0.22 },
  );
  sign.position.z = 0.08;
  m.add(sign);
  // A bone-shaped sign on a bracket.
  const hang = m.part([2.6, h - 0.35, 0.3]);
  hang.box([0.04, 0.04, 0.5], C.woodDark, [0, 0.1, -0.2]);
  const swing = hang.part([0, 0, 0]);
  swing.box([0.5, 0.16, 0.05], "#f4ead2", [0, -0.35, 0], 0.02);
  for (const sx of [-1, 1])
    for (const sy of [0, 0.16]) swing.ball(0.07, "#f4ead2", [sx * 0.25, -0.35 + sy, 0], [1, 1, 0.5], 8);
  ticks.push((time) => (swing.rotation.z = Math.sin(time * 1.5) * 0.08));
  // A kennel and a dog by the door, a planter each side.
  const kennel = m.part([-2.9, 0, 0.7], 0.3);
  kennel.box([0.7, 0.5, 0.7], "#d49c67", [0, 0, 0], 0.03);
  kennel.cyl(0.62, 0.35, "#c4544b", [0, 0.5, 0], 0.02, 4).rotation.y = Math.PI / 4;
  kennel.box([0.3, 0.32, 0.04], "#2b2433", [0, 0.02, 0.355], 0.02);
  const pup = petFrom2D("dog", "husky");
  pup.root.position.set(-2.2, 0, 1.0);
  pup.root.rotation.y = 0.5;
  m.add(pup.root);
  animate(pup, 4, "sleepy");
  const pb = bowl("water");
  pb.position.set(-2.55, 0, 1.25);
  m.add(pb);
  for (const x of [-1.15, 1.15]) {
    m.box([0.7, 0.3, 0.3], "#c4544b", [x, 0, 0.35], 0.04);
    for (let i = 0; i < 4; i++)
      m.ball(
        0.11,
        ["#e0788f", "#f5d14a", "#fbf7ef", "#e0584f"][i]!,
        [x - 0.27 + i * 0.18, 0.4, 0.35],
        [1, 0.9, 1],
        8,
      );
  }
  // Lamps by the door.
  for (const x of [-0.85, 0.85]) {
    m.box([0.05, 0.18, 0.05], C.metal, [x, 1.3, 0.1]);
    nightGlow(m.box([0.14, 0.2, 0.14], "#f5d98a", [x, 1.1, 0.14], 0.04), "#ffe28a");
  }
  light(m, [0, 1.0, 0.9], "#ffcf7a", 3, 6);
  return m;
}

// MARK: The interior

const W = 18;
const D = 12;

type Interior = ReturnType<ShopSpec["buildInterior"]>;

/** The shop is built in slices (a yield between the big pieces), so the renderer can build it a bit per frame as the player nears the door. */
function* interiorSlices(): Generator<void, Interior, void> {
  const room = new Room(W, D, { floor: "#d6a873", wall: "#f7e5cd", stripe: "#eed3b6", bare: true });
  let complete = false;
  try {
    const built = yield* fillInterior(room);
    complete = true;
    return built;
  } finally {
    if (!complete) {
      dropPrebuiltPets();
      disposeObject(room.group);
    }
  }
}

function* fillInterior(room: Room): Generator<void, Interior, void> {
  const displays: { item: ShopItem; at: [number, number]; world?: [number, number, number] }[] = [];
  const box = new THREE.Box3();
  /** Places `model` on its footprint and files its `reg`istered items under the tiles they stand on. */
  const put = (
    id: string,
    name: string,
    x: number,
    z: number,
    w: number,
    d: number,
    make: (reg: Reg) => Model,
    turn: Turn = 0,
  ) => {
    const regs: [string, number, number, THREE.Object3D | undefined][] = [];
    const model = make((i, lx, lz, shows) => regs.push([i, lx, lz, shows]));
    const p = room.place({ id, name, price: 0, w, d, build: () => model }, x, z, turn, model);
    model.updateMatrix();
    room.group.updateMatrixWorld(true);
    for (const [i, lx, lz, shows] of regs) {
      const v = new THREE.Vector3(lx, 0, lz).applyMatrix4(model.matrix);
      // The pointer finds the middle of the pet (or a pedestal's one thing: the whole of it), not its tile.
      const on = shows ?? (regs.length === 1 ? model : undefined);
      const c = on && !box.setFromObject(on).isEmpty() ? box.getCenter(new THREE.Vector3()) : null;
      displays.push({
        item: item(i),
        at: [Math.floor(v.x), Math.floor(v.z)],
        ...(c && { world: [c.x, c.y, c.z] as [number, number, number] }),
      });
    }
    return p;
  };

  /** A fixture's pets built ahead, one a slice: a pen of seven at once is a stutter outside the shop. */
  function* pets(list: readonly Entry[]): Generator<void, void, void> {
    for (const e of list) {
      prebuildPet(e);
      yield;
    }
    yield;
  }

  // The back wall: cats, dragons, gear.
  yield* pets(entries("pet.2"));
  put("pets:cats", "Cat condo", 0, 0, 6, 1, (reg) => catCondo(entries("pet.2"), reg));
  yield* pets(entries("pet.4"));
  put("pets:dragons", "Dragon terrariums", 6, 0, 7, 1, (reg) => terrariums(entries("pet.4"), reg));
  yield;
  put("pets:gear", "Pet gear rack", 13, 0, 5, 1, (reg) =>
    wearRack(
      SHOP_PETWEAR.map((w) => ENTRY.get(w.id)!),
      reg,
    ),
  );
  // Pens: two for dogs, ducks with a pond, pandas among the bamboo.
  yield;
  const dogs = entries("pet.3");
  yield* pets(dogs.slice(0, 7));
  put("pets:dogs-a", "Dog pen", 2, 2, 5, 3, (reg) =>
    petPen({
      w: 5,
      d: 3,
      entries: dogs.slice(0, 7),
      reg,
      title: "DOGS",
      sub: "14 breeds, one price",
      accent: "#4f8fe0",
      cols: 4,
      seed: 1,
    }),
  );
  yield* pets(dogs.slice(7));
  put("pets:dogs-b", "Dog pen", 7, 2, 5, 3, (reg) =>
    petPen({
      w: 5,
      d: 3,
      entries: dogs.slice(7),
      reg,
      title: "MORE DOGS",
      sub: "all with the Dog",
      accent: "#4f8fe0",
      cols: 4,
      seed: 2,
    }),
  );
  yield* pets(entries("pet.1"));
  put("pets:ducks", "Duck pen", 13, 2, 5, 3, (reg) =>
    petPen({
      w: 5,
      d: 3,
      entries: entries("pet.1"),
      reg,
      title: "DUCKS",
      sub: "7 looks, pond included",
      accent: "#e0a82e",
      cols: 4,
      seed: 3,
      pond: true,
      floor: ["#9bcf6a", "#7ab04a"],
    }),
  );
  yield* pets(entries("pet.5"));
  put("pets:pandas", "Panda pen", 13, 5, 5, 3, (reg) =>
    petPen({
      w: 5,
      d: 3,
      entries: entries("pet.5"),
      reg,
      title: "PANDAS",
      sub: "bamboo on the house",
      accent: "#58b36a",
      cols: 3,
      seed: 4,
      bamboo: true,
      floor: ["#a5d977", "#86c35e"],
    }),
  );
  yield;
  put("pets:fish", "Goldfish tank", 0, 2, 4, 1, () => fishTank(), 1);
  yield;
  // The counter, the crown and the orb.
  put("pets:counter", "Counter", 7, 8, 5, 1, () => counter());
  put("pets:crown", "Crown pedestal", 6, 8, 1, 1, (reg) => {
    reg("crown.lv50", 0, 0);
    return crownDome();
  });
  put("pets:orb", "Orb pedestal", 12, 8, 1, 1, (reg) => {
    reg("pet.6", 0, 0);
    const e = ENTRY.get("pet.6")!;
    return dome(
      (m) => {
        const orb = petFrom2D("orb");
        orb.root.position.set(0, 0.75, 0);
        orb.root.scale.setScalar(0.8);
        m.add(orb.root);
        animate(orb, 9, "stand");
        sparkles(m, [0, 1.0, 0], 0.2, 4, "#bfa0ff");
      },
      e.title === "Orb" ? "Singularity orb" : e.title,
      e.line,
      "#9b6fd6",
    );
  });
  yield;
  // Toys, treats and food on the west wall; bowls and beds on the floor.
  put("pets:toys", "Toy shelf", 0, 7, 3, 1, () => toyShelf(), 1);
  for (const [x, kind] of [
    [2, "kibble"],
    [3, "water"],
  ] as const)
    put(`pets:bowls-${x}`, "Bowls", x, 7, 1, 1, () => {
      const m = new Model();
      m.box([0.8, 0.03, 0.8], "#3c4454", [0, 0, 0], 0.01);
      const a = bowl(kind);
      a.position.set(-0.17, 0.03, 0);
      const b = bowl(kind === "kibble" ? "water" : "kibble", "#e0788f");
      b.position.set(0.19, 0.03, 0.05);
      m.add(a, b);
      return m;
    });
  yield;
  [
    [2, 9, "cat", "witch"],
    [3, 9, "dog", "corgi"],
    [4, 9, "", ""],
  ].forEach(([x, z, species, variant]) => {
    const bed = PETS_ASSETS[0]!;
    const model = bed.build();
    room.place(bed, x as number, z as number, 0, model);
    if (!species) return;
    const sleeper = petFrom2D(species as string, variant as string);
    sleeper.root.position.set((x as number) + 0.5, 0.15, (z as number) + 0.5);
    sleeper.root.rotation.y = 0.6;
    room.group.add(sleeper.root);
    animate(sleeper, (x as number) * 3, "sleep");
  });
  yield;
  // The way out.
  const door = exitDoorway({ outside: true, wall: "#f7e5cd", leaf: "#3fa7a0" });
  door.position.set(15.5, 0, D + 0.5);
  door.rotation.y = Math.PI;
  room.group.add(door);

  yield;
  // The wall: a lit sign over the dragons, pennants, framed photos.
  const sign = panel(
    5.6,
    0.55,
    (g, cw, ch) => {
      g.fillStyle = "#2b2433";
      g.fillRect(0, 0, cw, ch);
      g.strokeStyle = "#e0a82e";
      g.lineWidth = 4;
      g.strokeRect(5, 5, cw - 10, ch - 10);
      g.fillStyle = "#ffe28a";
      g.font = `900 ${Math.round(ch * 0.5)}px system-ui, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("EVERY FRIEND, EVERY LOOK", cw / 2, ch / 2 + 2, cw - 30);
    },
    { frame: C.woodDark, px: 60, smooth: true, lit: true },
  );
  room.hang(sign, 9.5, 1.65);
  const flags = ["#e0584f", "#f5c842", "#3fa7a0", "#4f8fe0", "#e0788f"];
  for (let i = 0; i < 28; i++) {
    const f = new Model();
    const x = 6.2 + i * 0.25;
    f.cyl(0.1, 0.16, flags[i % flags.length]!, [0, -0.16, 0], 0.001, 3).rotation.y = Math.PI;
    f.position.set(x, 2.33 + Math.sin(i * 0.5) * 0.04 * 0, 0.12);
    room.group.add(f);
  }
  yield;
  const keeper = makeKeeper();
  keeper.root.position.set(9.5, 0.02, 7.1);
  room.group.add(keeper.root);

  return { room, displays, shopkeeper: keeper, counter: [9, 8], door: [15, 11] };
}

function buildInterior(): Interior {
  const slices = interiorSlices();
  for (;;) {
    const step = slices.next();
    if (step.done) return step.value;
  }
}

export const SHOP_PETS: ShopSpec = {
  id: "pets",
  name: "Pet shop",
  sign: "PET SHOP",
  items: ITEMS,
  exterior: petsExterior,
  footprint: { w: 5, d: 4 },
  buildInterior,
  slices: interiorSlices,
};
