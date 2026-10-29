import { describe, expect, test } from "bun:test";
import { commonStairs, houseStairs } from "@tokenmaxxing/core/common.ts";
import { MAPS } from "@tokenmaxxing/core/maps.ts";
import { withPieces } from "@tokenmaxxing/core/office.ts";
import { route } from "@tokenmaxxing/core/world.ts";
import { admin, admit, eventually, signUp } from "./rivet.ts";
import { connect, walk } from "./world-client.ts";

// The company's common room, up the stairs from its house.
describe("the common room", () => {
  test("members take the stairs up and back, and its chat stays upstairs", async () => {
    const a = await signUp("common");
    const b = await signUp("common");
    const co = await a.town.createCompany("Lounge");
    await admit(a, b, co.id);
    const ca = await connect(a.token);
    const cb = await connect(b.token);
    expect(ca.snap.room).toBe(`hq:${co.id}`);
    const [ux, uy] = houseStairs()[0]!;
    const me = ca.snap.players.find((p) => p.id === a.userId)!;
    const up = (await walk(ca.conn, route(MAPS.hq, [me.x, me.y], [ux, uy])!)).at(-1);
    expect(up).toMatchObject({ room: `common:${co.id}`, x: 11, y: 12 });
    await eventually(() => expect(ca.events.snapshots.at(-1)?.room).toBe(`common:${co.id}`));
    await ca.conn.say("anyone for ping-pong?");
    // The mate downstairs in the house doesn't hear it; a mate who comes up does.
    await Bun.sleep(200);
    expect(cb.events.chat.map((l) => l.text)).not.toContain("anyone for ping-pong?");
    const mb = cb.snap.players.find((p) => p.id === b.userId)!;
    await walk(cb.conn, route(MAPS.hq, [mb.x, mb.y], [ux, uy])!);
    const joined = await eventually(() => {
      const snap = cb.events.snapshots.at(-1)!;
      expect(snap.room).toBe(`common:${co.id}`);
      return snap;
    });
    expect(joined.chat.map((l) => l.text)).toContain("anyone for ping-pong?");
    expect(joined.doors).toEqual([]);
    // Back down: below the stairs in the house.
    const [ex, ey] = commonStairs()[0]!;
    const back = (await walk(ca.conn, route(MAPS.common, [11, 12], [ex, ey])!)).at(-1);
    expect(back).toMatchObject({ room: `hq:${co.id}`, x: ux, y: uy - 1 });
    for (const c of [ca, cb]) await c.conn.dispose();
  });

  test("company furniture can be put out in the common room", async () => {
    const a = await signUp("common");
    const co = await a.town.createCompany("Furnished");
    await admin().adminSetCompanyCoins(co.id, 1000);
    const ca = await connect(a.token);
    const me = ca.snap.players.find((p) => p.id === a.userId)!;
    const [ux, uy] = houseStairs()[0]!;
    await walk(ca.conn, route(MAPS.hq, [me.x, me.y], [ux, uy])!);
    await eventually(() => expect(ca.events.snapshots.at(-1)?.room).toBe(`common:${co.id}`));
    // The plant, bought and put out upstairs.
    const bought = await a.town.buyPiece("furn.ρ");
    expect(bought.notice).toContain("Bought");
    const snap = await eventually(() => {
      const s = ca.events.snapshots.at(-1)!;
      expect(s.drops.length + ca.events.drops.length).toBeGreaterThan(0);
      return s;
    });
    expect(snap.room).toBe(`common:${co.id}`);
    expect(ca.events.drops.at(-1) ?? snap.drops[0]).toMatchObject({
      item: "furn.ρ",
      room: `common:${co.id}`,
      co: co.id,
    });
    await ca.conn.dispose();
  });

  test("a placed seat goes back to the storeroom when faced, and moves to a free tile", async () => {
    const a = await signUp("common");
    const co = await a.town.createCompany("Takeback");
    await admin().adminSetCompanyCoins(co.id, 1000);
    const ca = await connect(a.token);
    const me = ca.snap.players.find((p) => p.id === a.userId)!;
    const [ux, uy] = houseStairs()[0]!;
    await walk(ca.conn, route(MAPS.hq, [me.x, me.y], [ux, uy])!);
    await eventually(() => expect(ca.events.snapshots.at(-1)?.room).toBe(`common:${co.id}`));
    await a.town.buyPiece("furn.ε"); // a beanbag: a seat, which you can't be told apart from by facing
    const bag = await eventually(() => {
      const d = ca.events.drops.at(-1);
      expect(d).toBeDefined();
      return d!;
    });
    const stored = async () => (await a.town.me()).company?.stored ?? [];
    expect(await stored()).toEqual([]);
    // Next to it, facing it: G takes it, though a seat is walkable-ish and sat on with E.
    const stand: [number, number] = [bag.x, bag.y - 1];
    await walk(ca.conn, [
      ...route(withPieces([{ ch: "ε", x: bag.x, y: bag.y }], MAPS.common), [11, 12], stand)!,
      "down",
    ]);
    // Moved first, to a bare tile of the floor, and not onto the stairs or a wall.
    expect(await ca.conn.move(bag.id, 4, 10)).toMatchObject({
      notice: "Moved the Beanbag.",
      drop: { x: 4, y: 10 },
    });
    expect(await ca.conn.move(bag.id, 0, 0)).toEqual({ notice: "It doesn't fit there." });
    expect(await ca.conn.move(bag.id, 11, 13)).toEqual({ notice: "It doesn't fit there." });
    const around = withPieces([{ ch: "ε", x: 4, y: 10 }], MAPS.common);
    await walk(ca.conn, [...route(around, stand, [4, 9])!, "down"]);
    expect(await ca.conn.take()).toMatchObject({ notice: "📦 The Beanbag is in the storeroom." });
    expect(await stored()).toEqual([{ item: "furn.ε", count: 1 }]);
    // Gone from the floor: nothing to move.
    expect(await ca.conn.move(bag.id, 4, 10)).toEqual({ notice: "That's gone." });
    // Another company can't touch it, not even by id.
    const b = await signUp("common");
    await b.town.createCompany("Nosy");
    const cb = await connect(b.token);
    expect(await cb.conn.move(bag.id, 4, 10)).toEqual({ notice: "That's gone." });
    for (const c of [ca, cb]) await c.conn.dispose();
  });
  test("the building's pieces go to the storeroom in one action, and come out near you, or on a chosen tile", async () => {
    const a = await signUp("bulk");
    const co = await a.town.createCompany("Bulk");
    await admin().adminSetCompanyCoins(co.id, 1000);
    const ca = await connect(a.token);
    expect(ca.snap.room).toBe(`hq:${co.id}`);
    expect(await ca.conn.putAway()).toEqual({ notice: "Nothing to put away here.", count: 0 });
    for (const item of ["furn.ρ", "furn.ε", "furn.ρ"]) await a.town.buyPiece(item);
    const laid = await eventually(() => {
      const all = [...ca.snap.drops, ...ca.events.drops].filter((d) => d.co === co.id);
      expect(new Set(all.map((d) => d.id)).size).toBe(3);
      return all;
    });
    const plant = laid.find((d) => d.item === "furn.ρ")!;
    expect(await ca.conn.putAway()).toEqual({ notice: "Put 3 pieces in the storeroom.", count: 3 });
    expect((await a.town.me()).company?.stored).toEqual(
      expect.arrayContaining([
        { item: "furn.ρ", count: 2 },
        { item: "furn.ε", count: 1 },
      ]),
    );
    // One goes down on the exact tile it stood on; one onto a tile that is taken does not fit and stays stored.
    const one = await a.town.placePiece("furn.ρ", { x: plant.x, y: plant.y });
    expect(one.drop).toMatchObject({ item: "furn.ρ", x: plant.x, y: plant.y, co: co.id });
    expect(await a.town.placePiece("furn.ε", { x: plant.x, y: plant.y })).toMatchObject({
      notice: "It doesn't fit there.",
    });
    expect((await a.town.me()).company?.stored).toContainEqual({ item: "furn.ε", count: 1 });
    // The rest, near you.
    const all = await a.town.placeAll();
    expect(all.notice).toBe("Placed 2 pieces.");
    expect(all.company.stored).toEqual([]);
    expect((await a.town.placeAll()).notice).toBe("The storeroom is empty.");
    // Undo: the exact piece goes back to the storeroom by id; again, it is gone.
    expect(await ca.conn.putBack(one.drop!.id)).toMatchObject({
      notice: "📦 The Bonsai is in the storeroom.",
    });
    expect(await ca.conn.putBack(one.drop!.id)).toEqual({ notice: "That's gone." });
    // Another company's people can neither put away nor put back what is not theirs.
    const b = await signUp("bulk");
    await b.town.createCompany("Other");
    const cb = await connect(b.token);
    expect(await cb.conn.putAway()).toEqual({ notice: "Nothing to put away here.", count: 0 });
    expect((await a.town.me()).company?.stored?.length).toBe(1);
    for (const c of [ca, cb]) await c.conn.dispose();
  });
});
