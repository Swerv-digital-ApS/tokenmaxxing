import { CASE_BASE } from "@tokenmaxxing/core/case.ts";
import { NUSANTARA_BASE } from "@tokenmaxxing/core/case-nusantara.ts";
import type { Back, BackView, Held, Outfit } from "./wardrobe.ts";

/**
 * The Night Market case's and the Nusantara case's outfits, held things and back items in 2D
 * (`core/src/case.ts`, `core/src/case-nusantara.ts`). Same shapes as the shop's in `wardrobe.ts`, which merges
 * these in under their look indices (`CASE_BASE + n`, `NUSANTARA_BASE + n`): the tables are sparse, so nothing
 * the shop numbers can land on them.
 */

const at = (n: number) => CASE_BASE + n;
const nus = (n: number) => NUSANTARA_BASE + n;

// MARK: Outfits

// Marks sit over the body from row 9; a fourth row lands on the trousers' row (a hem, an apron).
// Pixel art reads as a grid.
// prettier-ignore
export const CASE_OUTFITS: Record<number, Outfit> = {
  // Noodle apron: a white bib over a charcoal tee, a red bowl on the chest and a bow at the back.
  [at(0)]: {
    c: "#3a3f4b", C: "#2a2e38", p: "#2f3444",
    marks: {
      down: ["......a..a......", ".....aayyaa.....", ".....aarraa.....", ".....aaAaaa....."],
      side: ["................", ".......aa.......", ".......aaa......", ".......aaa......"],
      up: ["................", "................", "......aaaa......", ".......aa......."],
    },
    pal: { a: "#f4efe4", A: "#d9d2c0", y: "#f2c94c", r: "#d83a2e" },
  },
  // Happi coat: indigo, white lapels down the front, a rope belt and a ring crest on the back.
  [at(1)]: {
    c: "#2f4a8a", C: "#1f3366", p: "#2a2f45",
    marks: {
      down: ["......w..w......", "......w..w......", "......w..w......", ".....rrrrrr....."],
      side: ["................", ".......w........", ".......w........", ".....rrrrr......"],
      up: ["......wwww......", ".....wwrrww.....", "......wwww......", ".....rrrrrr....."],
    },
    pal: { w: "#f4efe4", r: "#d83a2e" },
  },
  // Cargo bomber: olive, an orange lining at the collar, a zip, flap pockets and a ribbed hem.
  [at(2)]: {
    c: "#6b7a3f", C: "#4d5a2a", p: "#4a4a3a",
    marks: {
      down: [".....O.zz.O.....", "....kk.zz..kk...", ".....hhhhhh.....", "................"],
      side: [".......O........", ".......z.kk.....", "......hhhh......", "................"],
      up: [".....OOOOOO.....", "................", ".....hhhhhh.....", "................"],
    },
    pal: { O: "#f08a3c", z: "#c9c2a6", k: "#3f4a24", h: "#39421f" },
  },
  // Techwear coat: long, black, a neon cyan zip, magenta buckles, a reflective stripe up the back.
  [at(3)]: {
    c: "#23252f", C: "#15161c", p: "#15161c",
    marks: {
      down: ["......n..n......", ".....gmnn.mg....", "......n..n......", ".....cncncc....."],
      side: ["................", ".......n........", ".......g........", "......ccc......."],
      up: ["......nnnn......", "................", "......nnnn......", ".....cccccc....."],
    },
    pal: { n: "#3ff0ff", m: "#ff3fb0", g: "#4a4d5c", c: "#23252f" },
  },
  // Dragon satin jacket: teal-black satin, gold cuffs and collar, a dragon coiled up the back.
  [at(4)]: {
    c: "#18353f", C: "#0f232b", p: "#222a35",
    marks: {
      down: ["....gggggggg....", ".....rg..g......", ".......g........", ".....gggggg....."],
      side: ["................", ".......g........", ".......gG.......", "......gggg......"],
      up: ["....g.gg..g.....", ".....ggGgg......", "......gGgrg.....", ".....gggggg....."],
    },
    pal: { g: "#f2c230", G: "#b8860b", r: "#d83a2e" },
  },
  // Festival parade: red happi, gold sash, a lantern hanging from each shoulder.
  [at(5)]: {
    c: "#d6343a", C: "#9a2128", p: "#f2eadb",
    marks: {
      down: [
        "..k..wwwwww..k..",
        ".lLl.gg..gg.lLl.",
        ".lyl.gggggg.lyl.",
        ".lLl........lLl.",
        "..y..........y..",
      ],
      side: ["..k...ww........", ".lLl..gg........", ".lyl..gg........", ".lLl............", "..y............."],
      up: [
        "..k..wwwwww..k..",
        ".lLl.grrrrg.lLl.",
        ".lyl..gyyg..lyl.",
        ".lLl........lLl.",
        "..y..........y..",
      ],
    },
    pal: { w: "#fbf7ef", g: "#f2c230", y: "#ffe27a", l: "#ff6a3c", L: "#c4261f", k: "#2b2433", r: "#d6343a" },
  },
  // Batik shirt: soga brown with cream diamonds, a slim tan placket down the front, short sleeves.
  [nus(0)]: {
    c: "#6b4226", C: "#4a2c18", p: "#2f3444",
    marks: {
      down: [".....w.aa.w.....", "....w.waaw.w....", ".....w.aa.w.....", "................"],
      side: ["......w.wa......", ".....w.w.aw.....", "......w.wa......", "................"],
      up: [".....w.w.w......", "....w.w.w.w.....", ".....w.w.w......", "................"],
    },
    pal: { w: "#f1e3c2", a: "#a8743a" },
  },
  // Deckhand stripes: navy and cream stripes, rolled cuffs and a rope belt.
  [nus(1)]: {
    c: "#2c3f78", C: "#1e2d5a", p: "#8a6a3a",
    marks: {
      down: ["................", "....wwwwwwww....", "................", ".....tTtTtT....."],
      side: ["................", ".....wwwwww.....", "................", ".....tTtTt......"],
      up: ["................", "....wwwwwwww....", "................", ".....tTtTtT....."],
    },
    pal: { w: "#f1e3c2", t: "#d9b36a", T: "#a07f46" },
  },
  // Kebaya: teal lace, a gold brooch at the collar and a cream hem over a batik wrap.
  [nus(2)]: {
    c: "#1f9aa0", C: "#14727a", p: "#6b4226",
    marks: {
      down: [".....l.gG.l.....", "....l.l..l.l....", "......l..l......", ".....wwwwww....."],
      side: ["......l.g.......", ".....l.l..l.....", "......l..l......", ".....wwwwww....."],
      up: [".....l.l.l......", "....l.l.l.l.l...", "......l.l.......", ".....wwwwww....."],
    },
    pal: { l: "#d8f3ee", g: "#f2b632", G: "#b8860b", w: "#f1e3c2" },
  },
  // Silat pangsi: loose black, a red sash across the belly knotted at the hip.
  [nus(3)]: {
    c: "#26262f", C: "#16161d", p: "#26262f",
    marks: {
      down: ["................", "................", ".....rrrrrr.....", ".....rR.........", ".....r.........."],
      side: ["................", "................", ".....rrrrrr.....", ".....rR.........", ".....r.........."],
      up: ["................", "................", ".....rrrrrr.....", "......rR........", "......r........."],
    },
    pal: { r: "#d6343a", R: "#9a2128" },
  },
  // Songket gala: crimson silk shot through with gold thread in a diagonal lattice, a bright gold hem.
  [nus(4)]: {
    c: "#a8202f", C: "#7a1420", p: "#8a1a28",
    marks: {
      down: [".....g.g.g......", "....g.g.g.g.....", "......g.g.g.....", ".....GGGGGG....."],
      side: ["......g.g.......", ".....g.g.g......", "......g.g.g.....", ".....GGGGG......"],
      up: [".....g.g.g......", "....g.g.g.g.....", ".....g.g.g......", ".....GGGGGG....."],
    },
    pal: { g: "#e9b73d", G: "#ffd36a" },
  },
  // Ondel-ondel: a big friendly red face with white eyes and a grin on the chest, a coconut-leaf ruff and skirt,
  // a bright turquoise tunic.
  [nus(5)]: {
    c: "#1fb5b0", C: "#0f6e86", p: "#f2b632",
    marks: {
      down: [
        ".....lLlLlL.....",
        ".....RwRRwR.....",
        ".....RkwwkR.....",
        "....lLlLlLlL....",
        ".....lL..lL.....",
      ],
      side: [
        "......lLlL......",
        "......RwwR......",
        "......RkwR......",
        ".....lLlLlL.....",
        "......lL........",
      ],
      up: [
        ".....lLlLlL.....",
        "....y.y.y.y.....",
        ".....y.y.y......",
        "....lLlLlLlL....",
        ".....lL..lL.....",
      ],
    },
    pal: { l: "#c8d84a", L: "#7fa332", R: "#d6343a", w: "#fbf7ef", k: "#2b2433", y: "#f2b632" },
  },
};

