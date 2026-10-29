/**
 * Load test for the world actor: `bun scripts/perf/load.ts`. Per N (`--n 10,50,100,200`), a fresh real
 * server (`server/src/main.ts`, its own ports and data dir) and N players signed up who connect, `join` and
 * walk as people do: a walk of a few steps a second to a random tile or, one time in four, a door
 * (`--doors`), a pause, a line in the chat now and then (`--chat 0` for none). `--offline` more never come
 * online (the sleeping town every real world carries in state); `--syncers` of those sync usage every 2
 * minutes like the app. Clients run in worker processes, so their decoding isn't what's measured.
 * `--secs` measured after `--warm`; `--direct` skips `proxy.ts`; `--profile` leaves a CPU profile of each
 * server in `--out`. Prints one row per N.
 */
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { createClient as CreateClient } from "rivetkit/client";
import { type GameMap, MAPS } from "../../core/src/maps.ts";
import {
  type Facing,
  mapOf,
  type RoomId,
  route,
  type Snapshot,
  type StepResult,
  stepTarget,
  WALK_STEP_MS,
} from "../../core/src/world.ts";
import type { registry as Registry } from "../../server/src/actors/registry.ts";

// The root has no dependencies of its own: RivetKit's client is the server workspace's.
const { createClient } = (await import(
  Bun.resolveSync("rivetkit/client", join(import.meta.dir, "../../server"))
)) as { createClient: typeof CreateClient };

const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1]! : d;
};
const flag = (k: string) => process.argv.includes(`--${k}`);

// MARK: Coordinator

async function coordinator() {
  // Interrupted: the server and its engine (its own process group) go too.
  for (const sig of ["SIGINT", "SIGTERM"] as const)
    process.on(sig, async () => {
      await Promise.all(running.map((s) => s.stop()));
      process.exit(130);
    });
  const ns = arg("n", "10,50,100,200").split(",").map(Number);
  const secs = Number(arg("secs", "30"));
  const warm = Number(arg("warm", "8"));
  const offline = Number(arg("offline", "200"));
  // Of those, how many have agents running: their app syncs every 2 minutes, as the real one does.
  const syncers = Math.min(offline, Number(arg("syncers", "100")));
  const perWorker = Number(arg("per-worker", "50"));
  const out = arg("out", "perf-results/load");
  const profile = flag("profile");
  const rows: Record<string, string | number>[] = [];
  for (const n of ns) {
    const server = await start(profile ? join(out, `cpu-n${n}`) : null);
    const workers: ReturnType<typeof spawnWorker>[] = [];
    try {
      process.stderr.write(`[load] n=${n}: signing up ${n + offline}...\n`);
      const users = await signUpAll(server.origin, n + offline);
      const tokens = users.slice(0, n).map((u) => u.token);
      // How long everyone takes to connect and join at once: a deploy's reconnect storm, roughly.
      const joining = performance.now();
      for (let i = 0; i < n; i += perWorker)
        workers.push(
          spawnWorker(flag("direct") ? server.engineOrigin : server.origin, tokens.slice(i, i + perWorker)),
        );
      await Promise.all(workers.map((w) => w.line("ready")));
      const joined = (performance.now() - joining) / 1000;
      process.stderr.write(`[load] n=${n}: connected, warming up ${warm}s, measuring ${secs}s\n`);
      await Bun.sleep(warm * 1000);
      for (const w of workers) w.send("go");
      server.perf.length = 0;
      const syncing = sync(server.origin, users.slice(n, n + syncers), secs);
      const samples = await sample(server, secs);
      await syncing;
      for (const w of workers) w.send("stop");
      const stats = (await Promise.all(workers.map((w) => w.line("{")))).map((l) => JSON.parse(l) as Stats);
      rows.push({ ...row(n, secs, samples, server.perf.splice(0), stats), "join s": r1(joined) });
      console.table([rows.at(-1)]);
    } catch (err) {
      console.error(`[load] n=${n} failed: ${String(err)}`);
    } finally {
      for (const w of workers) w.kill();
      await server.stop();
    }
  }
  console.log("\nworld load, per N (server = main.ts process, engine = rivet-engine process)");
  console.table(rows);
}

interface Stats {
  rtt: number[];
  steps: number;
  errors: number;
  reopens: number;
  bytes: number;
  messages: number;
  clients: number;
  events: Record<string, number>;
}

