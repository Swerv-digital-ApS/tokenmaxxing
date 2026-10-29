// bun scripts/perf/game.mjs [--tiers medium,high,ultra] [--walkers 40] [--ms 6000] [--throttle 4] [--profile] [--alloc] [--nodes] [--heap] [--gpu] [--warmup 8000] [--out file.json]
// The real game (/play), not the demo: starts its own server (or uses QA_ORIGIN), signs up `walkers` players who connect to
// `world` and wander the town over the wire, and opens one observer per tier in headless Chromium with no fps cap. Records
// the 3D renderer's own CPU time per frame (`__r3d.frame`), rAF frame gaps, long tasks, draw calls, triangles, JS heap, and
// with --profile the top self-time functions, with --heap the heap by constructor. Times compare runs on one machine only.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const has = (k) => process.argv.includes(`--${k}`);
const tiers = arg("tiers", "medium,high,ultra").split(",");
const walkers = Number(arg("walkers", "40"));
const ms = Number(arg("ms", "6000"));
const warmup = Number(arg("warmup", "8000"));
const out = arg("out", null);
const port = Number(process.env.PERF_PORT ?? 4691);

let server = null;
if (!process.env.QA_ORIGIN) {
  process.env.QA_ORIGIN = `http://localhost:${port}`;
  server = spawn("bun", ["server/src/main.ts"], {
    env: {
      // The minified bundle and React's production build, as players get them (needs `bun run site:build` once).
      NODE_ENV: process.env.NODE_ENV ?? "production",
      ...process.env,
      PORT: String(port),
      RIVET_RUN_ENGINE_PORT: String(port + 10000),
      RIVETKIT_STORAGE_PATH: mkdtempSync(join(tmpdir(), "tm-perf-")),
      RIVET_LOG_LEVEL: "error",
      RIVET__GUARD__TCP_NODELAY: "true",
      GATEWAY_REQUESTS_PER_MIN: "10000000",
      GATEWAY_SOCKETS_PER_MIN: "10000000",
    },
    stdio: ["ignore", "inherit", "inherit"],
    // Its own process group: the Rivet engine it starts goes with it (see `stop`).
    detached: true,
  });
  for (let i = 0; ; i++) {
    const ok = await fetch(`${process.env.QA_ORIGIN}/health`).then(
      (r) => r.ok,
      () => false,
    );
    if (ok) break;
    if (i > 120) throw new Error("server did not start");
    await new Promise((r) => setTimeout(r, 500));
  }
}
const stop = () => {
  if (server?.exitCode === null) process.kill(-server.pid, "SIGTERM");
};
process.on("exit", stop);

const { openGame, playwright, ready, signUp, through, ORIGIN } = await import("../qa/lib.mjs");
const { mapOf, portal, route, stepTarget } = await import("../../core/src/world.ts");
const { createClient } = await import(
  Bun.resolveSync("rivetkit/client", new URL("../../server/", import.meta.url).pathname)
);
const pct = (a, p) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const r1 = (n) => Math.round(n * 100) / 100;

