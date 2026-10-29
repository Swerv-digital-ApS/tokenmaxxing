import { C } from "./palette.ts";
import { bake, cached, type Palette, type Pen } from "./pixels.ts";

/**
 * Desk setups (`core/src/desks.ts`): the desk at a seat, one sprite per tier above the laptop, each with
 * its monitors. All are 16 wide like `desk()` in objects.ts and 22 tall (the laptop's is 18: the extra is
 * screen), so they bottom-align on the same tile. A grid is the screens from the top (`S` glass, `a` `b`
 * `g` `p` lines of text, `x` the tail of a line, which blinks while someone types); the desk is drawn
 * under it. `game/render.ts` picks the tier and the mode.
 */

/** Dark glass (nobody at the desk), lit glass (sitting), or lit with the text growing and shrinking (working). */
export type ScreenMode = "off" | "lit" | "typingA" | "typingB";

/** The screens' top row, in the sprite. */
const TOP = 1;

const DUAL = [
  ".oooooooooooooo.",
  ".oaaaxSooggbSSo.",
  ".oSbbbSooSaaxSo.",
  ".oaaSSSooppSSSo.",
  ".oSbbxSooSSaaSo.",
  ".oSSSSSooSSSSSo.",
  ".oooooooooooooo.",
  "....m......m....",
  "...mmm....mmm...",
];

/** Three: the middle one is taller and the sides step down to it. */
const TRIPLE = [
  ".....oooooo.....",
  "ooooooaaxSoooooo",
  "oaaxooSbbSooggSo",
  "oSbSooaaxSooSpSo",
  "oaSSooSbbSooSSxo",
  "oSSSooaaSSooppSo",
  "oSbxooSSSSooSSSo",
  "oooooooooooooooo",
  "..m....mm....m..",
  ".mmm..mmmm..mmm.",
];

/** One long curved screen: the corners are cut, and it runs edge to edge. */
const ULTRA = [
  ".oooooooooooooo.",
  "oaaaaxSSSSbbbbSo",
  "oSaaaaaxSSggbSSo",
  "oaaxSSSSSSaaaxSo",
  "oSSbbbxSSSppSSSo",
  "oaaaxSSSSSbbSSSo",
  "oSSSSSSSSSSSSSSo",
  ".oooooooooooooo.",
  ".......mm.......",
  "......mmmm......",
];

const PAL_OFF: Palette = { o: C.ink, S: "#2f3a4a", a: "#2f3a4a", b: "#2f3a4a", g: "#2f3a4a", p: "#2f3a4a" };

const palette = (tier: string, mode: ScreenMode): Palette => {
  if (mode === "off") return { ...PAL_OFF, x: "#2f3a4a", m: C.metal };
  // The battlestation's screens are dark with neon text; the rest are the laptop's cyan.
  const neon = tier === "battlestation";
  return {
    o: C.ink,
    m: C.metal,
    S: neon ? "#1b2140" : C.screen,
    a: neon ? "#5ff2ff" : C.white,
    b: neon ? "#ff6ad5" : "#5fc6e8",
    g: neon ? "#7dff8a" : "#5fd08a",
    p: "#b58cf0",
    // The end of a line: there, or not, every other beat.
    x: mode === "typingB" ? (neon ? "#1b2140" : C.screen) : neon ? "#5ff2ff" : C.white,
  };
};

/** The desk itself, shifted down 4 from the laptop's so there's room for taller screens above. */
function base(p: Pen): void {
  p.rect(0, 10, 16, 12, C.ink);
  p.rect(0, 11, 16, 4, C.woodLight);
  p.rect(0, 15, 16, 5, C.wood);
  p.rect(0, 20, 2, 2, C.woodDark);
  p.rect(14, 20, 2, 2, C.woodDark);
}

const keyboard = (p: Pen, c: string) => {
  p.rect(3, 11, 10, 2, c);
  p.rect(3, 13, 10, 1, C.metal);
};

/** The battlestation's extras: an RGB strip under the desk top, a glass-sided tower, a lit keyboard. */
function rig(p: Pen, mode: ScreenMode): void {
  const on = mode !== "off";
  const [a, b] = mode === "typingB" ? ["#ff6ad5", "#5ff2ff"] : ["#5ff2ff", "#ff6ad5"];
  // The strip, in two colours that trade places.
  for (let x = 2; x < 12; x++) p.px(x, 15, on ? (x % 2 === 0 ? a : b) : "#4a4058");
  // The tower at the right end, over the leg.
  p.rect(11, 12, 5, 10, C.ink);
  p.rect(12, 13, 3, 8, "#2b3140");
  p.rect(12, 13, 1, 8, "#3d465a");
  for (const [y, c] of [
    [14, a],
    [16, b],
    [18, a],
  ] as const)
    p.rect(13, y, 2, 1, on ? c : "#4a4058");
  p.px(14, 20, on ? "#7dff8a" : "#4a4058");
}

/** Today's laptop (`desk()` in objects.ts) in the same frame, for the Desk panel; the world draws its own. */
function laptop(p: Pen, mode: ScreenMode): void {
  p.rect(4, 4, 8, 7, C.ink);
  p.rect(5, 5, 6, 5, mode === "off" ? "#2f3a4a" : C.screen);
  if (mode !== "off") {
    p.rect(5, 6, 3, 1, C.white);
    p.rect(5, 8, 5, 1, "#5fc6e8");
  }
  p.rect(3, 11, 10, 2, C.metalLight);
  p.rect(3, 13, 10, 1, C.metal);
}

/** Every setup, as it looks now. `tier` is an index in `DESKS`. */
export const deskFrame = cached(
  (tier: number, mode: ScreenMode) => `${tier}${mode}`,
  (tier: number, mode: ScreenMode) =>
    bake(16, 22, (p) => {
      const id = ["laptop", "dual", "triple", "ultrawide", "battlestation"][tier] ?? "dual";
      base(p);
      if (tier === 0) return laptop(p, mode);
      const pal = palette(id, mode);
      p.grid(tier === 1 ? DUAL : tier === 2 || tier === 4 ? TRIPLE : ULTRA, pal, 0, TOP);
      keyboard(p, id === "battlestation" && mode !== "off" ? "#b58cf0" : C.metalLight);
      if (id === "battlestation") rig(p, mode);
    }),
);
