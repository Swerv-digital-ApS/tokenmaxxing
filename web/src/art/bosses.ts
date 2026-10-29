import { C } from "./palette.ts";
import { bake, cached, once, type Palette, recolour } from "./pixels.ts";

/**
 * The raid's bosses, 22×22, on the dungeon's dais. `hurt` is the same shape in white inside its
 * outline, flashed for a moment when the town's hits land.
 */

interface BossArt {
  rows: string[];
  pal: Palette;
}

// Pixel art reads as a grid.
// prettier-ignore
const ART: Record<string, BossArt> = {
  // An hourglass with a grudge.
  "rate-limit": {
    rows: [
      "..oooooooooooooooooo..",
      "..owwwwwwwwwwwwwwwwo..",
      "..oooooooooooooooooo..",
      "...ogllllllllllllgo...",
      "...ogssssssssssssgo...",
      "....ogseesssseesgo....",
      "....ogsepsssspesgo....",
      ".....ogsmmmmmmsgo.....",
      "......ogsmmmmsgo......",
      ".......ogssssgo.......",
      "........ogssgo........",
      ".........osso.........",
      "........ogssgo........",
      ".......oglsslgo.......",
      "......ogllssllgo......",
      ".....oglllsslllgo.....",
      "....ogllllssllllgo....",
      "...ogllllssssllllgo...",
      "...ogssssssssssssgo...",
      "..oooooooooooooooooo..",
      "..owwwwwwwwwwwwwwwwo..",
      "..oooooooooooooooooo..",
    ],
    pal: { o: C.ink, w: "#8c5c36", g: "#bfe3f2", l: "#e4f5fd", s: "#e9b73d", e: C.white, p: "#c0392b", m: "#7a2a1f" },
  },
  // A window that forgot everything: the bottom panes are fading.
  "context-window": {
    rows: [
      "oooooooooooooooooooooo",
      "obbbbbbbbbbbbbbbbbbbbo",
      "obrbybgbbbbbbbbbbbbbbo",
      "obbbbbbbbbbbbbbbbbbbbo",
      "osssssssssssssssssssso",
      "ossseeesssssssseeessso",
      "osssepessssssssepessso",
      "ossseeesssssssseeessso",
      "osssssssssssssssssssso",
      "ossssssmmmmmmmmsssssso",
      "ossssssmwwmmwwmsssssso",
      "ossssssmmmmmmmmsssssso",
      "osssssssssssssssssssso",
      "os.s.s.s.s.s.s.s.s.s.o",
      "o.s.s.s.s.s.s.s.s.s.so",
      "o...s...s...s...s....o",
      "o......s.......s.....o",
      "..........s...........",
      "o....................o",
      "......s..........s....",
      "......................",
      "o....................o",
    ],
    pal: { o: C.ink, b: "#3f89c9", r: "#e06c5f", y: "#e9b73d", g: "#72bf52", s: "#a8dcf7", e: C.white, p: C.ink, m: "#2b4f7a", w: C.white },
  },
  // Two halves that can't agree, with conflict markers for hair.
  "merge-conflict": {
    rows: [
      "...<<<<<<....>>>>>>...",
      "....oooooooooooooo....",
      "...orrrrrrroggggggo...",
      "..orrrrrrroggggggggo..",
      ".orrooorrrrogggoooggo.",
      ".orreeerrroggggeeeggo.",
      ".orrepprrrrogggppeggo.",
      ".orreeerrroggggeeeggo.",
      ".orrrrrrrrroggggggggo.",
      ".orrrrrrrrogggggggggo.",
      ".orrrmmmmmmmmmmmmgggo.",
      ".orrmwwmwwmmwwmwwmggo.",
      ".orrrmmmmmmmmmmmmgggo.",
      ".orrrrrrrrogggggggggo.",
      ".orrrrrrrrroggggggggo.",
      ".orrrrrrrrogggggggggo.",
      ".orrrrrrrrroggggggggo.",
      "..orrrrrrroggggggggo..",
      "...oooooooooooooooo...",
      ".....oo.oo..oo.oo.....",
      "......................",
      "...=======..=======...",
    ],
    pal: { o: C.ink, r: "#e06c5f", g: "#72bf52", e: C.white, p: C.ink, m: "#5b1f1a", w: C.white, "<": "#e9b73d", ">": "#e9b73d", "=": "#8a8682" },
  },
  // A swirl that is very sure of itself.
  hallucination: {
    rows: [
      "........oooooo........",
      "......oovvvvvvoo......",
      ".....ovvllllllvvo.....",
      ".*..ovllvvvvvvllvo..*.",
      "...ovlvvvvvvvvvvlvo...",
      "..ovlvveeevveeevvlvo..",
      "..ovlvvepevvepevvlvo..",
      "..ovlvveeevveeevvlvo..",
      ".ovvlvvvvvvvvvvvvlvvo.",
      ".ovvllvvvvvvvvvvllvvo.",
      ".ovvvlvvmmmmmmvvlvvvo.",
      ".ovvvlvvmwwwwmvvlvvvo.",
      ".ovvvvllvmmmmvllvvvvo.",
      ".ovvvvvvllllllvvvvvvo.",
      ".ovvvvvvvvvvvvvvvvvvo.",
      ".ovvvvvvvvvvvvvvvvvvo.",
      ".ovvvvvvvvvvvvvvvvvvo.",
      ".ovvvvoovvvvvvoovvvvo.",
      ".ovvvo..ovvvvo..ovvvo.",
      "..ooo....oooo....ooo..",
      "......................",
      "...*......**......*...",
    ],
    pal: { o: C.ink, v: "#9b6fd6", l: "#d9c2f5", e: C.white, p: C.ink, m: "#4a2a73", w: C.white, "*": "#ffd35c" },
  },
  // A bill that never stops growing.
  invoice: {
    rows: [
      "..oooooooooooooooooo..",
      "..orrrrrrrrrrrrrrrro..",
      "..orwwrwwrwwrwwrwrro..",
      "..oppppppppppppppppo..",
      "..oppeeepppppeeepppo..",
      "..oppeiepppppeiepppo..",
      "..oppeeepppppeeepppo..",
      "..oppppppppppppppppo..",
      "..opppmmmmmmmmmmpppo..",
      "..opppmwmwmwmwmmpppo..",
      "..opppmmmmmmmmmmpppo..",
      "..oppppppppppppppppo..",
      "..oppttttttttttppppo..",
      "..oppttttttppppppppo..",
      "..oppttttttttttppppo..",
      "..opptttttpprrrrrppo..",
      "..oppttttpppprwwwrpo..",
      "..opppppppppprrrrrpo..",
      "..oppppppppppppppppo..",
      "..oooooooooooooooooo..",
      "..o.oo.oo.oo.oo.oo.o..",
      "......................",
    ],
    pal: { o: C.ink, p: "#f3e7b8", r: "#c0392b", w: C.white, e: C.white, i: C.ink, m: "#5b1f1a", t: "#9a9486" },
  },
};

