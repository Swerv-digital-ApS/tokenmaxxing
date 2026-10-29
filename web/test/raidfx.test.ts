import { expect, test } from "bun:test";
import { bossAt } from "@tokenmaxxing/core/raid.ts";
import type { Raid } from "@tokenmaxxing/server/registry";
import {
  arc,
  beamWidth,
  CAPS,
  fireRate,
  gateState,
  gateText,
  hpLeft,
  minionRate,
  minionsOf,
  owedShots,
  peopleShown,
  petRate,
  raidEvents,
  raiderRate,
  resting,
  SPUTTER,
  weekOverText,
} from "../src/render3d/dungeon/raidfx.ts";

const raid = (o: Partial<Raid> = {}): Raid =>
  ({
    prelaunch: false,
    launchAt: Date.UTC(2026, 9, 19, 6),
    week: "2026-10-19",
    closed: false,
    boss: bossAt(1),
    hp: 2e9,
    damage: 5e8,
    kills: [],
    totalDamage: 5e8,
    me: { damage: 1e7, rank: 3, weekCoins: 0, coins: 0 },
    rules: { opensHour: 8 },
    ...o,
  }) as Raid;

test("a laptop fires as fast as it burns: 1 a second at 100k a minute, 6 at most, a sputter when quiet", () => {
  expect(fireRate(0)).toBe(0);
  expect(fireRate(1e5)).toBeCloseTo(1);
  expect(fireRate(1e6)).toBeCloseTo(Math.sqrt(10));
  expect(fireRate(1e12)).toBe(6);
  expect(raiderRate(0, false)).toBe(SPUTTER);
  expect(raiderRate(1e6, false)).toBeGreaterThan(3);
  // A week that is over, or not begun, fires nothing.
  expect(raiderRate(1e6, true)).toBe(0);
});

test("a minion fires a third as fast as its raider, and sputters when its raider does", () => {
  expect(minionRate(1e6, 3)).toBeCloseTo(1);
  expect(minionRate(1e5, 0.6)).toBe(0.25);
  expect(minionRate(1e5, 1)).toBeCloseTo(1 / 3);
  expect(minionRate(0, SPUTTER)).toBeCloseTo(SPUTTER / 2);
  expect(minionRate(1e6, 0)).toBe(0);
});

test("a pet fires a quarter as fast as its raider, at least once every five seconds, and sputters when its raider does", () => {
  expect(petRate(1e6, 4)).toBeCloseTo(1);
  expect(petRate(1e5, 0.6)).toBe(0.2);
  expect(petRate(0, SPUTTER)).toBeCloseTo(SPUTTER / 2);
  expect(petRate(1e6, 0)).toBe(0);
});

test("nobody fires before the gate opens, after the week ends, or once the whole ladder has fallen", () => {
  expect(resting(raid())).toBe(false);
  expect(resting(raid({ closed: true }))).toBe(true);
  expect(resting(raid({ prelaunch: true }))).toBe(true);
  expect(resting(raid({ cleared: true }))).toBe(true);
  expect(weekOverText(raid({ cleared: true, kills: [{}] as Raid["kills"] }))).toBe(
    "🏁 Ladder cleared · 1 fell · opens 08:00 Mon",
  );
});

test("slow rates still fire now and then: the owed fraction is carried", () => {
  let owed = 0;
  let shots = 0;
  for (let i = 0; i < 100; i++) {
    const r = owedShots(owed, 0.5, 100);
    owed = r.owed;
    shots += r.shots;
  }
  // Ten seconds at half a shot a second.
  expect(shots).toBe(5);
  expect(owedShots(0.9, 2, 100)).toEqual({ owed: expect.closeTo(0.1, 5), shots: 1 });
  expect(owedShots(0.3, 0, 1000)).toEqual({ owed: 0.3, shots: 0 });
});

