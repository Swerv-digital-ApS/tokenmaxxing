import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadState } from "../src/sync/state.ts";
import { sync } from "../src/sync/sync.ts";
import type { Source, TokenEvent } from "../src/types.ts";

const dirs: string[] = [];
const directory = () => {
  const dir = mkdtempSync(join(tmpdir(), "cursor-sync-test-"));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const credentials = () => ({ accountId: "account-hash", cookie: "WorkosCursorSessionToken=secret" });
const until = Date.UTC(2026, 9, 2);
const row = (timestamp = until - 1000) => ({
  timestamp: String(timestamp),
  model: "claude-4.6-opus",
  kind: "Included",
  tokenUsage: { inputTokens: 10, outputTokens: 20, cacheWriteTokens: 30, cacheReadTokens: 40 },
});
const page = (rows: unknown[], total = rows.length) =>
  Response.json({
    usageEventsDisplay: rows,
    totalUsageEventsCount: total,
  });
type Handler = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
/** A personal account: it belongs to no team. */
const fetcher = (fn: Handler) =>
  (async (input, init) =>
    String(input).endsWith("/teams") ? Response.json({ teams: [] }) : fn(input, init)) as typeof fetch;

describe("Cursor sync checkpoint", () => {
  const enabled = new Set<Source>(["cursor_local"]);
  const send = async (events: TokenEvent[]) => ({ inserted: events.length, duplicates: 0 });
  test("dashboard rows go out as cursor_local, Grok Bot's as grok_bot", async () => {
    const sent: TokenEvent[] = [];
    await sync(
      { files: {} },
      {
        statePath: join(directory(), "sync.json"),
        enabled,
        send: async (events) => {
          sent.push(...events);
          return send(events);
        },
        now: () => until,
        cursorCredentials: credentials,
        cursorFetch: fetcher(async () => page([row(), { ...row(), model: "grok-bot-default" }])),
      },
    );
    expect(sent.map((e) => [e.model, e.source])).toEqual([
      ["claude-4.6-opus", "cursor_local"],
      ["grok-bot-default", "grok_bot"],
    ]);
  });

  test("counts a team Grok Bot row whose model is empty", async () => {
    const ours = { owningUser: "42", owningTeam: 7 };
    const grokUsage = {
      inputTokens: 40_000,
      outputTokens: 21_800,
      cacheWriteTokens: 100,
      cacheReadTokens: 50,
    };
    const teamRows = [
      // Dashboard: Product "Grok Bot", Usage Type "Included", Model "-", Cost "-".
      {
        ...row(until - 2000),
        ...ours,
        model: "",
        clientType: "Grok Bot",
        kind: "Included",
        tokenUsage: grokUsage,
      },
      { ...row(until - 3000), ...ours, model: null, product: "grok-bot", tokenUsage: grokUsage },
      {
        ...row(until - 4000),
        ...ours,
        model: "  ",
        clientType: "sand",
        tokenUsage: { inputTokens: 5, outputTokens: 0 },
      },
      { ...row(until - 5000), owningUser: 43, owningTeam: 7, model: "", clientType: "grok-bot" },
      { ...row(until - 6000), ...ours, model: "composer-2.5" },
      { ...row(until - 7000), ...ours, model: "" },
    ];
    const sent: TokenEvent[] = [];
    await sync(
      { files: {} },
      {
        statePath: join(directory(), "sync.json"),
        enabled,
        send: async (events) => {
          sent.push(...events);
          return send(events);
        },
        now: () => until,
        cursorCredentials: credentials,
        onError: (err) => {
          throw err;
        },
        cursorFetch: (async (input: string | URL | Request, init?: RequestInit) => {
          const url = String(input);
          const body = JSON.parse(String(init?.body)) as { teamId?: number };
          if (url.endsWith("/teams")) return Response.json({ teams: [{ id: 7 }] });
          if (url.endsWith("/team")) return Response.json({ userId: 42 });
          if (!body.teamId) return page([row()]);
          return page(teamRows);
        }) as typeof fetch,
      },
    );
    const grok = sent.filter((e) => e.source === "grok_bot");
    const tokens = (e: TokenEvent) =>
      e.inputTokens + e.outputTokens + e.cacheCreationTokens + e.cacheReadTokens;
    expect(grok.map((e) => [e.model, tokens(e)])).toEqual([
      ["grok-bot", 61_950],
      ["grok-bot", 61_950],
      ["grok-bot", 5],
    ]);
    expect(grok.every((e) => e.costCents == null)).toBe(true);
    expect(sent.filter((e) => e.source === "cursor_local").map((e) => e.model)).toEqual([
      "claude-4.6-opus",
      "composer-2.5",
    ]);
  });

  test("checks every 15 minutes, overlaps seven days, and backfills a new account", async () => {
    const requests: Record<string, unknown>[] = [];
    let accountId = "first";
    const opts = {
      enabled,
      send,
      statePath: join(directory(), "sync.json"),
      cursorCredentials: () => ({ ...credentials(), accountId }),
      cursorFetch: fetcher(async (_url, init) => {
        requests.push(JSON.parse(String(init?.body)));
        return page([row()]);
      }),
    };
    let state = (await sync({ files: {} }, { ...opts, now: () => until })).state;
    state = (await sync(state, { ...opts, now: () => until + 60_000 })).state;
    expect(requests).toHaveLength(1);
    state = (await sync(state, { ...opts, now: () => until + 15 * 60_000 })).state;
    expect(requests[1]!.startDate).toBe(String(until - 7 * 24 * 60 * 60_000));
    accountId = "second";
    await sync(state, { ...opts, now: () => until + 30 * 60_000 });
    expect(requests[2]!.startDate).toBe("0");
    expect(JSON.stringify(await loadState(opts.statePath))).not.toContain("secret");
  });

  test("a failed send or API page never advances the Cursor checkpoint", async () => {
    const statePath = join(directory(), "sync.json");
    const opts = {
      statePath,
      enabled,
      cursorCredentials: credentials,
      now: () => until,
      cursorFetch: fetcher(async () => page([row()])),
    };
    await expect(
      sync(
        { files: {} },
        {
          ...opts,
          send: async () => {
            throw new Error("offline");
          },
        },
      ),
    ).rejects.toThrow("offline");
    expect((await loadState(statePath)).cursorApi).toBeUndefined();
    let failures = 0;
    const result = await sync(
      { files: {} },
      {
        ...opts,
        send,
        onError: () => {
          failures++;
        },
        cursorFetch: fetcher(async () => new Response(null, { status: 401 })),
      },
    );
    expect(failures).toBe(1);
    expect(result.state.cursorApi).toBeUndefined();
    expect((await sync(result.state, { ...opts, send })).state.cursorApi?.checkedAt).toBe(until);
  });

  test("a partially acknowledged backfill replays stable IDs before committing", async () => {
    const statePath = join(directory(), "sync.json");
    const rows = Array.from({ length: 1101 }, (_, i) => row(until - i - 1));
    const opts = {
      statePath,
      enabled,
      cursorCredentials: credentials,
      now: () => until,
      cursorFetch: fetcher(async (_url, init) => {
        const request = JSON.parse(String(init?.body));
        const offset = (request.page - 1) * request.pageSize;
        return page(rows.slice(offset, offset + request.pageSize), rows.length);
      }),
    };
    const stored = new Set<string>();
    let sends = 0;
    const sizes: number[] = [];
    const sending = async (events: TokenEvent[]) => {
      sizes.push(events.length);
      if (++sends === 2) throw new Error("offline");
      const before = stored.size;
      for (const e of events) stored.add(e.messageId);
      return { inserted: stored.size - before, duplicates: events.length - (stored.size - before) };
    };
    await expect(sync({ files: {} }, { ...opts, send: sending })).rejects.toThrow("offline");
    const state = await loadState(statePath);
    expect(state.cursorApi).toBeUndefined();
    const result = await sync(state, { ...opts, send: sending });
    expect(sizes).toEqual([1000, 101, 1000, 101]);
    expect(stored.size).toBe(1101);
    expect(result.inserted).toBe(101);
    expect(result.state.cursorApi?.checkedAt).toBe(until);
  });

  test("sends history pages progressively and replays a failed window without advancing", async () => {
    const statePath = join(directory(), "sync.json");
    const rows = Array.from({ length: 1001 }, (_, i) => row(until - i - 1));
    const stored = new Set<string>();
    let failSecondPage = true;
    let sentBeforeSecondPage = false;
    const opts = {
      statePath,
      enabled,
      cursorCredentials: credentials,
      now: () => until,
      cursorFetch: fetcher(async (_url, init) => {
        const request = JSON.parse(String(init?.body));
        expect(request.pageSize).toBe(1000);
        if (request.page === 2) {
          sentBeforeSecondPage = stored.size === 1000;
          if (failSecondPage) return new Response(null, { status: 500 });
        }
        const offset = (request.page - 1) * request.pageSize;
        return page(rows.slice(offset, offset + request.pageSize), rows.length);
      }),
      send: async (events: TokenEvent[]) => {
        const before = stored.size;
        for (const e of events) stored.add(e.messageId);
        return { inserted: stored.size - before, duplicates: events.length - (stored.size - before) };
      },
    };
    const first = await sync({ files: {} }, opts);
    expect(sentBeforeSecondPage).toBe(true);
    expect(first.inserted).toBe(1000);
    expect((await loadState(statePath)).cursorApi).toBeUndefined();
    failSecondPage = false;
    const second = await sync(first.state, opts);
    expect(second.inserted).toBe(1);
    expect(stored.size).toBe(1001);
    expect(second.state.cursorApi?.checkedAt).toBe(until);
  });

  test("disabled Cursor never loads credentials or sends API requests", async () => {
    await sync(
      { files: {} },
      {
        statePath: join(directory(), "sync.json"),
        enabled: new Set(),
        send,
        cursorCredentials: () => {
          throw new Error("must not read");
        },
        cursorFetch: fetcher(async () => {
          throw new Error("must not fetch");
        }),
      },
    );
  });
});
