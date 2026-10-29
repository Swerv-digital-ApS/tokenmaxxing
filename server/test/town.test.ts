import { describe, expect, test } from "bun:test";
import { frontier, plotId } from "@tokenmaxxing/core/maps.ts";
import { admit, as, client, event, MIN, signUp } from "./rivet.ts";

describe("accounts", () => {
  test("names are unique and validated", async () => {
    const a = await signUp("name");
    await expect(client.town.getOrCreate(["main"]).signUp(a.name)).rejects.toThrow("taken");
    await expect(client.town.getOrCreate(["main"]).signUp("No Spaces!")).rejects.toThrow();
  });

  test("rename and look", async () => {
    const a = await signUp("rn");
    await a.town.rename(`${a.name}x`);
    await a.town.setLook({ style: 1, skin: 2, hair: 3, outfit: 4 });
    const me = await a.town.me();
    expect(me.name).toBe(`${a.name}x`);
    expect(me.look).toEqual({
      style: 1,
      skin: 2,
      hair: 3,
      outfit: 4,
      glasses: 0,
      hat: 0,
      pet: 0,
      held: 0,
      back: 0,
      petwear: 0,
      petVariant: 0,
      merch: 0,
      merchWorn: 0,
    });
    await expect(a.town.setLook({ style: 99, skin: 0, hair: 0, outfit: 0 })).rejects.toThrow();
  });

  test("name search for @mentions: by prefix, at most 8", async () => {
    const a = await signUp("zsearch");
    await signUp("zsearch");
    const names = await a.town.searchNames("zsearch");
    expect(names.length).toBeGreaterThanOrEqual(2);
    expect(names.every((n) => n.startsWith("zsearch"))).toBe(true);
    expect(await a.town.searchNames("no spaces")).toEqual([]);
  });

  test("the card: a bio (five edits an hour, reportable) and a showcase of what you own", async () => {
    const a = await signUp("bio");
    const b = await signUp("bio");
    expect(await a.town.setBio("  Ships\non Fridays ")).toBe("Ships on Fridays");
    expect((await b.town.profile(a.userId, "7d")).bio).toBe("Ships on Fridays");
    await expect(a.town.setBio("see acme.com")).rejects.toThrow("no links");
    await expect(a.town.setBio("x".repeat(121))).rejects.toThrow("120");
    // Reports: not your own, and once is once.
    await expect(a.town.reportBio(a.userId)).rejects.toThrow("own");
    await b.town.reportBio(a.userId);
    await b.town.reportBio(a.userId);
    // One edit so far (the bad ones weren't counted); four more fit, a sixth doesn't.
    for (let i = 0; i < 4; i++) await a.town.setBio(`edit ${i}`);
    await expect(a.town.setBio("one too many")).rejects.toThrow("Try again");
    expect((await b.town.profile(a.userId, "7d")).bio).toBe("edit 3");
    // Nothing earned yet: nothing to pin, and an unknown id is refused too.
    await expect(a.town.setShowcase([{ id: "badge:shipper" }])).rejects.toThrow("earned");
    await expect(a.town.setShowcase([{ id: "nope" }])).rejects.toThrow("earned");
    await expect(a.town.setShowcase([{ id: "a" }, { id: "a" }])).rejects.toThrow();
    await expect(a.town.setShowcase("badge:shipper")).rejects.toThrow();
    expect(await a.town.setShowcase([])).toEqual([]);
    expect((await a.town.profile(a.userId, "7d")).showcase).toEqual([]);
    // The Tavern's plaque board is readable by anyone, empty to begin with, and only `world` writes it.
    const board = await b.town.regulars();
    expect(board.me).toBeNull();
    await expect(b.town.tavernMinutes("2026-10-22", [[b.userId, 60, 1]])).rejects.toThrow();
  });

  test("everything but sign-up needs a token", async () => {
    await expect(client.town.getOrCreate(["main"]).me()).rejects.toThrow();
    await expect(client.town.getOrCreate(["main"]).report(1, [], [], [])).rejects.toThrow();
  });
});

