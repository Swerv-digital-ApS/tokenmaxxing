import type { Barrel } from "@tokenmaxxing/core/fastelavn.ts";
import type { Frame, Lobby, MatchChatLine } from "@tokenmaxxing/core/games/wire.ts";
import type { Stone } from "@tokenmaxxing/core/graveyard.ts";
import type { Grid } from "@tokenmaxxing/core/grid.ts";
import type { JukeboxNow } from "@tokenmaxxing/core/jukebox.ts";
import type { Keynote } from "@tokenmaxxing/core/keynote.ts";
import type { Launch } from "@tokenmaxxing/core/launch.ts";
import type { LootNews } from "@tokenmaxxing/core/loot.ts";
import type { Listing, Sale } from "@tokenmaxxing/core/market.ts";
import { parsePhoneCode } from "@tokenmaxxing/core/pairing.ts";
import type { PetAct } from "@tokenmaxxing/core/pets.ts";
import type { Outage } from "@tokenmaxxing/core/picnic.ts";
import type { Card, PokerState } from "@tokenmaxxing/core/poker.ts";
import type { RouletteState } from "@tokenmaxxing/core/roulette.ts";
import type { Weather } from "@tokenmaxxing/core/sky.ts";
import type { Stars } from "@tokenmaxxing/core/stars.ts";
import type { Statue } from "@tokenmaxxing/core/statue.ts";
import {
  CHAT_HISTORY,
  type ChatLine,
  type CompanyInfo,
  type Drop,
  type Houses,
  type Moves,
  type Notice,
  type PlayerInfo,
  type Raiders,
  type RoomId,
  type Snapshot,
  type WorldGame,
} from "@tokenmaxxing/core/world.ts";
import type { Raid, registry } from "@tokenmaxxing/server/registry";
import { createClient } from "rivetkit/client";
import { errorCode } from "./errors.ts";
import { setGraves } from "./game/graveyard.ts";
import { setGrid } from "./game/grid.ts";
import { playJukebox, stopJukebox } from "./game/jukebox.ts";
import { setKeynotes } from "./game/keynote.ts";
import { setLaunches } from "./game/launch.ts";
import { noteLoot } from "./game/loot.ts";
import { duckMusic, playRoomMusic, stopRoomMusic } from "./game/music.ts";
import { reactPet } from "./game/pets.ts";
import { setOutage } from "./game/picnic.ts";
import { noteRaid, setRaiders } from "./game/raid.ts";
import { setStars } from "./game/stars.ts";
import { setStatue } from "./game/statue.ts";
import {
  applyBubble,
  applyCallout,
  applyChat,
  applyDrop,
  applyGame,
  applyGameOver,
  applyInfo,
  applyJump,
  applyMoves,
  applyPickup,
  loadSnapshot,
  setCompanies,
  world,
} from "./game/world.ts";
import { storage } from "./storage.ts";
import { hud } from "./store.ts";

const TOKEN_KEY = "tokenmaxxing.session";

// Rivetkit opens its sockets on the endpoint's http(s) URL. Chromium only takes those from 125, so an
// older WebView (Huawei's ships 114) throws a SyntaxError: hand it ws(s) instead.
globalThis.WebSocket = class extends WebSocket {
  constructor(url: string | URL, protocols?: string | string[]) {
    super(String(url).replace(/^http(s?):/, "ws$1:"), protocols);
  }
};

// Actions go over connections, not stateless HTTP: the client streams request bodies, which
// Chrome only allows over HTTP/2 (so it breaks on plain-http localhost).
const client = createClient<typeof registry>({ endpoint: `${location.origin}/api/rivet`, devtools: false });

type Town = ReturnType<ReturnType<typeof client.town.getOrCreate>["connect"]>;
type WorldConn = ReturnType<ReturnType<typeof client.world.getOrCreate>["connect"]>;
type ArcadeConn = ReturnType<ReturnType<typeof client.arcade.getOrCreate>["connect"]>;
type MatchConn = ReturnType<ReturnType<typeof client.match.get>["connect"]>;
type PlayerConn = ReturnType<ReturnType<typeof client.player.get>["connect"]>;

export let town: Town;
export let conn: WorldConn;
export let arcade: ArcadeConn;
/** The match you're playing or watching, if its panel is open. */
export let matchConn: MatchConn | null = null;
let session = "";

