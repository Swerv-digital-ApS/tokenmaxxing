import { expect, test } from "bun:test";
import {
  biting,
  catchLine,
  FISH,
  fishingPhase,
  fishingWater,
  hasRecord,
  isSpecimen,
  journalFacts,
  lengthOf,
  medalOf,
  newCast,
  type PondTime,
  pondAt,
  pondTime,
  rollCatch,
} from "../src/fishing.ts";
import {
  FISHING_BASE,
  FISHING_ITEMS,
  LUCKY_CASTS,
  rollTreasure,
  TREASURE_TIERS,
} from "../src/fishing-loot.ts";
import { MAPS } from "../src/maps.ts";
import { itemById } from "../src/shop.ts";
import { parseLook } from "../src/world.ts";

const NOON: PondTime = { minute: 12 * 60, weekday: 2, weather: "clear" };

test("only a walkable bank facing town water can cast", () => {
  expect(fishingWater(MAPS.town, 2, 12, "right")).toEqual([3, 12]);
  expect(fishingWater(MAPS.town, 2, 12, "left")).toBeNull();
  expect(fishingWater(MAPS.town, 3, 12, "right")).toBeNull();
  expect(fishingWater(MAPS.inn, 2, 13, "right")).toBeNull();
});

test("a bite has a bounded waiting period and an exact reel window", () => {
  const cast = newCast(2, 13, [3, 13], 1000, () => 0);
  expect(cast.biteAt).toBe(3500);
  expect(fishingPhase(cast, 3499)).toBe("waiting");
  expect(fishingPhase(cast, 3500)).toBe("bite");
  expect(fishingPhase(cast, cast.endsAt - 1)).toBe("bite");
  expect(fishingPhase(cast, cast.endsAt)).toBe("missed");
  expect(newCast(2, 13, [3, 13], 1000, () => 0.99999).biteAt).toBeLessThan(7000);
});

test("ids are unique and the fish that always bite share exactly 100", () => {
  expect(new Set(FISH.map((f) => f.id)).size).toBe(FISH.length);
  expect(FISH.filter((f) => !f.when).reduce((n, f) => n + f.weight, 0)).toBeCloseTo(100, 9);
  for (const f of FISH) expect(f.min).toBeLessThanOrEqual(f.max);
  // The pond's originals keep their ids: they're in journals.
  expect(FISH.slice(0, 6).map((f) => f.id)).toEqual(["perch", "carp", "tench", "pike", "duck", "golden"]);
});

test("every fish biting at noon is reachable at its weight with lengths in range", () => {
  const pool = pondAt(NOON);
  expect(pool.every((f) => !f.when)).toBe(true);
  let weight = 0;
  for (const fish of pool) {
    let draws = 0;
    const caught = rollCatch(NOON, () => (draws++ === 0 ? (weight + fish.weight / 2) / 100 : 0.99999));
    expect(caught).toEqual({ fish: fish.id, cm: fish.max });
    weight += fish.weight;
  }
  expect(rollCatch(NOON, () => 0)).toEqual({ fish: "perch", cm: 12 });
});

test("the time-gated fish bite only in their windows", () => {
  const at = (minute: number, weekday = 2, weather: PondTime["weather"] = "clear"): PondTime => ({
    minute,
    weekday,
    weather,
  });
  expect(biting("leet", at(13 * 60 + 37))).toBe(true);
  expect(biting("leet", at(13 * 60 + 38))).toBe(false);
  expect(biting("notfound", at(4 * 60 + 4))).toBe(true);
  expect(biting("notfound", at(16 * 60 + 4))).toBe(false);
  expect(biting("midnight", at(30))).toBe(true);
  expect(biting("midnight", at(60))).toBe(false);
  expect(biting("friday", at(16 * 60, 5))).toBe(true);
  expect(biting("friday", at(15 * 60 + 59, 5))).toBe(false);
  expect(biting("friday", at(17 * 60, 4))).toBe(false);
  expect(biting("rain", at(600, 2, "drizzle"))).toBe(true);
  expect(biting("rain", at(600, 2, "snow"))).toBe(false);
  // At 13:37 the bass is a third of the pond.
  const leet = pondAt(at(13 * 60 + 37));
  expect(leet.map((f) => f.id)).toContain("leet");
  expect(leet.find((f) => f.id === "leet")!.weight / leet.reduce((n, f) => n + f.weight, 0)).toBeCloseTo(
    1 / 3,
    9,
  );
  // Every gated fish has a hint, and a gated fish never bites at noon on a dry Tuesday.
  for (const f of FISH.filter((f) => f.when)) expect(f.hint).toBeTruthy();
});

