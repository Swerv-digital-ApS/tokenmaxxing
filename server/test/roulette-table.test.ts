import { describe, expect, test } from "bun:test";
import { MAPS } from "@tokenmaxxing/core/maps.ts";
import type { PokerState } from "@tokenmaxxing/core/poker.ts";
import { MAX_SPIN, type RouletteState, SPOTS } from "@tokenmaxxing/core/roulette.ts";
import { rouletteSpots, rouletteTable } from "@tokenmaxxing/core/roulettetable.ts";
import { DIRS, type Facing, roomEntry, route } from "@tokenmaxxing/core/world.ts";
import { eventually, rich } from "./rivet.ts";
import { connect, walk } from "./world-client.ts";

type Tab = Awaited<ReturnType<typeof connect>>;
const map = MAPS.basement;
const spots = rouletteSpots();
const everySpot = Array.from({ length: SPOTS }, (_, i) => i);

function listen(c: Tab) {
  const table: RouletteState[] = [];
  const poker: PokerState[] = [];
  c.conn.on("roulette", (s: RouletteState) => table.push(s));
  c.conn.on("poker", (s: PokerState) => poker.push(s));
  return { table, poker };
}

async function joinCafe(token: string): Promise<Tab> {
  const c = await connect(token);
  const inn = MAPS.inn;
  const me = c.snap.players.find((p) => p.id === c.snap.selfId)!;
  await walk(c.conn, route(inn, [me.x, me.y], inn.find("S")[0]!)!);
  const down = roomEntry("basement");
  me.x = down.x;
  me.y = down.y;
  return c;
}

/** Walks beside spot `i` (not on a spot) and says which way to face it. */
async function approach(c: Tab, i: number): Promise<Facing> {
  const [sx, sy] = spots[i]!;
  const me = c.snap.players.find((p) => p.id === c.snap.selfId)!;
  for (const [facing, [dx, dy]] of Object.entries(DIRS) as [Facing, [number, number]][]) {
    const stand: [number, number] = [sx - dx, sy - dy];
    if (!map.walkable(...stand) || spots.some(([x, y]) => x === stand[0] && y === stand[1])) continue;
    const way = route(map, [me.x, me.y], stand);
    if (!way) continue;
    await walk(c.conn, way);
    return facing;
  }
  // Hemmed in by the table and its neighbours (the middle of the row against the wall): walk onto the spot itself.
  const onto = route(map, [me.x, me.y], [sx, sy]);
  if (!onto) throw new Error(`no way to spot ${i}`);
  await walk(c.conn, onto);
  return "up";
}

const BET = [{ on: "red", stake: 1 }];

