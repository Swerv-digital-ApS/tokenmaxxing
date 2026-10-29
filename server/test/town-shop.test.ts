import { describe, expect, test } from "bun:test";
import { ALL_CASE_PIECES } from "@tokenmaxxing/core/case-furniture.ts";
import { levelUpCoins } from "@tokenmaxxing/core/economy.ts";
import { petLooks } from "@tokenmaxxing/core/pets.ts";
import { coinsForTokens } from "@tokenmaxxing/core/shop.ts";
import type { Notice } from "@tokenmaxxing/core/world.ts";
import { unwear } from "../src/town/coins.ts";
import { migrate } from "../src/town/schema.ts";
import { memorySql } from "./memory-sql.ts";
import { admin, as, event, eventually, MIN, questCoins, rich, signUp } from "./rivet.ts";

describe("coins and the shop", () => {
  test("usage earns coins on a curve per day, not per token", async () => {
    const a = await signUp("coin");
    // What usage alone has paid: the day's quests come on top, and which ones depend on the date.
    const earned = async () => {
      const w = await a.town.wallet();
      return w.balance - questCoins(w);
    };
    // 100M today pays 2.5 × 100^0.6 = 39. 400M more the same day makes it 500M's 104, not 39 + 4 × 39. (A minute counts
    // for at most 200M, so the 400M comes over the next two.)
    const now = Date.now();
    await as(a.token)
      .player(a.userId)
      .ingest([event({ inputTokens: 100e6, timestamp: now })]);
    // The level it reaches (5 at 100M tokens) pays too.
    expect(await earned()).toBe(coinsForTokens(100e6) + levelUpCoins(5));
    await as(a.token)
      .player(a.userId)
      .ingest([
        event({ inputTokens: 200e6, timestamp: now + 60_000 }),
        event({ inputTokens: 200e6, timestamp: now + 120_000 }),
      ]);
    expect(await earned()).toBe(coinsForTokens(500e6) + levelUpCoins(6));
    // Logs from before signing up (a first sync's backfill) pay nothing.
    await as(a.token)
      .player(a.userId)
      .ingest([event({ inputTokens: 150e6, timestamp: Date.UTC(2023, 5, 14, 12) })]);
    expect(await earned()).toBe(coinsForTokens(500e6) + levelUpCoins(6));
  });

  test("buy, then wear; not before, not when short; a second one is another in the bag", async () => {
    const a = await signUp("shop");
    await expect(a.town.buy("glasses.1")).rejects.toThrow("coins");
    await expect(a.town.setLook({ ...(await a.town.me()).look, glasses: 1 })).rejects.toThrow("bag");
    await admin().adminSetCoins(a.userId, 130);
    const after = await a.town.buy("glasses.1");
    expect(after.balance).toBe(70);
    expect(after.owned).toEqual(["glasses.1"]);
    expect((await a.town.buy("glasses.1")).balance).toBe(10);
    expect(await a.town.bag()).toEqual([{ item: "glasses.1", count: 2 }]);
    await expect(a.town.buy("glasses.1")).rejects.toThrow("coins");
    await expect(a.town.buy("nope")).rejects.toThrow();
    await a.town.setLook({ ...(await a.town.me()).look, glasses: 1 });
    expect((await a.town.me()).look.glasses).toBe(1);
  });

  test("pet looks: any of a held pet's, none for a pet you don't hold, gone when the pet is", async () => {
    const a = await signUp("petlook");
    await admin().adminSetCoins(a.userId, 2000);
    const look = (await a.town.me()).look;
    await expect(a.town.setLook({ ...look, pet: 3, petVariant: 2 })).rejects.toMatchObject({
      code: "not_owned",
    });
    await a.town.buy("pet.3");
    await a.town.setLook({ ...look, pet: 3, petVariant: 2 });
    expect((await a.town.me()).look).toMatchObject({ pet: 3, petVariant: 2 });
    // Out of range for the pet, or for any pet; a variant without a pet.
    await expect(a.town.setLook({ ...look, pet: 3, petVariant: petLooks(3) })).rejects.toMatchObject({
      code: "invalid_look",
    });
    await expect(a.town.setLook({ ...look, pet: 3, petVariant: -1 })).rejects.toMatchObject({
      code: "invalid_look",
    });
    await expect(a.town.setLook({ ...look, pet: 0, petVariant: 1 })).rejects.toMatchObject({
      code: "invalid_look",
    });
    // Another pet's variant is not the dog's (the duck has fewer).
    await a.town.buy("pet.1");
    await expect(a.town.setLook({ ...look, pet: 1, petVariant: petLooks(3) - 1 })).rejects.toMatchObject({
      code: "invalid_look",
    });
    await a.town.setLook({ ...look, pet: 1, petVariant: 1 });
    expect((await a.town.me()).look).toMatchObject({ pet: 1, petVariant: 1 });
    // Taking the pet off resets the variant.
    await a.town.setLook({ ...look, pet: 0, petVariant: 0 });
    expect((await a.town.me()).look).toMatchObject({ pet: 0, petVariant: 0 });
  });

  test("losing the worn pet takes its look with it", async () => {
    const { sql } = memorySql();
    await migrate(sql);
    const look = JSON.stringify({
      style: 0,
      skin: 0,
      hair: 0,
      outfit: 0,
      glasses: 0,
      hat: 0,
      pet: 3,
      petVariant: 5,
    });
    await sql.execute("INSERT INTO users (id, name, look, created_at) VALUES (7, 'u7', ?, 0)", look);
    await sql.execute("INSERT INTO items (owner_id, item, at) VALUES (7, 'pet.3', 0)");
    await sql.execute("DELETE FROM items WHERE owner_id = 7");
    expect(await unwear(sql, 7, ["pet.3"])).toBe(true);
    const [row] = await sql.execute("SELECT look FROM users WHERE id = 7");
    expect(JSON.parse((row as { look: string }).look)).toMatchObject({ pet: 0, petVariant: 0 });
  });

  test("level items: granted at level 10, worn, never sold", async () => {
    const a = await signUp("top");
    // 10B lifetime: 50 minutes at the 200M a minute that counts.
    const start = Date.now() - 2 * 60 * MIN;
    await as(a.token)
      .player(a.userId)
      .ingest(
        Array.from({ length: 50 }, (_, i) =>
          event({ inputTokens: 200e6, outputTokens: 0, timestamp: start + i * MIN }),
        ),
      );
    expect((await a.town.profile(a.userId, "all")).level).toBe(10);
    expect(await a.town.bag()).toContainEqual({ item: "hat.4", count: 1 });
    await a.town.setLook({ ...(await a.town.me()).look, hat: 4 });
    expect((await a.town.me()).look.hat).toBe(4);
    await expect(a.town.buy("hat.4")).rejects.toMatchObject({ code: "not_for_sale" });
    // Touched grass is earned at an outage picnic, not bought.
    await expect(a.town.buy("furn.g")).rejects.toMatchObject({ code: "not_for_sale" });
    await expect(a.town.drop("hat.4")).rejects.toMatchObject({ code: "not_tradeable" });

    const b = await signUp("top");
    await expect(b.town.setLook({ ...(await b.town.me()).look, hat: 4 })).rejects.toMatchObject({
      code: "not_owned",
    });
  });
});

