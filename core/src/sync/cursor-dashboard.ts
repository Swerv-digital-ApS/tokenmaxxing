import { createHash } from "node:crypto";
import { stat } from "node:fs/promises";
import {
  CURSOR_API_MESSAGE_PREFIX,
  type CursorCredentials,
  cursorStateDbPath,
  fetchCursorUsagePages,
  loadCursorCredentials,
} from "llm-usage-extraction";
import { isGrokBotModel, type Source, type SyncState, type TokenEvent } from "../types.ts";

/**
 * Personal dashboard reads (no team id) come from llm-usage-extraction. That package's request body
 * cannot name a team, and its repo is not this one, so team-billed rows are read here. Message ids
 * use the same hash as `cursor-api.ts` in llm-usage-extraction@0.2.0: a row both calls return is one
 * event. The session cookie is sent only to cursor.com, and never stored or put in an error.
 */

const ORIGIN = "https://cursor.com";
const TEAMS_URL = `${ORIGIN}/api/dashboard/teams`;
const TEAM_URL = `${ORIGIN}/api/dashboard/team`;
const USAGE_URL = `${ORIGIN}/api/dashboard/get-filtered-usage-events`;
/** Same cadence as llm-usage-extraction: Cursor publishes usage after the request finished. */
const EVERY_MS = 15 * 60_000;
const OVERLAP_MS = 7 * 24 * 60 * 60_000;
const PAGE_SIZE = 1000;

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export interface CursorDashboardOptions {
  enabled: ReadonlySet<Source>;
  now?: () => number;
  cursorDbPath?: string;
  cursorCredentials?: () => CursorCredentials;
  cursorFetch?: typeof fetch;
  onError?: (err: unknown, where: string) => void;
  /** Tests. Cursor accepts up to 1000. */
  pageSize?: number;
}

interface Batch {
  events: TokenEvent[];
  commit: (state: SyncState) => SyncState;
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid Cursor usage response.");
  }
  return value as Record<string, unknown>;
}

function count(value: unknown): number {
  if (value === undefined || value === null) return 0;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("Invalid Cursor token count.");
  }
  return value;
}

function reportedCostCents(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100_000_000) {
    throw new Error("Invalid Cursor cost.");
  }
  return value;
}

/** Team and user ids on the dashboard are positive integers, sometimes sent as strings. */
function numericId(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^[1-9]\d*$/.test(value)) {
    const n = Number(value);
    if (Number.isSafeInteger(n)) return n;
  }
  return null;
}

async function mtimeOf(path: string): Promise<number | null> {
  try {
    return (await stat(path)).mtimeMs;
  } catch {
    return null;
  }
}

/**
 * POST to cursor.com only. Redirects are an error: an unauthenticated dashboard route redirects to
 * the login host, and following it would send the cookie away from cursor.com.
 */
