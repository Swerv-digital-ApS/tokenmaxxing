import { LOOT_FIRST } from "@tokenmaxxing/core/loot.ts";
import type { Item } from "@tokenmaxxing/core/shop.ts";
import type { Facing, Look, PlayerState } from "@tokenmaxxing/core/world.ts";
import { caseAuraIcon } from "./case-aura.ts";
import { drawEditions, editionFrame } from "./editions.ts";
import { FACE_ART, HAT_ART, type Wear } from "./headwear.ts";
import { LOOT_GLASSES, LOOT_HATS, LOOT_OUTFITS } from "./loot.ts";
import { CAP, capPalette, coloursOf, drawMug, drawTop, merchFrame, merchKey, merchVersion } from "./merch.ts";
import { C, HAIRS, OUTFITS, PANTS, SKINS, shade } from "./palette.ts";
import { bake, cached, type Palette, type Pen, perObject } from "./pixels.ts";
import { drawWardrobe, outfitMarks, wardrobeIcon, wardrobePalette } from "./wardrobe.ts";

/**
 * Characters are a head (one of four styles) on a body, 16×16, recoloured per
 * look. `o` outline, `s` skin, `e` eyes, `r` blush, `h`/`H` hair, `c`/`C`
 * outfit (and caps), `p` trousers, `f` shoes. Glasses and hats from the shop
 * are drawn over the head; the ones after the first few are in `headwear.ts`.
 */

/** Which way a character is seen: from the front, the side (right; left is it mirrored) or behind. */
export type View = "down" | "side" | "up";
export type Pose = "stand" | "walkA" | "walkB" | "sit";

// Pixel art reads as a grid.
// prettier-ignore
const HEADS: Record<View, string[][]> = {
  down: [
    [
      "................",
      ".....oooooo.....",
      "....ohhhhhho....",
      "...ohhhhhhhho...",
      "...ohHhhhhHho...",
      "...ohssssssho...",
      "...osesssseso...",
      "...osrssssrso...",
      "....osssssso....",
    ],
    [
      "................",
      ".....oooooo.....",
      "....occcccco....",
      "...occcccccco...",
      "..oCCCCCCCCCCo..",
      "...ohssssssho...",
      "...osesssseso...",
      "...osrssssrso...",
      "....osssssso....",
    ],
    [
      "......oooo......",
      ".....ohhhho.....",
      "....ohhhhhho....",
      "...ohhhhhhhho...",
      "...ohhhhhhhho...",
      "...ohssssssho...",
      "...osesssseso...",
      "...osrssssrso...",
      "....osssssso....",
    ],
    [
      "................",
      ".....oooooo.....",
      "....ohhhhhho....",
      "...ohhhhhhhho...",
      "...ohhhhhhhho...",
      "..ohhssssssHho..",
      "..ohsesssseho...",
      "..ohsrssssrho...",
      "..ohhssssssHho..",
    ],
  ],
  side: [
    [
      "................",
      ".....oooooo.....",
      "....ohhhhhho....",
      "...ohhhhhhhho...",
      "...ohhhhhhHso...",
      "...ohhhhsssso...",
      "...ohhhssseso...",
      "...oHhsssrsso...",
      "....ohssssso....",
    ],
    [
      "................",
      ".....oooooo.....",
      "....occcccco....",
      "...occcccccco...",
      "...occcccCCCCCo.",
      "...ohhhhsssso...",
      "...ohhhssseso...",
      "...oHhsssrsso...",
      "....ohssssso....",
    ],
    [
      "...ooo..........",
      "..ohhoooooo.....",
      "..ohhhhhhhho....",
      "...ohhhhhhhho...",
      "...ohhhhhhhso...",
      "...ohhhhsssso...",
      "...ohhhssseso...",
      "...oHhsssrsso...",
      "....ohssssso....",
    ],
    [
      "................",
      ".....oooooo.....",
      "....ohhhhhho....",
      "...ohhhhhhhho...",
      "..ohhhhhhhhso...",
      "..ohhhhhsssso...",
      "..ohhhhssseso...",
      "..ohhHhsssrso...",
      "..ohhhoossso....",
    ],
  ],
  up: [
    [
      "................",
      ".....oooooo.....",
      "....ohhhhhho....",
      "...ohhhhhhhho...",
      "...ohhhhhhhho...",
      "...ohhhhhhhho...",
      "...ohHhhhhHho...",
      "...oshhhhhhso...",
      "....osssssso....",
    ],
    [
      "................",
      ".....oooooo.....",
      "....occcccco....",
      "...occcccccco...",
      "...occcccccco...",
      "...oCCCCCCCCo...",
      "...ohhhhhhhho...",
      "...oshhhhhhso...",
      "....osssssso....",
    ],
    [
      "......oooo......",
      ".....ohhhho.....",
      "....ohhHHhho....",
      "...ohhhhhhhho...",
      "...ohhhhhhhho...",
      "...ohhhhhhhho...",
      "...ohHhhhhHho...",
      "...oshhhhhhso...",
      "....osssssso....",
    ],
    [
      "................",
      ".....oooooo.....",
      "....ohhhhhho....",
      "...ohhhhhhhho...",
      "..ohhhhhhhhhho..",
      "..ohhhhhhhhhho..",
      "..ohhHhhhhHhho..",
      "..ohhhhhhhhhho..",
      "..ohhhhhhhhhho..",
      "...ohhhhhhhho...",
    ],
  ],
};

