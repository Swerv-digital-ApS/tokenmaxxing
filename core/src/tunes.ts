/**
 * The jukebox's six tunes, written for this game. Eighth-note steps, four bars of eight; the web plays
 * them with WebAudio (`web/src/game/jukebox.ts`), and `jukebox.ts` takes their lengths from here.
 * A note token is `c4`, `f#3`, `bb2`; `.` is a rest and `_` holds the note before it. Drums: k kick,
 * s snare, h hat, `.` nothing. Bars are written apart with `|`, which is ignored.
 */

export type Wave = "square" | "triangle" | "sawtooth";

export interface Tune {
  id: string;
  name: string;
  emoji: string;
  bpm: number;
  wave: Wave;
  lead: string;
  bass: string;
  drums: string;
}

/** Steps in one loop of every tune. */
export const STEPS = 32;

/** About how long a track plays: it loops until it has run this long. */
export const TRACK_MS = 60_000;

export const TUNES: readonly Tune[] = [
  {
    id: "polka",
    name: "Merge Conflict Polka",
    emoji: "🪗",
    bpm: 144,
    wave: "square",
    lead: "e5 _ g5 _ c6 _ g5 . | a5 _ f5 _ d5 _ . . | e5 _ g5 _ c6 _ e6 _ | d6 _ b5 _ c6 _ . .",
    bass: "c3 . g3 . c3 . g3 . | f3 . c4 . f3 . c4 . | c3 . g3 . c3 . g3 . | g3 . d4 . c3 . . .",
    drums: "k.h.s.h. | k.h.s.h. | k.h.s.h. | k.h.s.hs",
  },
  {
    id: "green",
    name: "Green CI",
    emoji: "✅",
    bpm: 152,
    wave: "square",
    lead: "g5 a5 b5 d6 b5 a5 g5 . | e5 g5 b5 e6 d6 b5 g5 . | a5 b5 c6 e6 c6 b5 a5 . | b5 a5 g5 a5 b5 _ d6 _",
    bass: "g2 . g3 . d3 . g3 . | e3 . e2 . b2 . e3 . | a2 . a3 . e3 . a3 . | d3 . d3 . d2 . . .",
    drums: "k.hks.h. | k.hks.h. | k.hks.h. | k.hksshs",
  },
  {
    id: "rain",
    name: "Rainy Deploy",
    emoji: "🌧",
    bpm: 88,
    wave: "triangle",
    lead: "a4 _ _ c5 e5 _ _ . | d5 _ _ c5 b4 _ a4 . | c5 _ _ e5 a5 _ _ g5 | e5 _ _ . . . . .",
    bass: "a2 _ _ _ e3 _ _ _ | d3 _ _ _ a2 _ _ _ | f2 _ _ _ c3 _ _ _ | e2 _ _ _ _ _ _ _",
    drums: "h.h.h.h. | h.h.h.h. | h.h.h.h. | h.h.h.h.",
  },
  {
    id: "standup",
    name: "Standup Shuffle",
    emoji: "☕",
    bpm: 118,
    wave: "square",
    lead: "d5 . f5 . a5 . g5 f5 | e5 . g5 . c6 . b5 a5 | d5 . f5 . a5 . d6 . | c6 a5 g5 e5 d5 _ . .",
    bass: "d3 . . d3 . . d3 . | c3 . . c3 . . c3 . | d3 . . d3 . . f3 . | g3 . . e3 . . d3 .",
    drums: "k..hs.h. | k..hs.h. | k..hs.h. | k..hs.hs",
  },
  {
    id: "hotfix",
    name: "3am Hotfix",
    emoji: "🔥",
    bpm: 164,
    wave: "sawtooth",
    lead: "e5 e5 g5 e5 b5 e5 a5 g5 | e5 e5 g5 e5 d6 e5 c6 b5 | e5 e5 g5 e5 b5 e5 a5 g5 | f#5 f#5 g5 a5 b5 _ . .",
    bass: "e2 e2 e3 e2 e2 e3 e2 e3 | c3 c3 c4 c3 c3 c4 c3 c4 | e2 e2 e3 e2 e2 e3 e2 e3 | b2 b2 b3 b2 b2 b3 b2 b3",
    drums: "k.sks.sh | k.sks.sh | k.sks.sh | kssksssk",
  },
  {
    id: "lockfile",
    name: "Lockfile Lullaby",
    emoji: "🌙",
    bpm: 72,
    wave: "triangle",
    lead: "a4 _ c5 _ f5 _ _ . | e5 _ d5 _ c5 _ _ . | bb4 _ d5 _ g5 _ f5 _ | e5 _ _ _ c5 _ _ _",
    bass: "f2 _ _ _ c3 _ _ _ | f2 _ _ _ c3 _ _ _ | bb2 _ _ _ f3 _ _ _ | c3 _ _ _ c3 _ _ _",
    drums: "k....... | h...h... | k....... | h...h...",
  },
];

export interface Note {
  /** Step it starts on, and how many steps it lasts. */
  step: number;
  len: number;
  hz: number;
}

const SEMI: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

/** A note name's frequency, or null if it isn't one. */
export function noteHz(name: string): number | null {
  const m = /^([a-g])([#b]?)(\d)$/.exec(name);
  if (!m) return null;
  const midi = 12 * (Number(m[3]) + 1) + SEMI[m[1]!]! + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
  return 440 * 2 ** ((midi - 69) / 12);
}

const tokens = (s: string): string[] => s.replaceAll("|", " ").split(/\s+/).filter(Boolean);

/** A voice's tokens as notes (`_` stretches the one before it). Throws on a token it can't read. */
export function notes(voice: string): Note[] {
  const out: Note[] = [];
  tokens(voice).forEach((t, step) => {
    if (t === ".") return;
    if (t === "_") {
      const last = out.at(-1);
      if (!last) throw new Error("a hold with nothing to hold");
      last.len++;
      return;
    }
    const hz = noteHz(t);
    if (hz === null) throw new Error(`not a note: ${t}`);
    out.push({ step, len: 1, hz });
  });
  return out;
}

const drumLine = (drums: string): string => drums.replace(/[\s|]/g, "");

/** The drum hits by step. */
export const drumHits = (drums: string): { step: number; hit: "k" | "s" | "h" }[] =>
  [...drumLine(drums)].flatMap((ch, step) =>
    ch === "k" || ch === "s" || ch === "h" ? [{ step, hit: ch }] : [],
  );

/** Steps in a note voice, and in a drum line: each must be a whole loop (`STEPS`). */
export const voiceSteps = (voice: string): number => tokens(voice).length;
export const drumSteps = (drums: string): number => drumLine(drums).length;

/** One loop's length, ms. */
export const loopMs = (t: Tune): number => STEPS * (30_000 / t.bpm);
