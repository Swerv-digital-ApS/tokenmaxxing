/**
 * The real game's `ShopBackend`. Coins, the bag, the look and the company wallet are the server's, read from the HUD
 * store; a purchase makes the same calls the Shop page, the Decorate and Desk panels and the company shop make
 * (`town.buy`, `buyDecor`, `buyDesk`, `buyPiece`, `setLook`, `setDecor`, `setDesk`, `drop`, `placePiece`). The UI is
 * optimistic: coins and ownership move at once and are put back, with the server's own words, if it refuses.
 * Everything outside (the connection, the store, the renderer) comes in through `GameDeps`, so it runs in tests.
 */
import { offSeason } from "@tokenmaxxing/core/costumes.ts";
import { DECORS } from "@tokenmaxxing/core/decor.ts";
import { itemById, type MerchKind, merchPrice } from "@tokenmaxxing/core/shop.ts";
import type { Look } from "@tokenmaxxing/core/world.ts";
import type { BagRow, Me, MyCompany, Wallet } from "@tokenmaxxing/server/registry";
import type { ShopBackend } from "./backend.ts";
import type { ShopId, ShopItem } from "./catalog.ts";
import {
  done,
  type Equip,
  equipOf,
  fail,
  failOf,
  lookWith,
  type Outcome,
  type Purchase,
  purchaseOf,
  wornIn,
} from "./purchase.ts";
import type { ShopWorld } from "./world.ts";

/** The server calls the shops use (the `town` connection's, by the same names). */
export interface GameNet {
  buy(id: string): Promise<Wallet>;
  buyDecor(kind: string, id: string): Promise<Wallet>;
  setDecor(kind: string, id: string | null): Promise<void>;
  buyDesk(id: string): Promise<Wallet>;
  setDesk(id: string): Promise<void>;
  buyPiece(id: string): Promise<{ notice: string; company: MyCompany }>;
  placePiece(id: string): Promise<{ notice: string; company: MyCompany }>;
  setLook(look: Look): Promise<void>;
  drop(id: string): Promise<{ notice: string }>;
  decorOwned(): Promise<string[]>;
  deskOwned(): Promise<{ owned: string[]; using: string }>;
  bag(): Promise<BagRow[]>;
  refreshMe(): Promise<void>;
  refreshWallet(): Promise<void>;
}

/** The HUD store, as far as the shops read and write it. */
export interface GameStore {
  me(): Me | null;
  wallet(): Wallet | null;
  level(): number;
  /** The wallpaper and floor the Office has on now. */
  decorInUse(): { wall?: string; floor?: string };
  setWallet(w: Wallet): void;
  setMe(me: Me): void;
  subscribe(f: () => void): () => void;
}

export interface GameDeps {
  net: GameNet;
  store: GameStore;
  world: ShopWorld;
}

const PLAIN = { wall: DECORS.wall[0]!.id, floor: DECORS.floor[0]!.id };
const isFurniture = (id: string) => itemById(id)?.slot === "furniture";

