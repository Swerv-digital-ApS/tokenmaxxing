import { C } from "./palette.ts";
import type { Pet } from "./pet-base.ts";

/**
 * The Ragnarok Eve case's pets (core/src/case-ragnarok.ts, pet.500 to pet.505), 12×10 facing right with two hop
 * frames, like the Night Market's. `pet-base.ts` files them at `RAGNAROK_BASE + n` in `PETS`.
 */

/** A 6×6 raven facing right, black with a violet sheen; `b` the beak, `w` the eye. */
// prettier-ignore
const RAVEN = [
  "...vk.",
  "..kkwb",
  ".vkkk.",
  "vkkkk.",
  "kkkk..",
  "..y.y.",
];

/** Two ravens side by side on a 12×10 frame; one hops (rows 2-7) while the other stands (rows 4-9). */
function ravens(leftUp: boolean): string[] {
  const rows = Array.from({ length: 10 }, () => Array<string>(12).fill("."));
  const put = (x0: number, y0: number, art: string[]) => {
    for (const [dy, r] of art.entries())
      for (const [dx, c] of [...r].entries()) if (c !== ".") rows[y0 + dy]![x0 + dx] = c;
  };
  put(0, leftUp ? 2 : 4, RAVEN);
  put(
    6,
    leftUp ? 4 : 2,
    RAVEN.map((r, i) => (i === 1 ? "..kkwb" : r)),
  );
  return rows.map((r) => r.join(""));
}

// Pixel art reads as a grid.
// prettier-ignore
export const RAGNAROK_PETS: Pet[] = [
  // Huginn and Muninn: two ravens, thought and memory, hopping in turn.
  {
    frames: [ravens(true), ravens(false)],
    pal: { v: "#5a5280", k: "#252a3a", w: "#e8dfc8", b: "#c9a24a", y: "#8a6a2a" },
  },
  // Ratatoskr: a red-brown squirrel, a huge curling tail, a tiny scroll of gossip in its paws. The tail flicks.
  {
    frames: [
      ["..oooo......", ".orrrro..o.o", "orRrrRro.oro", "orrRrrrooorr", "orrrRrrorcce", ".orrrrrorccn", "..orrrrrrcpo", "...oorrrrcpo", ".....oorroo.", "......o..o.."],
      [".oooo.......", "orrrro...o.o", "orRrrRro.oro", "orrrRrrooorr", ".orrrrrrorce", "..orrRrrorcn", "...orrrrrcpo", "....oorrrcpo", ".....oorroo.", "......o..o.."],
    ],
    pal: { o: C.ink, r: "#c0592a", R: "#8a3a1c", c: "#f1d8b0", e: C.ink, n: C.ink, p: "#e8dcb4" },
  },
  // Tanngrisnir: a cream goat with big curved horns, a grin of teeth and a stubby tail.
  {
    frames: [
      ["........hh..", ".......hhoh.", "......oooohh", "......owwwoh", "ooooooowewwo", "owwwwwwwwwoo", "owwwwwwwtttn", "owwwwwwwoooo", ".ow.owo.ow..", ".kk.kkk.kk.."],
      ["........hh..", ".......hhoh.", "......oooohh", "oooooowwwwoh", "owwwwwwwewwo", "owwwwwwwwwoo", "owwwwwwwtttn", "owwwwwwwoooo", ".ow.owo.ow..", ".kk.kkk.kk.."],
    ],
    pal: { o: C.ink, w: "#f4ecd8", h: "#b89a60", e: C.ink, t: "#ffffff", n: "#3a2a24", k: "#4a3a30" },
  },
  // Hildisvíni: a round pink-brown boar piglet, tusk nubs, golden bristles along its back.
  {
    frames: [
      ["....g.g.g...", "...gggggggo.", "..oppppppppo", ".opppppppeno", ".opppppppnnn", ".opppppppnTn", ".oppppppppoo", "..opppppppo.", "..oo.oo.oo..", "............"],
      ["....g.g.g...", "...gggggggo.", "..oppppppppo", ".opppppppeno", ".opppppppnnn", ".opppppppnTn", ".oppppppppoo", "..opppppppo.", ".oo..oo..oo.", "............"],
    ],
    pal: { o: C.ink, p: "#d98c7a", g: "#f2c230", e: C.ink, n: "#b8665a", T: "#fbf4dc" },
  },
  // Sleipnir foal: a grey foal on eight legs, front four light and back four dark, all of them in a hurry.
  {
    frames: [
      ["........oo..", ".......okmo.", "......okmmgo", ".oooooogwego", "ogggggggggnn", "ogggGgGggGgo", ".ogggggggggo", ".oLlLlLlLl..", "..LlLlLlLl..", "..hhhhhhhh.."],
      ["............", "........oo..", ".......okmo.", ".oooooookmgo", "ogggggggwego", "ogggGgGggGnn", ".ogggggggggo", "..LlLlLlLl..", ".oLlLlLlLl..", "..hhhhhhhh.."],
    ],
    pal: { o: C.ink, g: "#a9b0bc", G: "#868e9c", l: "#c4cad4", L: "#6f7684", m: "#4a5160", k: "#6f7684", w: "#fbf7ef", e: C.ink, n: "#d8a8a0", h: "#3a3340" },
  },
  // Fenrir pup: a grey-black wolf pup with a white chest and a thin silver thread of a leash trailing behind (Gleipnir).
  {
    frames: [
      ["......o.o...", ".....okoko..", "....oogkkgoo", "iiii.ogwgegn", "...iooggggnn", "..ioggwwwgo.", "oioggkgwwgo.", "ooggkkggggo.", ".og.og.og.og", ".oo.oo.oo.oo"],
      ["......o.o...", ".....okoko..", "....oogkkgoo", "....ogwgegn.", "iiiiooggggnn", "...ioggwwwgo", "oi.ggkgwwgo.", "oogkkkgggggo", "og.og.og.og.", "oo.oo.oo.oo."],
    ],
    pal: { o: C.ink, g: "#7d8694", k: "#3a3f4d", w: "#f4f1ea", e: C.ink, n: C.ink, i: "#d4dce8" },
  },
];