/** Trades a single-use login code (`<userId>.<code>`, or a phone's `42-K7QF-M2XP`) for a session, kept for the next load. */
export async function redeem(code: string): Promise<void> {
  const userId = parsePhoneCode(code)?.userId ?? code.split(".")[0]!;
  const player = client.player.get([String(userId)]).connect();
  storage.setItem(TOKEN_KEY, await player.redeemLoginCode(code).finally(() => player.dispose()));
}

/**
 * A browser may open `/#code=<userId>.<code>`: trade it for a session, then
 * drop it from the URL and history. The app's window signs in through the app
 * instead (AppSignIn).
 */
export async function signIn(): Promise<string | null> {
  const phonePairing = new URLSearchParams(location.search).has("pair");
  const code = new URLSearchParams(location.hash.slice(1)).get("code");
  if (code) {
    history.replaceState(null, "", location.pathname);
    try {
      await redeem(code);
    } catch {
      // A failed explicit phone pairing must not silently enter an older account.
      if (phonePairing || !storage.getItem(TOKEN_KEY)) {
        hud.set({ status: "expired" });
        return null;
      }
    }
  }
  const token = storage.getItem(TOKEN_KEY);
  if (!token) hud.set({ status: "signedOut" });
  return token;
}

const isUnauthorized = (err: unknown) => errorCode(err) === "unauthorized";

function signedOut(): void {
  storage.removeItem(TOKEN_KEY);
  conn?.dispose();
  town?.dispose();
  arcade?.dispose();
  closeMatch();
  hud.set({ status: "signedOut" });
}

