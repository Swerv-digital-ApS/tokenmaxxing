import { levelFor } from "@tokenmaxxing/core/format.ts";
import { addDays, dayKey } from "@tokenmaxxing/core/range.ts";
import { coinsForTokens, type Item } from "@tokenmaxxing/core/shop.ts";
import {
  type Brand,
  COMPANY_CAP,
  type CompanyInfo,
  houseTier,
  type MerchDesign,
  parseMerchDesign,
} from "@tokenmaxxing/core/world.ts";
import { must, sortBy } from "hanzio";
import { UserError } from "rivetkit";
import { all, one, type Sql, scalar } from "../actors/shared.ts";
import { forgetLogo } from "../brand.ts";
import { among, type Ids, TOKENS, tokensIn, userById } from "./users.ts";

export interface MyCompany {
  id: number;
  name: string;
  isOwner: boolean;
  plot: number;
  tier: number;
  tokens30d: number;
  website: string | null;
  /** Reading the website: under way, didn't work, or null (done, or nothing to do). */
  branding: "working" | "failed" | null;
  members: { userId: number; name: string; isOwner: boolean }[];
  /** People asking to join, oldest first. Only the owner sees them. */
  applicants: { userId: number; name: string; level: number; at: number }[];
  /** Coins in the company wallet: members' token coins matched, and merch sold, less furniture. */
  wallet: number;
  /** The house-wide desk tier its wallet has bought (`DESKS`, desks.ts). */
  deskFleet: number;
  /** Company furniture off the floor, per kind: any member can put it out again. */
  stored: { item: string; count: number }[];
  /** The wallet's latest moves, newest first: who earned, bought or paid what. */
  log: WalletLine[];
}

export interface WalletLine {
  at: number;
  kind: "match" | "merch" | "furniture" | "desk" | "admin";
  /** Who earned it, bought it or paid it; null once they're deleted. */
  name: string | null;
  /** The world day matched, or the item bought. */
  ref: string;
  amount: number;
}

/** A company as listed for people looking for one. */
export interface Listing {
  id: number;
  name: string;
  website: string | null;
  members: number;
  tier: number;
  tokens30d: number;
  full: boolean;
}

export interface CompanyRow {
  id: number;
  name: string;
  ownerId: number;
  plot: number;
  website: string | null;
  branding: "working" | "failed" | null;
}

export const COMPANY_COLS = "id, name, owner_id AS ownerId, plot, website, branding";

export async function ownedCompany(sql: Sql, userId: number): Promise<CompanyRow> {
  const u = await userById(sql, userId);
  const company = u.companyId === null ? undefined : await companyById(sql, u.companyId);
  if (!company || company.ownerId !== userId)
    throw new UserError("Only the owner can do that.", { code: "not_owner" });
  return company;
}

/** `companies.merch`: the merch design its people drew (JSON; NULL is the brand's colours and initials). Additive. */
export async function migrateMerch(sql: Sql): Promise<void> {
  const columns = (await sql.execute("PRAGMA table_info(companies)")) as { name: string }[];
  if (!columns.some((c) => c.name === "merch"))
    await sql.execute("ALTER TABLE companies ADD COLUMN merch TEXT");
}

/** A member (not only the owner) sets the company's merch design. */
export async function setMerchDesign(sql: Sql, userId: number, raw: unknown): Promise<number> {
  const u = await userById(sql, userId);
  if (u.companyId === null) throw new UserError("Join a company first.", { code: "not_member" });
  const design: MerchDesign | null = raw === null ? null : parseMerchDesign(raw);
  if (raw !== null && !design) throw new UserError("That isn't a merch design.", { code: "invalid_design" });
  await sql.execute(
    "UPDATE companies SET merch = ? WHERE id = ?",
    design && JSON.stringify(design),
    u.companyId,
  );
  return u.companyId;
}

export interface Changed {
  users: number[];
  companies: number[];
}

/**
 * Takes `userId` out of their company. The owner hands over to whoever joined
 * earliest; the last one out closes the company and frees its plot.
 */
export async function leave(sql: Sql, userId: number): Promise<Changed> {
  const u = await userById(sql, userId);
  if (u.companyId === null) return { users: [], companies: [] };
  await sql.execute("UPDATE users SET company_id = NULL, joined_at = NULL WHERE id = ?", userId);
  const company = (await companyById(sql, u.companyId))!;
  if (company.ownerId === userId) {
    const heir = await one<{ id: number }>(
      sql,
      "SELECT id FROM users WHERE company_id = ? ORDER BY joined_at, id LIMIT 1",
      company.id,
    );
    if (heir) await sql.execute("UPDATE companies SET owner_id = ? WHERE id = ?", heir.id, company.id);
    else await dropCompany(sql, company.id);
  }
  return { users: [userId], companies: [company.id] };
}