// The crowd: real players on the wire. Each walks out of where they wake up into the town, then wanders it: a step every
// 250-600 ms, mostly straight on (a held key), never back through a door.
const DIRS = ["up", "down", "left", "right"];
/** A door of `room` that leads to the town. */
const doorToTown = (room) => {
  const m = mapOf(room);
  for (let y = m.y0; y < m.y0 + m.height; y++)
    for (let x = m.x0; x < m.x0 + m.width; x++)
      if (m.kind(x, y).portal && portal(room, { ch: m.at(x, y), x, y }, null, new Map()).room === "town")
        return [x, y];
  return null;
};
const crowd = [];
for (let i = 0; i < walkers; i++) {
  const u = await signUp("w", 40_000);
  const c = createClient({
    endpoint: `${ORIGIN}/api/rivet`,
    headers: { "x-real-ip": `10.8.${i >> 8}.${i & 255}` },
  });
  const conn = c.world.getOrCreate(["main"], { params: { token: u.token } }).connect();
  const me = { room: "", x: 0, y: 0 };
  const seen = (s) => {
    const p = s.players.find((q) => q.id === s.selfId);
    me.room = s.room;
    if (p) Object.assign(me, { x: p.x, y: p.y });
  };
  conn.on("snapshot", seen);
  seen(await conn.join());
  crowd.push({ conn, me });
}
let walking = true;
const step = async ({ conn, me }, dir) => {
  const r = await conn.step(dir).catch(() => null);
  if (r && "x" in r) return Object.assign(me, { room: r.room, x: r.x, y: r.y });
  const t = stepTarget(mapOf(me.room), me.x, me.y, dir);
  if (!r && t.kind === "move") Object.assign(me, { x: t.x, y: t.y });
};
const pause = (a, b) => new Promise((r) => setTimeout(r, a + Math.random() * (b - a)));
const walk = async (w) => {
  for (let tries = 0; w.me.room !== "town" && tries < 5 && walking; tries++) {
    const door = doorToTown(w.me.room);
    const path = door && route(mapOf(w.me.room), [w.me.x, w.me.y], door);
    for (const d of path ?? []) {
      await step(w, d);
      await pause(120, 160);
    }
    await pause(800, 1200);
  }
  let dir = DIRS[Math.floor(Math.random() * 4)];
  while (walking) {
    if (Math.random() < 0.2) dir = DIRS[Math.floor(Math.random() * 4)];
    const t = stepTarget(mapOf(w.me.room), w.me.x, w.me.y, dir);
    if (t.kind === "portal" || t.kind === "blocked") dir = DIRS[Math.floor(Math.random() * 4)];
    else await step(w, dir);
    await pause(250, 600);
  }
};
const walks = crowd.map(walk);

