import { describe, expect, test } from "bun:test";
import { MAPS } from "@tokenmaxxing/core/maps.ts";
import {
  BIG_BLIND,
  BUY_IN,
  type Card,
  type PokerState,
  SEATS,
  SMALL_BLIND,
} from "@tokenmaxxing/core/poker.ts";
import { pokerChairs } from "@tokenmaxxing/core/pokertable.ts";
import { DIRS, type Facing, roomEntry, route } from "@tokenmaxxing/core/world.ts";
import { eventually, rich } from "./rivet.ts";
import { connect, walk } from "./world-client.ts";

type Tab = Awaited<ReturnType<typeof connect>>;
type Rich = Awaited<ReturnType<typeof rich>>;

const map = MAPS.basement;
const chairs = pokerChairs();
const COINS = 1000;

/** What a tab has heard: the table as the room sees it, and its own two cards. */
function listen(c: Tab) {
  const table: PokerState[] = [];
  const hole: Card[][] = [];
  c.conn.on("poker", (s: PokerState) => table.push(s));
  c.conn.on("pokerHole", (h: Card[]) => hole.push(h));
  return { table, hole };
}

/** Takes `c` from the Tavern down the stairs to the net cafe, where the poker table is. */
async function descend(c: Tab): Promise<void> {
  const inn = MAPS.inn;
  const me = c.snap.players.find((p) => p.id === c.snap.selfId)!;
  const way = route(inn, [me.x, me.y], inn.find("S")[0]!)!;
  await walk(c.conn, way);
  const down = roomEntry("basement");
  me.x = down.x;
  me.y = down.y;
}

/** A tab for `token`, taken down to the net cafe. */
async function joinCafe(token: string): Promise<Tab> {
  const c = await connect(token);
  await descend(c);
  return c;
}

/** Walks `c` to a tile beside chair `i` that faces it, and says which way to face. */
async function approach(c: Tab, i: number): Promise<Facing> {
  const chair = chairs[i]!;
  const me = c.snap.players.find((p) => p.id === c.snap.selfId)!;
  for (const [facing, [dx, dy]] of Object.entries(DIRS) as [Facing, [number, number]][]) {
    const stand: [number, number] = [chair.x - dx, chair.y - dy];
    if (!map.walkable(...stand)) continue;
    const way = route(map, [me.x, me.y], stand);
    if (!way) continue;
    await walk(c.conn, way);
    return facing;
  }
  throw new Error(`no way to chair ${i}`);
}

const balance = async (u: Rich) => (await u.town.wallet()).balance;

/** Two players at chairs `i` and `j`, bought in, with the hand dealt. Each test has chairs of its own: a tab just closed may still be in its chair for a moment. */
async function pair(i: number, j: number) {
  const a = await rich("pka", COINS);
  const b = await rich("pkb", COINS);
  const ca = await joinCafe(a.token);
  const cb = await joinCafe(b.token);
  const heardA = listen(ca);
  const heardB = listen(cb);
  expect(await ca.conn.pokerSit(await approach(ca, i))).toMatchObject({ state: "sit" });
  expect(await cb.conn.pokerSit(await approach(cb, j))).toMatchObject({ state: "sit" });
  // The second player makes two: a hand is dealt a few seconds on.
  await eventually(() => expect(heardA.table.at(-1)?.street).toBe("preflop"), 15_000);
  await eventually(() => expect(heardB.table.at(-1)?.street).toBe("preflop"));
  return { a, b, ca, cb, heardA, heardB };
}