// MARK: In the hand

// `h` is the hand: the item is placed so that it lands on the character's hand (and, past it, within 16 columns).
// Pixel art reads as a grid.
// prettier-ignore
export const CASE_HELD: Record<number, Held> = {
  // Ramen bowl: steam, noodles and an egg over a red-rimmed bowl.
  [at(0)]: {
    rows: ["..s.s..", "..yeey.", ".hrrrrr", "..wbbbw", "...www."],
    pal: { s: "#d8dde3", y: "#f2c94c", e: "#f4efe4", r: "#d83a2e", w: "#f4efe4", b: "#3a6fb8" },
  },
  // Paper umbrella: an open oil-paper wagasa, red with cream stripes narrowing to the tip, a scalloped rim, a long bamboo pole.
  [at(1)]: {
    rows: ["...g...", ".oRwRo.", "owRwRwo", "RwRwRwR", "R.Rb.R.", "...b...", "...h...", "...b...", "..bb..."],
    pal: { R: "#d83a2e", o: "#8f1f18", w: "#f4efe4", b: "#a8743a", g: "#f2c230" },
  },
  // Boombox: a handle to carry it by, two speakers and a neon display.
  [at(2)]: {
    rows: [".mmmhmmm.", "kkkkkkkkk", "gGgkpkgGg", "gGgkrkgGg", "kkkkkkkkk"],
    pal: { m: "#aab3bf", k: "#2b2433", g: "#6a6f7c", G: "#14121a", p: "#ff4fa3", r: "#3ff0ff" },
  },
  // Skateboard: stood on its tail, deck to the front, trucks and wheels at each end.
  [at(3)]: {
    rows: ["y.y", "ddd", "dnd", "hnd", "dnd", "ddd", "y.y"],
    pal: { d: "#ff4fa3", n: "#3ff0ff", y: "#f2c94c" },
  },
  // Es teh: sweet iced tea in a knotted bag, ice cubes and a red-and-white straw.
  [nus(0)]: {
    rows: ["....rw.", "...rw..", "..nnn..", ".aAaAa.", ".aiAia.", ".aAhAa.", ".aiAiaa", "..aAAa.", "...AA.."],
    pal: { a: "#e8a33c", A: "#b87420", i: "#fbf7ef", r: "#d6343a", w: "#fbf7ef", n: "#e8d9b0" },
  },
  // Angklung: a bamboo frame with three tubes of graduated length.
  [nus(1)]: {
    rows: ["BBBBBBBB", "BYyYyYyB", "BYyYyYyB", "BYyYyYyB", "BYyYnnnB", "BYy....B", "Bnn....B", "BBBhBBBB"],
    pal: { B: "#8a5a2b", Y: "#e8c76a", y: "#c9a64a", n: "#6b4a1c" },
  },
  // Layang-layang: a red and yellow diamond kite on a cream cross-spar, a stepped tail, its string down to the hand.
  [nus(2)]: {
    rows: ["...l...", "..RlY..", ".RRlYY.", "lllllll", ".RRlYY.", "..RlY..", "...l...", "...lr..", "...l.y.", "...lr..", "...l...", "...h..."],
    pal: { R: "#d6343a", Y: "#f2b632", l: "#f1e3c2", r: "#d6343a", y: "#f2b632" },
  },
  // Takraw ball: a woven rattan sphere, the hex weave in two tans.
  [nus(3)]: {
    rows: ["..ooo..", ".otdto.", "otdtdto", "odtdtdo", "otdtdto", ".otdto.", "..oho.."],
    pal: { o: "#5a3a1c", t: "#d9b36a", d: "#a8793a" },
  },
};

