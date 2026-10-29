import { describe, expect, test } from "bun:test";
import { BARKEEP, BARKEEP_HOME } from "@tokenmaxxing/core/barkeep.ts";
import { BOTS } from "@tokenmaxxing/core/bots.ts";
import { MAPS } from "@tokenmaxxing/core/maps.ts";
import { SPECIAL } from "@tokenmaxxing/core/tavern.ts";
import {
  cupsLeft,
  outsideDoor,
  type PlayerInfo,
  type Raiders,
  roomEntry,
  route,
} from "@tokenmaxxing/core/world.ts";
import { admit, as, event, eventually, rich, signUp } from "./rivet.ts";
import { connect, step, walk } from "./world-client.ts";

describe("world", () => {
  test("a new player rests at the Inn and wakes up there", async () => {
    const a = await signUp("w");
    const { conn, snap } = await connect(a.token);
    expect(snap.room).toBe("inn");
    const me = snap.players.find((p) => p.id === a.userId)!;
    expect(me.state).toBe("idle");
    expect(me.online).toBe(true);
    await conn.dispose();
  });

  /** Walks `v` from where they woke at the Tavern up its stairs, to where everyone without a company sleeps. */
  const goUpstairs = async (v: Awaited<ReturnType<typeof connect>>) => {
    const me = v.snap.players.find((p) => p.id === v.snap.selfId)!;
    const path = route(MAPS.inn, [me.x, me.y], MAPS.inn.find("u")[0]!)!;
    expect((await walk(v.conn, path)).at(-1)).toMatchObject({ room: "upstairs" });
    return eventually(() => {
      const snap = v.events.snapshots.at(-1)!;
      expect(snap.room).toBe("upstairs");
      return snap;
    });
  };

  test("offline sleepers upstairs are a head count; waking up leaves it, falling asleep joins it", async () => {
    const sleeper = await signUp("inn");
    const viewer = await signUp("inn");
    const v = await connect(viewer.token);
    expect(v.snap.room).toBe("inn");
    expect(v.snap.asleep).toBe(0); // the Tavern itself holds nobody asleep
    const up = await goUpstairs(v);
    expect(up.players.map((p) => p.id)).not.toContain(sleeper.userId);
    expect(up.asleep).toBeGreaterThan(0);

    // Waking up takes them out of the count, and they get up at the Tavern's door.
    const s = await connect(sleeper.token);
    expect(s.snap.room).toBe("inn");
    await eventually(() => expect(v.events.moves.some((m) => m.asleep === up.asleep - 1)).toBe(true));
    await s.conn.dispose();
    await eventually(() => expect(v.events.moves.at(-1)?.asleep).toBe(up.asleep));
    await v.conn.dispose();
  });

  test("walking out of the Inn lands in town, next to its door", async () => {
    const a = await signUp("w");
    const { conn, events, snap } = await connect(a.token);
    const me = snap.players.find((p) => p.id === a.userId)!;
    const path = route(MAPS.inn, [me.x, me.y], MAPS.inn.find("x")[0]!)!;
    const results = await walk(conn, path);
    expect(results.at(-1)).toEqual({ ...outsideDoor("inn"), state: "idle" });
    await eventually(() => expect(events.snapshots.at(-1)!.room).toBe("town"));
    await conn.dispose();
  });

  test("the Tavern's stairs lead down to the basement, and its stairs up lead back to the landing", async () => {
    const a = await signUp("w");
    const { conn, events, snap } = await connect(a.token);
    const me = snap.players.find((p) => p.id === a.userId)!;
    const down = await walk(conn, route(MAPS.inn, [me.x, me.y], MAPS.inn.find("S")[0]!)!);
    expect(down.at(-1)).toEqual({ ...roomEntry("basement"), state: "idle" });
    await eventually(() => expect(events.snapshots.at(-1)!.room).toBe("basement"));
    const entry = roomEntry("basement");
    const up = await walk(conn, route(MAPS.basement, [entry.x, entry.y], MAPS.basement.find("x")[0]!)!);
    expect(up.at(-1)).toEqual({ ...roomEntry("inn", "S"), state: "idle" });
    await eventually(() => expect(events.snapshots.at(-1)!.room).toBe("inn"));
    await conn.dispose();
  });

  test("reloading puts you back where you were, not in bed", async () => {
    const a = await signUp("back");
    const first = await connect(a.token);
    const me = first.snap.players.find((p) => p.id === a.userId)!;
    await walk(first.conn, route(MAPS.inn, [me.x, me.y], MAPS.inn.find("x")[0]!)!);
    await walk(first.conn, ["left", "left"]);
    await Bun.sleep(150);
    // Closing the tab sends them to bed at the Inn...
    await first.conn.dispose();
    await Bun.sleep(300);
    // ...and opening it again gets them up where they left off.
    const again = await connect(a.token);
    const door = outsideDoor("inn");
    expect(again.snap.room).toBe("town");
    const back = again.snap.players.find((p) => p.id === a.userId)!;
    expect([back.x, back.y, back.state]).toEqual([door.x - 2, door.y, "idle"]);
    await again.conn.dispose();
  });

  test("steps into walls are refused; teleport-speed steps are corrected", async () => {
    const a = await signUp("w");
    const { conn } = await connect(a.token);
    const burst = await Promise.all(Array.from({ length: 8 }, () => conn.step("left")));
    expect(burst.some((r) => r !== null)).toBe(true);
    await conn.dispose();
  });

  test("a turn faces you another way without a step, and the room sees it", async () => {
    const a = await signUp("turn");
    const b = await signUp("seer");
    // The watcher is there first, so the room's telling of the newcomer always comes to them as an event
    // (the other way round it is in their snapshot, and the event only comes if they were quick).
    const seer = await connect(b.token);
    const me = await connect(a.token);
    const before = me.snap.players.find((p) => p.id === a.userId)!;
    // Once the room has been told they're there, a turn comes as a plain move.
    await eventually(() =>
      expect(seer.events.moves.some((m) => m.join.some((j) => j.id === a.userId))).toBe(true),
    );
    const to = before.facing === "left" ? "right" : "left";
    expect(await me.conn.turn(to)).toBeNull();
    expect(await me.conn.turn("sideways")).toBeNull();
    await eventually(() => {
      const seen = seer.events.moves.flatMap((m) => m.m).filter((m) => m[0] === a.userId);
      expect(seen.at(-1)).toEqual([a.userId, before.x, before.y, to, "idle"]);
    });
    await me.conn.dispose();
    await seer.conn.dispose();
  });

  test("coffee makes you shake, and more cups make it last longer", async () => {
    const a = await signUp("coffee");
    const { conn, snap } = await connect(a.token);
    const infos: PlayerInfo[] = [];
    conn.on("info", (i: PlayerInfo) => infos.push(i));
    const me = snap.players.find((p) => p.id === a.userId)!;
    const path = route(MAPS.inn, [me.x, me.y], MAPS.inn.find("o")[0]!)!;
    await walk(conn, path.slice(0, -1));
    expect(await conn.drink("down")).toBeNull(); // not facing the machine
    expect(await conn.drink(path.at(-1))).toEqual({ notice: expect.stringContaining("fresh cup") });
    expect(await conn.drink(path.at(-1))).toEqual({ notice: expect.stringContaining("Second cup") });
    await eventually(() => {
      const until = infos.filter((i) => i.id === a.userId).at(-1)?.coffeeUntil ?? 0;
      expect(cupsLeft(until, Date.now())).toBeGreaterThan(1.5);
    });
    await conn.dispose();
  });

  test("dances: the free ones for all, bought ones once learned, on until you stop or walk off", async () => {
    const a = await rich("dancer", 260);
    const b = await signUp("watcher");
    const { conn, events } = await connect(a.token);
    const other = await connect(b.token);
    const dancing = (v: { events: { infos: PlayerInfo[] } }) =>
      v.events.infos.filter((i) => i.id === a.userId).at(-1)?.dance;

    // A free one, seen by the room (both woke up at the Tavern).
    await conn.dance(1);
    await eventually(() => expect(dancing(other)).toBe(1));
    expect(events.infos.filter((i) => i.id === a.userId).at(-1)?.danceSince).toBeGreaterThan(0);

    // A sold one only once it's learned, and it's learned once.
    await expect(conn.dance(3)).rejects.toMatchObject({ code: "not_owned" });
    await a.town.buy("dance.3");
    await expect(a.town.buy("dance.3")).rejects.toMatchObject({ code: "owned" });
    expect((await a.town.wallet()).balance).toBe(80);
    await conn.dance(3);
    await eventually(() => expect(dancing(other)).toBe(3));
    await expect(conn.dance(99)).rejects.toMatchObject({ code: "not_found" });
    await expect(conn.dance("3")).rejects.toMatchObject({ code: "not_found" });

    // Walking off ends it; so does stopping.
    await step(conn, "left");
    await eventually(() => expect(dancing(other)).toBe(0));
    await conn.dance(2);
    await eventually(() => expect(dancing(other)).toBe(2));
    await conn.dance(0);
    await eventually(() => expect(dancing(other)).toBe(0));
    await conn.dispose();
    await other.conn.dispose();
  });

  test("the tap serves the day's special: free, cosmetic, and not again while it lasts", async () => {
    const a = await rich("tavern", 40);
    const before = (await a.town.wallet()).balance;
    const { conn, snap, events } = await connect(a.token);
    expect(snap.room).toBe("inn");
    const me = snap.players.find((p) => p.id === a.userId)!;
    const path = route(MAPS.inn, [me.x, me.y], MAPS.inn.find("y")[0]!)!;
    await walk(conn, path.slice(0, -1));
    expect(await conn.tavern("down")).toBeNull(); // not facing the tap
    const served = await conn.tavern(path.at(-1));
    expect(served).toEqual({ notice: expect.stringContaining("On the house") });
    const until = await eventually(() => {
      const i = events.infos.filter((x) => x.id === a.userId).at(-1);
      expect(i?.specialUntil).toBeGreaterThan(Date.now() + 14 * 60_000);
      return i!.specialUntil!;
    });
    expect(until).toBeLessThanOrEqual(Date.now() + SPECIAL.ms);
    // Again while it lasts: a notice, and no new clock.
    expect(await conn.tavern(path.at(-1))).toEqual({ notice: expect.stringContaining("still got") });
    expect(
      events.infos.filter((x) => x.id === a.userId && x.specialUntil !== until && x.specialUntil),
    ).toEqual([]);
    // Free: the wallet is as it was.
    expect((await a.town.wallet()).balance).toBe(before);
    await conn.dispose();
  });

  test("the barkeep takes orders across the bar; away from it nothing serves", async () => {
    const a = await signUp("tavern");
    const { conn, snap, events } = await connect(a.token);
    const me = snap.players.find((p) => p.id === a.userId)!;
    // Facing the bar counter: a coffee and the special, both on the house.
    const bar = route(MAPS.inn, [me.x, me.y], [2, 4])!;
    await walk(conn, bar.slice(0, -1));
    expect(await conn.drink(bar.at(-1))).toEqual({ notice: expect.stringContaining("fresh cup") });
    expect(await conn.tavern(bar.at(-1))).toEqual({ notice: expect.stringContaining("On the house") });
    await eventually(() =>
      expect(events.infos.filter((i) => i.id === a.userId).at(-1)).toMatchObject({
        coffeeUntil: expect.any(Number),
        specialUntil: expect.any(Number),
      }),
    );
    // Turned away from it: nothing.
    expect(await conn.drink("down")).toBeNull();
    const to = route(MAPS.inn, [2, 5], MAPS.inn.find("x")[0]!)!;
    await walk(conn, to);
    await eventually(() => expect(events.snapshots.at(-1)!.room).toBe("town"));
    // The town has no tap.
    expect(await conn.tavern("down")).toBeNull();
    await conn.dispose();
  });

  test("the barkeep stands in his cell at the bar and never walks", async () => {
    const a = await signUp("keep");
    const { conn, snap, events } = await connect(a.token);
    const keep = snap.players.find((p) => p.id === BARKEEP.id)!;
    expect(keep).toMatchObject({
      name: BARKEEP.name,
      online: true,
      state: "idle",
      x: BARKEEP_HOME.x,
      y: BARKEEP_HOME.y,
      facing: BARKEEP_HOME.facing,
    });
    // The world takes steps for bots now and then; a round trip later, he hasn't moved.
    await conn.say("one round");
    await eventually(() => expect(events.chat.map((l) => l.text)).toContain("one round"));
    expect(events.moves.some((m) => m.m.some(([id]) => id === BARKEEP.id))).toBe(false);
    await conn.dispose();
  });

  test("bots are up and about in town, and wander off", async () => {
    const a = await signUp("w");
    const { conn, events, snap } = await connect(a.token);
    const me = snap.players.find((p) => p.id === a.userId)!;
    await walk(conn, route(MAPS.inn, [me.x, me.y], MAPS.inn.find("x")[0]!)!);
    await eventually(() => expect(events.snapshots.at(-1)?.room).toBe("town"));
    const bot = events.snapshots.at(-1)!.players.find((p) => p.id === BOTS[0]!.id)!;
    expect(bot).toMatchObject({ name: BOTS[0]!.name, online: true, dozing: false, state: "idle" });
    await eventually(
      () => expect(events.moves.some((m) => m.m.some(([id]) => id === bot.id))).toBe(true),
      20_000,
    );
    await conn.dispose();
  }, 30_000);

  test("chat reaches the room, and only the room", async () => {
    const a = await signUp("chat");
    const b = await signUp("chat");
    const co = await a.town.createCompany("Chatters");
    await admit(a, b, co.id);
    const ca = await connect(a.token);
    const cb = await connect(b.token);
    await ca.conn.say("hello inn?");
    // a rests at the company house now, b too: same room, both hear it.
    expect(ca.snap.room).toBe(`hq:${co.id}`);
    await eventually(() => expect(cb.events.chat.map((l) => l.text)).toContain("hello inn?"));

    const outsider = await signUp("chat");
    const co2 = await connect(outsider.token);
    await ca.conn.say("members only");
    await Bun.sleep(200);
    expect(co2.events.chat.map((l) => l.text)).not.toContain("members only");
    await expect(outsider.town.me()).resolves.toBeDefined();
    for (const c of [ca, cb, co2]) await c.conn.dispose();
  });

  test("from town you see who is inside a house, names and levels, without going in", async () => {
    const member = await signUp("peek");
    const co = await member.town.createCompany("Glass House");
    const outsider = await signUp("peek");
    const o = await connect(outsider.token);
    // Freelancers wake at the Inn: walk out into town, where the houses are.
    const me = o.snap.players.find((p) => p.id === outsider.userId)!;
    await walk(o.conn, route(MAPS.inn, [me.x, me.y], MAPS.inn.find("x")[0]!)!);
    const town = await eventually(() => {
      const snap = o.events.snapshots.at(-1)!;
      expect(snap.room).toBe("town");
      return snap;
    });
    // The member is offline, so asleep in their house.
    expect(town.houses[co.id]).toEqual([
      { id: member.userId, name: member.name, level: 0, look: expect.any(Object), state: "away" },
    ]);
    await o.conn.dispose();
  });

  test("an @mention reaches someone in another room, once", async () => {
    const a = await signUp("ment");
    const co = await a.town.createCompany("Mentioners");
    const b = await signUp("ment"); // a freelancer: wakes up at the Inn, not in a's house
    const ca = await connect(a.token);
    const cb = await connect(b.token);
    expect(ca.snap.room).toBe(`hq:${co.id}`);
    expect(cb.snap.room).toBe("inn");
    await ca.conn.say(`hey @${b.name.toUpperCase()} and @${b.name} and @nobody`);
    await eventually(() =>
      expect(cb.events.mentions.map((l) => l.text)).toEqual([
        `hey @${b.name.toUpperCase()} and @${b.name} and @nobody`,
      ]),
    );
    expect(cb.events.chat).toHaveLength(0);
    expect(ca.events.mentions).toHaveLength(0);
    for (const c of [ca, cb]) await c.conn.dispose();
  });

  test("offline players work at a desk while agents run, and sleep otherwise", async () => {
    const a = await signUp("rest");
    const viewer = await signUp("rest");
    const v = await connect(viewer.token); // both freelancers: both sleep upstairs
    await goUpstairs(v);
    await as(a.token)
      .player(a.userId)
      .ingest([event({ timestamp: Date.now() - 60_000 })]);
    await eventually(() => {
      const moved = v.events.moves.flatMap((m) => [
        ...m.m,
        ...m.join.map((p) => [p.id, p.x, p.y, p.facing, p.state]),
      ]);
      expect(moved.filter((m) => m[0] === a.userId).at(-1)?.[4]).toBe("working");
    });
    await v.conn.dispose();
  });

  test("town receives an aggregate office light when a company member starts working", async () => {
    const worker = await signUp("light");
    const company = await worker.town.createCompany("Lit office");
    const viewer = await signUp("light");
    const v = await connect(viewer.token);
    const updates: number[][] = [];
    v.conn.on("officeLights", (ids: number[]) => updates.push(ids));
    const me = v.snap.players.find((p) => p.id === viewer.userId)!;
    await walk(v.conn, route(MAPS.inn, [me.x, me.y], MAPS.inn.find("x")[0]!)!);
    await eventually(() => expect(v.events.snapshots.at(-1)?.room).toBe("town"));
    expect(v.events.snapshots.at(-1)?.officeLights ?? []).not.toContain(company.id);
    await as(worker.token)
      .player(worker.userId)
      .ingest([event({ timestamp: Date.now() - 60_000 })]);
    await eventually(() => expect(updates.at(-1)).toContain(company.id));
    await v.conn.dispose();
  });

  test("whoever has agents running is at a desk in the dungeon, wherever they are, busiest first", async () => {
    const busy = await signUp("raid");
    const calm = await signUp("raid");
    const viewer = await signUp("raid");
    const v = await connect(viewer.token);
    const raiders: Raiders[] = [];
    v.conn.on("raiders", (r: Raiders) => raiders.push(r));
    expect(await v.conn.enterDungeon()).toMatchObject({ ...roomEntry("dungeon"), state: "idle" });
    await eventually(() => expect(v.events.snapshots.at(-1)?.room).toBe("dungeon"));
    // Neither ever walks in: three agents at 3M tokens a minute together, and one at 1k.
    const at = Date.now() - 60_000;
    await as(busy.token)
      .player(busy.userId)
      .ingest(
        ["a", "b", "c"].map((s) => event({ sessionId: s, timestamp: at, inputTokens: 1e6, outputTokens: 0 })),
      );
    await as(calm.token)
      .player(calm.userId)
      .ingest([event({ timestamp: at, inputTokens: 10_000, outputTokens: 0 })]);
    await eventually(() => {
      const top = raiders.at(-1)?.top ?? [];
      const ids = top.map((r) => r.id);
      expect(ids.indexOf(busy.userId)).toBeGreaterThanOrEqual(0);
      expect(ids.indexOf(busy.userId)).toBeLessThan(ids.indexOf(calm.userId));
      const b = top.find((r) => r.id === busy.userId)!;
      expect(b.agents).toBe(3);
      // 3M over the last 10 minutes, fading a little since that sync.
      expect(b.burn).toBeGreaterThan(250_000);
      expect(b.burn).toBeLessThanOrEqual(300_000);
      expect(top.find((r) => r.id === calm.userId)!.agents).toBe(1);
    });
    expect(v.events.snapshots.at(-1)!.raiders).not.toBeNull();
    await v.conn.dispose();
  });

  test("a dungeon seat is shared with everyone in the room", async () => {
    const sitter = await signUp("seat");
    const observer = await signUp("seat");
    const a = await connect(sitter.token);
    const b = await connect(observer.token);
    await a.conn.enterDungeon();
    await b.conn.enterDungeon();
    await eventually(() => expect(b.events.snapshots.at(-1)?.room).toBe("dungeon"));
    const entry = roomEntry("dungeon");
    const seat = MAPS.dungeon
      .find("r")
      .find((spot) => route(MAPS.dungeon, [entry.x, entry.y], spot)?.length)!;
    const path = route(MAPS.dungeon, [entry.x, entry.y], seat)!;
    const facing = path.pop()!;
    await walk(a.conn, path);
    expect(await a.conn.sit(facing)).toMatchObject({ room: "dungeon", x: seat[0], y: seat[1], state: "sit" });
    await eventually(() =>
      expect(
        b.events.moves.some((m) =>
          m.m.some((p) => p[0] === sitter.userId && p[1] === seat[0] && p[2] === seat[1] && p[4] === "sit"),
        ),
      ).toBe(true),
    );
    await a.conn.dispose();
    await b.conn.dispose();
  });
});
