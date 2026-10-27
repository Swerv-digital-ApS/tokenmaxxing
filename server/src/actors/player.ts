import { BURN_WINDOW_MS } from "@tokenmaxxing/core/cop.ts";
import { MINUTE_CAP } from "@tokenmaxxing/core/games/tokenmaxxing.ts";
import type { Usage } from "@tokenmaxxing/core/games/types.ts";
import { HOUR_MS } from "@tokenmaxxing/core/grid.ts";
import { isOrgFeedSource } from "@tokenmaxxing/core/org-feed.ts";
import { formatPhoneCode, parsePhoneCode, phoneSecret } from "@tokenmaxxing/core/pairing.ts";
import type { TodayBySource } from "@tokenmaxxing/core/protocol.ts";
import { dayKey, worldClock } from "@tokenmaxxing/core/range.ts";
import type { Trophy } from "@tokenmaxxing/core/trophies.ts";
import type { IngestResponse, Source, TokenEvent } from "@tokenmaxxing/core/types.ts";
import { chunkArray, sumBy } from "hanzio";
import { actor, UserError } from "rivetkit";
import type { Client } from "rivetkit/client";
import { db } from "rivetkit/db";
import { sha256 } from "../crypto.ts";
import { reconcileCursorUsage } from "../cursor-usage.ts";
import { reconcileOrgUsage } from "../org-usage.ts";
import { RateLimiter } from "../rate-limit.ts";
import { AGENT_BUCKET_MS } from "../stats.ts";
import {
  backfillTrophies,
  clearTrophies,
  migrateTrophies,
  trophiesOf,
  trophyHoursChanged,
} from "../trophies.ts";
import { coalesceBattleUpdates, drainUsageReports, reportUsageDays } from "../usage-reports.ts";
import { MAX_EVENTS_PER_REQUEST, parseEvent } from "../validate.ts";
import type { registry } from "./registry.ts";
import {
  type Caller,
  type ConnParams,
  fromInside,
  INTERNAL_KEY,
  main,
  makeToken,
  requireInternal,
  type Sql,
  serial,
  splitToken,
  type TxSql,
  unauthorized,
  type Via,
  waitForTick,
} from "./shared.ts";
import type { ActivityDay, UsageDay } from "./town.ts";

const LOGIN_CODE_MS = 2 * 60_000;
const LINK_CODE_MS = 10 * 60_000;
/** The app plus linked computers. */
const MAX_DEVICES = 10;
/** `lastSeenAt` is written at most this often per device. */
const SEEN_EVERY_MS = 60_000;
const SESSION_MS = 30 * 86_400_000;
const LIVE_AGENTS_MS = 10 * 60_000;
const INSERT_CHUNK = 100;
/** Live login codes and browser sessions kept per player; minting more drops the oldest. */
const MAX_LOGIN_CODES = 5;
const MAX_SESSIONS = 20;
/**
 * Per player: a first sync's backfill still goes through at full speed (1,000 events a request),
 * a script can't fill the volume. Past either, the app's sync fails and resumes on its next run.
 */
const INGESTS_PER_MIN = 60;
const EVENTS_PER_DAY = 500_000;
/**
 * The most tokens a minute counts for, on the leaderboards and for coins: far past any real burst
 * (a busy day is ~1.5B, about 1M a minute), so it only stops made-up numbers. Battles cap harder
 * (`MINUTE_CAP`).
 */
export const USAGE_MINUTE_CAP = 200_000_000;

interface Expiring {
  hash: string;
  expiresAt: number;
}

/** A token that syncs: the desktop app's (from sign-up) or a linked computer's (from a link code). */
interface Device {
  id: number;
  hash: string;
  kind: "app" | "linked";
  /** The computer's name, as it gave it when linking. */
  name: string;
  /** `process.platform` of the computer: darwin, linux, … */
  platform: string;
  createdAt: number;
  lastSeenAt: number;
}

/** A device as its player sees it. */
export type DeviceInfo = Omit<Device, "hash"> & { current: boolean };

interface PlayerState {
  userId: number;
  devices: Device[];
  nextDeviceId: number;
  /** Browser sessions made from login codes. */
  sessions: Expiring[];
  loginCodes: Expiring[];
  /** Codes the app makes for linking another computer. */
  linkCodes: Expiring[];
  /** Events stored on a world day, for `EVENTS_PER_DAY`. Optional: players from before have none. */
  stored?: { day: string; events: number };
}

const COLUMNS = [
  "source",
  "session_id",
  "agent_id",
  "message_id",
  "request_id",
  "timestamp",
  "day",
  "model",
  "message_type",
  "input_tokens",
  "output_tokens",
  "cache_creation_tokens",
  "cache_read_tokens",
  "reasoning_tokens",
  "cost_cents",
];

const eventRow = (e: TokenEvent) => [
  e.source,
  e.sessionId,
  e.agentId,
  e.messageId,
  e.requestId,
  e.timestamp,
  dayKey(e.timestamp),
  e.model,
  e.messageType,
  e.inputTokens,
  e.outputTokens,
  e.cacheCreationTokens,
  e.cacheReadTokens,
  e.reasoningTokens,
  e.costCents ?? null,
];

