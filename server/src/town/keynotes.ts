import { type Keynote, keynoteReward, upcoming } from "@tokenmaxxing/core/keynote.ts";
import { UserError } from "rivetkit";
import { all, one, type Sql, scalar } from "../actors/shared.ts";
import { parseKeynote } from "../validate.ts";

/**
 * The keynote watch parties (`core/src/keynote.ts` has the rules): what the admin page has scheduled, one
 * row each. A badge is a row in `rewards` per keynote someone dropped in on. Additive.
 */
export async function migrateKeynotes(sql: Sql): Promise<void> {
  await sql.execute(`CREATE TABLE IF NOT EXISTS keynotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL, host TEXT NOT NULL, starts_at INTEGER NOT NULL, ends_at INTEGER NOT NULL,
    url TEXT NOT NULL, created_at INTEGER NOT NULL)`);
  await sql.execute("CREATE INDEX IF NOT EXISTS keynotes_end ON keynotes (ends_at)");
}

const SELECT = "SELECT id, title, host, starts_at AS startsAt, ends_at AS endsAt, url FROM keynotes";

/** Every keynote, newest start first: the admin page's list. */
export const everyKeynote = (sql: Sql): Promise<Keynote[]> =>
  all<Keynote>(sql, `${SELECT} ORDER BY starts_at DESC, id DESC LIMIT 200`);

/** The ones still to come or on at `now`, soonest first: what `world` keeps. */
export async function comingKeynotes(sql: Sql, now: number): Promise<Keynote[]> {
  return upcoming(await all<Keynote>(sql, `${SELECT} WHERE ends_at > ?`, now), now);
}

/** A keynote by the id the admin page sent, or `not_found`. */
async function keynoteOf(sql: Sql, rawId: unknown): Promise<Keynote> {
  const id = Number(rawId);
  const k = Number.isSafeInteger(id) ? await one<Keynote>(sql, `${SELECT} WHERE id = ?`, id) : undefined;
  if (!k) throw new UserError("That keynote is gone.", { code: "not_found" });
  return k;
}

/**
 * Schedules a keynote, or changes the one `rawId` names (null: a new one). Changing it keeps its id, so a
 * badge already handed out for it stays the one badge. Returns it as saved.
 */
export async function saveKeynote(sql: Sql, rawId: unknown, raw: unknown, now: number): Promise<Keynote> {
  const k = parseKeynote(raw, now);
  if (typeof k === "string") throw new UserError(k, { code: "bad_request" });
  if (rawId === null || rawId === undefined) {
    const [row] = await all<{ id: number }>(
      sql,
      `INSERT INTO keynotes (title, host, starts_at, ends_at, url, created_at)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
      k.title,
      k.host,
      k.startsAt,
      k.endsAt,
      k.url,
      now,
    );
    return { id: row!.id, ...k };
  }
  const { id } = await keynoteOf(sql, rawId);
  await sql.execute(
    "UPDATE keynotes SET title = ?, host = ?, starts_at = ?, ends_at = ?, url = ? WHERE id = ?",
    k.title,
    k.host,
    k.startsAt,
    k.endsAt,
    k.url,
    id,
  );
  return { id, ...k };
}

/** Takes one off the schedule (badges already earned at it stay). Returns it as it was. */
export async function removeKeynote(sql: Sql, rawId: unknown): Promise<Keynote> {
  const k = await keynoteOf(sql, rawId);
  await sql.execute("DELETE FROM keynotes WHERE id = ?", k.id);
  return k;
}

/** The watch party badge: one `rewards` row per keynote someone was in the Tavern for. True the first time. */
export async function markKeynote(sql: Sql, userId: number, keynoteId: number): Promise<boolean> {
  const fresh = await all(
    sql,
    "INSERT INTO rewards (user_id, item) VALUES (?, ?) ON CONFLICT DO NOTHING RETURNING item",
    userId,
    keynoteReward(keynoteId),
  );
  return fresh.length > 0;
}

/** How many watch parties someone dropped in on, for their badge. */
export const keynotesOf = (sql: Sql, userId: number): Promise<number> =>
  scalar(sql, "SELECT COUNT(*) AS n FROM rewards WHERE user_id = ? AND item LIKE 'keynote:%'", userId);
