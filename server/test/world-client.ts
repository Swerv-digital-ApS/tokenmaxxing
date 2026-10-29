/** A tab on the world for the world tests: its events, and steps at the pace the world allows. */
import { expect } from "bun:test";
import {
  type ChatLine,
  DROPS,
  type Drop,
  type Moves,
  type PlayerInfo,
  RUN_STEP_MS,
  type Snapshot,
  STEP_BURST,
  setDrops,
} from "@tokenmaxxing/core/world.ts";
import { admit, as, eventually, rich } from "./rivet.ts";

type Conn = ReturnType<ReturnType<typeof as>["world"]["connect"]>;

/**
 * The least each player has left of the world's step budget (`takeStep`): it refills only from when
 * the server surely took the last step (its answer came back) to when it surely takes the next (we
 * send it), so the server always has at least this much.
 */
const budgets = new Map<string, { budget: number; at: number }>();
const tokenOf = new WeakMap<Conn, string>();
const REFILL_MS = RUN_STEP_MS * 0.8;

/** One step at running pace: it waits only until the budget has a step. One at a time per player. */
export async function step(conn: Conn, dir: string) {
  const b = budgets.get(tokenOf.get(conn)!)!;
  if (b.budget < 1) await Bun.sleep(Math.max(0, b.at + (1 - b.budget) * REFILL_MS - Date.now()) + 2);
  b.budget = Math.min(STEP_BURST, b.budget + (Date.now() - b.at) / REFILL_MS) - 1;
  const result = await conn.step(dir);
  b.at = Date.now();
  return result;
}

export async function connect(token: string) {
  const conn = as(token).world.connect();
  tokenOf.set(conn, token);
  if (!budgets.has(token)) budgets.set(token, { budget: STEP_BURST, at: 0 });
  const events = {
    moves: [] as Moves[],
    chat: [] as ChatLine[],
    snapshots: [] as Snapshot[],
    mentions: [] as ChatLine[],
    drops: [] as Drop[],
    pickups: [] as { id: number }[],
    infos: [] as PlayerInfo[],
  };
  conn.on("info", (i: PlayerInfo) => events.infos.push(i));
  conn.on("mention", (l: ChatLine) => events.mentions.push(l));
  conn.on("drop", (d: Drop) => events.drops.push(d));
  conn.on("pickup", (p: { id: number }) => events.pickups.push(p));
  conn.on("moves", (m: Moves) => events.moves.push(m));
  conn.on("chat", (l: ChatLine) => events.chat.push(l));
  conn.on("snapshot", (s: Snapshot) => events.snapshots.push(s));
  // A reconnect is a new connection the world doesn't know has joined: join again, as the game does
  // (`web/src/net.ts`), or this tab hears nothing more of its room. Said, so a loaded CI run shows it.
  let opened = false;
  conn.onOpen(() => {
    if (opened) {
      console.warn("[test] world connection reopened: joining again");
      void conn.join();
    }
    opened = true;
  });
  const snap = await conn.join();
  return { conn, snap, events };
}

/** Walks `dirs` one step at a time, at running pace. */
export async function walk(conn: Conn, dirs: string[]) {
  const results = [];
  for (const d of dirs) results.push(await step(conn, d));
  return results;
}

/**
 * Closes `c`'s tab, and waits until `watcher` (in their room: `info` goes there) hears they're offline:
 * in bed, remembering where they were.
 */
export async function asleep(c: Awaited<ReturnType<typeof connect>>, watcher: typeof c, userId: number) {
  await c.conn.dispose();
  await eventually(() => expect(watcher.events.infos.findLast((i) => i.id === userId)?.online).toBe(false));
}

/** `owner`'s company with `mate` in it, both in its house (`room`) on their beds; `owner` bought `items`. */
export async function house(...items: string[]) {
  const owner = await rich("drop", 2000);
  const co = await owner.town.createCompany("Floor");
  const mate = await rich("drop");
  await admit(owner, mate, co.id);
  for (const i of items) await owner.town.buy(i);
  const room = `hq:${co.id}` as const;
  const o = await connect(owner.token);
  const m = await connect(mate.token);
  const at = (c: typeof o, id: number) => c.snap.players.find((p) => p.id === id)!;
  return { owner, mate, room, o, m, ownerAt: at(o, owner.userId), mateAt: at(m, mate.userId) };
}

/** `town.drop`, which has to land. Furniture goes in this process's map too, for `route`. */
export async function drop(u: { town: { drop(item: string): Promise<{ drop?: Drop }> } }, item: string) {
  const { drop } = await u.town.drop(item);
  if (!drop) throw new Error(`${item} didn't land`);
  setDrops(drop.room, [...(DROPS.get(drop.room) ?? []), drop]);
  return drop;
}
