import { expect, test } from "bun:test";
import {
  killDrops,
  LAP_BONUS,
  LAP_CAP,
  LOOT,
  LOOT_ODDS_FROM,
  lapBonus,
  lootById,
  lootOdds,
  lootOf,
  lootRoll,
  OLD_ODDS,
  oddsText,
  RARITIES,
  raidDrops,
  TROPHIES,
} from "../src/loot.ts";
import { LEGEND } from "../src/maps.ts";
import { PIECES, pieceOf } from "../src/office.ts";
import { BOSSES, bossAt, type RaidWeek } from "../src/raid.ts";
import { ITEMS, isTradeable, itemById, parseSide } from "../src/shop.ts";
import { LOOK_OPTIONS } from "../src/world.ts";

test("every boss has its own table: four items, one of each rarity, commonest first", () => {
  for (const b of BOSSES) {
    const table = lootOf(b.id);
    expect(table.map((l) => l.rarity)).toEqual(["common", "rare", "epic", "legendary"]);
  }
  expect(LOOT).toHaveLength(BOSSES.length * 4);
  expect(new Set(LOOT.map((l) => l.id)).size).toBe(LOOT.length);
  expect(lootOf("rate-limit").map((l) => l.name)).toEqual([
    "Hourglass hat",
    "429 shades",
    "Sand golem",
    "Golden Hourglass",
  ]);
});

test("loot is in the catalogue: wearable or placeable, never sold, tradeable", () => {
  for (const l of LOOT) {
    const item = itemById(l.id)!;
    expect(item).toMatchObject({ slot: l.slot, index: l.index, name: l.name, price: 0, tradeable: true });
    expect(item.loot).toEqual({ boss: l.boss, rarity: l.rarity });
    expect(item.level).toBeUndefined();
    if (l.slot === "furniture") {
      // A trophy is a piece of furniture like any other: in `PIECES`, on the map legend.
      expect(PIECES[l.index]?.ch).toBe(l.id.slice(5));
      expect(pieceOf(l.id.slice(5))?.name).toBe(l.name);
      expect(LEGEND[l.id.slice(5)]).toBeDefined();
    } else expect(l.index).toBeLessThan(LOOK_OPTIONS[l.slot]);
  }
  // No two items wear the same slot index.
  const worn = ITEMS.map((i) => i.id);
  expect(new Set(worn).size).toBe(worn.length);
  expect(TROPHIES.map((t) => t.name)).toEqual(["Golden Hourglass", "Golden Rebase"]);
  expect(isTradeable("furn.Y")).toBe(true);
  expect(parseSide({ coins: 0, items: ["hat.8", "furn.Y"] })).toEqual({
    coins: 0,
    items: ["hat.8", "furn.Y"],
  });
});

test("rolls are fixed: the same week, rung, raider and item always roll the same", () => {
  const a = lootRoll("2026-10-19", 1, 7, "hat.5");
  expect(lootRoll("2026-10-19", 1, 7, "hat.5")).toBe(a);
  expect(a).toBeGreaterThanOrEqual(0);
  expect(a).toBeLessThan(1);
  // Anything else is a different roll.
  const others = [
    lootRoll("2026-10-26", 1, 7, "hat.5"),
    lootRoll("2026-10-19", 2, 7, "hat.5"),
    lootRoll("2026-10-19", 1, 8, "hat.5"),
    lootRoll("2026-10-19", 1, 7, "glasses.4"),
  ];
  expect(new Set([a, ...others]).size).toBe(5);
});

test("over many raiders, each rarity drops about as often as its odds", () => {
  // One set of rolls, read against every rarity's odds, with 5 standard deviations of slack.
  const n = 100_000;
  const rolls = Array.from({ length: n }, (_, u) => lootRoll("2026-10-19", 3, u, "odds"));
  for (const rarity of ["common", "rare", "epic", "legendary"] as const) {
    const odds = RARITIES[rarity].odds;
    const hits = rolls.filter((r) => r < odds).length;
    const sd = Math.sqrt(n * odds * (1 - odds));
    expect(Math.abs(hits - n * odds)).toBeLessThan(5 * sd);
  }
});

