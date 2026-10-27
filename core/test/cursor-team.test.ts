import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectCursorDashboard } from "../src/sync/cursor-dashboard.ts";
import { loadState } from "../src/sync/state.ts";
import { sync } from "../src/sync/sync.ts";
import type { Source, SyncState, TokenEvent } from "../src/types.ts";

const dirs: string[] = [];
const directory = () => {
  const dir = mkdtempSync(join(tmpdir(), "cursor-team-test-"));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const until = Date.UTC(2026, 9, 2);
const ME = 152683922;
const TEAM = 2168997;
const OTHER = TEAM + 5;
const credentials = () => ({ accountId: "account-hash", cookie: "WorkosCursorSessionToken=secret" });
const usage = (model: string, owningUser: number = ME, owningTeam: number = TEAM) => ({
  timestamp: String(until - 1000),
  model,
  kind: "Included",
  conversationId: "conv-1",
  owningUser: String(owningUser),
  owningTeam: String(owningTeam),
  chargedCents: 12.5,
  tokenUsage: { inputTokens: 10, outputTokens: 20, cacheWriteTokens: 30, cacheReadTokens: 40 },
});
const page = (rows: unknown[], total = rows.length) =>
  Response.json({ usageEventsDisplay: rows, totalUsageEventsCount: total });

interface Call {
  url: string;
  body: Record<string, unknown>;
  cookie: string | null;
  origin: string | null;
}

/** Personal call returns `personal`. Each team returns its scripted pages (one row per page when testing size 1). */
function dashboard(script: {
  personal?: unknown[];
  teams?: { id: number }[];
  pages?: Record<number, unknown[][]>;
  teamsStatus?: number;
}) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const headers = new Headers(init?.headers);
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    calls.push({ url, body, cookie: headers.get("cookie"), origin: headers.get("origin") });
    if (!url.startsWith("https://cursor.com/")) throw new Error(`cookie left cursor.com for ${url}`);
    if (url.endsWith("/api/dashboard/teams")) {
      if (script.teamsStatus) return new Response(null, { status: script.teamsStatus });
      return Response.json({
        teams: (script.teams ?? [{ id: TEAM }]).map((t) => ({ ...t, name: "secret-team" })),
      });
    }
    if (url.endsWith("/api/dashboard/team")) {
      return Response.json({
        userId: ME,
        teamMembers: [{ id: ME + 1, email: "teammate@example.com", name: "Teammate" }],
      });
    }
    if (body.teamId === undefined) return page(script.personal ?? []);
    const pages = script.pages?.[Number(body.teamId)] ?? [[]];
    const flat = pages.flat();
    const pageNo = Number(body.page ?? 1);
    const rows = pages.length > 1 ? (pages[pageNo - 1] ?? []) : flat;
    return page(rows, flat.length);
  }) as typeof fetch;
  return { calls, fetchImpl };
}

const enabled = new Set<Source>(["cursor_local"]);
const sendAll = (sent: TokenEvent[]) => async (events: TokenEvent[]) => {
  sent.push(...events);
  return { inserted: events.length, duplicates: 0 };
};

