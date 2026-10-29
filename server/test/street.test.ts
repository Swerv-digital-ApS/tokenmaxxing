import { beforeEach, expect, test } from "bun:test";
import type { TxSql } from "../src/actors/shared.ts";
import { migrate } from "../src/town/schema.ts";
import { paperFacts } from "../src/town/street.ts";
import { memorySql } from "./memory-sql.ts";

let sql: TxSql;
const DAY = "2026-10-20";

async function user(id: number, name: string, look: object, companyId: number | null = null) {
  await sql.execute(
    "INSERT INTO users (id, name, company_id, look, created_at) VALUES (?, ?, ?, ?, ?)",
    id,
    name,
    companyId,
    JSON.stringify({ style: 0, skin: 0, hair: 0, outfit: 0, glasses: 0, hat: 0, pet: 0, ...look }),
    Date.UTC(2026, 0, 1),
  );
}
async function usage(id: number, day: string, model: string, tokens: number) {
  await sql.execute(
    "INSERT INTO usage_daily (user_id, day, model, input, output, cache_creation, cache_read, turns) VALUES (?, ?, ?, ?, 0, 0, 0, 1)",
    id,
    day,
    model,
    tokens,
  );
}

beforeEach(async () => {
  sql = memorySql().sql;
  await migrate(sql);
  await sql.execute(
    "INSERT INTO companies (id, name, owner_id, plot, created_at) VALUES (1, 'ACME', 1, 1, 0)",
  );
  await user(1, "ada", {}, 1);
  await user(2, "bo", { pet: 1 }, 1);
  await user(3, "cy", {});
  await usage(1, DAY, "claude-opus-4-1", 4_100_000_000);
  await usage(2, DAY, "claude-sonnet-4-5", 900_000_000);
  await usage(3, DAY, "claude-sonnet-4-5", 300_000_000);
  await usage(3, "2026-10-19", "claude-sonnet-4-5", 9e9); // another day: not in this paper
  await sql.execute(
    "INSERT INTO activity_daily (user_id, day, prompts, prs, agent_buckets, active_buckets, peak_agents) VALUES (2, ?, 40, 6, 0, 0, 0), (3, ?, 10, 1, 0, 0, 0)",
    DAY,
    DAY,
  );
});

test("the paper's facts are the day's: burner, company, PRs, model and a pet", async () => {
  const f = await paperFacts(sql, DAY);
  expect(f).toMatchObject({
    day: DAY,
    tokens: 5_300_000_000,
    people: 3,
    burner: { name: "ada", tokens: 4_100_000_000 },
    company: { name: "ACME", tokens: 5_000_000_000, members: 2 },
    prs: 7,
    shipper: { name: "bo", prs: 6 },
    prompts: 50,
    model: { name: "claude-opus-4-1" },
    pet: { owner: "bo", pet: "Duck", place: "ACME" },
    game: null,
  });
});

test("a day nobody used shows up empty", async () => {
  const f = await paperFacts(sql, "2026-10-01");
  expect(f).toMatchObject({ tokens: 0, people: 0, burner: null, company: null, shipper: null, model: null });
});