const pct = (xs: number[], p: number) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]!;
};
const r1 = (x: number) => Math.round(x * 10) / 10;

function row(
  n: number,
  secs: number,
  samples: { cpu: number; rss: number; engineCpu: number; engineRss: number; health: number }[],
  perf: { tick: number[]; lag: number[] }[],
  stats: Stats[],
) {
  const rtt = stats.flatMap((s) => s.rtt);
  const sum = (k: "steps" | "errors" | "reopens" | "bytes" | "messages" | "clients") =>
    stats.reduce((a, s) => a + s[k], 0);
  const avg = (k: keyof (typeof samples)[number]) => samples.reduce((a, s) => a + s[k], 0) / samples.length;
  const ticks = perf.flatMap((p) => p.tick);
  const lags = perf.flatMap((p) => p.lag);
  const events: Record<string, number> = {};
  for (const s of stats) for (const [k, v] of Object.entries(s.events)) events[k] = (events[k] ?? 0) + v;
  const top = Object.entries(events)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k, v]) => `${k}:${r1(v / secs / n)}`)
    .join(" ");
  return {
    N: n,
    "cpu%": r1(avg("cpu")),
    rssMB: Math.round(Math.max(...samples.map((s) => s.rss)) / 1024),
    "engCpu%": r1(avg("engineCpu")),
    "steps/s": Math.round(sum("steps") / secs),
    "rtt p50": r1(pct(rtt, 50)),
    "rtt p95": r1(pct(rtt, 95)),
    "rtt p99": r1(pct(rtt, 99)),
    "tick p50": r1(pct(ticks, 50)),
    "tick p99": r1(pct(ticks, 99)),
    "tick max": r1(Math.max(0, ...ticks)),
    "lag p99": r1(pct(lags, 99)),
    // Another actor's call meanwhile: `town` shares the engine's connection to this process.
    "town p50": r1(
      pct(
        samples.map((s) => s.health),
        50,
      ),
    ),
    "town max": r1(Math.max(...samples.map((s) => s.health))),
    "KB/s/cl": r1(sum("bytes") / secs / 1024 / sum("clients")),
    "msg/s/cl": r1(sum("messages") / secs / sum("clients")),
    err: sum("errors"),
    reopen: sum("reopens"),
    "events/s/cl": top,
  };
}

/** Free ports below the ephemeral range, `port + offset` free too (as `server/test/rivet.ts`). */
function freePort(offsets = [0]): number {
  const canListen = (port: number) => {
    try {
      Bun.listen({ hostname: "127.0.0.1", port, socket: { data() {} } }).stop(true);
      return true;
    } catch {
      return false;
    }
  };
  for (;;) {
    const port = 10_000 + Math.floor(Math.random() * 20_000);
    if (offsets.every((o) => canListen(port + o))) return port;
  }
}

const running: { stop(): Promise<void> }[] = [];

