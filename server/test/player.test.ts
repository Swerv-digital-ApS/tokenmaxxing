import { describe, expect, test } from "bun:test";
import { activity, as, client, event, HOUR, MIN, signUp } from "./rivet.ts";

/** Three days ago, on a 5-minute boundary: inside "7d", and no bucket straddles a world midnight. */
const start = Math.floor((Date.now() - 3 * 24 * HOUR) / (5 * MIN)) * 5 * MIN;

async function statsFor(events: ReturnType<typeof activity>) {
  const u = await signUp("stats");
  await as(u.token).player(u.userId).ingest(events);
  return (await u.town.profile(u.userId, "7d")).totals;
}

describe("ingest", () => {
  test("re-sent events are dropped", async () => {
    const u = await signUp("dedup");
    const events = [event(), event(), event({ messageType: "user", model: "" })];
    const player = as(u.token).player(u.userId);
    expect(await player.ingest(events)).toEqual({ inserted: 3, duplicates: 0, skipped: 0 });
    expect(await player.ingest(events)).toEqual({ inserted: 0, duplicates: 3, skipped: 0 });
  });

  test("a Claude response re-sent with its final usage raises the stored numbers, never lowers them", async () => {
    const u = await signUp("claude-final");
    const player = as(u.token).player(u.userId);
    const first = event({ timestamp: start, inputTokens: 100, outputTokens: 1 });
    await player.ingest([first]);
    expect(await player.ingest([{ ...first, outputTokens: 50 }])).toMatchObject({
      inserted: 0,
      duplicates: 1,
    });
    await player.ingest([first]);
    expect((await u.town.profile(u.userId, "7d")).totals.tokens).toBe(150);
  });

  test("today's tokens by source and PRs, for the menu bar", async () => {
    const u = await signUp("sources");
    const player = as(u.token).player(u.userId);
    const now = Date.now();
    await player.ingest([
      event({ timestamp: now }),
      event({ timestamp: now, source: "codex", inputTokens: 1000 }),
      event({ timestamp: now, messageType: "user", model: "", inputTokens: 0, outputTokens: 0 }),
      event({
        timestamp: now,
        source: "github",
        messageType: "pr",
        model: "",
        inputTokens: 0,
        outputTokens: 0,
      }),
    ]);
    expect(await player.todayBySource()).toEqual({
      sources: [
        { source: "codex", tokens: 1050 },
        { source: "claude_code", tokens: 150 },
      ],
      prs: 1,
    });
  });

  test("Cursor API replaces covered estimates, dedups retries, and blocks older clients", async () => {
    const u = await signUp("cursor");
    const player = as(u.token).player(u.userId);
    const legacy = event({ source: "cursor_local", timestamp: start, inputTokens: 100, outputTokens: 0 });
    const earlier = event({
      source: "cursor_local",
      timestamp: start - 24 * HOUR,
      inputTokens: 200,
      outputTokens: 0,
    });
    await player.ingest([legacy, earlier]);
    const actual = event({
      source: "cursor_local",
      messageId: "cursor-api:test:0",
      timestamp: start,
      inputTokens: 10,
      outputTokens: 20,
      cacheCreationTokens: 30,
      cacheReadTokens: 40,
    });
    await player.ingest([actual]);
    expect((await u.town.profile(u.userId, "7d")).totals.tokens).toBe(300);
    expect(await player.ingest([actual])).toMatchObject({ inserted: 0, duplicates: 1 });
    expect(await player.ingest([legacy])).toMatchObject({ inserted: 0 });
    expect((await u.town.profile(u.userId, "7d")).totals.tokens).toBe(300);
  });

  test("Grok Bot rows count once as grok_bot, including when an older client still tags them as Cursor", async () => {
    const u = await signUp("bots");
    const player = as(u.token).player(u.userId);
    const now = Date.now();
    await player.ingest([
      event({
        timestamp: now,
        source: "cursor_local",
        model: "grok-bot-automation",
        messageId: "cursor-api:bot:0",
        inputTokens: 1000,
        outputTokens: 0,
        costCents: 500,
      }),
      // Same dashboard row from a client that already labels it grok_bot: one stored event.
      event({
        timestamp: now,
        source: "grok_bot",
        model: "grok-bot-automation",
        messageId: "cursor-api:bot:0",
        inputTokens: 1000,
        outputTokens: 0,
        costCents: 500,
      }),
      event({
        timestamp: now,
        source: "cursor_local",
        model: "grok-4.7-high",
        inputTokens: 10,
        outputTokens: 0,
      }),
    ]);
    expect(await player.todayBySource()).toEqual({
      sources: [
        { source: "grok_bot", tokens: 1000 },
        { source: "cursor_local", tokens: 10 },
      ],
      prs: 0,
    });
    const profile = await u.town.profile(u.userId, "all");
    expect(profile.totals.tokens).toBe(1010);
    expect(profile.totals.costUsd).toBe(5);
    expect(profile.models.map((m) => m.model).sort()).toEqual(["grok-4.7-high", "grok-bot-automation"]);
  });

  test("Cursor reported costs enrich old events without duplicating tokens, and accept corrections", async () => {
    const u = await signUp("costs");
    const player = as(u.token).player(u.userId);
    const original = event({
      source: "cursor_local",
      model: "muse-spark-1.3-high",
      messageId: "cursor-api:cost-upgrade:0",
      timestamp: start,
      inputTokens: 100,
      outputTokens: 0,
    });
    await player.ingest([original]);
    expect((await u.town.profile(u.userId, "all")).totals.costUsd).toBe(0);
    expect(await player.ingest([{ ...original, costCents: 275.5 }])).toMatchObject({
      inserted: 0,
      duplicates: 1,
    });
    let totals = (await u.town.profile(u.userId, "all")).totals;
    expect(totals.tokens).toBe(100);
    expect(totals.costUsd).toBe(2.755);
    await player.ingest([{ ...original, costCents: 325.5 }]);
    await player.ingest([original]);
    totals = (await u.town.profile(u.userId, "all")).totals;
    expect(totals.tokens).toBe(100);
    expect(totals.costUsd).toBe(3.255);
  });

  test("invalid cost metadata is rejected", async () => {
    const u = await signUp("badcost");
    const r = await as(u.token)
      .player(u.userId)
      .ingest([
        event({ source: "cursor_local", costCents: -1 }),
        event({ source: "cursor_local", costCents: 100_000_001 }),
        event({ costCents: 1 }),
      ]);
    expect(r).toMatchObject({ inserted: 0, skipped: 3 });
  });

  test("LiteLLM estimates take precedence over Cursor fallback costs, including zero", async () => {
    const u = await signUp("preferprice");
    const player = as(u.token).player(u.userId);
    const known = event({ model: "gpt-5.5-high", timestamp: start, inputTokens: 1_000_000, outputTokens: 0 });
    await player.ingest([known]);
    const estimate = (await u.town.profile(u.userId, "all")).totals.costUsd;
    expect(estimate).toBeGreaterThan(0);
    await player.ingest([
      event({ ...known, source: "cursor_local", messageId: "cursor-api:known-paid", costCents: 100_000 }),
      event({ ...known, source: "cursor_local", messageId: "cursor-api:known-zero", costCents: 0 }),
      event({
        source: "cursor_local",
        model: "composer-2.5",
        messageId: "cursor-api:unknown-paid",
        costCents: 275.5,
        timestamp: start,
      }),
      event({
        source: "cursor_local",
        model: "muse-spark-1.3-high",
        messageId: "cursor-api:unknown-zero",
        costCents: 0,
        timestamp: start,
      }),
    ]);
    const totals = (await u.town.profile(u.userId, "all")).totals;
    expect(totals.costUsd).toBeCloseTo(3 * estimate + 2.755, 4);
    expect(
      (await u.town.leaderboard("all", "cost")).players.find((p) => p.userId === u.userId)?.costUsd,
    ).toBe(totals.costUsd);
  });

  test("invalid events are skipped, not stored", async () => {
    const u = await signUp("skip");
    const r = await as(u.token)
      .player(u.userId)
      .ingest([event(), { nope: true }, event({ inputTokens: -1 })]);
    expect(r).toEqual({ inserted: 1, duplicates: 0, skipped: 2 });
  });

  test("only the device token can ingest, and only into its own player", async () => {
    const a = await signUp("own");
    const b = await signUp("other");
    await expect(as(b.token).player(a.userId).ingest([event()])).rejects.toThrow();
    const code = await as(a.token).player(a.userId).mintLoginCode();
    const session = await client.player.get([String(a.userId)]).redeemLoginCode(code);
    await expect(as(session).player(a.userId).ingest([event()])).rejects.toThrow();
  });
});

