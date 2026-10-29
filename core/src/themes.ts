import { tavernSet } from "./tavern-band.ts";
import type { Tune } from "./tunes.ts";
import type { RoomId } from "./world.ts";

/**
 * The background music: one theme per kind of place, in the jukebox's note format (see `tunes.ts`) but
 * two parts of four bars, so a loop is `THEME_STEPS` long. The web plays them (`web/src/game/music.ts`).
 */

/** Steps in one loop of every theme: an A part and a B part. */
export const THEME_STEPS = 64;

export type ThemeId = "town" | "company" | "office" | "tavern" | "hearth-jig" | "lantern-reel" | "raid";

export interface Theme extends Tune {
  id: ThemeId;
}

export const THEMES: readonly Theme[] = [
  {
    id: "town",
    name: "Morning Commit",
    emoji: "🏘",
    bpm: 124,
    wave: "square",
    lead: "c5 _ e5 g5 c6 _ g5 e5 | d5 _ f5 a5 d6 _ a5 f5 | e5 _ g5 b5 e6 _ d6 b5 | c6 _ g5 e5 g5 _ . . | a5 _ c6 _ a5 g5 f5 e5 | f5 _ a5 _ f5 e5 d5 c5 | g5 _ b5 _ d6 _ b5 g5 | c6 _ _ _ g5 _ . .",
    bass: "c3 . g3 . c3 . g3 . | d3 . a3 . d3 . a3 . | e3 . b3 . e3 . b3 . | c3 . g3 . c3 . g3 . | f3 . c4 . f3 . c4 . | d3 . a3 . d3 . a3 . | g3 . d4 . g3 . d4 . | c3 . g3 . c3 . . .",
    drums: "k.h.s.h. | k.h.s.h. | k.h.s.h. | k.h.s.hh | k.h.s.h. | k.h.s.h. | k.h.s.h. | k.h.s.hs",
  },
  {
    id: "company",
    name: "Quarterly Synergy",
    emoji: "🏢",
    bpm: 108,
    wave: "square",
    lead: "g4 . b4 . d5 . b4 . | e5 . d5 . c5 . b4 . | a4 . c5 . e5 . c5 . | d5 _ _ _ . . . . | b4 c5 d5 e5 g5 _ e5 _ | d5 c5 b4 a4 g4 _ . . | c5 d5 e5 g5 a5 _ g5 _ | f#5 e5 d5 e5 d5 _ . .",
    bass: "g2 . d3 . g2 . d3 . | c3 . g3 . c3 . g3 . | a2 . e3 . a2 . e3 . | d3 . a3 . d3 . . . | g2 . d3 . g2 . d3 . | g2 . d3 . g2 . d3 . | c3 . g3 . c3 . g3 . | d3 . a3 . d3 . . .",
    drums: "k...s... | k...s... | k.h.s.h. | k.h.s.h. | k.h.s.h. | k.h.s.h. | k.h.s.h. | k.h.s.hs",
  },
  {
    id: "office",
    name: "Deep Work",
    emoji: "💻",
    bpm: 84,
    wave: "square",
    lead: "a4 c5 e5 c5 a4 c5 e5 c5 | f4 a4 c5 a4 f4 a4 c5 a4 | g4 b4 d5 b4 g4 b4 d5 b4 | e4 g4 b4 g4 e4 g4 b4 e5 | e5 _ _ _ d5 _ c5 _ | c5 _ _ _ a4 _ _ _ | b4 _ d5 _ g5 _ _ _ | e5 _ _ _ _ _ . .",
    bass: "a2 _ _ _ e3 _ _ _ | f2 _ _ _ c3 _ _ _ | g2 _ _ _ d3 _ _ _ | e2 _ _ _ b2 _ _ _ | a2 _ _ _ e3 _ _ _ | f2 _ _ _ c3 _ _ _ | g2 _ _ _ d3 _ _ _ | e2 _ _ _ b2 _ _ _",
    drums: "k..hs..h | k..hs..h | k..hs..h | k..hs.hh | k..hs..h | k..hs..h | k..hs..h | k..hs.hh",
  },
  {
    id: "tavern",
    name: "Last Orders Jig",
    emoji: "🍺",
    bpm: 140,
    wave: "square",
    lead: "d5 f5 a5 f5 d5 f5 a5 _ | g5 f5 e5 d5 c5 e5 g5 _ | a5 g5 f5 e5 d5 f5 a5 f5 | e5 d5 c#5 e5 d5 _ . . | f5 _ a5 _ d6 _ c6 a5 | bb5 _ a5 _ g5 _ f5 e5 | d5 f5 a5 d6 c6 a5 f5 a5 | g5 f5 e5 c#5 d5 _ _ _",
    bass: "d3 . a3 . d3 . a3 . | g2 . d3 . g2 . d3 . | f3 . c4 . f3 . c4 . | a2 . e3 . a2 . a3 . | bb2 . f3 . bb2 . f3 . | g2 . d3 . g2 . d3 . | d3 . a3 . d3 . a3 . | a2 . e3 . a2 . a3 .",
    drums: "k.h.s.h. | k.h.s.h. | k.h.s.h. | k.h.s.hs | k.h.s.h. | k.h.s.h. | k.h.s.h. | k.hks.hs",
  },
  {
    id: "hearth-jig",
    name: "Hearthside Jig",
    emoji: "🪕",
    bpm: 126,
    wave: "square",
    lead: "d5 e5 f5 a5 f5 e5 d5 _ | c5 d5 e5 g5 e5 d5 c5 _ | d5 f5 a5 d6 c6 a5 f5 e5 | d5 _ a4 _ d5 _ . . | f5 g5 a5 c6 a5 g5 f5 _ | e5 f5 g5 bb5 g5 f5 e5 _ | d5 f5 a5 d6 c6 a5 g5 e5 | f5 e5 d5 c5 d5 _ _ _",
    bass: "d3 . a3 . d3 . a3 . | c3 . g3 . c3 . g3 . | bb2 . f3 . bb2 . f3 . | d3 . a2 . d3 . a2 . | f3 . c3 . f3 . c3 . | c3 . g2 . c3 . g2 . | bb2 . f3 . a2 . e3 . | d3 . a2 . d3 _ . .",
    drums: "k..h..h. | k..h..h. | k..h..h. | k..h..h. | k..h..h. | k..h..h. | k..h..h. | k..h..h.",
  },
  {
    id: "lantern-reel",
    name: "Lantern & Lute",
    emoji: "🕯️",
    bpm: 108,
    wave: "triangle",
    lead: "e5 _ g5 a5 b5 _ a5 g5 | d5 _ f#5 g5 a5 _ g5 f#5 | e5 g5 b5 e6 d6 b5 a5 g5 | f#5 _ d5 _ e5 _ . . | b5 a5 g5 e5 g5 a5 b5 _ | a5 g5 f#5 d5 f#5 g5 a5 _ | g5 e5 g5 b5 a5 f#5 d5 f#5 | e5 _ b4 _ e5 _ _ _",
    bass: "e3 _ b2 _ e3 _ b2 _ | d3 _ a2 _ d3 _ a2 _ | c3 _ g2 _ c3 _ g2 _ | d3 _ a2 _ e3 _ b2 _ | e3 _ b2 _ e3 _ b2 _ | d3 _ a2 _ d3 _ a2 _ | c3 _ g2 _ d3 _ a2 _ | e3 _ b2 _ e3 _ . .",
    drums: "k....... | ....h... | k....... | ....h... | k....... | ....h... | k....... | ....h...",
  },
  {
    id: "raid",
    name: "Boss Fight.exe",
    emoji: "👹",
    bpm: 150,
    wave: "sawtooth",
    lead: "e5 e5 b4 e5 g5 e5 b4 e5 | e5 e5 c5 e5 a5 e5 c5 e5 | d5 d5 a4 d5 f#5 d5 a4 d5 | b4 b4 e5 b4 f#5 b4 g5 f#5 | e6 _ d6 b5 g5 _ b5 _ | c6 _ b5 a5 e5 _ a5 _ | d6 _ c6 a5 f#5 _ a5 _ | b5 _ _ _ b4 c5 d5 e5",
    bass: "e2 e2 e3 e2 e2 e3 e2 e3 | c2 c2 c3 c2 c2 c3 c2 c3 | d2 d2 d3 d2 d2 d3 d2 d3 | b1 b1 b2 b1 b1 b2 b2 b2 | e2 e2 e3 e2 e2 e3 e2 e3 | a1 a1 a2 a1 a1 a2 a1 a2 | d2 d2 d3 d2 d2 d3 d2 d3 | b1 b1 b2 b1 b1 b2 b1 e2",
    drums: "k.sks.sh | k.sks.sh | k.sks.sh | k.sks.ss | k.sks.sh | k.sks.sh | k.sks.sh | ksskssks",
  },
];

/** Room themes; the Tavern floor switches to the live folk set after 16:00. */
export function themeOf(room: RoomId, at = Date.now()): Theme {
  const set = room === "inn" ? tavernSet(at) : null;
  if (set) return THEMES.find((t) => t.id === set)!;
  const id: ThemeId =
    room === "town"
      ? "town"
      : room === "dungeon"
        ? "raid"
        : room === "inn" || room === "upstairs" || room === "basement"
          ? "tavern"
          : room.startsWith("hq:")
            ? "company"
            : "office";
  return THEMES.find((t) => t.id === id)!;
}
