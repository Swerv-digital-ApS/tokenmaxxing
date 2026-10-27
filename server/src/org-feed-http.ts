import { isOrgFeedSource, ORG_CLAIM_CODE_RE, ORG_MESSAGE_PREFIX } from "@tokenmaxxing/core/org-feed.ts";
import type { TokenEvent } from "@tokenmaxxing/core/types.ts";
import type { OrgFeedSecret } from "./org-feed-secrets.ts";
import { orgIdForToken } from "./org-feed-secrets.ts";
import { RateLimiter } from "./rate-limit.ts";
import { parseFeedEmail } from "./town/org-feed.ts";
import { parseEvent } from "./validate.ts";

/** Bytes. A request of 1000 events fits; anything larger is refused before it is parsed as events. */
export const ORG_FEED_MAX_BYTES = 1_000_000;
const REQUESTS_PER_MIN = 60;

const DEVICE_SOURCES = new Set([
  "claude_code",
  "claude_cowork",
  "codex",
  "cursor_local",
  "cursor",
  "grok_bot",
  "grok",
  "github",
  "claude",
]);

export interface OrgIngestResult {
  inserted: number;
  duplicates: number;
  overlaps: number;
}

export interface OrgFeedDeps {
  secrets: () => readonly OrgFeedSecret[];
  now?: () => number;
  /** Test hook. Production uses one limiter for the process. */
  requests?: RateLimiter;
  playerForEmail: (orgId: string, email: string) => Promise<number | null>;
  bind: (orgId: string, code: string, email: string) => Promise<"linked" | "not_found" | "taken">;
  unlink: (orgId: string, email: string) => Promise<boolean>;
  ingest: (userId: number, events: TokenEvent[]) => Promise<OrgIngestResult>;
}

const requests = new RateLimiter(REQUESTS_PER_MIN, 60_000);

interface FeedEvent {
  email: string;
  event: TokenEvent;
}

type Parsed =
  | { ok: true; events: FeedEvent[]; deviceSync: number }
  | { ok: false; status: number; body: Record<string, unknown> };

function errorCode(err: unknown): string {
  if (!err || typeof err !== "object") return "";
  if ("code" in err && typeof err.code === "string") return err.code;
  const meta = "metadata" in err ? err.metadata : undefined;
  if (meta && typeof meta === "object" && meta !== null && "code" in meta && typeof meta.code === "string")
    return meta.code;
  return "";
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function fail(status: number, error: string, extra?: Record<string, unknown>): Response {
  return json({ error, ...extra }, status);
}

/** Bearer token, or null. The token is not logged. */
export function bearer(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer ([^\s]+)$/.exec(header);
  return match?.[1] ?? null;
}

async function readBody(req: Request): Promise<{ raw: string } | Response> {
  if (req.method !== "POST") return fail(405, "method_not_allowed");
  const type = req.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) return fail(415, "unsupported_type");
  const length = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > ORG_FEED_MAX_BYTES) return fail(413, "too_large");
  const raw = await req.text();
  if (raw.length > ORG_FEED_MAX_BYTES) return fail(413, "too_large");
  return { raw };
}

function authed(req: Request, deps: OrgFeedDeps): { orgId: string } | Response {
  const token = bearer(req);
  const feeds = deps.secrets();
  if (!token) return fail(401, "unauthorized");
  const orgId = orgIdForToken(token, feeds);
  if (!orgId) return fail(401, "unauthorized");
  const now = (deps.now ?? Date.now)();
  if (!(deps.requests ?? requests).take(orgId, now)) return fail(429, "rate_limited");
  return { orgId };
}

function versioned(value: unknown): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as { version?: unknown }).version === 1
  );
}

/**
 * One feed event, or why it can't be stored. Device sources are skipped, not rejected, so a push that
 * also contains Cursor or local Claude rows still lands the cloud rows. A bad field rejects the batch
 * before anything is written.
 */
