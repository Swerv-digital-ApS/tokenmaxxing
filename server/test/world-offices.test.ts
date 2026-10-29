import { describe, expect, test } from "bun:test";
import { hqMap, OFFICE_SIZES, slotSpot } from "@tokenmaxxing/core/office.ts";
import { roomEntry, route } from "@tokenmaxxing/core/world.ts";
import { admin, admit, eventually, rich, signUp, veteran } from "./rivet.ts";
import { asleep, connect, step, walk } from "./world-client.ts";

// Offices and their doors.
describe("world", () => {
  test("a level-10 member's door is in the building; colleagues walk through it", async () => {
    const owner = await signUp("door");
    const co = await owner.town.createCompany("Doors");
    await veteran(owner);
    const mate = await signUp("door");
    await admit(owner, mate, co.id);
    const room = `office:${owner.userId}` as const;
    // Only the owner has a door: the colleague is level 0.
    const m = await connect(mate.token);
    expect(m.snap.room).toBe(`hq:${co.id}`);
    const door = { userId: owner.userId, name: owner.name, slot: 0, ...slotSpot(0) };
    expect(m.snap.doors).toEqual([door]);
    const me = m.snap.players.find((p) => p.id === mate.userId)!;
    const path = route(hqMap(m.snap.doors), [me.x, me.y], [door.x, door.y])!;
    expect((await walk(m.conn, path)).at(-1)).toMatchObject({ room });
    // Out again: below the door.
    expect(await step(m.conn, "down")).toEqual({
      room: `hq:${co.id}`,
      x: door.x,
      y: door.y + 1,
      facing: "down",
      state: "idle",
    });

    // Anyone in the building walks in through a door: every office is open. Back out to the hallway.
    expect(await step(m.conn, "up")).toMatchObject({ room });
    expect(await step(m.conn, "down")).toMatchObject({ room: `hq:${co.id}`, x: door.x, y: door.y + 1 });
    const o = await connect(owner.token);
    const at = o.snap.players.find((p) => p.id === owner.userId)!;
    const own = await walk(o.conn, route(hqMap(o.snap.doors), [at.x, at.y], [door.x, door.y])!);
    expect(own.at(-1)).toMatchObject({ room });
    await o.conn.dispose();

    // Leaving the company takes the door; the colleague in its hallway goes back to the entry.
    await owner.town.leaveCompany();
    const after = await eventually(() => {
      const snap = m.events.snapshots.at(-1)!;
      expect(snap.doors).toEqual([]);
      return snap;
    });
    const { x, y } = roomEntry(`hq:${co.id}`);
    expect(after.players.find((p) => p.id === mate.userId)).toMatchObject({ x, y });
    await m.conn.dispose();
  }, 30_000);

  test("a door keeps its slot when an owner before it leaves; a later joiner takes the free one", async () => {
    const a = await signUp("slot");
    const co = await a.town.createCompany("Slots");
    await veteran(a);
    const b = await signUp("slot");
    await admit(a, b, co.id);
    await veteran(b);
    const c = await signUp("slot");
    await admit(a, c, co.id);
    await veteran(c);
    const watch = await connect(c.token);
    const doorsNow = () => (watch.events.snapshots.at(-1) ?? watch.snap).doors;
    const full = await eventually(() => {
      expect(doorsNow()).toHaveLength(3);
      return [...doorsNow()];
    });
    const of = (doors: typeof full, u: { userId: number }) => doors.find((d) => d.userId === u.userId)!;
    // Packed by id to begin with.
    expect(full.map((d) => d.slot).sort()).toEqual([0, 1, 2]);
    await b.town.leaveCompany();
    const less = await eventually(() => {
      expect(doorsNow()).toHaveLength(2);
      return [...doorsNow()];
    });
    expect(of(less, a)).toMatchObject({ x: of(full, a).x, y: of(full, a).y });
    expect(of(less, c)).toMatchObject({ x: of(full, c).x, y: of(full, c).y });
    // Someone new, with a higher id than everyone, lands in the slot b left.
    const d = await signUp("slot");
    await admit(a, d, co.id);
    await veteran(d);
    const more = await eventually(() => {
      expect(doorsNow()).toHaveLength(3);
      return [...doorsNow()];
    });
    expect(of(more, d)).toMatchObject({ slot: of(full, b).slot, x: of(full, b).x, y: of(full, b).y });
    for (const u of [a, c]) expect(of(more, u)).toMatchObject({ x: of(full, u).x, y: of(full, u).y });
    await watch.conn.dispose();
  });

  test("anyone visits an office from its owner's card, or goes there from the rooms list", async () => {
    const owner = await signUp("office");
    const co = await owner.town.createCompany("Tower");
    await veteran(owner);
    const guest = await signUp("office");
    const g = await connect(guest.token);
    const room = `office:${owner.userId}` as const;
    expect(await g.conn.visit(owner.userId)).toMatchObject({ room });
    const inside = await eventually(() => {
      const snap = g.events.snapshots.at(-1)!;
      expect(snap.room).toBe(room);
      return snap;
    });
    // Level 10 put a desk and a chair on its floor.
    expect(inside.drops).toMatchObject([
      { item: "furn.d", x: 5, y: 3, by: owner.userId },
      { item: "furn.c", x: 5, y: 4, by: owner.userId },
    ]);
    expect(inside.owner).toEqual({ id: owner.userId, name: owner.name, tier: 0 }); // a veteran: the first size
    expect((await guest.town.profile(owner.userId, "7d")).office).toBe(true);
    expect(await g.conn.visit(owner.userId)).toMatchObject({ room });
    const o = await connect(owner.token);
    expect(await o.conn.visit(owner.userId)).toMatchObject({ room });
    await o.conn.dispose();

    // The rooms list goes straight there too, and to the square; not into a company you're not in.
    await g.conn.goTo("town");
    expect(await g.conn.goTo(room)).toMatchObject({ room, state: "idle" });
    expect(await g.conn.goTo(`hq:${co.id}`)).toEqual({ notice: "You can't get in there." });
    expect(await g.conn.goTo("nowhere")).toBeNull();

    // Deleted, their office goes from the world too, furniture and all; the guest still inside sees a bare one.
    await admin().adminDeleteUser(owner.userId);
    const again = await connect(guest.token);
    expect(again.snap).toMatchObject({ room, drops: [] });
    for (const c of [g, again]) await c.conn.dispose();
  });

  test("a wallpaper is bought once and shows to visitors; the open list counts them, not the owner", async () => {
    const owner = await signUp("decor");
    await owner.town.createCompany("Walls");
    await veteran(owner);
    await admin().adminSetCoins(owner.userId, 500);
    const guest = await signUp("decor");
    await expect(owner.town.setDecor("wall", "nyhavn")).rejects.toMatchObject({ code: "not_owned" });
    await owner.town.buyDecor("wall", "nyhavn");
    await owner.town.setDecor("wall", "nyhavn");
    expect(await owner.town.decorOwned()).toContain("wall.nyhavn");
    await expect(guest.town.setDecor("wall", null)).rejects.toMatchObject({ code: "not_found" });

    const g = await connect(guest.token);
    expect(await g.conn.visit(owner.userId)).toMatchObject({ room: `office:${owner.userId}` });
    const inside = await eventually(() => {
      const snap = g.events.snapshots.at(-1)!;
      expect(snap.owner).toMatchObject({ id: owner.userId, tier: 0, wall: "nyhavn" });
      return snap;
    });
    expect(inside.owner!.floor).toBeUndefined();

    // Changing it while someone is inside sends them the room again.
    await owner.town.setDecor("wall", null);
    await eventually(() => expect(g.events.snapshots.at(-1)!.owner?.wall).toBeUndefined());

    // The owner going in doesn't count, the guest does (the list is cached for 5 s).
    const o = await connect(owner.token);
    expect(await o.conn.visit(owner.userId)).toMatchObject({ room: `office:${owner.userId}` });
    const row = await eventually(async () => {
      const mine = (await guest.town.openOffices()).find((r) => r.id === owner.userId);
      expect(mine).toMatchObject({ company: "Walls", tier: 0, visitors: 1 });
      return mine!;
    }, 8_000);
    expect(row.inside).toBeGreaterThanOrEqual(1);
    for (const c of [g, o]) await c.conn.dispose();
  }, 30_000);

  test("a bigger office is bought in order, and the room grows for whoever is inside", async () => {
    const owner = await signUp("space");
    await owner.town.createCompany("Space");
    await admin().adminSetCoins(owner.userId, 100_000);
    await expect(owner.town.buyOfficeSize()).rejects.toMatchObject({ code: "not_found" }); // no office before level 10
    await veteran(owner);
    await admin().adminSetCoins(owner.userId, 100_000);
    const guest = await signUp("space");
    expect(await owner.town.officeSize()).toBe(0);
    const g = await connect(guest.token);
    await g.conn.visit(owner.userId);

    const before = (await owner.town.wallet()).balance;
    await owner.town.buyOfficeSize();
    expect(await owner.town.officeSize()).toBe(1);
    expect((await owner.town.wallet()).balance).toBe(before - OFFICE_SIZES[1]!.price);
    await eventually(() => expect(g.events.snapshots.at(-1)!.owner?.tier).toBe(1));

    await owner.town.buyOfficeSize();
    await owner.town.buyOfficeSize();
    expect(await owner.town.officeSize()).toBe(OFFICE_SIZES.length - 1);
    await expect(owner.town.buyOfficeSize()).rejects.toMatchObject({ code: "owned" });
    await g.conn.dispose();
  }, 30_000);

  test("a bigger office is not for the poor", async () => {
    const owner = await signUp("space");
    await owner.town.createCompany("Poor");
    await veteran(owner);
    await admin().adminSetCoins(owner.userId, 0);
    await expect(owner.town.buyOfficeSize()).rejects.toMatchObject({ code: "too_poor" });
    expect(await owner.town.officeSize()).toBe(0);
  });

  test("nor is the office of someone who left their company", async () => {
    const owner = await signUp("left");
    await owner.town.createCompany("Leavers");
    await veteran(owner);
    const guest = await signUp("left");
    const g = await connect(guest.token);
    const w = await connect(owner.token);
    expect(await g.conn.visit(owner.userId)).toMatchObject({ room: `office:${owner.userId}` });
    await w.conn.visit(owner.userId);
    await asleep(g, w, guest.userId);
    await owner.town.leaveCompany(); // still open, but no office without a company
    const again = await connect(guest.token);
    expect(again.snap.room).toBe("inn");
    for (const c of [w, again]) await c.conn.dispose();
  });

  test("its owner moves a piece to a free tile, one step, and nobody else does", async () => {
    const owner = await signUp("office");
    await owner.town.createCompany("Movers");
    await veteran(owner);
    const guest = await signUp("office");
    const room = `office:${owner.userId}` as const;
    const g = await connect(guest.token);
    expect(await g.conn.visit(owner.userId)).toMatchObject({ room });
    // The level-10 chair lands on the floor after the visit: wait for it (a `find` alone never retries).
    const chair = await eventually(() => {
      const c = g.events.snapshots.at(-1)?.drops.find((d) => d.item === "furn.c");
      expect(c).toBeDefined();
      return c!;
    });
    expect(await g.conn.move(chair.id, 3, 6)).toEqual({ notice: "Only its owner moves that." });
    await g.conn.dispose();
    const o = await connect(owner.token);
    const at = o.snap.players.find((p) => p.id === owner.userId)!;
    const door = o.snap.doors.find((d) => d.userId === owner.userId)!;
    await walk(o.conn, route(hqMap(o.snap.doors), [at.x, at.y], [door.x, door.y])!);
    await eventually(() => expect(o.events.snapshots.at(-1)?.room).toBe(room));
    // Onto the desk's tile, onto the wall, and off the map: it stays where it was.
    for (const [x, y] of [
      [5, 3],
      [0, 0],
      [99, 99],
    ] as const)
      expect(await o.conn.move(chair.id, x, y)).toEqual({ notice: "It doesn't fit there." });
    expect(await o.conn.move(chair.id, 3, 6)).toMatchObject({
      notice: "Moved the Chair.",
      drop: { x: 3, y: 6 },
    });
    // F turns it a quarter where it stands; moving it on keeps it turned, and so does the next visitor's view.
    expect(await o.conn.move(chair.id, 3, 6, 1)).toMatchObject({
      notice: "Turned the Chair.",
      drop: { x: 3, y: 6, rot: 1 },
    });
    expect(await o.conn.move(chair.id, 4, 6)).toMatchObject({ drop: { x: 4, y: 6, rot: 1 } });
    // Still the owner's, and on the floor where it was put: a new visitor sees it there, turned.
    const late = await connect(owner.token);
    expect(late.snap.drops.find((d) => d.id === chair.id)).toMatchObject({ x: 4, y: 6, rot: 1 });
    // Half and three quarters round; a turn that is not a quarter is refused.
    expect(await o.conn.move(chair.id, 4, 6, 2)).toMatchObject({ drop: { x: 4, y: 6, rot: 2 } });
    expect(await o.conn.move(chair.id, 4, 6, 3)).toMatchObject({ drop: { x: 4, y: 6, rot: 3 } });
    await expect(o.conn.move(chair.id, 4, 6, 4)).rejects.toMatchObject({ code: "bad_request" });
    await expect(o.conn.move(chair.id, 4, 6, 1.5)).rejects.toMatchObject({ code: "bad_request" });
    const back = await o.conn.move(chair.id, 4, 6, 0);
    expect(back.drop?.rot).toBeUndefined();
    for (const c of [o, late]) await c.conn.dispose();
  });
  test("an owner puts the whole office away, places a piece on a chosen tile, and undoes it by id", async () => {
    const owner = await rich("tidy", 200);
    await owner.town.createCompany("Tidy");
    await veteran(owner);
    const room = `office:${owner.userId}` as const;
    const o = await connect(owner.token);
    const at = o.snap.players.find((p) => p.id === owner.userId)!;
    const door = o.snap.doors.find((d) => d.userId === owner.userId)!;
    // Nothing of an office to put away out in the company's building.
    expect(await o.conn.putAway()).toEqual({
      notice: "Nothing to put away here.",
      count: 0,
    });
    await walk(o.conn, route(hqMap(o.snap.doors), [at.x, at.y], [door.x, door.y])!);
    const here = await eventually(() => {
      const snap = o.events.snapshots.at(-1)!;
      expect(snap.room).toBe(room);
      return snap.drops;
    });
    expect(here.length).toBeGreaterThan(0);
    const chair = here.find((d) => d.item === "furn.c")!;
    const desk = here.find((d) => d.item === "furn.d")!;
    // All of it to the bag, in one go.
    const n = here.length;
    expect(await o.conn.putAway()).toEqual({ notice: `Put away ${n} piece${n === 1 ? "" : "s"}.`, count: n });
    expect(await o.conn.putAway()).toEqual({ notice: "Nothing to put away here.", count: 0 });
    expect(await owner.town.bag()).toContainEqual({ item: "furn.c", count: 1 });
    // The desk goes where it stood (a chosen tile), the chair on top of it does not fit, and stays in the bag.
    const placedDesk = await owner.town.drop("furn.d", { x: desk.x, y: desk.y });
    expect(placedDesk.drop).toMatchObject({ item: "furn.d", x: desk.x, y: desk.y });
    expect(await owner.town.drop("furn.c", { x: desk.x, y: desk.y })).toEqual({
      notice: "It doesn't fit there.",
    });
    expect(await owner.town.bag()).toContainEqual({ item: "furn.c", count: 1 });
    // Not a tile: a bad request, and nothing consumed.
    await expect(owner.town.drop("furn.c", { x: 1.5, y: 2 })).rejects.toThrow();
    const back = await o.conn.putBack(placedDesk.drop!.id);
    expect(back).toMatchObject({ drop: { id: placedDesk.drop!.id } });
    expect(await o.conn.putBack(placedDesk.drop!.id)).toEqual({ notice: "That's gone." });
    expect(await o.conn.putBack(chair.id + 9999)).toEqual({ notice: "That's gone." });
    // Somebody else's floor: no putting away, no putting back.
    const guest = await signUp("tidy");
    const g = await connect(guest.token);
    expect(await g.conn.visit(owner.userId)).toMatchObject({ room });
    const again = await owner.town.drop("furn.d", { x: desk.x, y: desk.y });
    expect(await g.conn.putBack(again.drop!.id)).toEqual({ notice: `That's ${owner.name}'s floor.` });
    expect(await g.conn.putAway()).toEqual({
      notice: "Put things away in your own office or your company's building.",
      count: 0,
    });
    for (const c of [o, g]) await c.conn.dispose();
  });
});
