import { describe, expect, test } from "bun:test";
import { awardStep, awardSweep, backfillDone, backfillStep, collectionOf } from "../src/town/awards.ts";
import { hallOfFame } from "../src/town/hall.ts";
import { migrate } from "../src/town/schema.ts";
import { memorySql } from "./memory-sql.ts";

const now = Date.parse("2026-10-21T12:00:00Z");
const kept = { top: [], raids: [] };

async function town(names: string[]) {
  const { db, sql } = memorySql();
  await migrate(sql);
  for (const [i, name] of names.entries())
    db.run("INSERT INTO users (id, name, look, created_at) VALUES (?, ?, '{}', 0)", [i + 1, name]);
  /** Sets someone's PR count: all on one day. */
  const prs = (id: number, n: number) =>
    db.run(
      `INSERT OR REPLACE INTO activity_daily (user_id, day, prompts, prs, agent_buckets, active_buckets, peak_agents)
       VALUES (?, '2026-10-01', 0, ?, 0, 0, 0)`,
      [id, n],
    );
  const awards = (id: number) =>
    db
      .query("SELECT badge, tier, backfill FROM badge_awards WHERE user_id = ? ORDER BY badge, tier")
      .all(id) as { badge: string; tier: number; backfill: number }[];
  return { db, sql, prs, awards };
}

describe("awardSweep", () => {
  test("is idempotent, and announces gold but not bronze or silver", async () => {
    const { sql, prs, awards } = await town(["ada"]);
    prs(1, 10);
    // The first look is silent whatever it finds: a new account syncing its history.
    expect(await awardSweep(sql, 1, now, kept)).toEqual([
      { userId: 1, badge: "shipper", tier: 1, announce: null },
    ]);
    expect(await awardSweep(sql, 1, now, kept)).toEqual([]);
    prs(1, 250);
    const fresh = await awardSweep(sql, 1, now + 1, kept);
    expect(fresh.map((a) => [a.badge, a.tier, a.announce])).toEqual([
      ["shipper", 2, null],
      ["shipper", 3, "🏅 ada earned Shipper gold: 250 PRs"],
    ]);
    expect(await awardSweep(sql, 1, now + 2, kept)).toEqual([]);
    expect(awards(1)).toEqual([
      { badge: "shipper", tier: 1, backfill: 1 },
      { badge: "shipper", tier: 2, backfill: 0 },
      { badge: "shipper", tier: 3, backfill: 0 },
    ]);
  });

  test("someone's first look is silent, even for gold", async () => {
    const { sql, prs } = await town(["ada"]);
    prs(1, 1000);
    const fresh = await awardSweep(sql, 1, now, kept);
    expect(fresh.map((a) => a.tier)).toEqual([1, 2, 3, 4]);
    expect(fresh.every((a) => a.announce === null)).toBe(true);
  });

  test("a milestone level of 30 or more is announced, an earlier one isn't", async () => {
    const { db, sql, awards } = await town(["ada"]);
    // Something already recorded, so this isn't their first look.
    db.run("INSERT INTO badge_awards VALUES (1, 'shipper', 1, 0, 1)");
    // Level 30 needs this many tokens in all: far past level 20's.
    const { levelAt } = await import("@tokenmaxxing/core/format.ts");
    db.run(
      "INSERT INTO usage_daily (user_id, day, model, input, output, cache_creation, cache_read, turns) VALUES (1, '2026-10-01', 'm', ?, 0, 0, 0, 1)",
      [levelAt(30)],
    );
    const fresh = await awardSweep(sql, 1, now, kept);
    const levels = fresh.filter((a) => a.badge === "level");
    expect(levels.map((a) => [a.tier, a.announce])).toEqual([
      [10, null],
      [20, null],
      [30, "🏅 ada reached level 30: Orbkeeper"],
    ]);
    expect(awards(1).filter((r) => r.badge === "level")).toHaveLength(3);
  });
});