describe("login codes", () => {
  test("a code works once and becomes a session that other actors accept", async () => {
    const u = await signUp("code");
    const code = await as(u.token).player(u.userId).mintLoginCode();
    const anon = client.player.get([String(u.userId)]);
    const session = await anon.redeemLoginCode(code);
    await expect(anon.redeemLoginCode(code)).rejects.toThrow();
    expect((await as(session).town.me()).name).toBe(u.name);
  });

  test("a bad token is rejected", async () => {
    const u = await signUp("revoke");
    await expect(as(`${u.userId}.${"x".repeat(43)}`).town.me()).rejects.toThrow();
  });
});

describe("agent hours", () => {
  test("hours with an agent running rank the board; overlapping agents don't count twice", async () => {
    const busy = await signUp("hoursbusy");
    const light = await signUp("hourslight");
    await as(busy.token)
      .player(busy.userId)
      .ingest([...activity("a", start, 3 * HOUR), ...activity("b", start, 3 * HOUR)]);
    // More tokens, less time: the board by tokens and by hours disagree.
    await as(light.token)
      .player(light.userId)
      .ingest(activity("c", start, HOUR).map((e) => ({ ...e, inputTokens: 1_000_000 })));
    const board = await busy.town.leaderboard("7d", "hours");
    const rows = board.players.filter((p) => p.userId === busy.userId || p.userId === light.userId);
    expect(rows.map((p) => [p.userId, p.activeHours])).toEqual([
      [busy.userId, 3],
      [light.userId, 1],
    ]);
  });
});

