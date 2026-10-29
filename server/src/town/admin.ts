import { levelFor } from "@tokenmaxxing/core/format.ts";
import { addDays, dayKey } from "@tokenmaxxing/core/range.ts";
import { type Leader, RANKING } from "@tokenmaxxing/core/statue.ts";
import { houseTier } from "@tokenmaxxing/core/world.ts";
import { sortBy } from "hanzio";
import { UserError } from "rivetkit";
import { all, one, type Sql, scalar } from "../actors/shared.ts";
import { balances } from "./coins.ts";
import {
  type Changed,
  type CompanyRow,
  companyInfos,
  companyLedgerAdd,
  companyOrGone,
  companyWallet,
  dropCompany,
  leave,
  withdraw,
} from "./companies.ts";
import { forget as forgetMarket } from "./market.ts";
import { forget as forgetRequests } from "./requests.ts";
import { TOKENS, userById } from "./users.ts";

export interface AdminOverview {
  users: number;
  companies: number;
  signups24h: number;
  signups7d: number;
  /** People with usage today, and in the last 7 days. */
  activeToday: number;
  active7d: number;
  tokensToday: number;
  tokens30d: number;
  gamesToday: number;
  /** Every balance added up. */
  coins: number;
  deleted: number;
  /** People who sent tokens past the per-minute cap in the last 30 days. */
  flagged: number;
}

export interface AdminUser {
  id: number;
  name: string;
  createdAt: number;
  company: { id: number; name: string; isOwner: boolean } | null;
  level: number;
  tokensToday: number;
  tokens30d: number;
  tokensTotal: number;
  /** The last world day with usage. */
  lastDay: string | null;
  balance: number;
  items: number;
  games: number;
  /** Tokens past the per-minute cap in the last 30 days: they didn't count. More than 0 is suspicious. */
  capped30d: number;
  /** Their bio, if they wrote one, and how many people reported it. */
  bio: string | null;
  bioReports: number;
}

/** One thing done from the admin page. */
export interface AdminLogEntry {
  id: number;
  at: number;
  action: string;
  target: string;
  detail: string | null;
}

export interface AdminCompany {
  id: number;
  name: string;
  owner: { id: number; name: string };
  plot: number;
  website: string | null;
  branding: "working" | "failed" | null;
  createdAt: number;
  members: { id: number; name: string }[];
  applicants: number;
  tier: number;
  tokensToday: number;
  tokens30d: number;
  /** Coins in its wallet. */
  wallet: number;
}

export async function overview(sql: Sql, now: number): Promise<AdminOverview> {
  const today = dayKey(now);
  const week = addDays(today, -6);
  const coins = [...(await balances(sql, now)).values()].reduce((a, b) => a + b, 0);
  return {
    users: await scalar(sql, "SELECT COUNT(*) AS n FROM users"),
    companies: await scalar(sql, "SELECT COUNT(*) AS n FROM companies"),
    signups24h: await scalar(sql, "SELECT COUNT(*) AS n FROM users WHERE created_at >= ?", now - 86_400_000),
    signups7d: await scalar(
      sql,
      "SELECT COUNT(*) AS n FROM users WHERE created_at >= ?",
      now - 7 * 86_400_000,
    ),
    activeToday: await scalar(
      sql,
      "SELECT COUNT(DISTINCT user_id) AS n FROM usage_daily WHERE day = ?",
      today,
    ),
    active7d: await scalar(sql, "SELECT COUNT(DISTINCT user_id) AS n FROM usage_daily WHERE day >= ?", week),
    tokensToday: await scalar(sql, `SELECT SUM(${TOKENS}) AS n FROM usage_daily WHERE day = ?`, today),
    tokens30d: await scalar(
      sql,
      `SELECT SUM(${TOKENS}) AS n FROM usage_daily WHERE day >= ?`,
      addDays(today, -29),
    ),
    gamesToday: await scalar(
      sql,
      "SELECT COUNT(DISTINCT match_id) AS n FROM match_players WHERE day = ?",
      today,
    ),
    coins,
    deleted: await scalar(sql, "SELECT COUNT(*) AS n FROM deleted_users"),
    flagged: await scalar(
      sql,
      "SELECT COUNT(DISTINCT user_id) AS n FROM capped_daily WHERE day >= ?",
      addDays(today, -29),
    ),
  };
}

