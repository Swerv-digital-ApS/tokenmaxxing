/**
 * December in town, all on the world's clock: the julekalender (one door a day, 1 to 24 December, each with
 * the same gift for everyone: coins or something to wear), julefrokost in the Tavern on Friday and Saturday
 * evenings up to Christmas, and snow over the whole town all month, whatever the real weather does. The
 * doors opened are the server's (`server/src/town/julekalender.ts`); everything else here needs no state.
 */

import { worldWall } from "./range.ts";
import type { Weather } from "./sky.ts";

// MARK: The julekalender

/**
 * A door's gift: coins, or an item into the bag, with its name (`shop.ts` is not imported here: `tavern.ts`
 * reads this file, and the shop's catalogue leads back to the maps, which read the Tavern).
 */
export type Gift = { coins: number } | { item: string; name: string };

/**
 * Door 1 to 24, in order. Mostly coins, more as Christmas comes, with something to wear behind the 6th, 13th
 * (Lucia), 20th and 24th. Never reorder: who opened what is kept by the date.
 */
// A calendar reads best one door a line.
// prettier-ignore
export const DOORS: readonly Gift[] = [
  { coins: 5 }, { coins: 6 }, { coins: 7 }, { coins: 8 }, { coins: 9 },
  { item: "glasses.6", name: "Hygge moustache" },
  { coins: 8 }, { coins: 9 }, { coins: 10 }, { coins: 11 }, { coins: 12 }, { coins: 12 },
  { item: "hat.7", name: "Danish flag cap" }, // for Lucia
  { coins: 12 }, { coins: 14 }, { coins: 15 }, { coins: 16 }, { coins: 18 }, { coins: 20 },
  { item: "hat.8", name: "Cykelhjelm" }, // for the ride home for Christmas
  { coins: 20 }, { coins: 22 }, { coins: 25 },
  { item: "hat.12", name: "Julehue" }, // on Juleaften
];

/** Today's door at `ms` (1 to 24), or null outside 1 to 24 December. */
export function doorOn(ms: number): number | null {
  const { m, d } = worldWall(ms);
  return m === 12 && d <= DOORS.length ? d : null;
}

/** The date door `n` belongs to in the December `ms` is in (the key a claim is kept under). */
export const doorDay = (n: number, ms: number): string =>
  `${worldWall(ms).y}-12-${String(n).padStart(2, "0")}`;

/** What a gift says, for the calendar and the notice: "🪙 12" or the item's name. */
export const giftLabel = (g: Gift): string => ("coins" in g ? `🪙 ${g.coins}` : g.name);

/** Whether the calendar is up: from 1 December to Christmas Eve. */
export const calendarOn = (ms: number): boolean => doorOn(ms) !== null;

// MARK: Julefrokost

/** Friday and Saturday evenings in December up to Christmas, from this hour to midnight. */
export const JULEFROKOST = { from: 18, until: 24 } as const;

/** What the tap serves at a julefrokost: one dish an evening, by the date. */
export const JULEFROKOST_MENU = [
  "🐟 Julefrokost: three kinds of sild, and a snaps for each",
  "🍖 Julefrokost: flæskesteg, with crackling that actually crackles",
  "🥩 Julefrokost: frikadeller, warm leverpostej and rødkål",
  "🍚 Julefrokost: risalamande. Whoever finds the almond gets the marzipan pig",
  "🍷 Julefrokost: gløgg and æbleskiver, powdered sugar everywhere",
  "🥚 Julefrokost: æg og rejer, piled higher than the context window",
] as const;

/** Whether the Tavern holds julefrokost at `ms`. */
export function julefrokostOn(ms: number): boolean {
  const { m, d, weekday, hour } = worldWall(ms);
  return m === 12 && d < 24 && (weekday === 5 || weekday === 6) && hour >= JULEFROKOST.from;
}

/** Tonight's dish: the menu walked by the day of the month. */
export const julefrokostDish = (ms: number): string =>
  JULEFROKOST_MENU[worldWall(ms).d % JULEFROKOST_MENU.length]!;

// MARK: Snow

/**
 * December's sky: snow over the whole town all month, whatever the real weather. A fall that's already
 * heavier stays as it is; fog, rain and dry days become a steady fall. The wind and the clouds stay real.
 */
export function decemberSnow(weather: Weather, ms: number): Weather {
  if (worldWall(ms).m !== 12) return weather;
  const intensity = weather.kind === "snow" ? Math.max(0.4, weather.intensity) : 0.4;
  return { ...weather, kind: "snow", intensity };
}