const live = (list: Expiring[], now: number) => list.filter((e) => e.expiresAt > now);

/**
 * Shared by desktop sign-in and phone pairing: only hashes are persisted, never the code. A phone's code is
 * short enough to type (`42-K7QF-M2XP`); the desktop's goes in a link, so it stays long.
 */
function loginCode(state: PlayerState, phone = false): { code: string; expiresAt: number } {
  const now = Date.now();
  const secret = phone ? phoneSecret() : null;
  const { token, hash } = secret
    ? { token: formatPhoneCode(state.userId, secret), hash: sha256(secret) }
    : makeToken(state.userId);
  const expiresAt = now + LOGIN_CODE_MS;
  state.loginCodes = [...live(state.loginCodes, now), { hash, expiresAt }].slice(-MAX_LOGIN_CODES);
  return { code: token, expiresAt };
}

/** Which kind of credential `secret` is for this player (and which device), if any. */
function credential(s: PlayerState, secret: string, now: number): { via: Via; deviceId?: number } | null {
  const hash = sha256(secret);
  const device = s.devices.find((d) => d.hash === hash);
  if (device) return { via: device.kind === "app" ? "device" : "linked", deviceId: device.id };
  if (s.sessions.some((x) => x.hash === hash && x.expiresAt > now)) return { via: "session" };
  return null;
}

/** Every call from a device counts as it being around, for the list of computers. */
function seen(s: PlayerState, deviceId: number | undefined, now: number): void {
  const device = s.devices.find((d) => d.id === deviceId);
  if (device && now - device.lastSeenAt > SEEN_EVERY_MS) device.lastSeenAt = now;
}

/** A computer's name, as it'll be listed: printable, trimmed, at most 40 characters. */
function deviceName(raw: unknown): string {
  const name =
    typeof raw === "string"
      ? raw
          .replace(/[\p{C}]/gu, "")
          .trim()
          .slice(0, 40)
      : "";
  if (!name) throw new UserError("Give the computer a name.", { code: "invalid_name" });
  return name;
}

const platformOf = (raw: unknown): string =>
  typeof raw === "string" && /^[a-z0-9]{1,16}$/.test(raw) ? raw : "unknown";

/**
 * Insert `valid` and tell the town which days changed. A cloud row that matches a local turn is not
 * inserted (`overlaps`); a local row deletes the cloud row it replaces, and that day is reported too.
 */
async function commitUsage(
  db: TxSql,
  state: PlayerState,
  client: Client<typeof registry>,
  valid: TokenEvent[],
  now: number,
): Promise<{ inserted: number; overlaps: number }> {
  const today = dayKey(now);
  const stored = state.stored?.day === today ? state.stored.events : 0;
  if (stored >= EVENTS_PER_DAY)
    throw new UserError("That's a lot of events for one day. The rest syncs tomorrow.", {
      code: "rate_limited",
    });
  const days = new Set(valid.map((e) => dayKey(e.timestamp)));
  let overlaps = 0;
  const inserted = await db.transaction(
    async (tx) => {
      let n = 0;
      const cursor = await reconcileCursorUsage(tx, valid);
      const org = await reconcileOrgUsage(tx, cursor.events);
      overlaps = org.overlaps;
      for (const day of org.deletedDays) days.add(day);
      const reconciled = org.events;
      const deletedAt = [...cursor.deletedAt, ...org.deletedAt];
      for (const chunk of chunkArray(reconciled, INSERT_CHUNK)) {
        const row = `(${COLUMNS.map(() => "?").join(",")})`;
        const rows = await tx.execute(
          `INSERT OR IGNORE INTO events (${COLUMNS.join(",")}) VALUES ${chunk.map(() => row).join(",")} RETURNING id`,
          ...chunk.flatMap(eventRow),
        );
        n += rows.length;
        // Replay old Cursor IDs to enrich their cost without inserting tokens again.
        // A missing cost from an older client must not erase an already reported value.
        const costs = chunk.filter(
          (e) => (e.source === "cursor_local" || e.source === "grok_bot") && e.costCents != null,
        );
        if (costs.length)
          await tx.execute(
            `INSERT INTO events (${COLUMNS.join(",")}) VALUES ${costs.map(() => row).join(",")}
                 ON CONFLICT DO UPDATE SET cost_cents = excluded.cost_cents
                 WHERE events.cost_cents IS NOT excluded.cost_cents`,
            ...costs.flatMap(eventRow),
          );
        // Claude logs a response once per content block and only the last line has its final
        // usage, so one split across two syncs arrives twice: keep the larger numbers.
        const claude = chunk.filter(
          (e) =>
            (e.source === "claude_code" || e.source === "claude_cowork") && e.messageType === "assistant",
        );
        if (claude.length)
          await tx.execute(
            `INSERT INTO events (${COLUMNS.join(",")}) VALUES ${claude.map(() => row).join(",")}
                 ON CONFLICT DO UPDATE SET
                   input_tokens = MAX(events.input_tokens, excluded.input_tokens),
                   output_tokens = MAX(events.output_tokens, excluded.output_tokens),
                   cache_creation_tokens = MAX(events.cache_creation_tokens, excluded.cache_creation_tokens),
                   cache_read_tokens = MAX(events.cache_read_tokens, excluded.cache_read_tokens)
                 WHERE excluded.input_tokens > events.input_tokens
                    OR excluded.output_tokens > events.output_tokens
                    OR excluded.cache_creation_tokens > events.cache_creation_tokens
                    OR excluded.cache_read_tokens > events.cache_read_tokens`,
            ...claude.flatMap(eventRow),
          );
      }
      // Also queue duplicate-only retries: the previous request may have saved events but
      // failed to report them. Keeping this with the inserts survives crashes and partial sends.
      for (const day of days) await tx.execute("INSERT OR IGNORE INTO pending_usage_days VALUES (?)", day);
      await trophyHoursChanged(tx, [...valid.map((e) => e.timestamp), ...deletedAt]);
      return n;
    },
    { name: "ingest-events" },
  );
  state.stored = { day: today, events: stored + inserted };
  if (days.size) await reportUsageDays(db, [...days], (d) => report(db, client, state.userId, d, now));
  return { inserted, overlaps };
}

