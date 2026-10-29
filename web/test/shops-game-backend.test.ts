import { expect, test } from "bun:test";
import type { Look } from "@tokenmaxxing/core/world.ts";
import type { Me, Wallet } from "@tokenmaxxing/server/registry";
import type { ShopItem } from "../src/render3d/shops/catalog.ts";
import { createGameBackend, type GameNet } from "../src/render3d/shops/gameBackend.ts";

const LOOK: Look = {
  style: 0,
  skin: 0,
  hair: 0,
  outfit: 0,
  glasses: 0,
  hat: 0,
  pet: 0,
  held: 0,
  back: 0,
  petwear: 0,
  petVariant: 0,
  merch: 0,
  merchWorn: 0,
};
const wallet = (balance: number, owned: string[] = []): Wallet => ({
  balance,
  today: 0,
  streak: 1,
  launches: [],
  raids: 0,
  green: 0,
  wins: [],
  owned,
  items: owned.length,
  quests: [],
  trading: false,
});
const item = (id: string, price = 100): ShopItem => ({ id, name: id, price, preview: () => null as never });
const err = (code: string, message: string) => Object.assign(new Error(message), { code });

function setup(
  opts: { balance?: number; owned?: string[]; company?: { wallet: number } | null; level?: number } = {},
) {
  let w = wallet(opts.balance ?? 500, opts.owned);
  // What the server holds; the store's copy moves ahead of it while a call is out.
  let server = w;
  let me = {
    userId: 1,
    name: "me",
    look: LOOK,
    company: opts.company === undefined ? null : { id: 7, wallet: opts.company?.wallet ?? 0, stored: [] },
    application: null,
  } as unknown as Me;
  const calls: string[] = [];
  const preview: (Look | null)[] = [];
  const decor: unknown[] = [];
  let reject: Error | null = null;
  const take = () => {
    if (reject) throw reject;
  };
  const net: GameNet = {
    buy: async (id) => {
      calls.push(`buy ${id}`);
      take();
      server = wallet(server.balance - 100, [...server.owned, id]);
      return server;
    },
    buyDecor: async (k, id) => {
      calls.push(`buyDecor ${k} ${id}`);
      take();
      server = wallet(server.balance - 60, server.owned);
      return server;
    },
    setDecor: async (k, id) => void calls.push(`setDecor ${k} ${id}`),
    buyDesk: async (id) => {
      calls.push(`buyDesk ${id}`);
      take();
      server = wallet(server.balance - 120, server.owned);
      return server;
    },
    setDesk: async (id) => void calls.push(`setDesk ${id}`),
    buyPiece: async (id) => {
      calls.push(`buyPiece ${id}`);
      take();
      const company = { ...(me.company as object), wallet: 0 } as never;
      return { notice: "Bought it.", company };
    },
    placePiece: async (id) => void calls.push(`placePiece ${id}`) as never,
    setLook: async (l) => {
      calls.push(`setLook ${JSON.stringify([l.outfit, l.pet, l.petVariant, l.petwear])}`);
      take();
    },
    drop: async (id) => {
      calls.push(`drop ${id}`);
      return { notice: "Dropped." };
    },
    decorOwned: async () => ["wall.plain", "floor.boards"],
    deskOwned: async () => ({ owned: ["laptop"], using: "laptop" }),
    bag: async () => [],
    refreshMe: async () => {},
    refreshWallet: async () => {},
  };
  const b = createGameBackend({
    net,
    world: {
      previewLook: (l) => void preview.push(l as Look | null),
      renderStyle: () => ({ style: "voxel", pixelSize: 1, night: false }),
      startPlacement: () => false,
      applyDecor: (d) => void decor.push(d),
    },
    store: {
      me: () => me,
      wallet: () => w,
      level: () => opts.level ?? 5,
      decorInUse: () => ({}),
      setWallet: (x) => {
        w = x;
      },
      setMe: (x) => {
        me = x;
      },
      subscribe: () => () => {},
    },
  });
  return {
    b,
    calls,
    preview,
    decor,
    wallet: () => w,
    me: () => me,
    reject: (e: Error | null) => {
      reject = e;
    },
  };
}

test("buying spends coins, owns it and puts it on", async () => {
  const t = setup();
  const r = await t.b.buy("clothes", item("outfit.9", 100), 100);
  expect(r.ok).toBe(true);
  expect(t.calls).toEqual(["buy outfit.9", "setLook [9,0,0,0]"]);
  expect(t.wallet().balance).toBe(400);
  expect(t.b.owns("outfit.9")).toBe(true);
  expect(t.me().look.outfit).toBe(9);
});

