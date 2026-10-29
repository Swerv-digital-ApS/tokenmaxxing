import { beforeEach, describe, expect, test } from "bun:test";
import { levelUpCoins } from "@tokenmaxxing/core/economy.ts";
import { levelFor } from "@tokenmaxxing/core/format.ts";
import { EMPLOYEE_MERCH_DISCOUNT, itemById, merchId, merchPrice } from "@tokenmaxxing/core/shop.ts";
import type { TxSql } from "../src/actors/shared.ts";
import { buyMerch, floors, giveBack, pickUp, placed, unclaimed, wallet } from "../src/town/coins.ts";
import {
  buyPiece,
  type CompanyRow,
  companyById,
  companyInfos,
  companyWallet,
  leave,
  matchCoins,
  matchDue,
  setMerchDesign,
  storedPieces,
  unstore,
} from "../src/town/companies.ts";
import { migrate } from "../src/town/schema.ts";
import { memorySql } from "./memory-sql.ts";

let sql: TxSql;
const NOW = Date.UTC(2026, 8, 29, 12);
const at = (day: string) => Date.parse(`${day}T12:00:00Z`);

/** `userId`'s tokens for `day`, as a sync leaves them (replacing the day). */
async function usage(userId: number, day: string, tokens: number) {
  await sql.execute("DELETE FROM usage_daily WHERE user_id = ? AND day = ?", userId, day);
  await sql.execute(
    "INSERT INTO usage_daily (user_id, day, model, input, output, cache_creation, cache_read, turns) VALUES (?, ?, 'm', ?, 0, 0, 0, 1)",
    userId,
    day,
    tokens,
  );
}
async function user(id: number, companyId: number | null, joined: string | null) {
  await sql.execute(
    "INSERT INTO users (id, name, company_id, joined_at, look, created_at) VALUES (?, ?, ?, ?, '{}', ?)",
    id,
    `u${id}`,
    companyId,
    joined && at(joined),
    at("2026-01-01"),
  );
}
async function company(id: number, ownerId: number) {
  await sql.execute(
    "INSERT INTO companies (id, name, owner_id, plot, created_at) VALUES (?, ?, ?, ?, ?)",
    id,
    `Co${id}`,
    ownerId,
    id,
    NOW,
  );
}
const row = async (id: number) => (await companyById(sql, id)) as CompanyRow;
/** Gives company `id` some coins, as if its people had earned them. */
const fund = (id: number, coins: number) =>
  sql.execute(
    "INSERT INTO company_ledger (company_id, user_id, amount, kind, ref, at) VALUES (?, 1, ?, 'admin', 'admin', ?)",
    id,
    coins,
    NOW,
  );

beforeEach(async () => {
  sql = memorySql().sql;
  await migrate(sql);
  await company(1, 1);
  await company(2, 4);
  await user(1, 1, "2026-02-01"); // owner of Co1
  await user(2, 1, "2026-02-01"); // member of Co1
  await user(3, null, null); // freelancer
  await user(4, 2, "2026-02-01"); // owner of Co2
});

describe("the company wallet: token coins matched 1:1", () => {
  test("a member's day is matched as it grows, and the member keeps all of theirs", async () => {
    await usage(2, "2026-03-01", 100e6); // 10 coins
    await matchCoins(sql, 2, ["2026-03-01"], NOW);
    expect(await companyWallet(sql, 1)).toBe(10);
    await usage(2, "2026-03-01", 400e6); // 20 coins: 10 more
    await matchCoins(sql, 2, ["2026-03-01"], NOW);
    await matchCoins(sql, 2, ["2026-03-01"], NOW); // the same sync again adds nothing
    expect(await companyWallet(sql, 1)).toBe(20);
    expect((await wallet(sql, 2, NOW)).balance).toBe(20 + 25 + levelUpCoins(levelFor(400e6))); // not split: all theirs (and the day's podium, and the level it reached)
  });

  test("days before joining, and freelancers, aren't matched", async () => {
    await usage(2, "2026-01-15", 100e6);
    await usage(3, "2026-03-01", 100e6);
    await matchCoins(sql, 2, ["2026-01-15"], NOW);
    await matchCoins(sql, 3, ["2026-03-01"], NOW);
    expect(await companyWallet(sql, 1)).toBe(0);
  });

  test("moving on mid-day: the new company gets only what the day grows by", async () => {
    await usage(2, "2026-03-01", 100e6);
    await matchCoins(sql, 2, ["2026-03-01"], NOW);
    await sql.execute("UPDATE users SET company_id = 2, joined_at = ? WHERE id = 2", at("2026-03-01"));
    await usage(2, "2026-03-01", 900e6); // 30 coins
    await matchCoins(sql, 2, ["2026-03-01"], NOW);
    expect([await companyWallet(sql, 1), await companyWallet(sql, 2)]).toEqual([10, 20]);
    expect(matchDue(5, 9)).toBe(0); // a wiped day never takes coins back
  });

  test("a new ledger starts every wallet at 0, and later migrations leave it alone", async () => {
    await usage(1, "2026-03-01", 100e6);
    await sql.execute("DROP TABLE company_ledger");
    await migrate(sql);
    expect(await companyWallet(sql, 1)).toBe(0);
    await matchCoins(sql, 1, ["2026-03-01"], NOW);
    await migrate(sql);
    expect(await companyWallet(sql, 1)).toBe(10);
  });
});