test("odds: 40%, 20%, 10% and 2%, ×1.05 a lap round the ladder, at most ×10", () => {
  expect(["common", "rare", "epic", "legendary"].map((r) => oddsText(lootOdds(r as "rare", 1)))).toEqual([
    "40%",
    "20%",
    "10%",
    "2%",
  ]);
  expect(LAP_BONUS).toBe(1.05);
  expect(LAP_CAP).toBe(10);
  expect([1, 2, 3].map(lapBonus)).toEqual([1, 1.05, 1.05 ** 2]);
  expect(lapBonus(4)).toBeCloseTo(1.157625, 6);
  // 48 laps in, ×1.05 a lap passes ×10, and it stops there: a 2% legendary is never above 20%.
  expect(lapBonus(48)).toBeLessThan(LAP_CAP);
  expect(lapBonus(49)).toBe(LAP_CAP);
  expect(lapBonus(500)).toBe(LAP_CAP);
  expect(lootOdds("legendary", 500)).toBeCloseTo(0.2, 8);
  // "II" is the level after the first.
  expect(lootOdds("legendary", bossAt(1, 2).level)).toBeCloseTo(0.021, 8);
  expect(lootOdds("rare", 2)).toBeCloseTo(0.21, 8);
  // The dev boost, and never past certain.
  expect(lootOdds("epic", 1, 100)).toBe(1);
  expect(lootOdds("legendary", 1, 10)).toBeCloseTo(0.2, 8);
  // A common is certain from lap 20: ×1.05 a lap takes 40% past 100%.
  expect(lootOdds("common", 20)).toBe(1);
});

test("weeks before LOOT_ODDS_FROM keep the old odds, so raising them hands out nothing for old kills", () => {
  const before = "2026-10-19";
  expect(before < LOOT_ODDS_FROM).toBe(true);
  expect(oddsText(lootOdds("common", 1, 1, before))).toBe("10%");
  expect(oddsText(lootOdds("legendary", 1, 1, before))).toBe("0.1%");
  expect(oddsText(lootOdds("common", 1, 1, LOOT_ODDS_FROM))).toBe("40%");
  // The same kill rolled under both: nothing the old odds gave is lost, and old weeks give no more than before.
  const kill = {
    rung: 2,
    level: 1,
    day: "2026-10-21",
    raiders: Array.from({ length: 300 }, (_, i) => i + 1),
  };
  const old = killDrops(before, kill, 1);
  for (const d of old)
    expect(lootRoll(before, 2, d.userId, d.item)).toBeLessThan(OLD_ODDS[lootById(d.item)!.rarity]);
});

test("a kill's drops: only its raiders roll, each item on its own, from that boss's table", () => {
  const kill = { rung: 2, level: 1, day: "2026-10-21", raiders: [1, 2, 3] };
  const all = killDrops("2026-10-19", kill, 1000);
  // Certain odds: every raider gets the whole Context Window table.
  expect(all).toHaveLength(12);
  expect(new Set(all.map((d) => d.userId))).toEqual(new Set([1, 2, 3]));
  expect(new Set(all.map((d) => d.item))).toEqual(new Set(lootOf("context-window").map((l) => l.id)));
  // Real odds: exactly the rolls that came in under them.
  const raiders = Array.from({ length: 500 }, (_, i) => i + 1);
  const real = killDrops("2026-10-19", { ...kill, raiders }, 1);
  for (const d of real) expect(lootRoll("2026-10-19", 2, d.userId, d.item)).toBeLessThan(d.odds);
  expect(real.length).toBe(
    raiders.reduce(
      (n, u) =>
        n +
        lootOf("context-window").filter(
          (l) => lootRoll("2026-10-19", 2, u, l.id) < lootOdds(l.rarity, 1, 1, "2026-10-19"),
        ).length,
      0,
    ),
  );
  // Several for one person can happen: rolls are independent.
  expect(real.length).toBeGreaterThan(0);
});

test("a week's drops follow its kills, and the same weeks give the same drops", () => {
  const week = (w: string, rungs: number[]): RaidWeek => ({
    week: w,
    level: 1,
    hp: 1,
    damage: 0,
    cleared: false,
    kills: rungs.map((rung) => ({ rung, boss: bossAt(rung), day: w, coins: 20, raiders: [1, 2] })),
    current: { boss: bossAt(rungs.length + 1), hp: 1, damage: 0 },
    raiders: [],
  });
  const weeks = [week("2026-10-19", [1, 2]), week("2026-10-26", [])];
  const drops = raidDrops(weeks, 1000);
  expect(drops).toHaveLength(2 * 2 * 4);
  expect(drops.every((d) => d.week === "2026-10-19")).toBe(true);
  expect(raidDrops(weeks, 3)).toEqual(raidDrops(weeks, 3));
});
