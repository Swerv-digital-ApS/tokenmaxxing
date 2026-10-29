import { describe, expect, test } from "bun:test";
import { REGULAR_DAY_CAP } from "@tokenmaxxing/core/regulars.ts";
import { counts, TavernClock, VISIT_GAP_MS } from "../src/tavern-clock.ts";
import {
  addTavernMinutes,
  bioOf,
  habitsOf,
  migrateCard,
  minutesThisWeek,
  pinsOf,
  reportBio,
  setBio,
  setPins,
  tavernDaysOf,
  tavernSince,
  weeklyRegulars,
  writeActivity,
} from "../src/town/card.ts";
import { migrate } from "../src/town/schema.ts";
import { memorySql } from "./memory-sql.ts";

const now = Date.UTC(2026, 9, 22, 12);

async function town(names: string[] = ["ada", "bob", "cy"]) {
  const { db, sql } = memorySql();
  await migrate(sql);
  for (const [i, name] of names.entries())
    db.run("INSERT INTO users (id, name, look, created_at) VALUES (?, ?, '{}', 0)", [i + 1, name]);
  return { db, sql };
}

describe("the activity rollup's columns", () => {
  test("an existing activity_daily gains the habit columns, keeps its rows, and migrating twice is fine", async () => {
    const { db, sql } = memorySql();
    // The table as it was before card v2, with a day in it, and no `users` yet.
    db.run(`CREATE TABLE activity_daily (
      user_id INTEGER NOT NULL, day TEXT NOT NULL, prompts INTEGER NOT NULL, prs INTEGER NOT NULL,
      agent_buckets INTEGER NOT NULL, active_buckets INTEGER NOT NULL, peak_agents INTEGER NOT NULL,
      PRIMARY KEY (user_id, day)) WITHOUT ROWID`);
    db.run("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, look TEXT)");
    db.run("INSERT INTO activity_daily VALUES (1, '2026-10-01', 4, 2, 10, 5, 3)");
    await migrateCard(sql);
    await migrateCard(sql);
    expect(db.query("SELECT * FROM activity_daily").get()).toEqual({
      user_id: 1,
      day: "2026-10-01",
      prompts: 4,
      prs: 2,
      agent_buckets: 10,
      active_buckets: 5,
      peak_agents: 3,
      sessions: 0,
      sub_buckets: 0,
      hours: "",
      sources: "",
    });
  });

  test("the report's insert names its columns: old and new reports both land, a re-report replaces", async () => {
    const { db, sql } = await town();
    const base = { prompts: 1, prs: 0, agentBuckets: 2, activeBuckets: 1, peakAgents: 2 };
    // An older player actor sends none of the new fields.
    await writeActivity(sql, 1, [{ day: "2026-10-01", ...base }]);
    expect(db.query("SELECT sessions, sub_buckets, hours, sources FROM activity_daily").get()).toEqual({
      sessions: 0,
      sub_buckets: 0,
      hours: "",
      sources: "",
    });
    const hours = Array(24).fill(0).fill(3, 9, 11).join(",");
    await writeActivity(sql, 1, [
      { day: "2026-10-01", ...base, sessions: 2, subBuckets: 1, hours, sources: '{"claude_code":10}' },
      { day: "2026-10-02", ...base, prs: 4 },
    ]);
    expect(
      db
        .query("SELECT day, prs, sessions, sub_buckets, hours, sources FROM activity_daily ORDER BY day")
        .all(),
    ).toEqual([
      { day: "2026-10-01", prs: 0, sessions: 2, sub_buckets: 1, hours, sources: '{"claude_code":10}' },
      { day: "2026-10-02", prs: 4, sessions: 0, sub_buckets: 0, hours: "", sources: "" },
    ]);
    // Someone else's days are left alone.
    await writeActivity(sql, 2, [{ day: "2026-10-01", ...base, sessions: 9 }]);
    expect(db.query("SELECT COUNT(*) AS n FROM activity_daily").get()).toEqual({ n: 3 });
  });

  test("many days at once (a first sync) fit", async () => {
    const { db, sql } = await town();
    const days = Array.from({ length: 400 }, (_, i) => ({
      day: new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10),
      prompts: i,
      prs: 0,
      agentBuckets: 1,
      activeBuckets: 1,
      peakAgents: 1,
      sessions: 1,
    }));
    await writeActivity(sql, 1, days);
    expect(db.query("SELECT COUNT(*) AS n, SUM(sessions) AS s FROM activity_daily").get()).toEqual({
      n: 400,
      s: 400,
    });
  });

  test("habits: 30 days of hours, sources, parallelism and cache hits; an unreported day reads as nothing", async () => {
    const { db, sql } = await town();
    const hour = (h: number, n: number) =>
      Array(24)
        .fill(0)
        .fill(n, h, h + 1)
        .join(",");
    await writeActivity(sql, 1, [
      {
        day: "2026-10-20",
        prompts: 10,
        prs: 0,
        agentBuckets: 12,
        activeBuckets: 6,
        peakAgents: 4,
        sessions: 3,
        subBuckets: 6,
        hours: hour(23, 6),
        sources: '{"claude_code":300,"codex":100}',
      },
      // Reported before card v2: no hours, no sources.
      { day: "2026-10-21", prompts: 0, prs: 0, agentBuckets: 0, activeBuckets: 0, peakAgents: 0 },
      // Too old for the window.
      {
        day: "2026-08-01",
        prompts: 0,
        prs: 0,
        agentBuckets: 99,
        activeBuckets: 99,
        peakAgents: 9,
        sessions: 50,
      },
    ]);
    db.run(`INSERT INTO usage_daily (user_id, day, model, input, output, cache_creation, cache_read, turns)
      VALUES (1, '2026-10-20', 'm', 100, 50, 100, 800, 40)`);
    const { habits, agentType } = await habitsOf(sql, 1, now, 1);
    expect(habits.hours[23]).toBe(6);
    expect(habits.hours.reduce((a, b) => a + b, 0)).toBe(6);
    expect(habits.sessions).toBe(3);
    expect(habits.parallelism).toBe(2);
    expect(habits.peakAgents).toBe(4);
    expect(habits.subShare).toBe(0.5);
    expect(habits.activeHours).toBeCloseTo(0.5);
    expect(habits.turnsPerPrompt).toBe(4);
    expect(habits.cacheHit).toBeCloseTo(0.8);
    expect(habits.sources).toEqual([
      { source: "claude_code", share: 0.75 },
      { source: "codex", share: 0.25 },
    ]);
    // One active day: still an apprentice.
    expect(agentType.id).toBe("apprentice");
    // Nothing at all reads as nothing, not as a failure.
    const none = await habitsOf(sql, 3, now, 0);
    expect(none.habits).toMatchObject({
      sessions: 0,
      parallelism: null,
      turnsPerPrompt: null,
      cacheHit: null,
    });
    expect(none.habits.sources).toEqual([]);
  });

  test("a malformed sources day is skipped", async () => {
    const { sql } = await town();
    await writeActivity(sql, 1, [
      {
        day: "2026-10-20",
        prompts: 0,
        prs: 0,
        agentBuckets: 0,
        activeBuckets: 0,
        peakAgents: 0,
        sources: "{nope",
      },
      {
        day: "2026-10-21",
        prompts: 0,
        prs: 0,
        agentBuckets: 0,
        activeBuckets: 0,
        peakAgents: 0,
        sources: '{"codex":5}',
      },
    ]);
    expect((await habitsOf(sql, 1, now, 2)).habits.sources).toEqual([{ source: "codex", share: 1 }]);
  });
});

