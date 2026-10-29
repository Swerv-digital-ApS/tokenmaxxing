import { expect, test } from "bun:test";
import { MAPS } from "@tokenmaxxing/core/maps.ts";
import { outsideDoor, route } from "@tokenmaxxing/core/world.ts";
import { eventually, signUp } from "./rivet.ts";
import { connect, step, walk } from "./world-client.ts";

test("pond casts require the bank; early reels, movement and duplicate claims do not award fish", async () => {
  const a = await signUp("angler");
  const v = await connect(a.token);
  try {
    expect((await v.conn.fishingCast("right")).ok).toBe(false);
    await expect(a.town.recordFish(a.userId, { fish: "golden", cm: 40 })).rejects.toThrow();
    const me = v.snap.players.find((p) => p.id === a.userId)!;
    await walk(v.conn, route(MAPS.inn, [me.x, me.y], MAPS.inn.find("x")[0]!)!);
    const door = outsideDoor("inn");
    await walk(v.conn, route(MAPS.town, [door.x, door.y], [2, 12])!);
    expect((await v.conn.fishingCast("left")).ok).toBe(false);
    expect((await v.conn.fishingCast("nope")).ok).toBe(false);
    const first = await v.conn.fishingCast("right");
    expect(first.ok).toBe(true);
    expect(await v.conn.fishingReel()).toMatchObject({
      ok: false,
      message: "Too soon! Wait for the bobber to dip.",
    });
    expect(await a.town.fishingJournal()).toEqual([]);
    await Bun.sleep(1550);
    const cast = await v.conn.fishingCast("right");
    if (!cast.ok) throw Error(cast.message);
    // Repeated casts keep their original bite rather than rerolling the wait.
    expect(await v.conn.fishingCast("right")).toMatchObject({ ok: true, cast: cast.cast });
    await Bun.sleep(Math.max(0, cast.cast.biteAt - Date.now()) + 100);
    const replies = await Promise.all([v.conn.fishingReel(), v.conn.fishingReel()]);
    expect(replies.filter((r) => r.ok)).toHaveLength(1);
    const journal = await a.town.fishingJournal();
    expect(journal.reduce((n, e) => n + e.count, 0)).toBe(1);
    // A later cast is cancelled when the player walks along the bank.
    const next = await v.conn.fishingCast("right");
    expect(next.ok).toBe(true);
    await step(v.conn, "up");
    expect((await v.conn.fishingReel()).ok).toBe(false);
    expect(await a.town.fishingJournal()).toEqual(journal);
  } finally {
    await v.conn.dispose();
  }
}, 60_000);

test("everyone in town sees an angler's line, their catch held up, and the rod put away when they walk", async () => {
  const a = await signUp("caster");
  const b = await signUp("watcher");
  const v = await connect(a.token);
  const w = await connect(b.token);
  try {
    // Both out to the bank: the angler at the water, the watcher a step behind.
    for (const [p, x] of [
      [v, 2],
      [w, 1],
    ] as const) {
      const me = p.snap.players.find((q) => q.id === (p === v ? a.userId : b.userId))!;
      await walk(p.conn, route(MAPS.inn, [me.x, me.y], MAPS.inn.find("x")[0]!)!);
      const door = outsideDoor("inn");
      await walk(p.conn, route(MAPS.town, [door.x, door.y], [x, 12])!);
    }
    const about = () => w.events.infos.filter((i) => i.id === a.userId).at(-1);
    const cast = await v.conn.fishingCast("right");
    if (!cast.ok) throw Error(cast.message);
    await eventually(() =>
      expect(about()?.angling).toEqual({
        waterX: 3,
        waterY: 12,
        biteAt: cast.cast.biteAt,
        endsAt: cast.cast.endsAt,
      }),
    );
    await Bun.sleep(Math.max(0, cast.cast.biteAt - Date.now()) + 100);
    const reel = await v.conn.fishingReel();
    if (!reel.ok) throw Error(reel.message);
    await eventually(() => {
      expect(about()?.angling ?? null).toBeNull();
      expect(about()?.landing).toMatchObject({ fish: reel.catch.fish, waterX: 3, waterY: 12 });
    });
    // A new cast takes the old catch down; closing the panel puts the rod away; walking off clears the lot.
    const again = await v.conn.fishingCast("right");
    expect(again.ok).toBe(true);
    await eventually(() => expect(about()?.angling).toBeTruthy());
    await v.conn.fishingCancel();
    await eventually(() => expect(about()?.angling ?? null).toBeNull());
    await step(v.conn, "up");
    await eventually(() => expect(about()?.landing ?? null).toBeNull());
  } finally {
    await v.conn.dispose();
    await w.conn.dispose();
  }
}, 60_000);
