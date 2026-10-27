import { describe, expect, test } from "bun:test";
import type { TokenEvent } from "@tokenmaxxing/core/types.ts";
import { loadConfig } from "../src/config.ts";
import {
  handleOrgLink,
  handleOrgUnlink,
  handleOrgUsage,
  ORG_FEED_MAX_PLAYERS,
  type OrgFeedDeps,
  orgIpGuard,
} from "../src/org-feed-http.ts";
import { orgIdForToken, parseOrgFeedSecrets } from "../src/org-feed-secrets.ts";
import { RateLimiter } from "../src/rate-limit.ts";

const SECRET = "test-org-feed-secret-0123456789abcd";
const OTHER = "other-org-feed-secret-0123456789abcd";
const NOW = 1_700_000_000_000;

function feeds() {
  return parseOrgFeedSecrets(`swerv:${SECRET},other:${OTHER}`);
}

function deps(over: Partial<OrgFeedDeps> = {}): OrgFeedDeps & { seen: TokenEvent[] } {
  const seen: TokenEvent[] = [];
  return {
    seen,
    secrets: () => feeds(),
    now: () => NOW,
    requests: new RateLimiter(60, 60_000),
    playerForEmail: async () => 7,
    bind: async () => "linked",
    unlink: async () => true,
    ingest: async (_userId, events) => {
      seen.push(...events);
      return { inserted: events.length, duplicates: 0, overlaps: 0 };
    },
    ...over,
  };
}

function post(body: unknown, token: string | null = SECRET, type = "application/json") {
  const headers = new Headers();
  if (type) headers.set("content-type", type);
  if (token) headers.set("authorization", `Bearer ${token}`);
  return new Request("http://127.0.0.1/api/v1/org-usage", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    email: "dev@swerv.example",
    source: "claude_cloud",
    id: "msg-1",
    timestamp: NOW - 1000,
    model: "claude-sonnet-4-5",
    inputTokens: 10,
    outputTokens: 4,
    ...overrides,
  };
}

describe("ORG_FEED_SECRETS", () => {
  test("unset is off, and a bad value fails", () => {
    expect(parseOrgFeedSecrets(undefined)).toEqual([]);
    expect(parseOrgFeedSecrets("  ")).toEqual([]);
    expect(() => parseOrgFeedSecrets("swerv:short")).toThrow(/32 to 256/);
    expect(() => parseOrgFeedSecrets("Swerv:short")).toThrow(/32 to 256/);
    expect(() => parseOrgFeedSecrets(`swerv:${"a".repeat(257)}`)).toThrow(/32 to 256/);
    expect(() => parseOrgFeedSecrets(`Bad_Id:${SECRET}`)).toThrow(/org id/);
    expect(() => parseOrgFeedSecrets(`swerv:${SECRET},swerv:${OTHER}`)).toThrow(/twice/);
    expect(() => parseOrgFeedSecrets(`swerv:${SECRET},other:${SECRET}`)).toThrow(/reuses a secret/);
    expect(() => loadConfig({ ORG_FEED_SECRETS: "swerv:short" }, "0")).toThrow(/ORG_FEED_SECRETS/);
    expect(loadConfig({}, "0").port).toBe(8787);
  });

  test("the bearer token selects the organization, compared without keeping the secret", () => {
    const parsed = feeds();
    expect(parsed.every((f) => !f.hash.includes(SECRET) && f.hash.length === 64)).toBe(true);
    expect(orgIdForToken(SECRET, parsed)).toBe("swerv");
    expect(orgIdForToken(OTHER, parsed)).toBe("other");
    expect(orgIdForToken("nope", parsed)).toBeNull();
    expect(orgIdForToken(SECRET, [])).toBeNull();
  });
});