// MARK: On the back

/** `rows` moved down `dy` rows (or up, if negative), keeping the frame 16 tall. */
const down = (rows: string[], dy: number): string[] => {
  const out = dy >= 0 ? [...Array<string>(dy).fill(""), ...rows] : rows.slice(-dy);
  return out.slice(0, 16);
};

// Rows are full 16×16 frames, top row first; `.` is nothing.
/** A small picture dropped into an empty 16×16 frame at column `x`, row `y`. */
const frame = (art: string[], x: number, y: number): string[] => {
  const out = Array<string>(16).fill("");
  art.forEach((r, i) => {
    out[y + i] = ".".repeat(x) + r;
  });
  return out;
};
// A chunky quad-drone: four lit rotors round a dark body with a pink eye, a pink and cyan underlight. Five wide.
const DRONE_ART = ["cc.cc", "ckkkc", "kkLkk", "ckkkc", "cc.cc", ".pnp."];
const DRONE_ART_B = ["Cc.cC", "CkkkC", "kkLkk", "CkkkC", "Cc.cC", ".npn."];
const DRONE = frame(DRONE_ART, 11, 3);
const DRONE_SIDE = frame(DRONE_ART, 0, 3);
const DRONE_B = frame(DRONE_ART_B, 11, 4);
const DRONE_SIDE_B = frame(DRONE_ART_B, 0, 4);
const LANTERN_BACK: string[] = [
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  ".......kk.......",
  "....kkkkkkkk....",
  "....oLllllLo....",
  "....oLlyylLo....",
  "....oLlyylLo....",
  "....oLllllLo....",
  "....kkkkkkkk....",
  ".......yy.......",
];
const LANTERN_SIDE: string[] = [
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "..kk............",
  ".kkkkk..........",
  ".oLlLo..........",
  ".oLyLo..........",
  ".oLyLo..........",
  ".oLlLo..........",
  ".kkkkk..........",
  "..yy............",
];
// A storm cloud over the head (rows 0-2, in front), and neon streaks falling down both sides of it that dim out
// before the shoulders (behind). `shift` slides the streaks down a row for the second frame.
const CLOUD = [".....wwwwww.....", "..vvvvvvvvvvvv..", ".VVpVVVVVVVVpVV."];
const rainBehind = (shift: number): string[] => {
  const rows = Array.from({ length: 16 }, () => Array<string>(16).fill("."));
  for (const x of [1, 14]) for (const y of [2, 3]) rows[y]![x] = y === 2 ? "v" : "V";
  const cols: [number, string, string][] = [
    [1, "n", "N"],
    [2, "p", "P"],
    [13, "n", "N"],
    [14, "p", "P"],
  ];
  cols.forEach(([x, bright, dim], i) => {
    for (let y = 4; y <= 10; y++) {
      if ((y + shift + i * 2) % 3 === 2) continue;
      rows[y]![x] = y <= 7 ? bright : y <= 9 ? dim : ".";
    }
  });
  return rows.map((r) => r.join(""));
};
const rain = (shift: number): BackView => ({
  behind: rainBehind(shift),
  front: [...CLOUD, ...Array<string>(13).fill("")],
});
const view = (front: string[]): BackView => ({ front });