describe("Cursor team usage", () => {
  test("keeps the signed-in user's team rows, including Grok Bot, and drops everyone else", async () => {
    const sent: TokenEvent[] = [];
    const statePath = join(directory(), "sync.json");
    const { calls, fetchImpl } = dashboard({
      pages: {
        [TEAM]: [
          [
            usage("grok-bot-default"),
            usage("grok-bot-cua", ME + 1),
            usage("claude-4.6-opus"),
            { ...usage("grok-bot-automation"), owningUser: undefined },
          ],
        ],
      },
    });
    await sync(
      { files: {} },
      {
        statePath,
        enabled,
        send: sendAll(sent),
        now: () => until,
        cursorCredentials: credentials,
        cursorFetch: fetchImpl,
      },
    );
    expect(sent.map((e) => [e.model, e.source, e.costCents])).toEqual([
      ["grok-bot-default", "grok_bot", 12.5],
      ["claude-4.6-opus", "cursor_local", 12.5],
    ]);
    const usageCalls = calls.filter((c) => c.url.endsWith("/get-filtered-usage-events"));
    expect(usageCalls.map((c) => c.body.teamId)).toEqual([undefined, TEAM]);
    expect(usageCalls[1]!.body).toMatchObject({
      teamId: TEAM,
      userId: ME,
      startDate: "0",
      endDate: String(until),
      page: 1,
      pageSize: 1000,
    });
    expect(
      calls.every((c) => c.url.startsWith("https://cursor.com/") && c.origin === "https://cursor.com"),
    ).toBe(true);
    expect(calls.every((c) => c.cookie === "WorkosCursorSessionToken=secret")).toBe(true);
    const saved = JSON.stringify(await loadState(statePath));
    expect(saved).not.toContain("secret");
    expect(saved).not.toContain("teammate@example.com");
    expect(saved).toContain(`"checkedAt":${until}`);
  });

  test("a row the personal call already returned is not sent again from the team", async () => {
    const sent: TokenEvent[] = [];
    const row = usage("grok-bot-default");
    const { fetchImpl } = dashboard({ personal: [row], pages: { [TEAM]: [[row]] } });
    await sync(
      { files: {} },
      {
        statePath: join(directory(), "sync.json"),
        enabled,
        send: sendAll(sent),
        now: () => until,
        cursorCredentials: credentials,
        cursorFetch: fetchImpl,
      },
    );
    expect(sent).toHaveLength(1);
    expect(sent[0]!.source).toBe("grok_bot");
    expect(sent[0]!.messageId.startsWith("cursor-api:")).toBe(true);
  });

  test("a failed team list does not advance the checkpoint or echo the cookie", async () => {
    const statePath = join(directory(), "sync.json");
    let failures = 0;
    const { fetchImpl } = dashboard({ personal: [usage("grok-bot-default")], teamsStatus: 500 });
    const result = await sync(
      { files: {} },
      {
        statePath,
        enabled,
        send: async (events) => ({ inserted: events.length, duplicates: 0 }),
        now: () => until,
        cursorCredentials: credentials,
        onError: (err) => {
          failures++;
          expect(String(err)).not.toContain("secret");
        },
        cursorFetch: fetchImpl,
      },
    );
    expect(failures).toBe(1);
    expect(result.sent).toBe(1);
    expect(result.state.cursorApi).toBeUndefined();
    expect((await loadState(statePath)).cursorApi).toBeUndefined();
  });

  test("walks every team page and never keeps another member or the wrong team", async () => {
    const events: TokenEvent[] = [];
    let state: SyncState = { files: {} };
    const { calls, fetchImpl } = dashboard({
      teams: [{ id: TEAM }, { id: OTHER }],
      pages: {
        [TEAM]: [[usage("grok-bot-default", ME + 1)], [usage("grok-bot-automation")]],
        [OTHER]: [[usage("grok-bot-cua", ME, OTHER)], [usage("composer-2.5", ME, TEAM)]],
      },
    });
    for await (const batch of collectCursorDashboard(state, {
      enabled,
      now: () => until,
      pageSize: 1,
      cursorCredentials: credentials,
      cursorFetch: fetchImpl,
    })) {
      events.push(...batch.events);
      state = batch.commit(state);
    }
    // The teammate's row, and composer-2.5 (returned for OTHER but owned by TEAM), are both dropped.
    expect(events.map((e) => e.model).sort()).toEqual(["grok-bot-automation", "grok-bot-cua"]);
    expect(state.cursorApi).toEqual({ accountId: "account-hash", checkedAt: until });
    const teamUsage = calls.filter(
      (c) => c.url.endsWith("/get-filtered-usage-events") && c.body.teamId !== undefined,
    );
    expect(teamUsage.every((c) => c.body.userId === ME)).toBe(true);
    expect(new Set(teamUsage.map((c) => c.body.teamId))).toEqual(new Set([TEAM, OTHER]));
  });
});
