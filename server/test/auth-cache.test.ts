import { expect, test } from "bun:test";
import type { Client } from "rivetkit/client";
import type { registry } from "../src/actors/registry.ts";
import { authenticate } from "../src/actors/shared.ts";

const token = `1.${"a".repeat(43)}`;

/** A player whose `verify` answers when `answer` is called, counting how often it was asked. */
function slowPlayer() {
  let asked = 0;
  let answer: (via: string | null) => void = () => {};
  const client = {
    player: {
      get: () => ({
        verify: () => {
          asked++;
          return new Promise((resolve) => {
            answer = resolve;
          });
        },
      }),
    },
  } as unknown as Client<typeof registry>;
  return { client, asked: () => asked, answer: (via: string | null) => answer(via) };
}

test("a burst of connections with one token asks its player once", async () => {
  const p = slowPlayer();
  const cache = new Map();
  const calls = [1, 2, 3].map(() => authenticate({ token }, p.client, cache));
  p.answer("device");
  for (const caller of await Promise.all(calls))
    expect(caller).toMatchObject({ kind: "user", via: "device" });
  expect(p.asked()).toBe(1);
});

test("once answered, the next miss asks again: a revoked token is refused", async () => {
  const p = slowPlayer();
  const cache = new Map();
  const first = authenticate({ token }, p.client, cache);
  p.answer("device");
  await first;
  cache.clear(); // the minute is up
  const second = authenticate({ token }, p.client, cache);
  p.answer(null);
  await expect(second).rejects.toMatchObject({ code: "unauthorized" });
  expect(p.asked()).toBe(2);
});