// A fan of peacock eye-feathers for the Dadak merak, drawn from the maths: `n` feathers over a half circle around
// (`cx`, `cy`), `xs` squashing it sideways for the side view, each with a gold eye at its own radius, a red cloth
// rosette at the hub and a dark blue tip. `sway` turns it a little (the walking frame).
const fan = (cx: number, cy: number, R: number, xs: number, eyes: number[], sway: number): string[] => {
  const n = eyes.length;
  const step = Math.PI / n;
  return Array.from({ length: 16 }, (_, y) => {
    let row = "";
    for (let x = 0; x < 16; x++) {
      const dx = (x - cx) / xs;
      const dy = cy - y;
      const r = Math.hypot(dx, dy);
      if (r > R || dy < -0.5) {
        row += ".";
        continue;
      }
      if (r < R * 0.3) {
        row += r < R * 0.15 ? "g" : "r";
        continue;
      }
      const ang = Math.min(Math.PI - 1e-6, Math.max(0, Math.atan2(dy, dx) + sway));
      const k = Math.floor(ang / step);
      const mid = (k + 0.5) * step - sway;
      const ex = cx + Math.cos(mid) * eyes[k]! * xs;
      const ey = cy - Math.sin(mid) * eyes[k]!;
      const d = Math.hypot((x - ex) / xs, y - ey);
      const edge = Math.abs(ang / step - k - 0.5) > 0.46;
      row += d < 0.9 ? "g" : d < 1.9 ? "e" : r > R - 1 ? "B" : edge ? "B" : k % 2 ? "G" : "T";
    }
    return row;
  });
};
const FAN_DOWN = (sway: number) => fan(7.5, 13, 12.5, 1, [7.5, 9.5, 11, 11, 9.5, 7.5], sway);
const FAN_SIDE = (sway: number) => fan(3, 12, 11.5, 0.45, [8, 9.5, 9.5, 8], sway);
const FAN_UP = (sway: number) => fan(7.5, 14, 14, 1, [8, 10, 12, 12, 10, 8], sway);

