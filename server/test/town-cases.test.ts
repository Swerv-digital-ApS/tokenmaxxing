import { describe, expect, test } from "bun:test";
import { caseById, VENDOR_COINS } from "@tokenmaxxing/core/cases.ts";
import { rarityOf } from "@tokenmaxxing/core/rarity.ts";
import { UserError } from "rivetkit";
import { openCase, sellDuplicates, sellItem } from "../src/town/cases.ts";
import { bag } from "../src/town/coins.ts";
import { migrate } from "../src/town/schema.ts";
import { memorySql } from "./memory-sql.ts";

const night = caseById("night-market")!;
const nus = caseById("nusantara")!;
const eve = caseById("ragnarok-eve")!;
const now = Date.now();

/** A small seeded generator, so a run of openings is repeatable. */
const seededRand = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

async function setup(coins: number) {
  const { sql } = memorySql();
  await migrate(sql);
  const look = JSON.stringify({
    style: 0,
    skin: 0,
    hair: 0,
    outfit: 0,
    glasses: 0,
    hat: 0,
    pet: 0,
    petVariant: 0,
  });
  await sql.execute("INSERT INTO users (id, name, look, created_at) VALUES (7, 'u7', ?, ?)", look, now);
  await sql.execute(
    "INSERT INTO ledger (user_id, amount, kind, ref, at) VALUES (7, ?, 'admin', 'admin', 0)",
    coins,
  );
  return sql;
}
const balance = async (sql: Awaited<ReturnType<typeof setup>>) =>
  (await (await import("../src/town/coins.ts")).wallet(sql, 7, now)).balance;
const give = (sql: Awaited<ReturnType<typeof setup>>, item: string, n = 1) =>
  Promise.all(
    Array.from({ length: n }, () =>
      sql.execute("INSERT INTO items (owner_id, item, at) VALUES (7, ?, 0)", item),
    ),
  );
const rejects = async (p: Promise<unknown>, code: string) => {
  const e = await p.then(
    () => null,
    (err) => err,
  );
  expect(e).toBeInstanceOf(UserError);
  expect((e as UserError).code).toBe(code);
};

describe("openCase", () => {
  test("charges the key and grants one case item", async () => {
    const sql = await setup(200);
    const before = await balance(sql);
    const out = await openCase(sql, 7, "night-market", now);
    expect(night.items.some((i) => i.id === out.item.id)).toBe(true);
    expect(before - out.wallet.balance).toBe(night.keyPrice);
    expect(await bag(sql, 7)).toEqual([{ item: out.item.id, count: 1 }]);
  });

  test("too few coins or an unknown case: refused, nothing charged or granted", async () => {
    const sql = await setup(night.keyPrice - 1);
    const before = await balance(sql);
    await rejects(openCase(sql, 7, "night-market", now), "too_poor");
    await rejects(openCase(sql, 7, "nope", now), "not_found");
    await rejects(openCase(sql, 7, { x: 1 }, now), "not_found");
    expect(await balance(sql)).toBe(before);
    expect(await bag(sql, 7)).toEqual([]);
  });

  test("the dry counter makes the tenth opening a rare or better", async () => {
    const sql = await setup(5000);
    const rand = () => 0; // always the commonest roll
    for (let i = 0; i < 9; i++)
      expect(rarityOf((await openCase(sql, 7, "night-market", now, undefined, rand)).item)).toBe("common");
    const tenth = await openCase(sql, 7, "night-market", now, undefined, rand);
    expect(["rare", "epic", "legendary"]).toContain(rarityOf(tenth.item));
    // And it starts over.
    expect(rarityOf((await openCase(sql, 7, "night-market", now, undefined, rand)).item)).toBe("common");
  });
});