describe("parallelism", () => {
  test("one agent → 1.0×", async () => {
    const s = await statsFor(activity("a", start, 2 * HOUR));
    expect(s.parallelism).toBe(1);
    expect(s.peakAgents).toBe(1);
    expect(s.activeHours).toBe(2);
  });

  test("3 fully overlapping sessions → 3.0×", async () => {
    const s = await statsFor([
      ...activity("a", start, HOUR),
      ...activity("b", start, HOUR),
      ...activity("c", start, HOUR),
    ]);
    expect(s.parallelism).toBe(3);
    expect(s.peakAgents).toBe(3);
  });

  test("2 sessions for 1h, then 1 for 1h → 1.5×", async () => {
    const s = await statsFor([...activity("a", start, 2 * HOUR), ...activity("b", start, HOUR)]);
    expect(s.parallelism).toBe(1.5);
    expect(s.peakAgents).toBe(2);
  });

  test("a subagent counts separately from its parent", async () => {
    const s = await statsFor([...activity("a", start, HOUR), ...activity("a", start, HOUR, "sub1")]);
    expect(s.parallelism).toBe(2);
  });

  test("under 1 active hour → no parallelism ranking", async () => {
    const s = await statsFor([...activity("a", start, 30 * MIN), ...activity("b", start, 30 * MIN)]);
    expect(s.parallelism).toBeNull();
    expect(s.peakAgents).toBe(2);
  });

  test("prompts and PRs count, but add no tokens or agent activity", async () => {
    const pr = { source: "github" as const, sessionId: "github", messageType: "pr" as const, model: "" };
    const s = await statsFor([
      ...activity("a", start, HOUR),
      ...activity("b", start, HOUR).map((e) => ({ ...e, messageType: "user" as const, model: "" })),
      event({ ...pr, timestamp: start, inputTokens: 0, outputTokens: 0 }),
    ]);
    expect(s.parallelism).toBe(1);
    expect(s.prompts).toBe(12);
    expect(s.prs).toBe(1);
    expect(s.turns).toBe(12);
    expect(s.tokens).toBe(12 * 150);
  });
});

