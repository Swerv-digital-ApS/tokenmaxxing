import { describe, expect, test } from "bun:test";
import { hqMap, setOffice } from "@tokenmaxxing/core/office.ts";
import { DROPS, type Drop, mapOf, route, setDrops } from "@tokenmaxxing/core/world.ts";
import { serial } from "../src/actors/shared.ts";
import { town } from "../src/actors/town.ts";
import { world } from "../src/actors/world.ts";
import { migrateGraveyard } from "../src/graveyard.ts";
import { bag, grantRewards, placed, takeOut } from "../src/town/coins.ts";
import { migrate } from "../src/town/schema.ts";
import { memorySql } from "./memory-sql.ts";
import { admit, eventually, HOUR, rich, signUp, veteran } from "./rivet.ts";
import { connect, drop, walk } from "./world-client.ts";

// Floors with rules: a building's hallways, offices.
describe("drops", () => {
  test("furniture stays out of a building's hallways; a hallway that goes gives back what lay in it", async () => {
    const owner = await signUp("hall");
    const co = await owner.town.createCompany("Hallways");
    await veteran(owner); // a door, and a hallway to it
    const mate = await rich("hall", 500);
    await admit(owner, mate, co.id);
    for (const item of ["furn.p", "hat.1"]) await mate.town.buy(item);
    const m = await connect(mate.token);
    const me = m.snap.players.find((p) => p.id === mate.userId)!;
    // Up the passage into the hallway, facing along it.
    await walk(m.conn, [...route(hqMap(m.snap.doors), [me.x, me.y], [9, -1])!, "left"]);
    const plant = await drop(mate, "furn.p");
    expect(plant.y).toBeGreaterThanOrEqual(2); // down on the floor
    expect([13, 14].some((x) => plant.x === x && plant.y === 2)).toBe(false); // not at the foot of the passage either
    const hat = await drop(mate, "hat.1");
    expect(hat).toMatchObject({ x: 8, y: -1 });
    // The owner leaves: no door, no hallway, and the hat is back in the mate's bag.
    await owner.town.leaveCompany();
    expect(await mate.town.bag()).toEqual([{ item: "hat.1", count: 1 }]);
    await eventually(() => expect(m.events.pickups).toContainEqual({ id: hat.id }));
    await m.conn.dispose();
  });

  test("an office owner can't wall a visitor in", async () => {
    const owner = await rich("wall", 500);
    await owner.town.createCompany("Walls");
    await veteran(owner);
    for (let i = 0; i < 2; i++) await owner.town.buy("furn.p");
    const guest = await signUp("wall");
    const room = `office:${owner.userId}` as const;
    const g = await connect(guest.token);
    await g.conn.visit(owner.userId);
    const inside = await eventually(() => {
      const snap = g.events.snapshots.at(-1)!;
      expect(snap.room).toBe(room);
      return snap;
    });
    setOffice(inside.owner!.id, inside.owner!.tier, inside.owner!); // a veteran's office is the first size
    setDrops(room, inside.drops); // the desk and chair, for `route` here
    const exit = mapOf(room).find("x")[0]!;
    // The guest in the top-left corner; the owner puts a plant to their right, then one below them.
    await walk(g.conn, route(mapOf(room), [exit[0], exit[1] - 1], [1, 1])!);
    const o = await connect(owner.token);
    await o.conn.visit(owner.userId);
    await walk(o.conn, [...route(mapOf(room), [exit[0], exit[1] - 1], [4, 1])!, "left"]);
    expect(await drop(owner, "furn.p")).toMatchObject({ x: 2, y: 1 });
    await walk(o.conn, [...route(mapOf(room), [3, 1], [1, 4])!, "up"]);
    expect(await drop(owner, "furn.p")).not.toMatchObject({ x: 1, y: 2 });
    expect(route(mapOf(room), [1, 1], exit)).not.toBeNull();
    setDrops(room, []);
    for (const c of [g, o]) await c.conn.dispose();
  });

  test("an office floor is its owner's: its furniture, and a visitor's gift, are theirs to take", async () => {
    const owner = await signUp("gift");
    await owner.town.createCompany("Gifts");
    await veteran(owner);
    const guest = await rich("gift", 500);
    await guest.town.buy("pet.2");
    const g = await connect(guest.token);
    expect(await g.conn.visit(owner.userId)).toMatchObject({ room: `office:${owner.userId}` });
    // Both land on the office's entry tile, where the cat is.
    const cat = await drop(guest, "pet.2");
    expect(await g.conn.take()).toEqual({ notice: `That's ${owner.name}'s floor.` });
    // Nor the chair that came at level 10, sitting on it.
    await walk(g.conn, ["up", "up", "up", "up"]);
    expect(await g.conn.sit("up")).toMatchObject({ x: 5, y: 4, state: "sit" });
    expect(await g.conn.take()).toEqual({ notice: `That's ${owner.name}'s floor.` });
    const o = await connect(owner.token);
    await o.conn.visit(owner.userId);
    expect(await o.conn.take()).toMatchObject({ drop: cat });
    expect(await owner.town.bag()).toContainEqual({ item: "pet.2", count: 1 });
    expect(await guest.town.bag()).toEqual([]);
    for (const c of [g, o]) await c.conn.dispose();
  });

  test("an office is furnished by dropping: a desk lands on the tile you face; 40 pieces at most", async () => {
    const owner = await rich("furnish", 400);
    await owner.town.createCompany("Furnished");
    await veteran(owner); // the desk and chair: 2
    await owner.town.buy("furn.d");
    await Promise.all(Array.from({ length: 28 }, () => owner.town.buy("furn.=")));
    const o = await connect(owner.token);
    const room = `office:${owner.userId}` as const;
    expect(await o.conn.visit(owner.userId)).toMatchObject({ room, x: 5, y: 9, facing: "up" });
    expect(await drop(owner, "furn.d")).toMatchObject({ room, x: 5, y: 8 });
    // Your own office's floor isn't loot: no five at a time.
    for (let i = 0; i < 27; i++) await drop(owner, "furn.="); // 30
    for (let n = 0; n < 2; n++) {
      const guest = await rich("furnish", 80);
      await Promise.all(Array.from({ length: 5 }, () => guest.town.buy("furn.=")));
      const g = await connect(guest.token);
      await g.conn.visit(owner.userId);
      for (let i = 0; i < 5; i++) await drop(guest, "furn.="); // 40
      await g.conn.dispose();
    }
    expect(await owner.town.drop("furn.=")).toEqual({ notice: "There's no room on the floor here." });
    expect(await owner.town.bag()).toContainEqual({ item: "furn.=", count: 1 });
    await o.conn.dispose();
  });

  test("a world starting up lays every floor again from `town`: an office's furniture, a drop in the Inn", async () => {
    // `town` and `world` in this process, on an in-memory database: the world's restart can't be driven
    // on the server.
    const { sql } = memorySql();
    await migrate(sql);
    await sql.execute("INSERT INTO users (id, name, look, created_at) VALUES (7, 'ada', '{}', 0)");
    await sql.execute("INSERT INTO items (owner_id, item, at) VALUES (7, 'pet.1', 0)");
    await grantRewards(sql, 7, 10, 0);
    const id = await takeOut(sql, 7, "pet.1", 0);
    await placed(sql, { id, item: "pet.1", room: "inn", x: 3, y: 3, by: 7, at: 0 });
    const seed = await town.config.actions!.seed({ conn: { state: { kind: "internal" } }, db: sql } as never);
    // What it had before sleeping isn't kept: a ghost of a drop whose call failed goes.
    setDrops("inn", [{ id: id + 100, item: "pet.2", room: "inn", x: 1, y: 1, by: 7, at: 0 }]);
    // The world's own database: the graveyard it keeps (`graveyard.ts`).
    const own = memorySql().sql;
    await migrateGraveyard(own);
    await world.config.onWake!({
      state: { seeded: true, players: {}, companies: {} },
      vars: {},
      db: own,
      conns: new Map(),
      client: () => {
        const actor = {
          getOrCreate: () => ({
            seed: async () => seed,
            pokerRelease: async () => 0,
            rouletteRefund: async () => 0,
          }),
        };
        return { town: actor, world: actor, arcade: actor };
      },
    } as never);
    expect([mapOf("office:7").at(5, 3), mapOf("office:7").at(5, 4)]).toEqual(["d", "c"]);
    expect(DROPS.get("inn")).toEqual([{ id, item: "pet.1", room: "inn", x: 3, y: 3, by: 7, at: 0 }]);
    for (const room of ["inn", "office:7"] as const) setDrops(room, []);
  });

  test("the sweeper takes an hour-old drop off the world's floor and back to its dropper", async () => {
    // In this process, like the one above: the sweeper's alarm is every 10 minutes.
    const { sql } = memorySql();
    await migrate(sql);
    await sql.execute("INSERT INTO users (id, name, look, created_at) VALUES (7, 'ada', '{}', 0)");
    await sql.execute("INSERT INTO items (owner_id, item, at) VALUES (7, 'pet.1', 0), (7, 'pet.2', 0)");
    const at = [Date.now() - 2 * HOUR, Date.now()];
    const drops: Drop[] = [];
    for (const [i, item] of ["pet.1", "pet.2"].entries()) {
      const d: Drop = {
        id: await takeOut(sql, 7, item, at[i]!),
        item,
        room: "inn",
        x: 3 + i,
        y: 3,
        by: 7,
        at: at[i]!,
      };
      await placed(sql, d);
      drops.push(d);
    }
    setDrops("inn", drops);
    const inWorld = {
      conn: { state: { kind: "internal" } },
      state: { players: {} },
      conns: new Map(),
      vars: { dirty: new Set() },
    };
    const actor = {
      getOrCreate: () => ({
        removeDrops: (ids: number[]) => world.config.actions!.removeDrops(inWorld as never, ids),
      }),
    };
    await town.config.actions!.sweep({
      db: sql,
      vars: { raids: null, serial: serial() },
      client: () => ({ town: actor, world: actor, arcade: actor }),
    } as never);
    expect(DROPS.get("inn")).toEqual([drops[1]!]);
    expect(await bag(sql, 7)).toEqual([{ item: "pet.1", count: 1 }]);
    setDrops("inn", []);
  });
});
