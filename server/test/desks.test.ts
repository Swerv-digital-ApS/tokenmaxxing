import { beforeEach, describe, expect, test } from "bun:test";
import type { TxSql } from "../src/actors/shared.ts";
import { deleteUser } from "../src/town/admin.ts";
import { wallet } from "../src/town/coins.ts";
import { type CompanyRow, companyById, companyInfos, companyWallet } from "../src/town/companies.ts";
import { buyDesk, buyDeskFleet, migrateDesks, myDesk, setDesk } from "../src/town/desks.ts";
import { migrate } from "../src/town/schema.ts";
import { playerCores } from "../src/town/users.ts";
import { memorySql } from "./memory-sql.ts";

let sql: TxSql;
const NOW = Date.UTC(2026, 9, 24, 10);

/** User 1 has years of tokens (a high level, plenty of coins); 2 and 3 none. 1 and 2 are in company 1. */
beforeEach(async () => {
  sql = memorySql().sql;
  await migrate(sql);
  for (const id of [1, 2, 3])
    await sql.execute(
      "INSERT INTO users (id, name, look, created_at, company_id) VALUES (?, ?, '{}', ?, ?)",
      id,
      `u${id}`,
      Date.UTC(2026, 0, 1),
      id === 3 ? null : 1,
    );
  await sql.execute(
    "INSERT INTO companies (id, name, owner_id, plot, created_at) VALUES (1, 'Co', 1, 1, ?)",
    NOW,
  );
  for (let d = 0; d < 250; d++)
    await sql.execute(
      "INSERT INTO usage_daily (user_id, day, model, input, output, cache_creation, cache_read, turns) VALUES (1, date('2026-01-02', ?), 'm', ?, 0, 0, 0, 1)",
      `+${d} days`,
      1e10,
    );
});

const company = async () => (await companyById(sql, 1)) as CompanyRow;
const fund = (coins: number) =>
  sql.execute(
    "INSERT INTO company_ledger (company_id, user_id, amount, kind, ref, at) VALUES (1, 1, ?, 'admin', 'admin', ?)",
    coins,
    NOW,
  );

describe("desk setups: the migration", () => {
  test("is safe to run again, and adds the two columns", async () => {
    await migrateDesks(sql);
    await migrate(sql);
    const users = (await sql.execute("PRAGMA table_info(users)")) as { name: string }[];
    const cos = (await sql.execute("PRAGMA table_info(companies)")) as { name: string }[];
    expect(users.some((c) => c.name === "desk")).toBe(true);
    expect(cos.some((c) => c.name === "desk_fleet")).toBe(true);
    // Nobody has chosen one: everyone is the laptop.
    expect((await playerCores(sql, "all")).map((p) => p.desk)).toEqual([0, 0, 0]);
    expect((await companyInfos(sql, "all")).map((c) => c.deskFleet)).toEqual([0]);
  });
});

describe("a personal setup", () => {
  test("buy once with coins, then use it for free; the laptop is free and always yours", async () => {
    expect(await myDesk(sql, 2)).toEqual({ owned: ["laptop"], using: "laptop" });
    const before = (await wallet(sql, 1, NOW)).balance;
    expect((await buyDesk(sql, 1, "dual", NOW)).balance).toBe(before - 60);
    expect((await myDesk(sql, 1)).owned).toContain("dual");
    expect((await myDesk(sql, 1)).using).toBe("laptop"); // buying doesn't switch
    expect(await setDesk(sql, 1, "dual")).toBe("dual");
    expect((await playerCores(sql, [1]))[0]!.desk).toBe(1);
    // Switching back and forth costs nothing.
    await setDesk(sql, 1, "laptop");
    await setDesk(sql, 1, "dual");
    expect((await wallet(sql, 1, NOW)).balance).toBe(before - 60);
    await expect(buyDesk(sql, 1, "dual", NOW)).rejects.toMatchObject({ code: "owned" });
  });

  test("the high tiers are earned by level; the laptop can't be bought; unknown or unowned ones refuse", async () => {
    expect((await myDesk(sql, 1)).owned).toEqual(["laptop", "ultrawide", "battlestation"]);
    await expect(buyDesk(sql, 1, "laptop", NOW)).rejects.toMatchObject({ code: "not_for_sale" });
    await expect(buyDesk(sql, 1, "nope", NOW)).rejects.toMatchObject({ code: "not_found" });
    await expect(setDesk(sql, 1, "nope")).rejects.toMatchObject({ code: "not_found" });
    await expect(setDesk(sql, 2, "triple")).rejects.toMatchObject({ code: "not_owned" });
    await expect(setDesk(sql, 2, "ultrawide")).rejects.toMatchObject({ code: "not_owned" });
    await setDesk(sql, 1, "battlestation");
    expect((await playerCores(sql, [1]))[0]!.desk).toBe(4);
  });

  test("not enough coins buys nothing", async () => {
    await expect(buyDesk(sql, 2, "dual", NOW)).rejects.toMatchObject({ code: "too_poor" });
    expect((await myDesk(sql, 2)).owned).toEqual(["laptop"]);
    expect((await wallet(sql, 2, NOW)).balance).toBe(0);
  });

  test("deleting an account takes its purchases and its choice", async () => {
    await buyDesk(sql, 1, "triple", NOW);
    await setDesk(sql, 1, "triple");
    await deleteUser(sql, 1, NOW);
    expect(await sql.execute("SELECT item FROM purchases WHERE item LIKE 'desk.%'")).toEqual([]);
    expect(await sql.execute("SELECT desk FROM users WHERE id = 1")).toEqual([]);
  });
});

describe("the company's fleet", () => {
  test("the company buys the next tier from the wallet, one at a time, and it lands in the ledger", async () => {
    await fund(1000);
    expect(await buyDeskFleet(sql, await company(), 2, NOW)).toBe(1);
    expect(await companyWallet(sql, 1)).toBe(700);
    expect((await companyInfos(sql, [1]))[0]!.deskFleet).toBe(1);
    expect(await buyDeskFleet(sql, await company(), 1, NOW)).toBe(2);
    expect(await companyWallet(sql, 1)).toBe(0);
    const log = await sql.execute(
      "SELECT user_id, amount, kind, ref FROM company_ledger WHERE kind = 'desk' ORDER BY id",
    );
    expect(log).toEqual([
      { user_id: 2, amount: -300, kind: "desk", ref: "dual" },
      { user_id: 1, amount: -700, kind: "desk", ref: "triple" },
    ]);
  });

  test("an empty wallet buys nothing, and the top tier is the end", async () => {
    await fund(299);
    await expect(buyDeskFleet(sql, await company(), 1, NOW)).rejects.toMatchObject({ code: "too_poor" });
    expect((await companyInfos(sql, [1]))[0]!.deskFleet).toBe(0);
    await fund(100_000);
    for (let i = 0; i < 4; i++) await buyDeskFleet(sql, await company(), 1, NOW);
    await expect(buyDeskFleet(sql, await company(), 1, NOW)).rejects.toMatchObject({ code: "owned" });
    expect(await companyWallet(sql, 1)).toBe(100_299 - (300 + 700 + 1400 + 2500));
  });
});
