import { randomBytes } from "node:crypto";
import { ORG_CLAIM_MS, ORG_FEED_NOTICE, ORG_ID_RE } from "@tokenmaxxing/core/org-feed.ts";
import { all, one, type Sql } from "../actors/shared.ts";
import { sha256 } from "../crypto.ts";
import { RateLimiter } from "../rate-limit.ts";

/** Ten claim codes an hour per player. A new code replaces the previous one. */
export const orgClaimLimiter = new RateLimiter(10, 60 * 60_000);

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export interface OrgLink {
  orgId: string;
  email: string;
  linkedAt: number;
}

export interface OrgClaimView {
  orgId: string;
  expiresAt: number;
}

export function parseOrgId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const id = raw.trim().toLowerCase();
  return ORG_ID_RE.test(id) ? id : null;
}

/** Lowercase, one @, a dot in the domain. Not a full RFC parser: the org already knows its own addresses. */
export function parseFeedEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export async function migrateOrgFeed(sql: Sql): Promise<void> {
  await sql.execute(`CREATE TABLE IF NOT EXISTS org_feed_links (
    org_id TEXT NOT NULL, email TEXT NOT NULL, user_id INTEGER NOT NULL, linked_at INTEGER NOT NULL,
    PRIMARY KEY (org_id, email))`);
  await sql.execute("CREATE INDEX IF NOT EXISTS org_feed_links_user ON org_feed_links (user_id, org_id)");
  await sql.execute(`CREATE TABLE IF NOT EXISTS org_claims (
    code_hash TEXT PRIMARY KEY, org_id TEXT NOT NULL, user_id INTEGER NOT NULL, expires_at INTEGER NOT NULL)`);
  await sql.execute("CREATE INDEX IF NOT EXISTS org_claims_user ON org_claims (user_id)");
}

function claimCode(): string {
  const bytes = randomBytes(8);
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** A new code replaces any code this player still has. Only the hash is stored. */
export async function startOrgClaim(
  sql: Sql,
  userId: number,
  orgId: string,
  now: number,
): Promise<{ code: string; expiresAt: number; notice: string }> {
  const code = claimCode();
  const expiresAt = now + ORG_CLAIM_MS;
  await sql.execute("DELETE FROM org_claims WHERE user_id = ? OR expires_at <= ?", userId, now);
  await sql.execute(
    "INSERT INTO org_claims (code_hash, org_id, user_id, expires_at) VALUES (?, ?, ?, ?)",
    sha256(code),
    orgId,
    userId,
    expiresAt,
  );
  return { code, expiresAt, notice: ORG_FEED_NOTICE };
}

export async function orgFeedStatus(
  sql: Sql,
  userId: number,
  now: number,
): Promise<{ links: OrgLink[]; pending: OrgClaimView | null }> {
  await sql.execute("DELETE FROM org_claims WHERE expires_at <= ?", now);
  const links = await all<{ org_id: string; email: string; linked_at: number }>(
    sql,
    "SELECT org_id, email, linked_at FROM org_feed_links WHERE user_id = ? ORDER BY linked_at",
    userId,
  );
  const pending = await one<{ org_id: string; expires_at: number }>(
    sql,
    "SELECT org_id, expires_at FROM org_claims WHERE user_id = ? ORDER BY expires_at DESC LIMIT 1",
    userId,
  );
  return {
    links: links.map((r) => ({ orgId: r.org_id, email: r.email, linkedAt: r.linked_at })),
    pending: pending ? { orgId: pending.org_id, expiresAt: pending.expires_at } : null,
  };
}

export async function unlinkOrgForUser(sql: Sql, userId: number, orgId: string): Promise<void> {
  await sql.execute("DELETE FROM org_feed_links WHERE user_id = ? AND org_id = ?", userId, orgId);
  await sql.execute("DELETE FROM org_claims WHERE user_id = ? AND org_id = ?", userId, orgId);
}

export type BindResult = "linked" | "not_found" | "taken";

/** Redeem a claim. The same player linking the same email again is success. */
export async function bindOrgFeed(
  sql: Sql,
  orgId: string,
  code: string,
  email: string,
  now: number,
): Promise<BindResult> {
  await sql.execute("DELETE FROM org_claims WHERE expires_at <= ?", now);
  const claim = await one<{ user_id: number; org_id: string }>(
    sql,
    "SELECT user_id, org_id FROM org_claims WHERE code_hash = ?",
    sha256(code),
  );
  if (!claim || claim.org_id !== orgId) return "not_found";
  const holder = await one<{ user_id: number }>(
    sql,
    "SELECT user_id FROM org_feed_links WHERE org_id = ? AND email = ?",
    orgId,
    email,
  );
  if (holder && holder.user_id !== claim.user_id) return "taken";
  await sql.execute(
    `INSERT INTO org_feed_links (org_id, email, user_id, linked_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (org_id, email) DO UPDATE SET linked_at = excluded.linked_at`,
    orgId,
    email,
    claim.user_id,
    now,
  );
  await sql.execute("DELETE FROM org_claims WHERE code_hash = ?", sha256(code));
  return "linked";
}

export async function unlinkOrgEmail(sql: Sql, orgId: string, email: string): Promise<boolean> {
  const rows = await sql.execute(
    "DELETE FROM org_feed_links WHERE org_id = ? AND email = ? RETURNING user_id",
    orgId,
    email,
  );
  return rows.length > 0;
}

export async function playerForFeedEmail(sql: Sql, orgId: string, email: string): Promise<number | null> {
  const row = await one<{ user_id: number }>(
    sql,
    "SELECT user_id FROM org_feed_links WHERE org_id = ? AND email = ?",
    orgId,
    email,
  );
  return row?.user_id ?? null;
}