describe("bio", () => {
  test("set, clear, and one report per reporter that goes with the old text", async () => {
    const { db, sql } = await town();
    await setBio(sql, 1, "Ships on Fridays");
    expect(await bioOf(sql, 1)).toBe("Ships on Fridays");
    await reportBio(sql, 2, 1, now);
    await reportBio(sql, 2, 1, now + 1);
    await reportBio(sql, 3, 1, now);
    expect(db.query("SELECT COUNT(*) AS n FROM bio_reports WHERE target = 1").get()).toEqual({ n: 2 });
    // Editing it is a new bio: old reports don't follow.
    await setBio(sql, 1, "Something else");
    expect(db.query("SELECT COUNT(*) AS n FROM bio_reports").get()).toEqual({ n: 0 });
    await setBio(sql, 1, null);
    expect(await bioOf(sql, 1)).toBeNull();
  });

  test("you can't report yourself, or an empty bio", async () => {
    const { sql } = await town();
    await setBio(sql, 1, "hi");
    await expect(reportBio(sql, 1, 1, now)).rejects.toThrow("own");
    await expect(reportBio(sql, 1, 2, now)).rejects.toThrow("no bio");
    await expect(reportBio(sql, 1, -5, now)).rejects.toThrow("no bio");
  });
});

describe("showcase", () => {
  test("pins keep their order, replace each other, and are at most three", async () => {
    const { db, sql } = await town();
    await setPins(sql, 1, ["badge:shipper", "trophy:3am", "badge:streak"]);
    expect(await pinsOf(sql, 1)).toEqual([
      { id: "badge:shipper" },
      { id: "trophy:3am" },
      { id: "badge:streak" },
    ]);
    expect(db.query("SELECT kind FROM showcase WHERE user_id = 1 ORDER BY slot").all()).toEqual([
      { kind: "badge" },
      { kind: "trophy" },
      { kind: "badge" },
    ]);
    await setPins(sql, 1, ["trophy:3am"]);
    expect(await pinsOf(sql, 1)).toEqual([{ id: "trophy:3am" }]);
    await setPins(sql, 1, ["badge:a", "badge:b", "badge:c", "badge:d"]);
    expect(await pinsOf(sql, 1)).toHaveLength(3);
    expect(await pinsOf(sql, 2)).toEqual([]);
  });
});