// A rattan bakul seen from behind: fruit heaped over a woven rim, the cone tapering to the hips.
// prettier-ignore
const BAKUL_UP: string[] = [
  "", "", "", "", "", "",
  "......uU........",
  "....mMmuUuUs....",
  "...mMmsuuUuUmM..",
  "..RrwrRrwrRrwR..",
  "..RwRrRwRrRwRr..",
  "...RrwRrwRrwR...",
  "...RwRrRwRrRw...",
  "....RrwRrwRr....",
];
// prettier-ignore
const BAKUL_SIDE: string[] = [
  "", "", "", "",
  "...uU...........",
  ".mmuUs..........",
  "mMmsuuUl........",
  "RrwrRrwR........",
  "RwRrRwR.........",
  ".RrwRr..........",
  ".RwRrR..........",
  "..RrwR..........",
  "..RRR...........",
];
// prettier-ignore
const BAKUL_DOWN: string[] = [
  "", "", "", "", "", "", "",
  "..mm........uU..",
  ".mMms......uuUl.",
  "RrwrRrwrRrwrRrwR",
  ".RwRrRwRrRwRrRw.",
  "..RrwRrwRrwRrw..",
];
// The sling: two straps over the chest.
// prettier-ignore
const BAKUL_STRAPS: string[] = ["", "", "", "", "", "", "", "", "", ".....s....s.....", "......s..s......", ".......ss......."];

// A wayang bundle: a gunungan and a long-nosed clown puppet on sticks, packed in a bamboo case.
// prettier-ignore
const WAYANG_UP: string[] = [
  "", "", "",
  "..g.........k...",
  ".gdg.......kd...",
  ".dGd......dddd..",
  "dgGgd.....dgdd..",
  "dgdgd.....ddgd..",
  "ddddd.....dddk..",
  "..BbBbBbBbBbBb..",
  "..bkbbbkbbbkbb..",
  "..BbBbBbBbBbBb..",
  "..bkbbbkbbbkbb..",
  "..BbBbBbBbBbBb..",
];
// prettier-ignore
const WAYANG_SIDE: string[] = [
  "", "", "", "",
  "..g.k...........",
  ".gdg.d..........",
  ".dGd.dd.........",
  "dgGgddk.........",
  "BbBbBbB.........",
  "bkbbbkb.........",
  "BbBbBbB.........",
  "bkbbbkb.........",
  "BbBbBbB.........",
];