export function createGameBackend({ net, store, world }: GameDeps): ShopBackend {
  let decorOwned = new Set<string>();
  let desks = { owned: new Set<string>(["laptop"]), using: "laptop" };
  let bag = new Map<string, number>();
  const listeners = new Set<() => void>();
  let unsub: (() => void) | null = null;
  const changed = () => {
    for (const f of listeners) f();
  };

  const owned = (): readonly string[] => store.wallet()?.owned ?? [];
  const look = (): Look => store.me()?.look as Look;
  const purchase = (id: string): Purchase => purchaseOf(id);
  const equip = (id: string): Equip => equipOf(id);

  const owns = (id: string): boolean => {
    const p = purchase(id);
    switch (p.kind) {
      case "free":
        return true;
      case "item":
      case "merch":
        return owned().includes(p.id);
      case "variant":
        return owned().includes(`pet.${p.pet}`);
      case "decor":
        return decorOwned.has(`${p.decor}.${p.id}`);
      case "desk":
        return desks.owned.has(p.id);
      case "piece":
        return false;
      default: {
        // Earned ones are the server's to say: rewards sit in the bag, a level's decor and desks in their lists.
        const m = /^(decor\.(?:wall|floor)\.|desk\.)(.+)$/.exec(id);
        if (m) return m[1] === "desk." ? desks.owned.has(m[2]!) : decorOwned.has(id.slice(6));
        return owned().includes(id);
      }
    }
  };

  const count = (id: string): number => {
    const p = purchase(id);
    if (p.kind === "piece") return store.me()?.company?.stored.find((s) => s.item === id)?.count ?? 0;
    if (isFurniture(id)) return bag.get(id) ?? 0;
    return owns(id) ? 1 : 0;
  };

  const stackable = (id: string): boolean => purchase(id).kind === "piece" || isFurniture(id);

  const inUse = (id: string): boolean => {
    const eq = equip(id);
    if (eq.kind === "decor") {
      const now = store.decorInUse()[eq.decor];
      return (now ?? PLAIN[eq.decor]) === eq.id;
    }
    if (eq.kind === "desk") return desks.using === eq.id;
    const l = store.me()?.look;
    return l ? wornIn(l, id) : false;
  };

  /** Writes `next` as my look: on the avatar and in the HUD at once, to the server; the old look comes back if refused. */
  async function commitLook(next: Look): Promise<Outcome> {
    const me = store.me();
    if (!me) return fail("offline", "Not signed in yet.");
    const before = me;
    store.setMe({ ...me, look: next });
    world.previewLook(next);
    try {
      await net.setLook(next);
      await net.refreshMe();
      return done();
    } catch (err) {
      store.setMe(before);
      world.previewLook(null);
      return failOf(err);
    }
  }

  async function applyDecorTo(kind: "wall" | "floor", id: string): Promise<Outcome> {
    const before = store.decorInUse();
    world.applyDecor({ [kind]: id });
    try {
      await net.setDecor(kind, id === PLAIN[kind] ? null : id);
      return done();
    } catch (err) {
      world.applyDecor({ [kind]: before[kind] ?? PLAIN[kind] });
      return failOf(err);
    }
  }

  async function applyDeskTo(id: string): Promise<Outcome> {
    const before = desks.using;
    desks = { ...desks, using: id };
    changed();
    try {
      await net.setDesk(id);
      return done();
    } catch (err) {
      desks = { ...desks, using: before };
      changed();
      return failOf(err);
    }
  }

  async function place(id: string): Promise<Outcome> {
    const eq = equip(id);
    if (eq.kind !== "place") return fail("unavailable", "That cannot be placed.");
    if (count(id) < 1) return fail("unowned", "You have none to put down: buy one first.");
    try {
      if (purchase(id).kind === "piece") {
        if (world.startPlacement(id, true)) return done("Pick a tile in your building");
        const r = await net.placePiece(id);
        store.setMe({ ...store.me()!, company: r.company });
        return done(r.notice);
      }
      if (world.startPlacement(id)) return done("Pick a tile in your Office");
      const r = await net.drop(id);
      await refresh();
      return done(r.notice);
    } catch (err) {
      return failOf(err);
    }
  }

  async function refresh(): Promise<void> {
    const got = await Promise.allSettled([
      net.decorOwned(),
      net.deskOwned(),
      net.bag(),
      net.refreshWallet(),
      net.refreshMe(),
    ]);
    const [d, k, b] = got;
    if (d.status === "fulfilled") decorOwned = new Set(d.value);
    if (k.status === "fulfilled") desks = { owned: new Set(k.value.owned), using: k.value.using };
    if (b.status === "fulfilled") bag = new Map(b.value.map((r) => [r.item, r.count]));
    changed();
  }

  async function buy(_shop: ShopId, item: ShopItem, listed: number): Promise<Outcome> {
    const p = purchase(item.id);
    const me = store.me();
    const w = store.wallet();
    if (!me || !w) return fail("offline", "Not signed in yet.");
    switch (p.kind) {
      case "unsold":
        return fail(
          "level",
          p.why === "level"
            ? "That one is earned at a level, not bought."
            : p.why === "case"
              ? "That one only comes out of a case."
              : p.why === "loot"
                ? "That one drops in the raid."
                : p.why === "edition"
                  ? "Only the traveling merchant sells that."
                  : p.why === "season"
                    ? offSeason(itemById(item.id)!.holiday!)
                    : "That one is earned, not bought.",
        );
      case "unknown":
        return fail("unavailable", "That one is not in this town's shop.");
      case "free":
      case "variant":
        return fail("owned", "That one comes free.");
      default:
    }
    if (!stackable(item.id) && owns(item.id)) return fail("owned", "You have that already.");

    const employee = p.kind === "merch" && me.company?.id === p.companyId;
    const price = p.kind === "merch" ? merchPrice(item.id.split(".")[2] as MerchKind, employee) : listed;
    const company = me.company;
    if (p.kind === "piece") {
      if (!company)
        return fail("company", "Join a company first: its furniture is paid from the company wallet.");
      if (company.wallet < price) return fail("coins", "The company wallet can't cover that yet.");
    } else if (w.balance < price) {
      return fail("coins", `Not enough coins yet: you need 🪙 ${price - w.balance} more.`);
    }

    // Optimistic: spend now, put it back if the server says no.
    const was = { wallet: w, me };
    if (p.kind === "piece") store.setMe({ ...me, company: { ...company!, wallet: company!.wallet - price } });
    else
      store.setWallet({
        ...w,
        balance: w.balance - price,
        owned: stackable(item.id)
          ? w.owned
          : [...w.owned, p.kind === "item" || p.kind === "merch" ? p.id : item.id],
      });
    try {
      switch (p.kind) {
        case "item":
        case "merch":
          store.setWallet(await net.buy(p.id));
          break;
        case "decor":
          store.setWallet(await net.buyDecor(p.decor, p.id));
          decorOwned.add(`${p.decor}.${p.id}`);
          break;
        case "desk":
          store.setWallet(await net.buyDesk(p.id));
          desks.owned.add(p.id);
          break;
        case "piece": {
          const r = await net.buyPiece(p.id);
          store.setMe({ ...store.me()!, company: r.company });
          changed();
          return done(r.notice);
        }
        default:
      }
    } catch (err) {
      store.setWallet(was.wallet);
      store.setMe(was.me);
      return failOf(err);
    }
    // What was bought goes on, as on the Shop page: the first one worn, a piece of furniture waits to be placed.
    const eq = equip(item.id);
    let used: Outcome = done();
    if (eq.kind === "decor") used = await applyDecorTo(eq.decor, eq.id);
    else if (eq.kind === "desk") used = await applyDeskTo(eq.id);
    else if (eq.kind === "wear" || eq.kind === "pet" || eq.kind === "petwear")
      used = await commitLook(lookWith(look(), eq));
    else if (isFurniture(item.id)) bag.set(item.id, (bag.get(item.id) ?? 0) + 1);
    changed();
    return used.ok
      ? done(`Bought ${item.name} for 🪙 ${price}`)
      : done(`Bought ${item.name}, but ${used.message}`);
  }

  async function equipItem(_shop: ShopId, item: ShopItem, on = true): Promise<Outcome> {
    const eq = equip(item.id);
    const p = purchase(item.id);
    if (!owns(item.id) && eq.kind !== "none" && p.kind !== "piece")
      return fail("unowned", p.kind === "unsold" ? "You haven't earned that yet." : "Buy that first.");
    switch (eq.kind) {
      case "decor":
        return applyDecorTo(eq.decor, eq.id);
      case "desk":
        return applyDeskTo(eq.id);
      case "place":
        return place(item.id);
      case "none":
        return fail("unavailable", "That one is not in this town's shop.");
      default: {
        if (!store.me()) return fail("offline", "Not signed in yet.");
        return commitLook(lookWith(look(), eq, on));
      }
    }
  }

  return {
    coins: () => store.wallet()?.balance ?? 0,
    companyCoins: () => store.me()?.company?.wallet ?? null,
    level: () => store.level(),
    look: () => look(),
    owns,
    count,
    stackable,
    inUse,
    buy,
    preview(_shop, item) {
      const eq = equip(item.id);
      return eq.kind === "wear" || eq.kind === "restyle" || eq.kind === "pet" || eq.kind === "petwear"
        ? lookWith(look(), eq)
        : null;
    },
    equip: equipItem,
    refresh,
    onChange(f) {
      listeners.add(f);
      unsub ??= store.subscribe(changed);
      return () => {
        listeners.delete(f);
        if (listeners.size === 0) {
          unsub?.();
          unsub = null;
        }
      };
    },
  };
}