describe("linked computers", () => {
  /** A fresh user and a computer linked to them. */
  async function linked(prefix: string) {
    const u = await signUp(prefix);
    const code = await as(u.token).player(u.userId).mintLinkCode();
    const r = await client.player.get([String(u.userId)]).redeemLinkCode(code, "mac-studio", "linux");
    return { u, computer: r.token, deviceId: r.deviceId };
  }

  test("a code links a computer once, and its usage counts for the same player", async () => {
    const { u, computer } = await linked("link");
    await expect(
      client.player.get([String(u.userId)]).redeemLinkCode("1.nope-nope-nope-nope", "x", "linux"),
    ).rejects.toThrow();
    const now = Date.now();
    await as(u.token)
      .player(u.userId)
      .ingest([event({ timestamp: now })]);
    await as(computer)
      .player(u.userId)
      .ingest([event({ timestamp: now, sessionId: "workhorse" })]);
    expect((await as(computer).town.today()).me.tokensToday).toBe(300);
  });

  test("a code works only once", async () => {
    const u = await signUp("linkonce");
    const code = await as(u.token).player(u.userId).mintLinkCode();
    const anon = client.player.get([String(u.userId)]);
    await anon.redeemLinkCode(code, "one", "linux");
    await expect(anon.redeemLinkCode(code, "two", "linux")).rejects.toThrow();
  });

  test("the same events from both computers count once", async () => {
    const { u, computer } = await linked("linkdup");
    const events = [event({ timestamp: Date.now() })];
    await as(u.token).player(u.userId).ingest(events);
    expect(await as(computer).player(u.userId).ingest(events)).toEqual({
      inserted: 0,
      duplicates: 1,
      skipped: 0,
    });
  });

  test("a linked computer only syncs", async () => {
    const { u, computer } = await linked("linkscope");
    const me = as(computer);
    await me.town.today();
    expect(await me.arcade.battle()).toBeNull();
    await expect(me.town.me()).rejects.toThrow();
    await expect(me.town.rename("stolen")).rejects.toThrow();
    await expect(me.player(u.userId).mintLoginCode()).rejects.toThrow();
    await expect(me.player(u.userId).mintLinkCode()).rejects.toThrow();
    await expect(me.player(u.userId).devices()).rejects.toThrow();
  });

  test("only the app makes link codes", async () => {
    const u = await signUp("linksession");
    const code = await as(u.token).player(u.userId).mintLoginCode();
    const session = await client.player.get([String(u.userId)]).redeemLoginCode(code);
    await expect(as(session).player(u.userId).mintLinkCode()).rejects.toThrow();
  });

  test("the player lists and removes computers; a computer can only remove itself", async () => {
    const { u, computer, deviceId } = await linked("linkrevoke");
    const other = await as(u.token).player(u.userId).mintLinkCode();
    const second = await client.player.get([String(u.userId)]).redeemLinkCode(other, " box\u0007 ", "darwin");
    const app = as(u.token).player(u.userId);
    const list = await app.devices();
    expect(list.map((d) => [d.kind, d.name, d.platform, d.current])).toEqual([
      ["app", "Desktop app", "darwin", true],
      ["linked", "mac-studio", "linux", false],
      ["linked", "box", "darwin", false],
    ]);
    expect(list.some((d) => "hash" in d)).toBe(false);

    await expect(app.revokeDevice(list[0]!.id)).rejects.toThrow();
    await expect(as(computer).player(u.userId).revokeDevice(second.deviceId)).rejects.toThrow();
    await as(second.token).player(u.userId).revokeDevice(second.deviceId);
    await app.revokeDevice(deviceId);
    await expect(as(computer).player(u.userId).ingest([event()])).rejects.toThrow();
    expect((await app.devices()).map((d) => d.kind)).toEqual(["app"]);
  });

  test("at most 10 computers", async () => {
    const u = await signUp("linkmax");
    const app = as(u.token).player(u.userId);
    const anon = client.player.get([String(u.userId)]);
    for (let i = 0; i < 9; i++) await anon.redeemLinkCode(await app.mintLinkCode(), `c${i}`, "linux");
    await expect(anon.redeemLinkCode(await app.mintLinkCode(), "c9", "linux")).rejects.toThrow();
  });
});