// Pixel art reads as a grid.
// prettier-ignore
const BODIES: Record<View, Record<Pose, string[]>> = {
  down: {
    stand: [
      "....occcccco....",
      "...occcccccco...",
      "...oscccccCso...",
      "....oppppppo....",
      "....oppooppo....",
      "....ofo..ofo....",
      "................",
    ],
    walkA: [
      "....occcccco....",
      "...occcccccco...",
      "...oscccccCso...",
      "....oppppppo....",
      "....oppooffo....",
      "....ofo..oo.....",
      "................",
    ],
    walkB: [
      "....occcccco....",
      "...occcccccco...",
      "...oscccccCso...",
      "....oppppppo....",
      "....offooppo....",
      ".....oo..ofo....",
      "................",
    ],
    sit: [
      "....occcccco....",
      "...occcccccco...",
      "...oscccccCso...",
      "....oppppppo....",
      "....offooffo....",
      "................",
      "................",
    ],
  },
  side: {
    stand: [
      ".....occcco.....",
      "....occcccco....",
      "....occcsCco....",
      ".....opppo......",
      ".....opppo......",
      ".....offffo.....",
      "................",
    ],
    walkA: [
      ".....occcco.....",
      "....occcccco....",
      "....occcsCco....",
      ".....opppo......",
      "....oppopo......",
      "....offoffo.....",
      "................",
    ],
    walkB: [
      ".....occcco.....",
      "....occcccco....",
      "....occcsCco....",
      ".....opppo......",
      ".....oppo.......",
      ".....offfo......",
      "................",
    ],
    sit: [
      ".....occcco.....",
      "....occcccco....",
      "....occcsCco....",
      ".....oppppo.....",
      ".....opoffo.....",
      "................",
      "................",
    ],
  },
  up: {
    stand: [
      "....occcccco....",
      "...occcccccco...",
      "...osccccccso...",
      "....oppppppo....",
      "....oppooppo....",
      "....ofo..ofo....",
      "................",
    ],
    walkA: [
      "....occcccco....",
      "...occcccccco...",
      "...osccccccso...",
      "....oppppppo....",
      "....oppooffo....",
      "....ofo..oo.....",
      "................",
    ],
    walkB: [
      "....occcccco....",
      "...occcccccco...",
      "...osccccccso...",
      "....oppppppo....",
      "....offooppo....",
      ".....oo..ofo....",
      "................",
    ],
    sit: [
      "....occcccco....",
      "...occcccccco...",
      "...osccccccso...",
      "....oppppppo....",
      "................",
      "................",
      "................",
    ],
  },
};