describe("selling", () => {
  test("pays by rarity and removes exactly one row", async () => {
    const sql = await setup(0);
    for (const rarity of ["common", "uncommon", "rare", "epic"] as const) {
      const item = night.items.find((i) => rarityOf(i) === rarity)!;
      await give(sql, item.id, 2);
      const before = await balance(sql);
      const { wallet } = await sellItem(sql, 7, item.id, now);
      expect(wallet.balance - before).toBe(VENDOR_COINS[rarity]);
      expect((await bag(sql, 7)).find((r) => r.item === item.id)?.count).toBe(1);
    }
  });

  test("refuses non-case items and items you do not hold", async () => {
    const sql = await setup(0);
    await give(sql, "glasses.1");
    await rejects(sellItem(sql, 7, "glasses.1", now), "not_sellable");
    await rejects(sellItem(sql, 7, "nope", now), "not_sellable");
    await rejects(sellItem(sql, 7, night.items[0]!.id, now), "not_owned");
    expect(await balance(sql)).toBe(0);
    expect(await bag(sql, 7)).toEqual([{ item: "glasses.1", count: 1 }]);
  });

  test("selling the last worn copy takes it off the look", async () => {
    const sql = await setup(0);
    const hat = night.items.find((i) => i.slot === "hat")!;
    await give(sql, hat.id);
    await sql.execute(
      "UPDATE users SET look = ? WHERE id = 7",
      JSON.stringify({
        style: 0,
        skin: 0,
        hair: 0,
        outfit: 0,
        glasses: 0,
        hat: hat.index,
        pet: 0,
        petVariant: 0,
      }),
    );
    expect((await sellItem(sql, 7, hat.id, now)).unworn).toBe(true);
    const [row] = await sql.execute("SELECT look FROM users WHERE id = 7");
    expect(JSON.parse((row as { look: string }).look).hat).toBe(0);
  });

  test("sellDuplicates keeps one of each and pays for the rest", async () => {
    const sql = await setup(0);
    const [a, b, c] = night.items;
    await give(sql, a!.id, 3);
    await give(sql, b!.id, 1);
    await give(sql, c!.id, 2);
    await give(sql, "glasses.1", 4);
    const owed = 2 * VENDOR_COINS[rarityOf(a!)] + VENDOR_COINS[rarityOf(c!)];
    const out = await sellDuplicates(sql, 7, "night-market", now);
    expect(out.sold).toBe(3);
    expect(out.wallet.balance).toBe(owed);
    const held = Object.fromEntries((await bag(sql, 7)).map((r) => [r.item, r.count]));
    expect(held).toEqual({ [a!.id]: 1, [b!.id]: 1, [c!.id]: 1, "glasses.1": 4 });
    await rejects(sellDuplicates(sql, 7, "nope", now), "not_found");
  });
});

