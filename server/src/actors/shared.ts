import { timingSafeEqual } from "node:crypto";
import type { Notice } from "@tokenmaxxing/core/world.ts";
import { omit, promiseTimeout, withTimeout } from "hanzio";
import { randomToken } from "hanzio/crypto";
import { RivetError, UserError } from "rivetkit";
import type { Client } from "rivetkit/client";
import { sha256 } from "../crypto.ts";
import { PricingCache } from "../pricing.ts";
import { CLIENT_IP_HEADER } from "../proxy.ts";
import type { registry } from "./registry.ts";

/**
 * Actors call each other with this in their connection params. Every actor runs
 * in this process, so a key made at boot never leaves it.
 */
export const INTERNAL_KEY = randomToken();
export const internal = { params: { internal: INTERNAL_KEY } };

/**
 * Actors that other actors create (`player`, `match`) carry the internal key in their input: the
 * gateway lets browsers create actors too, and one made by a stranger (`player[<the next id>]` with
 * their own token) would be theirs. `proxy.ts` refuses such requests as well; this is the second lock.
 * Returns the input without the key, so it's never kept in state.
 */
export function fromInside<T extends object>(input: (T & { internal?: string }) | undefined): T {
  if (input?.internal !== INTERNAL_KEY) throw new UserError("Not allowed.", { code: "forbidden" });
  return omit(input, ["internal"]) as T;
}

/** `town`, `world` and `arcade` are singletons: `["main"]` and nothing else. */
export function requireMain(c: { key: string[] }): void {
  if (c.key.length !== 1 || c.key[0] !== "main") throw new UserError("Not allowed.", { code: "forbidden" });
}

/** The `main` actors, as another actor calls them. */
export const main = (client: Client<typeof registry>) => ({
  town: client.town.getOrCreate(["main"], internal),
  world: client.world.getOrCreate(["main"], internal),
  arcade: client.arcade.getOrCreate(["main"], internal),
});

/**
 * A line for one player's open game tabs (someone applied, you got in); nothing if they're offline.
 * Best effort: what caused it has already happened.
 */
export async function notify(client: Client<typeof registry>, userId: number, notice: Notice): Promise<void> {
  await main(client)
    .world.notify(userId, notice)
    .catch((err) => console.warn(`[notify] ${userId}: ${String(err)}`));
}

/** A line for every open game tab and the town chat. Best effort, like `notify`. */
export async function announceTown(
  client: Client<typeof registry>,
  text: string,
  open?: Notice["open"],
  remark?: string,
): Promise<void> {
  await main(client)
    .world.announceTown(text, open, remark)
    .catch((err) => console.warn(`[announceTown] ${String(err)}`));
}

/** One match, as another actor calls it. */
export const matchOf = (client: Client<typeof registry>, id: number) =>
  client.match.get([String(id)], internal);

/** One cache for every actor; `main.ts` refreshes it daily. */
export const pricing = new PricingCache();

export interface ConnParams {
  token?: string;
  internal?: string;
  /** The admin page's token: `ADMIN_TOKEN`. */
  admin?: string;
}

/**
 * How a player is signed in: the desktop app's device token, a linked computer's token (it only syncs),
 * or a browser session.
 */
export type Via = "device" | "linked" | "session";

/** Who is calling: a player, the admin page, another actor, or nobody yet. */
export type Caller =
  | { kind: "internal" }
  | { kind: "admin" }
  | { kind: "user"; userId: number; via: Via; deviceId?: number }
  | { kind: "anonymous" };

/** The client's IP, as `proxy.ts` saw it; null for another actor, which comes from inside. */
export const clientIpOf = (req: Request | undefined): string | null =>
  req?.headers.get(CLIENT_IP_HEADER) ?? null;

/** `ADMIN_TOKEN`, compared in constant time. Unset turns the admin page off. */
function isAdminToken(token: unknown): boolean {
  const want = process.env.ADMIN_TOKEN;
  if (!want || typeof token !== "string") return false;
  return timingSafeEqual(Buffer.from(sha256(token)), Buffer.from(sha256(want)));
}

/** Tokens are `<userId>.<secret>`; the player actor stores sha256(secret). */
export function splitToken(token: unknown): { userId: number; secret: string } | null {
  if (typeof token !== "string") return null;
  const m = /^(\d{1,12})\.([A-Za-z0-9_-]{16,128})$/.exec(token);
  return m ? { userId: Number(m[1]), secret: m[2]! } : null;
}

export const makeToken = (userId: number) => {
  const secret = randomToken();
  return { token: `${userId}.${secret}`, hash: sha256(secret) };
};

export const unauthorized = () => new UserError("Sign in from the menu bar app.", { code: "unauthorized" });

const TOKEN_CACHE_MS = 60_000;
const TOKEN_CACHE_MAX = 10_000;
/**
 * A token checked this recently still counts while its `player` is too busy (or restarting) to
 * answer in `VERIFY_WAIT_MS`: under RivetKit's 5s connection limit, so one slow player can't fail
 * every call its app makes. A revoked token or a deleted player is still refused at once.
 */
const TOKEN_STALE_MS = 10 * 60_000;
const VERIFY_WAIT_MS = 3_000;
export type TokenCache = Map<string, { caller: Caller; until: number }>;