export const player = actor({
  // Building the new partial index can take longer for players with a large backfill.
  // The app syncs every 2 minutes. Asleep in between (the default is 30s), every sync woke the
  // player cold and read its database back from storage a page at a time.
  options: { onMigrateTimeout: 120_000, sleepTimeout: 5 * 60_000 },
  createState: (_c, raw: { userId: number; tokenHash: string; internal: string }): PlayerState => {
    const input = fromInside<{ userId: number; tokenHash: string }>(raw);
    const now = Date.now();
    return {
      userId: input.userId,
      devices: [
        {
          id: 1,
          hash: input.tokenHash,
          kind: "app",
          name: "Desktop app",
          platform: "darwin",
          createdAt: now,
          lastSeenAt: now,
        },
      ],
      nextDeviceId: 2,
      sessions: [],
      loginCodes: [],
      linkCodes: [],
    };
  },
  onWake: (c: { state: PlayerState }) => {
    // Before linked computers, a player kept only the app's token hashes.
    const old = c.state as PlayerState & { tokens?: string[] };
    if (old.tokens) {
      c.state.devices = old.tokens.map((hash, i) => ({
        id: i + 1,
        hash,
        kind: "app",
        name: "Desktop app",
        platform: "darwin",
        createdAt: 0,
        lastSeenAt: 0,
      }));
      c.state.nextDeviceId = old.tokens.length + 1;
      delete old.tokens;
    }
    c.state.linkCodes ??= [];
  },
  createVars: () => ({
    serial: serial(),
    ingests: new RateLimiter(INGESTS_PER_MIN, 60_000),
    phoneCodes: new RateLimiter(5, 60_000),
    /** Guesses at a short phone code: 10 a minute against 40 bits and at most 5 live codes. */
    phoneRedeems: new RateLimiter(10, 60_000),
    battleUpdate: coalesceBattleUpdates(),
    /** Trophies keep to their own lock: working them out must never hold up a sync. */
    trophyLock: serial(),
  }),
  db: db({ onMigrate: migrateEvents }),
  createConnState: (c, params: ConnParams): Caller => {
    if (params?.internal === INTERNAL_KEY) return { kind: "internal" };
    if (params?.token === undefined) return { kind: "anonymous" };
    const t = splitToken(params.token);
    const cred = t && t.userId === c.state.userId ? credential(c.state, t.secret, Date.now()) : null;
    if (!cred) throw unauthorized();
    seen(c.state, cred.deviceId, Date.now());
    return { kind: "user", userId: c.state.userId, ...cred };
  },
  // A wake also repairs totals from requests interrupted before the client could retry.
  run: async (c): Promise<void> => {
    const signal = c.abortSignal;
    while (!signal.aborted) {
      try {
        await c.keepAwake(cleanExcludedEvents(c.db, signal));
        await c.keepAwake(requeueEveryDay(c.db, signal));
        await c.keepAwake(backfillTrophies(c.db, c.vars.trophyLock, signal));
        await c.keepAwake(
          drainUsageReports(c.db, c.vars.serial, signal, (days) => {
            signal.throwIfAborted();
            return report(c.db, c.client<typeof registry>(), c.state.userId, days, Date.now());
          }),
        );
        return;
      } catch (err) {
        if (signal.aborted) return;
        console.warn(`[usage] report retry failed: ${String(err)}`);
        if (!(await waitForTick(signal, 5_000))) return;
      }
    }
  },
  actions: {
    /** For other actors checking a token: which credential it is, or null. */
    verify: (c, secret: string): Via | null => {
      requireInternal(c.conn.state);
      return credential(c.state, secret, Date.now())?.via ?? null;
    },

    /** The menu bar app's "Open world": a code the browser trades for a session. */
    mintLoginCode: (c): string => {
      requireDevice(c.conn.state);
      return loginCode(c.state).code;
    },

    /** An explicitly requested phone sign-in, authorized by the app or an existing game session. */
    mintPhoneLoginCode: (c): { code: string; expiresAt: number } => {
      const caller = c.conn.state;
      if (caller.kind !== "user" || caller.via === "linked") throw unauthorized();
      if (!c.vars.phoneCodes.take("pair", Date.now()))
        throw new UserError("Too many pairing codes. Try again in a minute.", { code: "rate_limited" });
      return loginCode(c.state, true);
    },

    /** Single use. Returns a 30-day browser session token. */
    redeemLoginCode: (c, code: string): string => {
      const now = Date.now();
      const phone = splitToken(code) ? null : parsePhoneCode(code);
      if (phone && !c.vars.phoneRedeems.take("redeem", now))
        throw new UserError("Too many tries. Wait a minute, then make a new code.", { code: "rate_limited" });
      const t = splitToken(code) ?? phone;
      const hash = t && t.userId === c.state.userId ? sha256(t.secret) : null;
      const codes = live(c.state.loginCodes, now);
      if (!hash || !codes.some((x) => x.hash === hash))
        throw new UserError("That link has expired. Open the world from the menu bar again.", {
          code: "expired",
        });
      c.state.loginCodes = codes.filter((x) => x.hash !== hash);
      const session = makeToken(c.state.userId);
      c.state.sessions = [
        ...live(c.state.sessions, now),
        { hash: session.hash, expiresAt: now + SESSION_MS },
      ].slice(-MAX_SESSIONS);
      return session.token;
    },

    /** The app's "Link a computer": a code the other computer trades for its own token. */
    mintLinkCode: (c): string => {
      requireDevice(c.conn.state);
      const now = Date.now();
      const { token, hash } = makeToken(c.state.userId);
      c.state.linkCodes = [...live(c.state.linkCodes, now), { hash, expiresAt: now + LINK_CODE_MS }].slice(
        -MAX_LOGIN_CODES,
      );
      return token;
    },

    /** Single use. Returns a token for the new computer, which can only sync. */
    redeemLinkCode: (
      c,
      code: string,
      rawName: unknown,
      rawPlatform: unknown,
    ): { token: string; deviceId: number } => {
      const name = deviceName(rawName);
      const now = Date.now();
      const t = splitToken(code);
      const hash = t && t.userId === c.state.userId ? sha256(t.secret) : null;
      const codes = live(c.state.linkCodes, now);
      if (!hash || !codes.some((x) => x.hash === hash))
        throw new UserError("That code has expired. Make a new one in the app: Link a computer.", {
          code: "expired",
        });
      if (c.state.devices.length >= MAX_DEVICES)
        throw new UserError(`At most ${MAX_DEVICES} computers. Remove one in the game first.`, {
          code: "too_many_devices",
        });
      c.state.linkCodes = codes.filter((x) => x.hash !== hash);
      const device = makeToken(c.state.userId);
      const id = c.state.nextDeviceId++;
      c.state.devices.push({
        id,
        hash: device.hash,
        kind: "linked",
        name,
        platform: platformOf(rawPlatform),
        createdAt: now,
        lastSeenAt: now,
      });
      return { token: device.token, deviceId: id };
    },

    /** My app and linked computers. */
    devices: (c): DeviceInfo[] => {
      const s = c.conn.state;
      if (s.kind !== "user" || s.via === "linked") throw unauthorized();
      return c.state.devices.map(({ hash: _, ...d }) => ({ ...d, current: d.id === s.deviceId }));
    },

    /**
     * Unlinks a computer: the player can remove any linked one, a linked computer only itself. The app's
     * own device stays, as losing it would lose the account.
     */
    revokeDevice: (c, id: number): void => {
      const s = c.conn.state;
      if (s.kind !== "user" || (s.via === "linked" && s.deviceId !== id)) throw unauthorized();
      const device = c.state.devices.find((d) => d.id === id);
      if (!device) throw new UserError("That computer isn't linked.", { code: "not_found" });
      if (device.kind === "app") throw new UserError("The app can't be removed.", { code: "forbidden" });
      c.state.devices = c.state.devices.filter((d) => d.id !== id);
    },

    /** From `town`, when an admin deletes the account: every token and session stops working. */
    close: (c): void => {
      requireInternal(c.conn.state);
      c.destroy();
    },

    /** From `town`, when an admin wipes someone's usage: every raw event goes, and the days they were on. */
    wipe: (c): Promise<string[]> => {
      requireInternal(c.conn.state);
      return c.vars.serial(async () => {
        const days = (await c.db.execute("SELECT DISTINCT day FROM events")) as { day: string }[];
        await c.db.execute("DELETE FROM events");
        await c.db.execute("DELETE FROM pending_usage_days");
        await c.vars.trophyLock(() => clearTrophies(c.db));
        return days.map((d) => d.day);
      });
    },

    /**
     * My tokens today by source (Claude Code, Codex, …) and PRs opened today, for the menu bar: shows
     * which apps' usage arrived. Raw sums, so a minute over the cap reads higher here than in the total.
     */
    todayBySource: async (c): Promise<TodayBySource> => {
      requireSyncingDevice(c.conn.state);
      const rows = (await c.db.execute(
        `SELECT source, SUM(${EVENT_TOKENS}) AS tokens, SUM(message_type = 'pr') AS prs FROM events
         WHERE day = ? AND message_type IN ('assistant', 'pr') GROUP BY source ORDER BY tokens DESC`,
        dayKey(Date.now()),
      )) as { source: Source; tokens: number; prs: number }[];
      return {
        sources: rows.filter((r) => r.tokens > 0).map(({ source, tokens }) => ({ source, tokens })),
        prs: sumBy(rows, "prs"),
      };
    },

    /** For `town`: the trophies on my office shelf. */
    trophies: (c): Promise<Trophy[]> => {
      requireInternal(c.conn.state);
      return c.vars.trophyLock(() => trophiesOf(c.db, Date.now()));
    },

    /** A usage game's score (Tokenmaxxing). */
    tokensBetween: (c, from: number, to: number): Promise<Usage> => {
      requireInternal(c.conn.state);
      return tokensBetween(c.db, from, to);
    },

    ingest: (c, events: unknown): Promise<IngestResponse & { skipped: number }> => {
      requireSyncingDevice(c.conn.state);
      if (!Array.isArray(events) || events.length > MAX_EVENTS_PER_REQUEST)
        throw new UserError("Too many events.", { code: "invalid_body" });
      const now = Date.now();
      if (!c.vars.ingests.take("sync", now))
        throw new UserError("Syncing too often. Try again in a minute.", { code: "rate_limited" });
      const valid: TokenEvent[] = [];
      for (const raw of events) {
        const e = parseEvent(raw, now);
        // Cloud rows arrive only through the organization feed. A device that sends them is skipped.
        if (typeof e === "string" || isOrgFeedSource(e.source)) continue;
        valid.push(e);
      }
      const ingested = c.vars.serial(async () => {
        const { inserted } = await commitUsage(c.db, c.state, c.client<typeof registry>(), valid, now);
        return { inserted, duplicates: valid.length - inserted, skipped: events.length - valid.length };
      });
      return ingested.then((result) => {
        if (valid.length > 0) {
          const signal = c.abortSignal;
          c.waitUntil(
            drainUsageReports(c.db, c.vars.serial, signal, (days) =>
              report(c.db, c.client<typeof registry>(), c.state.userId, days, Date.now()),
            ).catch(() => {}),
          );
          const arcade = main(c.client()).arcade;
          const userId = c.state.userId;
          // The raw events and totals are already acknowledged. A slow match must not keep the
          // ingest lock or delay this response, and backfills must not queue a call for every batch.
          c.waitUntil(
            c.vars
              .battleUpdate(async () => {
                if (!signal.aborted) await arcade.usage(userId);
              })
              .catch(() => {}),
          );
        }
        return result;
      });
    },

    /**
     * Organization feed only: `claude_cloud` and `codex_cloud`, already validated. The device limiter
     * does not apply; the day cap does. Called with the internal key from the HTTP handler.
     */
    ingestOrg: (c, events: unknown): Promise<{ inserted: number; duplicates: number; overlaps: number }> => {
      requireInternal(c.conn.state);
      if (!Array.isArray(events) || events.length > MAX_EVENTS_PER_REQUEST)
        throw new UserError("Too many events.", { code: "invalid_body" });
      const now = Date.now();
      const valid: TokenEvent[] = [];
      for (const raw of events) {
        const e = parseEvent(raw, now);
        if (typeof e === "string" || !isOrgFeedSource(e.source))
          throw new UserError("Invalid event.", { code: "invalid_event" });
        valid.push(e);
      }
      const ingested = c.vars.serial(async () => {
        const { inserted, overlaps } = await commitUsage(
          c.db,
          c.state,
          c.client<typeof registry>(),
          valid,
          now,
        );
        return { inserted, duplicates: valid.length - overlaps - inserted, overlaps };
      });
      return ingested.then((result) => {
        if (valid.length > 0) {
          const signal = c.abortSignal;
          c.waitUntil(
            drainUsageReports(c.db, c.vars.serial, signal, (days) =>
              report(c.db, c.client<typeof registry>(), c.state.userId, days, Date.now()),
            ).catch(() => {}),
          );
          const arcade = main(c.client()).arcade;
          const userId = c.state.userId;
          c.waitUntil(
            c.vars
              .battleUpdate(async () => {
                if (!signal.aborted) await arcade.usage(userId);
              })
              .catch(() => {}),
          );
        }
        return result;
      });
    },
  },
});

