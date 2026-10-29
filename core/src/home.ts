/**
 * Furniture for personal offices only: plants, a keyboard in a glass case, a whiteboard and the like.
 * Bought from the shop with coins like the rest of `FURNITURE`, but only ever put down in your own
 * office (`canDropIn`), never in the company building, and purely cosmetic: nothing here earns, buffs
 * or rewards anything. Each is one map character (Danish letters: nothing else uses them), `art` its
 * sprite in `web/src/art/furniture-home.ts`, `text` the line E shows. The ones flagged `wall` hang on
 * the office's top wall (`canHang`), like posters do in the building.
 */
import type { Piece } from "./office.ts";

export type HomePiece = Piece & {
  art: string;
  text: string;
  home: true;
  /** E sits (or lies) you down on it. */
  seat?: "sofa";
  /** Lies flat on the floor: people walk over it. */
  flat?: true;
};

const home = (
  ch: string,
  art: string,
  name: string,
  price: number,
  w: number,
  text: string,
  extra: Partial<Pick<HomePiece, "wall" | "seat" | "flat">> = {},
): HomePiece => ({ ch, art, name, price, w, text, home: true, ...extra });

/** Cheapest first. */
export const HOME_PIECES: readonly HomePiece[] = [
  home("ø", "cactus", "Cactus", 60, 1, "A cactus. It has survived every sprint review so far."),
  home(
    "ê",
    "certificate",
    "Framed certificate",
    70,
    1,
    "Certified Prompt Engineer, with honours. The exam was one question.",
    {
      wall: true,
    },
  ),
  home("é", "bean-bag", "Bean bag", 90, 1, "A bean bag. Getting up is a two-step process.", { seat: "sofa" }),
  home(
    "Æ",
    "hanging-plant",
    "Hanging plant",
    105,
    1,
    "A pothos on a macrame hanger. It trails further every week.",
    {
      wall: true,
    },
  ),
  home("ç", "wool-rug", "Wool rug", 105, 2, "", { flat: true }),
  home("ß", "floor-lamp", "Floor lamp", 120, 1, "A floor lamp with a warm bulb. Hygge, on a dimmer."),
  home(
    "æ",
    "fiddle-fig",
    "Fiddle-leaf fig",
    135,
    1,
    "A fiddle-leaf fig. It is dramatic about draughts, and so are you.",
  ),
  home(
    "ö",
    "duck-shelf",
    "Rubber-duck shelf",
    150,
    1,
    "Three ducks, ready to hear the bug. One is a pirate.",
  ),
  home(
    "Å",
    "wall-whiteboard",
    "Office whiteboard",
    165,
    2,
    "A diagram with seven boxes, eleven arrows and a cloud labelled 'the cloud'.",
    {
      wall: true,
    },
  ),
  home("ä", "home-fridge", "Mini fridge", 180, 1, "Oat milk, Club-Mate and a lone birthday cake slice."),
  home(
    "å",
    "bonsai-stand",
    "Bonsai on a stand",
    195,
    1,
    "A bonsai on a teak stand. Trimmed one commit at a time.",
  ),
  home(
    "ü",
    "bookcase",
    "Bookcase",
    225,
    2,
    "Books about type systems, one about sourdough, and a very old manual.",
  ),
  home("ñ", "wall-neon", "Pink neon sign", 300, 2, "SHIP IT, in pink. It hums a little.", { wall: true }),
  home(
    "Ø",
    "keyboard-case",
    "Mechanical keyboard display",
    390,
    2,
    "A glass case for a keyboard that clacks like rain. Not for typing. Look, don't touch.",
  ),
];

const BY_CH = new Map(HOME_PIECES.map((p) => [p.ch, p]));

export const isHomePiece = (ch: unknown): boolean => BY_CH.has(ch as string);
export const homePieceOf = (ch: unknown): HomePiece | undefined => BY_CH.get(ch as string);