/** Glasses over the eyes (rows 5–7 of the head); from behind they don't show. */
// Pixel art reads as a grid.
// prettier-ignore
const GLASSES: Record<"down" | "side", string[]>[] = [
  { down: [], side: [] },
  // Nerd specs: round frames, eyes still showing.
  {
    down: ["....ggg..ggg....", "...gl.lggl.lg...", "....ggg..ggg...."],
    side: [".........ggg....", "......gggl.lg...", ".........ggg...."],
  },
  // Shades and heart glasses: solid lenses.
  {
    down: ["....gggggggg....", "....lllggllll...", ".....ll..ll....."],
    side: ["........gggg....", "......ggllll....", ".........ll....."],
  },
  {
    down: ["....l.l..l.l....", "....lllggllll...", ".....l....l....."],
    side: ["........l.l.....", "......gglll.....", ".........l......"],
  },
];
const GLASSES_COLORS: Palette[] = [
  {},
  { g: "#6b4226", l: "#cde9f6" },
  { g: C.ink, l: "#1c1a24" },
  { g: "#c23a6b", l: "#ff6fa3" },
];

/** Hats over the top of the head, from row 0. `o` outline. */
// Pixel art reads as a grid.
// prettier-ignore
const HATS: Record<View, string[]>[] = [
  { down: [], side: [], up: [] },
  // Beanie with a bobble.
  {
    down: [".......bb.......", ".....oooooo.....", "....obbbbbbo....", "...obbbbbbbbo...", "...oBBBBBBBBo..."],
    side: [".......bb.......", ".....oooooo.....", "....obbbbbbo....", "...obbbbbbbbo...", "...oBBBBBBBBBo.."],
    up: [".......bb.......", ".....oooooo.....", "....obbbbbbo....", "...obbbbbbbbo...", "...oBBBBBBBBo..."],
  },
  // Headphones: a band over the top and a cup on each ear.
  {
    down: ["................", "....okkkkkko....", "...ok......ko...", "..ok........ko..", "..omo......omo..", "..omo......omo..", "..omo......omo..", "...o........o..."],
    side: ["................", ".....okkkkko....", ".....k.....o....", ".....k..........", "....omo.........", "....omo.........", "....omo.........", ".....o.........."],
    up: ["................", "....okkkkkko....", "...ok......ko...", "..ok........ko..", "..omo......omo..", "..omo......omo..", "..omo......omo..", "...o........o..."],
  },
  // Crown.
  {
    down: [".....y.yy.y.....", ".....yyyyyy.....", ".....yryyby.....", ".....YYYYYY....."],
    side: [".....y.yy.y.....", ".....yyyyyy.....", ".....yryyby.....", ".....YYYYYY....."],
    up: [".....y.yy.y.....", ".....yyyyyy.....", ".....yyyyyy.....", ".....YYYYYY....."],
  },
  // Top hat (level 10): tall, with a red band and a wide brim.
  {
    down: ["....oooooooo....", "....okkkkkKo....", "....okkkkkKo....", "....orrrrrro....", "..okkkkkkkkkko.."],
    side: ["....oooooooo....", "....okkkkkKo....", "....okkkkkKo....", "....orrrrrro....", "..okkkkkkkkkkko."],
    up: ["....oooooooo....", "....okkkkkko....", "....okkkkkko....", "....orrrrrro....", "..okkkkkkkkkko.."],
  },
];
const HAT_COLORS: Palette[] = [
  {},
  { o: C.ink, b: "#e0584f", B: "#f4efe4" },
  { o: C.ink, k: "#3a3f4b", m: "#e0584f" },
  { y: "#f5c842", Y: "#c9971f", r: "#e0584f", b: "#4f8fe0" },
  { o: C.ink, k: "#3a3546", K: "#5a5468", r: "#c23a3a" },
];

/** Raid loot hats and glasses (art/loot.ts) as `headwear.ts` draws them. */
const LOOT_HAT_ART: Wear[] = LOOT_HATS.map((h) => ({ ...h.rows, pal: h.pal }));
const LOOT_FACE_ART: Wear[] = LOOT_GLASSES.map((g) => ({ ...g.rows, y: 5, pal: g.pal }));

/** A hat or face thing as `headwear.ts` draws them: the first few here, the pack's after, then loot. */
const hatArt = (i: number): Wear | undefined =>
  i < HATS.length
    ? { ...HATS[i]!, pal: HAT_COLORS[i]! }
    : i < LOOT_FIRST.hat
      ? HAT_ART[i - HATS.length]
      : LOOT_HAT_ART[i - LOOT_FIRST.hat];