/** Upgrade existing player databases without re-enqueuing history on each wake. */
export async function migrateEvents(d: Sql): Promise<void> {
  await d.execute(`CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY,
    source TEXT NOT NULL,
    session_id TEXT NOT NULL,
    agent_id TEXT,
    message_id TEXT NOT NULL,
    request_id TEXT,
    timestamp INTEGER NOT NULL,
    day TEXT NOT NULL,
    model TEXT NOT NULL,
    message_type TEXT NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    cache_creation_tokens INTEGER NOT NULL,
    cache_read_tokens INTEGER NOT NULL,
    reasoning_tokens INTEGER
  )`);
  const eventColumns = (await d.execute("PRAGMA table_info(events)")) as { name: string }[];
  if (!eventColumns.some((c) => c.name === "cost_cents")) {
    await d.execute("ALTER TABLE events ADD COLUMN cost_cents REAL");
  }
  // Re-sent events are dropped here; the app relies on it after a crash or reinstall.
  await d.execute(`CREATE UNIQUE INDEX IF NOT EXISTS events_dedup
    ON events (source, message_id, COALESCE(request_id, ''), message_type)`);
  await d.execute("CREATE INDEX IF NOT EXISTS events_day ON events (day, message_type)");
  await d.execute("CREATE INDEX IF NOT EXISTS events_time ON events (timestamp)");
  // Recent activity and MAX(timestamp) must not read a player's entire history.
  await d.execute(`CREATE INDEX IF NOT EXISTS events_assistant_time
    ON events (timestamp, session_id, agent_id) WHERE message_type = 'assistant'`);
  await d.execute("CREATE TABLE IF NOT EXISTS pending_usage_days (day TEXT PRIMARY KEY)");
  // Reconcile old totals once when upgrading: earlier versions acknowledged duplicate retries
  // without reporting their days. A failed repair remains in the persistent queue.
  await d.execute("CREATE TABLE IF NOT EXISTS usage_report_migrations (version INTEGER PRIMARY KEY)");
  if (!(await d.execute("SELECT 1 FROM usage_report_migrations WHERE version = 1")).length) {
    await d.execute("INSERT OR IGNORE INTO pending_usage_days SELECT DISTINCT day FROM events");
    await d.execute("INSERT OR IGNORE INTO usage_report_migrations VALUES (1)");
  }
  // Where the excluded-bots cleanup and card v2's re-queue have got to (`cleanExcludedEvents`,
  // `requeueEveryDay`), by event id.
  await d.execute("CREATE TABLE IF NOT EXISTS excluded_cleanup (last_id INTEGER NOT NULL)");
  await d.execute("CREATE TABLE IF NOT EXISTS requeue_cursor (last_id INTEGER NOT NULL)");
  await migrateTrophies(d);
}