describe("company furniture", () => {
  const sofa = itemById("furn.Σ")!;

  test("bought from the wallet, never more than it holds, and the ledger says who", async () => {
    const co = await row(1);
    await expect(buyPiece(sql, co, 1, sofa, NOW)).rejects.toThrow("can't cover");
    await expect(buyPiece(sql, co, 1, itemById("furn.s")!, NOW)).rejects.toThrow("not for company");
    await fund(1, 300);
    await buyPiece(sql, co, 1, sofa, NOW);
    expect(await companyWallet(sql, 1)).toBe(60);
    expect(await storedPieces(sql, 1)).toEqual([{ item: "furn.Σ", count: 1 }]);
    const [line] = (await sql.execute(
      "SELECT user_id AS userId, amount, ref FROM company_ledger WHERE kind = 'furniture'",
    )) as { userId: number; amount: number; ref: string }[];
    expect(line).toEqual({ userId: 1, amount: -240, ref: "furn.Σ" });
    // Never in anyone's bag, and the owner's coins aren't touched.
    expect((await sql.execute("SELECT 1 FROM items WHERE owner_id IS NOT NULL")).length).toBe(0);
  });

  test("on the floor it stays: members put it back in the storeroom, outsiders can't take it", async () => {
    await fund(1, 600);
    const id = await buyPiece(sql, await row(1), 1, sofa, NOW);
    await placed(sql, { id, item: sofa.id, room: "hq:1", x: 3, y: 4, by: 1, at: NOW, co: 1 });
    expect(await storedPieces(sql, 1)).toEqual([]);
    expect(await unclaimed(sql, NOW + 86_400_000)).toEqual([]); // the sweeper leaves it
    expect(await pickUp(sql, id, 3, "hq:1")).toBe(false);
    expect(await pickUp(sql, id, 4, "hq:1")).toBe(false); // another company's owner
    expect(await pickUp(sql, id, 2, "hq:1")).toBe(true);
    expect(await storedPieces(sql, 1)).toEqual([{ item: "furn.Σ", count: 1 }]);
    expect(await unstore(sql, 1, sofa.id, 2, NOW)).toBe(id);
    await placed(sql, { id, item: sofa.id, room: "hq:1", x: 3, y: 4, by: 2, at: NOW, co: 1 });
    // A rebuilt building with no place for it: back to the storeroom, not to whoever placed it.
    await giveBack(sql, [id]);
    expect(await storedPieces(sql, 1)).toEqual([{ item: "furn.Σ", count: 1 }]);
  });

  test("a piece turned comes back turned, and faces as bought again once stored", async () => {
    await fund(1, 300);
    const id = await buyPiece(sql, await row(1), 1, sofa, NOW);
    await placed(sql, { id, item: sofa.id, room: "hq:1", x: 3, y: 4, by: 1, at: NOW, co: 1 });
    expect((await floors(sql)).find((d) => d.id === id)?.rot).toBeUndefined();
    await sql.execute("UPDATE items SET rot = 3 WHERE id = ?", id); // as `town.moved` writes it
    expect((await floors(sql)).find((d) => d.id === id)).toMatchObject({ x: 3, y: 4, co: 1, rot: 3 });
    expect(await pickUp(sql, id, 2, "hq:1")).toBe(true);
    await unstore(sql, 1, sofa.id, 2, NOW);
    await placed(sql, { id, item: sofa.id, room: "hq:1", x: 5, y: 4, by: 2, at: NOW, co: 1 });
    expect((await floors(sql)).find((d) => d.id === id)?.rot).toBeUndefined();
  });

  test("a poster is bought from the wallet, kept in the storeroom, and hung on the wall like any piece", async () => {
    const poster = itemById("furn.0")!;
    expect(poster).toMatchObject({ name: "Counter-CI: Global Flake", price: 160, company: true });
    await fund(1, 200);
    const id = await buyPiece(sql, await row(1), 3, poster, NOW);
    expect(await companyWallet(sql, 1)).toBe(40);
    await expect(buyPiece(sql, await row(1), 3, poster, NOW)).rejects.toThrow("can't cover");
    expect(await storedPieces(sql, 1)).toEqual([{ item: "furn.0", count: 1 }]);
    expect(await unstore(sql, 1, poster.id, 2, NOW)).toBe(id);
    // The wall row is a spot like any other for `placed`; it stays the company's, and stays put.
    await placed(sql, { id, item: poster.id, room: "hq:1", x: 5, y: 1, by: 2, at: NOW, co: 1 });
    expect(await unclaimed(sql, NOW + 86_400_000)).toEqual([]);
    expect(await pickUp(sql, id, 2, "hq:1")).toBe(true);
    expect(await storedPieces(sql, 1)).toEqual([{ item: "furn.0", count: 1 }]);
  });

  test("a company that closes takes its furniture with it", async () => {
    await fund(2, 600);
    await buyPiece(sql, await row(2), 4, sofa, NOW);
    await leave(sql, 4);
    expect((await sql.execute("SELECT 1 FROM items WHERE company_id = 2")).length).toBe(0);
  });
});

