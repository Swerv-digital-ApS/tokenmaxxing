/**
 * Free catch-and-release fishing at the town pond: a journal of every species and personal best, medals per
 * species, town-wide pond records, and now and then a treasure (`fishing-loot.ts`). The world rolls every
 * catch (never the client), from the world clock and the weather, so a few fish only bite at certain times:
 * the 1337 bass at 13:37, the 404 at 04:04, the ghost carp after midnight, the puffer on a Friday deploy.
 */
import type { GameMap } from "./maps.ts";
import { worldClock } from "./range.ts";
import type { Rarity } from "./rarity.ts";
import type { WeatherKind } from "./sky.ts";
import { clockMinutes } from "./street.ts";
import { DIRS, type Facing } from "./world.ts";

/** When the world is, as a catch sees it: the minute of the day, the weekday (0 Sunday) and the weather. */
export interface PondTime {
  /** Minutes since midnight on the world clock, whole. */
  minute: number;
  weekday: number;
  weather: WeatherKind;
}

/** Fish that only bite some of the time. */
type When = "leet" | "notfound" | "midnight" | "friday" | "rain";

const RAINY: readonly WeatherKind[] = ["drizzle", "rain", "storm"];

/** Whether a fish that bites only `when` is biting at `t`. */
export const biting = (when: When, t: PondTime): boolean =>
  when === "leet"
    ? t.minute === 13 * 60 + 37
    : when === "notfound"
      ? t.minute === 4 * 60 + 4
      : when === "midnight"
        ? t.minute < 60
        : when === "friday"
          ? t.weekday === 5 && t.minute >= 16 * 60
          : RAINY.includes(t.weather);

export interface Fish {
  id: string;
  name: string;
  emoji: string;
  rarity: Rarity;
  /** Its share of the pond. The fish that always bite add up to 100; a fish with `when` joins them in its window. */
  weight: number;
  /** Length range in cm, both ends included. */
  min: number;
  max: number;
  /** The body's colour, for the journal's swatch. */
  color: string;
  /** One line for the journal. */
  blurb: string;
  /** Bites only then; how to find it, for the journal's hint. */
  when?: When;
  hint?: string;
}

const fish = (f: Fish): Fish => f;

/** Never reorder ids or reuse them: they are in journals. The first six are the pond's originals. */
// A catalog reads best one fish a line.
// prettier-ignore
export const FISH: readonly Fish[] = [
  fish({ id: "perch", name: "Pond perch", emoji: "🐟", rarity: "common", weight: 25, min: 12, max: 32, color: "#8db56b", blurb: "Stripes, spines and a bad attitude." }),
  fish({ id: "carp", name: "Copper carp", emoji: "🐠", rarity: "common", weight: 19, min: 20, max: 65, color: "#db9c54", blurb: "Has been in this pond longer than the town." }),
  fish({ id: "tench", name: "Sleepy tench", emoji: "🐟", rarity: "common", weight: 13, min: 18, max: 50, color: "#8fa098", blurb: "Bit the hook mid-yawn." }),
  fish({ id: "pike", name: "Mossy pike", emoji: "🐟", rarity: "uncommon", weight: 7, min: 35, max: 90, color: "#6e9275", blurb: "All teeth, no manners." }),
  fish({ id: "duck", name: "Rubber duck", emoji: "🦆", rarity: "uncommon", weight: 4, min: 6, max: 12, color: "#f3ce59", blurb: "Explain your bug to it. It always listens." }),
  fish({ id: "golden", name: "Golden koi", emoji: "✨", rarity: "epic", weight: 0.5, min: 25, max: 55, color: "#f6cc6c", blurb: "Bring it luck and it brings you more." }),
  fish({ id: "bug", name: "Water bug", emoji: "🪲", rarity: "common", weight: 9, min: 2, max: 5, color: "#4f6b3a", blurb: "Not a bug. A feature. With six legs." }),
  fish({ id: "boot", name: "Legacy boot", emoji: "🥾", rarity: "common", weight: 8, min: 25, max: 31, color: "#7a5236", blurb: "Nobody knows who wrote it. Everybody's scared to throw it out." }),
  fish({ id: "herring", name: "Red herring", emoji: "🐟", rarity: "uncommon", weight: 5, min: 15, max: 30, color: "#d9534a", blurb: "It looked like the cause. It wasn't." }),
  fish({ id: "spaghetti", name: "Spaghetti code", emoji: "🍝", rarity: "uncommon", weight: 4, min: 10, max: 40, color: "#f0d27a", blurb: "Pull one end and the whole pond moves." }),
  fish({ id: "offbyone", name: "Off-by-one bass", emoji: "🐟", rarity: "rare", weight: 2.5, min: 11, max: 41, color: "#5f8fb0", blurb: "Always one centimetre off from what you wrote down." }),
  fish({ id: "eel", name: "Memory leak eel", emoji: "🐍", rarity: "rare", weight: 1.5, min: 40, max: 180, color: "#5a5f7a", blurb: "Gets longer the longer you leave it running." }),
  fish({ id: "float", name: "Floating-point fish", emoji: "🐡", rarity: "rare", weight: 1.3, min: 30, max: 30, color: "#9ad1d4", blurb: "Exactly 0.1 m plus 0.2 m long. Give or take." }),
  fish({ id: "kraken", name: "Tech-debt kraken", emoji: "🦑", rarity: "legendary", weight: 0.2, min: 300, max: 999, color: "#8a4fbf", blurb: "You only landed one tentacle. The rest is still down there, growing." }),
  // Only some of the time.
  fish({ id: "trout", name: "Rain trout", emoji: "🌧️", rarity: "uncommon", weight: 12, min: 20, max: 60, color: "#7fa7c9", blurb: "Bites in the rain, when nobody can see it.", when: "rain", hint: "Bites when it rains" }),
  fish({ id: "ghost", name: "Ghost carp", emoji: "👻", rarity: "rare", weight: 8, min: 20, max: 65, color: "#dfe7ef", blurb: "See-through, and swims straight through the other fish.", when: "midnight", hint: "Bites after midnight" }),
  fish({ id: "puffer", name: "Friday-deploy puffer", emoji: "🐡", rarity: "rare", weight: 10, min: 10, max: 35, color: "#e8b04a", blurb: "Puffs up the moment someone pushes to prod.", when: "friday", hint: "Bites on Friday after 16:00" }),
  fish({ id: "leet", name: "1337 bass", emoji: "😎", rarity: "epic", weight: 50, min: 13, max: 37, color: "#3ddc84", blurb: "Only bites at 13:37. Wears its shades indoors.", when: "leet", hint: "Bites at one exact minute" }),
  fish({ id: "notfound", name: "404 fish", emoji: "❓", rarity: "epic", weight: 50, min: 0, max: 0, color: "#c9ced6", blurb: "The hook came up empty. The journal counts it anyway.", when: "notfound", hint: "Bites at one exact minute, before dawn" }),
];
export type FishId = string;