test("pondTime reads the Copenhagen clock: 12:37 UTC on Friday 30 October is 13:37 there", () => {
  const ms = Date.UTC(2026, 9, 30, 12, 37, 20);
  expect(pondTime(ms, "rain")).toEqual({ minute: 13 * 60 + 37, weekday: 5, weather: "rain" });
});

test("lengths read with their quirks, and the answer gets its own line", () => {
  expect(lengthOf({ fish: "perch", cm: 20 })).toBe("20 cm");
  expect(lengthOf({ fish: "float", cm: 30 })).toBe("30.000000000000004 cm");
  expect(lengthOf({ fish: "offbyone", cm: 21 })).toBe("21 cm (±1)");
  expect(lengthOf({ fish: "notfound", cm: 0 })).toBe("404 cm not found");
  expect(catchLine({ fish: "carp", cm: 42 })).toContain("42 cm");
  expect(catchLine({ fish: "duck", cm: 8 }, () => 0)).toStartWith("Quack.");
  expect(catchLine({ fish: "carp", cm: 41 })).toContain("journal");
});

test("medals, specimens and records", () => {
  expect(medalOf(0)).toBeNull();
  expect(medalOf(1)).toBe("bronze");
  expect(medalOf(10)).toBe("silver");
  expect(medalOf(49)).toBe("silver");
  expect(medalOf(50)).toBe("gold");
  expect(isSpecimen({ fish: "perch", cm: 32 })).toBe(true);
  expect(isSpecimen({ fish: "perch", cm: 31 })).toBe(false);
  // One-size fish are always at their longest: they count for neither.
  expect(isSpecimen({ fish: "float", cm: 30 })).toBe(false);
  expect(hasRecord("float")).toBe(false);
  expect(hasRecord("notfound")).toBe(false);
  expect(hasRecord("kraken")).toBe(true);
  expect(
    journalFacts([
      { fish: "perch", count: 50, cm: 32 },
      { fish: "carp", count: 3, cm: 21 },
      { fish: "gone", count: 2, cm: 1 },
    ]),
  ).toEqual({ caught: 55, species: 2, specimens: 1, golds: 1 });
});

test("pond treasures are wearable items at their own indices, never sold", () => {
  expect(FISHING_ITEMS.length).toBeGreaterThan(0);
  for (const t of FISHING_ITEMS) {
    expect(t.index).toBeGreaterThanOrEqual(FISHING_BASE);
    expect(t.index).toBeLessThan(FISHING_BASE + 100);
    expect(itemById(t.id)).toBe(t);
    expect(t.tradeable).toBe(true);
    expect(t.case).toBe(true);
  }
  // Every tier with odds has something in it.
  for (const tier of Object.keys(TREASURE_TIERS))
    expect(FISHING_ITEMS.some((i) => i.rarity === tier)).toBe(true);
  const kraken = FISHING_ITEMS.find((i) => i.name === "Pocket kraken")!;
  const look = parseLook({ style: 0, outfit: 0, glasses: 0, hat: 0, pet: kraken.index, skin: 0, hair: 0 });
  expect(look?.pet).toBe(kraken.index);
  const bubbles = FISHING_ITEMS.find((i) => i.slot === "aura")!;
  expect(parseLook({ ...look, aura: bubbles.index })?.aura).toBe(bubbles.index);
});

test("a treasure is a 1% roll, only on lucky casts, legendary a tenth of those", () => {
  const seq = (...xs: number[]) => {
    let i = 0;
    return () => xs[i++] ?? 0;
  };
  expect(LUCKY_CASTS).toBeGreaterThan(0);
  expect(rollTreasure(false, () => 0)).toBeNull();
  expect(rollTreasure(true, seq(0.01))).toBeNull();
  expect(rollTreasure(true, seq(0.0099, 0, 0))?.rarity).toBe("rare");
  expect(rollTreasure(true, seq(0.005, 0.65, 0))?.rarity).toBe("epic");
  expect(rollTreasure(true, seq(0.005, 0.95, 0))?.rarity).toBe("legendary");
  // A draw on one already held is drawn again, once.
  const rares = FISHING_ITEMS.filter((i) => i.rarity === "rare");
  const again = rollTreasure(true, seq(0, 0, 0, 0.99), new Set([rares[0]!.id]));
  expect(again).toBe(rares.at(-1)!);
});