/** Events per batch of `cleanExcludedEvents`: each is a short scan, so the actor stays responsive. */
const CLEANUP_BATCH = 2_000;

/**
 * Removes Cursor-tagged Grok Bot rows and re-reports their days, once. A later sync can store the
 * same dashboard rows as `grok_bot`; leaving the Cursor copies would count them twice. It runs in
 * the background, a range of ids at a time, picking up where it stopped: in `onMigrate`, one
 * statement over a big history outlived the 30 s startup limit and left the player unable to start.
 */
export async function cleanExcludedEvents(d: Sql, signal?: AbortSignal): Promise<void> {
  if ((await d.execute("SELECT 1 FROM usage_report_migrations WHERE version = 4")).length) return;
  // Version 3 finished on an exact model list and left its cursor at the end of the table.
  // Start over once so any other `grok-bot*` row still tagged as Cursor is removed, then resume
  // from `excluded_cleanup` if this pass is interrupted. `grok_bot` rows are the copy we keep.
  if ((await d.execute("SELECT 1 FROM usage_report_migrations WHERE version = 3")).length) {
    await d.execute("DELETE FROM excluded_cleanup");
    await d.execute("DELETE FROM usage_report_migrations WHERE version = 3");
  }
  // The unary `+` keeps SQLite on the id range: through the `source` index, every batch would scan
  // all of a player's Cursor events. The model test matches `isGrokBotModel`.
  const match = `+source = 'cursor_local' AND (+model = 'grok-bot' OR +model GLOB 'grok-bot-*') AND id > ? AND id <= ?`;
  const [{ last } = { last: 0 }] = (await d.execute("SELECT last_id AS last FROM excluded_cleanup")) as {
    last: number;
  }[];
  const [{ max } = { max: 0 }] = (await d.execute("SELECT COALESCE(MAX(id), 0) AS max FROM events")) as {
    max: number;
  }[];
  for (let from = last; from < max; from += CLEANUP_BATCH) {
    signal?.throwIfAborted();
    const to = from + CLEANUP_BATCH;
    // Re-running a batch after a crash is harmless: the days are queued again and nothing is left to delete.
    await d.execute(
      `INSERT OR IGNORE INTO pending_usage_days SELECT DISTINCT day FROM events WHERE ${match}`,
      from,
      to,
    );
    await d.execute(
      `INSERT OR IGNORE INTO trophy_dirty SELECT DISTINCT timestamp / 3600000 FROM events WHERE ${match}`,
      from,
      to,
    );
    await d.execute(`DELETE FROM events WHERE ${match}`, from, to);
    await d.execute("DELETE FROM excluded_cleanup");
    await d.execute("INSERT INTO excluded_cleanup VALUES (?)", to);
  }
  await d.execute("INSERT OR IGNORE INTO usage_report_migrations VALUES (4)");
}

