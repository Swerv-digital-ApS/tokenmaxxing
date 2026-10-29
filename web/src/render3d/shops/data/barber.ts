/**
 * The barber's catalogue, a snapshot of what the 2D game lets you change about a face and a head:
 *  - style / skin / hair: the Bag's You tab (`web/src/hud/Bag.tsx`), `LOOK_OPTIONS` in
 *    `core/src/world.ts` (style 4, skin 4, hair 6) and `STYLE_NAMES`. They are free; the colours are
 *    `SKINS` and `HAIRS` in `web/src/art/palette.ts`. The 2D game has no names for colours; these are ours.
 *  - face: `look.glasses` (`core/src/shop.ts` Nerd specs, Shades, Heart glasses) and the head pack's face
 *    things (`core/src/headwear.ts` `PACK_FACES`, from index 4). Two of those are facial hair.
 * Ids are `<slot>.<index>` like the 2D shop's; `style.`, `skin.` and `hair.` index the free `Look` fields.
 */
import { fromCore } from "./core.ts";

export type FaceSlot = "style" | "skin" | "hair" | "glasses";
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface BarberRow {
  id: string;
  slot: FaceSlot;
  /** The value of `look[slot]` when worn. */
  index: number;
  name: string;
  price: number;
  level?: number;
  rarity?: Rarity;
  blurb: string;
}

export const STYLE_NAMES = [
  "Short hair and tee",
  "Cap and hoodie",
  "Bun and jacket",
  "Long hair and skirt",
] as const;
export const SKIN_COLOURS = ["#f6d3b3", "#e9b38c", "#c68a5f", "#8d5a3c"] as const;
export const SKIN_NAMES = ["Porcelain", "Sand", "Caramel", "Umber"] as const;
export const HAIR_COLOURS = ["#3b2a22", "#6b4226", "#c9853a", "#e8cf7a", "#2e2e3a", "#b2463d"] as const;
export const HAIR_NAMES = ["Espresso", "Chestnut", "Ginger", "Blonde", "Midnight", "Auburn"] as const;

const row = (
  slot: FaceSlot,
  index: number,
  name: string,
  price: number,
  blurb: string,
  extra: Partial<BarberRow> = {},
): BarberRow => ({
  id: `${slot}.${index}`,
  slot,
  index,
  name,
  price,
  blurb,
  ...extra,
});

export const STYLE_ROWS: readonly BarberRow[] = STYLE_NAMES.map((n, i) =>
  row("style", i, n, 0, "Free from the character creator."),
);
export const SKIN_ROWS: readonly BarberRow[] = SKIN_NAMES.map((n, i) =>
  row("skin", i, `${n} skin`, 0, "Free from the character creator."),
);
export const HAIR_ROWS: readonly BarberRow[] = HAIR_NAMES.map((n, i) =>
  row("hair", i, `${n} hair`, 0, "Free from the character creator."),
);

// prettier-ignore
const FACE_SNAPSHOT: readonly BarberRow[] = [
  row("glasses", 1, "Nerd specs", 60, "Round and bookish."),
  row("glasses", 2, "Shades", 100, "Too bright to look at."),
  row("glasses", 3, "Heart glasses", 150, "Love at first sight."),
  row("glasses", 4, "Hallucination nose", 105, "Confidently wrong, and red about it.", { rarity: "common" }),
  row("glasses", 5, "3D glasses", 135, "Red, blue, and rendered in depth.", { rarity: "common" }),
  row("glasses", 6, "Hygge moustache", 150, "Grown over one long, candlelit winter.", { rarity: "common" }),
  row("glasses", 7, "Eyepatch", 165, "Lost an eye to an IDE with no dark mode.", { rarity: "uncommon" }),
  row("glasses", 8, "Harbour swim goggles", 195, "Islands Brygge ready. The water is 14 °C.", { rarity: "uncommon" }),
  row("glasses", 9, "Monocle", 270, "For reviewing pull requests with distinction.", { rarity: "uncommon" }),
  row("glasses", 10, "Rockstar glasses", 300, "10x engineer energy.", { rarity: "uncommon" }),
  row("glasses", 11, "Prompt bandit bandana", 220, "Steals context from other tabs.", { rarity: "uncommon" }),
  row("glasses", 12, "CopenHill ski goggles", 240, "Off-piste down the power plant's roof.", { rarity: "uncommon" }),
  row("glasses", 13, "Rate-limit visor", 290, "429: too many requests. Try again in 60 s.", { rarity: "uncommon" }),
  row("glasses", 14, "Viking beard", 380, "Braided, battle-tested, your own colour.", { rarity: "rare" }),
  row("glasses", 15, "Deal-with-it shades", 400, "Merged without review. Deal with it.", { rarity: "rare" }),
  row("glasses", 16, "Context window glasses", 450, "See 200K tokens at once. Forget the middle.", { rarity: "rare" }),
  row("glasses", 17, "Vision headset", 850, "Spatial computing, local hallucinations.", { rarity: "epic" }),
  row("glasses", 18, "Bot mask", 950, "Passes the Turing test, backwards.", { rarity: "epic" }),
  row("glasses", 19, "Laser eyes", 1800, "Tokens to the moon.", { rarity: "legendary" }),
  row("glasses", 20, "Nebula visor", 0, "One wraparound lens, violet to cyan. Sees the whole context.", { rarity: "legendary", level: 40 }),
];

export const FACE_ROWS: readonly BarberRow[] = fromCore(FACE_SNAPSHOT);

/** The two face things that are hair: the moustache and the beard, grown in your hair colour. */
export const FACIAL_HAIR_IDS = ["glasses.6", "glasses.14"] as const;
