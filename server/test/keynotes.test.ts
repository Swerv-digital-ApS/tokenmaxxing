import { describe, expect, test } from "bun:test";
import type { Keynote, KeynoteInput } from "@tokenmaxxing/core/keynote.ts";
import type { Notice } from "@tokenmaxxing/core/world.ts";
import {
  comingKeynotes,
  everyKeynote,
  keynotesOf,
  markKeynote,
  removeKeynote,
  saveKeynote,
} from "../src/town/keynotes.ts";
import { migrate } from "../src/town/schema.ts";
import { parseKeynote } from "../src/validate.ts";
import { memorySql } from "./memory-sql.ts";
import { admin, eventually, HOUR, MIN, signUp } from "./rivet.ts";
import { connect } from "./world-client.ts";

const NOW = Date.UTC(2026, 9, 21, 12);

const input = (over: Partial<KeynoteInput> = {}): KeynoteInput => ({
  title: "OpenAI DevDay",
  host: "OpenAI",
  startsAt: NOW + 2 * HOUR,
  endsAt: NOW + 4 * HOUR,
  url: "https://www.youtube.com/watch?v=abc",
  ...over,
});

describe("parseKeynote", () => {
  test("takes a keynote, tidied to one line", () => {
    expect(parseKeynote(input({ title: "  OpenAI\n DevDay ", host: "Open​AI" }), NOW)).toEqual(input());
  });

  test("says what's wrong with one it won't take", () => {
    const bad: [Partial<KeynoteInput>, RegExp][] = [
      [{ title: "Hi" }, /title/],
      [{ title: "x".repeat(81) }, /title/],
      [{ host: " " }, /hosting/],
      [{ startsAt: Number.NaN }, /start and an end/],
      [{ endsAt: NOW + 2 * HOUR }, /end after/],
      [{ endsAt: NOW + 15 * HOUR }, /12 hours/],
      [{ startsAt: NOW - 3 * HOUR, endsAt: NOW - HOUR }, /over already/],
      [{ startsAt: NOW + 400 * 24 * HOUR, endsAt: NOW + 400 * 24 * HOUR + HOUR }, /a year/],
      [{ url: "http://example.com/live" }, /https/],
      [{ url: "javascript:alert(1)" }, /https/],
      [{ url: "https://localhost/live" }, /https/],
    ];
    for (const [over, why] of bad) expect(parseKeynote(input(over), NOW)).toMatch(why);
    expect(parseKeynote(null, NOW)).toMatch(/title/);
  });

  test("one already on can still be scheduled (or changed) until it ends", () => {
    expect(parseKeynote(input({ startsAt: NOW - HOUR, endsAt: NOW + HOUR }), NOW)).toMatchObject({
      startsAt: NOW - HOUR,
    });
  });
});

describe("the keynotes table", () => {
  test("schedules, changes and removes; the world gets what's to come, soonest first", async () => {
    const { sql } = memorySql();
    await migrate(sql);
    const later = await saveKeynote(sql, null, input({ title: "Google I/O", host: "Google" }), NOW);
    const sooner = await saveKeynote(
      sql,
      undefined,
      input({ startsAt: NOW + HOUR, endsAt: NOW + 3 * HOUR }),
      NOW,
    );
    expect((await comingKeynotes(sql, NOW)).map((k) => k.id)).toEqual([sooner.id, later.id]);
    // Changed in place: the same id, so its badge stays the one badge.
    const moved = await saveKeynote(sql, later.id, input({ title: "Google I/O '26", host: "Google" }), NOW);
    expect(moved.id).toBe(later.id);
    expect((await everyKeynote(sql)).find((k) => k.id === later.id)?.title).toBe("Google I/O '26");
    // Over: off the world's list, still on the admin page's.
    expect(await comingKeynotes(sql, NOW + 5 * HOUR)).toEqual([]);
    expect(await everyKeynote(sql)).toHaveLength(2);
    expect((await removeKeynote(sql, sooner.id)).title).toBe("OpenAI DevDay");
    expect((await everyKeynote(sql)).map((k) => k.id)).toEqual([later.id]);
    await expect(removeKeynote(sql, sooner.id)).rejects.toThrow("gone");
    await expect(saveKeynote(sql, 999, input(), NOW)).rejects.toThrow("gone");
    await expect(saveKeynote(sql, null, input({ url: "nope" }), NOW)).rejects.toThrow("https");
  });

  test("the badge comes once per keynote, and counts keynotes", async () => {
    const { sql } = memorySql();
    await migrate(sql);
    expect(await markKeynote(sql, 1, 7)).toBe(true);
    expect(await markKeynote(sql, 1, 7)).toBe(false);
    expect(await markKeynote(sql, 1, 8)).toBe(true);
    expect(await markKeynote(sql, 2, 7)).toBe(true);
    expect(await keynotesOf(sql, 1)).toBe(2);
    expect(await keynotesOf(sql, 3)).toBe(0);
  });
});

test("an admin schedules a keynote: the Tavern hears at once, and whoever is in it gets the badge", async () => {
  // Admin only.
  const nobody = await signUp("kn");
  await expect(nobody.town.adminSaveKeynote(null, input())).rejects.toThrow();
  await expect(nobody.town.adminKeynotes()).rejects.toThrow();

  const now = Date.now();
  const u = await signUp("kn");
  const c = await connect(u.token);
  // New players start in the Tavern.
  expect(c.snap.room).toBe("inn");
  const heard: Keynote[][] = [];
  const notices: Notice[] = [];
  c.conn.on("keynotes", (k: Keynote[]) => heard.push(k));
  c.conn.on("notice", (n: Notice) => notices.push(n));

  const on = { startsAt: now - MIN, endsAt: now + HOUR };
  await expect(admin().adminSaveKeynote(null, input({ ...on, url: "ftp://x" }))).rejects.toThrow("https");
  const k = await admin().adminSaveKeynote(null, input({ ...on, title: "Watch Party Test" }));
  expect((await admin().adminKeynotes()).some((x) => x.id === k.id)).toBe(true);
  await eventually(() => expect(heard.at(-1)?.some((x) => x.id === k.id)).toBe(true));
  // It's on, and they're in the Tavern: the badge, once.
  await eventually(() => expect(notices.some((n) => n.text.includes("Watch Party Test"))).toBe(true), 15_000);
  const profile = await u.town.profile(u.userId, "30d");
  expect(profile.badges.find((b) => b.id === "keynote")?.value).toBe(1);

  // Taken off the schedule: the screen goes up again, and the log says who did what.
  await admin().adminRemoveKeynote(k.id);
  await eventually(() => expect(heard.at(-1)?.some((x) => x.id === k.id)).toBe(false));
  const log = await admin().adminLog();
  expect(log.slice(0, 2).map((e) => e.action)).toEqual(["remove keynote", "schedule keynote"]);
  await c.conn.dispose();
}, 30_000);
