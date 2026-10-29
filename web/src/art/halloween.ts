import { C } from "./palette.ts";
import { bake, cached } from "./pixels.ts";

/** Halloween's jack-o'-lanterns (`game/halloween.ts`): a big one and a small one, carved face dark or lit. */

const PUMPKIN = { o: C.ink, p: "#e8772a", P: "#c25a1c", g: "#5a8a2a", G: "#3f6b1f" };
/** The carved face: candlelit after dark, a dark hollow by day. */
const LIT = "#ffd04a";
const HOLLOW = "#5a2a10";

// Pixel art reads as a grid.
// prettier-ignore
const BIG = [
  ".....gG.....",
  "..oooggooo..",
  ".opPpPPpPpo.",
  "opPYYpPYYpPo",
  "opPpYpPpYpPo",
  "opPpppPpppPo",
  "opYpPpPpPpYo",
  "oPpYYYpYYYpo",
  ".oPppPPpppo.",
  "..oooooooo..",
];

// prettier-ignore
const SMALL = [
  "....g....",
  ".ooogooo.",
  "opPpPpPpo",
  "oPYpPpYPo",
  "opPpPpPpo",
  "oPYYYYYPo",
  ".ooooooo.",
];

export const pumpkinSprite = cached(
  (big: boolean, lit: boolean) => `${big}:${lit}`,
  (big: boolean, lit: boolean) => {
    const rows = big ? BIG : SMALL;
    return bake(rows[0]!.length, rows.length, (p) => p.grid(rows, { ...PUMPKIN, Y: lit ? LIT : HOLLOW }));
  },
);