/**
 * Card v2's habit columns (sessions, subagents, hours, sources) are new on `activity_daily`: every
 * stored day is re-reported once, through the same drain, so history fills them in. In the
 * background, a range of ids at a time, picking up where it stopped: in `onMigrate`, reading a big
 * history cold outlived the 30 s startup limit, rolled back, and every start tried it again.
 */
export async function requeueEveryDay(d: Sql, signal?: AbortSignal): Promise<void> {
  if ((await d.execute("SELECT 1 FROM usage_report_migrations WHERE version = 5")).length) return;
  const [{ last } = { last: 0 }] = (await d.execute("SELECT last_id AS last FROM requeue_cursor")) as {
    last: number;
  }[];
  const [{ max } = { max: 0 }] = (await d.execute("SELECT COALESCE(MAX(id), 0) AS max FROM events")) as {
    max: number;
  }[];
  for (let from = last; from < max; from += CLEANUP_BATCH) {
    signal?.throwIfAborted();
    const to = from + CLEANUP_BATCH;
    await d.execute(
      "INSERT OR IGNORE INTO pending_usage_days SELECT DISTINCT day FROM events WHERE id > ? AND id <= ?",
      from,
      to,
    );
    await d.execute("DELETE FROM requeue_cursor");
    await d.execute("INSERT INTO requeue_cursor VALUES (?)", to);
  }
  await d.execute("INSERT OR IGNORE INTO usage_report_migrations VALUES (5)");
}