export function connect(token: string): void {
  session = token;
  town = client.town.getOrCreate(["main"], { params: { token } }).connect();
  arcade = client.arcade.getOrCreate(["main"], { params: { token } }).connect();
  arcade.on("lobby", (lobby: Lobby) => applyLobby(lobby));
  arcade.onOpen(async () => applyLobby(await arcade.lobby()));
  for (const c of [town, arcade])
    c.onError((err) => {
      if (isUnauthorized(err)) signedOut();
    });
  conn = client.world.getOrCreate(["main"], { params: { token } }).connect();

  // The jukebox plays for the Tavern only: a snapshot of any other room, or a dropped line, ends it.
  conn.on("jukebox", (j: JukeboxNow | null) => {
    hud.set({ jukebox: j });
    playJukebox(j);
    duckMusic(j !== null);
  });
  // The poker table is the Tavern's too: the table for the room, my own two cards for me alone.
  conn.on("poker", (p: PokerState) => hud.set({ poker: { ...p, at: Date.now() } }));
  conn.on("roulette", (r: RouletteState) => hud.set({ roulette: { ...r, at: Date.now() } }));
  conn.on("pokerHole", (h: Card[]) => hud.set({ pokerHole: h }));
  conn.on("snapshot", (s: Snapshot) => {
    if (s.room !== "basement") hud.set({ poker: null, pokerHole: [], roulette: null });
    if (s.room !== "inn") {
      hud.set({ jukebox: null });
      stopJukebox();
      duckMusic(false);
    }
    playRoomMusic(s.room);
    // The hall's shelves fill as you walk in, not at the next poll.
    if (s.room === "shop-market") void refreshMarket().catch(() => {});
    loadSnapshot(s);
    setRaiders(s.raiders);
  });
  conn.on("raiders", (r: Raiders) => setRaiders(r));
  conn.on("moves", (m: Moves) => applyMoves(m));
  conn.on("info", (info: PlayerInfo) => {
    applyInfo(info);
    if (info.id === world.selfId) void refreshStats();
  });
  conn.on("companies", (list: CompanyInfo[]) => setCompanies(list));
  conn.on("houses", (h: Houses) => {
    world.houses = h;
  });
  conn.on("officeLights", (ids: number[]) => {
    world.officeLights = new Set(ids);
  });
  conn.on("weather", (weather: Weather) => hud.set({ weather }));
  conn.on("occupancy", (o: Partial<Record<RoomId, number>>) => hud.set({ occupancy: o }));
  conn.on("chat", (line: ChatLine) => applyChat(line));
  conn.on("bubble", (e: { userId: number; text: string }) => applyBubble(e));
  conn.on("jump", (id: number) => applyJump(id));
  conn.on("petPlay", (e: { userId: number; act: PetAct }) => reactPet(e.userId, e.act));
  conn.on("notice", (n: Notice) => {
    hud.set({ notice: { ...n, at: Date.now() } });
    if (n.open === "tournament") void refreshTournament(true);
    // A sale of mine: the notice is the toast, so the sale is only recorded.
    if (n.open === "market") void refreshMarket(false).catch(() => {});
    void refreshMe();
    // A trade I offered settled: my coins and 🎒 moved.
    void refreshWallet();
  });
  conn.on("mention", (line: ChatLine) => hud.set({ mention: { line, at: Date.now() } }));
  // A kill dropped loot: it flies out of the boss, so the kill should show now, not at the next poll.
  conn.on("loot", (news: LootNews[]) => {
    hud.set({ lootNews: { news, at: Date.now() } });
    noteLoot(news);
    void town.raid().then((raid) => {
      noteRaid(hud.get().raid, raid);
      hud.set({ raid });
    });
  });
  conn.on("game", (g: WorldGame) => applyGame(g));
  conn.on("gameOver", (e: { id: number; winners: number[] }) => applyGameOver(e.id, e.winners));
  conn.on("callout", (e: { id: number; userId: number | null; text: string }) => applyCallout(e));
  conn.on("drop", (d: Drop) => applyDrop(d));
  conn.on("pickup", (e: { id: number }) => applyPickup(e.id));
  conn.on("outage", (o: Outage | null) => setOutage(o));
  conn.on("launches", (l: Launch[]) => setLaunches(l));
  conn.on("graveyard", (s: Stone[]) => setGraves(s));
  conn.on("statue", (s: Statue) => setStatue(s));
  conn.on("grid", (g: Grid) => setGrid(g));
  conn.on("keynotes", (k: Keynote[]) => setKeynotes(k));
  conn.on("stars", (s: Stars) => setStars(s));
  conn.on("barrel", (barrel: Barrel | null) => hud.set({ barrel }));
  conn.onError((err) => {
    if (isUnauthorized(err)) signedOut();
  });
  conn.onClose(() => {
    // Music stops with the connection; the Tavern sends it again when we're back in.
    hud.set({ jukebox: null, poker: null, pokerHole: [], roulette: null });
    stopJukebox();
    stopRoomMusic();
    if (hud.get().status === "ready") hud.set({ status: "offline" });
    // ponytail: the client retries on its own, but can stall after a long outage (a deploy);
    // a reload after 20 s always gets back in. Replace with a proper backoff if it annoys anyone.
    setTimeout(() => {
      if (hud.get().status === "offline") location.reload();
    }, 20_000);
  });
  // Other people's syncs move the board too; nothing announces those, so poll. Not in a hidden tab:
  // it catches up when it shows again.
  setInterval(() => {
    if (hud.get().status === "ready" && !document.hidden) void refreshStats();
  }, 30_000);
  document.addEventListener("visibilitychange", () => {
    if (hud.get().status === "ready" && !document.hidden) void refreshStats();
  });
  // Torvehallen's shelves change as people buy and list: read them again while I'm in the hall.
  setInterval(() => {
    if (hud.get().status === "ready" && !document.hidden && world.room === "shop-market")
      void refreshMarket(false).catch(() => {});
  }, MARKET_POLL_MS);
  // Every (re)connect: join the world again and take a fresh snapshot.
  conn.onOpen(async () => {
    try {
      loadSnapshot(await conn.join());
      hud.set({ status: "ready" });
      await Promise.all([refreshMe(), refreshStats(), refreshTournament(true)]);
      // Sales while I was away.
      void refreshMarket().catch(() => {});
    } catch (err) {
      if (isUnauthorized(err)) signedOut();
    }
  });
}

/** `next`, or `prev` when it says the same: what shows it doesn't re-render (or refetch) for a poll. */
const same = <T>(prev: T, next: T): T => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next);

export async function refreshMe(): Promise<void> {
  const me = await town.me();
  hud.set((s) => ({ me: same(s.me, me) }));
}

