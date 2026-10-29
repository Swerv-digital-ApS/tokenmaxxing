import { expect, test } from "bun:test";
import { migrateEvents } from "../src/actors/player.ts";
import { serial } from "../src/actors/shared.ts";
import { backfillTrophies, trophiesOf, trophyHoursChanged } from "../src/trophies.ts";
import { memorySql } from "./memory-sql.ts";

const insert = (db: ReturnType<typeof memorySql>["db"], type: string, at: number, id: string, tokens = 0) =>
  db.run(
    `INSERT INTO events (source, session_id, message_id, timestamp, day, model, message_type,
       input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens)
     VALUES ('claude_code', 's', ?, ?, '', 'm', ?, ?, 0, 0, 0)`,
    [id, at, type, tokens],
  );

const now = Date.parse("2026-10-21T12:00:00Z");
// 3:30 AM in Copenhagen (UTC+2) on Tuesday 20 October.
const threeAm = Date.parse("2026-10-20T01:30:00Z");

test("trophies come from the events, and a look works out only the hours that changed", async () => {
  const { db, sql } = memorySql();
  await migrateEvents(sql);
  insert(db, "assistant", threeAm, "a", 600_123);
  insert(db, "pr", threeAm, "00deadbeef");
  await trophyHoursChanged(sql, [threeAm]);
  expect(await trophiesOf(sql, now)).toEqual([
    { id: "3am", day: "2026-10-20" },
    { id: "zeros", day: "2026-10-20" },
    { id: "deadbeef", day: "2026-10-20" },
  ]);
  expect(db.query("SELECT COUNT(*) AS n FROM trophy_dirty").get()).toEqual({ n: 0 });
  // The same hour again, and an event already counted that grew (a Claude response split across two
  // syncs): the hour is worked out again from the events, to a round million on the (finished) day.
  insert(db, "assistant", threeAm + 60_000, "b", 399_000);
  db.run("UPDATE events SET input_tokens = ? WHERE message_id = 'a'", [601_000]);
  await trophyHoursChanged(sql, [threeAm + 60_000, threeAm]);
  expect((await trophiesOf(sql, now)).map((t) => t.id)).toEqual([
    "million",
    "3am",
    "zeros",
    "deadbeef",
    "round",
    "exactmillion",
  ]);
  expect(db.query("SELECT COUNT(*) AS n FROM trophy_hours").get()).toEqual({ n: 1 });
});

test("a history from before the stored totals is filled in once, and until then trophies aren't known", async () => {
  const { db, sql } = memorySql();
  await migrateEvents(sql);
  insert(db, "assistant", threeAm, "a", 600_123);
  insert(db, "pr", threeAm, "00deadbeef");
  // As a player whose events were stored before the stored totals.
  db.run("DELETE FROM usage_report_migrations WHERE version = 6");
  await migrateEvents(sql);
  await expect(trophiesOf(sql, now)).rejects.toThrow("still being counted");
  await backfillTrophies(sql, serial());
  expect((await trophiesOf(sql, now)).map((t) => t.id)).toEqual(["3am", "zeros", "deadbeef"]);
});
