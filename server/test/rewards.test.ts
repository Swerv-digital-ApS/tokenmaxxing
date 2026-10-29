import { expect, test } from "bun:test";
import { grantOnce } from "../src/town/rewards.ts";
import { migrate } from "../src/town/schema.ts";
import { memorySql } from "./memory-sql.ts";

test("grantOnce is true once per user and item", async () => {
  const { sql } = memorySql();
  await migrate(sql);
  expect(await grantOnce(sql, 1, "badge:x")).toBe(true);
  expect(await grantOnce(sql, 1, "badge:x")).toBe(false);
  expect(await grantOnce(sql, 1, "badge:y")).toBe(true);
  expect(await grantOnce(sql, 2, "badge:x")).toBe(true);
});