describe("companies", () => {
  test("a new company builds where its owner picks, next to the town", async () => {
    const owner = await signUp("builder");
    const town = await as(owner.token).world.join();
    const pick = frontier(town.companies.flatMap((co) => co.plot)).at(-1)!;
    const co = await owner.town.createCompany("Builders", pick);
    expect(co.plot).toBe(pick);
    await expect((await signUp("late")).town.createCompany("Late", pick)).rejects.toThrow(
      "Pick another spot",
    );
    await expect((await signUp("far")).town.createCompany("Far", plotId(40, 40))).rejects.toThrow();
  });

  test("create, apply, the owner accepts; one company per person", async () => {
    const owner = await signUp("own");
    const mate = await signUp("mate");
    const co = await owner.town.createCompany("Arox");
    expect(co.isOwner).toBe(true);
    expect((await mate.town.listings()).map((l) => l.name)).toContain("Arox");

    await mate.town.apply(co.id);
    expect((await mate.town.me()).application).toEqual({ companyId: co.id, name: "Arox" });
    const mine = (await owner.town.me()).company!;
    expect(mine.applicants.map((a) => a.name)).toEqual([mate.name]);
    // Only the owner sees who's asking, and only the owner can answer.
    await expect(mate.town.approve(mate.userId)).rejects.toThrow("owner");

    const after = await owner.town.approve(mate.userId);
    expect(after.members.map((m) => m.name)).toEqual([owner.name, mate.name]);
    expect(after.applicants).toEqual([]);
    const joined = await mate.town.me();
    expect(joined.company!.isOwner).toBe(false);
    expect(joined.company!.applicants).toEqual([]);
    expect(joined.application).toBeNull();

    const other = await mate.town.createCompany("Solo");
    expect((await owner.town.me()).company!.members).toHaveLength(1);
    expect(other.members.map((m) => m.name)).toEqual([mate.name]);
  });

  test("everyone leaving at once closes it in the world too", async () => {
    // Enough of them that, pushed out of order, one closed company used to stay standing.
    const company = async (i: number) => {
      const owner = await signUp("lv");
      const co = await owner.town.createCompany(`Leavers ${i}`);
      const mates = [await signUp("lv"), await signUp("lv")];
      for (const mate of mates) {
        await mate.town.apply(co.id);
        await owner.town.approve(mate.userId);
      }
      return { id: co.id, people: [owner, ...mates] };
    };
    // One at a time: sign-ups at once can time out creating their players on a busy CI runner.
    const companies = [];
    for (let i = 0; i < 15; i++) companies.push(await company(i));
    const ids = companies.map((co) => co.id);
    const people = companies.flatMap((co) => co.people);
    await Promise.all(people.map((u) => u.town.leaveCompany()));
    const town = await as(people[0]!.token).world.join();
    expect(town.companies.filter((co) => ids.includes(co.id))).toEqual([]);
  });

  test("declining, withdrawing, and one application at a time", async () => {
    const a = await signUp("dec");
    const b = await signUp("dec");
    const c = await signUp("dec");
    const first = await a.town.createCompany("First Co");
    const second = await b.town.createCompany("Second Co");
    await c.town.apply(first.id);
    await c.town.apply(second.id); // replaces the first
    expect((await a.town.me()).company!.applicants).toEqual([]);
    expect((await c.town.me()).application!.companyId).toBe(second.id);

    const declined = await b.town.decline(c.userId);
    expect(declined.applicants).toEqual([]);
    expect((await c.town.me()).application).toBeNull();
    await expect(b.town.approve(c.userId)).rejects.toThrow("asking");

    await c.town.apply(first.id);
    await c.town.withdraw();
    await expect(a.town.approve(c.userId)).rejects.toThrow("asking");
    await expect(a.town.apply(first.id)).rejects.toThrow("already");
  });

  test("owner hand-off, kick, and the last one out closes it", async () => {
    const a = await signUp("ho");
    const b = await signUp("ho");
    const c = await signUp("ho");
    const co = await a.town.createCompany("Handoff");
    await admit(a, b, co.id);
    await admit(a, c, co.id);
    await expect(b.town.kick(c.userId)).rejects.toThrow("owner");
    await a.town.kick(c.userId);
    expect((await c.town.me()).company).toBeNull();

    await a.town.leaveCompany();
    const mine = (await b.town.me()).company!;
    expect(mine.isOwner).toBe(true);
    await b.town.leaveCompany();
    await expect(c.town.apply(co.id)).rejects.toThrow("gone");
  });

  test("a closed company's id is never reused", async () => {
    const a = await signUp("reuse");
    const first = await a.town.createCompany("First");
    await a.town.leaveCompany(); // the last one out closes it
    const second = await a.town.createCompany("Second");
    expect(second.id).toBeGreaterThan(first.id);
  });

  test("only the owner sets the website; it's stored as a bare host", async () => {
    const a = await signUp("web");
    const b = await signUp("web");
    const co = await a.town.createCompany("Web Co");
    await admit(a, b, co.id);
    await expect(b.town.setWebsite("acme.com")).rejects.toThrow("owner");
    await expect(a.town.setWebsite("not a website")).rejects.toThrow("website");
    const set = await a.town.setWebsite("https://www.Acme.com/about");
    expect(set.website).toBe("acme.com");
    // No Firecrawl key in tests: the website goes on the sign, no branding starts.
    expect(set.branding).toBeNull();
    expect((await b.town.me()).company!.website).toBe("acme.com");
    expect((await a.town.setWebsite("")).website).toBeNull();
  });
});

