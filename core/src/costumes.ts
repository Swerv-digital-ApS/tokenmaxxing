/**
 * Holiday costumes: hats the Clothes shop sells only round their holiday (`holidays.ts`), from `ON_SALE.before`
 * days before it to `ON_SALE.after` days after, and that anyone who bought one wears (or trades) all year. One
 * that is `earned` is never sold: the holiday hands it out (the kattekonge's crown, `fastelavn.ts`).
 * Their look indices start at `COSTUME_BASE`, past the merchant's editions, so the shop, the raid's loot and the
 * editions can all grow without meeting them. The 2D art is in `web/src/art/editions.ts`, keyed by id; the 3D
 * hat is `HAT_BUILDERS` by name (`gear3dHead.ts`).
 */
import { HOLIDAYS, type HolidayId, near } from "./holidays.ts";
import type { Item } from "./shop.ts";

/** Look indices from here up, in the hat slot, are holiday costumes. */
export const COSTUME_BASE = 200;

/** On the shelf from this many days before its holiday to this many after. */
export const ON_SALE = { before: 14, after: 2 } as const;

export interface Costume extends Item {
  slot: "hat";
  holiday: HolidayId;
  blurb: string;
}

const costume = (n: number, name: string, price: number, holiday: HolidayId, blurb: string): Costume => ({
  id: `hat.${COSTUME_BASE + n}`,
  slot: "hat",
  index: COSTUME_BASE + n,
  name,
  price,
  tradeable: true,
  rarity: "rare",
  blurb,
  holiday,
});

/** Never reorder or reuse: the ids are in bags. Add new ones at the end. */
// A catalog reads best one costume a line.
// prettier-ignore
export const COSTUMES: readonly Costume[] = [
  costume(0, "Jack-o'-lantern", 350, "halloween", "Carved, lit and grinning. Smells faintly of candle."),
  // Never sold: it goes to whoever breaks the fastelavn barrel (`fastelavn.ts`), and stays theirs.
  { ...costume(1, "Kattekonge crown", 0, "fastelavn", "Broke the barrel, freed the cat. King for a year."), tradeable: false, rarity: "legendary", earned: "Break the fastelavn barrel" },
];

/** The costume a look index stands for in a slot, if it is one. */
export const costumeAt = (slot: string, index: number): Costume | undefined =>
  index >= COSTUME_BASE ? COSTUMES.find((c) => c.slot === slot && c.index === index) : undefined;

/** Whether the shop sells `item` at `ms`: always, unless it's a costume out of its season. */
export const onSale = (item: Pick<Item, "holiday">, ms: number): boolean =>
  !item.holiday || near(item.holiday, ms, ON_SALE.before, ON_SALE.after);

/** What the shop says to a costume out of season. */
export const offSeason = (holiday: HolidayId): string =>
  `That one is only sold round ${HOLIDAYS[holiday].name}.`;
