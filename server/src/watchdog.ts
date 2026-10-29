/**
 * The server's own liveness watchdog: pure parts. `main.ts` probes an actor every
 * `HEALTH_INTERVAL_MS` and exits (so the host restarts it) when probes keep failing.
 */

export type WatchdogConfig = {
  /** Time between probes. */
  intervalMs: number;
  /** How long one probe may take before it counts as failed. */
  timeoutMs: number;
  /** This many probes in a row must fail... */
  failures: number;
  /** ...and the first of them must be at least this long ago, before the server exits. */
  windowMs: number;
};

const int = (raw: string | undefined, fallback: number, min: number, name: string): number => {
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min) throw new Error(`${name} must be an integer >= ${min}, got "${raw}"`);
  return n;
};

/**
 * Defaults are for production: a probe gets 20 s (an actor call is ~10 ms when the machine is idle),
 * and it takes 5 failed probes spanning at least 2 minutes to give up.
 *
 * | Var | Default | |
 * |---|---|---|
 * | `HEALTH_INTERVAL_MS` | 30000 | time between probes |
 * | `HEALTH_TIMEOUT_MS` | 20000 | one probe's patience |
 * | `HEALTH_FAILURES` | 5 | failed probes in a row before exiting |
 * | `HEALTH_WINDOW_MS` | 120000 | ...which must also span this long |
 */
export function watchdogConfig(env: Record<string, string | undefined>): WatchdogConfig {
  return {
    intervalMs: int(env.HEALTH_INTERVAL_MS, 30_000, 10, "HEALTH_INTERVAL_MS"),
    timeoutMs: int(env.HEALTH_TIMEOUT_MS, 20_000, 10, "HEALTH_TIMEOUT_MS"),
    failures: int(env.HEALTH_FAILURES, 5, 1, "HEALTH_FAILURES"),
    windowMs: int(env.HEALTH_WINDOW_MS, 120_000, 0, "HEALTH_WINDOW_MS"),
  };
}

/**
 * Counts consecutive failed probes. `record` says whether it's time to give up: `failures` in a
 * row, the first at least `windowMs` ago. One success starts over, so a slow patch never adds up.
 */
export function failureWindow({ failures, windowMs }: Pick<WatchdogConfig, "failures" | "windowMs">) {
  let count = 0;
  let first = 0;
  return {
    record(ok: boolean, now: number): boolean {
      if (ok) {
        count = 0;
        return false;
      }
      if (count++ === 0) first = now;
      return count >= failures && now - first >= windowMs;
    },
    get streak() {
      return count;
    },
  };
}

export type ProbeResult = { ok: boolean; ms: number; reason: "ok" | "timeout" | "error"; error?: string };

/**
 * What a failed probe most likely means, for the log: with the event loop itself lagging, the
 * probe was starved with everything else (a busy machine); with the loop fine, the engine or the
 * actor isn't answering.
 */
export function diagnose(result: ProbeResult, loopLagMs: number, lagThresholdMs = 1_000): string {
  if (result.ok) return "ok";
  const where =
    loopLagMs >= lagThresholdMs
      ? `event loop lagging ${Math.round(loopLagMs)} ms (busy machine?)`
      : "event loop fine";
  const what =
    result.reason === "timeout"
      ? `no answer in ${result.ms} ms`
      : `error after ${result.ms} ms: ${result.error}`;
  return `actor probe failed: ${what}; ${where}`;
}

/** Pids of `children` whose command line mentions `needle`; `ps` rows are `pid command...`. */
export function matchingPids(ps: string, needle: string): number[] {
  return ps
    .split("\n")
    .map((line) => line.trim().match(/^(\d+)\s+(.*)$/))
    .filter((m): m is RegExpMatchArray => !!m && m[2]!.includes(needle))
    .map((m) => Number(m[1]));
}