describe("case furniture", () => {
  test("a case piece (any case's) is never for sale, even to someone with the coins", async () => {
    const a = await rich("nightfurn", 5000);
    for (const p of ALL_CASE_PIECES)
      await expect(a.town.buy(`furn.${p.ch}`)).rejects.toMatchObject({ code: "not_for_sale" });
    expect(await a.town.bag()).toEqual([]);
    expect((await a.town.wallet()).balance).toBe(5000);
  });
});

describe("drops", () => {
  test("a worn hat dropped comes off; only what you hold; five on the floor at a time", async () => {
    const a = await rich("drop", 200);
    await a.town.createCompany("Butterfingers"); // its floor is cleared when the test ends
    await a.town.buy("hat.1");
    for (let i = 0; i < 5; i++) await a.town.buy("furn.=");
    await a.town.setLook({ ...(await a.town.me()).look, hat: 1 });
    expect(await a.town.drop("hat.1")).toMatchObject({
      notice: "Dropped the Beanie.",
      drop: { item: "hat.1", by: a.userId },
    });
    expect((await a.town.me()).look.hat).toBe(0);
    await expect(a.town.drop("hat.1")).rejects.toMatchObject({ code: "not_owned" });
    for (let i = 0; i < 4; i++) await a.town.drop("furn.=");
    await expect(a.town.drop("furn.=")).rejects.toMatchObject({ code: "too_many" });
    expect(await a.town.bag()).toEqual([{ item: "furn.=", count: 1 }]);
    expect((await a.town.wallet()).items).toBe(1);
  });
});

