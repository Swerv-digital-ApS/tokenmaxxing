import { describe, expect, test } from "bun:test";
import { ORG_FEED_NOTICE } from "@tokenmaxxing/core/org-feed.ts";
import { dayStart } from "@tokenmaxxing/core/raid.ts";
import { dayKey } from "@tokenmaxxing/core/range.ts";
import { as, event, ORG_FEED_TOKEN, origin, signUp } from "./rivet.ts";

/** A timestamp on today's world day, `ago` ms before now when that is still today. */
const onToday = (ago: number) => Math.max(Date.now() - ago, dayStart(dayKey(Date.now())) + 1_000);

async function feed(path: string, body: unknown, token: string | null = ORG_FEED_TOKEN) {
  const headers = new Headers({ "content-type": "application/json" });
  if (token) headers.set("authorization", `Bearer ${token}`);
  const res = await fetch(`${origin}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

function cloud(email: string, id: string, timestamp: number, extra: Record<string, unknown> = {}) {
  return {
    email,
    source: "claude_cloud",
    id,
    timestamp,
    model: "claude-haiku-4-5-20251001",
    inputTokens: 100,
    outputTokens: 50,
    ...extra,
  };
}

async function sources(token: string, userId: number) {
  return (await as(token).player(userId).todayBySource()).sources;
}

describe("organization feed", () => {
  test("opt in, then the same push twice counts once", async () => {
    const u = await signUp("org");
    const claim = await u.town.startOrgClaim("Swerv");
    expect(claim.notice).toBe(ORG_FEED_NOTICE);
    expect(claim.notice).toContain("Everything in the world is public");
    const email = `dev${u.userId}@swerv.example`;
    const linked = await feed("/api/v1/org-usage/link", {
      version: 1,
      code: claim.code,
      email: email.toUpperCase(),
    });
    expect(linked.body).toEqual({ linked: true });
    const status = await u.town.orgFeed();
    expect(status.links.map((l) => l.email)).toEqual([email]);
    expect(status.pending).toBeNull();

    const ts = onToday(60_000);
    const row = cloud(email, "turn-1", ts);
    expect((await feed("/api/v1/org-usage", { version: 1, events: [row] })).body).toMatchObject({
      inserted: 1,
      duplicates: 0,
    });
    expect((await feed("/api/v1/org-usage", { version: 1, events: [row] })).body).toMatchObject({
      inserted: 0,
      duplicates: 1,
    });
    expect(await sources(u.token, u.userId)).toEqual([{ source: "claude_cloud", tokens: 150 }]);
  });

  test("no token, an unknown email, and a bad batch store nothing", async () => {
    expect((await feed("/api/v1/org-usage", { version: 1, events: [] }, null)).status).toBe(401);
    const u = await signUp("orgmiss");
    const ts = onToday(60_000);
    const missed = await feed("/api/v1/org-usage", {
      version: 1,
      events: [cloud("nobody@swerv.example", "n1", ts)],
    });
    expect(missed.body).toMatchObject({ inserted: 0, unlinked: 1 });
    const email = `miss${u.userId}@swerv.example`;
    const claim = await u.town.startOrgClaim("swerv");
    expect((await feed("/api/v1/org-usage/link", { version: 1, code: claim.code, email })).body).toEqual({
      linked: true,
    });
    const bad = await feed("/api/v1/org-usage", {
      version: 1,
      events: [cloud(email, "ok", ts), { ...cloud(email, "bad", ts), timestamp: "soon" }],
    });
    expect(bad.status).toBe(400);
    expect(bad.body).toEqual({ error: "invalid_event", index: 1, field: "timestamp" });
    expect(await sources(u.token, u.userId)).toEqual([]);
  });

  test("cursor and grok rows are left to the device, and a device cannot write cloud rows", async () => {
    const u = await signUp("orgdev");
    const email = `dev${u.userId}@swerv.example`;
    const claim = await u.town.startOrgClaim("swerv");
    await feed("/api/v1/org-usage/link", { version: 1, code: claim.code, email });
    const ts = onToday(60_000);
    const pushed = await feed("/api/v1/org-usage", {
      version: 1,
      events: [
        cloud(email, "cloud", ts),
        { ...cloud(email, "c", ts), source: "cursor_local" },
        { ...cloud(email, "g", ts), source: "grok_bot" },
      ],
    });
    expect(pushed.body).toMatchObject({ inserted: 1, deviceSync: 2 });
    expect(await sources(u.token, u.userId)).toEqual([{ source: "claude_cloud", tokens: 150 }]);

    const skipped = await as(u.token)
      .player(u.userId)
      .ingest([event({ source: "claude_cloud", timestamp: ts, messageId: "org:swerv:from-device" })]);
    expect(skipped).toMatchObject({ inserted: 0, skipped: 1 });
    await expect(
      as(u.token)
        .player(u.userId)
        .ingestOrg([event({ source: "claude_cloud" })]),
    ).rejects.toThrow();
  });

  test("the local row wins, in either order, and a later turn still counts", async () => {
    const u = await signUp("orglap");
    const email = `lap${u.userId}@swerv.example`;
    const claim = await u.town.startOrgClaim("swerv");
    await feed("/api/v1/org-usage/link", { version: 1, code: claim.code, email });
    const player = as(u.token).player(u.userId);
    const ts = onToday(5 * 60_000);
    const local = event({
      timestamp: ts,
      inputTokens: 100,
      outputTokens: 50,
      model: "claude-haiku-4-5-20251001",
      messageId: "local-1",
    });
    await feed("/api/v1/org-usage", { version: 1, events: [cloud(email, "first", ts)] });
    await player.ingest([local]);
    expect(await sources(u.token, u.userId)).toEqual([{ source: "claude_code", tokens: 150 }]);

    const again = await feed("/api/v1/org-usage", {
      version: 1,
      events: [cloud(email, "second", ts + 1_000)],
    });
    expect(again.body).toMatchObject({ inserted: 0, overlaps: 1 });
    expect(await sources(u.token, u.userId)).toEqual([{ source: "claude_code", tokens: 150 }]);

    const later = ts + 3 * 60_000;
    await feed("/api/v1/org-usage", {
      version: 1,
      events: [cloud(email, "third", later, { outputTokens: 7 })],
    });
    const after = await sources(u.token, u.userId);
    expect(after).toContainEqual({ source: "claude_code", tokens: 150 });
    expect(after).toContainEqual({ source: "claude_cloud", tokens: 107 });
  });

  test("codex cloud yields to a local codex row, and unlinking stops the feed", async () => {
    const u = await signUp("orgcodex");
    const email = `codex${u.userId}@swerv.example`;
    const claim = await u.town.startOrgClaim("swerv");
    await feed("/api/v1/org-usage/link", { version: 1, code: claim.code, email });
    const ts = onToday(30_000);
    await as(u.token)
      .player(u.userId)
      .ingest([
        event({
          source: "codex",
          timestamp: ts,
          model: "gpt-5",
          inputTokens: 100,
          outputTokens: 50,
          messageId: "codex-local",
        }),
      ]);
    const pushed = await feed("/api/v1/org-usage", {
      version: 1,
      events: [cloud(email, "cx", ts, { source: "codex_cloud", model: "gpt-5" })],
    });
    expect(pushed.body).toMatchObject({ overlaps: 1, inserted: 0 });
    expect(await sources(u.token, u.userId)).toEqual([{ source: "codex", tokens: 150 }]);

    await u.town.unlinkOrgFeed("swerv");
    const after = await feed("/api/v1/org-usage", {
      version: 1,
      events: [cloud(email, "after", ts + 5 * 60_000)],
    });
    expect(after.body).toMatchObject({ unlinked: 1, inserted: 0 });
    expect((await u.town.orgFeed()).links).toEqual([]);
  });

  test("an email stays with the first player, and a replaced code no longer links", async () => {
    const a = await signUp("orga");
    const b = await signUp("orgb");
    const first = await a.town.startOrgClaim("swerv");
    const second = await a.town.startOrgClaim("swerv");
    expect(
      (await feed("/api/v1/org-usage/link", { version: 1, code: first.code, email: "dev@swerv.example" }))
        .status,
    ).toBe(404);
    expect(
      (await feed("/api/v1/org-usage/link", { version: 1, code: second.code, email: "dev@swerv.example" }))
        .body,
    ).toEqual({ linked: true });
    const again = await a.town.startOrgClaim("swerv");
    expect(
      (await feed("/api/v1/org-usage/link", { version: 1, code: again.code, email: "dev@swerv.example" }))
        .body,
    ).toEqual({ linked: true });
    const theirs = await b.town.startOrgClaim("swerv");
    const taken = await feed("/api/v1/org-usage/link", {
      version: 1,
      code: theirs.code,
      email: "dev@swerv.example",
    });
    expect(taken.status).toBe(409);
    expect(taken.body).toEqual({ error: "email_taken" });
    await expect(a.town.startOrgClaim("not-configured")).rejects.toThrow(/no usage feed/);
  });

  test("another player's local row cannot erase this cloud usage, and the card has no email", async () => {
    const a = await signUp("orgpriv");
    const b = await signUp("orgprivb");
    const email = `priv${a.userId}@swerv.example`;
    const claim = await a.town.startOrgClaim("swerv");
    expect((await feed("/api/v1/org-usage/link", { version: 1, code: claim.code, email })).body).toEqual({
      linked: true,
    });
    const ts = onToday(60_000);
    await feed("/api/v1/org-usage", {
      version: 1,
      events: [{ ...cloud(email, "mine", ts), userId: b.userId }],
    });
    await as(b.token)
      .player(b.userId)
      .ingest([
        event({
          timestamp: ts,
          inputTokens: 100,
          outputTokens: 50,
          model: "claude-haiku-4-5-20251001",
          messageId: "b-local",
        }),
      ]);
    expect(await sources(a.token, a.userId)).toEqual([{ source: "claude_cloud", tokens: 150 }]);
    expect(await sources(b.token, b.userId)).toEqual([{ source: "claude_code", tokens: 150 }]);
    const card = JSON.stringify(await b.town.profile(a.userId, "7d"));
    expect(card).not.toContain(email);
    expect(card).not.toContain("org:");
  });

  test("eleven codes in an hour is too many", async () => {
    const u = await signUp("orgcodes");
    for (let i = 0; i < 10; i++) await u.town.startOrgClaim("swerv");
    await expect(u.town.startOrgClaim("swerv")).rejects.toThrow(/hour/);
  });
});