const faceArt = (i: number): Wear | undefined =>
  i < GLASSES.length
    ? { ...GLASSES[i]!, y: 5, pal: GLASSES_COLORS[i]! }
    : i < LOOT_FIRST.glasses
      ? FACE_ART[i - GLASSES.length]
      : LOOT_FACE_ART[i - LOOT_FIRST.glasses];

/** Over a head whose top is at `oy`; the wearer's own colours fill in what the item leaves out. */
function wearOn(p: Pen, w: Wear | undefined, view: View, base: Palette, oy = 0, flip = false): void {
  if (w) p.grid(w[view] ?? [], { ...base, ...w.pal }, 0, oy + (w.y ?? 0), flip);
}

/** Server-rack armour (outfit 12): seams and blinking lights over the top of the body. */
// Pixel art reads as a grid.
// prettier-ignore
const RACK: Record<View, string[]> = {
  down: [".....g.y.g......", "....llllllll....", ".....g.g.y......"],
  side: [".......g.y......", ".....llllll.....", "......g........."],
  up: ["................", "....llllllll....", "................"],
};
const RACK_COLORS: Palette = { l: "#8a93a1", g: "#3ddc84", y: "#f5c842" };

/** A raid loot outfit, after the wardrobe's (`LOOT_FIRST`). */
const lootOutfit = (i: number) => (i < LOOT_FIRST.outfit ? undefined : LOOT_OUTFITS[i - LOOT_FIRST.outfit]);

/** Which company merch a look wears, by kind. */
const worn = (look: Look) => {
  const bits = look.merch === 0 ? 0 : look.merchWorn;
  return { hoodie: (bits & 2) > 0, top: (bits & 3) > 0, cap: (bits & 4) > 0, mug: (bits & 8) > 0 };
};

/** A look's colours, once per look (merch colours change with the companies: see `merchVersion`). */
export const lookPalette = perObject(paletteOf, merchVersion);

function paletteOf(look: Look): Palette {
  const hair = HAIRS[look.hair] ?? HAIRS[0]!;
  const merch = worn(look).top ? coloursOf(look.merch) : null;
  const loot = lootOutfit(look.outfit);
  const [outfit, outfitShade] = merch
    ? [merch.main, merch.shade]
    : (OUTFITS[look.outfit] ?? loot?.colors ?? OUTFITS[0]!);
  const pants = PANTS[look.outfit] ?? loot?.pants ?? PANTS[0]!;
  return {
    o: C.ink,
    s: SKINS[look.skin] ?? SKINS[0]!,
    e: C.ink,
    r: "#f19a8b",
    h: hair,
    H: shade(hair, -0.22),
    c: outfit,
    C: outfitShade,
    p: pants,
    f: "#3a2e2a",
    ...(merch ? {} : wardrobePalette(look.outfit)),
  };
}

/** What a look draws as, for the caches; once per look (looks are replaced, never edited). */
const lookKey = perObject(
  (l: Look) =>
    `${l.style}.${l.skin}.${l.hair}.${l.outfit}.${l.glasses}.${l.hat}.${l.held}.${l.back}` +
    (l.merch && l.merchWorn ? `.${l.merchWorn}:${merchKey(l.merch)}` : ""),
  merchVersion,
);

