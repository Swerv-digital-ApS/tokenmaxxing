/**
 * Sprint Race: a typing race, like Monkeytype. Everyone types the same common English
 * words, all lowercase with no punctuation, for 15, 30 or 60 seconds; the highest WPM
 * wins. The client sends the text as it's typed, and the rules score only what the
 * server got inside the race, at its own clock, and never faster than 250 WPM.
 */
import { recordFromKeys } from "hanzio";
import { random } from "./random.ts";
import { type Callout, type GameDef, lastStanding, leave, leavers, refused } from "./types.ts";

/** The 200 most common English words, Monkeytype's "english" kind of list. */
export const WORDS =
  `the be of and a to in he have it that for they with as not on she at by this we you do but
from or which one would all will there say who make when can more if no man out other so what time up go about
than into could state only new year some take come these know see use get like then first any work now may such
give over think most even find day also after way many must look before great back through long where much should
well people down own just because good each those feel seem how high too place little world very still nation
hand old life tell write become here show house both between need mean call develop under last right move thing
general school never same another begin while number part turn real leave might want point form off child few
small since against ask late home interest large person end open public follow during present without again hold
govern around possible head consider word program problem however lead system set order eye plan run keep face
fact group play stand increase early course change help line her`.split(/\s+/);

const SECONDS = [30, 15, 60] as const;
const COUNTDOWN_MS = 3_000;
/** A move sent just before the end may arrive this late and still count. */
export const GRACE_MS = 500;
/** Faster than this is a bot or a paste: the text is refused until the clock catches up. */
export const MAX_WPM = 250;
/** A head start on the cap, so a quick first word isn't refused. */
const SLACK_MS = 1_000;
/** Letters past the end of a word, as Monkeytype shows them. */
export const MAX_EXTRA = 10;
/** Moves closer together than this are dropped; the client sends again. */
const MIN_GAP_MS = 50;
/** The track's flag: reaching it by the end is this fast. */
export const TRACK_WPM = 120;
/** A lap of the square in town is 10 seconds at 100 WPM, so the leader pulls ahead lap by lap. */
export const LAP_CHARS = (100 * 5 * 10) / 60;

interface Racer {
  /** Everything they've typed: words split by single spaces, the last one still being typed. */
  typed: string;
  /** When the server last took their text. */
  at: number;
  /** When their score last went up: ties go to whoever got there first. */
  scoredAt: number;
  /** Wrong letters the server saw and they fixed, for accuracy. */
  fixed: number;
}

export interface SprintState {
  players: number[];
  words: string[];
  seconds: number;
  startsAt: number;
  endsAt: number;
  racers: Record<number, Racer>;
  /** The grace is over and nothing more counts. */
  over: boolean;
  forfeited: number[];
}

interface Score {
  /** Letters in correctly typed words, plus the spaces after them: what WPM counts. */
  correct: number;
  /** Every letter and space typed. */
  typed: number;
  wpm: number;
  raw: number;
  /** Percent of letters right, counting the ones they fixed as wrong. */
  acc: number;
  /** Words finished. */
  done: number;
}

export interface SprintView {
  words: string[];
  seconds: number;
  startsAt: number;
  endsAt: number;
  over: boolean;
  /** Mine in full, when I'm playing; nobody sees anyone else's text. */
  mine: string | null;
  scores: Record<number, Score>;
  forfeited: number[];
}

/** Monkeytype's WPM: (correct words' letters + their spaces) ÷ 5 ÷ minutes. The last word counts if it's right so far. */
export function score(words: string[], typed: string, fixed: number, ms: number): Score {
  const parts = typed === "" ? [] : typed.split(" ");
  let correct = 0;
  let right = 0;
  let wrong = fixed;
  for (const [i, input] of parts.entries()) {
    const target = words[i] ?? "";
    const last = i === parts.length - 1;
    for (let j = 0; j < input.length; j++) input[j] === target[j] ? right++ : wrong++;
    if (!last) right++; // the space
    if (last ? target.startsWith(input) : input === target) correct += input.length + (last ? 0 : 1);
  }
  const minutes = ms / 60_000;
  return {
    correct,
    typed: typed.length,
    wpm: minutes > 0 ? correct / 5 / minutes : 0,
    raw: minutes > 0 ? typed.length / 5 / minutes : 0,
    acc: right + wrong > 0 ? (right / (right + wrong)) * 100 : 0,
    done: Math.max(0, parts.length - 1),
  };
}

const active = (s: SprintState) => s.players.filter((p) => !s.forfeited.includes(p));
/** How long they've raced: all of it once it's over. */
const raced = (s: SprintState, now: number) => Math.max(0, Math.min(now, s.endsAt) - s.startsAt);
const scoreOf = (s: SprintState, p: number, now: number) => {
  const r = s.racers[p]!;
  return score(s.words, r.typed, r.fixed, raced(s, now));
};

/** Wrong letters in the word being typed that are gone from the new text: fixed. */
function fixedBetween(words: string[], before: string, after: string): number {
  const old = before.split(" ");
  const i = old.length - 1;
  const was = old[i]!;
  const now = after.split(" ")[i] ?? "";
  let n = 0;
  for (let j = 0; j < was.length; j++) if (was[j] !== words[i]![j] && now[j] !== was[j]) n++;
  return n;
}