describe("a second case", () => {
  test("opening the Nusantara case charges its key and grants one of its own items, never a Night Market one", async () => {
    const sql = await setup(5000);
    const nightIds = new Set(night.items.map((i) => i.id));
    for (let i = 0; i < 12; i++) {
      const before = await balance(sql);
      const out = await openCase(sql, 7, "nusantara", now, undefined, seededRand(i + 1));
      expect(nus.items.some((it) => it.id === out.item.id)).toBe(true);
      expect(nightIds.has(out.item.id)).toBe(false);
      expect(before - out.wallet.balance).toBe(nus.keyPrice);
    }
    expect((await bag(sql, 7)).reduce((n, r) => n + r.count, 0)).toBe(12);
  });

  test("each case keeps its own dry counter", async () => {
    const sql = await setup(5000);
    const low = () => 0; // always the commonest roll
    // Nine dry Nusantara openings, then a Night Market one: it is still on its own first, so common.
    for (let i = 0; i < 9; i++)
      expect(rarityOf((await openCase(sql, 7, "nusantara", now, undefined, low)).item)).toBe("common");
    expect(rarityOf((await openCase(sql, 7, "night-market", now, undefined, low)).item)).toBe("common");
    // The Nusantara's tenth is the guaranteed hit.
    expect(["rare", "epic", "legendary"]).toContain(
      rarityOf((await openCase(sql, 7, "nusantara", now, undefined, low)).item),
    );
    const rows = (await sql.execute(
      "SELECT case_id, dry FROM case_dry WHERE user_id = 7 ORDER BY case_id",
    )) as {
      case_id: string;
      dry: number;
    }[];
    expect(rows).toEqual([
      { case_id: "night-market", dry: 1 },
      { case_id: "nusantara", dry: 0 },
    ]);
  });

  test("too few coins for the Nusantara key refuses it, nothing charged", async () => {
    const sql = await setup(nus.keyPrice - 1);
    await rejects(openCase(sql, 7, "nusantara", now), "too_poor");
    expect(await balance(sql)).toBe(nus.keyPrice - 1);
    expect(await bag(sql, 7)).toEqual([]);
  });

  test("the vendor buys a Nusantara item by its rarity, furniture included, and takes a worn one off", async () => {
    const sql = await setup(0);
    for (const rarity of ["common", "uncommon", "rare", "epic", "legendary"] as const) {
      const item = nus.items.find((i) => rarityOf(i) === rarity)!;
      await give(sql, item.id, 2);
      const before = await balance(sql);
      expect((await sellItem(sql, 7, item.id, now)).wallet.balance - before).toBe(VENDOR_COINS[rarity]);
    }
    const piece = nus.items.find((i) => i.slot === "furniture")!;
    await give(sql, piece.id);
    expect((await sellItem(sql, 7, piece.id, now)).wallet.balance).toBeGreaterThan(0);
    const aura = nus.items.find((i) => i.slot === "aura")!;
    await give(sql, aura.id);
    await sql.execute(
      "UPDATE users SET look = ? WHERE id = 7",
      JSON.stringify({
        style: 0,
        skin: 0,
        hair: 0,
        outfit: 0,
        glasses: 0,
        hat: 0,
        pet: 0,
        petVariant: 0,
        aura: aura.index,
      }),
    );
    // One copy was left over from the loop above only for the aura's tier; sell the lone one just given.
    const row = (await bag(sql, 7)).find((r) => r.item === aura.id)!;
    for (let n = row.count; n > 1; n--) await sellItem(sql, 7, aura.id, now);
    expect((await sellItem(sql, 7, aura.id, now)).unworn).toBe(true);
    const [look] = (await sql.execute("SELECT look FROM users WHERE id = 7")) as { look: string }[];
    expect(JSON.parse(look!.look).aura ?? 0).toBe(0);
  });

  test("sellDuplicates sells only the asked case's spares", async () => {
    const sql = await setup(0);
    const [a, b] = nus.items;
    const n = night.items[0]!;
    await give(sql, a!.id, 3);
    await give(sql, b!.id, 1);
    await give(sql, n.id, 4);
    const out = await sellDuplicates(sql, 7, "nusantara", now);
    expect(out.sold).toBe(2);
    expect(out.wallet.balance).toBe(2 * VENDOR_COINS[rarityOf(a!)]);
    const held = Object.fromEntries((await bag(sql, 7)).map((r) => [r.item, r.count]));
    expect(held).toEqual({ [a!.id]: 1, [b!.id]: 1, [n.id]: 4 });
  });

  test("a Nusantara item never counts as a Night Market spare", async () => {
    const sql = await setup(0);
    await give(sql, nus.items[0]!.id, 3);
    expect((await sellDuplicates(sql, 7, "night-market", now)).sold).toBe(0);
    expect((await bag(sql, 7))[0]!.count).toBe(3);
  });

  test("Ragnarok Eve charges its key and grants only its own items", async () => {
    const sql = await setup(1000);
    const nightIds = new Set(night.items.map((i) => i.id));
    for (let i = 0; i < 6; i++) {
      const before = await balance(sql);
      const out = await openCase(sql, 7, "ragnarok-eve", now);
      expect(eve.items.some((it) => it.id === out.item.id)).toBe(true);
      expect(nightIds.has(out.item.id)).toBe(false);
      expect(before - out.wallet.balance).toBe(eve.keyPrice);
    }
  });

  test("Ragnarok Eve keeps its own dry counter", async () => {
    const sql = await setup(5000);
    const rand = () => 0;
    // Nine dry Night Market openings do not make the first Ragnarok one a hit.
    for (let i = 0; i < 9; i++) await openCase(sql, 7, "night-market", now, undefined, rand);
    expect(rarityOf((await openCase(sql, 7, "ragnarok-eve", now, undefined, rand)).item)).toBe("common");
    // The tenth Night Market opening is still the guaranteed one, whatever Ragnarok did in between.
    const tenth = await openCase(sql, 7, "night-market", now, undefined, rand);
    expect(["rare", "epic", "legendary"]).toContain(rarityOf(tenth.item));
    const rows = await sql.execute("SELECT case_id, dry FROM case_dry WHERE user_id = 7 ORDER BY case_id");
    expect(rows).toEqual([
      { case_id: "night-market", dry: 0 },
      { case_id: "ragnarok-eve", dry: 1 },
    ]);
    // And Ragnarok's own counter reaches its guarantee on its tenth.
    for (let i = 0; i < 8; i++)
      expect(rarityOf((await openCase(sql, 7, "ragnarok-eve", now, undefined, rand)).item)).toBe("common");
    const eveTenth = await openCase(sql, 7, "ragnarok-eve", now, undefined, rand);
    expect(["rare", "epic", "legendary"]).toContain(rarityOf(eveTenth.item));
  });

  test("the vendor buys Ragnarok items by rarity, wearable or furniture", async () => {
    const sql = await setup(0);
    for (const item of [
      eve.items.find((i) => rarityOf(i) === "common" && i.slot === "hat")!,
      eve.items.find((i) => rarityOf(i) === "legendary")!,
      eve.items.find((i) => i.slot === "furniture")!,
    ]) {
      await give(sql, item.id, 2);
      const before = await balance(sql);
      const { wallet } = await sellItem(sql, 7, item.id, now);
      expect(wallet.balance - before).toBe(VENDOR_COINS[rarityOf(item)]);
    }
  });

  test("sellDuplicates sells one case's spares only", async () => {
    const sql = await setup(0);
    const [a, b] = eve.items;
    await give(sql, a!.id, 3);
    await give(sql, b!.id, 2);
    await give(sql, night.items[0]!.id, 4);
    const out = await sellDuplicates(sql, 7, "ragnarok-eve", now);
    expect(out.sold).toBe(3);
    expect(out.wallet.balance).toBe(2 * VENDOR_COINS[rarityOf(a!)] + VENDOR_COINS[rarityOf(b!)]);
    const held = Object.fromEntries((await bag(sql, 7)).map((r) => [r.item, r.count]));
    expect(held).toEqual({ [a!.id]: 1, [b!.id]: 1, [night.items[0]!.id]: 4 });
  });

  test("selling the last worn Ragnarok copy takes it off the look", async () => {
    const sql = await setup(0);
    const pet = eve.items.find((i) => i.slot === "pet")!;
    await give(sql, pet.id);
    await sql.execute(
      "UPDATE users SET look = ? WHERE id = 7",
      JSON.stringify({
        style: 0,
        skin: 0,
        hair: 0,
        outfit: 0,
        glasses: 0,
        hat: 0,
        pet: pet.index,
        petVariant: 0,
      }),
    );
    expect((await sellItem(sql, 7, pet.id, now)).unworn).toBe(true);
    const [row] = await sql.execute("SELECT look FROM users WHERE id = 7");
    expect(JSON.parse((row as { look: string }).look).pet).toBe(0);
  });
});