export interface FishCatch {
  fish: FishId;
  cm: number;
}
export interface FishingEntry extends FishCatch {
  count: number;
}
export const BITE_WINDOW_MS = 2400;
export const CAST_COOLDOWN_MS = 1500;

export interface FishingCast {
  x: number;
  y: number;
  waterX: number;
  waterY: number;
  biteAt: number;
  endsAt: number;
}

/** Someone's line in the water, as everyone in town sees it (`PlayerInfo.angling`): where, and its bite (epoch ms). */
export interface Angling {
  waterX: number;
  waterY: number;
  biteAt: number;
  endsAt: number;
}

/** Someone's last catch, as everyone in town sees it (`PlayerInfo.landing`): held up for a moment from `at`. */
export interface Landing {
  fish: FishId;
  waterX: number;
  waterY: number;
  at: number;
}

/** How long a catch is held up before it goes back in. */
export const LANDED_MS = 2600;

/** A line nobody has reeled or put away this long after its bite window is shown no more (a world restart leaves some). */
export const STALE_LINE_MS = 120_000;

/** A pond treasure, when a catch turns one up (`fishing-loot.ts`). */
export interface Treasure {
  item: string;
}

/** What the panel shows about the day's lucky casts: how many are left, of how many. */
export interface Luck {
  left: number;
  of: number;
}

/** The pond's records: the longest of each species anyone has caught, and who. */
export interface PondRecord {
  fish: FishId;
  cm: number;
  userId: number;
  name: string;
}

/** Everything the panel opens with. */
export interface FishingState {
  journal: FishingEntry[];
  luck: Luck;
  records: PondRecord[];
  treasures: string[];
}

export type CastReply = { ok: true; cast: FishingCast; now: number } | { ok: false; message: string };
export type ReelReply =
  | {
      ok: true;
      catch: FishCatch;
      journal: FishingEntry[];
      luck: Luck;
      /** Set when this catch beat the pond's record for its species. */
      record: boolean;
      treasure: Treasure | null;
    }
  | { ok: false; message: string };

export const fishById = (id: string): Fish | undefined => FISH.find((f) => f.id === id);

/** Only the town pond's water can be cast into, from an adjacent walkable bank. */
export function fishingWater(map: GameMap, x: number, y: number, facing: Facing): [number, number] | null {
  const [dx, dy] = DIRS[facing];
  return map.id === "town" && map.walkable(x, y) && map.at(x + dx, y + dy) === "~" ? [x + dx, y + dy] : null;
}

export function newCast(
  x: number,
  y: number,
  water: [number, number],
  now: number,
  random = Math.random,
): FishingCast {
  const biteAt = now + 2500 + Math.floor(random() * 3500);
  return { x, y, waterX: water[0], waterY: water[1], biteAt, endsAt: biteAt + BITE_WINDOW_MS };
}
export const fishingPhase = (cast: FishingCast, now: number): "waiting" | "bite" | "missed" =>
  now < cast.biteAt ? "waiting" : now < cast.endsAt ? "bite" : "missed";

/** The pond at `ms` on the world clock, in `weather`. */
export const pondTime = (ms: number, weather: WeatherKind): PondTime => ({
  minute: Math.floor(clockMinutes(ms)),
  weekday: worldClock(ms).day,
  weather,
});