const EVENT_TOKENS = "input_tokens + output_tokens + cache_creation_tokens + cache_read_tokens";

/** Tokens in assistant events stamped from ≤ t < to, the same sum as the leaderboard, each minute capped (and flagged). */
export async function tokensBetween(sql: Sql, from: number, to: number): Promise<Usage> {
  const [r] = (await sql.execute(
    `SELECT COALESCE(SUM(MIN(t, ?)), 0) AS tokens, COALESCE(MAX(t > ?), 0) AS flagged FROM (
       SELECT SUM(input_tokens + output_tokens + cache_creation_tokens + cache_read_tokens) AS t
       FROM events WHERE message_type = 'assistant' AND timestamp >= ? AND timestamp < ?
       GROUP BY timestamp / 60000)`,
    MINUTE_CAP,
    MINUTE_CAP,
    from,
    to,
  )) as [{ tokens: number; flagged: number }];
  return { tokens: r.tokens, flagged: r.flagged === 1 };
}

/** The desktop app's own token. */
function requireDevice(caller: Caller): void {
  if (caller.kind !== "user" || caller.via !== "device") throw unauthorized();
}

/** The app or a linked computer: a token that sends usage, never a browser session. */
function requireSyncingDevice(caller: Caller): void {
  if (caller.kind !== "user" || caller.via === "session") throw unauthorized();
}