async function start(profileDir: string | null) {
  const port = freePort();
  const enginePort = freePort([0, 1, 10]);
  const dir = mkdtempSync(join(tmpdir(), "tokenmaxxing-load-"));
  const storage = join(dir, "rivet");
  if (profileDir) mkdirSync(profileDir, { recursive: true });
  const prof = profileDir ? ["--cpu-prof", "--cpu-prof-md", `--cpu-prof-dir=${profileDir}`] : [];
  // Run from `server/` as `src/main.ts`: a `pkill -f server/src/main.ts` meant for a dev server misses it.
  const server = Bun.spawn(["bun", ...prof, "src/main.ts"], {
    cwd: join(import.meta.dir, "../../server"),
    env: {
      ...process.env,
      PORT: String(port),
      TOKENMAXXING_HOST: "127.0.0.1",
      RIVET_RUN_ENGINE_PORT: String(enginePort),
      RIVETKIT_STORAGE_PATH: storage,
      RIVET_LOG_LEVEL: "error",
      RIVET__GUARD__TCP_NODELAY: "true",
      FIRECRAWL_API_KEY: "",
      ANTHROPIC_API_KEY: "",
      GATEWAY_REQUESTS_PER_MIN: "100000000",
      GATEWAY_SOCKETS_PER_MIN: "100000000",
      // The world's tick timings on stdout, once a second (`world.ts`).
      WORLD_PERF: "1",
    },
    stdout: "pipe",
    stderr: "inherit",
  });
  const perf: { tick: number[]; lag: number[] }[] = [];
  void (async () => {
    for await (const line of lines(server.stdout)) {
      if (line.startsWith("[perf] ")) perf.push(JSON.parse(line.slice(7)));
      else if (flag("verbose")) process.stderr.write(`[server] ${line}\n`);
    }
  })();
  const origin = `http://127.0.0.1:${port}`;
  for (const end = Date.now() + 90_000; ; await Bun.sleep(100)) {
    const ok = await fetch(`${origin}/health`).then(
      (r) => r.ok,
      () => false,
    );
    if (ok) break;
    if (Date.now() > end || server.exitCode !== null) throw new Error("server didn't start");
  }
  const engine = Number(
    Bun.spawnSync(["lsof", "-t", `-iTCP:${enginePort}`, "-sTCP:LISTEN"])
      .stdout.toString()
      .split("\n")[0],
  );
  const handle = {
    origin,
    // `--direct`: the clients skip `proxy.ts` and talk to the engine's gateway themselves.
    engineOrigin: `http://127.0.0.1:${enginePort}`,
    pid: server.pid,
    engine,
    perf,
    async stop() {
      // SIGINT lets Bun write the CPU profile on the way out.
      server.kill(profileDir ? "SIGINT" : "SIGKILL");
      await Promise.race([server.exited, Bun.sleep(15_000)]);
      server.kill("SIGKILL");
      try {
        if (engine) process.kill(engine, "SIGKILL");
      } catch {} // gone already
      rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
      running.splice(running.indexOf(handle), 1);
    },
  };
  running.push(handle);
  return handle;
}

/** CPU time of a process in seconds, and its RSS in KB (`ps`: `[[h:]m:]s.cc`). */
function usage(pid: number): { cpu: number; rss: number } {
  const [time = "0", rss = "0"] = Bun.spawnSync(["ps", "-o", "time=,rss=", "-p", String(pid)])
    .stdout.toString()
    .trim()
    .split(/\s+/);
  const cpu = time.split(/[:-]/).reduce((a, part) => a * 60 + Number(part), 0);
  return { cpu, rss: Number(rss) };
}

/** Once a second: CPU and RSS of both processes, and how long `/health` (a `town` call) takes meanwhile. */
async function sample(server: { pid: number; engine: number; origin: string }, secs: number) {
  const out = [];
  let last = { s: usage(server.pid), e: usage(server.engine), at: performance.now() };
  for (let i = 0; i < secs; i++) {
    const asked = performance.now();
    // A failed or timed-out probe (503 after 5 s) counts as 5 s.
    const health = await fetch(`${server.origin}/health`).then(
      (r) => (r.ok ? performance.now() - asked : 5000),
      () => 5000,
    );
    await Bun.sleep(Math.max(0, 1000 - (performance.now() - asked)));
    const now = { s: usage(server.pid), e: usage(server.engine), at: performance.now() };
    const wall = (now.at - last.at) / 1000;
    out.push({
      cpu: ((now.s.cpu - last.s.cpu) / wall) * 100,
      rss: now.s.rss,
      engineCpu: ((now.e.cpu - last.e.cpu) / wall) * 100,
      engineRss: now.e.rss,
      health,
    });
    last = now;
  }
  return out;
}

async function signUpAll(origin: string, count: number): Promise<{ userId: number; token: string }[]> {
  const out: { userId: number; token: string }[] = [];
  const stamp = Date.now().toString(36).slice(-5);
  let next = 0;
  await Promise.all(
    Array.from({ length: 16 }, async () => {
      while (next < count) {
        const i = next++;
        // One address each: sign-ups are limited per IP.
        const client = createClient<typeof Registry>({
          endpoint: `${origin}/api/rivet`,
          headers: { "x-real-ip": `10.9.${i >> 8}.${i & 255}` },
        });
        const r = await client.town.getOrCreate(["main"]).signUp(`ld${stamp}${i}`);
        out[i] = r;
      }
    }),
  );
  return out;
}

/**
 * Each of `users` syncs a little usage every 2 minutes, spread out, for `secs`: what offline players with
 * agents running cost the world (a sync moves their tokens today and agent count, which `info` carries).
 */