describe("merch", () => {
  const tee = itemById(merchId(1, "tee"))!;

  test("an item per company and kind; outsiders pay full price, employees the discount", () => {
    expect(tee).toMatchObject({ slot: "merch", name: "Tee", price: 120, companyId: 1, tradeable: false });
    expect(itemById("merch.0.tee")).toBeUndefined();
    expect(itemById("merch.1.sock")).toBeUndefined();
    expect(merchPrice("tee", false)).toBe(120);
    expect(merchPrice("hoodie", true)).toBe(Math.round(240 * (1 - EMPLOYEE_MERCH_DISCOUNT)));
    expect(EMPLOYEE_MERCH_DISCOUNT).toBe(1);
    expect(merchPrice("hoodie", true)).toBe(0);
  });

  test("what an outsider pays goes into the company wallet", async () => {
    await usage(3, "2026-03-01", 9_025e6); // 95 coins, and 25 for the day's podium: 120
    await buyMerch(sql, 3, tee, NOW);
    // All 120 went on the tee; what's left is the level the day reached.
    expect((await wallet(sql, 3, NOW)).balance).toBe(levelUpCoins(levelFor(9_025e6)));
    expect(await companyWallet(sql, 1)).toBe(120);
    await expect(buyMerch(sql, 3, tee, NOW)).rejects.toThrow("Not enough");
  });

  test("employees get theirs free, one each, and the wallet gets nothing", async () => {
    await buyMerch(sql, 2, tee, NOW);
    expect((await wallet(sql, 2, NOW)).owned).toEqual([tee.id]);
    await expect(buyMerch(sql, 2, tee, NOW)).rejects.toThrow("one each");
    expect(await companyWallet(sql, 1)).toBe(0);
    await expect(buyMerch(sql, 2, itemById(merchId(9, "cap"))!, NOW)).rejects.toThrow("gone");
  });
});

describe("the merch design: any member draws it", () => {
  const design = {
    main: "#3A6FB8",
    accent: "#f5d14a",
    rows: ["a......a", ".a....a.", "..awwa..", "..awwa..", ".k....k.", "k......k"],
  };

  test("a plain member saves it, and the company's info carries it", async () => {
    expect(await setMerchDesign(sql, 2, design)).toBe(1);
    const [info] = await companyInfos(sql, [1]);
    expect(info!.merch).toEqual({ ...design, main: "#3a6fb8" });
    await setMerchDesign(sql, 2, null);
    expect((await companyInfos(sql, [1]))[0]!.merch).toBeNull();
  });

  test("a freelancer can't, nor can a malformed design in", async () => {
    await expect(setMerchDesign(sql, 3, design)).rejects.toThrow("Join a company");
    await expect(setMerchDesign(sql, 2, { ...design, rows: ["a"] })).rejects.toThrow("merch design");
    await expect(setMerchDesign(sql, 2, { ...design, main: "red" })).rejects.toThrow("merch design");
    await expect(
      setMerchDesign(sql, 2, { ...design, rows: design.rows.map((r) => r.replace("a", "x")) }),
    ).rejects.toThrow("merch design");
  });
});