/** Recomputes `days` from raw events and hands them to `town`, then tells `world` how busy we are. */
export async function report(
  sql: Sql,
  client: Client<typeof registry>,
  userId: number,
  days: string[],
  now: number,
): Promise<void> {
  const inDays = `day IN (${days.map(() => "?").join(",")})`;
  // Each minute counts up to USAGE_MINUTE_CAP tokens: past it, that minute's events are scaled
  // down, and what didn't count is kept per day (`capped`) for the admin page to flag.
  const scaled = (col: string) =>
    `CAST(SUM(${col} * CASE WHEN t > ? THEN ? * 1.0 / t ELSE 1 END) AS INTEGER)`;
  const usage = (await sql.execute(
    `WITH minutes AS (
       SELECT day, model, timestamp / 60000 AS minute,
              SUM(input_tokens) AS input_tokens, SUM(output_tokens) AS output_tokens,
              SUM(cache_creation_tokens) AS cache_creation_tokens, SUM(cache_read_tokens) AS cache_read_tokens,
              SUM(COALESCE(cost_cents, 0)) AS reported_cost_cents,
              COUNT(*) AS turns
       FROM events WHERE ${inDays} AND message_type = 'assistant' GROUP BY day, model, minute),
     capped AS (SELECT *, SUM(${EVENT_TOKENS}) OVER (PARTITION BY minute) AS t FROM minutes)
     SELECT day, model, ${scaled("input_tokens")} AS input, ${scaled("output_tokens")} AS output,
            ${scaled("cache_creation_tokens")} AS cacheCreation, ${scaled("cache_read_tokens")} AS cacheRead,
            SUM(turns) AS turns, SUM(reported_cost_cents) AS reportedCostCents
     FROM capped
     GROUP BY day, model`,
    ...days,
    ...Array(4).fill([USAGE_MINUTE_CAP, USAGE_MINUTE_CAP]).flat(),
  )) as UsageDay[];
  const capped = (await sql.execute(
    `SELECT day, SUM(t - ?) AS tokens FROM (
       SELECT day, SUM(${EVENT_TOKENS}) AS t FROM events
       WHERE ${inDays} AND message_type = 'assistant' GROUP BY day, timestamp / 60000)
     WHERE t > ? GROUP BY day`,
    USAGE_MINUTE_CAP,
    ...days,
    USAGE_MINUTE_CAP,
  )) as { day: string; tokens: number }[];
  const counts = (await sql.execute(
    `SELECT day, SUM(message_type = 'user') AS prompts, SUM(message_type = 'pr') AS prs
     FROM events WHERE ${inDays} GROUP BY day`,
    ...days,
  )) as { day: string; prompts: number; prs: number }[];
  // ponytail: 5-minute buckets. Two sessions inside one bucket count as 2, and a
  // silent tool call over 5 min drops out. Merge activity intervals if people compare decimals.
  // One row per active bucket (at most 288 a day): the sums, the subagents and the hour of day are
  // worked out below, the hour on the world's clock (DST-correct, which SQL isn't).
  const bucketRows = (await sql.execute(
    `SELECT day, timestamp / ? AS bucket,
            COUNT(DISTINCT session_id || ':' || COALESCE(agent_id, '')) AS agents,
            COUNT(DISTINCT CASE WHEN COALESCE(agent_id, '') != '' THEN session_id || ':' || agent_id END) AS subs
     FROM events WHERE ${inDays} AND message_type = 'assistant'
     GROUP BY day, bucket`,
    AGENT_BUCKET_MS,
    ...days,
  )) as { day: string; bucket: number; agents: number; subs: number }[];
  const sessions = (await sql.execute(
    `SELECT day, COUNT(DISTINCT session_id) AS n FROM events
     WHERE ${inDays} AND message_type = 'assistant' GROUP BY day`,
    ...days,
  )) as { day: string; n: number }[];
  const sourceTokens = (await sql.execute(
    `SELECT day, source, SUM(${EVENT_TOKENS}) AS tokens FROM events
     WHERE ${inDays} AND message_type = 'assistant' GROUP BY day, source`,
    ...days,
  )) as { day: string; source: string; tokens: number }[];
  // Tokens by UTC hour, each minute capped like `usage` (Danish offsets are whole hours, so a UTC hour
  // is a world hour): green hours pay on these (`town/grid.ts`).
  const hourRows = (await sql.execute(
    `SELECT day, minute / 60 AS hour, SUM(MIN(t, ?)) AS tokens FROM (
       SELECT day, timestamp / 60000 AS minute, SUM(${EVENT_TOKENS}) AS t FROM events
       WHERE ${inDays} AND message_type = 'assistant' GROUP BY day, minute)
     GROUP BY day, hour`,
    USAGE_MINUTE_CAP,
    ...days,
  )) as { day: string; hour: number; tokens: number }[];
  const activity: ActivityDay[] = days.map((day) => {
    const n = counts.find((r) => r.day === day);
    const rows = bucketRows.filter((r) => r.day === day);
    const hours = Array<number>(24).fill(0);
    for (const r of rows) hours[worldClock(r.bucket * AGENT_BUCKET_MS).hour]!++;
    const hourTokens = Array<number>(24).fill(0);
    for (const r of hourRows) if (r.day === day) hourTokens[worldClock(r.hour * HOUR_MS).hour]! += r.tokens;
    const sources: Record<string, number> = {};
    for (const r of sourceTokens) if (r.day === day && r.tokens > 0) sources[r.source] = r.tokens;
    return {
      day,
      prompts: n?.prompts ?? 0,
      prs: n?.prs ?? 0,
      agentBuckets: rows.reduce((t, r) => t + r.agents, 0),
      activeBuckets: rows.length,
      peakAgents: rows.reduce((m, r) => Math.max(m, r.agents), 0),
      capped: capped.find((r) => r.day === day)?.tokens ?? 0,
      sessions: sessions.find((r) => r.day === day)?.n ?? 0,
      subBuckets: rows.reduce((t, r) => t + r.subs, 0),
      hours: hours.join(","),
      sources: rows.length ? JSON.stringify(sources) : "",
      hourTokens: hourTokens.some((n) => n > 0) ? hourTokens.join(",") : "",
    };
  });
  await main(client).town.report(userId, days, usage, activity);

  const [{ lastAt }] = (await sql.execute(
    "SELECT MAX(timestamp) AS lastAt FROM events WHERE message_type = 'assistant'",
  )) as [{ lastAt: number | null }];
  const [{ agents }] = (await sql.execute(
    `SELECT COUNT(DISTINCT session_id || ':' || COALESCE(agent_id, '')) AS agents
     FROM events WHERE message_type = 'assistant' AND timestamp > ?`,
    now - LIVE_AGENTS_MS,
  )) as [{ agents: number }];
  // How hard they're going (the dungeon fires their missiles at this rate), and the last hour's burn
  // for the 429 Cop (`core/src/cop.ts`): `tokensBetween` for both windows, in one pass.
  const [recent] = (await sql.execute(
    `SELECT COALESCE(SUM(MIN(live, ?)), 0) AS live, COALESCE(SUM(MIN(hour, ?)), 0) AS hour FROM (
       SELECT SUM(CASE WHEN timestamp >= ? AND timestamp < ? THEN ${EVENT_TOKENS} ELSE 0 END) AS live,
              SUM(CASE WHEN timestamp >= ? AND timestamp < ? THEN ${EVENT_TOKENS} ELSE 0 END) AS hour
       FROM events WHERE message_type = 'assistant' AND timestamp >= ? AND timestamp < ?
       GROUP BY timestamp / 60000)`,
    MINUTE_CAP,
    MINUTE_CAP,
    now - LIVE_AGENTS_MS,
    now + 1,
    now - BURN_WINDOW_MS,
    now,
    Math.min(now - LIVE_AGENTS_MS, now - BURN_WINDOW_MS),
    now + 1,
  )) as [{ live: number; hour: number }];
  const burn = Math.round(recent.live / (LIVE_AGENTS_MS / 60_000));
  if (lastAt !== null) await main(client).world.activity(userId, lastAt, agents, burn, recent.hour);
}
