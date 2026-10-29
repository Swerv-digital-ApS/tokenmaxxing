import {
  DECORS,
  type DecorKind,
  decorItem,
  decorOf,
  isDecorKind,
  isPlain,
  ownsDecor,
} from "@tokenmaxxing/core/decor.ts";
import {
  OFFICE_LEVEL,
  OFFICE_SIZES,
  type OfficeTier,
  officeSizeItem,
  officeTier,
} from "@tokenmaxxing/core/office.ts";
import { addDays, dayKey } from "@tokenmaxxing/core/range.ts";
import { UserError } from "rivetkit";
import { all, type Sql } from "../actors/shared.ts";
import { addPurchase, grantRewards, type Kept, type Wallet, wallet } from "./coins.ts";
import { levelOf } from "./users.ts";

/**
 * Offices v2's tables: the wallpaper and floor on `offices` (NULL is the plain one), and who visited
 * whose office on which day, for the open offices list. Additive; nothing is backfilled.
 */
export async function migrateOffices(sql: Sql): Promise<void> {
  const columns = (await sql.execute("PRAGMA table_info(offices)")) as { name: string }[];
  for (const col of ["wall", "floor"])
    if (!columns.some((c) => c.name === col)) await sql.execute(`ALTER TABLE offices ADD COLUMN ${col} TEXT`);
  await sql.execute(`CREATE TABLE IF NOT EXISTS office_visits (
    owner_id INTEGER NOT NULL, visitor_id INTEGER NOT NULL, day TEXT NOT NULL,
    PRIMARY KEY (owner_id, visitor_id, day)) WITHOUT ROWID`);
  await sql.execute("CREATE INDEX IF NOT EXISTS office_visits_day ON office_visits (day)");
}

/** An open office, as `world` knows it now. */
export interface OpenOffice {
  id: number;
  name: string;
  level: number;
  company: string;
  /** Its size, 0 to 3 (`officeTier`). */
  tier: number;
  /** How many are in it now. */
  inside: number;
}

/** Days a visit counts for in the open offices list. */
export const VISIT_DAYS = 7;

/** `visitorId` was in `ownerId`'s office today: once a day each, never the owner's own. */
export async function recordVisit(sql: Sql, ownerId: number, visitorId: number, now: number): Promise<void> {
  if (ownerId === visitorId) return;
  const day = dayKey(now);
  await sql.execute(
    "INSERT INTO office_visits (owner_id, visitor_id, day) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
    ownerId,
    visitorId,
    day,
  );
  // Old days are of no use any more.
  await sql.execute("DELETE FROM office_visits WHERE day < ?", addDays(day, -VISIT_DAYS));
}

/** Different visitors per office over the last `VISIT_DAYS` days, by owner. */
export async function visitorCounts(sql: Sql, now: number): Promise<Record<number, number>> {
  const rows = await all<{ owner: number; n: number }>(
    sql,
    `SELECT owner_id AS owner, COUNT(DISTINCT visitor_id) AS n FROM office_visits
     WHERE day > ? GROUP BY owner_id`,
    addDays(dayKey(now), -VISIT_DAYS),
  );
  return Object.fromEntries(rows.map((r) => [r.owner, r.n]));
}

/** What `userId` has bought, as `decorItem` names. */
async function bought(sql: Sql, userId: number): Promise<Set<string>> {
  const rows = await all<{ item: string }>(
    sql,
    "SELECT item FROM purchases WHERE user_id = ? AND item LIKE 'decor.%'",
    userId,
  );
  return new Set(rows.map((r) => r.item));
}

function pick(kind: unknown, id: unknown): { kind: DecorKind; id: string } {
  if (!isDecorKind(kind) || typeof id !== "string" || !decorOf(kind, id))
    throw new UserError("That's not in the shop.", { code: "not_found" });
  return { kind, id };
}

/** What `userId` may use now, as `<kind>.<id>`, for the decor panel (plain ones and earned ones included). */
export async function ownedDecor(sql: Sql, userId: number): Promise<string[]> {
  const [level, had] = [await levelOf(sql, userId), await bought(sql, userId)];
  const out: string[] = [];
  for (const kind of ["wall", "floor"] as const)
    for (const d of DECORS[kind]) if (ownsDecor(kind, d, level, had)) out.push(`${kind}.${d.id}`);
  return out;
}

