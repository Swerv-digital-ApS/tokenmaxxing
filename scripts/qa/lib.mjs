// Shared bits for the QA scripts: sign a throwaway player up on a running local server and open the real game
// as them in headless Chromium. Needs Playwright (PLAYWRIGHT=/path/to/playwright/index.mjs) and a server
// (`bun run dev`, or GATEWAY_REQUESTS_PER_MIN=1000000 GATEWAY_SOCKETS_PER_MIN=1000000 PORT=4663 RIVET_RUN_ENGINE_PORT=14663 RIVETKIT_STORAGE_PATH=/tmp/x bun server/src/main.ts).
const { createClient } = await import(
  Bun.resolveSync("rivetkit/client", new URL("../../server/", import.meta.url).pathname)
);

export const ORIGIN = process.env.QA_ORIGIN ?? "http://localhost:4663";
let n = 0;
/** Sign-ups are limited per IP (x-real-ip, as the edge sets it): each one poses as a new address. */
const from = (ip) => createClient({ endpoint: `${ORIGIN}/api/rivet`, headers: { "x-real-ip": ip } });
const client = from("10.9.9.9");

/** A new player with a few turns of usage, so there is something to spend. */
/**
 * `company`: also starts a company (a house, a common room) and, with `perTurn` around 8M, enough usage for the
 * level the Office needs. `agoMin`: the usage stopped that many minutes ago (past 10 it does not count as working).
 */
export async function signUp(prefix = "qa", perTurn = 40_000, company = false, agoMin = 0) {
  const name = `${prefix}${Date.now().toString(36).slice(-4)}${n++}`;
  const u = await from(`10.7.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`)
    .town.getOrCreate(["main"])
    .signUp(name);
  const now = Date.now();
  const events = [];
  for (let t = now - (60 + agoMin) * 60_000; t < now - agoMin * 60_000; t += 60_000)
    events.push({
      source: "claude_code",
      sessionId: `${name}-s`,
      agentId: null,
      messageId: `${name}-${t}`,
      requestId: null,
      timestamp: t,
      model: "claude-sonnet-4-5",
      messageType: "assistant",
      inputTokens: perTurn,
      outputTokens: perTurn / 4,
      cacheCreationTokens: 0,
      cacheReadTokens: perTurn * 20,
      reasoningTokens: null,
    });
  await client.player.get([String(u.userId)], { params: { token: u.token } }).ingest(events);
  if (company)
    await client.town.getOrCreate(["main"], { params: { token: u.token } }).createCompany(`Co ${name}`);
  return u;
}

export async function playwright() {
  return import(
    process.env.PLAYWRIGHT ?? "/Users/nicholaserlin/Desktop/YeetBudget/node_modules/playwright/index.mjs"
  );
}

export const graphicsKey = (choice, overrides = {}) =>
  JSON.stringify({ v: 1, choice, overrides, meter: true, detected: null });

/**
 * Opens the game as `user` on `choice` ("low" | "medium" | "high" | "auto"). Console errors and page errors
 * are collected on `page.errors`.
 */
export async function openGame(
  browser,
  user,
  choice,
  { viewport = { width: 1280, height: 800 }, dpr = 1, touch = false, extra } = {},
) {
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: dpr,
    hasTouch: touch,
    isMobile: touch,
  });
  await ctx.addInitScript(
    ([token, g]) => {
      localStorage.setItem("tokenmaxxing.session", token);
      localStorage.setItem("tokenmaxxing.qa", "1");
      if (!localStorage.getItem("tokenmaxxing.graphics")) localStorage.setItem("tokenmaxxing.graphics", g);
    },
    [user.token, graphicsKey(choice)],
  );
  const page = await ctx.newPage();
  page.errors = [];
  page.on("console", (m) => m.type() === "error" && page.errors.push(`console: ${m.text()}`));
  page.on("pageerror", (e) => page.errors.push(`pageerror: ${e.message}`));
  if (extra) await extra(ctx, page);
  await page.goto(`${ORIGIN}/play`);
  return page;
}

/** Waits for the world to be there (signed in, a snapshot in), and shuts the first-run company picker. */
export async function ready(page) {
  await page.waitForFunction(() => window.__tm?.world.selfId && window.__tm.self(), null, {
    timeout: 30_000,
  });
  // The company picker opens by itself once the player's own page is in: let it, then shut it.
  await page
    .waitForFunction(() => window.__tm.hud.get().panel !== null, null, { timeout: 4000 })
    .catch(() => {});
  await page.evaluate(() => window.__tm.hud.set({ panel: null, dialog: null }));
  await page.waitForTimeout(800);
}

export const room = (page) => page.evaluate(() => window.__tm.world.room);

/** Clicks the canvas at tile (x, y)'s centre on screen is renderer specific; this walks there as a click would. */
export async function walkTile(page, x, y, ms = 20_000) {
  await page.evaluate(([x, y]) => window.__tm.walkTo(x, y), [x, y]);
  await page
    .waitForFunction(
      ([x, y]) => {
        const me = window.__tm.self();
        return me && me.x === x && me.y === y && !me.from;
      },
      [x, y],
      { timeout: ms },
    )
    .catch(() => {});
}

/** Every portal tile of the current room: [{ ch, x, y }]. */
export const portals = (page) =>
  page.evaluate(() => {
    const m = window.__tm.world.map;
    const out = [];
    for (let y = m.y0; y < m.y0 + m.height; y++)
      for (let x = m.x0; x < m.x0 + m.width; x++) if (m.kind(x, y).portal) out.push({ ch: m.at(x, y), x, y });
    return out;
  });

/** Walks into the portal at (x, y) and waits for the room to change. Returns the new room, or null. */
export async function through(page, x, y, ms = 20_000) {
  const before = await room(page);
  await page.evaluate(([x, y]) => window.__tm.walkTo(x, y), [x, y]);
  try {
    await page.waitForFunction((b) => window.__tm.world.room !== b, before, { timeout: ms });
  } catch {
    return null;
  }
  await page.waitForTimeout(1500);
  return room(page);
}

/** Screenshots the page with the HUD hidden and measures how many distinct colours the canvas shows. */
export async function canvasInk(page, path) {
  await page.addStyleTag({ content: "#hud{visibility:hidden !important}" });
  await page.waitForTimeout(150);
  const buf = await page.screenshot(path ? { path } : {});
  await page.addStyleTag({ content: "#hud{visibility:visible !important}" });
  const b64 = buf.toString("base64");
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const t = document.createElement("canvas");
    t.width = 96;
    t.height = 64;
    const g = t.getContext("2d");
    g.drawImage(img, 0, 0, 96, 64);
    const d = g.getImageData(0, 0, 96, 64).data;
    const set = new Set();
    for (let i = 0; i < d.length; i += 4)
      set.add((d[i] >> 3) * 1024 + (d[i + 1] >> 3) * 32 + (d[i + 2] >> 3));
    return set.size;
  }, b64);
}
