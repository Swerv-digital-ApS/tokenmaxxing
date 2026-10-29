/**
 * A snapshot of the Tavern's 2D data for the 3D Tavern.
 * Sources: `core/src/tavern.ts` (SPECIALS, specialIndex, STRIDE, aarhusDay), `core/src/tunes.ts` (the six
 * jukebox tracks), `core/src/regulars.ts` (LEFT_PLATES, REGULARS_TOP, tabLine), `core/src/barkeep.ts` (his lines).
 */

export const SPECIALS: readonly string[] = [
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
];

export const STRIDE = 17;

const AARHUS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Copenhagen",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Aarhus's date at `at`, as days since 1970-01-01. */
export const aarhusDay = (at: Date): number =>
  Math.round(Date.parse(`${AARHUS.format(at)}T00:00:00Z`) / 86_400_000);

/** The special on Aarhus's date at `at`. */
export const specialOn = (at: Date): string => SPECIALS[(aarhusDay(at) * STRIDE) % SPECIALS.length]!;

export const TUNES = [
  { id: "polka", name: "Merge Conflict Polka", emoji: "🪗" },
  { id: "green", name: "Green CI", emoji: "✅" },
  { id: "rain", name: "Rainy Deploy", emoji: "🌧" },
  { id: "standup", name: "Standup Shuffle", emoji: "☕" },
  { id: "hotfix", name: "3am Hotfix", emoji: "🔥" },
  { id: "lockfile", name: "Lockfile Lullaby", emoji: "🌙" },
] as const;

/** Plaque rows: the left plaque holds ranks 1-3, the right one 4-5. */
export const LEFT_PLATES = 3;
export const REGULARS_TOP = 5;

/** The bar tab's rows as `[NAME, HOURS]` (`tabLine`), best first. */
export type TabRow = [string, string];
