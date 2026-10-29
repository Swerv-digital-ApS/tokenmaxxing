import { deskIndex } from "@tokenmaxxing/core/desks.ts";
import { levelFor } from "@tokenmaxxing/core/format.ts";
import { dayKey } from "@tokenmaxxing/core/range.ts";
import { defaultLook, type Look, parseLook } from "@tokenmaxxing/core/world.ts";
import { must } from "hanzio";
import { UserError } from "rivetkit";
import { all, one, type Sql } from "../actors/shared.ts";

/** What `world` needs to draw someone; `town` owns all of it. */
export interface PlayerCore {
  id: number;
  name: string;
  look: Look;
  level: number;
  companyId: number | null;
  todayTokens: number;
  /** Their chosen desk setup, a tier in `DESKS`; optional so older world state still fits. */
  desk?: number;
}

export interface UserRow {
  id: number;
  name: string;
  companyId: number | null;
  look: string;
}

export const USER_COLS = "id, name, company_id AS companyId, look";

export const lookOf = (u: UserRow): Look => parseLook(JSON.parse(u.look)) ?? defaultLook(u.id);

export async function userById(sql: Sql, id: number): Promise<UserRow> {
  return must(
    await one<UserRow>(sql, `SELECT ${USER_COLS} FROM users WHERE id = ?`, id),
    () => new UserError("Unknown player.", { code: "not_found" }),
  );
}

/** Tokens counted everywhere: input, output, cache writes and cache reads (a `usage_daily` row). */
export const TOKENS = "input + output + cache_creation + cache_read";

/** Some ids, or `"all"` of them. */
export type Ids = number[] | "all";

/** `col IN ids` for SQL, with its argument: true for `"all"`. */
export const among = (col: string, ids: Ids): [string, ...unknown[]] =>
  ids === "all" ? ["TRUE"] : [`${col} IN (SELECT value FROM json_each(?))`, JSON.stringify(ids)];

/** Tokens per user, over `[from, to]` world days, or all time. */
export async function tokensIn(
  sql: Sql,
  userIds: Ids,
  [from, to] = ["0000-00-00", "9999-99-99"],
): Promise<Map<number, number>> {
  const [where, ...args] = among("user_id", userIds);
  const rows = await all<{ userId: number; tokens: number }>(
    sql,
    `SELECT user_id AS userId, SUM(${TOKENS}) AS tokens
     FROM usage_daily WHERE ${where} AND day >= ? AND day <= ? GROUP BY user_id`,
    ...args,
    from,
    to,
  );
  return new Map(rows.map((r) => [r.userId, r.tokens]));
}

/**
 * Each user's sign-up world day, by id, for `json_each`: only days from it pay and place (`wallet`),
 * and hit the raid boss.
 */
export async function signupDays(sql: Sql): Promise<Record<number, string>> {
  const users = await all<{ id: number; createdAt: number }>(
    sql,
    "SELECT id, created_at AS createdAt FROM users",
  );
  return Object.fromEntries(users.map((u) => [u.id, dayKey(u.createdAt)]));
}

export const levelOf = async (sql: Sql, userId: number): Promise<number> =>
  levelFor((await tokensIn(sql, [userId])).get(userId) ?? 0);

export async function playerCores(sql: Sql, userIds: Ids): Promise<PlayerCore[]> {
  const [where, ...args] = among("id", userIds);
  const users = await all<UserRow>(sql, `SELECT ${USER_COLS} FROM users WHERE ${where}`, ...args);
  const today = dayKey(Date.now());
  const [lifetime, todays, desks] = await Promise.all([
    tokensIn(sql, userIds),
    tokensIn(sql, userIds, [today, today]),
    all<{ id: number; desk: string | null }>(sql, `SELECT id, desk FROM users WHERE ${where}`, ...args),
  ]);
  const deskOf = new Map(desks.map((d) => [d.id, deskIndex(d.desk)]));
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    look: lookOf(u),
    level: levelFor(lifetime.get(u.id) ?? 0),
    companyId: u.companyId,
    todayTokens: todays.get(u.id) ?? 0,
    desk: deskOf.get(u.id) ?? 0,
  }));
}