export async function myCompany(sql: Sql, companyId: number, viewer: number): Promise<MyCompany> {
  const company = (await companyById(sql, companyId))!;
  const members = await all<{ userId: number; name: string }>(
    sql,
    "SELECT id AS userId, name FROM users WHERE company_id = ? ORDER BY joined_at, id",
    companyId,
  );
  const [info] = await companyInfos(sql, [companyId]);
  const isOwner = company.ownerId === viewer;
  return {
    id: company.id,
    name: company.name,
    isOwner,
    plot: company.plot,
    tier: houseTier(info?.tokens30d ?? 0, members.length),
    tokens30d: info?.tokens30d ?? 0,
    website: company.website,
    branding: company.branding,
    members: members.map((m) => ({ ...m, isOwner: m.userId === company.ownerId })),
    applicants: isOwner ? await applicants(sql, companyId) : [],
    wallet: await companyWallet(sql, companyId),
    deskFleet: info?.deskFleet ?? 0,
    stored: await storedPieces(sql, companyId),
    log: await walletLog(sql, companyId),
  };
}

// MARK: The company wallet

export const companyWallet = (sql: Sql, companyId: number): Promise<number> =>
  scalar(sql, "SELECT SUM(amount) AS n FROM company_ledger WHERE company_id = ?", companyId);

/** A line in a company's wallet (`company_ledger`): `amount` coins in (negative: out), `userId`'s doing. */
export const companyLedgerAdd = (
  sql: Sql,
  companyId: number,
  userId: number,
  amount: number,
  kind: WalletLine["kind"],
  ref: string,
  now: number,
) =>
  sql.execute(
    "INSERT INTO company_ledger (company_id, user_id, amount, kind, ref, at) VALUES (?, ?, ?, ?, ?, ?)",
    companyId,
    userId,
    amount,
    kind,
    ref,
    now,
  );

/** How many of a member's token coins for `day` are still to be matched: the day's coins, less what was. */
export const matchDue = (dayCoins: number, matched: number): number => Math.max(0, dayCoins - matched);

/**
 * After a sync: `userId`'s token coins for `days` are matched 1:1 into their company's wallet, on top of
 * their own (which are worked out from usage, so nothing of theirs moves). Days before they joined or
 * signed up don't count, and a day matched already only adds what it grew by: to whichever company
 * they're in now, so one who moves on mid-day leaves the morning's with the old one. Usage never
 * shrinks (but for an admin's wipe, which leaves the wallet as it is), so nothing is ever taken back.
 */
export async function matchCoins(sql: Sql, userId: number, days: string[], now: number): Promise<void> {
  const u = await one<{ companyId: number | null; joinedAt: number | null; createdAt: number }>(
    sql,
    "SELECT company_id AS companyId, joined_at AS joinedAt, created_at AS createdAt FROM users WHERE id = ?",
    userId,
  );
  if (!u || u.companyId === null || u.joinedAt === null) return;
  const from = [dayKey(u.joinedAt), dayKey(u.createdAt)].sort()[1]!;
  const counted = [...new Set(days.filter((day) => day >= from))];
  const perDay = async (query: string) =>
    new Map(
      (await all<{ day: string; n: number }>(sql, query, userId, JSON.stringify(counted))).map((r) => [
        r.day,
        r.n,
      ]),
    );
  const tokens = await perDay(
    `SELECT day, SUM(${TOKENS}) AS n FROM usage_daily
     WHERE user_id = ? AND day IN (SELECT value FROM json_each(?)) GROUP BY day`,
  );
  const matched = await perDay(
    `SELECT ref AS day, SUM(amount) AS n FROM company_ledger
     WHERE user_id = ? AND kind = 'match' AND ref IN (SELECT value FROM json_each(?)) GROUP BY ref`,
  );
  for (const day of counted) {
    const due = matchDue(coinsForTokens(tokens.get(day) ?? 0, day), matched.get(day) ?? 0);
    if (due > 0) await companyLedgerAdd(sql, u.companyId, userId, due, "match", day, now);
  }
}

