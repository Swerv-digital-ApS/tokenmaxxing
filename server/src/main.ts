import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import pkg from "../../package.json" with { type: "json" };
import { LOGO_DIR, LOGO_FILE } from "./brand.ts";
import { loadConfig } from "./config.ts";
import { stopEngine } from "./engine.ts";
import { type Page, pageHeaders } from "./headers.ts";
import { healthCheck } from "./health.ts";
import { installScript } from "./install.ts";
import { rivetProxy } from "./proxy.ts";
import { diagnose, failureWindow, type ProbeResult, watchdogConfig } from "./watchdog.ts";

// Once startup is done, Bun exits on any unhandled rejection: one missed `.catch` would take the
// whole town down. Log it loudly and keep going. A throw may have stopped synchronous code halfway,
// so that one still exits (and Railway restarts the server).
process.on("unhandledRejection", (err) => console.error("[unhandledRejection]", err));
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
  void stopEngine(undefined, 1_000).finally(() => process.exit(1));
});

const config = loadConfig(process.env, pkg.version);
// RivetKit's native side reads this from the real environment, so it has to be set before
// the process starts (Dockerfile, `bun run dev`); assigning process.env here is too late.
const storage = process.env.RIVETKIT_STORAGE_PATH;
if (!storage && !config.development) throw new Error("set RIVETKIT_STORAGE_PATH to the data volume");

// The game and the admin page are bundled here, before the registry starts: once RivetKit's native
// runtime is up, Bun's HTML bundler fails in this process (and its dev server resolves rivetkit's Node build).
const web = await Bun.build({
  entrypoints: [join(import.meta.dir, "../../web/index.html"), join(import.meta.dir, "../../web/admin.html")],
  target: "browser",
  // The 3D renderer (Three.js) is a dynamic import: its own chunk, fetched only on the 3D tiers.
  splitting: true,
  minify: !config.development,
  sourcemap: config.development ? "inline" : "none",
});
if (!web.success) throw new AggregateError(web.logs, "building the game failed");
const assets = new Map(web.outputs.map((o) => [`/${basename(o.path)}`, o]));

// The marketing site at `/`: static files built by Astro beforehand (`bun run site:build`; the
// Dockerfile does it). Tests and a fresh checkout run without it.
const SITE = join(import.meta.dir, "../../site/dist");
if (!existsSync(SITE) && !config.development) throw new Error("build the site first: bun run site:build");
const site = new Map<string, Bun.BunFile>();
if (existsSync(SITE))
  for (const path of new Bun.Glob("**/*").scanSync(SITE)) site.set(`/${path}`, Bun.file(join(SITE, path)));

const { ENGINE_PORT, ENGINE_TOKEN, registry } = await import("./actors/registry.ts");
const { createClient } = await import("rivetkit/client");
const { pricing, main } = await import("./actors/shared.ts");
const { boardsChanged } = await import("./town/boards.ts");

const refreshPricing = async () => {
  const r = await pricing.refreshFromUpstream();
  // The kept leaderboards show costs at the old prices.
  if (!r.failed) boardsChanged();
  console.log(`[pricing] ${r.failed ? "refresh failed, keeping" : "refreshed"} ${r.updated} models`);
};
void refreshPricing();
setInterval(refreshPricing, 86_400_000);

// Serve only once actors can run, so the healthcheck means the whole thing is up.
registry.start();
await registry.startAndWait();
const proxy = rivetProxy(`127.0.0.1:${ENGINE_PORT}`, ENGINE_TOKEN, config.gateway);
const localClient = createClient<typeof registry>({
  endpoint: `http://127.0.0.1:${ENGINE_PORT}`,
  token: ENGINE_TOKEN,
  // The engine is our own child, already up (`startAndWait`): skip the client's startup metadata
  // lookup (as RivetKit's internal clients do). Under load its 14 retries ran out, and the failure
  // arrived as an uncaughtException that killed the server (and, in tests, every later file).
  disableMetadataLookup: true,
});
const health = healthCheck(() => main(localClient).town.health(), config.version);

// The landing page says how many have signed up: counted once a minute, and written into the page's
// `<!--players-->` as it goes out. Until there's a count (or without a server, in `astro dev`) the
// page hides that line.
const landing = await site.get("/index.html")?.text();
let players: number | null = null;
const countPlayers = async () => {
  players = await main(localClient)
    .town.playerCount()
    .catch(() => players);
};
void countPlayers();
setInterval(countPlayers, 60_000);