/** The wallpaper and floor on `userId`'s office now (`null`: the plain one, or no office yet). */
export async function decorNow(
  sql: Sql,
  userId: number,
): Promise<{ wall: string | null; floor: string | null }> {
  const [row] = (await sql.execute("SELECT wall, floor FROM offices WHERE user_id = ?", userId)) as {
    wall: string | null;
    floor: string | null;
  }[];
  return { wall: row?.wall ?? null, floor: row?.floor ?? null };
}

/** Buys a wallpaper or floor for `userId`'s coins, once. Run it serialized, like `buy`. */
export async function buyDecor(
  sql: Sql,
  userId: number,
  kind: unknown,
  id: unknown,
  now: number,
  kept?: Kept,
): Promise<Wallet> {
  const p = pick(kind, id);
  const d = decorOf(p.kind, p.id)!;
  if (d.level !== undefined || d.price === 0)
    throw new UserError("That one isn't for sale.", { code: "not_for_sale" });
  if ((await bought(sql, userId)).has(decorItem(p.kind, p.id)))
    throw new UserError("You have that already.", { code: "owned" });
  if ((await wallet(sql, userId, now, kept)).balance < d.price)
    throw new UserError("Not enough coins yet.", { code: "too_poor" });
  await addPurchase(sql, userId, decorItem(p.kind, p.id), d.price, now);
  return wallet(sql, userId, now, kept);
}

/**
 * Puts a wallpaper or floor you own on your office (`null`: the plain one). Free. Returns the starter
 * desk and chair if this is what made the office's row (`grantRewards`), for `world` to put down.
 */
export async function applyDecor(
  sql: Sql,
  userId: number,
  kind: unknown,
  id: unknown,
  now: number,
): Promise<{ drops: Awaited<ReturnType<typeof grantRewards>>; kind: DecorKind; id: string | null }> {
  if (!isDecorKind(kind)) throw new UserError("Wall or floor?", { code: "invalid_decor" });
  const level = await levelOf(sql, userId);
  if (level < OFFICE_LEVEL)
    throw new UserError(`You get an office at level ${OFFICE_LEVEL}.`, { code: "not_found" });
  let value: string | null = null;
  if (id !== null) {
    const p = pick(kind, id);
    if (!ownsDecor(kind, decorOf(kind, p.id)!, level, await bought(sql, userId)))
      throw new UserError("Buy that one first.", { code: "not_owned" });
    value = isPlain(kind, p.id) ? null : p.id;
  }
  const drops = await grantRewards(sql, userId, level, now);
  // The column name is one of two literals (`isDecorKind`).
  await sql.execute(`UPDATE offices SET ${kind} = ? WHERE user_id = ?`, value, userId);
  return { drops, kind, id: value };
}

// MARK: Sizes

/** `userId`'s office size now: the biggest they bought, or the one their level gives. */
export async function officeSizeNow(sql: Sql, userId: number): Promise<OfficeTier> {
  const [row] = await all<{ size: number | null }>(
    sql,
    "SELECT MAX(CAST(SUBSTR(item, 13) AS INTEGER)) AS size FROM purchases WHERE user_id = ? AND item LIKE 'office.size.%'",
    userId,
  );
  return officeTier(await levelOf(sql, userId), row?.size ?? 0);
}

/**
 * Buys the next size for your office with your coins. One at a time and in order, so it can't be done
 * twice and nobody skips a step. Run it serialized, like `buyDecor`.
 */
export async function buyOfficeSize(
  sql: Sql,
  userId: number,
  now: number,
  kept?: Kept,
): Promise<{ wallet: Wallet; tier: OfficeTier }> {
  const level = await levelOf(sql, userId);
  if (level < OFFICE_LEVEL)
    throw new UserError(`You get an office at level ${OFFICE_LEVEL}.`, { code: "not_found" });
  const next = (await officeSizeNow(sql, userId)) + 1;
  const size = OFFICE_SIZES[next];
  if (!size) throw new UserError("Your office is as big as they come.", { code: "owned" });
  if ((await wallet(sql, userId, now, kept)).balance < size.price)
    throw new UserError("Not enough coins yet.", { code: "too_poor" });
  await addPurchase(sql, userId, officeSizeItem(next), size.price, now);
  return { wallet: await wallet(sql, userId, now, kept), tier: next as OfficeTier };
}