describe("trades", () => {
  const coins = (n: number) => ({ coins: n, items: [] });

  /** The `notice` events for `token`'s tab, which has walked in. */
  async function notices(token: string) {
    const conn = as(token).world.connect();
    const got: Notice[] = [];
    conn.on("notice", (n: Notice) => got.push(n));
    await conn.join();
    return { conn, got };
  }

  test("not to yourself, not nothing, only sold items; they get a toast that opens their trades", async () => {
    const ada = await rich("ada");
    const bo = await rich("bo");
    await expect(ada.town.offerTrade(ada.userId, coins(10), coins(0))).rejects.toThrow();
    await expect(ada.town.offerTrade(bo.userId, coins(0), coins(0))).rejects.toMatchObject({
      code: "invalid_trade",
    });
    // A level reward never changes hands.
    await expect(
      ada.town.offerTrade(bo.userId, { coins: 0, items: ["hat.4"] }, coins(0)),
    ).rejects.toMatchObject({ code: "invalid_trade", message: "Level rewards stay with you." });
    const { conn, got } = await notices(bo.token);
    await ada.town.offerTrade(bo.userId, coins(10), coins(0));
    await eventually(() =>
      expect(got).toContainEqual({ text: `${ada.name} offers you a trade.`, open: "trades" }),
    );
    await conn.dispose();
  });

  test("accepting moves a worn hat off the giver's head, and coins the other way", async () => {
    const ada = await rich("ada", 1000);
    const bo = await rich("bo", 1000);
    await ada.town.buy("hat.1");
    await ada.town.setLook({ ...(await ada.town.me()).look, hat: 1 });
    expect(await bo.town.tradeables(ada.userId)).toEqual({ name: ada.name, owned: ["hat.1"] });
    await ada.town.offerTrade(bo.userId, { coins: 0, items: ["hat.1"] }, coins(50));
    const offer = (await bo.town.trades()).incoming[0]!;
    expect(offer).toMatchObject({ from: ada.name, to: bo.name, want: coins(50) });
    // Both see the trades icon until it settles.
    expect((await ada.town.wallet()).trading && (await bo.town.wallet()).trading).toBe(true);
    const after = await bo.town.acceptTrade(ada.userId, offer.at);
    expect(after).toMatchObject({ balance: 950, owned: ["hat.1"], trading: false });
    expect((await ada.town.me()).look.hat).toBe(0);
    expect(await ada.town.wallet()).toMatchObject({ balance: 900 + 50, owned: [], trading: false });
    await bo.town.setLook({ ...(await bo.town.me()).look, hat: 1 });
    expect(await bo.town.trades()).toEqual({ incoming: [], outgoing: null });
    // A settled trade isn't a game in progress: ada can still be deleted, and her open offer goes too.
    await ada.town.offerTrade(bo.userId, coins(1), coins(0));
    await admin().adminDeleteUser(ada.userId);
    expect(await bo.town.trades()).toEqual({ incoming: [], outgoing: null });
  });

  test("a new offer replaces the old one, and the old one can't be accepted", async () => {
    const ada = await rich("ada");
    const bo = await rich("bo");
    const cy = await rich("cy");
    await ada.town.offerTrade(bo.userId, coins(50), coins(0));
    const first = (await bo.town.trades()).incoming[0]!;
    await Bun.sleep(5);
    await ada.town.offerTrade(bo.userId, coins(1), coins(0));
    await expect(bo.town.acceptTrade(ada.userId, first.at)).rejects.toThrow("changed");
    expect((await bo.town.trades()).incoming.map((t) => t.give)).toEqual([coins(1)]);
    await ada.town.offerTrade(cy.userId, coins(2), coins(0));
    expect((await bo.town.trades()).incoming).toEqual([]);
    expect((await ada.town.trades()).outgoing).toMatchObject({ toId: cy.userId, give: coins(2) });
    await ada.town.withdrawTrade();
    expect((await cy.town.trades()).incoming).toEqual([]);
  });

  test("ten offers an hour", async () => {
    const ada = await rich("ada");
    const bo = await signUp("bo");
    for (let i = 0; i < 10; i++) await ada.town.offerTrade(bo.userId, coins(1), coins(0));
    await expect(ada.town.offerTrade(bo.userId, coins(1), coins(0))).rejects.toMatchObject({
      code: "rate_limited",
    });
  });

  test("declining tells the sender", async () => {
    const ada = await rich("ada");
    const bo = await rich("bo");
    const { conn, got } = await notices(ada.token);
    await ada.town.offerTrade(bo.userId, coins(5), coins(0));
    await bo.town.declineTrade(ada.userId);
    await eventually(() => expect(got).toContainEqual({ text: `${bo.name} passed on your trade.` }));
    expect((await ada.town.trades()).outgoing).toBeNull();
    await conn.dispose();
  });
});
