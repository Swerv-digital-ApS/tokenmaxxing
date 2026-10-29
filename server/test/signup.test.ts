import { expect, test } from "bun:test";
import { serial } from "../src/actors/shared.ts";
import { town } from "../src/actors/town.ts";
import { RateLimiter } from "../src/rate-limit.ts";
import { migrate } from "../src/town/schema.ts";
import { memorySql } from "./memory-sql.ts";

test("a sign-up whose player timed out never hands its id on: that actor may exist", async () => {
  // `town` in this process, on an in-memory database: the engine can't be made to time out on the server.
  const { sql } = memorySql();
  await migrate(sql);
  const made = new Set<string>();
  let timeout = true;
  const world = { setPlayer: async () => [] };
  const client = {
    player: {
      create: async ([id]: string[]) => {
        // The engine made it, but answered too late.
        made.add(id!);
        if (timeout) throw new Error("callback_timed_out");
      },
    },
    town: { getOrCreate: () => ({}) },
    world: { getOrCreate: () => world },
    arcade: { getOrCreate: () => ({}) },
  };
  const vars = {
    serial: serial(),
    signups: new RateLimiter(100, 60_000),
    signupsPerIp: new RateLimiter(100, 60_000),
  };
  const signUp = (name: string) =>
    town.config.actions!.signUp(
      { conn: { state: { kind: "anonymous", ip: null } }, db: sql, vars, client: () => client } as never,
      name,
    );

  await expect(signUp("ada")).rejects.toThrow("callback_timed_out");
  timeout = false;
  const next = await signUp("ada");
  expect(next.name).toBe("ada");
  expect(next.userId).toBe(2);
  expect([...made]).toEqual(["1", "2"]);
});
