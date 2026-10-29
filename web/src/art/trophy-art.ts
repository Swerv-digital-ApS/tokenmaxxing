import { C } from "./palette.ts";
import type { Palette } from "./pixels.ts";

/**
 * Every trophy's grid and colours, 7×8: the 2D shelf (`art/trophies.ts`) and the 3D one (`dungeon3d.ts`)
 * both draw from here. Everything stands on the shelf's bottom row. Pixel art reads as a grid.
 */
// biome-ignore-all format: pixel art reads as a grid
const GOLD = { a: C.flowerYellow, b: "#c98e22", w: "#fff4b8" };
const SILVER = { a: "#d5dbe4", b: C.metalLight, w: C.white };
const PLINTH = { k: C.wallTop, K: C.wallTopLight };

export const TROPHY_ART: Record<string, { rows: string[]; pal: Palette }> = {
  million: {
    rows: ["aaaaaaa", "a.waa.b", ".awaab.", "..aab..", "...b...", "..aab..", ".KKKKK.", ".kkkkk."],
    pal: { ...SILVER, ...PLINTH },
  },
  billion: {
    rows: ["a..a..a", "aa.a.aa", "awaaaab", "arabgab", "bbbbbbb", ".......", ".KKKKK.", ".kkkkk."],
    pal: { ...GOLD, r: C.flowerRed, g: "#3ddc84", ...PLINTH },
  },
  streak: {
    rows: ["...a...", "..aa...", "..aab..", ".aabba.", ".abccb.", ".abccb.", "..bbb..", ".kkkkk."],
    pal: { a: C.flowerRed, b: "#f28a3c", c: C.flowerYellow, k: C.wallTop },
  },
  "3am": {
    rows: ["..aaa..", ".aa..w.", "aa.....", "aa..w..", ".aa....", "..aaa..", ".KKKKK.", ".kkkkk."],
    pal: { a: C.lamp, w: C.white, K: "#52609b", k: "#2f3a6b" },
  },
  friday: {
    rows: ["....r..", "...wy..", "..ss...", ".sssss.", "ssswsss", "sswssss", ".sssss.", "..sss.."],
    pal: { s: "#3c4454", w: C.metalLight, r: C.flowerRed, y: C.flowerYellow },
  },
  newyear: {
    rows: ["a..w..c", ".a.w.c.", "..www..", "www.www", "..www..", ".c.w.a.", "c..w..a", "......."],
    pal: { a: C.flowerYellow, c: "#f28bb2", w: C.white },
  },
  holiday: {
    rows: ["...y...", "...g...", "..ggg..", "..grg..", ".gyggg.", "ggggrgg", "...t...", ".KKKKK."],
    pal: { y: C.flowerYellow, g: C.leaf, r: C.flowerRed, t: C.trunk, K: C.rug },
  },
  zeros: {
    rows: [".......", "aaa.aaa", "a.a.a.a", "a.a.a.a", "a.a.a.a", "aaa.aaa", ".KKKKK.", ".kkkkk."],
    pal: { a: "#3ddc84", K: "#1f2a24", k: "#11181a" },
  },
  deadbeef: {
    rows: ["a.....a", "aa...aa", ".bbbbb.", ".bkbkb.", ".bbbbb.", "..bkb..", ".KKKKK.", ".kkkkk."],
    pal: { a: C.pathDark, b: C.pillow, ...PLINTH, k: C.ink },
  },
  c0ffee: {
    rows: [".w.w...", "..w.w..", "aaaaa..", "abbbaaa", "abbba.a", "abbbaaa", ".aaa...", "kkkkkk."],
    pal: { a: C.white, b: C.trunkDark, w: C.stoneLight, k: C.woodDark },
  },
  earlybird: {
    rows: [".......", "..aa...", ".aaka..", ".aaaao.", "baaaa..", ".aaaa..", "..o.o..", ".kkkkk."],
    pal: { a: C.flowerYellow, b: "#c98e22", k: C.leafDark, o: "#f28a3c" },
  },
  midnight: {
    rows: ["...y...", "...o...", "..www..", "..wwv..", "..wwv..", "..wwv..", ".KKKKK.", ".kkkkk."],
    pal: { y: C.lamp, o: "#f28a3c", w: C.pillow, v: C.wallDark, ...PLINTH },
  },
  allday: {
    rows: [".aaaaa.", "awwkwwa", "awwkwwa", "awwkkwa", "awwwwwa", ".aaaaa.", "..KKK..", ".kkkkk."],
    pal: { a: C.fabric, w: C.white, k: C.ink, K: C.fabricDark },
  },
  weekend: {
    rows: ["..rrr..", ".rwrwr.", "rwrwrwr", "...t...", "...t...", "...t...", "sssssss", ".SSSSS."],
    pal: { r: C.flowerRed, w: C.white, t: C.metal, s: C.path, S: C.pathDark },
  },
  palindate: {
    rows: [".k...k.", "rrrrrrr", "wwwwwww", "wkw.wkw", "ww.k.ww", "wkw.wkw", "wwwwwww", ".kkkkk."],
    pal: { r: C.rug, w: C.white, k: C.ink },
  },
  palintotal: {
    rows: ["aaaaaaa", ".bsssb.", "..bsb..", "...s...", "..b.b..", ".bsssb.", "aaaaaaa", ".kkkkk."],
    pal: { a: "#9b6fd6", b: C.stoneLight, s: C.path, k: "#5b3fbf" },
  },
  round: {
    rows: [".......", ".aaaaa.", "awayaca", "ay...aa", "aacawya", ".bbbbb.", "..KKK..", ".kkkkk."],
    pal: { a: "#f28bb2", b: C.woodLight, w: C.white, y: C.flowerYellow, c: C.water, ...PLINTH },
  },
  jackpot: {
    rows: ["rrrrrr.", "....rr.", "...rr..", "...rr..", "..rr...", "..rr...", ".KKKKK.", ".kkkkk."],
    pal: { r: C.flowerRed, ...GOLD, K: GOLD.a, k: GOLD.b },
  },
  leet: {
    rows: ["kkkkkkk", "k.....k", "kg....k", "k.g...k", "kg.gg.k", "kkkkkkk", "..kkk..", ".kkkkk."],
    pal: { k: "#2c3142", g: "#3ddc84", ".": "#1b1f2b" },
  },
  piday: {
    rows: [".......", "...w...", ".aaaaa.", "abababa", "rrrrrrr", ".bbbbb.", "..KKK..", ".kkkkk."],
    pal: { a: C.pathLight, b: C.woodLight, r: C.rug, w: C.white, ...PLINTH },
  },
  switch: {
    rows: ["..a.a..", "..a.a..", ".bbbbb.", ".bbwbb.", "..bbb..", "...c...", ".KKKKK.", ".kkkkk."],
    pal: { a: C.metalLight, b: "#4fa8ff", w: C.white, c: C.ink, ...PLINTH },
  },
  perfectweek: {
    rows: ["r.....r", "rrrrrrr", "wgwgwgw", "wwwwwww", "wgwgwgw", "wwwwwww", ".KKKKK.", ".kkkkk."],
    pal: { r: C.flowerRed, w: C.white, g: "#3ddc84", ...PLINTH },
  },
  storm: {
    rows: [".www...", "wwwwww.", "vwwwwwv", ".vvvv..", "..yy...", ".yy....", "..yy...", "...y..."],
    pal: { w: C.stoneLight, v: C.stone, y: C.flowerYellow },
  },
  // The crazy ones.
  streak30: {
    rows: ["rrrrrrr", "wwwwwww", "wwwwwgw", "wgwwgww", "wwgggww", "wwwgwww", ".KKKKK.", ".kkkkk."],
    pal: { r: C.flowerRed, w: C.white, g: "#3ddc84", ...PLINTH },
  },
  streak100: {
    rows: ["..rrr..", ".rrrrr.", "aaaaaaa", "abaaaba", "aaaaaaa", "aa...aa", ".KKKKK.", ".kkkkk."],
    pal: { ...GOLD, r: C.flowerRed, ...PLINTH },
  },
  streak365: {
    rows: ["g..g..r", "gg.g.r.", "ggggr.g", "gggrggg", "ggrgggg", "grggggg", ".KKKKK.", ".kkkkk."],
    pal: { g: C.leaf, r: C.flowerRed, ...PLINTH },
  },
  hundredb: {
    rows: ["b.....b", ".b.a.b.", "..aaa..", "baraarb", "..aaa..", ".b.a.b.", ".KKKKK.", ".kkkkk."],
    pal: { a: "#3ddc84", b: "#1b3a24", r: C.flowerRed, ...PLINTH },
  },
  tsunami: {
    rows: ["...ww..", "..wbbw.", ".wbbbbw", "wbbbbbb", "bbbbbbb", "bwbwbwb", ".KKKKK.", ".kkkkk."],
    pal: { w: C.white, b: "#3b82f6", ...PLINTH },
  },
  firehose: {
    rows: ["...w.w.", "..w.w..", ".w.w.w.", "rrrw.w.", "ryr....", "rrr....", ".KKKKK.", ".kkkkk."],
    pal: { r: C.flowerRed, y: C.flowerYellow, w: "#7ec8ff", ...PLINTH },
  },
  hurricane: {
    rows: ["..wwww.", ".w...ww", "w.ww..w", "w.w.w.w", "w.wwww.", ".w.y...", ".KKKKK.", ".kkkkk."],
    pal: { w: "#d5dbe4", y: C.flowerYellow, ...PLINTH },
  },
  setforget: {
    rows: ["..aaa..", ".aaaaa.", ".aaaaa.", "..aaa..", "...w...", "..www..", ".KKKKK.", ".kkkkk."],
    pal: { a: "#c9772e", w: C.white, ...PLINTH },
  },
  insomniac: {
    rows: ["r.....r", ".wwwww.", "wwbbbww", "wbnnnbw", "wwbbbww", ".wwwww.", ".KKKKK.", ".kkkkk."],
    pal: { r: C.flowerRed, w: C.white, b: "#3b82f6", n: C.ink, ...PLINTH },
  },
  nice: {
    rows: ["aaa.aaa", "a...a.a", "aaa.aaa", "a.a...a", "aaa.aaa", ".......", ".KKKKK.", ".kkkkk."],
    pal: { a: C.flowerYellow, ...PLINTH },
  },
  blaze: {
    rows: [".kkkkk.", "kwwwwwk", "kwwwwwk", "kwwkkwk", "kwwwkwk", "kwwwwwk", ".kkkkk.", ".k...k."],
    pal: { k: C.ink, w: "#e6e9ef" },
  },
  beast: {
    rows: ["r.....r", "rr...rr", ".rrrrr.", ".ryryr.", ".rrrrr.", "..rrr..", ".KKKKK.", ".kkkkk."],
    pal: { r: "#c0392b", y: C.flowerYellow, ...PLINTH },
  },
  repdigit: {
    rows: ["kkkkkkk", "kwwwwwk", "kwkkkwk", "kwwwkwk", "kwwkwwk", "kwwkwwk", "kkkkkkk", ".kkkkk."],
    pal: { k: C.ink, w: "#e6e9ef" },
  },
  countdown: {
    rows: ["...r...", "..www..", "..wbw..", "..www..", ".rwwwr.", "..yyy..", ".KKKKK.", ".kkkkk."],
    pal: { r: C.flowerRed, w: "#e6e9ef", b: "#3b82f6", y: C.flowerYellow, ...PLINTH },
  },
  exactmillion: {
    rows: [".rrrrr.", "rwwwwwr", "rwrrrwr", "rwrkrwr", "rwrrrwr", "rwwwwwr", ".rrrrr.", ".kkkkk."],
    pal: { r: C.flowerRed, w: C.white, k: C.ink },
  },
  leapday: {
    rows: [".gg.gg.", "gnwgwng", "ggggggg", "gRRRRRg", ".ggggg.", "gg...gg", ".KKKKK.", ".kkkkk."],
    pal: { g: "#3ddc84", w: C.white, n: C.ink, R: C.flowerRed, ...PLINTH },
  },
  friday13: {
    rows: ["wwwwwww", "wnwwwnw", "wwwrwww", "wwwwwww", "wnwnwnw", ".wwwww.", "..www..", ".KKKKK."],
    pal: { w: "#e6e9ef", n: C.ink, r: C.flowerRed, ...PLINTH },
  },
  halloween: {
    rows: ["...g...", ".ooooo.", "ooooooo", "onooono", "ooooooo", "ononono", ".ooooo.", ".kkkkk."],
    pal: { o: "#f28a1c", g: C.leaf, n: C.ink, k: C.ink },
  },
  spree: {
    rows: ["..nnn..", ".n...n.", "ppppppp", "pppwppp", "ppwwwpp", "ppppppp", ".KKKKK.", ".kkkkk."],
    pal: { p: "#8b5cf6", w: C.white, n: C.ink, ...PLINTH },
  },
};
