import { describe, expect, test } from "bun:test";
import { mapOf, route, setDrops } from "@tokenmaxxing/core/world.ts";
import { admin, admit, eventually, rich } from "./rivet.ts";
import { asleep, connect, drop, house, walk } from "./world-client.ts";

describe("drops", () => {
  test("a pet lies where it's dropped; a colleague on it takes it, once, and it's gone for everyone", async () => {
    const { owner, mate, room, o, m, ownerAt, mateAt } = await house("pet.1", "hat.1");
    // A bed is two tiles deep (head, then foot): step off it sideways, onto plain floor.
    await walk(o.conn, ["left"]);
    expect(mapOf(room).at(ownerAt.x - 1, ownerAt.y)).toBe("_");
    const duck = await drop(owner, "pet.1");
    expect(duck).toMatchObject({ item: "pet.1", room, x: ownerAt.x - 1, y: ownerAt.y, by: owner.userId });
    // One drop per tile: the next lands beside it.
    const hat = await drop(owner, "hat.1");
    expect(Math.max(Math.abs(hat.x - duck.x), Math.abs(hat.y - duck.y))).toBe(1);
    await eventually(() => expect(m.events.drops).toEqual([duck, hat]));
    const again = await connect(owner.token);
    expect(again.snap.drops).toEqual([duck, hat]);
    await again.conn.dispose();

    const path = route(mapOf(room), [mateAt.x, mateAt.y], [duck.x, duck.y])!;
    await walk(m.conn, path.slice(0, -1));
    expect(await m.conn.take()).toBeNull(); // next to it
    await walk(m.conn, path.slice(-1));
    expect(await m.conn.take()).toEqual({ notice: "🎒 Took the Duck.", drop: duck });
    expect(await owner.town.bag()).toEqual([]);
    expect(await mate.town.bag()).toEqual([{ item: "pet.1", count: 1 }]);
    for (const c of [o, m]) await eventually(() => expect(c.events.pickups).toEqual([{ id: duck.id }]));
    expect(await m.conn.take()).toBeNull(); // already gone
    for (const c of [o, m]) await c.conn.dispose();
  });

  test("a room holds 30; the 31st stays in its dropper's bag", async () => {
    const owner = await rich("full", 80);
    const co = await owner.town.createCompany("Full House");
    const people = [owner, ...(await Promise.all(Array.from({ length: 6 }, () => rich("full", 80))))];
    for (const u of people.slice(1)) await admit(owner, u, co.id);
    // Five each, the most anyone has on the floor at once: they lie in the house, asleep in bed.
    await Promise.all(people.map((u) => Promise.all(Array.from({ length: 5 }, () => u.town.buy("furn.=")))));
    for (const u of people.slice(0, 6)) for (let i = 0; i < 5; i++) await drop(u, "furn.=");
    const last = people[6]!;
    expect(await last.town.drop("furn.=")).toEqual({ notice: "There's no room on the floor here." });
    expect(await last.town.bag()).toEqual([{ item: "furn.=", count: 5 }]);
    // Closed, its floor goes back to whoever dropped it.
    await admin().adminCloseCompany(co.id);
    expect(await owner.town.bag()).toEqual([{ item: "furn.=", count: 5 }]);
  });

  test("a dropped sofa is a sofa: sat on, taken while seated, and the sitter is up after", async () => {
    const { owner, mate, room, o, m, mateAt } = await house("furn.s");
    const sofa = await drop(owner, "furn.s");
    // Walking into it only turns you to face it.
    const path = route(mapOf(room), [mateAt.x, mateAt.y], [sofa.x, sofa.y])!;
    await walk(m.conn, path);
    expect(await m.conn.sit(path.at(-1))).toMatchObject({ x: sofa.x, y: sofa.y, state: "sit" });
    expect(await m.conn.take()).toEqual({ notice: "🎒 Took the Sofa.", drop: sofa });
    // The last the owner saw of them: a step (`m`), or their arrival if the world told the room of
    // them only after all this (a slow tick).
    await eventually(() => {
      const seen = o.events.moves.flatMap((mv) => [
        ...mv.join.filter((p) => p.id === mate.userId).map((p) => [p.x, p.y, p.state]),
        ...mv.m.filter(([id]) => id === mate.userId).map(([, x, y, , state]) => [x, y, state]),
      ]);
      expect(seen.at(-1)).toEqual([sofa.x, sofa.y, "idle"]);
    });
    expect(await mate.town.bag()).toEqual([{ item: "furn.s", count: 1 }]);
    for (const c of [o, m]) await c.conn.dispose();
  });

  test("a dropped desk blocks; it's taken from the next tile, facing it, not from further or off a hat", async () => {
    const { owner, room, o, m, ownerAt, mateAt } = await house("furn.d", "hat.1");
    // Furniture goes on the free tile you face: here, below (5, 4).
    await walk(o.conn, [...route(mapOf(room), [ownerAt.x, ownerAt.y], [5, 3])!, "down"]);
    const desk = await drop(owner, "furn.d");
    expect(desk).toMatchObject({ x: 5, y: 5 });
    // A hat on the tile below the desk: the owner stands there to drop it.
    const at = { x: 5, y: 4 };
    await walk(o.conn, route(mapOf(room), [at.x, at.y], [desk.x, desk.y + 1])!);
    expect(await drop(owner, "hat.1")).toMatchObject({ x: desk.x, y: desk.y + 1 });
    // Two tiles below it, facing it: too far.
    await walk(m.conn, [...route(mapOf(room), [mateAt.x, mateAt.y], [desk.x, desk.y + 3])!, "up"]);
    expect(await m.conn.take()).toBeNull();
    // On the hat, facing the desk: the hat is what's taken.
    await walk(m.conn, ["up"]);
    expect(await m.conn.take()).toMatchObject({ notice: "🎒 Took the Beanie." });
    // Into the desk: still in front of it, which only the take shows.
    await walk(m.conn, ["up"]);
    expect(await m.conn.take()).toEqual({ notice: "🎒 Took the Desk.", drop: desk });
    for (const c of [o, m]) await c.conn.dispose();
  }, 30_000);

  test("you wake where you were only if you still can: not on a sofa that's gone, not inside a desk", async () => {
    const { owner, mate, room, o, m, ownerAt, mateAt } = await house("furn.s", "furn.d");
    // Beside the owner's bed and one below its foot, facing down at the floor under it (a bed is 2 tiles deep).
    await walk(o.conn, ["left", "down"]);
    expect(mapOf(room).at(ownerAt.x - 1, ownerAt.y + 2)).toBe("_");
    const sofa = await drop(owner, "furn.s");
    expect(sofa).toMatchObject({ x: ownerAt.x - 1, y: ownerAt.y + 2 });
    const path = route(mapOf(room), [mateAt.x, mateAt.y], [sofa.x, sofa.y])!;
    await walk(m.conn, path);
    expect(await m.conn.sit(path.at(-1))).toMatchObject({ x: sofa.x, y: sofa.y, state: "sit" });
    await asleep(m, o, mate.userId);
    // The owner sits on it, takes it and steps off: the mate wakes up there, standing.
    expect(await o.conn.sit("down")).toMatchObject({ x: sofa.x, y: sofa.y, state: "sit" });
    expect(await o.conn.take()).toMatchObject({ drop: sofa });
    setDrops(room, []);
    await walk(o.conn, ["left"]);
    const up = await connect(mate.token);
    const there = up.snap.players.find((p) => p.id === mate.userId);
    expect(there).toMatchObject({ x: sofa.x, y: sofa.y, state: "idle" });
    // Asleep again, a desk goes where they stood: they wake in bed, not inside it.
    await asleep(up, o, mate.userId);
    await walk(o.conn, ["left", "right"]); // back, facing the sofa's tile
    expect(await drop(owner, "furn.d")).toMatchObject({ x: sofa.x, y: sofa.y });
    const again = await connect(mate.token);
    const me = again.snap.players.find((p) => p.id === mate.userId)!;
    expect(mapOf(room).at(me.x, me.y)).toBe("b");
    for (const c of [o, again]) await c.conn.dispose();
  });
});
