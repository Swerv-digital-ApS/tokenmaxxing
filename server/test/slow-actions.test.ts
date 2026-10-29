import { expect, test } from "bun:test";
import { logSlowActions } from "../src/slow-actions.ts";

test("an action that takes too long is logged with its actor and key, even when it fails", async () => {
  const lines: string[] = [];
  const definition = {
    config: {
      actions: {
        quick: (_c: unknown, n: number) => n + 1,
        slow: async (_c: unknown, n: number) => {
          await Bun.sleep(30);
          return n * 2;
        },
        broken: async () => {
          await Bun.sleep(30);
          throw new Error("nope");
        },
      } as Record<string, unknown>,
    },
  };
  logSlowActions("player", definition, 20, (l) => lines.push(l));
  const { quick, slow, broken } = definition.config.actions as Record<
    string,
    (c: unknown, ...args: unknown[]) => unknown
  >;
  const c = { key: ["1"] };
  expect(quick!(c, 1)).toBe(2);
  expect(await slow!(c, 2)).toBe(4);
  await expect(broken!(c)).rejects.toThrow("nope");
  expect(lines).toHaveLength(2);
  expect(lines[0]).toMatch(/^\[slow\] player\[1\]\.slow \d+ ms$/);
  expect(lines[1]).toMatch(/^\[slow\] player\[1\]\.broken \d+ ms \(failed\)$/);
});
