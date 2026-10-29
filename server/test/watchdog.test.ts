import { expect, test } from "bun:test";
import { healthCheck } from "../src/health.ts";
import { diagnose, failureWindow, matchingPids, type ProbeResult, watchdogConfig } from "../src/watchdog.ts";

test("config: production defaults, env overrides, and bad values are refused", () => {
  expect(watchdogConfig({})).toEqual({
    intervalMs: 30_000,
    timeoutMs: 20_000,
    failures: 5,
    windowMs: 120_000,
  });
  expect(
    watchdogConfig({ HEALTH_FAILURES: "8", HEALTH_INTERVAL_MS: "1000", HEALTH_WINDOW_MS: "0" }),
  ).toMatchObject({
    failures: 8,
    intervalMs: 1000,
    windowMs: 0,
  });
  expect(() => watchdogConfig({ HEALTH_FAILURES: "0" })).toThrow("HEALTH_FAILURES");
  expect(() => watchdogConfig({ HEALTH_TIMEOUT_MS: "soon" })).toThrow("HEALTH_TIMEOUT_MS");
});

test("exits only after enough failures in a row that span the window", () => {
  const w = failureWindow({ failures: 3, windowMs: 60_000 });
  expect([w.record(false, 0), w.record(false, 30_000)]).toEqual([false, false]);
  expect(w.record(false, 45_000)).toBe(false); // 3 failures, but only 45 s
  expect(w.record(false, 60_000)).toBe(true);
});

test("one success starts the count over", () => {
  const w = failureWindow({ failures: 3, windowMs: 0 });
  w.record(false, 0);
  w.record(false, 1);
  expect(w.streak).toBe(2);
  expect(w.record(true, 2)).toBe(false);
  expect(w.streak).toBe(0);
  expect([w.record(false, 3), w.record(false, 4), w.record(false, 5)]).toEqual([false, false, true]);
});

test("diagnose says a lagging event loop apart from an unreachable actor", () => {
  const timeout: ProbeResult = { ok: false, ms: 20_000, reason: "timeout" };
  expect(diagnose(timeout, 4_200)).toContain("event loop lagging 4200 ms");
  expect(diagnose(timeout, 12)).toContain("event loop fine");
  expect(diagnose({ ok: false, ms: 3, reason: "error", error: "engine closed" }, 0)).toContain(
    "engine closed",
  );
});

test("matchingPids picks the engine out of ps rows", () => {
  const ps = "12 /usr/bin/bun main.ts\n 34 /x/rivet-engine start\n56 grep";
  expect(matchingPids(ps, "rivet-engine")).toEqual([34]);
});

test("a probe reports how it went and how long it took", async () => {
  const seen: ProbeResult[] = [];
  const ok = healthCheck(
    async () => {},
    "1",
    50,
    (r) => seen.push(r),
  );
  await ok();
  const bad = healthCheck(
    () => Promise.reject(new Error("db closed")),
    "1",
    50,
    (r) => seen.push(r),
  );
  await bad();
  const stuck = healthCheck(
    () => new Promise(() => {}),
    "1",
    5,
    (r) => seen.push(r),
  );
  await stuck();
  expect(seen.map((r) => [r.ok, r.reason])).toEqual([
    [true, "ok"],
    [false, "error"],
    [false, "timeout"],
  ]);
  expect(seen[1]?.error).toBe("db closed");
});