describe("POST /api/v1/org-usage", () => {
  test("a bad or missing token is 401 and does not say the feed is off", async () => {
    expect((await handleOrgUsage(post({}, null), deps())).status).toBe(401);
    const off = await handleOrgUsage(post({}, SECRET), deps({ secrets: () => [] }));
    expect(await off.json()).toEqual({ error: "unauthorized" });
    expect((await handleOrgUsage(post({}, "wrong-token-but-long-enough-0123456789"), deps())).status).toBe(
      401,
    );
  });

  test("a cloud row is stored under a stable id, and a device source is not", async () => {
    const d = deps();
    const res = await handleOrgUsage(
      post({
        version: 1,
        events: [
          row(),
          row({ source: "cursor_local", id: "cursor-1" }),
          row({ source: "grok_bot", id: "g1" }),
        ],
      }),
      d,
    );
    expect(await res.json()).toEqual({
      inserted: 1,
      duplicates: 0,
      overlaps: 0,
      unlinked: 0,
      deviceSync: 2,
      rateLimited: 0,
    });
    expect(d.seen).toHaveLength(1);
    expect(d.seen[0]).toMatchObject({
      source: "claude_cloud",
      messageId: "org:swerv:msg-1",
      sessionId: "org:swerv",
      messageType: "assistant",
      inputTokens: 10,
      outputTokens: 4,
    });
  });

  test("an invalid event rejects the batch and echoes no value", async () => {
    const d = deps();
    const res = await handleOrgUsage(
      post({ version: 1, events: [row(), row({ id: "second", email: "not an email" })] }),
      d,
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: "invalid_event", index: 1, field: "email" });
    expect(JSON.stringify(body)).not.toContain("not an email");
    expect(d.seen).toHaveLength(0);
  });

  test("an unlinked email is counted and not stored", async () => {
    const d = deps({ playerForEmail: async (_org, email) => (email === "dev@swerv.example" ? 7 : null) });
    const res = await handleOrgUsage(
      post({ version: 1, events: [row(), row({ id: "other", email: "other@swerv.example" })] }),
      d,
    );
    expect(await res.json()).toMatchObject({ inserted: 1, unlinked: 1 });
    expect(d.seen).toHaveLength(1);
  });

  test("the daily cap counts as rate limited, and a later failure reports what already landed", async () => {
    const capped = deps({
      ingest: async () => {
        throw Object.assign(new Error("cap"), { code: "rate_limited" });
      },
    });
    expect(
      (await (await handleOrgUsage(post({ version: 1, events: [row()] }), capped)).json()).rateLimited,
    ).toBe(1);

    let calls = 0;
    const failing = deps({
      ingest: async (_id, events) => {
        calls++;
        if (calls === 2) throw new Error("db down");
        return { inserted: events.length, duplicates: 0, overlaps: 0 };
      },
    });
    const res = await handleOrgUsage(
      post({ version: 1, events: [row(), row({ id: "b", email: "other@swerv.example" })] }),
      failing,
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "ingest_failed", inserted: 1 });
  });

  test("an email-shaped model is refused, a dated model name is kept, and a userId is ignored", async () => {
    const d = deps();
    const leaked = await handleOrgUsage(
      post({ version: 1, events: [row({ model: "dev@swerv.example" })] }),
      d,
    );
    expect(await leaked.json()).toEqual({ error: "invalid_event", index: 0, field: "model" });
    expect(d.seen).toHaveLength(0);
    const dated = await handleOrgUsage(
      post({ version: 1, events: [row({ model: "claude-opus-4@20250514", userId: 999 })] }),
      d,
    );
    expect(dated.status).toBe(200);
    expect(d.seen[0]?.model).toBe("claude-opus-4@20250514");
  });

  test("more players than one request may wake is refused before ingest", async () => {
    const d = deps();
    const events = Array.from({ length: ORG_FEED_MAX_PLAYERS + 1 }, (_, i) =>
      row({ id: `id-${i}`, email: `p${i}@swerv.example` }),
    );
    const res = await handleOrgUsage(post({ version: 1, events }), d);
    expect(res.status).toBe(400);
    expect(d.seen).toHaveLength(0);
  });

  test("a bearer longer than 256 characters is unauthorized and is not hashed into an error", async () => {
    const token = "b".repeat(257);
    const res = await handleOrgUsage(post({ version: 1, events: [] }, token), deps());
    expect(res.status).toBe(401);
    expect(JSON.stringify(await res.json())).not.toContain(token);
  });

  test("a body with no declared length still stops at 1MB", async () => {
    const d = deps();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("x".repeat(1_000_001)));
        controller.close();
      },
    });
    const req = new Request("http://127.0.0.1/api/v1/org-usage", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${SECRET}` },
      body: stream,
    });
    expect((await handleOrgUsage(req, d)).status).toBe(413);
    expect(d.seen).toHaveLength(0);
  });

  test("failed attempts from one address are limited before the secret is checked", () => {
    const limiter = new RateLimiter(1, 60_000);
    expect(orgIpGuard("10.0.0.1", limiter, NOW)).toBeNull();
    expect(orgIpGuard("10.0.0.1", limiter, NOW)?.status).toBe(429);
    expect(orgIpGuard("10.0.0.2", limiter, NOW)).toBeNull();
  });

  test("oversized, non-json, and a burst are refused", async () => {
    expect((await handleOrgUsage(post("{}", SECRET, "text/plain"), deps())).status).toBe(415);
    const big = await handleOrgUsage(post("x".repeat(1_000_001)), deps());
    expect(big.status).toBe(413);
    const slow = deps({ requests: new RateLimiter(1, 60_000) });
    expect((await handleOrgUsage(post({ version: 1, events: [] }), slow)).status).toBe(200);
    expect((await handleOrgUsage(post({ version: 1, events: [] }), slow)).status).toBe(429);
  });

  test("link and unlink", async () => {
    const d = deps({
      bind: async (_org, code) => (code === "AB23CD45" ? "linked" : "not_found"),
    });
    const ok = await handleOrgLink(
      post({ version: 1, code: "AB23CD45", email: "Dev@Swerv.example" }, SECRET),
      d,
    );
    expect(await ok.json()).toEqual({ linked: true });
    const missing = await handleOrgLink(post({ version: 1, code: "AB23CD46", email: "a@b.co" }, SECRET), d);
    expect(missing.status).toBe(404);
    const taken = await handleOrgLink(
      post({ version: 1, code: "AB23CD45", email: "a@b.co" }, SECRET),
      deps({ bind: async () => "taken" }),
    );
    expect(taken.status).toBe(409);
    expect(await (await taken.json()).error).toBe("email_taken");
    const badCode = await handleOrgLink(post({ version: 1, code: "AB23CD4O", email: "a@b.co" }, SECRET), d);
    expect(badCode.status).toBe(400);
    const gone = await handleOrgUnlink(post({ version: 1, email: "dev@swerv.example" }, OTHER), deps());
    expect(await gone.json()).toEqual({ unlinked: true });
  });
});