function parseFeedEvents(raw: unknown, orgId: string, now: number): Parsed {
  if (!versioned(raw) || !Array.isArray(raw.events))
    return { ok: false, status: 400, body: { error: "invalid_body" } };
  if (raw.events.length > 1000) return { ok: false, status: 400, body: { error: "invalid_body" } };
  const events: FeedEvent[] = [];
  let deviceSync = 0;
  for (let index = 0; index < raw.events.length; index++) {
    const item = raw.events[index];
    if (!item || typeof item !== "object") {
      return { ok: false, status: 400, body: { error: "invalid_event", index, field: "event" } };
    }
    const row = item as Record<string, unknown>;
    const email = parseFeedEmail(row.email);
    if (!email) return { ok: false, status: 400, body: { error: "invalid_event", index, field: "email" } };
    if (typeof row.source !== "string") {
      return { ok: false, status: 400, body: { error: "invalid_event", index, field: "source" } };
    }
    if (DEVICE_SOURCES.has(row.source)) {
      deviceSync++;
      continue;
    }
    if (!isOrgFeedSource(row.source)) {
      return { ok: false, status: 400, body: { error: "invalid_event", index, field: "source" } };
    }
    if (typeof row.id !== "string" || !/^[\x21-\x7e]{1,200}$/.test(row.id)) {
      return { ok: false, status: 400, body: { error: "invalid_event", index, field: "id" } };
    }
    const parsed = parseEvent(
      {
        source: row.source,
        sessionId: `${ORG_MESSAGE_PREFIX}${orgId}`,
        agentId: null,
        messageId: `${ORG_MESSAGE_PREFIX}${orgId}:${row.id}`,
        requestId: null,
        timestamp: row.timestamp,
        model: row.model,
        messageType: "assistant",
        inputTokens: row.inputTokens,
        outputTokens: row.outputTokens,
        cacheCreationTokens: row.cacheCreationTokens ?? 0,
        cacheReadTokens: row.cacheReadTokens ?? 0,
        reasoningTokens: row.reasoningTokens ?? null,
      },
      now,
    );
    if (typeof parsed === "string") {
      return { ok: false, status: 400, body: { error: "invalid_event", index, field: parsed } };
    }
    events.push({ email, event: parsed });
  }
  return { ok: true, events, deviceSync };
}

async function authorized(
  req: Request,
  deps: OrgFeedDeps,
): Promise<{ orgId: string; body: unknown } | Response> {
  const gate = authed(req, deps);
  if (gate instanceof Response) return gate;
  const read = await readBody(req);
  if (read instanceof Response) return read;
  try {
    return { orgId: gate.orgId, body: JSON.parse(read.raw) as unknown };
  } catch {
    return fail(400, "invalid_body");
  }
}

/** `POST /api/v1/org-usage/link` */
export async function handleOrgLink(req: Request, deps: OrgFeedDeps): Promise<Response> {
  const got = await authorized(req, deps);
  if (got instanceof Response) return got;
  if (!versioned(got.body)) return fail(400, "invalid_body");
  const code = got.body.code;
  const email = parseFeedEmail(got.body.email);
  if (typeof code !== "string" || !ORG_CLAIM_CODE_RE.test(code)) return fail(400, "invalid_body");
  if (!email) return fail(400, "invalid_body");
  const result = await deps.bind(got.orgId, code, email);
  if (result === "not_found") return fail(404, "claim_not_found");
  if (result === "taken") return fail(409, "email_taken");
  return json({ linked: true });
}

/** `POST /api/v1/org-usage/unlink` */
export async function handleOrgUnlink(req: Request, deps: OrgFeedDeps): Promise<Response> {
  const got = await authorized(req, deps);
  if (got instanceof Response) return got;
  if (!versioned(got.body)) return fail(400, "invalid_body");
  const email = parseFeedEmail(got.body.email);
  if (!email) return fail(400, "invalid_body");
  return json({ unlinked: await deps.unlink(got.orgId, email) });
}

/**
 * `POST /api/v1/org-usage`. Validates the whole batch first. A later 500 can still mean earlier
 * players in that batch were stored; sending the batch again is safe.
 */
export async function handleOrgUsage(req: Request, deps: OrgFeedDeps): Promise<Response> {
  const got = await authorized(req, deps);
  if (got instanceof Response) return got;
  const now = (deps.now ?? Date.now)();
  const parsed = parseFeedEvents(got.body, got.orgId, now);
  if (!parsed.ok) return json(parsed.body, parsed.status);
  const byEmail = new Map<string, TokenEvent[]>();
  for (const row of parsed.events) {
    const list = byEmail.get(row.email) ?? [];
    list.push(row.event);
    byEmail.set(row.email, list);
  }
  let inserted = 0;
  let duplicates = 0;
  let overlaps = 0;
  let unlinked = 0;
  let rateLimited = 0;
  for (const [email, events] of byEmail) {
    const userId = await deps.playerForEmail(got.orgId, email);
    if (userId === null) {
      unlinked += events.length;
      continue;
    }
    try {
      const result = await deps.ingest(userId, events);
      inserted += result.inserted;
      duplicates += result.duplicates;
      overlaps += result.overlaps;
    } catch (err) {
      if (errorCode(err) === "rate_limited") {
        rateLimited += events.length;
        continue;
      }
      console.error("[org-feed] ingest failed");
      return json(
        {
          error: "ingest_failed",
          inserted,
          duplicates,
          overlaps,
          unlinked,
          deviceSync: parsed.deviceSync,
          rateLimited,
        },
        500,
      );
    }
  }
  return json({
    inserted,
    duplicates,
    overlaps,
    unlinked,
    deviceSync: parsed.deviceSync,
    rateLimited,
  });
}