// Pixel art reads as a grid.
// prettier-ignore
export const CASE_BACKS: Record<number, Back> = {
  // Neon drone: hovers over the shoulder, rotors blurring, bobbing a row when they walk.
  [at(0)]: {
    views: { down: view(DRONE), side: view(DRONE_SIDE), up: view(DRONE) },
    walk: { down: view(DRONE_B), side: view(DRONE_SIDE_B), up: view(DRONE_B) },
    pal: { c: "#9fe9ff", C: "#4fb8d8", k: "#2b2f3a", L: "#ff3fb0", p: "#ff3fb0", n: "#3ff0ff" },
  },
  // Paper lantern pack: a glowing lantern on the back, its pole tips showing at the neck.
  [at(1)]: {
    views: {
      down: view(["", "", "", "", "", "", "", "", "....k......k....", ".....s....s....."]),
      side: { behind: LANTERN_SIDE },
      up: view(LANTERN_BACK),
    },
    walk: { side: { behind: LANTERN_SIDE.map((r) => (r ? "." + r.slice(0, 15) : r)) }, up: view(down(LANTERN_BACK, -1)) },
    pal: { k: "#2b2433", o: "#8a2a1c", L: "#c4261f", l: "#ff6a3c", y: "#ffd35c", s: "#a8743a" },
  },
  // Neon rain: a violet storm cloud over the head, neon pink and cyan streaks falling beside it and dimming out.
  [at(2)]: {
    views: { down: rain(0), side: rain(0), up: rain(0) },
    walk: { down: rain(1), side: rain(1), up: rain(1) },
    pal: { w: "#b9a8ff", v: "#7d6bc4", V: "#5a4b86", n: "#3ff0ff", N: "#1f8fa0", p: "#ff4fa3", P: "#a03a78" },
  },
  // Fruit bakul: a rattan basket of rambutan, mangosteen and salak, slung on two straps; it bobs when they walk.
  [nus(0)]: {
    views: {
      down: { behind: BAKUL_DOWN, front: BAKUL_STRAPS },
      side: { behind: BAKUL_SIDE },
      up: view(BAKUL_UP),
    },
    walk: {
      down: { behind: down(BAKUL_DOWN, -1), front: BAKUL_STRAPS },
      side: { behind: down(BAKUL_SIDE, -1) },
      up: view(down(BAKUL_UP, -1)),
    },
    pal: {
      R: "#8a5a2b", r: "#c9944a", w: "#e2b86a", m: "#7a2d7e", M: "#4c1a52", u: "#d6343a", U: "#ff7a6a",
      s: "#6b4226", l: "#2f7f3a",
    },
  },
  // Wayang bundle: the tips of a gunungan and a clown puppet showing over the shoulders of a bamboo case.
  [nus(1)]: {
    views: {
      down: { behind: WAYANG_UP },
      side: { behind: WAYANG_SIDE },
      up: view(WAYANG_UP),
    },
    walk: {
      down: { behind: down(WAYANG_UP, -1) },
      side: { behind: down(WAYANG_SIDE, -1) },
      up: view(down(WAYANG_UP, -1)),
    },
    pal: { d: "#3a2416", g: "#f2b632", G: "#ffd36a", k: "#8a5a2b", b: "#d9b36a", B: "#a8793a" },
  },
  // Dadak merak: a fan of peacock eye-feathers (cloth and feather) with gold eyes and a red rosette, swaying as they walk.
  [nus(2)]: {
    views: {
      down: { behind: FAN_DOWN(0) },
      side: { behind: FAN_SIDE(0) },
      up: view(FAN_UP(0)),
    },
    walk: {
      down: { behind: FAN_DOWN(0.12) },
      side: { behind: FAN_SIDE(0.12) },
      up: view(FAN_UP(0.12)),
    },
    pal: { T: "#1fb5b0", G: "#2f7f3a", B: "#0f4a6e", e: "#243a73", g: "#f2b632", r: "#d6343a" },
  },
};
