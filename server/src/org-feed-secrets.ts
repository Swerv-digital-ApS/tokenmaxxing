import { timingSafeEqual } from "node:crypto";
import { ORG_ID_RE } from "@tokenmaxxing/core/org-feed.ts";
import { sha256 } from "./crypto.ts";

export interface OrgFeedSecret {
  orgId: string;
  /** sha256 hex of the bearer token. The token itself is not kept. */
  hash: string;
}

/**
 * `ORG_FEED_SECRETS=swerv:<secret>,other:<secret>`. The secret is at least 32 characters and is
 * never committed. A bad value fails boot. Empty (or unset) turns the feed off: every call is 401.
 */
export function parseOrgFeedSecrets(raw: string | undefined): OrgFeedSecret[] {
  if (!raw?.trim()) return [];
  const out: OrgFeedSecret[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(":");
    if (colon < 1) throw new Error("invalid ORG_FEED_SECRETS: expected orgId:secret");
    const orgId = trimmed.slice(0, colon).toLowerCase();
    const secret = trimmed.slice(colon + 1);
    if (!ORG_ID_RE.test(orgId)) throw new Error(`invalid ORG_FEED_SECRETS org id: ${orgId}`);
    if (secret.length < 32 || secret.length > 256) {
      throw new Error(`ORG_FEED_SECRETS secret for ${orgId} must be 32 to 256 characters`);
    }
    if (seen.has(orgId)) throw new Error(`ORG_FEED_SECRETS lists ${orgId} twice`);
    const hash = sha256(secret);
    if (out.some((f) => f.hash === hash)) throw new Error("ORG_FEED_SECRETS reuses a secret");
    seen.add(orgId);
    out.push({ orgId, hash });
  }
  return out;
}

/** Which organization presented this bearer token, compared in constant time. Null if none. */
export function orgIdForToken(token: string, feeds: readonly OrgFeedSecret[]): string | null {
  const got = Buffer.from(sha256(token));
  let found: string | null = null;
  for (const feed of feeds) {
    const expect = Buffer.from(feed.hash);
    if (expect.length === got.length && timingSafeEqual(got, expect)) found = feed.orgId;
  }
  return found;
}
