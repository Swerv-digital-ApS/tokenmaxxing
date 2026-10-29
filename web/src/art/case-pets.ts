import { C } from "./palette.ts";
import type { Pet } from "./pet-base.ts";

/**
 * The cases' pets, 12×10 facing right with two hop frames, like the shop's. `pet-base.ts` files the Night
 * Market's (core/src/case.ts) at `CASE_BASE + n` in `PETS` and the Nusantara's (core/src/case-nusantara.ts) at
 * `NUSANTARA_BASE + n`.
 */

// Pixel art reads as a grid.
// prettier-ignore
export const CASE_PETS: Pet[] = [
  // Koi: white, orange and black, swimming through the air.
  {
    frames: [
      ["............", "....ooo.....", "o..orrkwo...", "oro.rrwwwoo.", "orrowwwwwewo", "oro.wrrwwwo.", "o..owwkwwo..", "....oooooo..", "............", "............"],
      ["....ooo.....", "oo.orrkwo...", "orrorrwwwoo.", "orowwwwwewo.", "oo.wrrwwwo..", "...owwkwwo..", "....oooooo..", "............", "............", "............"],
    ],
    pal: { o: C.ink, w: "#fbf6ee", r: "#ff7a2a", k: "#241f2b", e: C.ink },
  },
  // Paper crane: folded white, a red beak and tail tip, wings up and down.
  {
    frames: [
      ["........oo..", ".o.....owro.", "owo...owwo..", "owwo..owo...", ".owwoowwo...", "..owwwwwoo..", "...owswwwwo.", "....owwso.r.", ".....ooo.oro", "............"],
      ["............", "........oo..", ".......owro.", "o.....owwo..", "ooo..owwo...", "owwwoowwo...", ".owswwwwwoo.", "..oowwwswwoR", "....owwwo.r.", ".....ooo...."],
    ],
    pal: { o: C.ink, w: "#fbf8f2", s: "#c9cfdc", r: "#e0405a", R: "#e0405a" },
  },
  // Tanuki pup: a round brown pup, a leaf on its head, a dark mask over its eyes.
  {
    frames: [
      ["......gg....", ".....gGgg...", "....odbbbdo.", "....obbbbbo.", "...oobddbddo", ".oobbbbcnco.", "dobbccbbbbo.", "dobbccbbbbo.", ".oobbbbbboo.", "..dd..dd...."],
      [".....gg.....", "....gGgg....", "....odbbbdo.", "....obbbbbo.", "...oobddbddo", ".oobbbbcnco.", "dobbccbbbbo.", "dobbccbbbbo.", ".oobbbbbboo.", ".dd....dd..."],
    ],
    pal: { o: C.ink, b: "#8d7a68", d: "#3b2f2a", c: "#e6d5b5", n: C.ink, g: "#5cc16a", G: "#34843f" },
  },
  // Maneki cat: white, a red collar and gold bell, one paw up and waving, a coin in the other.
  {
    frames: [
      ["ww....p..p..", "ww...owwwwo.", "owo..owewewo", "owwo..owpwo.", ".owoorrrroo.", "..owwwwygwo.", "..owwwwwgwo.", "..owwwwwwwo.", "...owwwwwo..", "...oo...oo.."],
      ["......p..p..", "ww...owwwwo.", "ww...owewewo", "owo...owpwo.", "owwoorrrroo.", "..owwwwygwo.", "..owwwwwgwo.", "..owwwwwwwo.", "...owwwwwo..", "...oo...oo.."],
    ],
    pal: { o: C.ink, w: "#fbf8f2", p: "#f2a0b0", e: C.ink, r: "#d6303a", y: "#f5c842", g: "#e8b030" },
  },
  // Kitsune: an orange fox, a fan of tails each ending in a glowing lantern.
  {
    frames: [
      ["L.L.L.L....o", "t.t.t.t..o.o", "tt.tt.tt.ooo", ".ttttttooxxo", "..tttooxxxxn", "..otooxxexo.", "..otoxxxxxo.", "..otttxxxxo.", "...o.o.o.o..", "............"],
      [".L.L.L.L...o", "t.t.t.t..o.o", ".tt.tt.t.ooo", ".ttttttooxxo", "..tttooxxxxn", "..otooxxexo.", "..otoxxxxxo.", "..otttxxxxo.", "...o.o.o.o..", "............"],
    ],
    pal: { o: C.ink, x: "#ff9a3c", t: "#f08a30", L: "#ffd766", e: C.ink, n: C.ink },
  },
  // Tengu: red face, a long nose, black wings and a little hat, hovering at the shoulder.
  {
    frames: [
      ["....kk..hh..", "...kkk.hhhh.", "..kkkkoRRRRo", ".kkkkkoReRnn", ".kkkkkoRRRRo", "..kkkkkddo..", "...kkkddddk.", "....kkddddk.", ".....kyokyo.", "............"],
      ["............", "....kk.hh...", "..kkkkhhhhRo", "...kkkoReRnn", "..kkkkoRRRRo", ".kkkkkkddo..", ".kkkkkddddk.", "..kkkkddddk.", "....kkyokyo.", "............"],
    ],
    pal: { o: C.ink, k: "#2a2b3d", h: "#1a1822", R: "#d8362f", e: C.white, n: "#a82a24", d: "#4a4a63", y: "#f5c842" },
  },
];