describe("the net cafe's roulette table", () => {
  test("spots are taken, freed, and a ninth player is refused", async () => {
    expect(spots).toHaveLength(SPOTS);
    const users = await Promise.all(Array.from({ length: SPOTS + 1 }, (_, i) => rich(`rt${i}`, 100)));
    const tabs: Tab[] = [];
    for (const u of users) tabs.push(await joinCafe(u.token));
    const heard = listen(tabs[SPOTS]!);
    for (let i = 0; i < SPOTS; i++) {
      expect(await tabs[i]!.conn.rouletteSit(await approach(tabs[i]!, i))).toMatchObject({
        state: "idle",
        x: spots[i]![0],
        y: spots[i]![1],
      });
    }
    await eventually(() => expect(heard.table.at(-1)?.seats.map((s) => s.spot)).toEqual(everySpot));
    expect(await tabs[SPOTS]!.conn.rouletteSit(await approach(tabs[SPOTS]!, 0))).toMatchObject({
      notice: "The table is full. You can watch.",
    });
    // Someone not seated cannot bet.
    expect(await tabs[SPOTS]!.conn.rouletteBet(BET)).toMatchObject({
      notice: "Take a spot at the table first.",
    });
    // Leaving frees the spot.
    await tabs[0]!.conn.rouletteLeave();
    await eventually(() => expect(heard.table.at(-1)?.seats.map((s) => s.spot)).toEqual(everySpot.slice(1)));
    for (const t of tabs) await t.conn.dispose();
  }, 60_000);

  test("Join takes you to the table from anywhere: into the net cafe and onto a free spot, or watching when it is full", async () => {
    const users = await Promise.all(Array.from({ length: SPOTS + 1 }, (_, i) => rich(`rj${i}`, 100)));
    const tabs: Tab[] = [];
    // Nobody went to the net cafe: they are all in the town to begin with.
    for (const u of users) tabs.push(await connect(u.token));
    const heard = listen(tabs[0]!);
    for (let i = 0; i < SPOTS; i++) {
      expect(await tabs[i]!.conn.rouletteJoin()).toMatchObject({
        room: "basement",
        state: "idle",
        x: spots[i]![0],
        y: spots[i]![1],
        // Above the table they face down at it, below it up.
        facing: spots[i]![1] < rouletteTable()!.y ? "down" : "up",
      });
    }
    await eventually(() => expect(heard.table.at(-1)?.seats.map((s) => s.spot)).toEqual(everySpot));
    // Already at the table: nothing moves.
    expect(await tabs[0]!.conn.rouletteJoin()).toEqual({ notice: "You're at the table already." });
    // A ninth is taken down to the net cafe all the same, to watch.
    expect(await tabs[SPOTS]!.conn.rouletteJoin()).toMatchObject({ room: "basement" });
    expect(heard.table.at(-1)?.seats).toHaveLength(SPOTS);
    expect(await tabs[SPOTS]!.conn.rouletteBet(BET)).toMatchObject({
      notice: "Take a spot at the table first.",
    });
    // A spot freed is the next one's, once its player has stepped off it.
    await tabs[1]!.conn.rouletteLeave();
    await eventually(() =>
      expect(heard.table.at(-1)?.seats.map((s) => s.spot)).toEqual(everySpot.filter((i) => i !== 1)),
    );
    await walk(tabs[1]!.conn, ["left"]);
    expect(await tabs[SPOTS]!.conn.rouletteJoin()).toMatchObject({ x: spots[1]![0], y: spots[1]![1] });
    for (const t of tabs) await t.conn.dispose();
  }, 60_000);

  test("two players share a round: one pocket, both paid from the ledger; Ready spins early", async () => {
    const a = await rich("rtA", 100);
    const b = await rich("rtB", 100);
    const w = await rich("rtW", 100);
    const ca = await joinCafe(a.token);
    const cb = await joinCafe(b.token);
    const cw = await joinCafe(w.token);
    const heard = listen(cw);
    const last = () => heard.table.at(-1);
    await ca.conn.rouletteSit(await approach(ca, 0));
    await cb.conn.rouletteSit(await approach(cb, 2));
    await eventually(() => expect(last()?.phase).toBe("betting"));
    expect(last()!.phaseEndsAt - last()!.now).toBeGreaterThan(15_000);
    const round = last()!.round;
    // Bets are public, and the stakes leave the wallet now.
    expect(await ca.conn.rouletteBet([{ on: "red", stake: 10 }])).toBeNull();
    expect(
      await cb.conn.rouletteBet([
        { on: "n:17", stake: 5 },
        { on: "odd", stake: 5 },
      ]),
    ).toBeNull();
    await eventually(() => expect(last()?.players.map((p) => p.bets.length)).toEqual([1, 2]));
    expect((await a.town.wallet()).balance).toBe(90);
    expect((await b.town.wallet()).balance).toBe(90);
    // Lowering refunds the difference; clearing refunds it all; putting it back takes it again.
    await ca.conn.rouletteBet([{ on: "red", stake: 4 }]);
    expect((await a.town.wallet()).balance).toBe(96);
    await ca.conn.rouletteBet([]);
    expect((await a.town.wallet()).balance).toBe(100);
    await ca.conn.rouletteBet([{ on: "red", stake: 10 }]);
    expect((await a.town.wallet()).balance).toBe(90);
    // Nobody is Ready yet; one is not enough.
    await ca.conn.rouletteReady(true);
    await Bun.sleep(300);
    expect(last()?.phase).toBe("betting");
    await cb.conn.rouletteReady(true);
    await eventually(() => expect(last()?.phase).toBe("spinning"));
    // Betting while it spins is refused.
    expect(await ca.conn.rouletteBet([{ on: "black", stake: 1 }])).toMatchObject({
      notice: "Bets are closed.",
    });
    const spin = last()!.last!;
    expect(spin.round).toBe(round);
    expect(spin.results.map((r) => [r.userId, r.staked])).toEqual(
      [
        [a.userId, 10],
        [b.userId, 10],
      ].sort((x, y) => x[0]! - y[0]!),
    );
    await eventually(() => expect(last()?.phase).toBe("result"), 10_000);
    expect(last()!.history[0]).toBe(spin.pocket);
    for (const [u, start] of [
      [a, 100],
      [b, 100],
    ] as const) {
      const r = spin.results.find((x) => x.userId === u.userId)!;
      expect((await u.town.wallet()).balance).toBe(start - r.staked + r.payout);
    }
    // The next round opens with empty tables.
    await eventually(() => expect(last()?.phase).toBe("betting"), 10_000);
    expect(last()!.round).toBe(round + 1);
    expect(last()!.players.every((p) => p.bets.length === 0 && !p.ready)).toBe(true);
    for (const c of [ca, cb, cw]) await c.conn.dispose();
  }, 60_000);

  test("refused bets, and leaving during betting refunds", async () => {
    const a = await rich("rtL", 100);
    const ca = await joinCafe(a.token);
    const heard = listen(ca);
    await ca.conn.rouletteSit(await approach(ca, 2));
    await eventually(() => expect(heard.table.at(-1)?.phase).toBe("betting"));
    expect(await ca.conn.rouletteBet([{ on: "red", stake: 101 }])).toMatchObject({
      notice: "Not enough coins for that bet.",
    });
    expect(await ca.conn.rouletteBet([{ on: "red", stake: MAX_SPIN + 1 }])).toMatchObject({
      notice: expect.stringContaining("at most"),
    });
    expect(await ca.conn.rouletteBet([{ on: "n:99", stake: 1 }])).toMatchObject({
      notice: expect.any(String),
    });
    expect((await a.town.wallet()).balance).toBe(100);
    expect(await ca.conn.rouletteBet([{ on: "red", stake: 30 }])).toBeNull();
    expect((await a.town.wallet()).balance).toBe(70);
    await ca.conn.rouletteLeave();
    await eventually(async () => expect((await a.town.wallet()).balance).toBe(100));
    await ca.conn.dispose();
  }, 60_000);

  test("a round nobody bets in is skipped: no spin, a new betting phase", async () => {
    const a = await rich("rtE", 100);
    const ca = await joinCafe(a.token);
    const heard = listen(ca);
    await ca.conn.rouletteSit(await approach(ca, 3));
    await eventually(() => expect(heard.table.at(-1)?.phase).toBe("betting"));
    const first = heard.table.at(-1)!;
    await ca.conn.rouletteReady(true); // ready with no bets does not spin it either
    await eventually(() => expect(heard.table.at(-1)!.round).toBeGreaterThan(first.round), 25_000);
    expect(heard.table.at(-1)!.phase).toBe("betting");
    expect(heard.table.at(-1)!.last?.round).not.toBe(first.round);
    await ca.conn.dispose();
  }, 60_000);

  test("walking off frees the spot", async () => {
    const a = await rich("rts", 500);
    const w = await rich("rtw", 100);
    const ca = await joinCafe(a.token);
    const cw = await joinCafe(w.token);
    const heard = listen(cw);
    await ca.conn.rouletteSit(await approach(ca, 0)); // above the table: one step up and away
    await eventually(() => expect(heard.table.at(-1)?.seats).toHaveLength(1));
    await walk(ca.conn, ["up"]);
    await eventually(() => expect(heard.table.at(-1)?.seats).toHaveLength(0));
    await ca.conn.dispose();
    await cw.conn.dispose();
  }, 60_000);

  test("a spectator at the poker table's room hears no hole cards", async () => {
    const w = await rich("rtp", 100);
    const cw = await joinCafe(w.token);
    const heard = listen(cw);
    await eventually(() => expect(heard.poker.length).toBeGreaterThan(0));
    expect(JSON.stringify(heard.poker)).not.toContain("hole");
    await cw.conn.dispose();
  });
});