describe("the regulars' plaques", () => {
  test("minutes add up per day and stop at the cap", async () => {
    const { db, sql } = await town();
    await addTavernMinutes(sql, "2026-10-21", [[1, 100, 1]]);
    await addTavernMinutes(sql, "2026-10-21", [[1, 50, 0]]);
    expect(db.query("SELECT minutes, visits FROM tavern_daily WHERE user_id = 1").get()).toEqual({
      minutes: 150,
      visits: 1,
    });
    await addTavernMinutes(sql, "2026-10-21", [[1, 100, 1]]);
    expect(db.query("SELECT minutes, visits FROM tavern_daily WHERE user_id = 1").get()).toEqual({
      minutes: REGULAR_DAY_CAP,
      visits: 2,
    });
    // A first flush alone can't pass it either.
    await addTavernMinutes(sql, "2026-10-21", [[2, 5000, 1]]);
    expect(db.query("SELECT minutes FROM tavern_daily WHERE user_id = 2").get()).toEqual({
      minutes: REGULAR_DAY_CAP,
    });
    // The next day is a new allowance.
    await addTavernMinutes(sql, "2026-10-22", [[1, 10, 1]]);
    expect(
      db.query("SELECT minutes FROM tavern_daily WHERE user_id = 1 AND day = '2026-10-22'").get(),
    ).toEqual({
      minutes: 10,
    });
  });

  test("nonsense rows, and people who no longer exist, are ignored", async () => {
    const { db, sql } = await town();
    const credited = await addTavernMinutes(sql, "2026-10-21", [
      [1, 5, 1],
      [99, 5, 1],
      [-1, 5, 1],
      [2, 0, 0],
      [3, -4, 0],
      [3, Number.NaN, 0],
    ]);
    expect(credited).toEqual([1]);
    expect(db.query("SELECT COUNT(*) AS n FROM tavern_daily").get()).toEqual({ n: 1 });
  });

  test("the weekly board: Monday on, at least 30 minutes, top five, most minutes first", async () => {
    const { sql } = await town(["a", "b", "c", "d", "e", "f", "g", "h"]);
    // 2026-10-22 is a Thursday; the week began Monday the 19th.
    await addTavernMinutes(sql, "2026-10-18", [[1, 170, 1]]); // last week
    await addTavernMinutes(sql, "2026-10-19", [
      [2, 20, 1],
      [3, 60, 1],
      [4, 29, 1],
      [5, 100, 1],
    ]);
    await addTavernMinutes(sql, "2026-10-21", [
      [2, 10, 1],
      [4, 1, 0],
      [6, 40, 1],
      [7, 45, 1],
      [8, 31, 1],
    ]);
    const top = await weeklyRegulars(sql, "2026-10-22");
    expect(top.map((r) => [r.rank, r.name, r.minutes])).toEqual([
      [1, "e", 100],
      [2, "c", 60],
      [3, "g", 45],
      [4, "f", 40],
      [5, "h", 31],
    ]);
    // 29 plus 1 is 30: enough, but past the five (31 beats it). And last week's 170 isn't counted.
    expect(top.some((r) => r.name === "a")).toBe(false);
    expect(await minutesThisWeek(sql, 1, "2026-10-22")).toBeNull();
    expect(await minutesThisWeek(sql, 4, "2026-10-22")).toBe(30);
    // Next Monday the board starts over.
    expect(await weeklyRegulars(sql, "2026-10-26")).toEqual([]);
  });

  test("the first Sunday of a week still belongs to the one before", async () => {
    const { sql } = await town();
    await addTavernMinutes(sql, "2026-10-19", [[1, 60, 1]]);
    expect(await weeklyRegulars(sql, "2026-10-25")).toHaveLength(1);
    expect(await weeklyRegulars(sql, "2026-10-26")).toHaveLength(0);
  });

  test("rows older than eight weeks go on the next flush", async () => {
    const { db, sql } = await town();
    await addTavernMinutes(sql, "2026-08-01", [[1, 5, 1]]);
    await addTavernMinutes(sql, "2026-10-01", [[1, 5, 1]]);
    await addTavernMinutes(sql, "2026-10-22", [[2, 5, 1]]);
    expect(db.query("SELECT day FROM tavern_daily ORDER BY day").all()).toEqual([
      { day: "2026-10-01" },
      { day: "2026-10-22" },
    ]);
  });

  test("since and the Tavern badge's days count days with a visit", async () => {
    const { sql } = await town();
    expect(await tavernSince(sql, 1)).toBeNull();
    await addTavernMinutes(sql, "2026-10-10", [[1, 5, 1]]);
    await addTavernMinutes(sql, "2026-10-12", [[1, 5, 1]]);
    await addTavernMinutes(sql, "2026-10-15", [[1, 5, 0]]);
    expect(await tavernSince(sql, 1)).toBe("2026-10-10");
    expect(await tavernDaysOf(sql, 1)).toBe(2);
  });
});

