import { describe, expect, test } from "bun:test";
import { ORG_OVERLAP_MS } from "@tokenmaxxing/core/org-feed.ts";
import type { TokenEvent } from "@tokenmaxxing/core/types.ts";
import { reconcileOrgUsage } from "../src/org-usage.ts";
import { memorySql } from "./memory-sql.ts";

const T = 1_700_000_000_000;

function ev(overrides: Partial<TokenEvent> = {}): TokenEvent {
  return {
    source: "claude_cloud",
    sessionId: "org:swerv",
    agentId: null,
    messageId: "org:swerv:1",
    requestId: null,
    timestamp: T,
    model: "claude-haiku-4-5",
    messageType: "assistant",
    inputTokens: 10,
    outputTokens: 2,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    reasoningTokens: null,
    ...overrides,
  };
}

async function db() {
  const { sql } = memorySql();
  await sql.execute(`CREATE TABLE events (
    source TEXT NOT NULL, message_type TEXT NOT NULL, model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL, output_tokens INTEGER NOT NULL,
    cache_creation_tokens INTEGER NOT NULL, cache_read_tokens INTEGER NOT NULL,
    timestamp INTEGER NOT NULL, day TEXT NOT NULL, message_id TEXT NOT NULL, request_id TEXT)`);
  return sql;
}

async function insert(sql: Awaited<ReturnType<typeof db>>, e: TokenEvent, day = "2026-01-01") {
  await sql.execute(
    `INSERT INTO events (source, message_type, model, input_tokens, output_tokens, cache_creation_tokens,
      cache_read_tokens, timestamp, day, message_id, request_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    e.source,
    e.messageType,
    e.model,
    e.inputTokens,
    e.outputTokens,
    e.cacheCreationTokens,
    e.cacheReadTokens,
    e.timestamp,
    day,
    e.messageId,
    e.requestId,
  );
}

describe("organization overlap", () => {
  test("a cloud row matching a local turn is dropped, including at exactly two minutes", async () => {
    const sql = await db();
    await insert(sql, ev({ source: "claude_code", messageId: "local", timestamp: T }));
    const onTime = await reconcileOrgUsage(sql, [ev({ timestamp: T + ORG_OVERLAP_MS })]);
    expect(onTime.overlaps).toBe(1);
    expect(onTime.events).toHaveLength(0);
    const later = await reconcileOrgUsage(sql, [ev({ timestamp: T + ORG_OVERLAP_MS + 1 })]);
    expect(later.overlaps).toBe(0);
    expect(later.events).toHaveLength(1);
  });

  test("a different model or token count is a second turn", async () => {
    const sql = await db();
    await insert(sql, ev({ source: "claude_cowork", messageId: "local" }));
    const other = await reconcileOrgUsage(sql, [ev({ model: "claude-opus-4-5" }), ev({ outputTokens: 3 })]);
    expect(other.overlaps).toBe(0);
    expect(other.events).toHaveLength(2);
  });

  test("a later local row deletes the cloud row and names its day", async () => {
    const sql = await db();
    await insert(sql, ev({ timestamp: T }), "2026-01-01");
    const gone = await reconcileOrgUsage(sql, [
      ev({ source: "claude_code", messageId: "local", timestamp: T + 1_000 }),
    ]);
    expect(gone.events).toHaveLength(1);
    expect(gone.deletedDays).toEqual(["2026-01-01"]);
    expect(gone.deletedAt).toEqual([T]);
    const left = await sql.execute("SELECT source FROM events");
    expect(left).toHaveLength(0);
  });

  test("a replay of some other message does not delete the cloud row", async () => {
    const sql = await db();
    await insert(sql, ev({ timestamp: T }));
    await insert(
      sql,
      ev({ source: "claude_code", messageId: "older", timestamp: T - 60 * 60_000 }),
      "2025-12-31",
    );
    const replay = await reconcileOrgUsage(sql, [
      ev({ source: "claude_code", messageId: "older", timestamp: T }),
    ]);
    expect(replay.deletedAt).toEqual([]);
    const left = await sql.execute("SELECT source FROM events WHERE source = 'claude_cloud'");
    expect(left).toHaveLength(1);
  });

  test("a replay of the same local turn still drops the cloud duplicate", async () => {
    const sql = await db();
    await insert(sql, ev({ timestamp: T }));
    await insert(sql, ev({ source: "claude_code", messageId: "same", timestamp: T }));
    const replay = await reconcileOrgUsage(sql, [
      ev({ source: "claude_code", messageId: "same", timestamp: T }),
    ]);
    expect(replay.deletedAt).toEqual([T]);
  });

  test("codex cloud matches codex, not claude", async () => {
    const sql = await db();
    await insert(sql, ev({ source: "codex", messageId: "local" }));
    const claude = await reconcileOrgUsage(sql, [ev()]);
    expect(claude.overlaps).toBe(0);
    const codex = await reconcileOrgUsage(sql, [ev({ source: "codex_cloud" })]);
    expect(codex.overlaps).toBe(1);
  });
});
