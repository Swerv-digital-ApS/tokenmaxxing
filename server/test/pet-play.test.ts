import { beforeEach, describe, expect, test } from "bun:test";
import { PET_COOLDOWN_MS, TREAT_COST, TREATS_PER_DAY } from "@tokenmaxxing/core/pets.ts";
import type { TxSql } from "../src/actors/shared.ts";
import { treatPet, wallet } from "../src/town/coins.ts";
import { migrate } from "../src/town/schema.ts";
import { memorySql } from "./memory-sql.ts";
import { admin, eventually, rich } from "./rivet.ts";
import { connect } from "./world-client.ts";

describe("treats", () => {
  let sql: TxSql;
  const noon = (day: string) => Date.parse(`${day}T12:00:00Z`);
  const balance = async (day: string) => (await wallet(sql, 1, noon(day))).balance;
  beforeEach(async () => {
    ({ sql } = memorySql());
    await migrate(sql);
    await sql.execute(
      "INSERT INTO users (id, name, look, created_at) VALUES (1, 'ada', '{}', ?)",
      noon("2026-09-01"),
    );
    await sql.execute(
      "INSERT INTO ledger (user_id, amount, kind, ref, at) VALUES (1, 100, 'admin', 'admin', 1)",
    );
  });

  test("each treat is a ledger sink, and the day's count ends them", async () => {
    const before = await balance("2026-09-02");
    for (let i = 1; i <= TREATS_PER_DAY; i++)
      expect(await treatPet(sql, 1, noon("2026-09-02"))).toBe(TREATS_PER_DAY - i);
    await expect(treatPet(sql, 1, noon("2026-09-02"))).rejects.toMatchObject({ code: "limit" });
    expect(await balance("2026-09-02")).toBe(before - TREATS_PER_DAY * TREAT_COST);
    const rows = (await sql.execute("SELECT amount, kind, ref FROM ledger WHERE kind = 'pet'")) as {
      amount: number;
      ref: string;
    }[];
    expect(rows.map((r) => [r.amount, r.ref])).toEqual(
      Array.from({ length: TREATS_PER_DAY }, (_, i) => [-TREAT_COST, `treat:2026-09-02:${i + 1}`]),
    );
    // Tomorrow is a new day's five.
    expect(await treatPet(sql, 1, noon("2026-09-03"))).toBe(TREATS_PER_DAY - 1);
  });

  test("without the coins there is no treat, and nothing is written", async () => {
    await sql.execute("DELETE FROM ledger");
    await expect(treatPet(sql, 1, noon("2026-09-02"))).rejects.toMatchObject({ code: "too_poor" });
    expect(((await sql.execute("SELECT 1 FROM ledger")) as unknown[]).length).toBe(0);
  });
});

describe("playing with a pet", () => {
  /** A player with coins, wearing a dog, in the Tavern with a watcher; and what each has heard. */
  async function pair() {
    const owner = await rich("petter", 2000);
    await owner.town.buy("pet.3");
    await owner.town.setLook({ ...(await owner.town.me()).look, pet: 3 });
    const watcher = await rich("watcher", 0);
    const mine = await connect(owner.token);
    const theirs = await connect(watcher.token);
    const plays = { mine: [] as unknown[], theirs: [] as unknown[] };
    mine.conn.on("petPlay", (e: unknown) => plays.mine.push(e));
    theirs.conn.on("petPlay", (e: unknown) => plays.theirs.push(e));
    return { owner, mine, theirs, plays };
  }

  test("a stroke is seen by the room, and only so often", async () => {
    const { owner, mine, theirs, plays } = await pair();
    expect(await mine.conn.petPlay("pet")).toBeNull();
    await eventually(() => expect(plays.theirs).toEqual([{ userId: owner.userId, act: "pet" }]));
    expect(plays.mine).toEqual([{ userId: owner.userId, act: "pet" }]);
    expect(await mine.conn.petPlay("pet")).toBe("Give your pet a moment.");
    // Another act has its own clock.
    expect(await mine.conn.petPlay("trick")).toBeNull();
    await Bun.sleep(150);
    expect(plays.theirs.length).toBe(2);
    expect(PET_COOLDOWN_MS.pet).toBeGreaterThan(0);
    await mine.conn.dispose();
    await theirs.conn.dispose();
  });

  test("a treat costs coins out of the wallet and shows; an empty wallet gets none", async () => {
    const { owner, mine, theirs, plays } = await pair();
    const before = (await owner.town.wallet()).balance;
    expect(await mine.conn.petPlay("treat")).toBeNull();
    await eventually(() => expect(plays.theirs).toEqual([{ userId: owner.userId, act: "treat" }]));
    expect((await owner.town.wallet()).balance).toBe(before - TREAT_COST);
    await admin().adminSetCoins(owner.userId, 0);
    await Bun.sleep(PET_COOLDOWN_MS.treat + 50);
    expect(await mine.conn.petPlay("treat")).toBe(`A treat is 🪙 ${TREAT_COST}.`);
    await Bun.sleep(150);
    expect(plays.theirs.length).toBe(1);
    await mine.conn.dispose();
    await theirs.conn.dispose();
  });

  test("no pet, no play; and nothing else is an act", async () => {
    const bare = await rich("bare", 100);
    const { conn } = await connect(bare.token);
    expect(await conn.petPlay("pet")).toBe("You don't have a pet with you.");
    expect(await conn.petPlay("explode")).toBeNull();
    await conn.dispose();
  });
});
