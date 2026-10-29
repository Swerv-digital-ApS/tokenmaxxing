import { RAGNAROK_GLASSES, RAGNAROK_HATS } from "./case-ragnarok.ts";
import type { Art } from "./editions.ts";
import { FISHING_HATS } from "./fishing-loot.ts";
import { C } from "./palette.ts";

/**
 * The Night Market case's and the Nusantara case's hats and glasses (`core/src/case.ts`,
 * `core/src/case-nusantara.ts`), drawn like the merchant's editions (`editions.ts`, which looks these up):
 * hats over the head from row 0, glasses over the eyes from row 5.
 * A grid per view; a missing side or back view is the front one. Keyed by item id.
 */

const o = C.ink;

// Pixel art reads as a grid.
// prettier-ignore
export const CASE_HATS: Record<string, Art> = {
  // Straw kasa: a wide woven cone, ribbed, with a chin cord.
  "hat.300": {
    down: ["......oooo......", "....oossssoo....", "...osSsSsSsSso..", "..osSsSsSsSsSso.", ".oSsSsSsSsSsSsSo", "o.c..........c.o"],
    pal: { o, s: "#e8cd7e", S: "#c29a46", c: "#8a5a2b" },
  },
  // Hachimaki: a white twisted headband with the red sun, knotted at the side, tails hanging.
  "hat.301": {
    down: ["................", "...owwwwwwwwo...", "...owwwrrwwwo...", "....ooooooooRw..", "..............Rw"],
    side: ["................", "...owwwwwwwwo...", "...owwwwrrwwo...", "....ooooooooo...", "..Rw............"],
    pal: { o, w: "#fbf7ef", r: "#d9323a", R: "#d9323a" },
  },
  // Paper fan visor: a folding fan opened into a half-circle of red and white pleats, gold rim and pivot, over a headband.
  "hat.302": {
    down: ["....oyyyyyyo....", "..oyrwrwrwrwyo..", ".oywrwrwrwrwryo.", "...orwryywrwo...", "...kkkkkkkkkk..."],
    side: ["......oyyo......", ".....oyrwro.....", "....oyrwrwro....", "....oorwyyrwoo..", "....kkkkkkkk...."],
    pal: { o, r: "#d9323a", w: "#fbf7ef", y: "#f0c45a", k: "#2f2a3a" },
  },
  // Fox half-mask: a white kitsune mask pushed up on the brow, pointed ears with red insides, red cheek stripes,
  // black eye slits and nose tip, tied on with a red cord.
  "hat.303": {
    down: ["..oo........oo..", "..orro....orro..", "..orwoooooowro..", ".rrowkwwwwkwor..", "..owrwwwwwwrwo..", "...owrwkkwrwo..."],
    side: [".....oo..oo.....", "....orro.orro...", "....orwoooowro..", "..rrowwwwwkwwo..", "....owwwwwwrwo..", ".....owwwrwkko.."],
    pal: { o, w: "#fbf7ef", r: "#d9323a", k: "#14121a" },
  },

  // Blangkon: a folded batik headcloth, brown and indigo with cream diamonds, a tan band over the brow and the
  // little knot (mondolan) at the back, which the side and back views show.
  "hat.400": {
    down: ["................", ".....oooooo.....", "....obwbbwbo....", "...obibwwbibo...", "...ottTttTtto..."],
    side: ["................", ".....oooooo.....", "..oooobwbbwbo...", ".obbbobibwwbibo.", ".obTbottTttTtto."],
    up: ["................", ".....oooooo.....", "....obwbbwbo....", "...obibwwbibo...", "...ottTobboTtto."],
    pal: { o, b: "#6b4226", i: "#243a73", w: "#f1e3c2", t: "#c9a56a", T: "#a07f46" },
  },
  // Peci: black velvet, flat-topped and straight-sided, worn a touch forward, a faint sheen band.
  "hat.401": {
    down: ["................", "....oooooooo....", "....okKkkkko....", "....oKKKKKKo....", "....oooooooo...."],
    side: ["................", "....ooooooooo...", "....okKkkkkkko..", "....oKKKKKKKKo..", "....ooooooooo..."],
    pal: { o, k: "#1c1a22", K: "#3d3a48" },
  },
  // Ojek helmet: an open-face pale-green half-dome, a flip visor pushed up, red and yellow stickers, a chin strap.
  "hat.402": {
    down: ["......oooo......", "....ooggggoo....", "...oggGggggGo...", "..ogRggggggYgo..", "..oGvvvvvvvvGo..", "................", "...k........k..."],
    side: ["......ooooo.....", "....ooggggggo...", "...ogggGggggGoo.", "..ogRggggYggGooo", "..oGGGGGGGGGvvvo", "...k........vvo.", "...k............"],
    pal: { o, g: "#a9dca4", G: "#7fbf86", R: "#d6343a", Y: "#f2b632", k: "#3a3a44", v: "#cfeff0" },
  },
  // Little Bromo: a grey-brown volcano on the head, a red lava rim and grey puffs of smoke rising off it.
  "hat.403": {
    down: [".....sS..Ss.....", ".....orRRro.....", "....oggGggGo....", "...oggGgrGggo...", "..oggGggGggGgo.."],
    side: [".sS..sS.........", "....orRRro......", "...oggGggGo.....", "..oggGgrGggo....", ".oggGggGggGgo..."],
    pal: { o, g: "#85705f", G: "#5e4c3f", r: "#d6343a", R: "#f2b632", s: "#d3d6d9", S: "#a9aeb4" },
  },
};