test("a refusal puts the coins back and says why", async () => {
  const t = setup();
  t.reject(err("too_poor", "Rejected: Not enough coins yet."));
  const r = await t.b.buy("clothes", item("outfit.9"), 100);
  expect(r).toEqual({ ok: false, reason: "coins", message: "Not enough coins yet." });
  expect(t.wallet().balance).toBe(500);
  expect(t.b.owns("outfit.9")).toBe(false);
});

test("short of coins, owned, locked and companyless never reach the server", async () => {
  const poor = setup({ balance: 50 });
  expect(await poor.b.buy("clothes", item("outfit.9"), 100)).toMatchObject({ ok: false, reason: "coins" });
  const has = setup({ owned: ["outfit.9"] });
  expect(await has.b.buy("clothes", item("outfit.9"), 100)).toMatchObject({ ok: false, reason: "owned" });
  expect(await has.b.buy("clothes", item("outfit.12", 0), 0)).toMatchObject({ ok: false, reason: "level" });
  expect(await has.b.buy("pets", item("pet.2.black", 0), 0)).toMatchObject({ ok: false, reason: "owned" });
  const solo = setup();
  expect(await solo.b.buy("furniture", item("furn.ε", 35), 35)).toMatchObject({
    ok: false,
    reason: "company",
  });
  const broke = setup({ company: { wallet: 10 } });
  expect(await broke.b.buy("furniture", item("furn.ε", 35), 35)).toMatchObject({
    ok: false,
    reason: "coins",
  });
  for (const t of [poor, has, solo, broke]) expect(t.calls).toEqual([]);
});

test("company furniture is paid from the company wallet", async () => {
  const t = setup({ company: { wallet: 100 } });
  const r = await t.b.buy("furniture", item("furn.ε", 35), 35);
  expect(r).toEqual({ ok: true, message: "Bought it." });
  expect(t.calls).toEqual(["buyPiece furn.ε"]);
  expect(t.wallet().balance).toBe(500);
  expect(t.b.companyCoins()).toBe(0);
});

test("a pet's variations are free to the holder and set through the look", async () => {
  const t = setup({ owned: ["pet.2"] });
  expect(t.b.owns("pet.2.tuxedo")).toBe(true);
  expect(t.b.owns("pet.3.husky")).toBe(false);
  const r = await t.b.equip("pets", item("pet.2.tuxedo", 0));
  expect(r.ok).toBe(true);
  expect(t.calls).toEqual(["setLook [0,2,2,0]"]);
  expect(t.b.inUse("pet.2.tuxedo")).toBe(true);
  expect(await t.b.equip("pets", item("pet.3.husky", 0))).toMatchObject({ ok: false, reason: "unowned" });
});

test("a look the server refuses rolls back on the avatar and in the store", async () => {
  const t = setup({ owned: ["outfit.9"] });
  t.reject(err("not_owned", "You don't have one in your bag."));
  const r = await t.b.equip("clothes", item("outfit.9"));
  expect(r).toMatchObject({ ok: false, reason: "unowned" });
  expect(t.me().look.outfit).toBe(0);
  expect(t.preview.at(-1)).toBeNull();
});

test("decor and desks are bought, then used", async () => {
  const t = setup({ level: 12 });
  await t.b.refresh();
  expect(t.b.owns("decor.wall.plain")).toBe(true);
  expect(t.b.owns("decor.wall.hygge")).toBe(false);
  expect((await t.b.buy("furniture", item("decor.wall.hygge", 40), 40)).ok).toBe(true);
  expect(t.calls).toEqual(["buyDecor wall hygge", "setDecor wall hygge"]);
  expect(t.decor).toEqual([{ wall: "hygge" }]);
  expect((await t.b.buy("furniture", item("desk.triple", 120), 120)).ok).toBe(true);
  expect(t.calls.slice(2)).toEqual(["buyDesk triple", "setDesk triple"]);
  expect(t.b.inUse("desk.triple")).toBe(true);
  await t.b.equip("furniture", item("decor.wall.plain", 0));
  expect(t.calls.at(-1)).toBe("setDecor wall null");
});

test("furniture waits to be placed, and falls back to a drop without a placement mode", async () => {
  const t = setup();
  expect(await t.b.equip("furniture", item("furn.p", 20))).toMatchObject({ ok: false });
  await t.b.buy("furniture", item("furn.p", 20), 20);
  expect(t.b.count("furn.p")).toBe(1);
  expect(t.b.stackable("furn.p")).toBe(true);
  const r = await t.b.equip("furniture", item("furn.p", 20));
  expect(r).toEqual({ ok: true, message: "Dropped." });
});