async function sync(origin: string, users: { userId: number; token: string }[], secs: number) {
  const EVERY = 120_000;
  const client = createClient<typeof Registry>({ endpoint: `${origin}/api/rivet` });
  const end = Date.now() + secs * 1000;
  let seq = 0;
  await Promise.all(
    users.map(async (u, i) => {
      for (let at = Date.now() + (i / users.length) * EVERY; at < end; at += EVERY) {
        await Bun.sleep(Math.max(0, at - Date.now()));
        const now = Date.now();
        const player = client.player.get([String(u.userId)], { params: { token: u.token } });
        await player
          .ingest(
            [0, 1].map((k) => ({
              source: "claude_code",
              sessionId: `load-${u.userId}-${k}`,
              agentId: null,
              messageId: `load-${u.userId}-${seq++}`,
              requestId: null,
              timestamp: now - 1000,
              model: "claude-sonnet-4-5",
              messageType: "assistant",
              inputTokens: 20_000,
              outputTokens: 5_000,
              cacheCreationTokens: 0,
              cacheReadTokens: 400_000,
              reasoningTokens: null,
            })),
          )
          .catch((err) => process.stderr.write(`[load] sync ${u.userId}: ${String(err)}\n`));
      }
    }),
  );
}

async function* lines(stream: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  let buf = "";
  for await (const chunk of stream) {
    buf += decoder.decode(chunk, { stream: true });
    for (let i = buf.indexOf("\n"); i >= 0; i = buf.indexOf("\n")) {
      yield buf.slice(0, i);
      buf = buf.slice(i + 1);
    }
  }
}

function spawnWorker(origin: string, tokens: string[]) {
  const pass = [
    ...["doors", "chat"].flatMap((k) => (process.argv.includes(`--${k}`) ? [`--${k}`, arg(k, "")] : [])),
    ...(flag("direct") ? ["--direct"] : []),
  ];
  const proc = Bun.spawn(["bun", import.meta.path, "--worker", "--origin", origin, ...pass], {
    env: { ...process.env, LOAD_TOKENS: JSON.stringify(tokens) },
    stdin: "pipe",
    stdout: "pipe",
    stderr: "inherit",
  });
  const waiting: { prefix: string; resolve: (l: string) => void; reject: (e: Error) => void }[] = [];
  const seen: string[] = [];
  void (async () => {
    for await (const line of lines(proc.stdout)) {
      const w = waiting.findIndex((x) => line.startsWith(x.prefix));
      if (w >= 0) waiting.splice(w, 1)[0]!.resolve(line);
      else seen.push(line);
    }
  })();
  void proc.exited.then((code) => {
    for (const w of waiting.splice(0)) w.reject(new Error(`a load worker exited (${code})`));
  });
  return {
    send: (msg: string) => {
      proc.stdin.write(`${msg}\n`);
      proc.stdin.flush();
    },
    line: (prefix: string) =>
      new Promise<string>((resolve, reject) => {
        const had = seen.findIndex((l) => l.startsWith(prefix));
        if (had >= 0) resolve(seen.splice(had, 1)[0]!);
        else if (proc.exitCode !== null) reject(new Error(`a load worker exited (${proc.exitCode})`));
        else waiting.push({ prefix, resolve, reject });
      }),
    kill: () => proc.kill("SIGKILL"),
  };
}

// MARK: Worker: a few dozen players in one process