describe("the minute counter", () => {
  const here = { room: "inn", state: "idle" };

  test("counts the awake in the Tavern or its basement, not the dozing, away, working or elsewhere", () => {
    expect(counts(here)).toBe(true);
    expect(counts({ room: "basement", state: "sitting" })).toBe(true);
    expect(counts({ ...here, dozing: true })).toBe(false);
    expect(counts({ ...here, state: "away" })).toBe(false);
    expect(counts({ ...here, state: "working" })).toBe(false);
    expect(counts({ room: "town", state: "idle" })).toBe(false);
    expect(counts({ room: "office:3", state: "idle" })).toBe(false);
  });

  test("a minute each, a visit for each arrival after a gap, and a flush starts over", () => {
    const clock = new TavernClock();
    const t = 1_000_000;
    clock.tick([1, 2], t);
    clock.tick([1], t + 60_000);
    clock.tick([1, 2], t + 120_000);
    // Two was out for a minute only: still the same visit.
    expect(clock.take().sort((a, b) => a[0] - b[0])).toEqual([
      [1, 3, 1],
      [2, 2, 1],
    ]);
    expect(clock.take()).toEqual([]);
    // Back after the gap: a new visit; just under it: not.
    clock.tick([1], t + 120_000 + VISIT_GAP_MS - 1);
    clock.tick([2], t + 120_000 + VISIT_GAP_MS);
    expect(clock.take().sort((a, b) => a[0] - b[0])).toEqual([
      [1, 1, 0],
      [2, 1, 1],
    ]);
  });

  test("a failed flush's rows go back and add to the next", () => {
    const clock = new TavernClock();
    clock.tick([1], 0);
    const rows = clock.take();
    clock.tick([1, 2], 60_000);
    clock.restore(rows);
    expect(clock.take().sort((a, b) => a[0] - b[0])).toEqual([
      [1, 2, 1],
      [2, 1, 1],
    ]);
  });
});