/** Everyone, newest first. */
export async function users(sql: Sql, now: number): Promise<AdminUser[]> {
  const today = dayKey(now);
  const rows = await all<{
    id: number;
    name: string;
    createdAt: number;
    companyId: number | null;
    companyName: string | null;
    ownerId: number | null;
  }>(
    sql,
    `SELECT u.id, u.name, u.created_at AS createdAt, u.company_id AS companyId,
            c.name AS companyName, c.owner_id AS ownerId
     FROM users u LEFT JOIN companies c ON c.id = u.company_id ORDER BY u.id DESC`,
  );
  const usage = new Map(
    (
      await all<{ userId: number; today: number; d30: number; total: number; lastDay: string }>(
        sql,
        `SELECT user_id AS userId, SUM(${TOKENS}) AS total, MAX(day) AS lastDay,
                SUM(CASE WHEN day = ? THEN ${TOKENS} ELSE 0 END) AS today,
                SUM(CASE WHEN day >= ? THEN ${TOKENS} ELSE 0 END) AS d30
         FROM usage_daily GROUP BY user_id`,
        today,
        addDays(today, -29),
      )
    ).map((r) => [r.userId, r]),
  );
  const perUser = async (query: string) =>
    new Map((await all<{ userId: number; n: number }>(sql, query)).map((r) => [r.userId, r.n]));
  const items = await perUser("SELECT owner_id AS userId, COUNT(*) AS n FROM items GROUP BY owner_id");
  const games = await perUser("SELECT user_id AS userId, COUNT(*) AS n FROM match_players GROUP BY user_id");
  const capped = new Map(
    (
      await all<{ userId: number; n: number }>(
        sql,
        "SELECT user_id AS userId, SUM(tokens) AS n FROM capped_daily WHERE day >= ? GROUP BY user_id",
        addDays(today, -29),
      )
    ).map((r) => [r.userId, r.n]),
  );
  const bioReports = await perUser("SELECT target AS userId, COUNT(*) AS n FROM bio_reports GROUP BY target");
  const bios = new Map(
    (await all<{ id: number; bio: string }>(sql, "SELECT id, bio FROM users WHERE bio IS NOT NULL")).map(
      (r) => [r.id, r.bio],
    ),
  );
  const coins = await balances(sql, now);
  return rows.map((r) => {
    const u = usage.get(r.id);
    return {
      id: r.id,
      name: r.name,
      createdAt: r.createdAt,
      company:
        r.companyId === null ? null : { id: r.companyId, name: r.companyName!, isOwner: r.ownerId === r.id },
      level: levelFor(u?.total ?? 0),
      tokensToday: u?.today ?? 0,
      tokens30d: u?.d30 ?? 0,
      tokensTotal: u?.total ?? 0,
      lastDay: u?.lastDay ?? null,
      balance: coins.get(r.id) ?? 0,
      items: items.get(r.id) ?? 0,
      games: games.get(r.id) ?? 0,
      capped30d: capped.get(r.id) ?? 0,
      bio: bios.get(r.id) ?? null,
      bioReports: bioReports.get(r.id) ?? 0,
    };
  });
}

/** Every company, busiest first (30-day tokens). */
export async function companies(sql: Sql): Promise<AdminCompany[]> {
  const rows = await all<{
    id: number;
    ownerId: number;
    ownerName: string | null;
    branding: AdminCompany["branding"];
    createdAt: number;
    applicants: number;
    wallet: number;
  }>(
    sql,
    `SELECT c.id, c.owner_id AS ownerId, o.name AS ownerName, c.branding, c.created_at AS createdAt,
            (SELECT COUNT(*) FROM applications a WHERE a.company_id = c.id) AS applicants,
            (SELECT COALESCE(SUM(amount), 0) FROM company_ledger l WHERE l.company_id = c.id) AS wallet
     FROM companies c LEFT JOIN users o ON o.id = c.owner_id`,
  );
  const infos = new Map((await companyInfos(sql, "all")).map((i) => [i.id, i]));
  const members = await all<{ id: number; name: string; companyId: number }>(
    sql,
    "SELECT id, name, company_id AS companyId FROM users WHERE company_id IS NOT NULL ORDER BY joined_at, id",
  );
  return sortBy(
    rows.map((r) => {
      const info = infos.get(r.id)!;
      return {
        id: r.id,
        name: info.name,
        owner: { id: r.ownerId, name: r.ownerName ?? "?" },
        plot: info.plot,
        website: info.website,
        branding: r.branding,
        createdAt: r.createdAt,
        members: members.filter((m) => m.companyId === r.id).map(({ id, name }) => ({ id, name })),
        applicants: r.applicants,
        tier: houseTier(info.tokens30d, info.members),
        tokensToday: info.todayTokens,
        tokens30d: info.tokens30d,
        wallet: r.wallet,
      };
    }),
    { by: "tokens30d", order: "desc" },
  );
}

/**
 * Deletes an account: its usage, activity, purchases, items (those it dropped too, but for company
 * furniture, which stays the company's), rewards, office,
 * application, trade offers and company seat (the company hands over or closes, as when leaving).
 * Refused while they have coins on a game that isn't settled, so no pot comes up short. Their `ledger`
 * and `match_players` rows stay: other players' games add up with them, and ids are never reused
 * (`deleted_users`).
 */