const pw = await playwright();
const browser = await pw.chromium.launch({
  headless: true,
  args: [
    "--use-angle=metal",
    "--ignore-gpu-blocklist",
    "--disable-frame-rate-limit",
    "--disable-gpu-vsync",
    "--enable-precise-memory-info",
    "--js-flags=--expose-gc",
  ],
});
const results = [];
for (const tier of tiers) {
  const user = await signUp("obs", 40_000);
  const page = await openGame(browser, user, tier, {
    extra: (ctx) =>
      ctx.addInitScript(() => {
        const g = JSON.parse(localStorage.getItem("tokenmaxxing.graphics"));
        g.overrides = { fpsCap: 0 };
        localStorage.setItem("tokenmaxxing.graphics", JSON.stringify(g));
        // Input now and then, or the game drops to its idle 30 fps.
        setInterval(() => window.dispatchEvent(new PointerEvent("pointermove")), 2000);
      }),
  });
  await ready(page);
  const start = await page.evaluate(() => window.__tm.world.room);
  const door = start === "town" ? null : doorToTown(start);
  if (door) await through(page, door[0], door[1]);
  await page.waitForFunction(() => window.__r3d?.stats.frames > 30, null, { timeout: 60_000 });
  if (tiers.indexOf(tier) === 0) await page.waitForTimeout(8000); // the crowd walks out into the town
  await page.waitForFunction(
    () => {
      const r = window.__r3d;
      return r && !r.warming && !r.reveal;
    },
    null,
    { timeout: 60_000 },
  );
  await page.waitForTimeout(warmup);
  await page.evaluate((gpuTimers) => {
    window.gc?.();
    const r = window.__r3d;
    const rec = { cpu: [], gaps: [], draws: [], tris: [], long: 0, longMs: 0, started: performance.now() };
    window.__rec = rec;
    const frame = r.frame.bind(r);
    const gl = r.pipe.renderer.getContext();
    const ext = gpuTimers ? gl.getExtension("EXT_disjoint_timer_query_webgl2") : null;
    const queries = [];
    rec.gpuMs = ext ? [] : null;
    r.frame = (now) => {
      const disjoint = ext && gl.getParameter(ext.GPU_DISJOINT_EXT);
      if (disjoint) {
        for (const query of queries.splice(0)) gl.deleteQuery(query);
      }
      while (queries.length && gl.getQueryParameter(queries[0], gl.QUERY_RESULT_AVAILABLE)) {
        const query = queries.shift();
        if (!disjoint && !rec.done) rec.gpuMs.push(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6);
        gl.deleteQuery(query);
      }
      const query = ext && !rec.done && !disjoint && queries.length < 8 ? gl.createQuery() : null;
      if (query) gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
      const t0 = performance.now();
      frame(now);
      if (query) {
        gl.endQuery(ext.TIME_ELAPSED_EXT);
        queries.push(query);
      }
      if (rec.done) {
        for (const pending of queries.splice(0)) gl.deleteQuery(pending);
        return;
      }
      rec.cpu.push(performance.now() - t0);
      const info = r.pipe.renderer.info.render;
      rec.draws.push(info.calls);
      rec.tris.push(info.triangles);
    };
    let last = 0;
    const raf = (t) => {
      if (last) rec.gaps.push(t - last);
      last = t;
      if (!rec.done) requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        rec.long++;
        rec.longMs += e.duration;
      }
    }).observe({ type: "longtask" });
  }, has("gpu"));
  const cdp = await page.context().newCDPSession(page);
  // A slower CPU, as a stand-in for a weak laptop: the frame's JS cost is what scales.
  if (arg("throttle", null))
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(arg("throttle")) });
  if (has("alloc")) {
    await cdp.send("HeapProfiler.enable");
    await cdp.send("HeapProfiler.startSampling", {
      samplingInterval: 4096,
      includeObjectsCollectedByMajorGC: true,
      includeObjectsCollectedByMinorGC: true,
    });
  }
  if (has("profile")) {
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
    await cdp.send("Profiler.start");
  }
  await page.waitForTimeout(ms);
  const rec = await page.evaluate(() => {
    window.__rec.done = true;
    return {
      ...window.__rec,
      duration: performance.now() - window.__rec.started,
      gpu: (() => {
        const gl = window.__r3d.pipe.renderer.getContext();
        const ext = gl.getExtension("WEBGL_debug_renderer_info");
        return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      })(),
      targets: (() => {
        const pipe = window.__r3d.pipe;
        const target = pipe.vox ?? pipe.color;
        return target ? { width: target.width, height: target.height } : null;
      })(),
      preparation: { ...window.__r3d.stats },
      heap: performance.memory.usedJSHeapSize,
      avatars: window.__tm.world.avatars.size,
      room: window.__tm.world.room,
      labels: document.querySelectorAll("#labels3d *").length,
    };
  });
  const row = {
    tier,
    walkers,
    room: rec.room,
    avatars: rec.avatars,
    frames: rec.cpu.length,
    fps: r1((rec.cpu.length * 1000) / rec.duration),
    rafFps: r1((rec.gaps.length * 1000) / rec.duration),
    warmupMs: warmup,
    gpu: rec.gpu,
    targets: rec.targets,
    preparation: rec.preparation,
    gpuMs: rec.gpuMs?.length
      ? { samples: rec.gpuMs.length, p50: r1(pct(rec.gpuMs, 0.5)), p95: r1(pct(rec.gpuMs, 0.95)) }
      : null,
    cpu: { p50: r1(pct(rec.cpu, 0.5)), p95: r1(pct(rec.cpu, 0.95)), p99: r1(pct(rec.cpu, 0.99)) },
    frame: { p50: r1(pct(rec.gaps, 0.5)), p95: r1(pct(rec.gaps, 0.95)), p99: r1(pct(rec.gaps, 0.99)) },
    long: rec.long,
    longMs: Math.round(rec.longMs),
    draws: pct(rec.draws, 0.5),
    tris: pct(rec.tris, 0.5),
    heapMB: r1(rec.heap / 1048576),
    domLabels: rec.labels,
  };
  results.push(row);
  console.log(
    `${tier.padEnd(7)} ${rec.room} people ${rec.avatars}  fps ${row.fps}  cpu p50 ${row.cpu.p50} p95 ${row.cpu.p95} p99 ${row.cpu.p99}  frame p50 ${row.frame.p50} p95 ${row.frame.p95} p99 ${row.frame.p99}  long ${row.long}/${row.longMs}ms  draws ${row.draws}  tris ${row.tris}  heap ${row.heapMB}MB  dom ${row.domLabels}`,
  );
  if (has("profile")) {
    const { profile } = await cdp.send("Profiler.stop");
    const self = new Map();
    const byId = new Map(profile.nodes.map((n) => [n.id, n]));
    profile.samples.forEach((id, i) => {
      const f = byId.get(id).callFrame;
      const k = `${f.functionName || "(anon)"} ${f.url.split("/").slice(-1)[0].split("?")[0]}:${f.lineNumber}`;
      self.set(k, (self.get(k) ?? 0) + (profile.timeDeltas[i] ?? 0));
    });
    const total = [...self.values()].reduce((a, b) => a + b, 0);
    for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, Number(process.env.TOP ?? 30)))
      console.log(
        `  ${((v / total) * 100).toFixed(1).padStart(5)}%  ${(v / 1000).toFixed(0).padStart(6)}ms  ${k}`,
      );
  }
  if (has("alloc")) {
    // Garbage per second by the function that allocated it (STACK=1 for a few callers up).
    const { profile } = await cdp.send("HeapProfiler.stopSampling");
    const total = new Map();
    let sum = 0;
    const walk = (n, stack) => {
      const name = n.callFrame.functionName || "(anon)";
      const up = [name, ...stack].slice(0, Number(process.env.DEPTH ?? 4));
      if (n.selfSize) {
        const k = process.env.STACK
          ? up.join(" < ")
          : `${name} ${n.callFrame.url.split("/").pop().split("?")[0]}:${n.callFrame.lineNumber + 1}`;
        total.set(k, (total.get(k) ?? 0) + n.selfSize);
        sum += n.selfSize;
      }
      for (const c of n.children) walk(c, up);
    };
    walk(profile.head, []);
    console.log(`  allocated ${(sum / 1048576 / (ms / 1000)).toFixed(2)} MB/s`);
    for (const [k, v] of [...total].sort((a, b) => b[1] - a[1]).slice(0, Number(process.env.TOP ?? 20)))
      console.log(`  ${(v / 1024 / (ms / 1000)).toFixed(0).padStart(7)} KB/s  ${k}`);
  }
  if (has("nodes")) {
    // What the renderer's walks visit each frame, per subtree of the scene: visible nodes (projectObject), nodes whose
    // world matrix is recomputed (updateMatrixWorld), and visible meshes.
    const tree = await page.evaluate(() => {
      const scene = window.__r3d.stage.scene;
      const out = {};
      const name = (o) => o.name || o.type;
      const walk = (o, key, depth) => {
        const k = depth <= 2 ? `${key}/${name(o)}` : key;
        out[k] ??= { visible: 0, matrix: 0, meshes: 0 };
        const e = out[k];
        if (o.matrixWorldAutoUpdate !== false) e.matrix++;
        if (!o.visible) return;
        e.visible++;
        if (o.isMesh || o.isLine || o.isPoints || o.isSprite) e.meshes++;
        for (const c of o.children) walk(c, k, depth + 1);
      };
      walk(scene, "", 0);
      return out;
    });
    const rows = Object.entries(tree).sort((a, b) => b[1].visible - a[1].visible);
    const sum = (f) => rows.reduce((a, [, e]) => a + e[f], 0);
    console.log(
      `  nodes: visible ${sum("visible")}, matrix ${sum("matrix")}, visible meshes ${sum("meshes")}`,
    );
    for (const [k, e] of rows.slice(0, 25))
      console.log(
        `  ${String(e.visible).padStart(6)} ${String(e.matrix).padStart(6)} ${String(e.meshes).padStart(6)}  ${k}`,
      );
  }
  if (has("heap")) {
    const file = join(tmpdir(), `tm-${tier}.heapsnapshot`);
    const heap = await page.context().newCDPSession(page);
    const chunks = [];
    heap.on("HeapProfiler.addHeapSnapshotChunk", (e) => chunks.push(e.chunk));
    await page.evaluate(() => window.gc?.());
    await heap.send("HeapProfiler.takeHeapSnapshot", { reportProgress: false });
    writeFileSync(file, chunks.join(""));
    console.log(`  heap snapshot: ${file} (open it in Chrome DevTools' Memory tab)`);
  }
  if (page.errors.length) console.log("  errors:", page.errors.slice(0, 5));
  await page.context().close();
}
walking = false;
await Promise.all(walks);
await browser.close();
if (out) writeFileSync(out, JSON.stringify(results, null, 2));
stop();
process.exit(0);