/** My coins and things, after something may have moved them. */
export async function refreshWallet(): Promise<void> {
  const wallet = await town.wallet();
  hud.set((s) => ({ wallet: same(s.wallet, wallet) }));
}

// MARK: Torvehallen

const MARKET_POLL_MS = 5000;
/** How many of my sales are kept on this device to look back at. */
const SALES_KEPT = 30;
const salesKey = () => `tokenmaxxing.market-sales.${world.selfId}`;
let salesFor = -1;

/** The sales this device remembers for this account (newest first), once per account. */
function rememberedSales(): Sale[] {
  if (salesFor === world.selfId) return hud.get().marketLog;
  salesFor = world.selfId;
  let log: Sale[] = [];
  try {
    const raw: unknown = JSON.parse(storage.getItem(salesKey()) ?? "[]");
    log = Array.isArray(raw) ? raw.filter((s) => Number.isInteger(s?.id) && Number.isInteger(s?.price)) : [];
  } catch {}
  hud.set({ marketLog: log });
  return log;
}

/**
 * Sales the server hasn't told me of yet: they go in the log, the server is told it can forget them, and
 * (`toast`) the HUD says so once. A sale already in the log is not announced again if the server's reply to
 * `marketSaw` got lost.
 */
async function hearSales(sold: Sale[], toast: boolean): Promise<void> {
  const log = rememberedSales();
  const fresh = sold.filter((s) => !log.some((l) => l.id === s.id));
  if (fresh.length > 0) {
    const next = [...fresh].reverse().concat(log).slice(0, SALES_KEPT);
    storage.setItem(salesKey(), JSON.stringify(next));
    hud.set({ marketLog: next, ...(toast ? { marketSold: { sales: fresh, at: Date.now() } } : {}) });
  }
  await town.marketSaw(sold.at(-1)!.id);
}

/**
 * Torvehallen as it is now: everything on display and my own listings, room and sales. Hears my sales too
 * (`toast`: with a toast, which is for coming back to them, not for the notice that already says it).
 */
export async function refreshMarket(toast = true): Promise<void> {
  const [listings, mine] = await Promise.all([town.marketListings(), town.marketMine()]);
  hud.set((s) => ({
    market: {
      listings: same(s.market?.listings ?? [], listings),
      mine: same(s.market?.mine ?? null, mine),
      at: Date.now(),
    },
  }));
  if (mine.sold.length > 0) await hearSales(mine.sold, toast);
}

/** Buys a listing at the price I saw; my coins and bag, and the shelves, are read again. */
export async function marketBuy(listing: Listing): Promise<void> {
  hud.set({ wallet: await town.marketBuy(listing.id, listing.price) });
  await refreshMarket(false).catch(() => {});
}

/** Puts one of my things on a slot at a price (for good: a price isn't changed, only taken back). */
export async function marketList(want: {
  item: string;
  slot: number;
  price: number;
  copy?: number;
}): Promise<void> {
  await town.marketList(want);
  await Promise.all([refreshWallet(), refreshMarket(false)]).catch(() => {});
}

/** Takes one of my listings back into my bag. */
export async function marketCancel(listing: Listing): Promise<void> {
  await town.marketCancel(listing.id);
  await Promise.all([refreshWallet(), refreshMarket(false)]).catch(() => {});
}

/** Today's quests and the week's. Asking also deals today's the first time, so a day's quests always exist. */
export async function refreshQuests(): Promise<void> {
  const questBoard = await town.questBoard().catch(() => null);
  if (questBoard) hud.set((s) => ({ questBoard: same(s.questBoard, questBoard) }));
}

let tournamentAt = 0;
/** The tournament board: the bracket on the big screen and the champion's chat title. At most every 15 s unless forced. */
export async function refreshTournament(force = false): Promise<void> {
  if (!force && Date.now() - tournamentAt < 15_000) return;
  tournamentAt = Date.now();
  const tournament = await town.tournament().catch(() => null);
  if (tournament) hud.set((s) => ({ tournament: same(s.tournament, tournament) }));
}

let statsTimer: ReturnType<typeof setTimeout> | null = null;