export const sprint: GameDef<SprintState, SprintView> = {
  id: "sprint",
  name: "Sprint Race",
  emoji: "⌨️",
  blurb: "A typing race. Same words for everyone; the highest WPM wins.",
  players: { min: 2, max: 8 },
  tickMs: 250,
  options: { seconds: SECONDS },

  setup(players, seed, options, now) {
    const seconds = Number(options.seconds) || 30;
    const rng = random(seed);
    // Enough words for the cap, so nobody runs out, and never the same word twice in a row.
    const words: string[] = [];
    while (words.length < Math.ceil((MAX_WPM * seconds) / 60) + 10) {
      const w = WORDS[Math.floor(rng() * WORDS.length)]!;
      if (w !== words.at(-1)) words.push(w);
    }
    const startsAt = now + COUNTDOWN_MS;
    return {
      players,
      words,
      seconds,
      startsAt,
      endsAt: startsAt + seconds * 1000,
      racers: recordFromKeys(players, () => ({ typed: "", at: 0, scoredAt: 0, fixed: 0 })),
      over: false,
      forfeited: [],
    };
  },

  move(s, player, move, now) {
    const typed = (move as { typed?: unknown } | null)?.typed;
    if (typeof typed !== "string") return refused("Type the words.");
    if (s.over || now > s.endsAt + GRACE_MS) return refused("Time's up.");
    if (now < s.startsAt) return refused("Wait for the start.");
    if (s.forfeited.includes(player)) return refused("You've left the race.");
    const r = s.racers[player]!;
    if (typed === r.typed || now - r.at < MIN_GAP_MS) return s;
    const parts = typed.split(" ");
    if (!/^[a-z ]*$/.test(typed) || parts.slice(0, -1).some((w) => w === "") || parts.length > s.words.length)
      return refused("Only lowercase letters, one space between words.");
    if (parts.some((w, i) => w.length > s.words[i]!.length + MAX_EXTRA))
      return refused("That word's too long.");
    // Words behind a space are finished, as in Monkeytype: only the one being typed changes.
    const before = r.typed.split(" ").slice(0, -1);
    if (before.some((w, i) => parts[i] !== w)) return refused("You can't change words you've finished.");
    const fixed = r.fixed + (r.typed === "" ? 0 : fixedBetween(s.words, r.typed, typed));
    const next = score(s.words, typed, fixed, 0);
    // Checked at the server's clock: 250 WPM is the most anyone has had time to type.
    if (next.correct > (MAX_WPM * 5 * (now - s.startsAt + SLACK_MS)) / 60_000)
      return refused(`That's faster than ${MAX_WPM} WPM.`);
    const scoredAt = next.correct > score(s.words, r.typed, 0, 0).correct ? now : r.scoredAt;
    return { ...s, racers: { ...s.racers, [player]: { typed, at: now, scoredAt, fixed } } };
  },

  tick: (s, now) => (!s.over && now >= s.endsAt + GRACE_MS ? { ...s, over: true } : s),

  forfeit: leave,

  view(s, viewer, now) {
    return {
      words: s.words,
      seconds: s.seconds,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      over: s.over,
      mine: viewer !== null && s.players.includes(viewer) ? s.racers[viewer]!.typed : null,
      scores: recordFromKeys(s.players, (p) => scoreOf(s, p, now)),
      forfeited: s.forfeited,
    };
  },

  outcome(s) {
    const left = active(s);
    const over = lastStanding(left, s.forfeited);
    if (over) return over;
    if (!s.over) return null;
    const sc = recordFromKeys(left, (p) => scoreOf(s, p, s.endsAt));
    if (left.every((p) => sc[p]!.correct === 0)) return { void: "Nobody typed a word right." };
    // Highest WPM, then accuracy, then who got there first; nothing typed is last whatever else.
    const key = (p: number) =>
      sc[p]!.correct === 0
        ? [0, 0, 0]
        : [sc[p]!.correct, Math.round(sc[p]!.acc * 100), -s.racers[p]!.scoredAt];
    const better = (a: number, b: number) => {
      const [x, y] = [key(a), key(b)];
      return y[0]! - x[0]! || y[1]! - x[1]! || y[2]! - x[2]!;
    };
    const places: number[][] = [];
    for (const p of [...left].sort(better)) {
      const group = places.at(-1);
      if (group && better(group[0]!, p) === 0) group.push(p);
      else places.push([p]);
    }
    return { places: [...places, ...leavers(s.forfeited)] };
  },

  // Side bets stay open for the first few seconds of the race.
  betsCloseAt: (s) => s.startsAt + 5_000,

  callouts(before, after): Callout[] {
    if (before.over || !after.over) return [];
    return active(after).map((p) => ({
      player: p,
      text: `⌨️ ${Math.round(scoreOf(after, p, after.endsAt).wpm)} WPM`,
    }));
  },

  headline(s, now) {
    if (s.over) return "Over";
    return now < s.startsAt ? "On your marks…" : `${s.seconds}s race`;
  },

  // Reported on changes, so it moves as they type.
  status(s, player, now) {
    if (now < s.startsAt || s.racers[player]!.typed === "") return null;
    const sc = scoreOf(s, player, now);
    return `⌨️ ${Math.round(sc.wpm)} wpm · lap ${Math.floor(sc.correct / LAP_CHARS) + 1}`;
  },

  // The racers' correct characters: the world runs them round the square by it (LAP_CHARS a lap).
  board(s, now) {
    return active(s)
      .map((p) => {
        const sc = scoreOf(s, p, now);
        return { player: p, value: sc.correct, label: `${Math.round(sc.wpm)} wpm` };
      })
      .sort((a, b) => b.value - a.value || a.player - b.player);
  },

  endsAt: (s) => s.endsAt,
};
