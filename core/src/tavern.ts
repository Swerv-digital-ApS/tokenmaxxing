import { julefrokostDish, julefrokostOn } from "./december.ts";
import { JULEBRYG, julebrygOn } from "./jdag.ts";
import { worldWall } from "./range.ts";

/** One switch for the whole Tavern update. Core is shared by client and server, so both always agree. */
export const TAVERN = true;

/**
 * The Tavern's chalkboard: one special a day, the same for everyone because the day is Copenhagen's.
 * The days walk the list with a stride that shares no factor with its length, so every special comes
 * round once before any comes back.
 */
export const SPECIALS = [
  "🍝 Soup of the day: spaghetti code",
  "🥞 Fresh off the stack: overflow pancakes",
  "🍻 Happy hour: 2-for-1 on merge conflicts",
  "🍲 Chef's pick: race condition ragù, served whenever it's ready",
  "🍜 Null pointer noodles. Hold the reference.",
  "☕ Bottomless coffee, bottomless backlog",
  "🐟 Catch of the day: an unhandled exception",
  "🍟 Side order: deep-fried legacy code",
  "🍨 Rubber duck sundae, debugged to order",
  "🍔 The Tokenburger: 200k context, extra cheese",
  "🥔 Breakfast all day: hash browns (SHA-256)",
  "🌭 Off the grill: hot-reloaded sausages",
  "🔥 Today's roast: your last PR",
  "🥗 Vegan option: tree-shaken salad",
  "🥬 From the salad bar: lettuce rebase",
  "🧊 Cold brew, served with a cold start",
  "🥐 Cached croissants (stale after 5 minutes)",
  "🍱 Lunch combo: monolith, microservices on the side, extra latency",
  "🍷 House red: a full-bodied 2019 node_modules",
  "🔤 Alphabet soup, all in camelCase",
  "🌾 Gluten-free: semicolon-free JavaScript",
  "🥧 Pie of the day: 3.14159 slices, rounding errors included",
  "🍳 Off-by-one omelette: 11 eggs. Or 13.",
  "📐 Espresso, YAML-indented. One space off and it's tea.",
  "🥯 Fresh bagels, now with dependency injection",
  "🍣 Sushi: raw SQL, hand-rolled",
  "🫖 Kombucha, fermenting since the last major version",
  "🚀 Friday special: deploys on us",
  "🍞 Toast. Works on my machine.",
  "✅ The usual: it compiles, ship it",
  "🥚 Brunch: async eggs, awaited forever",
  "🌋 Burnt toast, aka production at 3am",
  "🫒 Tapas: small PRs, easy to review",
  "🥤 Smoothie: every branch blended, no squash",
  "❓ Mystery meat: a regex nobody remembers writing",
  "🍪 Prompt cookies, freshly baked (no tracking)",
  "♾️ Ramen: infinite loop noodles. Slurp responsibly.",
  "🧇 Waffles with exactly one well-documented edge case",
  "🧀 A well-aged TODO from 2021",
  "🥩 Prime rib, with a side of composite numbers",
  "♨️ Leftovers: yesterday's stack trace, reheated",
  "🍕 Pizza by the token: 8 slices, a million tokens each",
  "🍫 Hot chocolate, hotfixed, with marshmallows",
  "🍵 Decaf only. The build already keeps you up.",
  "🔁 Free refills on retries (exponential backoff applies)",
  "🍸 Mocktail: a mocked mock in a test of a test",
  "🧂 A pinch of salt, for the product estimates",
  "🥜 Peanut gallery: code review comments, salted",
  "🐛 Bug-free brownies (we haven't looked very hard)",
] as const;

/** Through the whole list before a repeat: shares no factor with its length (checked in the tests). */
export const STRIDE = 17;

const COPENHAGEN = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Copenhagen",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Copenhagen's date at `at`, as days since 1970-01-01. */
export const copenhagenDay = (at: Date): number =>
  Math.round(Date.parse(`${COPENHAGEN.format(at)}T00:00:00Z`) / 86_400_000);

/** Where the day's special sits in `SPECIALS`. */
export const specialIndex = (day: number): number => (day * STRIDE) % SPECIALS.length;

/**
 * What the tap pours at `at`: the special on Copenhagen's date; on the J-dag weekend Nissebryg (`jdag.ts`), and
 * at a julefrokost the evening's dish (`december.ts`).
 */
export function specialOn(at: Date): string {
  const ms = at.getTime();
  if (julebrygOn(ms)) return JULEBRYG.line;
  if (julefrokostOn(ms)) return julefrokostDish(ms);
  return SPECIALS[specialIndex(copenhagenDay(at))]!;
}

// MARK: The special, served

/** What a served special does: cosmetic, like coffee. It buys no pace and costs nothing. */
export const BUFFS = ["jitter", "glow"] as const;
export type Buff = (typeof BUFFS)[number];

/** How long the tap's special lasts. Free, cosmetic, one at a time. */
export const SPECIAL = { ms: 15 * 60_000 } as const;

/** The day's effect: the days alternate, so both show up. */
export const buffOf = (day: number): Buff => BUFFS[day % BUFFS.length]!;

/** What the tap's pour does at `ms`: the day's effect, or a warm glow from Nissebryg or a julefrokost. */
export const buffAt = (ms: number): Buff =>
  julebrygOn(ms) || julefrokostOn(ms) ? "glow" : buffOf(copenhagenDay(new Date(ms)));

export const hasSpecial = (until: number, now: number): boolean => until > now;

/** When a special served at `now` wears off. */
export const serveUntil = (now: number): number => now + SPECIAL.ms;

/**
 * What the special does while it lasts. When it was served decides (`until - SPECIAL.ms`), so one that
 * crosses midnight keeps its effect to the end, and the wire needs no field beyond `specialUntil`.
 */
export const specialBuff = (until: number): Buff => buffAt(until - SPECIAL.ms);

/** The Tavern, the net cafe under it and the rooms above: all count as time at the Tavern (the regulars' plaques). */
export const isTavernRoom = (room: string): boolean =>
  room === "inn" || room === "upstairs" || room === "basement";

/** The basement's cabinets in reading order, one per game. */
export const CABINET_GAMES = ["spr", "hype", "dice", "sprint", "tokenmaxxing"] as const;

/** Fridays and Saturdays from this hour (Copenhagen), the basement runs its LAN party: lighting only. */
export const LAN_FROM_HOUR = 18;

/** Whether it is a weekend evening in Copenhagen (Fri or Sat, 18:00 on) at `ms`. */
export const isLanParty = (ms: number): boolean => {
  const w = worldWall(ms);
  return (w.weekday === 5 || w.weekday === 6) && w.hour >= LAN_FROM_HOUR;
};