/** My tokens, rank, level and coins today, at most every few seconds. */
async function refreshStats(force = false): Promise<void> {
  if (statsTimer && !force) return;
  if (statsTimer) clearTimeout(statsTimer);
  statsTimer = setTimeout(() => {
    statsTimer = null;
  }, 5000);
  const [m, wallet, raid] = await Promise.all([town.today(), town.wallet(), town.raid()]);
  noteRaid(hud.get().raid, raid);
  hud.set((s) => ({
    stats: same(s.stats, m.me),
    board: same(s.board, m.top),
    wallet: same(s.wallet, wallet),
    raid: same(s.raid, raid),
  }));
  gateTimer(raid);
  void refreshQuests();
}

let gateAt = 0;
/** A shut gate (the launch, or Monday 08:00) is asked about again the moment it opens, not up to 30 s later. */
function gateTimer(raid: Raid): void {
  const at = raid.prelaunch ? raid.launchAt : raid.closed ? raid.endsAt : 0;
  if (!at || at === gateAt || at <= Date.now()) return;
  gateAt = at;
  setTimeout(() => void refreshStats(true), at - Date.now() + 1500);
}

// MARK: Games

/**
 * A new lobby. Two things happen on their own: a new invite for me shows a toast, and a
 * game I've just started playing opens its panel.
 */
function applyLobby(lobby: Lobby): void {
  const before = hud.get().lobby;
  const me = hud.get().me?.userId;
  const invite = lobby.tables.find(
    (t) =>
      t.invited.some((i) => i.userId === me) &&
      !before?.tables.some((b) => b.id === t.id && b.invited.some((i) => i.userId === me)),
  );
  hud.set({ lobby, ...(invite ? { inviteTable: invite.id } : {}) });
  // Stakes, bets and payouts move coins: my place in the lobby changes, or a game I played or bet on ends.
  const paid = lobby.matches.some(
    (m) =>
      m.outcome &&
      !before?.matches.some((b) => b.id === m.id && b.outcome) &&
      (m.players.some((p) => p.userId === me) || (before?.me.bets[m.id] ?? lobby.me.bets[m.id])),
  );
  if (paid || JSON.stringify(lobby.me) !== JSON.stringify(before?.me)) void refreshWallet();
  const playing = lobby.me.match;
  if (playing !== null && playing !== before?.me.match) {
    const m = lobby.matches.find((x) => x.id === playing);
    if (m && !m.outcome) openMatch(playing);
  }
}

/** Opens a match's panel: yours to play, or someone else's to watch. */
export function openMatch(id: number): void {
  if (hud.get().frame?.info.id !== id || !matchConn) {
    matchConn?.dispose();
    hud.set({ frame: null, matchChat: [] });
    const c = client.match.get([String(id)], { params: { token: session } }).connect();
    c.on("frame", (frame: Frame) => {
      if (frame.info.id === id) hud.set({ frame, ...skewOf(frame) });
    });
    c.on("chat", (line: MatchChatLine) => {
      if (matchConn === c) hud.set((s) => ({ matchChat: [...s.matchChat, line].slice(-CHAT_HISTORY) }));
    });
    c.onOpen(async () => {
      const [frame, matchChat] = await Promise.all([c.frame(), c.chat()]);
      hud.set({ frame, matchChat, ...skewOf(frame) });
    });
    matchConn = c;
  }
  hud.set({ panel: { kind: "match", id } });
}

/**
 * My clock against the match's, from a frame. It wobbles by a few ms a frame: only a real change moves
 * it, so the countdowns and timers keyed on it don't restart every frame.
 */
function skewOf(frame: Frame): { clockSkew?: number } {
  const skew = Date.now() - frame.now;
  return Math.abs(skew - hud.get().clockSkew) > 50 ? { clockSkew: skew } : {};
}

/** Closing the panel stops watching (a game you play keeps going, and reopens from the 🎮 button). */
export function closeMatch(): void {
  matchConn?.dispose();
  matchConn = null;
  hud.set({ frame: null, matchChat: [] });
}

/** A connection to my own `player` (my computers), for whoever opens it to dispose. */
export const connectPlayer = (): PlayerConn =>
  client.player.get([String(world.selfId)], { params: { token: session } }).connect();

/** A call on my own `player`, over a connection that closes after it. */
export async function withPlayer<T>(fn: (player: PlayerConn) => Promise<T>): Promise<T> {
  const player = connectPlayer();
  try {
    return await fn(player);
  } finally {
    player.dispose();
  }
}