/** One 16×16 frame. Left is the right-facing side view, mirrored. */
export const characterFrame = cached(
  (look: Look, facing: Facing, pose: Pose) => `${lookKey(look)}:${facing}:${pose}`,
  (look: Look, facing: Facing, pose: Pose) => {
    const view: View = facing === "left" || facing === "right" ? "side" : facing;
    const flip = facing === "left";
    const pal = lookPalette(look);
    return bake(16, 16, (p) => {
      const merch = worn(look);
      const colours = coloursOf(look.merch);
      drawWardrobe(p, look, view, pose, "behind", pal.s!, flip);
      p.grid(BODIES[view][pose], pal, 0, 9, flip);
      if (look.outfit === 12 && !merch.top) p.grid(RACK[view], RACK_COLORS, 0, 9, flip);
      const loot = lootOutfit(look.outfit);
      if (loot && !merch.top) p.grid(loot.over[view], loot.pal, 0, 9, flip);
      if (!merch.top) drawWardrobe(p, look, view, pose, "body", pal.s!, flip);
      p.grid(HEADS[view][look.style] ?? HEADS[view][0]!, pal, 0, 0, flip);
      if (merch.top) drawTop(p, colours, view, merch.hoodie, flip);
      wearOn(p, faceArt(look.glasses), view, pal, 0, flip);
      // The company cap instead of a hat.
      if (merch.cap) p.grid(CAP[view], capPalette(colours), 0, 0, flip);
      else wearOn(p, hatArt(look.hat), view, pal, 0, flip);
      drawWardrobe(p, look, view, pose, "front", pal.s!, flip);
      // One right hand: a held item keeps it, as in 3D.
      if (merch.mug && !look.held) drawMug(p, colours, view, flip);
      drawEditions(p, look, view, flip);
    });
  },
);

/** A beard on the floor has to be some colour: brown. */
const ON_THE_FLOOR = lookPalette({
  style: 0,
  skin: 0,
  hair: 1,
  outfit: 0,
  glasses: 0,
  hat: 0,
  pet: 0,
  held: 0,
  back: 0,
  petwear: 0,
  petVariant: 0,
  merch: 0,
  merchWorn: 0,
});

/**
 * A hat, glasses or outfit on its own, as it lies on the floor and sits in the bag: as tall as the
 * thing. An outfit is the top of the body, hands left out and the trousers' row as its hem.
 */
export const itemFrame = cached(
  (item: Item) => (item.companyId === undefined ? item.id : `${item.id}:${merchKey(item.companyId)}`),
  (item: Item) => {
    const { slot, index: i } = item;
    if (slot === "merch") return merchFrame(item.companyId!, i);
    const aura = slot === "aura" ? caseAuraIcon(i) : null;
    if (aura) return aura;
    const wardrobe = wardrobeIcon(item);
    if (wardrobe) return wardrobe;
    const edition = editionFrame(item);
    if (edition) return edition;
    const w = slot === "hat" ? hatArt(i) : slot === "glasses" ? faceArt(i) : undefined;
    if (w) return bake(16, w.down.length, (p) => wearOn(p, { ...w, y: 0 }, "down", ON_THE_FLOOR));
    const loot = lootOutfit(i);
    const [c, shade] = OUTFITS[i] ?? loot?.colors ?? OUTFITS[0]!;
    return bake(16, 4, (p) => {
      p.grid(BODIES.down.stand.slice(0, 4), { o: C.ink, c, C: shade, ...wardrobePalette(i), p: C.ink });
      if (i === 12) p.grid(RACK.down, RACK_COLORS);
      outfitMarks(p, i, "down", 0);
      if (loot) p.grid(loot.over.down.slice(0, 4), loot.pal);
    });
  },
);

/** Asleep in bed, seen from above: head on the pillow, blanket in the outfit colour. */
export const sleeperFrame = cached(
  (look: Look) => lookKey(look),
  (look: Look) => {
    const pal = lookPalette(look);
    return bake(16, 16, (p) => {
      p.grid(HEADS.down[look.style] ?? HEADS.down[0]!, { ...pal, e: pal.s!, r: pal.s! }, 0, -1);
      // The company cap instead of a hat, as when awake.
      if (worn(look).cap) p.grid(CAP.down, capPalette(coloursOf(look.merch)), 0, -1);
      else wearOn(p, hatArt(look.hat), "down", pal, -1);
      drawEditions(p, { ...look, glasses: 0 }, "down", false, -1);
      p.rect(3, 6, 10, 1, C.ink);
      p.px(6, 5, C.ink);
      p.px(9, 5, C.ink);
    });
  },
);

/** The pose for a moment: walking alternates feet; seated players sit; resting ones don't move. */
export function poseFor(state: PlayerState, walking: boolean, t: number): Pose {
  if (state === "sit" || state === "working") return "sit";
  if (!walking) return "stand";
  return Math.floor(t / 110) % 2 === 0 ? "walkA" : "walkB";
}
