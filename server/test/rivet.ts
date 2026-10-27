/**
 * One real server per test process: `main.ts` in a subprocess with a throwaway data dir and free
 * ports, so the proxy, the engine and every actor are the production code paths. `bun test` runs
 * every file in one process and so one server; `--parallel` runs each file in its own, with its own.
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dayStart } from "@tokenmaxxing/core/raid.ts";
import { dayKey } from "@tokenmaxxing/core/range.ts";
import type { TokenEvent } from "@tokenmaxxing/core/types.ts";
import { createClient } from "rivetkit/client";
import type { registry as Registry } from "../src/actors/registry.ts";
import { afterEveryTest, atExit } from "./cleanup.ts";

export { eventually } from "./eventually.ts";

/** The admin page's token on the test server. */
export const ADMIN_TOKEN = "test-admin-token-0123456789abcdef";

/** Bearer token for the `swerv` organization feed on the test server. */
export const ORG_FEED_TOKEN = "test-org-feed-secret-0123456789abcd";

const canListen = (port: number) => {
  try {
    Bun.listen({ hostname: "127.0.0.1", port, socket: { data() {} } }).stop(true);
    return true;
  } catch {
    return false;
  }
};

/**
 * A port free right now, `port + offset` too for each offset. Below the ephemeral ranges (Linux
 * from 32768, macOS from 49152), so an outgoing connection can't take it before the server does.
 */
function freePort(offsets = [0]): number {
  for (;;) {
    const port = 10_000 + Math.floor(Math.random() * 20_000);
    if (offsets.every((o) => canListen(port + o))) return port;
  }
}

/**
 * The engine RivetKit started for `storage`: it's left running on purpose (it would outlive the
 * server), in its own process group. Found by its data dir, so never another run's engine.
 */
function enginePid(storage: string, enginePort: number): number | null {
  if (process.platform === "linux") {
    for (const pid of readdirSync("/proc")) {
      if (!/^\d+$/.test(pid)) continue;
      try {
        const env = `\0${readFileSync(`/proc/${pid}/environ`, "utf8")}`;
        if (
          env.includes(`\0RIVETKIT_STORAGE_PATH=${storage}\0`) &&
          readFileSync(`/proc/${pid}/cmdline`, "utf8").includes("rivet-engine")
        )
          return Number(pid);
      } catch {} // gone, or someone else's
    }
    return null;
  }
  const out = Bun.spawnSync(["lsof", "-t", `-iTCP:${enginePort}`, "-sTCP:LISTEN"]).stdout.toString();
  return Number(out.split("\n")[0]) || null;
}

/** Sends `signal`; false if the process is gone. Signal 0 only asks whether it's there. */
const send = (pid: number, signal: NodeJS.Signals | 0) => {
  try {
    process.kill(pid, signal);
    return true;
  } catch {
    return false;
  }
};

async function healthy(origin: string, ms: number): Promise<boolean> {
  for (const end = Date.now() + ms; Date.now() < end; await Bun.sleep(50)) {
    const ok = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(5_000) }).then(
      (r) => r.ok,
      () => false,
    );
    if (ok) return true;
  }
  return false;
}

const output = (path: string) =>
  Bun.file(path)
    .text()
    .catch(() => "");

/** Starts the server; another try on fresh ports if it dies first (a port taken in the meantime, or a machine too busy for the engine to come up). */
async function start(attempts = 5): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    const port = freePort();
    // RivetKit puts the engine's peer API on +1 and its metrics on +10.
    const enginePort = freePort([0, 1, 10]);
    const dir = mkdtempSync(join(tmpdir(), "tokenmaxxing-test-"));
    const storage = join(dir, "rivet");
    const log = join(dir, "server.log");
    const server = Bun.spawn(["bun", join(import.meta.dir, "../src/main.ts")], {
      env: {
        ...process.env,
        PORT: String(port),
        TOKENMAXXING_HOST: "127.0.0.1",
        RIVET_RUN_ENGINE_PORT: String(enginePort),
        RIVETKIT_STORAGE_PATH: storage,
        RIVET_LOG_LEVEL: "error",
        // Answers each actor call ~40 ms sooner (no wait on a delayed ACK); as in the Dockerfile.
        RIVET__GUARD__TCP_NODELAY: "true",
        // No GitHub reads from tests: the star counter stays blank.
        GITHUB_STARS: "off",
        // Company websites stay on the sign; no scraping or Claude calls from tests.
        FIRECRAWL_API_KEY: "",
        ANTHROPIC_API_KEY: "",
        // Green hours pay coins: the live grid would move balances the tests count.
        GRID_FEED: "off",
        ADMIN_TOKEN,
        ORG_FEED_SECRETS: `swerv:${ORG_FEED_TOKEN}`,
        // Most tests buy from wherever they stand; the shop rule is tested with `strictShops`.
        SHOPS_ANYWHERE: "1",
        // Every test comes from 127.0.0.1; `signUp` below poses as a new address each time instead.
        GATEWAY_REQUESTS_PER_MIN: "1000000",
        GATEWAY_SOCKETS_PER_MIN: "1000000",
      },
      stdout: Bun.file(log),
      stderr: Bun.file(`${log}.err`),
    });
    // The engine is its own process and outlives the server, so both go, then their data.
    const stop = async () => {
      server.kill("SIGKILL");
      await server.exited;
      const engine = enginePid(storage, enginePort);
      if (engine) send(engine, "SIGKILL");
      for (let i = 0; i < 50 && engine && send(engine, 0); i++) await Bun.sleep(20);
      rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    };
    const origin = `http://127.0.0.1:${port}`;
    const up = await Promise.race([healthy(origin, 60_000), server.exited.then(() => false)]);
    if (up) {
      atExit.push(stop);
      return origin;
    }
    const why = (await output(log)) + (await output(`${log}.err`));
    await stop();
    // On a saturated machine the engine can miss RivetKit's startup health check; if every file
    // fails at import, nothing after it runs. Give it room: a pause, then fresh ports.
    if (attempt >= attempts) throw new Error(`test server didn't start:\n${why.slice(-2_000)}`);
    await Bun.sleep(attempt * 2_000);
  }
}