describe("the backfill and the sweep step", () => {
  test("backfills in chunks, silently, then marks it done", async () => {
    const { sql, prs, awards } = await town(["ada", "bo", "cy"]);
    for (const id of [1, 2, 3]) prs(id, 300);
    expect(await backfillDone(sql)).toBe(false);
    expect(await backfillStep(sql, now, kept, 2)).toBe(false);
    expect(awards(3)).toEqual([]);
    expect(await backfillStep(sql, now, kept, 2)).toBe(true);
    expect(await backfillDone(sql)).toBe(true);
    for (const id of [1, 2, 3]) expect(awards(id).map((r) => r.backfill)).toEqual([1, 1, 1]);
    // Done stays done, and nothing is written twice.
    expect(await backfillStep(sql, now, kept, 2)).toBe(true);
  });

  test("the step backfills first, leaving the dirty set, then drains it throttled", async () => {
    const { sql, prs, awards } = await town(["ada", "bo"]);
    prs(1, 10);
    prs(2, 10);
    const dirty = new Set([1]);
    const swept = new Map<number, number>();
    expect(await awardStep(sql, dirty, swept, now, kept)).toEqual({ awards: [], backfilled: true });
    expect([...dirty]).toEqual([1]);
    expect(awards(1).map((r) => r.backfill)).toEqual([1]);
    // Backfill done (two users, chunk 100): the second pass for tiers added since, silent too, and then the dirty set.
    prs(1, 300);
    expect(await awardStep(sql, dirty, swept, now + 1, kept)).toEqual({ awards: [], backfilled: true });
    expect([...dirty]).toEqual([1]);
    expect(awards(1).map((r) => [r.tier, r.backfill])).toEqual([
      [1, 1],
      [2, 1],
      [3, 1],
    ]);
    // Both passes done: a tier reached after them is a fresh award, and a diamond is told to the town.
    prs(1, 1000);
    const step = await awardStep(sql, dirty, swept, now + 2, kept);
    expect(step.backfilled).toBe(false);
    expect(step.awards.map((a) => [a.badge, a.tier, a.announce])).toEqual([
      ["shipper", 4, "🏅 ada earned Shipper diamond: 1000 PRs"],
    ]);
    expect([...dirty]).toEqual([]);
    // Dirty again straight away: it waits for the throttle.
    dirty.add(1);
    expect((await awardStep(sql, dirty, swept, now + 2, kept)).awards).toEqual([]);
    expect([...dirty]).toEqual([1]);
    expect((await awardStep(sql, dirty, swept, now + 6 * 60_000, kept)).awards).toEqual([]);
    expect([...dirty]).toEqual([]);
  });
});

test("the collection log: every badge's standing, and when a tier really came", async () => {
  const { sql, prs } = await town(["ada"]);
  prs(1, 10);
  await awardSweep(sql, 1, now, kept, { backfill: true });
  prs(1, 60);
  await awardSweep(sql, 1, now + 5, kept);
  const state = await collectionOf(sql, 1, now, kept, [{ id: "3am", day: "2026-07-01" }]);
  const shipper = state.badges.find((b) => b.id === "shipper")!;
  expect(shipper).toEqual({ id: "shipper", tier: 2, value: 60, at: now + 5 });
  // Not earned: still listed, with its value.
  expect(state.badges.find((b) => b.id === "whale")).toEqual({ id: "whale", tier: 0, value: 0, at: null });
  expect(state.badges).toHaveLength((await import("@tokenmaxxing/core/badges.ts")).BADGES.length);
  expect(state.trophies).toEqual([{ id: "3am", day: "2026-07-01" }]);
  expect(state.titles).toEqual([]);
});

describe("the Hall of Fame", () => {
  test("shows nothing until the backfill is done", async () => {
    const { sql } = await town(["ada"]);
    expect(await hallOfFame(sql, now, [])).toMatchObject({
      ready: false,
      rarest: [],
      firsts: [],
      winners: [],
    });
  });

  test("rarest honours, this week's firsts and the winners", async () => {
    const { db, sql, prs } = await town(["ada", "bo", "cy"]);
    // Bo and Cy had gold before (backfilled); Ada earns diamond for real, the first in town.
    prs(2, 300);
    prs(3, 300);
    await backfillStep(sql, now - 10_000, kept);
    prs(1, 10);
    await awardSweep(sql, 1, now, kept);
    prs(1, 1000);
    await awardSweep(sql, 1, now + 1, kept);
    // Games this week: bo won 40 net in dice, cy 10.
    const play = (match: number, user: number, game: string, won: number) =>
      db.run("INSERT INTO match_players VALUES (?, ?, ?, 1, 10, ?, 20, '2026-10-20', 0)", [
        match,
        user,
        game,
        won,
      ]);
    play(1, 2, "dice", 50);
    play(2, 3, "dice", 20);
    play(3, 3, "spr", 5);
    // Not this week.
    db.run("INSERT INTO match_players VALUES (4, 1, 'dice', 1, 10, 900, 20, '2026-10-10', 0)");

    const hall = await hallOfFame(sql, now + 2, []);
    expect(hall.ready).toBe(true);
    expect(hall.week).toBe("2026-10-19");
    // Diamond has one holder: rarest first; gold (two backfilled and Ada's own) after it.
    expect(hall.rarest[0]).toMatchObject({ badge: "shipper", tier: 4, holders: 1, of: 3 });
    expect(hall.rarest[0]!.who.map((w) => [w.name, w.at])).toEqual([["ada", now + 1]]);
    expect(hall.rarest[1]).toMatchObject({ badge: "shipper", tier: 3, holders: 3 });
    // Backfilled holders have no date.
    expect(hall.rarest[1]!.who.find((w) => w.name === "bo")!.at).toBeNull();
    expect(hall.firsts.map((f) => [f.name, f.text])).toEqual([
      ["ada", "First to earn Shipper diamond: 1000 PRs"],
    ]);
    // Only winners in the black: cy's spr game cost more than it paid, and the old dice game is last week's.
    expect(hall.winners.map((w) => [w.kind, w.game, w.name, w.value])).toEqual([["game", "dice", "bo", 40]]);
  });
});