// Pixel art reads as a grid.
// prettier-ignore
export const CASE_GLASSES: Record<string, Art> = {
  // LED mask: a black visor with a little pixel grin scrolling across a glowing screen.
  "glasses.300": {
    down: ["..oooooooooooo..", "..okpkkkkkkpko..", "..okcpcpcpcpko.."],
    side: ["........ooooo...", "...kkkkkokpkko..", "........okcpco.."],
    pal: { o, k: "#1b1826", p: "#ff4fd8", c: "#4ff3ff" },
  },
  // Steam goggles: two round brass rims with amber lenses, riveted, on a leather strap.
  "glasses.301": {
    down: ["...yyyy..yyyy...", "...yaAyyyyaAy...", "...yyyy..yyyy..."],
    side: ["........yyyy....", "...bbbbbbyaAy...", "........yyyy...."],
    pal: { y: "#c98a3a", a: "#ffd36b", A: "#f0a030", b: "#5a3b22" },
  },
  // Holo shades: sharp wedge lenses that shift from cyan to magenta, with a white glint.
  "glasses.302": {
    down: ["..oooooooooooo..", "..owcmmoowcmmo..", "...occmo..occmo."],
    side: ["........ooooo...", "......oowcmmo...", ".......occmo...."],
    pal: { o, w: "#ffffff", c: "#58f0ff", m: "#c45cff" },
  },
  // Kawung specs: two round rims in dark brown, the cream four-petal circle pattern on each rim.
  "glasses.400": {
    down: ["....bwb..bwb....", "...bw.wbbw.wb...", "....bwb..bwb...."],
    side: [".........bwb....", "...bbbbbbw.wb...", ".........bwb...."],
    pal: { b: "#5a3a1c", w: "#f1e3c2" },
  },
  // Coconut shades: half a coconut each, hairy brown shells, a dark slit for a lens, a cream rim of flesh.
  "glasses.401": {
    down: ["...hHhhh.hhhHh..", "...hkkkh.hkkkh..", "...wwwww.wwwww.."],
    side: ["........hHhhh...", "...hhhhhhkkkh...", "........wwwww..."],
    pal: { h: "#7a4f2c", H: "#4d2f18", k: "#1c1612", w: "#f1e3c2" },
  },
  // Wayang eyes: almond eyes cut from leather, gold outlined, slanted, the pupil always turned to the side.
  "glasses.402": {
    down: ["...ggg....ggg...", "...gkkwggkkwg...", ".....gg..gg....."],
    side: ["..........ggg...", "...ggggggkkwg...", "........gg......"],
    pal: { g: "#f2b632", k: "#1c1612", w: "#f1e3c2" },
  },
};

// Ragnarok Eve (`case-ragnarok.ts`) is filed beside the Night Market's; item ids never overlap.
Object.assign(CASE_HATS, RAGNAROK_HATS);
Object.assign(CASE_GLASSES, RAGNAROK_GLASSES);
// The pond treasures (`fishing-loot.ts`, ids from `FISHING_BASE`) too.
Object.assign(CASE_HATS, FISHING_HATS);