async function worker() {
  const origin = arg("origin", "");
  // `--doors 0` keeps everyone in the room they woke in; `--chat 0` keeps them quiet.
  const doors = Number(arg("doors", "0.25"));
  const chat = arg("chat", "1") !== "0";
  const tokens = JSON.parse(process.env.LOAD_TOKENS!) as string[];
  const stats: Stats = {
    rtt: [],
    steps: 0,
    errors: 0,
    reopens: 0,
    bytes: 0,
    messages: 0,
    clients: tokens.length,
    events: {},
  };
  let measuring = false;
  // Every byte the server sends, counted where it arrives.
  const Base = globalThis.WebSocket;
  globalThis.WebSocket = class extends Base {
    constructor(...args: ConstructorParameters<typeof Base>) {
      super(...args);
      this.addEventListener("message", (e) => {
        if (!measuring) return;
        stats.messages++;
        const d = e.data as string | ArrayBuffer | Blob;
        stats.bytes += typeof d === "string" ? d.length : d instanceof Blob ? d.size : d.byteLength;
      });
    }
  } as typeof WebSocket;
  const client = createClient<typeof Registry>(
    flag("direct") ? { endpoint: origin, token: "default" } : { endpoint: `${origin}/api/rivet` },
  );
  const EVENTS = [
    "moves",
    "info",
    "occupancy",
    "snapshot",
    "chat",
    "bubble",
    "houses",
    "jukebox",
    "poker",
    "pokerHole",
    "jump",
  ];
  const players = await Promise.all(
    tokens.map(async (token, i) => {
      await Bun.sleep(i * 20);
      const conn = client.world.getOrCreate(["main"], { params: { token } }).connect();
      for (const e of EVENTS)
        conn.on(e, () => {
          if (measuring) stats.events[e] = (stats.events[e] ?? 0) + 1;
        });
      const me = { room: "inn" as RoomId, x: 0, y: 0, id: 0 };
      const place = (s: Snapshot) => {
        const self = s.players.find((p) => p.id === s.selfId);
        Object.assign(me, { room: s.room, id: s.selfId }, self && { x: self.x, y: self.y });
      };
      conn.on("snapshot", place);
      // A reconnect is a connection the world doesn't know has joined: join again, as the game does.
      let opened = false;
      conn.onOpen(() => {
        if (opened) {
          stats.reopens++;
          conn.join().then(place, () => {});
        }
        opened = true;
      });
      place(await conn.join());
      return { conn, me };
    }),
  );
  console.log("ready");
  let running = true;
  void (async () => {
    for await (const line of console) {
      if (line === "go") {
        Object.assign(stats, { rtt: [], steps: 0, errors: 0, reopens: 0, bytes: 0, messages: 0, events: {} });
        measuring = true;
      }
      if (line === "stop") {
        measuring = false;
        running = false;
        console.log(JSON.stringify(stats));
        process.exit(0);
      }
    }
  })();
  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  const portals = (map: GameMap) =>
    map.rows.flatMap((row, y) =>
      [...row].flatMap((ch, x) =>
        "xIuSG".includes(ch) ? [[x + map.x0, y + map.y0] as [number, number]] : [],
      ),
    );
  const tiles = (map: GameMap) =>
    map.rows.flatMap((row, y) =>
      [...row].flatMap((_, x) =>
        map.walkable(x + map.x0, y + map.y0) ? [[x + map.x0, y + map.y0] as [number, number]] : [],
      ),
    );
  const lines = ["hej", "anyone up?", "shipping it", "coffee?", "my agents are on fire today", "lgtm"];
  await Promise.all(
    players.map(async ({ conn, me }) => {
      let sayAt = Date.now() + rand(5_000, 60_000);
      while (running) {
        await Bun.sleep(rand(500, 3_000));
        const map = mapOf(me.room) ?? MAPS.town;
        // A walk: a door one time in four (changing room), else somewhere in this room.
        const pool = Math.random() < doors ? portals(map) : tiles(map);
        const to = pool[Math.floor(Math.random() * pool.length)];
        const path: Facing[] = (to && route(map, [me.x, me.y], to)) || [];
        for (const dir of path.slice(0, 25)) {
          if (!running) break;
          const t = stepTarget(mapOf(me.room), me.x, me.y, dir);
          if (t.kind === "move") Object.assign(me, { x: t.x, y: t.y });
          const sent = performance.now();
          const done = conn.step(dir).then(
            (r: StepResult) => {
              if (measuring) {
                stats.rtt.push(performance.now() - sent);
                stats.steps++;
              }
              if (r && "room" in r) Object.assign(me, { room: r.room, x: r.x, y: r.y });
              return r;
            },
            () => {
              if (measuring) stats.errors++;
              return null;
            },
          );
          // Through a door the game waits for the server before the next step; else it walks on.
          if (t.kind !== "move") {
            await done;
            break;
          }
          await Bun.sleep(WALK_STEP_MS);
        }
        if (chat && Date.now() > sayAt) {
          sayAt = Date.now() + rand(20_000, 60_000);
          conn.say(lines[Math.floor(Math.random() * lines.length)]).catch(() => {
            if (measuring) stats.errors++;
          });
        }
      }
    }),
  );
}

if (flag("worker")) await worker();
else await coordinator();