// Pixel art reads as a grid.
// prettier-ignore
export const NUSANTARA_PETS: Pet[] = [
  // Komodo: an olive-grey lizard, a stubby tail, a yellow forked tongue that flicks out on the second frame.
  {
    frames: [
      ["............", "............", "........ooo.", "......ooggeo", "..oooogGggoo", "oogGgGgGgbo.", ".oogGgGgbbo.", "..obooooboo.", "..oo.oo.oo..", "............"],
      ["............", "............", "........ooo.", "......ooggey", "..oooogGggyy", "oogGgGgGgboy", ".oogGgGgbbo.", "..obooooboo.", "...oo.oo.oo.", "............"],
    ],
    pal: { o: C.ink, g: "#8a9650", G: "#5e6a34", b: "#bcbc8a", e: C.ink, y: "#f2c230" },
  },
  // Tarsier: a tiny tan body, two huge round eyes, big ears and long spindly fingers.
  {
    frames: [
      ["............", ".oo......oo.", "obbo.oo.obbo", "obbooooooob.", "..owwkwwkwo.", "..owwkwwkwo.", "...obbnbbo..", "..oobbbbbbo.", ".oo.obbbbo..", "ofo.oo.oo..."],
      ["............", ".oo......oo.", "obbo.oo.obbo", "obbooooooob.", "..owwkwwkwo.", "..owwkwwkwo.", "...obbnbbo..", "..oobbbbbbo.", "..o.obbbbo..", ".fo.oo.oo.o."],
    ],
    pal: { o: C.ink, b: "#c9a572", w: "#fbf7ef", k: C.ink, n: "#a8794a", f: "#a8794a" },
  },
  // Enggang: a black hornbill with a sunset casque on a cream bill, a white tail with a black band.
  {
    frames: [
      ["........RR..", ".......oRRro", "...ooo.ooyyo", "..okkkoyyyyy", "ookkkkkoyyyo", "owkkkkkkoooo", "owwkkkkko...", "obbkkkko....", "..oo.oo.....", "............"],
      ["........RR..", ".......oRRro", "..oooooooyyo", ".okkkkkoyyyy", "ookkkkkoyyyo", "owkkkkkkoooo", "owwkkkkko...", "obbkkkko....", "..oo.oo.....", "............"],
    ],
    pal: { o: C.ink, k: "#26242c", w: "#fbf7ef", b: "#26242c", R: "#f06a2a", r: "#d6343a", y: "#f4e3b0" },
  },
  // Rafflesia: a red five-petal bloom with cream spots, a dark hungry mouth, on two tiny legs; the petals bob.
  {
    frames: [
      ["..oo.oo.oo..", ".orroorrorro", "orRrrrrrrRro", "orrcrkkrcrro", ".orrkeekrro.", ".orRrkkrRro.", "..orrrrrro..", "...oooooo...", "...oo..oo...", "..ooo..ooo.."],
      ["............", "..oo.oo.oo..", ".orroorrorro", "orRrrrrrrRro", "orrcrkkrcrro", ".orrkeekrro.", ".orRrkkrRro.", "...orrrro...", "...oo..oo...", "..ooo..ooo.."],
    ],
    pal: { o: C.ink, r: "#d6343a", R: "#f06a4a", c: "#f1e3c2", k: "#6a1a22", e: "#f2b632" },
  },
  // Cenderawasih: a small yellow-and-brown bird-of-paradise, an emerald throat, two long tail wires curling and bobbing.
  {
    frames: [
      ["ooo.........", "o..o........", "o..o....ooo.", "o.ooo.ooyyo.", "oo.obbooyyeo", "...obbbogggn", "...obbbbogg.", "....obbbbo..", ".....oo.oo..", "............"],
      ["............", "ooo.........", "o..o....ooo.", "o.ooo.ooyyo.", "oo.obbooyyeo", "...obbbogggn", "...obbbbogg.", "....obbbbo..", ".....oo.oo..", "............"],
    ],
    pal: { o: C.ink, b: "#8a5a2b", y: "#f2c230", g: "#2fbf7a", e: C.ink, n: "#d9b36a" },
  },
  // Orangutan: a round shaggy orange mass with a darker face disc and a long arm, one hand gripping the edge of your shoulder.
  {
    frames: [
      ["....oooooo..", "..ooRrRRrRo.", ".oRrRRrRRroo", "oRRrRfffRRro", "ooRRRfeffRRo", "kooRrfffnfRo", "kooRRrfffRRo", "kkoRrRrRrRo.", "..ooRRrRRoo.", "...oo..oo..."],
      ["....oooooo..", "..ooRrRRrRo.", ".oRrRRrRRroo", "oRRrRfffRRro", "kooRRfeffRRo", "kooRrfffnfRo", "kkoRRrfffRRo", ".koRrRrRrRo.", "..ooRRrRRoo.", "...oo..oo..."],
    ],
    pal: { o: C.ink, R: "#e0762a", r: "#b8571c", f: "#d9a46b", e: C.ink, n: "#a8794a", k: "#8a5a2b" },
  },
];
