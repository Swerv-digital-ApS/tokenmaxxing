import { afterAll, afterEach } from "bun:test";

/**
 * Run once the test process is done with its server (`bun test` never fires process "exit"): after
 * the whole run, or after each file with `--parallel`, which gives every file a fresh module registry.
 */
export const atExit: (() => Promise<void> | void)[] = [];

/** Run after every test, in every file (a preload's hooks are global). */
export const afterEveryTest: (() => Promise<void>)[] = [];

afterEach(async () => {
  for (const f of afterEveryTest) await f();
});

afterAll(async () => {
  await Promise.all(atExit.splice(0).map((f) => f()));
});