async function cursorPost(
  request: typeof fetch,
  url: string,
  body: unknown,
  cookie: string,
): Promise<Response> {
  if (new URL(url).origin !== ORIGIN) throw new Error("Cursor usage request failed. Try syncing again.");
  try {
    return await request(url, {
      method: "POST",
      redirect: "error",
      headers: {
        Cookie: cookie,
        Origin: ORIGIN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new Error("Cursor usage request failed. Try syncing again.");
  }
}

async function cursorJson(
  request: typeof fetch,
  url: string,
  body: unknown,
  cookie: string,
  reload: () => string,
): Promise<unknown> {
  let response = await cursorPost(request, url, body, cookie);
  if (response.status === 401) response = await cursorPost(request, url, body, reload());
  if (!response.ok) throw new Error(`Cursor usage API returned HTTP ${response.status}.`);
  try {
    return await response.json();
  } catch {
    throw new Error("Invalid Cursor usage response.");
  }
}

function teamIds(payload: unknown): number[] {
  const teams = record(payload).teams;
  if (!Array.isArray(teams)) throw new Error("Invalid Cursor teams response.");
  const ids: number[] = [];
  for (const raw of teams) {
    const id = numericId(record(raw).id);
    if (id === null) throw new Error("Invalid Cursor teams response.");
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * One dashboard row, as llm-usage-extraction identifies it. `occurrences` numbers identical rows
 * inside this response only, so the first copy uses the same id as the personal call's first copy.
 * Rows that are not the signed-in user's are dropped before they take a number.
 */
function teamEvents(
  rows: unknown[],
  accountId: string,
  userId: number,
  teamId: number,
  since: number,
  until: number,
  seen: Set<string>,
  want: { cursor: boolean; grok: boolean },
): TokenEvent[] {
  const occurrences = new Map<string, number>();
  const events: TokenEvent[] = [];
  for (const raw of rows) {
    const row = record(raw);
    const owner = numericId(row.owningUser);
    const ownerTeam = numericId(row.owningTeam);
    // Missing owner is not proof the row is ours. A team response can list every member.
    if (owner !== userId) continue;
    if (ownerTeam !== null && ownerTeam !== teamId) continue;
    if (row.tokenUsage === null || row.tokenUsage === undefined) continue;
    const usage = record(row.tokenUsage);
    if (
      !["inputTokens", "outputTokens", "cacheWriteTokens", "cacheReadTokens"].some(
        (key) => usage[key] !== undefined && usage[key] !== null,
      )
    )
      continue;
    const timestamp = typeof row.timestamp === "string" ? Number(row.timestamp) : row.timestamp;
    if (
      typeof timestamp !== "number" ||
      !Number.isSafeInteger(timestamp) ||
      timestamp <= 0 ||
      typeof row.model !== "string" ||
      !row.model
    )
      throw new Error("Invalid Cursor usage event.");
    if (timestamp < since || timestamp > until) continue;
    const tokens = {
      inputTokens: count(usage.inputTokens),
      outputTokens: count(usage.outputTokens),
      cacheCreationTokens: count(usage.cacheWriteTokens),
      cacheReadTokens: count(usage.cacheReadTokens),
    };
    const grok = isGrokBotModel(row.model);
    if (grok ? !want.grok : !want.cursor) continue;
    const key = hash(
      JSON.stringify([accountId, timestamp, row.model, row.kind ?? null, row.conversationId ?? null, tokens]),
    );
    const occurrence = occurrences.get(key) ?? 0;
    occurrences.set(key, occurrence + 1);
    const messageId = `${CURSOR_API_MESSAGE_PREFIX}${key}:${occurrence}`;
    if (seen.has(messageId)) continue;
    seen.add(messageId);
    const costCents = reportedCostCents(row.chargedCents) ?? reportedCostCents(usage.totalCents);
    events.push({
      source: grok ? "grok_bot" : "cursor_local",
      sessionId:
        typeof row.conversationId === "string" && row.conversationId
          ? row.conversationId
          : `cursor:${accountId}`,
      agentId: null,
      messageId,
      requestId: null,
      timestamp,
      model: row.model,
      messageType: "assistant",
      ...tokens,
      reasoningTokens: null,
      costCents,
    });
  }
  return events;
}

/**
 * The signed-in user's dashboard rows: the personal call, then each team they belong to, filtered
 * to their own user id. The checkpoint moves only after every page of that window was read.
 */
export async function* collectCursorDashboard(
  state: SyncState,
  opts: CursorDashboardOptions,
): AsyncGenerator<Batch> {
  const wantCursor = opts.enabled.has("cursor_local");
  // Enabling Cursor still reads Grok Bot off the same dashboard, as the personal call does.
  const wantGrok = opts.enabled.has("grok_bot") || wantCursor;
  if (!wantCursor && !wantGrok) return;

  const now = (opts.now ?? Date.now)();
  if (now - (state.cursorApi?.checkedAt ?? 0) < EVERY_MS) return;
  const dbPath = opts.cursorDbPath ?? cursorStateDbPath();
  if (!opts.cursorCredentials && (await mtimeOf(dbPath)) === null) return;

  const request = opts.cursorFetch ?? globalThis.fetch;
  const identity = (s: SyncState) => s;

  try {
    const pageSize = opts.pageSize ?? PAGE_SIZE;
    if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > PAGE_SIZE) {
      throw new Error("Invalid Cursor page size.");
    }
    const load = opts.cursorCredentials ?? (() => loadCursorCredentials(dbPath));
    // The package reads the login itself for the personal call. Team calls reuse the same loader.
    let credentials = load();
    const accountId = credentials.accountId;
    const since =
      state.cursorApi?.accountId === accountId ? Math.max(0, state.cursorApi.checkedAt - OVERLAP_MS) : 0;
    const seen = new Set<string>();
    const reload = () => {
      credentials = load();
      if (credentials.accountId !== accountId) {
        throw new Error("Cursor account changed during sync. Try syncing again.");
      }
      return credentials.cookie;
    };

    for await (const page of fetchCursorUsagePages({
      dbPath,
      since,
      until: now,
      credentials: () => {
        const next = load();
        if (next.accountId !== accountId) {
          throw new Error("Cursor account changed during sync. Try syncing again.");
        }
        credentials = next;
        return next;
      },
      expectedAccountId: accountId,
      fetch: request,
      pageSize,
    })) {
      const events: TokenEvent[] = [];
      for (const e of page.events) {
        const grok = e.source === "grok_bot";
        if (grok ? !wantGrok : e.source === "cursor_api" ? !wantCursor : true) continue;
        if (seen.has(e.messageId)) continue;
        seen.add(e.messageId);
        events.push({ ...e, source: grok ? "grok_bot" : "cursor_local" });
      }
      yield { events, commit: identity };
    }

    const teams = teamIds(await cursorJson(request, TEAMS_URL, {}, credentials.cookie, reload));
    for (const teamId of teams) {
      const userId = numericId(
        record(await cursorJson(request, TEAM_URL, { teamId }, credentials.cookie, reload)).userId,
      );
      if (userId === null) throw new Error("Invalid Cursor team response.");
      for (let page = 1; page <= 1000; page++) {
        const data = record(
          await cursorJson(
            request,
            USAGE_URL,
            {
              teamId,
              userId,
              startDate: String(since),
              endDate: String(now),
              page,
              pageSize,
            },
            credentials.cookie,
            reload,
          ),
        );
        const rows = data.usageEventsDisplay;
        const total = count(data.totalUsageEventsCount);
        if (!Array.isArray(rows) || typeof data.totalUsageEventsCount !== "number") {
          throw new Error("Invalid Cursor usage response.");
        }
        const expectedRows = Math.min(Math.max(total - (page - 1) * pageSize, 0), pageSize);
        if (rows.length < expectedRows || rows.length > pageSize) {
          throw new Error("Incomplete Cursor usage response.");
        }
        yield {
          events: teamEvents(rows, accountId, userId, teamId, since, now, seen, {
            cursor: wantCursor,
            grok: wantGrok,
          }),
          commit: identity,
        };
        if (page * pageSize >= total) break;
        if (page === 1000) {
          throw new Error("Cursor usage pagination limit reached; sync state was not advanced.");
        }
      }
    }

    yield {
      events: [],
      commit: (s) => ({ ...s, cursorApi: { accountId, checkedAt: now } }),
    };
  } catch (err) {
    opts.onError?.(
      err instanceof Error ? err : new Error("Cursor usage request failed. Try syncing again."),
      "cursor_api",
    );
  }
}