async function walletLog(sql: Sql, companyId: number): Promise<WalletLine[]> {
  // Matches add up per member per day, so a day of syncs is one line.
  return all<WalletLine>(
    sql,
    `SELECT MAX(l.at) AS at, l.kind, u.name, l.ref, SUM(l.amount) AS amount
     FROM company_ledger l LEFT JOIN users u ON u.id = l.user_id WHERE l.company_id = ?
     GROUP BY CASE WHEN l.kind = 'match' THEN l.user_id || ' ' || l.ref ELSE l.id END
     ORDER BY MAX(l.at) DESC, MAX(l.id) DESC LIMIT 20`,
    companyId,
  );
}

/** Company furniture off the floor, per kind. */
export const storedPieces = (sql: Sql, companyId: number): Promise<{ item: string; count: number }[]> =>
  all(
    sql,
    `SELECT item, COUNT(*) AS count FROM items WHERE company_id = ? AND room IS NULL
     GROUP BY item ORDER BY MIN(id)`,
    companyId,
  );

/**
 * Buys one of `item` (company furniture) from the wallet, into the storeroom: its row is the company's,
 * `dropped_by` whoever bought it, and the ledger line says so too. Returns the row, for `world` to put
 * down. Run it serialized, so two buys can't spend the same coins.
 */
export async function buyPiece(
  sql: Sql,
  company: CompanyRow,
  userId: number,
  item: Item,
  now: number,
): Promise<number> {
  if (!item.company) throw new UserError("That's not for company buildings.", { code: "not_found" });
  if ((await companyWallet(sql, company.id)) < item.price)
    throw new UserError("The company wallet can't cover that yet.", { code: "too_poor" });
  const [row] = await all<{ id: number }>(
    sql,
    "INSERT INTO items (owner_id, item, at, dropped_by, dropped_at, company_id) VALUES (NULL, ?, ?, ?, ?, ?) RETURNING id",
    item.id,
    now,
    userId,
    now,
    company.id,
  );
  await companyLedgerAdd(sql, company.id, userId, -item.price, "furniture", item.id, now);
  return row!.id;
}

/** One of `item` out of the storeroom, for `world` to put down where `userId` stands. */
export async function unstore(
  sql: Sql,
  companyId: number,
  item: unknown,
  userId: number,
  now: number,
): Promise<number> {
  const [row] = await all<{ id: number }>(
    sql,
    `UPDATE items SET dropped_by = ?, dropped_at = ? WHERE id =
       (SELECT id FROM items WHERE company_id = ? AND room IS NULL AND item = ? LIMIT 1) RETURNING id`,
    userId,
    now,
    companyId,
    item,
  );
  if (!row) throw new UserError("None of those in the storeroom.", { code: "not_owned" });
  return row.id;
}

/**
 * A company with nobody left in it closes: its plot and logo are freed, its applications dropped, and its
 * furniture goes with it, stored or on the floor (where `world` lifts it).
 */
export async function dropCompany(sql: Sql, companyId: number): Promise<void> {
  await sql.execute("DELETE FROM companies WHERE id = ?", companyId);
  await sql.execute("DELETE FROM items WHERE company_id = ?", companyId);
  await sql.execute("DELETE FROM applications WHERE company_id = ?", companyId);
  await forgetLogo(companyId);
}

// MARK: Applying to join

/** Every company, busiest first (30-day tokens per member), for choosing one to apply to. */
export async function listings(sql: Sql): Promise<Listing[]> {
  return sortBy(
    (await companyInfos(sql, "all")).map((c) => ({
      id: c.id,
      name: c.name,
      website: c.website,
      members: c.members,
      tier: houseTier(c.tokens30d, c.members),
      tokens30d: c.tokens30d,
      full: c.members >= COMPANY_CAP,
    })),
    { by: (c) => c.tokens30d / Math.max(1, c.members), order: "desc" },
  );
}

/** The company `userId` is waiting to hear from, if any. */
export const applicationOf = (sql: Sql, userId: number) =>
  one<{ companyId: number; name: string }>(
    sql,
    `SELECT a.company_id AS companyId, c.name FROM applications a JOIN companies c ON c.id = a.company_id
     WHERE a.user_id = ?`,
    userId,
  ).then((r) => r ?? null);

async function applicants(sql: Sql, companyId: number): Promise<MyCompany["applicants"]> {
  const rows = await all<{ userId: number; name: string; at: number }>(
    sql,
    `SELECT a.user_id AS userId, u.name, a.at FROM applications a JOIN users u ON u.id = a.user_id
     WHERE a.company_id = ? ORDER BY a.at`,
    companyId,
  );
  const lifetime = await tokensIn(
    sql,
    rows.map((r) => r.userId),
  );
  return rows.map((r) => ({ ...r, level: levelFor(lifetime.get(r.userId) ?? 0) }));
}