// If the engine dies, every actor stops but this process stays up, so Railway never restarts it.
// Probe an actor now and then: when probes keep failing, exit. A busy machine is slow, not dead, so
// a probe gets a long timeout and several must fail in a row over a window (watchdog.ts has the
// HEALTH_* settings). Every failure is logged with what failed, how long it took and how late the
// event loop was, so an exit can be told apart from a laptop under load.
const dog = watchdogConfig(process.env);
const failing = failureWindow(dog);
let lastProbe: ProbeResult = { ok: true, ms: 0, reason: "ok" };
const watchdogProbe = healthCheck(
  () => main(localClient).town.health(),
  config.version,
  dog.timeoutMs,
  (r) => {
    lastProbe = r;
  },
);
// How far behind its schedule a 1 s timer fires: the event loop's lag, the worst since the last probe.
let loopLag = 0;
let lastRecovered = 0;
let tickAt = performance.now();
setInterval(() => {
  const now = performance.now();
  loopLag = Math.max(loopLag, now - tickAt - 1_000);
  tickAt = now;
}, 1_000);
let probing = false;
setInterval(async () => {
  if (probing) return;
  probing = true;
  const lag = loopLag;
  loopLag = 0;
  const ok = (await watchdogProbe()).ok;
  probing = false;
  const exit = failing.record(ok, Date.now());
  if (!ok)
    console.error(`[tokenmaxxing] health ${failing.streak}/${dog.failures}: ${diagnose(lastProbe, lag)}`);
  else if (lastRecovered)
    console.log(`[tokenmaxxing] health recovered after ${lastRecovered} failed probes (${lastProbe.ms} ms)`);
  lastRecovered = failing.streak;
  if (!exit) return;
  console.error(
    `[tokenmaxxing] unhealthy: ${dog.failures} probes failed over ${Math.round(dog.windowMs / 1000)}+ s, exiting`,
  );
  await shutdown(1);
}, dog.intervalMs);

// One way out for every exit: drain the actors, then stop the engine child (it would otherwise be
// left running, orphaned, with its port and data dir), so the next start comes up clean.
let leaving = false;
async function shutdown(code: number) {
  if (leaving) return;
  leaving = true;
  // A drain that hangs (the case this exit is for) can't keep the process alive.
  const force = setTimeout(() => process.exit(code), 8_000);
  await registry.shutdown().catch(() => {});
  await stopEngine(ENGINE_PORT).catch(() => {});
  clearTimeout(force);
  process.exit(code);
}
process.on("SIGTERM", () => void shutdown(0));
process.on("SIGINT", () => void shutdown(0));

const headersFor = (page: Page, req: Request, extra: Record<string, string>) => ({
  ...pageHeaders(page, new URL(req.url).host, !config.development),
  ...extra,
});
const html = (file: Bun.BuildArtifact | undefined, page: Page) => (req: Request) =>
  new Response(file, { headers: headersFor(page, req, { "cache-control": "no-cache" }) });

const server = Bun.serve({
  port: config.port,
  hostname: config.host,
  routes: {
    "/play": html(assets.get("/index.html"), "game"),
    // Useless without ADMIN_TOKEN: every action it calls checks it (`town`'s admin actions).
    "/admin": html(assets.get("/admin.html"), "admin"),
    "/health": health,
    "/install.sh": installScript,
    // Company logos, copied from their websites. Sandboxed: an SVG is someone else's markup.
    "/logos/:file": async (req) => {
      const file = Bun.file(join(LOGO_DIR, req.params.file));
      if (!LOGO_FILE.test(req.params.file) || !(await file.exists()))
        return new Response("Not found", { status: 404 });
      return new Response(file, {
        headers: {
          "cache-control": "public, max-age=86400",
          "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
          "x-content-type-options": "nosniff",
        },
      });
    },
  },
  fetch(req, server) {
    const path = new URL(req.url).pathname;
    // The pages themselves only at /play and /admin, with their headers.
    const asset = path.endsWith(".html") ? undefined : assets.get(path);
    if (asset)
      return new Response(asset, { headers: { "cache-control": "public, max-age=31536000, immutable" } });
    const file = path.endsWith("/") ? `${path}index.html` : path;
    if (file === "/index.html" && landing)
      return new Response(
        players === null ? landing : landing.replace("<!--players-->", players.toLocaleString("en-US")),
        {
          headers: headersFor("site", req, {
            "cache-control": "no-cache",
            "content-type": "text/html;charset=utf-8",
          }),
        },
      );
    const page = site.get(file);
    if (page)
      return new Response(page, {
        headers: headersFor("site", req, {
          "cache-control": path.startsWith("/_astro/") ? "public, max-age=31536000, immutable" : "no-cache",
        }),
      });
    return proxy.fetch(req, server);
  },
  websocket: proxy.websocket,
});

console.log(
  `[tokenmaxxing] v${config.version} listening on ${server.url} (data: ${storage ?? "~/.rivetkit"})`,
);