export const BOSS_SIZE = 22;

export const bossSprite = cached(
  (id: string, hurt: boolean) => `${id} ${hurt}`,
  (id: string, hurt: boolean) => {
    const art = ART[id] ?? ART["rate-limit"]!;
    const pal = hurt ? recolour(art.pal, (k) => (k === "o" ? C.ink : C.white)) : art.pal;
    return bake(BOSS_SIZE, BOSS_SIZE, (p) => p.grid(art.rows, pal));
  },
);

/** A boss before it's out: all shadow, with only its eyes lit (the teaser's "???"). */
export const bossSilhouette = cached(
  (id: string) => `silhouette ${id}`,
  (id: string) => {
    const art = ART[id] ?? ART["rate-limit"]!;
    const pal = recolour(art.pal, (k) => (k === "e" ? "#c9a2ff" : "#0b0a10"));
    return bake(BOSS_SIZE, BOSS_SIZE, (p) => p.grid(art.rows, pal));
  },
);

/** The town's trophy, on the dais by a fallen boss. */
// Pixel art reads as a grid.
// prettier-ignore
const TROPHY = [
  ".oooooooooo.",
  "oyyyyyyyyyyo",
  "oyoywyyyyoyo",
  "oyoywyyyyoyo",
  ".ooywyyyyoo.",
  "..oyyyyyyo..",
  "...oyyyyo...",
  "....oyyo....",
  ".....oo.....",
  ".....oo.....",
  "...oooooo...",
  "..obbbbbbo..",
  "..oooooooo..",
];

export const trophySprite = once(() =>
  bake(12, 13, (p) => p.grid(TROPHY, { o: C.ink, y: "#ffd35c", w: C.white, b: C.woodDark })),
);
