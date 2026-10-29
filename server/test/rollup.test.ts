import { expect, test } from "bun:test";
import type { Client } from "rivetkit/client";
import { migrateEvents, report, requeueEveryDay } from "../src/actors/player.ts";
import type { registry } from "../src/actors/registry.ts";
import type { ActivityDay } from "../src/actors/town.ts";
import { flushUsageReports } from "../src/usage-reports.ts";
import { memorySql } from "./memory-sql.ts";

test("the rollup carries sessions, subagents, hours by world clock and tokens by source", async () => {
  const { db, sql } = memorySql();
  try {
    await migrateEvents(sql);
    let n = 0;
    const add = (
      at: number,
      day: string,
      source: string,
      session: string,
      agent: string | null,
      tokens: number,
      type = "assistant",
    ) =>
      db.run(
        `INSERT INTO events (source, session_id, agent_id, message_id, timestamp, day, model, message_type,
           input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens)
         VALUES (?, ?, ?, ?, ?, ?, 'm', ?, ?, 0, 0, 0)`,
        [source, session, agent, `m${n++}`, at, day, type, tokens],
      );
    // Summer (CEST, UTC+2): 21:30Z is 23:30 on the world's clock. Two sessions; in one bucket a main
    // agent and a subagent, in the next the main agent alone.
    const summer = Date.UTC(2026, 6, 1, 21, 30);
    add(summer, "2026-07-01", "claude_code", "s1", null, 100);
    add(summer + 1000, "2026-07-01", "claude_code", "s1", "sub1", 50);
    add(summer + 6 * 60_000, "2026-07-01", "codex", "s2", null, 25);
    // Winter (CET, UTC+1): 22:30Z is 23:30 too, so DST doesn't move the bin.
    const winter = Date.UTC(2026, 0, 15, 22, 30);
    add(winter, "2026-01-15", "claude_code", "w1", null, 10);
    // A prompt isn't an active bucket.
    add(winter, "2026-01-15", "claude_code", "w1", null, 0, "user");
    let activity: ActivityDay[] = [];
    const client = {
      town: {
        getOrCreate: () => ({
          report: async (_i: number, _d: string[], _u: unknown, a: ActivityDay[]) => {
            activity = a;
          },
        }),
      },
      world: { getOrCreate: () => ({ activity: async () => {} }) },
      arcade: { getOrCreate: () => ({}) },
    } as unknown as Client<typeof registry>;
    await report(sql, client, 7, ["2026-01-15", "2026-07-01", "2026-03-03"], summer + 3_600_000);
    const day = (d: string) => activity.find((a) => a.day === d)!;
    const july = day("2026-07-01");
    expect(july).toMatchObject({
      sessions: 2,
      activeBuckets: 2,
      agentBuckets: 3,
      peakAgents: 2,
      subBuckets: 1,
    });
    const hours = july.hours!.split(",").map(Number);
    expect(hours).toHaveLength(24);
    expect(hours[23]).toBe(2);
    expect(hours.reduce((a, b) => a + b, 0)).toBe(2);
    expect(JSON.parse(july.sources!)).toEqual({ claude_code: 150, codex: 25 });
    expect(day("2026-01-15").hours!.split(",").map(Number)[23]).toBe(1);
    expect(day("2026-01-15")).toMatchObject({ sessions: 1, subBuckets: 0 });
    // A day with nothing: zeros and no sources, not missing.
    expect(day("2026-03-03")).toMatchObject({ sessions: 0, subBuckets: 0, activeBuckets: 0, sources: "" });
    expect(day("2026-03-03").hours).toBe(Array(24).fill(0).join(","));
    // Tokens by world hour, for green hours: all of July's 175 at 23:00, January's 10 at 23:00 too.
    const tokensAt = (d: string) => day(d).hourTokens!.split(",").map(Number);
    expect(tokensAt("2026-07-01")[23]).toBe(175);
    expect(tokensAt("2026-07-01").reduce((a, b) => a + b, 0)).toBe(175);
    expect(tokensAt("2026-01-15")[23]).toBe(10);
    expect(day("2026-03-03").hourTokens).toBe("");
  } finally {
    db.close();
  }
});

test("card v2 re-queues every stored day once, through the same drain", async () => {
  const { db, sql } = memorySql();
  try {
    await migrateEvents(sql);
    for (const [i, day] of ["2026-09-29", "2026-09-30", "2026-09-30"].entries())
      db.run(
        `INSERT INTO events (source, session_id, message_id, timestamp, day, model, message_type,
           input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens)
         VALUES ('claude_code', 's', ?, ?, ?, 'a', 'assistant', 1, 0, 0, 0)`,
        [`m${i}`, i, day],
      );
    // A database that already ran every earlier repair and drained its queue.
    await flushUsageReports(sql, async () => {});
    db.run("DELETE FROM usage_report_migrations WHERE version = 5");
    expect(db.query("SELECT day FROM pending_usage_days").all()).toEqual([]);
    await migrateEvents(sql);
    // Not while starting: a big history read cold outlived the startup limit there.
    expect(db.query("SELECT day FROM pending_usage_days").all()).toEqual([]);
    await requeueEveryDay(sql);
    expect(db.query("SELECT day FROM pending_usage_days ORDER BY day").all()).toEqual([
      { day: "2026-09-29" },
      { day: "2026-09-30" },
    ]);
    expect(db.query("SELECT version FROM usage_report_migrations WHERE version = 5").get()).toEqual({
      version: 5,
    });
    const reported: string[][] = [];
    await flushUsageReports(sql, async (days) => {
      reported.push(days);
    });
    expect(reported).toEqual([["2026-09-29", "2026-09-30"]]);
    // Waking again does not queue them again.
    await migrateEvents(sql);
    await requeueEveryDay(sql);
    expect(db.query("SELECT day FROM pending_usage_days").all()).toEqual([]);
  } finally {
    db.close();
  }
});

test("card v2's re-queue picks up where an interrupted start left it", async () => {
  const { db, sql } = memorySql();
  try {
    await migrateEvents(sql);
    const insert = db.prepare(`INSERT INTO events (id, source, session_id, message_id, timestamp, day, model,
      message_type, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens)
      VALUES (?, 'claude_code', 's', ?, ?, ?, 'a', 'assistant', 1, 0, 0, 0)`);
    insert.run(10, "early", 1, "2026-09-01");
    insert.run(5_000, "late", 2, "2026-09-02");
    await flushUsageReports(sql, async () => {});
    db.run("DELETE FROM usage_report_migrations WHERE version = 5");
    // Stopped after the first batch: its days are queued (and maybe reported) already.
    db.run("INSERT INTO requeue_cursor VALUES (2000)");
    await requeueEveryDay(sql);
    expect(db.query("SELECT day FROM pending_usage_days").all()).toEqual([{ day: "2026-09-02" }]);
    expect(db.query("SELECT 1 AS done FROM usage_report_migrations WHERE version = 5").get()).toEqual({
      done: 1,
    });
  } finally {
    db.close();
  }
});