/** The fish biting at `t`: the ones that always do, and any whose window is open. */
export const pondAt = (t: PondTime): Fish[] => FISH.filter((f) => !f.when || biting(f.when, t));

/** One catch from what's biting at `t`, by weight, with a length in its range. */
export function rollCatch(t: PondTime, random = Math.random): FishCatch {
  const pool = pondAt(t);
  let roll = random() * pool.reduce((n, f) => n + f.weight, 0);
  const caught =
    pool.find((f) => {
      roll -= f.weight;
      return roll < 0;
    }) ?? pool[pool.length - 1]!;
  return { fish: caught.id, cm: caught.min + Math.floor(random() * (caught.max - caught.min + 1)) };
}

/** A catch's length as the journal writes it, with the quirks: the float's rounding, the bass's slip, the 404's nothing. */
export function lengthOf(c: FishCatch): string {
  if (c.fish === "float") return "30.000000000000004 cm";
  if (c.fish === "notfound") return "404 cm not found";
  if (c.fish === "offbyone") return `${c.cm} cm (±1)`;
  return `${c.cm} cm`;
}

/** The answer to life, the universe and everything, in centimetres. */
export const ANSWER_CM = 42;

/** What the pond says about a catch, past its name and length: the easter eggs speak up here. */
export function catchLine(c: FishCatch, random = Math.random): string {
  if (c.cm === ANSWER_CM && c.fish !== "float")
    return "Exactly 42 cm. The answer to life, the universe and fishing.";
  const lines = QUIPS[c.fish];
  if (lines) return lines[Math.floor(random() * lines.length)]!;
  return "Added to your journal, then released back into the pond.";
}

const QUIPS: Record<string, readonly string[]> = {
  duck: [
    "Quack. (It wants you to explain the bug again, slower.)",
    "Quack. (Have you tried logging the value just before it breaks?)",
    "Quack. (It thinks it's a caching issue. It always thinks it's a caching issue.)",
    "Quack. (Read the error message. All of it.)",
  ],
  boot: [
    "git blame says: you.",
    "Last touched in 2009. Marked TODO: remove.",
    "It still works. Nobody dares ask how.",
  ],
  bug: ["Closed as works-as-intended, then released.", "Can't reproduce. Released anyway."],
  herring: ["You spent an hour on this one. The real cause was in the config."],
  spaghetti: [
    "You untangled one strand. Three more knotted themselves.",
    "There's a meatball in it marked // do not touch.",
  ],
  offbyone: ["You measured twice. Both were wrong by one."],
  eel: ["You let go, and it kept growing anyway.", "It was 40 cm when you hooked it."],
  float: ["0.1 + 0.2 metres of fish. Close enough."],
  kraken: ["One tentacle. The sprint after next is going to be about the rest of it."],
  ghost: ["It slipped back into the pond without a splash."],
  puffer: ["It puffed up the second you said “quick fix”.", "Rolled back into the pond."],
  leet: ["Pwned. It nods at you and swims off."],
  notfound: ["Your hook came up empty. 404: fish not found. The journal logged it anyway."],
  golden: ["It glints, winks and slips away. You feel lucky."],
};

/** What the panel says while you wait for a bite. */
export const WAITING_LINES: readonly string[] = [
  "Line cast. Watch the bobber…",
  "await pond.bite()…",
  "while (!bite) { wait(); }",
  "Polling the pond every 200 ms…",
  "Spinner spinning. The fish is thinking.",
  "Pending… (the pond is rate limited)",
];

/** What the panel says when the fish got away. */
export const MISSED_LINES: readonly string[] = [
  "It got away. Cast again when you're ready.",
  "It got away. UnhandledPromiseRejection: fish.",
  "Timed out after 2400 ms. The fish did not respond.",
];

// MARK: Medals

/** A species' medal by how many you've caught: bronze from the first, silver at 10, gold at 50. */
export const MEDALS = [
  { at: 1, medal: "bronze" },
  { at: 10, medal: "silver" },
  { at: 50, medal: "gold" },
] as const;
export type Medal = (typeof MEDALS)[number]["medal"];

export const medalOf = (count: number): Medal | null => MEDALS.findLast((m) => count >= m.at)?.medal ?? null;

/** A specimen: a best at the species' longest. Fish of one size are always one, so they don't count. */
export const isSpecimen = (e: FishCatch): boolean => {
  const f = fishById(e.fish);
  return !!f && f.max > f.min && e.cm >= f.max;
};

/** Whether a species keeps a pond record: only those that come in more than one size. */
export const hasRecord = (id: FishId): boolean => {
  const f = fishById(id);
  return !!f && f.max > f.min;
};

/** The badges' fishing facts from someone's journal. */
export function journalFacts(journal: readonly FishingEntry[]): {
  caught: number;
  species: number;
  specimens: number;
  golds: number;
} {
  return {
    caught: journal.reduce((n, e) => n + e.count, 0),
    species: journal.filter((e) => fishById(e.fish)).length,
    specimens: journal.filter(isSpecimen).length,
    golds: journal.filter((e) => medalOf(e.count) === "gold").length,
  };
}