describe("leaderboard", () => {
  test("players and companies, ranked and priced", async () => {
    const a = await signUp("lb");
    const b = await signUp("lb");
    const co = await a.town.createCompany("Board Co");
    await admit(a, b, co.id);
    await as(a.token)
      .player(a.userId)
      .ingest([event({ inputTokens: 5_000_000 })]);
    await as(b.token)
      .player(b.userId)
      .ingest([event({ inputTokens: 1_000_000 })]);

    const board = await a.town.leaderboard("today", "tokens");
    const ia = board.players.findIndex((p) => p.userId === a.userId);
    const ib = board.players.findIndex((p) => p.userId === b.userId);
    expect(ia).toBeLessThan(ib);
    expect(board.players[ia]!.costUsd).toBeGreaterThan(0);
    expect(board.players[ia]!.company).toBe("Board Co");
    const company = board.companies.find((c) => c.companyId === co.id)!;
    expect(company.tokens).toBe(board.players[ia]!.tokens + board.players[ib]!.tokens);
    expect(company.members).toBe(2);
  });

  test("a company's card: its numbers, its people busiest first, and its last 30 days", async () => {
    const a = await signUp("card");
    const b = await signUp("card");
    const co = await a.town.createCompany("Card Co");
    await admit(a, b, co.id);
    await as(a.token)
      .player(a.userId)
      .ingest([event({ inputTokens: 1_000_000 })]);
    await as(b.token)
      .player(b.userId)
      .ingest([event({ inputTokens: 3_000_000 })]);
    const card = await b.town.company(co.id, "today");
    expect(card).toMatchObject({ id: co.id, name: "Card Co", website: null, logo: null });
    expect(card.members.map((m) => [m.name, m.isOwner])).toEqual([
      [b.name, false],
      [a.name, true],
    ]);
    expect(card.totals.tokens).toBe(card.members[0]!.tokens + card.members[1]!.tokens);
    expect(card.rank).toBeGreaterThan(0);
    expect(card.daily).toHaveLength(30);
    expect(card.daily.at(-1)!.tokens).toBe(card.totals.tokens);
    await expect(b.town.company(999_999, "today")).rejects.toThrow("gone");
  });

  test("today's corner has the top 5 and me, even at zero", async () => {
    const quiet = await signUp("quiet");
    const today = await quiet.town.today();
    expect(today.me.rank).toBeNull();
    expect(today.top.at(-1)).toMatchObject({ isMe: true, name: quiet.name });
    expect(today.top.length).toBeLessThanOrEqual(6);
  });

  test("profiles have 30 days, models and a level", async () => {
    const a = await signUp("prof");
    await as(a.token)
      .player(a.userId)
      .ingest([event({ cacheReadTokens: 20_000_000 })]);
    const p = await a.town.profile(a.userId, "30d");
    expect(p.daily).toHaveLength(30);
    expect(p.daily.at(-1)!.tokens).toBeGreaterThan(0);
    expect(p.models[0]!.model).toBe("claude-haiku-4-5-20251001");
    expect(p.level).toBeGreaterThan(0);
  });

  test("badges: founder for a company owner, big day after 3B tokens in one day", async () => {
    const a = await signUp("badge");
    await a.town.createCompany("Badge Co");
    const ids = async () => (await a.town.profile(a.userId, "today")).badges.map((b) => b.id);
    expect(await ids()).toEqual(["founder"]);
    // A minute counts for at most 200M, so the 3B comes over fifteen, on an old day so it can't straddle midnight.
    const day = Date.UTC(2023, 5, 14, 12);
    await as(a.token)
      .player(a.userId)
      .ingest(
        Array.from({ length: 15 }, (_, i) =>
          event({ inputTokens: 200e6, outputTokens: 0, timestamp: day + i * MIN }),
        ),
      );
    // The same 3B is also a billion tokens burnt over all days (the furnace).
    expect(await ids()).toEqual(["bigday", "founder", "furnace"]);
  });
});