/** One cache for every actor: `town`, `world`, `arcade` and each `match` see the same tokens. */
const TOKENS: TokenCache = new Map();
/** Checks under way, per cache: a burst of connections with one token asks its `player` once. */
const checking = new WeakMap<TokenCache, Map<string, Promise<Via | null>>>();

/** `ask`, unless the same token is being checked already: then that answer. */
function checkOnce(cache: TokenCache, token: string, ask: () => Promise<Via | null>): Promise<Via | null> {
  const pending = checking.get(cache) ?? new Map<string, Promise<Via | null>>();
  checking.set(cache, pending);
  const had = pending.get(token);
  if (had) return had;
  const check = ask();
  pending.set(token, check);
  const done = () => forget(cache, token, check);
  check.then(done, done);
  return check;
}

const forget = (cache: TokenCache, token: string, check: Promise<unknown>) => {
  if (checking.get(cache)?.get(token) === check) checking.get(cache)!.delete(token);
};

/**
 * Connection auth for actors other than `player`: internal callers by key, the admin page by
 * `ADMIN_TOKEN`, users by asking their `player` actor (cached for a minute), anonymous otherwise.
 */
export async function authenticate(
  params: ConnParams | undefined,
  client: Client<typeof registry>,
  cache: TokenCache = TOKENS,
): Promise<Caller> {
  if (params?.internal === INTERNAL_KEY) return { kind: "internal" };
  if (params?.admin !== undefined) {
    if (!isAdminToken(params.admin)) throw new UserError("Wrong admin token.", { code: "unauthorized" });
    return { kind: "admin" };
  }
  if (params?.token === undefined) return { kind: "anonymous" };
  const now = Date.now();
  const hit = cache.get(params.token);
  if (hit && hit.until > now) return hit.caller;
  const t = splitToken(params.token);
  const token = params.token;
  const verify = t
    ? checkOnce(cache, token, () =>
        client.player
          .get([String(t.userId)], internal)
          .verify(t.secret)
          .catch((err: unknown) => {
            // A deleted/nonexistent player really is signed out. Engine and network failures aren't.
            if (err instanceof RivetError && err.group === "actor" && err.code === "not_found") return null;
            throw err;
          }),
      )
    : Promise.resolve(null);
  const stale = hit && now - hit.until < TOKEN_STALE_MS && hit.caller.kind === "user" ? hit.caller : null;
  if (stale) {
    const busy = Symbol();
    const answer = await withTimeout(verify, VERIFY_WAIT_MS).catch(() => busy);
    if (answer === busy) {
      // The next call asks again rather than waiting on a player that may never answer this one.
      forget(cache, token, verify);
      return stale;
    }
  }
  const via = await verify;
  if (!t || !via) throw unauthorized();
  const caller: Caller = { kind: "user", userId: t.userId, via };
  if (cache.size > TOKEN_CACHE_MAX) cache.clear();
  cache.set(params.token, { caller, until: now + TOKEN_CACHE_MS });
  return caller;
}

/** A player in the app or a browser; a linked computer only syncs, so it's refused. */
export function requireUser(caller: Caller): number {
  if (caller.kind !== "user" || caller.via === "linked") throw unauthorized();
  return caller.userId;
}

/** A player or one of their linked computers: for what a computer that syncs needs to read. */
export function requireSyncer(caller: Caller): number {
  if (caller.kind !== "user") throw unauthorized();
  return caller.userId;
}

export function requireInternal(caller: Caller): void {
  if (caller.kind !== "internal") throw new UserError("Not allowed.", { code: "forbidden" });
}

export function requireAdmin(caller: Caller): void {
  if (caller.kind !== "admin") throw new UserError("Not allowed.", { code: "forbidden" });
}

/** Runs `fn` after every earlier call on the same chain: SQLite work that must not interleave. */
export function serial() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(fn: () => Promise<T>): Promise<T> => {
    const run = tail.then(fn, fn);
    tail = run.catch(() => {});
    return run;
  };
}

/** A timer that ends immediately on shutdown, before the next tick touches actor state. */
export async function waitForTick(signal: AbortSignal, ms: number): Promise<boolean> {
  try {
    await promiseTimeout(ms, { signal });
    return !signal.aborted;
  } catch (err) {
    if (signal.aborted) return false;
    throw err;
  }
}

/** The part of `c.db` the helpers need, so they can live outside an actor definition. */
export interface Sql {
  execute(sql: string, ...args: unknown[]): Promise<unknown[]>;
}

/** `Sql` that can also run several statements as one: `c.db`, or `memorySql` in tests. */
export interface TxSql extends Sql {
  transaction<T>(fn: (tx: Sql) => Promise<T>, opts?: { name: string }): Promise<T>;
}

export const all = <T>(sql: Sql, query: string, ...args: unknown[]): Promise<T[]> =>
  sql.execute(query, ...args) as Promise<T[]>;

export const one = async <T>(sql: Sql, query: string, ...args: unknown[]): Promise<T | undefined> =>
  (await all<T>(sql, query, ...args))[0];

/** The one number `query` selects, as `n`: a count or a sum, 0 for none. */
export const scalar = async (sql: Sql, query: string, ...args: unknown[]): Promise<number> =>
  (await one<{ n: number | null }>(sql, query, ...args))?.n ?? 0;