export async function deleteUser(sql: Sql, userId: number, now: number): Promise<Changed> {
  const u = await userById(sql, userId);
  const playing = await one(
    sql,
    `SELECT ref FROM ledger WHERE kind NOT IN ('admin', 'case', 'vendor', 'roulette') AND ref IN (SELECT ref FROM ledger WHERE user_id = ?)
     GROUP BY ref HAVING SUM(amount) < 0 LIMIT 1`,
    userId,
  );
  if (playing)
    throw new UserError(`${u.name} has coins in a game that isn't over. Try again when it is.`, {
      code: "playing",
    });
  const changed = await leave(sql, userId);
  await withdraw(sql, userId);
  await sql.execute("DELETE FROM trades WHERE from_id = ? OR to_id = ?", userId, userId);
  // Their display in the hall comes down first: the items go back to their bag and go with it below.
  await forgetMarket(sql, userId);
  await wipeUsage(sql, userId);
  for (const table of [
    "purchases",
    "rewards",
    "offices",
    "badge_awards",
    "showcase",
    "tavern_daily",
    "julekalender",
    "fastelavn_hits",
    "fishing_journal",
    "fishing_days",
    "fishing_records",
    "fishing_treasures",
    "fishing_feats",
  ])
    await sql.execute(`DELETE FROM ${table} WHERE user_id = ?`, userId);
  await sql.execute("DELETE FROM bio_reports WHERE target = ? OR reporter = ?", userId, userId);
  await forgetRequests(sql, userId);
  await sql.execute(
    "DELETE FROM items WHERE owner_id = ? OR (owner_id IS NULL AND dropped_by = ? AND company_id IS NULL)",
    userId,
    userId,
  );
  await sql.execute("DELETE FROM office_visits WHERE owner_id = ? OR visitor_id = ?", userId, userId);
  await sql.execute("INSERT INTO deleted_users (id, name, at) VALUES (?, ?, ?)", userId, u.name, now);
  await sql.execute("DELETE FROM users WHERE id = ?", userId);
  return changed;
}

/**
 * Closes a company (`companyId` as the admin page sent it): everyone's out, its plot and logo are freed
 * and its applications dropped. Returns it as it was, and who was in it.
 */
export async function closeCompany(
  sql: Sql,
  companyId: unknown,
): Promise<{ company: CompanyRow; changed: Changed }> {
  const company = await companyOrGone(sql, companyId);
  const members = await all<{ id: number }>(sql, "SELECT id FROM users WHERE company_id = ?", company.id);
  await sql.execute("UPDATE users SET company_id = NULL, joined_at = NULL WHERE company_id = ?", company.id);
  await dropCompany(sql, company.id);
  return { company, changed: { users: members.map((m) => m.id), companies: [company.id] } };
}

/** Sets a company wallet: the difference goes in its ledger as kind `admin`. Run it serialized. */
export async function setCompanyWallet(
  sql: Sql,
  companyId: number,
  coins: number,
  userId: number,
  now: number,
): Promise<{ before: number; coins: number }> {
  const before = await companyWallet(sql, companyId);
  if (coins !== before) await companyLedgerAdd(sql, companyId, userId, coins - before, "admin", "admin", now);
  return { before, coins };
}

/** Forgets someone's usage (their `player` drops the raw events first): for faked numbers. */
export async function wipeUsage(sql: Sql, userId: number): Promise<void> {
  for (const table of ["usage_daily", "activity_daily", "capped_daily"])
    await sql.execute(`DELETE FROM ${table} WHERE user_id = ?`, userId);
}

/** Text from the admin page, one line and trimmed, or `invalid_statue` when it's longer than `max` (or empty and required). */
function line(raw: unknown, what: string, max: number, required: boolean): string {
  const s = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  if ((required && !s) || s.length > max)
    throw new UserError(`The ${what} needs 1 to ${max} characters.`, { code: "invalid_statue" });
  return s;
}

/**
 * The admin's pick for the statue's plinth (`core/statue.ts`), over the ranking's: a model, who made it (a
 * provider's name gets its colour) and what it leads, LMArena's Text Arena when that's left empty.
 */
export function statuePin(model: unknown, org: unknown, ranking: unknown): Leader {
  return {
    model: line(model, "model", 48, true),
    org: line(org, "maker", 32, true),
    ranking: line(ranking, "ranking", 48, false) || RANKING,
    score: null,
    asOf: null,
  };
}

/** Every change made from the admin page is written down, with what it was before where that matters. */
export async function logAdmin(
  sql: Sql,
  action: string,
  target: string,
  detail: string | null,
  now: number,
): Promise<void> {
  await sql.execute(
    "INSERT INTO admin_log (at, action, target, detail) VALUES (?, ?, ?, ?)",
    now,
    action,
    target,
    detail,
  );
}

/** The newest 500 entries. */
export const adminLog = (sql: Sql): Promise<AdminLogEntry[]> =>
  all<AdminLogEntry>(sql, "SELECT id, at, action, target, detail FROM admin_log ORDER BY id DESC LIMIT 500");