export const companyById = (sql: Sql, id: number) =>
  one<CompanyRow>(sql, `SELECT ${COMPANY_COLS} FROM companies WHERE id = ?`, id);

/** The company with id `id` (as anyone may send it), or `not_found`. */
export async function companyOrGone(sql: Sql, id: unknown): Promise<CompanyRow> {
  return must(
    typeof id === "number" ? await companyById(sql, id) : undefined,
    () => new UserError("That company is gone.", { code: "not_found" }),
  );
}

const membersOf = (sql: Sql, companyId: number): Promise<number> =>
  scalar(sql, "SELECT COUNT(*) AS n FROM users WHERE company_id = ?", companyId);

/** Asks to join `companyId`; one application at a time, so this replaces any other. Returns the owner. */
export async function apply(sql: Sql, userId: number, companyId: number, now: number): Promise<CompanyRow> {
  const company = await companyOrGone(sql, companyId);
  const me = await userById(sql, userId);
  if (me.companyId === company.id) throw new UserError("You're already in it.", { code: "member" });
  if ((await membersOf(sql, company.id)) >= COMPANY_CAP)
    throw new UserError("That company is full.", { code: "company_full" });
  await sql.execute(
    "INSERT OR REPLACE INTO applications (user_id, company_id, at) VALUES (?, ?, ?)",
    userId,
    company.id,
    now,
  );
  return company;
}

export async function withdraw(sql: Sql, userId: number): Promise<void> {
  await sql.execute("DELETE FROM applications WHERE user_id = ?", userId);
}

/** The owner's side: the application from `applicantId` to their company, or an error. */
async function applicationTo(sql: Sql, company: CompanyRow, applicantId: unknown): Promise<number> {
  const row =
    typeof applicantId === "number"
      ? await one<{ userId: number }>(
          sql,
          "SELECT user_id AS userId FROM applications WHERE user_id = ? AND company_id = ?",
          applicantId,
          company.id,
        )
      : undefined;
  if (!row) throw new UserError("They're not asking to join any more.", { code: "not_found" });
  return row.userId;
}

/** Lets an applicant in: they leave their old company (if any) and join the owner's. */
export async function approve(
  sql: Sql,
  company: CompanyRow,
  applicantId: unknown,
  now: number,
): Promise<Changed> {
  const userId = await applicationTo(sql, company, applicantId);
  if ((await membersOf(sql, company.id)) >= COMPANY_CAP)
    throw new UserError("Your company is full.", { code: "company_full" });
  const left = await leave(sql, userId);
  await sql.execute("UPDATE users SET company_id = ?, joined_at = ? WHERE id = ?", company.id, now, userId);
  await withdraw(sql, userId);
  return { users: [userId], companies: [...left.companies, company.id] };
}

/** Turns an applicant down. Returns who it was. */
export async function decline(sql: Sql, company: CompanyRow, applicantId: unknown): Promise<number> {
  const userId = await applicationTo(sql, company, applicantId);
  await withdraw(sql, userId);
  return userId;
}

export async function companyInfos(sql: Sql, ids: Ids): Promise<CompanyInfo[]> {
  const today = dayKey(Date.now());
  const [where, ...args] = among("c.id", ids);
  const rows = await all<
    Omit<CompanyInfo, "brand" | "merch"> & { brand: string | null; merch: string | null }
  >(
    sql,
    `SELECT c.id, c.name, c.plot, c.website, c.brand, c.merch, c.desk_fleet AS deskFleet,
            (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id) AS members,
            COALESCE((SELECT SUM(${TOKENS}) FROM usage_daily d
                      JOIN users u ON u.id = d.user_id WHERE u.company_id = c.id AND d.day = ?), 0) AS todayTokens,
            COALESCE((SELECT SUM(${TOKENS}) FROM usage_daily d
                      JOIN users u ON u.id = d.user_id WHERE u.company_id = c.id AND d.day >= ?), 0) AS tokens30d
     FROM companies c WHERE ${where}`,
    today,
    addDays(today, -29),
    ...args,
  );
  return rows.map((r) => ({
    ...r,
    brand: r.brand === null ? null : (JSON.parse(r.brand) as Brand),
    merch: r.merch === null ? null : parseMerchDesign(JSON.parse(r.merch)),
  }));
}