test("a poll's hits, a kill and the launch are told from the two raids either side of it", () => {
  const before = raid();
  expect(
    raidEvents(before, raid({ totalDamage: 8e8, me: { damage: 4e7, rank: 3, weekCoins: 0, coins: 0 } })),
  ).toEqual({ launch: false, kill: null, hit: 3e8, mine: 3e7 });
  // A kill: the boss that fell, and the damage since.
  const fell = { rung: 1, boss: bossAt(1), day: "2026-10-20", coins: 10, raiders: 3, paid: true };
  const killed = raid({ boss: bossAt(2), kills: [fell], totalDamage: 2.5e9, damage: 5e8 });
  expect(raidEvents(before, killed)).toMatchObject({ kill: bossAt(1), hit: 2e9 });
  // Nothing new, nothing shown.
  expect(raidEvents(before, before)).toEqual({ launch: false, kill: null, hit: 0, mine: 0 });
  // A new week replays nothing; the launch does.
  expect(raidEvents(before, raid({ week: "2026-10-26", totalDamage: 9e9 }))).toEqual({
    launch: false,
    kill: null,
    hit: 0,
    mine: 0,
  });
  expect(raidEvents(raid({ prelaunch: true }), raid())).toEqual({
    launch: true,
    kill: null,
    hit: 0,
    mine: 0,
  });
  expect(raidEvents(null, raid())).toEqual({ launch: false, kill: null, hit: 0, mine: 0 });
  // A viewer who isn't in the raid has no hits of their own.
  expect(raidEvents(raid({ me: null }), raid({ me: null, totalDamage: 6e8 })).mine).toBe(0);
});

test("the HP left never goes below nothing", () => {
  expect(hpLeft({ hp: 100, damage: 30 })).toBe(70);
  expect(hpLeft({ hp: 100, damage: 130 })).toBe(0);
});

test("minions: the first agent is the raider, the rest are drawn up to the cap", () => {
  expect(minionsOf(1, 4)).toBe(0);
  expect(minionsOf(3, 4)).toBe(2);
  expect(minionsOf(30, 4)).toBe(4);
  expect(minionsOf(0, 4)).toBe(0);
});

test("a crowded room draws its busiest raiders as people, the rest keep their laptops", () => {
  const crowd = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, burn: (i % 10) * 1e5 }));
  const shown = peopleShown(crowd, CAPS.lean.people);
  expect(shown).toHaveLength(CAPS.lean.people);
  expect(Math.min(...shown.map((p) => p.burn))).toBeGreaterThanOrEqual(4e5);
  expect(peopleShown(crowd.slice(0, 5), CAPS.lean.people)).toHaveLength(5);
  // Medium draws strictly less than High.
  expect(CAPS.lean.people).toBeLessThan(CAPS.full.people);
  expect(CAPS.lean.minionsTotal).toBeLessThan(CAPS.full.minionsTotal);
  expect(CAPS.lean.missiles).toBeLessThan(CAPS.full.missiles);
});

test("the gate: boarded before the first raid, shut between weeks, otherwise open", () => {
  expect(gateState(null)).toBe("open");
  expect(gateState(raid())).toBe("open");
  expect(gateState(raid({ closed: true }))).toBe("shut");
  expect(gateState(raid({ prelaunch: true, closed: true }))).toBe("boarded");
});

test("the words over the gate are the 2D game's", () => {
  expect(gateText(null)).toBeNull();
  const open = gateText(raid({ hp: 2e9, damage: 5e8 }));
  expect(open).toBe("⚔️ Raid Dungeon · ⏳ The Rate Limit · rung 1 · 75%");
  expect(gateText(raid({ closed: true }))).toBe("⚔️ Raid Dungeon · shut · opens 08:00");
  const launchAt = Date.now() + 3_600_000;
  expect(gateText(raid({ prelaunch: true, launchAt }))).toStartWith("⚠️ Something is coming… ");
  expect(gateText(raid({ prelaunch: true, launchAt: Date.now() - 1000 }))).toBe("⚔️ The gate is opening…");
});

test("a closed week says how many fell and when it opens", () => {
  expect(weekOverText(raid())).toBeNull();
  expect(weekOverText(raid({ closed: true, kills: [{}, {}] as Raid["kills"] }))).toBe(
    "🏁 Week over · 2 fell · opens 08:00 Mon",
  );
});

test("a missile's arc starts and ends where it should and rises between", () => {
  expect(arc(0, 5, 10, 0)).toBe(0);
  expect(arc(0, 5, 10, 1)).toBe(10);
  expect(arc(0, 20, 0, 0.5)).toBe(10);
  expect(beamWidth(3)).toBeGreaterThan(beamWidth(0));
});