export const origin = await start();

export const client = createClient<typeof Registry>({ endpoint: `${origin}/api/rivet` });

/** A client that comes from `ip`, as Railway's edge would say (`x-real-ip`): sign-ups are limited per IP. */
export const from = (ip: string) =>
  createClient<typeof Registry>({ endpoint: `${origin}/api/rivet`, headers: { "x-real-ip": ip } });

let n = 0;
/** Tokens of users signed up during the current test. */
const fresh: string[] = [];

/** A fresh user; names are unique per run since `town` is shared by every test. */
export async function signUp(prefix = "u") {
  const name = `${prefix}${Date.now().toString(36)}${n++}`;
  const r = await from(`10.1.${Math.floor(n / 250)}.${n % 250}`)
    .town.getOrCreate(["main"])
    .signUp(name);
  fresh.push(r.token);
  return { ...r, town: client.town.getOrCreate(["main"], { params: { token: r.token } }) };
}

type User = Awaited<ReturnType<typeof signUp>>;

/** `member` applies to `owner`'s company and `owner` lets them in. */
export async function admit(owner: User, member: User, companyId: number) {
  await member.town.apply(companyId);
  return owner.town.approve(member.userId);
}

// Every test shares the town: after each test its users leave their companies, which closes them,
// so the town doesn't keep growing.
afterEveryTest.push(async () => {
  const tokens = fresh.splice(0);
  await Promise.all(
    tokens.map(
      (token) =>
        client.town
          .getOrCreate(["main"], { params: { token } })
          .leaveCompany()
          .catch(() => {}), // signed out during the test
    ),
  );
});

/** `town` as the admin page calls it. */
export const admin = () => client.town.getOrCreate(["main"], { params: { admin: ADMIN_TOKEN } });

export const as = (token: string) => ({
  town: client.town.getOrCreate(["main"], { params: { token } }),
  world: client.world.getOrCreate(["main"], { params: { token } }),
  player: (userId: number) => client.player.get([String(userId)], { params: { token } }),
  arcade: client.arcade.getOrCreate(["main"], { params: { token } }),
  match: (id: number) => client.match.get([String(id)], { params: { token } }),
});

/** A fresh user with `coins` coins, given from the admin page (real usage that big would be capped). */
export async function rich(prefix = "rich", coins = 100) {
  const u = await signUp(prefix);
  await admin().adminSetCoins(u.userId, coins);
  return { ...u, ...as(u.token) };
}

/**
 * What today's daily quests have paid a player: each tier's draw is seeded by the date, so on some days
 * one of them (Warm up: use N tokens) is done by the usage a test ingests, and a wallet is a coin or
 * more over what the usage alone earns. Tests of what usage pays take this off.
 */
export const questCoins = (w: { quests: readonly { done: boolean; coins: number }[] }): number =>
  w.quests.reduce((n, q) => n + (q.done ? q.coins : 0), 0);

export const MIN = 60_000;
export const HOUR = 60 * MIN;
let seq = 0;

/** An hour ago, but never on yesterday: just after midnight in the world, today's boards would miss it. */
const anHourAgoToday = () => Math.max(Date.now() - HOUR, dayStart(dayKey(Date.now())));

/**
 * Lifetime tokens past level 10 (`OFFICE_LEVEL`): ~50B over 250 minutes, each just under the
 * per-minute cap, on a day from before signing up so it pays no coins.
 */
export async function veteran(u: { token: string; userId: number }) {
  const start = Date.UTC(2024, 0, 10, 12);
  await as(u.token)
    .player(u.userId)
    .ingest(Array.from({ length: 250 }, (_, i) => event({ inputTokens: 199e6, timestamp: start + i * MIN })));
}

export function event(overrides: Partial<TokenEvent> = {}): TokenEvent {
  seq++;
  return {
    source: "claude_code",
    sessionId: "s1",
    agentId: null,
    messageId: `m${seq}`,
    requestId: null,
    timestamp: anHourAgoToday(),
    model: "claude-haiku-4-5-20251001",
    messageType: "assistant",
    inputTokens: 100,
    outputTokens: 50,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    reasoningTokens: null,
    ...overrides,
  };
}

/** One assistant event every 5 minutes from `start` for `durationMs`. */
export function activity(
  sessionId: string,
  start: number,
  durationMs: number,
  agentId: string | null = null,
) {
  const out: TokenEvent[] = [];
  for (let t = start; t < start + durationMs; t += 5 * MIN)
    out.push(event({ sessionId, agentId, timestamp: t }));
  return out;
}