describe("the net cafe's poker table", () => {
  test("sitting down takes the buy-in from the wallet, standing up gives the stack back", async () => {
    const a = await rich("pk", COINS);
    const c = await joinCafe(a.token);
    const heard = listen(c);
    expect(await balance(a)).toBe(COINS);

    expect(await c.conn.pokerSit(await approach(c, 1))).toMatchObject({ state: "sit", room: "basement" });
    expect(await balance(a)).toBe(COINS - BUY_IN);
    await eventually(() =>
      expect(heard.table.at(-1)?.seats[1]).toMatchObject({ userId: a.userId, stack: BUY_IN }),
    );
    expect(heard.table.at(-1)!.names[a.userId]).toBeTruthy();

    // Sat at the table, the arrow keys do nothing.
    expect(await c.conn.step("down")).toMatchObject({ notice: expect.stringContaining("poker table") });

    expect(await c.conn.pokerLeave()).toBeNull();
    await eventually(async () => expect(await balance(a)).toBe(COINS));
    await eventually(() => expect(heard.table.at(-1)?.seats.every((s) => s === null)).toBe(true));
    await c.conn.dispose();
  });

  test("someone in a chair keeps others out of it, and a table has no more than its seats", async () => {
    const a = await rich("pk", COINS);
    const b = await rich("pk", COINS);
    const ca = await joinCafe(a.token);
    const cb = await joinCafe(b.token);
    expect(await ca.conn.pokerSit(await approach(ca, 2))).toMatchObject({ state: "sit" });
    expect(await cb.conn.pokerSit(await approach(cb, 2))).toMatchObject({
      notice: "Someone's already there.",
    });
    expect(await balance(b)).toBe(COINS);
    expect(chairs).toHaveLength(SEATS);
    await ca.conn.pokerLeave();
    await ca.conn.dispose();
    await cb.conn.dispose();
  });

  test("you need the buy-in to sit down", async () => {
    const poor = await rich("pk", BUY_IN - 1);
    const c = await joinCafe(poor.token);
    const r = await c.conn.pokerSit(await approach(c, 0));
    expect(r).toMatchObject({ notice: expect.stringContaining("costs") });
    expect(await balance(poor)).toBe(BUY_IN - 1);
    await c.conn.dispose();
  });

  test("sitting down is for the net cafe: out in the town it does nothing", async () => {
    const a = await rich("pk", COINS);
    const c = await connect(a.token);
    const me = c.snap.players.find((p) => p.id === a.userId)!;
    const out = (await walk(c.conn, route(MAPS.inn, [me.x, me.y], MAPS.inn.find("x")[0]!)!)).at(-1);
    expect(out).toMatchObject({ room: "town" });
    expect(await c.conn.pokerSit("up")).toBeNull();
    expect(await c.conn.pokerAct("fold", 0)).toMatch(/Tavern/);
    expect(await c.conn.pokerLeave()).toMatch(/Tavern/);
    expect(await balance(a)).toBe(COINS);
    await c.conn.dispose();
  });

  test("a hand between two: the one who folds loses their blind to the other, and nobody's cards leak", async () => {
    const { a, b, ca, cb, heardA, heardB } = await pair(0, 3);
    const start = heardA.table.at(-1)!;
    expect(start.pot).toBe(SMALL_BLIND + BIG_BLIND);
    // Each has two cards of their own, and only their own.
    await eventually(() => expect(heardA.hole.at(-1)).toHaveLength(2));
    await eventually(() => expect(heardB.hole.at(-1)).toHaveLength(2));
    const holeA = heardA.hole.at(-1)!;
    const holeB = heardB.hole.at(-1)!;
    expect(new Set([...holeA, ...holeB]).size).toBe(4);

    // Whoever is on the clock folds: heads-up that is the small blind, one coin in.
    const mover = start.seats[start.toAct]!;
    const [folder, keeper] = mover.userId === a.userId ? [ca, cb] : [cb, ca];
    expect(await folder.conn.pokerAct("fold", 0)).toBeNull();
    const last = () => (folder === ca ? heardA : heardB).table.at(-1)!;
    await eventually(() => expect(last().street).toBeNull());
    const done = last();
    // The pot (the two blinds) went to the one who didn't fold; nobody was shown anything.
    expect(done.result).toMatchObject({
      shown: [],
      won: { [keeper === ca ? a.userId : b.userId]: SMALL_BLIND + BIG_BLIND },
    });
    const stackOf = (u: Rich) => done.seats.find((s) => s?.userId === u.userId)!.stack;
    const keeperUser = keeper === ca ? a : b;
    const folderUser = keeper === ca ? b : a;
    // The folder is out the blind they had posted (their stack at the deal, less nothing more); the other has it.
    expect(stackOf(folderUser)).toBe(mover.stack);
    expect(stackOf(keeperUser)).toBe(2 * BUY_IN - mover.stack);
    expect(mover.stack).toBeLessThan(BUY_IN);

    // Nothing but a seat's `cards` flag ever went out about anyone's hole cards: no card of theirs in what the other heard.
    for (const [heard, mine, theirs] of [
      [heardA, holeA, holeB],
      [heardB, holeB, holeA],
    ] as const) {
      expect(JSON.stringify(heard.table)).not.toContain('"hole"');
      for (const h of heard.hole) expect(h.length === 0 || h.every((card) => mine.includes(card))).toBe(true);
      expect(heard.hole.flat().some((card) => theirs.includes(card))).toBe(false);
    }
    // And the room's snapshot knows nothing of the table.
    expect(JSON.stringify(ca.events.snapshots)).not.toContain("poker");

    // Standing up pays both back what the table left them with: no coin made or lost.
    await ca.conn.pokerLeave();
    await cb.conn.pokerLeave();
    await eventually(async () => {
      expect(await balance(keeperUser)).toBe(COINS - BUY_IN + stackOf(keeperUser));
      expect(await balance(folderUser)).toBe(COINS - BUY_IN + stackOf(folderUser));
    });
    expect((await balance(a)) + (await balance(b))).toBe(2 * COINS);
    await ca.conn.dispose();
    await cb.conn.dispose();
  }, 20_000);

  test("moves are checked: not your turn, a raise below the minimum, not at the table", async () => {
    const { a, b, ca, cb, heardA } = await pair(4, 5);
    const start = heardA.table.at(-1)!;
    const [mover, other] = start.seats[start.toAct]!.userId === a.userId ? [ca, cb] : [cb, ca];
    expect(await other.conn.pokerAct("check", 0)).toMatch(/not your turn/);
    expect(await mover.conn.pokerAct("check", 0)).toMatch(/can't check/);
    expect(await mover.conn.pokerAct("raise", BIG_BLIND + 1)).toMatch(
      new RegExp(`least you can raise to is ${2 * BIG_BLIND}`),
    );
    expect(await mover.conn.pokerAct("raise", 100000)).toMatch(/only have/);
    expect(await mover.conn.pokerAct("dance", 0)).toMatch(/not a move/);
    expect(await mover.conn.pokerAct("raise", 40)).toBeNull();
    await eventually(() => expect(heardA.table.at(-1)).toMatchObject({ bet: 40 }));
    const stranger = await rich("pk", COINS);
    const cs = await joinCafe(stranger.token);
    expect(await cs.conn.pokerAct("fold", 0)).toMatch(/not at the poker table/);
    for (const c of [ca, cb, cs]) await c.conn.dispose();
    void b;
  }, 20_000);

  test("closing the tab folds the hand and stands you up: the stack goes back to the wallet", async () => {
    const { a, b, ca, cb, heardB } = await pair(1, 2);
    const start = heardB.table.at(-1)!;
    const mine = (id: number) => start.seats.find((s) => s?.userId === id)!;
    const leftBehind = mine(a.userId).stack;
    await ca.conn.dispose();
    // The hand ends with the other taking the pot; A is gone from the table.
    await eventually(() => {
      const t = heardB.table.at(-1)!;
      expect(t.street).toBeNull();
      expect(t.seats.filter((s) => s !== null).map((s) => s!.userId)).toEqual([b.userId]);
    });
    const after = heardB.table.at(-1)!.seats.find((s) => s?.userId === b.userId)!;
    expect(after.stack).toBe(2 * BUY_IN - leftBehind);
    // A got what they had not put in the pot; no new hand is dealt to one player.
    await eventually(async () => expect(await balance(a)).toBe(COINS - BUY_IN + leftBehind));
    await cb.conn.pokerLeave();
    await eventually(async () => expect(await balance(b)).toBe(COINS - BUY_IN + after.stack));
    expect(heardB.table.at(-1)!.street).toBeNull();
    await cb.conn.dispose();
  }, 20_000);
});
