import { DESKS, type DeskSetup, deskIndex, deskItem, nextFleet, ownsDesk } from "@tokenmaxxing/core/desks.ts";
import { UserError } from "rivetkit";
import { all, type Sql } from "../actors/shared.ts";
import { addPurchase, type Kept, type Wallet, wallet } from "./coins.ts";
import { type CompanyRow, companyLedgerAdd, companyWallet } from "./companies.ts";
import { levelOf } from "./users.ts";

/**
 * Desk setups' columns: the one a player uses (`users.desk`, a `DESKS` id; NULL is the laptop) and the
 * tier a company's wallet has bought for its whole house (`companies.desk_fleet`, 0 is none). Bought
 * setups are `purchases` rows, `desk.<id>`. Additive; nothing is backfilled.
 */
export async function migrateDesks(sql: Sql): Promise<void> {
  for (const [table, col, type] of [
    ["users", "desk", "TEXT"],
    ["companies", "desk_fleet", "INTEGER NOT NULL DEFAULT 0"],
  ] as const) {
    const columns = (await sql.execute(`PRAGMA table_info(${table})`)) as { name: string }[];
    if (!columns.some((c) => c.name === col))
      await sql.execute(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
  }
}

/** What `userId` has bought, as `deskItem` names. */
async function bought(sql: Sql, userId: number): Promise<Set<string>> {
  const rows = await all<{ item: string }>(
    sql,
    "SELECT item FROM purchases WHERE user_id = ? AND item LIKE 'desk.%'",
    userId,
  );
  return new Set(rows.map((r) => r.item));
}

function pick(id: unknown): DeskSetup {
  const d = typeof id === "string" ? DESKS.find((x) => x.id === id) : undefined;
  if (!d) throw new UserError("That's not in the shop.", { code: "not_found" });
  return d;
}

/** The desk panel's state: which setups I may use, which I'm using. */
export interface MyDesk {
  owned: string[];
  using: string;
}

/** What `userId` may use now (the laptop, earned ones and bought ones) and what they use. */
export async function myDesk(sql: Sql, userId: number): Promise<MyDesk> {
  const [level, had, [row]] = await Promise.all([
    levelOf(sql, userId),
    bought(sql, userId),
    all<{ desk: string | null }>(sql, "SELECT desk FROM users WHERE id = ?", userId),
  ]);
  return {
    owned: DESKS.filter((d) => ownsDesk(d, level, had)).map((d) => d.id),
    using: DESKS[deskIndex(row?.desk)]!.id,
  };
}

/** Buys a setup for `userId`'s coins, once. Run it serialized, like `buy`. */
export async function buyDesk(
  sql: Sql,
  userId: number,
  id: unknown,
  now: number,
  kept?: Kept,
): Promise<Wallet> {
  const d = pick(id);
  if (d.price === 0) throw new UserError("That one isn't for sale.", { code: "not_for_sale" });
  if ((await myDesk(sql, userId)).owned.includes(d.id))
    throw new UserError("You have that already.", { code: "owned" });
  if ((await wallet(sql, userId, now, kept)).balance < d.price)
    throw new UserError("Not enough coins yet.", { code: "too_poor" });
  await addPurchase(sql, userId, deskItem(d.id), d.price, now);
  return wallet(sql, userId, now, kept);
}

/** Switches `userId` to a setup they own, free. The laptop is NULL. Returns the id now in use. */
export async function setDesk(sql: Sql, userId: number, id: unknown): Promise<string> {
  const d = pick(id);
  if (!(await myDesk(sql, userId)).owned.includes(d.id))
    throw new UserError("Buy that one first.", { code: "not_owned" });
  await sql.execute("UPDATE users SET desk = ? WHERE id = ?", d.price === 0 ? null : d.id, userId);
  return d.id;
}

/**
 * The company buys its house the next desk tier from its wallet (the owner's doing, in the shop).
 * Tiers go one at a time. Run it serialized, so two buys can't spend the same coins.
 */
export async function buyDeskFleet(
  sql: Sql,
  company: CompanyRow,
  userId: number,
  now: number,
): Promise<number> {
  const [row] = await all<{ tier: number }>(
    sql,
    "SELECT desk_fleet AS tier FROM companies WHERE id = ?",
    company.id,
  );
  const next = nextFleet(row?.tier ?? 0);
  if (!next) throw new UserError("The whole house has the best setup already.", { code: "owned" });
  if ((await companyWallet(sql, company.id)) < next.setup.fleet)
    throw new UserError("The company wallet can't cover that yet.", { code: "too_poor" });
  await sql.execute("UPDATE companies SET desk_fleet = ? WHERE id = ?", next.tier, company.id);
  await companyLedgerAdd(sql, company.id, userId, -next.setup.fleet, "desk", next.setup.id, now);
  return next.tier;
}
