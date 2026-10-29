import { BARKEEP, mayRemark } from "@tokenmaxxing/core/barkeep.ts";
import { BOTS, between, chase, isBot, lineFor, pick, toCoffee, wander } from "@tokenmaxxing/core/bots.ts";
import { commonRoom } from "@tokenmaxxing/core/common.ts";
import {
  BURN_FRESH_MS,
  type Burn,
  COP,
  chargeOf,
  pullOverLine,
  speeder,
  ticketLine,
  writeTicket,
} from "@tokenmaxxing/core/cop.ts";
import { danceAt, danceId, isFree } from "@tokenmaxxing/core/dances.ts";
import { type Barrel, barrelUp, HITS, isBarrel, WHACK_MS } from "@tokenmaxxing/core/fastelavn.ts";
import {
  type Angling,
  CAST_COOLDOWN_MS,
  type CastReply,
  type FishingCast,
  fishingPhase,
  fishingWater,
  type Landing,
  newCast,
  pondTime,
  type ReelReply,
  rollCatch,
} from "@tokenmaxxing/core/fishing.ts";
import {
  findSpot,
  propTiles,
  type Seat,
  type Spot,
  seatsFor,
  spotSize,
} from "@tokenmaxxing/core/games/gather.ts";
import type { GameId } from "@tokenmaxxing/core/games/types.ts";
import {
  type Plot,
  type Stone,
  sameStones,
  stoneAt,
  stonesOf,
  tend,
  withChanges,
} from "@tokenmaxxing/core/graveyard.ts";
import { isTruck } from "@tokenmaxxing/core/jdag.ts";
import {
  type Jukebox,
  settle as settleJukebox,
  skipNeeded,
  start,
  voteSkip,
  votesOf,
  wire,
} from "@tokenmaxxing/core/jukebox.ts";
import { CROWD, type Keynote, keynoteTalk, liveKeynote, sameKeynotes } from "@tokenmaxxing/core/keynote.ts";
import { activeLaunches, isStand, type Launch, sameLaunches } from "@tokenmaxxing/core/launch.ts";
import type { LootNews } from "@tokenmaxxing/core/loot.ts";
import { setTown, TOWN_SPAWN } from "@tokenmaxxing/core/maps.ts";
import {
  assignSlots,
  canHang,
  canTurn,
  clearOffice,
  type Door,
  doorsFor,
  HQS,
  OFFICE_LEVEL,
  OFFICE_MAPS,
  OFFICE_PIECES,
  officeTier,
  rotOf,
  setHq,
  setOffice,
  sideways,
  wallSpot,
  withPieces,
} from "@tokenmaxxing/core/office.ts";
import { isPetAct, PET_COOLDOWN_MS, type PetAct } from "@tokenmaxxing/core/pets.ts";
import { type Outage, onBlanket, PICNIC_SEATS, sameOutage } from "@tokenmaxxing/core/picnic.ts";
import {
  type Action,
  act,
  holeOf,
  leave,
  newTable,
  PokerError,
  wire as pokerWire,
  ready,
  release,
  seatOf,
  settled,
  sitDown,
  type Table,
  tick,
} from "@tokenmaxxing/core/poker.ts";
import { chairAt, pokerChairs } from "@tokenmaxxing/core/pokertable.ts";
import { dayKey } from "@tokenmaxxing/core/range.ts";
import {
  BETTING_MS,
  type Bet,
  colorOf,
  nextPhase,
  RESULT_MS,
  type RouletteOutcome,
  type RoulettePhase,
  type RouletteSeat,
  type RouletteSpin,
  type RouletteState,
  SPIN_MS,
  SPOTS,
} from "@tokenmaxxing/core/roulette.ts";
import { rouletteSpots, rouletteTable, spotAt } from "@tokenmaxxing/core/roulettetable.ts";
import { isBonfire } from "@tokenmaxxing/core/sankthans.ts";
import { canDropIn, itemById } from "@tokenmaxxing/core/shop.ts";
import { shopOfRoom } from "@tokenmaxxing/core/shoprooms.ts";
import { iceOver, sameWeather, type Weather } from "@tokenmaxxing/core/sky.ts";
import { milestoneLine, NO_STARS, readStars, type Stars, type StarsState } from "@tokenmaxxing/core/stars.ts";
import {
  afterRead,
  type Leader,
  NO_STATUE,
  type StatueAdmin,
  type StatueState,
  sameLeader,
  shownStatue,
  unveilLine,
  withPin,
} from "@tokenmaxxing/core/statue.ts";
import { cartOpen, facesCart, hasPolse, isCart, POLSE, stepPace } from "@tokenmaxxing/core/street.ts";
import {
  hasSpecial,
  SPECIAL,
  serveUntil,
  specialBuff,
  specialOn,
  TAVERN,
} from "@tokenmaxxing/core/tavern.ts";
import {
  baseMap,
  CHAT_HISTORY,
  type ChatLine,
  type CompanyInfo,
  companyOfRoom,
  cupsLeft,
  cutsOff,
  DIRS,
  DORM,
  DROPS,
  type Drop,
  drinkCoffee,
  dropCovers,
  dropName,
  dropTiles,
  type Facing,
  furnitureFits,
  type GameStatus,
  type Houses,
  homeRoom,
  IDLE_MS,
  isFacing,
  JUMP_MS,
  type Moves,
  mapOf,
  memberRoomOf,
  mentionsIn,
  type Notice,
  noFurniture,
  outsideDoor,
  ownerOfOffice,
  type Place,
  type PlayerInfo,
  type PlayerPos,
  type PlayerState,
  type PlayerView,
  parseRoom,
  pieceOfDrop,
  portal,
  RAIDERS_SHOWN,
  type Raiders,
  type RoomId,
  restSpot,
  roomEntry,
  route,
  type Snapshot,
  STEP_BURST,
  type StepResult,
  setDrops,
  stepTarget,
  TICK_MS,
  takeStep,
  townSpawn,
  WORKING_MS,
  type WorldGame,
} from "@tokenmaxxing/core/world.ts";
import { compact, countBy, must, omit, sortBy, typedSwitch } from "hanzio";
import { actor, UserError } from "rivetkit";
import { db } from "rivetkit/db";
import { putAwayNotice } from "../furniture-notices.ts";
import { fetchStars, STARS_EVERY_MS } from "../github-stars.ts";
import { loadPlots, migrateGraveyard, savePlots } from "../graveyard.ts";
import { checkGrid, GRID_EVERY_MS, type GridState, initialGrid } from "../grid.ts";
import { checkModels, LAUNCHES_EVERY_MS } from "../launch.ts";
import { checkOutage, forced, OUTAGE_EVERY_MS } from "../picnic.ts";
import { RateLimiter } from "../rate-limit.ts";
import { readLeader, STATUE_EVERY_MS, STATUE_RETRY_MS } from "../statue.ts";
import { counts, TavernClock } from "../tavern-clock.ts";
import type { Whack } from "../town/fastelavn.ts";
import { parseChatText } from "../validate.ts";
import {
  fetchPollen,
  fetchWeather,
  initialWeather,
  POLLEN_EVERY_MS,
  pinnedSeason,
  pinnedWeather,
  WEATHER_EVERY_MS,
} from "../weather.ts";
import {
  all,
  authenticate,
  type Caller,
  type ConnParams,
  main,
  requireInternal,
  requireMain,
  requireUser,
  type Sql,
  type TxSql,
  waitForTick,
} from "./shared.ts";
import type { Office, PlayerCore } from "./town.ts";

interface WorldPlayer extends PlayerCore, Place {
  state: PlayerState;
  lastInputAt: number;
  lastAgentAt: number;
  liveAgents: number;
  /** Tokens a minute over the 10 minutes before their last sync (optional: older state has none). */
  burn?: number;
  /** Where they were when sent to bed or desk, so they come back there. */
  back?: (Place & { state: "idle" | "sit" }) | null;
  /** In a long game (Tokenmaxxing): their desk at the arena, which replaces their bed until it ends. */
  arena?: Seat | null;
  /** Optional: players from before coffee have had none. */
  coffeeUntil?: number;
  /** Optional, like coffee: when their pølse wears off. */
  polseUntil?: number;
  /** Optional too: when the Tavern's special wears off. */
  specialUntil?: number;
  /** Online with no input for `IDLE_MS`; cleared by the next input. */
  dozing?: boolean;
  /** The dance they're doing (`DANCES`), since when; none once they step, sit, rest or come back. */
  dance?: number;
  danceSince?: number;
  /** Their line in the pond and their last catch, for everyone to see (`fishingCast`, `fishingReel`). */
  angling?: Angling | null;
  landing?: Landing | null;
}

interface WorldState {
  seeded: boolean;
  players: Record<string, WorldPlayer>;
  companies: Record<string, CompanyInfo>;
  /** Games on show in town. Optional: worlds from before games have none. */
  games?: Record<string, WorldGame>;
  /** Whether each office is open, by owner (optional, like games). No entry is open: `officeOf`. */
  offices?: Record<string, Office>;
  /**
   * Each office owner's door slot in their company's building (`assignSlots`), by user id. Optional: a world
   * from before slots has none, and its first rebuild packs them by id, which is where every door stood.
   */
  doorSlots?: Record<string, { company: number; slot: number }>;
  /**
   * The repo's GitHub stars and the last milestone celebrated (`core/stars.ts`), kept so a restart never
   * sets off the same fireworks again. Optional: a world from before the counter reads them afresh.
   */
  stars?: StarsState;
  /**
   * The statue of the #1 model (`core/statue.ts`): the last leader read and the admin's pin, kept here so a
   * restart or a broken feed still has one on the plinth. Optional: worlds from before it have none.
   */
  statue?: StatueState;
}

type ConnState = Caller & { joined?: boolean };

const CHAT_KEEP = 200;
/** The shortest time between two coins in the fountain. */
const TOSS_MS = 3_000;

/** What a cup says, by how many are in your system. */
const COFFEE_LINES = [
  "☕ A fresh cup. You feel a little buzz.",
  "☕☕ Second cup. Your fingers tap on their own.",
  "☕☕☕ Third cup. You could refactor the whole monorepo right now.",
  "☕☕☕☕ Fourth cup. You can hear colours.",
  "☕☕☕☕☕ Fifth cup. Your heart is running at 10 Hz.",
  "☕☕☕☕☕☕ The machine refuses to make it any stronger. You vibrate anyway.",
];
const CHAT_PER_MIN = 20;
/** Dances started or stopped a minute: each one goes to the whole room. */
const DANCES_PER_MIN = 30;
/** Poker actions a player may take a minute: a hand is a few dozen at most. */
const POKER_PER_MIN = 120;
const ROULETTE_PER_MIN = 120;
const keynoteBadge = (title: string) =>
  `📽️ Watch party! You were at the Tavern for ${title}. It's on your card now.`;
/** The keynote watch party: the schedule is asked of `town` this often (and pushed by it on a change). */
const KEYNOTES_EVERY_MS = 5 * 60_000;
/** Whoever is in the Tavern while a keynote is on gets its badge: looked at this often. */
const WATCH_EVERY = 50; // ticks
/** At the watch party, a bot in the crowd says something this often, and hops for joy about once in this many steps. */
const CHEER_EVERY_MS: [number, number] = [10_000, 25_000];
const HOP_ONE_IN = 25;
const PICNIC_BADGE =
  "🧺 I was there. The outage picnic is on your card now, and 🌱 Touched grass is in your bag for your office.";
/** At most this many drops on one room's floor (an office holds `OFFICE_PIECES`). */
const DROPS_PER_ROOM = 30;
const REST_CHECK_EVERY = 10; // ticks
/**
 * `WORLD_PERF=1` (the load test, `scripts/perf/load.ts`): how long each tick took and how late it
 * started, in ms, on stdout once a second.
 */
const PERF = process.env.WORLD_PERF === "1" ? { tick: [] as number[], lag: [] as number[], at: 0 } : null;

function perfTick(began: number, ended: number): number {
  const now = performance.now();
  PERF!.tick.push(now - began);
  PERF!.lag.push(began - ended - TICK_MS);
  if (now - PERF!.at >= 1000) {
    console.log(`[perf] ${JSON.stringify({ tick: PERF!.tick, lag: PERF!.lag })}`);
    Object.assign(PERF!, { tick: [], lag: [], at: now });
  }
  return now;
}
/** Head counts go to every connection, so at most once a second: a burst of joins changes them every tick. */
const COUNTS_EVERY = 10; // ticks
/** How often the dungeon hears who's raiding. */
const RAIDERS_EVERY_MS = 1000;
/** Bots take a step every this many ticks: a stroll. */
const BOT_STEP_EVERY = 3;
/** How long a bot stands around between walks, and after saying something. */
const BOT_PAUSE_MS: [number, number] = [2_000, 12_000];
const BOT_TALK_PAUSE_MS = 4_000;
/** The chance a bot done with a walk tags along after someone online in town instead (by default), and for how long. */
const BOT_FOLLOW_CHANCE = 0.08;
const BOT_FOLLOW_MS: [number, number] = [20_000, 60_000];
/** How soon a bot that starts following someone says something to them. */
const BOT_GREET_MS: [number, number] = [3_000, 10_000];
/** The chance a bot done with a walk goes for coffee instead, and how many cups it has there. */
const BOT_COFFEE_CHANCE = 0.15;
const BOT_CUPS: [number, number] = [1, 3];

/** A bot's plans, kept in memory: a restart just starts it on a new walk. */
interface BotRun {
  path: Facing[];
  restUntil: number;
  sayAt: number;
  /** Who it's tagging along after, until `followUntil`. */
  following: number | null;
  followUntil: number;
  /** On its way to coffee: how to face the machine when it gets there. */
  coffee: Facing | null;
  /** Cups in its system after coffee, until it's said something about it. */
  cups: number;
}

const view = (p: WorldPlayer, online: boolean): PlayerView => ({
  id: p.id,
  name: p.name,
  look: p.look,
  level: p.level,
  companyId: p.companyId,
  todayTokens: p.todayTokens,
  liveAgents: p.liveAgents,
  online: online || isBot(p.id),
  coffeeUntil: p.coffeeUntil ?? 0,
  polseUntil: p.polseUntil ?? 0,
  specialUntil: p.specialUntil ?? 0,
  dozing: online && !!p.dozing,
  desk: p.desk ?? 0,
  // Only on their feet: a seat, a bed or a game puts the dance down (`stopDance`).
  dance: p.state === "idle" ? (p.dance ?? 0) : 0,
  danceSince: p.state === "idle" ? (p.danceSince ?? 0) : 0,
  // Fishing is on your feet at the bank, and only while you're there to hold the rod.
  angling: p.state === "idle" && online ? (p.angling ?? null) : null,
  landing: p.state === "idle" && online ? (p.landing ?? null) : null,
  x: p.x,
  y: p.y,
  facing: p.facing,
  state: p.state,
});

const info = (p: WorldPlayer, online: boolean): PlayerInfo =>
  omit(view(p, online), ["x", "y", "facing", "state"]);

const pos = (p: WorldPlayer): PlayerPos => [p.id, p.x, p.y, p.facing, p.state];

export const world = actor({
  createConnState: (c, params: ConnParams): Promise<ConnState> => authenticate(params, c.client()),
  state: { seeded: false, players: {}, companies: {} } as WorldState,
  createVars: () => ({
    /** Open game connections per player. */
    online: new Map<number, number>(),
    /**
     * Who each connection is once it has joined (null until then, or not a player's), by connection id:
     * `conn.state` builds a proxy on every read, and sending reads it for every connection.
     */
    users: new Map<string, number | null>(),
    /** Players that moved or changed room since the last tick. */
    dirty: new Set<number>(),
    /** The room each player was last announced in. */
    announced: new Map<number, RoomId>(),
    /** Players last announced as asleep at the Inn: counted there, not shown (see `counted`). */
    hidden: new Set<number>(),
    steps: new Map<number, { budget: number; at: number }>(),
    /** When each player last jumped. */
    jumps: new Map<number, number>(),
    /** When each player last did each thing with their pet (`petPlay`), so a held button can't flood the room. */
    petPlays: new Map<number, Partial<Record<PetAct, number>>>(),
    /** When each player last tossed a coin in the fountain, so a held key can't flood the ledger. */
    tosses: new Map<number, number>(),
    fishing: new Map<number, FishingCast>(),
    fishingStarts: new Map<number, number>(),
    /** When each player last whacked the fastelavn barrel, and the barrel as `town` last said (null off the day). */
    whacks: new Map<number, number>(),
    barrel: null as Barrel | null,
    barrelAt: 0,
    chat: new RateLimiter(CHAT_PER_MIN, 60_000),
    dances: new RateLimiter(DANCES_PER_MIN, 60_000),
    occupancy: "",
    /** The last `houses` sent to town, as JSON. */
    houses: "",
    /** Someone in a house moved, changed or left since then: `houses` is worked out again. */
    housesStale: true,
    /** The last `raiders` sent to the dungeon, as JSON, and when. */
    raiders: "",
    raidersAt: 0,
    bots: new Map<number, BotRun>(),
    /** The outage picnic: one status check for everyone (`picnic.ts`), kept when a check fails. */
    outage: null as Outage | null,
    outageAt: 0,
    /** New models from OpenRouter's list (`launch.ts`): one read for everyone, kept when a read fails. */
    launches: [] as Launch[],
    launchesAt: 0,
    /** Every pool model seen in that list (`graveyard.ts`, kept in SQLite), and the stones it shows. */
    plots: [] as Plot[],
    graves: [] as Stone[],
    /** The keynote watch parties (`keynote.ts`): `town`'s schedule, still to come or on, soonest first. */
    keynotes: [] as Keynote[],
    keynotesAt: 0,
    /** Counts `town`'s pushes, so a poll that was asked before the latest push can't put back the list it replaced. */
    keynotesPushed: 0,
    /** Badges for a keynote asked of `town` already (`keynoteId:userId`), so being there costs one call. */
    watched: new Set<string>(),
    cop: { burns: new Map(), ticketed: new Map(), chase: null, freeAt: 0 } as CopVars,
    /** Visits already sent to `town` today (`countVisit`), so a door in and out costs one write. */
    visited: { day: "", keys: new Set<string>() },
    /** The sky: one fetch for everyone (`weather.ts`), kept when a fetch fails. */
    weather: initialWeather() as Weather,
    weatherAt: 0,
    pollenAt: 0,
    /** The power grid: one read for everyone (`grid.ts`), kept when a read fails. */
    grid: initialGrid() as GridState,
    gridAt: 0,
    /** Green hours `town` has been told about, so each is sent until it lands, then not again. */
    greenSent: new Set<number>(),
    /** When the GitHub stars are read next (`github-stars.ts`): one read for everyone. */
    starsAt: 0,
    /** Minutes in the Tavern since the last flush (`tavernBeat`). */
    tavern: new TavernClock(),
    /** When the barkeep last mentioned an award. */
    remarkAt: 0,
    /** The Tavern's jukebox (`core/jukebox.ts`), and when each player last started a track. In memory only. */
    jukebox: null as Jukebox,
    jukeStarts: new Map<number, number>(),
    /** The last jukebox state sent to the room, to send again only when it changes. */
    jukeKey: "",
    /**
     * The Tavern's poker table (`core/poker.ts`). In memory only: the town holds the stacks (`town/poker.ts`)
     * and hands them back if this actor wakes without its table. Never in state, snapshots or logs: the
     * deck and the hole cards.
     */
    poker: newTable(),
    /** The last table sent to the room (its `v`), each player's hole cards last sent to them, and who is sitting down. */
    pokerSent: -1,
    pokerHole: new Map<number, string>(),
    pokerBusy: new Set<number>(),
    pokerFlushing: false,
    pokerActs: new RateLimiter(POKER_PER_MIN, 60_000),
    /** The net cafe's roulette table: who holds a spot, the last spin, the recent pockets. In memory only. */
    roulette: newRoulette(),
    rouletteActs: new RateLimiter(ROULETTE_PER_MIN, 60_000),
  }),
  db: db({
    onMigrate: async (d) => {
      await d.execute(`CREATE TABLE IF NOT EXISTS chat (
        id INTEGER PRIMARY KEY, room TEXT NOT NULL, user_id INTEGER NOT NULL,
        name TEXT NOT NULL, text TEXT NOT NULL, at INTEGER NOT NULL)`);
      await d.execute("CREATE INDEX IF NOT EXISTS chat_room ON chat (room, id)");
      // Bots used to talk in the chat; they only talk over their heads now.
      await d.execute("DELETE FROM chat WHERE user_id < 0");
      await migrateGraveyard(d);
    },
  }),
  onCreate: (c) => requireMain(c),
  onWake: async (c) => {
    // Every floor, and every office's lock, are `town`'s: the world only keeps them in memory.
    // ponytail: `seed` sends everyone every time, for the floors; split it if that gets big.
    const seed = await main(c.client()).town.seed();
    // First start (or a wiped world): everyone too, put to bed.
    if (!c.state.seeded) {
      for (const co of seed.companies) c.state.companies[co.id] = co;
      for (const p of seed.players) upsert(c.state, p, Date.now());
      c.state.seeded = true;
    }
    c.state.offices = seed.offices;
    c.vars.plots = await loadPlots(c.db);
    c.vars.graves = stonesOf(c.vars.plots);
    for (const id of Object.keys(c.state.players)) buildOffice(c.state, Number(id));
    delete (c.state as { drops?: unknown }).drops; // kept here before `seed` carried them
    placeBots(c.state);
    tidyInn(c.state);
    buildTown(c.state);
    for (const id of Object.keys(c.state.companies)) buildHq(c.state, Number(id));
    // `seed` is every floor: what was here before sleeping (a drop whose call failed, say) goes.
    for (const room of DROPS.keys()) setDrops(room, []);
    for (const d of seed.drops) lay(c, d);
    // The table is gone with the last actor: whoever the town still has seated gets their stack back.
    if (TAVERN)
      await main(c.client())
        .town.pokerRelease()
        .catch((err) => console.warn(`[poker] release: ${String(err)}`));
    // Likewise the roulette table: stakes of a round nobody remembers go back to their wallets.
    await main(c.client())
      .town.rouletteRefund()
      .catch((err) => console.warn(`[roulette] release: ${String(err)}`));
  },
  onDisconnect: (c, conn) => {
    // It's out of `c.conns` by now, so no send puts it back in.
    c.vars.users.delete(conn.id);
    const s = conn.state as ConnState;
    if (s.kind !== "user" || !s.joined) return;
    const left = (c.vars.online.get(s.userId) ?? 1) - 1;
    if (left > 0) return void c.vars.online.set(s.userId, left);
    c.vars.online.delete(s.userId);
    c.vars.fishing.delete(s.userId);
    const p = c.state.players[s.userId];
    if (!p) return;
    stopFishing(p);
    pokerStandUp(c, p.id);
    rouletteLeave(c, p.id);
    const from = p.room;
    // At a game table they stay put: the match decides what happens if they don't come back.
    if (p.state !== "playing") rest(c.state, p, restState(p, Date.now()));
    c.vars.dirty.add(p.id);
    sendInfo(c, p, info(p, false), from);
  },
  run: async (c) => {
    const signal = c.abortSignal;
    let n = 0;
    let ended = performance.now();
    while (await waitForTick(signal, TICK_MS)) {
      const began = performance.now();
      const now = Date.now();
      if (++n % REST_CHECK_EVERY === 0)
        for (const p of settle(c.state, c.vars, now)) sendInfo(c, p, info(p, true));
      // With nobody to see them, the bots stand still (and don't write their walks to state).
      if (n % BOT_STEP_EVERY === 0 && c.vars.online.size > 0) {
        for (const p of walkBots(c.state, c.vars, now)) sendInfo(c, p, info(p, true));
        talkBots(c, now);
        if (TAVERN) cheerBots(c, now);
      }
      if (now >= c.vars.outageAt) {
        c.vars.outageAt = now + OUTAGE_EVERY_MS;
        void refreshOutage(c, now);
      }
      if (now >= c.vars.launchesAt) {
        c.vars.launchesAt = now + LAUNCHES_EVERY_MS;
        void refreshLaunches(c, now).catch((err) => console.warn(`[launch] refresh: ${String(err)}`));
      }
      // When it's due (kept in state, so a restart doesn't read it again), and once at a time.
      if (now >= (c.state.statue?.nextAt ?? 0)) {
        c.state.statue = { ...(c.state.statue ?? NO_STATUE), nextAt: now + STATUE_RETRY_MS };
        void refreshStatue(c, now);
      }
      if (now >= c.vars.keynotesAt) {
        c.vars.keynotesAt = now + KEYNOTES_EVERY_MS;
        void refreshKeynotes(c);
      }
      if (now >= c.vars.barrelAt) {
        c.vars.barrelAt = now + BARREL_EVERY_MS;
        void refreshBarrel(c, now);
      }
      if (TAVERN && n % WATCH_EVERY === 0) watchBeat(c, now);
      copBeat(c, now);
      if (TAVERN) tavernBeat(c, n, now);
      jukeboxBeat(c, now);
      if (TAVERN) pokerBeat(c, now);
      rouletteBeat(c, now);
      if (now >= c.vars.weatherAt) {
        c.vars.weatherAt = now + WEATHER_EVERY_MS;
        void refreshWeather(c);
      }
      if (now >= c.vars.pollenAt) {
        c.vars.pollenAt = now + POLLEN_EVERY_MS;
        void refreshPollen(c);
      }
      if (now >= c.vars.gridAt) {
        c.vars.gridAt = now + GRID_EVERY_MS;
        void refreshGrid(c, now);
      }
      if (now >= c.vars.starsAt) {
        c.vars.starsAt = now + STARS_EVERY_MS;
        void refreshStars(c, now);
      }
      flush(c);
      if (n % COUNTS_EVERY === 0) {
        const counts = occupancy(c.state, c.vars.online);
        const json = JSON.stringify(counts);
        if (json !== c.vars.occupancy) {
          c.vars.occupancy = json;
          c.broadcast("occupancy", counts);
        }
      }
      if (PERF) ended = perfTick(began, ended);
    }
  },
  actions: {
    /** Called once per game connection: wakes you up and returns your room. */
    join: async (c): Promise<Snapshot> => {
      const userId = requireUser(c.conn.state);
      const p = must(c.state.players[userId], () => new UserError("Unknown player.", { code: "not_found" }));
      (c.conn.state as ConnState).joined = true;
      c.vars.users.set(c.conn.id, userId);
      c.vars.online.set(userId, (c.vars.online.get(userId) ?? 0) + 1);
      p.lastInputAt = Date.now();
      p.dozing = false;
      stopDance(p);
      const from = p.room;
      if (wake(c.state, p)) c.vars.dirty.add(p.id);
      sendInfo(c, p, info(p, true), from);
      c.conn.send("outage", c.vars.outage);
      c.conn.send("launches", c.vars.launches);
      c.conn.send("graveyard", c.vars.graves);
      c.conn.send("statue", shownStatue(c.state.statue));
      c.conn.send("grid", c.vars.grid.grid);
      c.conn.send("keynotes", c.vars.keynotes);
      c.conn.send("stars", starsOf(c.state.stars ?? NO_STARS));
      c.conn.send("barrel", c.vars.barrel);
      if (p.room === "inn") {
        sendJukebox(c, Date.now(), userId);
      }
      if (p.room === "basement") {
        sendPoker(c, Date.now(), userId);
        sendRoulette(c, userId);
      }
      return snapshot(c.state, c.vars.online, c.vars.weather, p, chatOf(c.db, p.room));
    },

    step: (c, rawDir: unknown): StepResult => {
      const userId = requireUser(c.conn.state);
      const p = c.state.players[userId];
      if (!p || !isFacing(rawDir)) return null;
      const now = Date.now();
      touch(c, p, now);
      // At a game table: the arrow keys do nothing until the game ends.
      if (p.state === "playing") return correction(p);
      // At the poker table: leave it first (a hand in play is theirs to fold).
      if (pokerSeated(c, userId))
        return { notice: "🃏 You're at the poker table. Leave the table to get up." };
      // Back from being away: the first key press returns them to where they were.
      if (wake(c.state, p)) {
        c.vars.dirty.add(p.id);
        return correction(p);
      }
      const s = c.vars.steps.get(userId) ?? { budget: STEP_BURST, at: 0 };
      const budget = takeStep(s.budget, s.at, now, stepPace(p.polseUntil ?? 0, now));
      if (budget === null) return correction(p);
      c.vars.steps.set(userId, { budget, at: now });

      c.vars.fishing.delete(userId);
      const wasSeated = p.state !== "idle";
      p.facing = rawDir;
      p.state = "idle";
      c.vars.dirty.add(p.id);
      // Walking off ends a dance (turning on the spot too: an arrow key is how you walk away), and puts the rod away.
      const danced = stopDance(p);
      if (stopFishing(p) || danced) sendInfo(c, p, info(p, true));
      return typedSwitch(stepTarget(mapOf(p.room), p.x, p.y, rawDir), "kind", {
        move: (target) => {
          if (p.room === "town" && onProp(c.state, c.vars, target.x, target.y)) return correction(p);
          p.x = target.x;
          p.y = target.y;
          return null;
        },
        blocked: () => (wasSeated ? correction(p) : null),
        portal: (target) => {
          const doors = p.companyId === null ? [] : doorsOf(c.state, p.companyId);
          const dest = portal(p.room, target, p.companyId, plots(c.state), doors);
          if ("notice" in dest) return { notice: dest.notice };
          Object.assign(p, dest);
          countVisit(c, p);
          return correction(p);
        },
      });
    },

    /**
     * A tapped arrow key: face that way without taking the step, so a tap only turns (see `turnStep`). Only on
     * your feet, and everyone in the room sees it (`moves`). It spends the step budget like a step.
     */
    turn: (c, rawDir: unknown): StepResult => {
      const userId = requireUser(c.conn.state);
      const p = c.state.players[userId];
      if (!p || !isFacing(rawDir) || p.state !== "idle") return null;
      const now = Date.now();
      touch(c, p, now);
      const s = c.vars.steps.get(userId) ?? { budget: STEP_BURST, at: 0 };
      const budget = takeStep(s.budget, s.at, now, stepPace(p.polseUntil ?? 0, now));
      if (budget === null) return correction(p);
      c.vars.steps.set(userId, { budget, at: now });
      p.facing = rawDir;
      c.vars.dirty.add(p.id);
      if (stopDance(p)) sendInfo(c, p, info(p, true));
      return null;
    },

    /** Space: a hop, shown to everyone in the room. Only on your feet, and one at a time. */
    jump: (c): void => {
      const userId = requireUser(c.conn.state);
      const p = c.state.players[userId];
      const now = Date.now();
      if (p?.state !== "idle" || now - (c.vars.jumps.get(userId) ?? 0) < JUMP_MS) return;
      c.vars.jumps.set(userId, now);
      touch(c, p, now);
      sendToRoom(c, p.room, "jump", userId);
    },

    /**
     * Something to do with your pet (`PET_ACTS`): the room sees the pet react (`petPlay`, with the owner's id).
     * A stroke and a trick are free and only slowed (`PET_COOLDOWN_MS`); a treat costs coins out of the wallet and
     * is capped per day by `town.treat`. Returns the reason it didn't happen, or null.
     */
    petPlay: async (c, what: unknown): Promise<string | null> => {
      const userId = requireUser(c.conn.state);
      const p = c.state.players[userId];
      if (!p || !isPetAct(what)) return null;
      if (!p.look.pet) return "You don't have a pet with you.";
      // In their own office the pet is curled up in its bed (drawn on the client): let it sleep.
      if (ownerOfOffice(p.room) === userId) return "Your pet is asleep in its bed.";
      const now = Date.now();
      const last = c.vars.petPlays.get(userId) ?? {};
      if (now - (last[what] ?? 0) < PET_COOLDOWN_MS[what]) return "Give your pet a moment.";
      c.vars.petPlays.set(userId, { ...last, [what]: now });
      touch(c, p, now);
      if (what === "treat") {
        try {
          const left = await main(c.client()).town.treat(userId);
          sendToRoom(c, p.room, "petPlay", { userId, act: what });
          return left === 0 ? "That was the last treat for today." : null;
        } catch (err) {
          const code = (err as { code?: string }).code;
          if (code === "limit" || code === "too_poor") return (err as Error).message;
          console.warn(`[pet] treat ${userId}: ${String(err)}`);
          return "That didn't work. Try again.";
        }
      }
      sendToRoom(c, p.room, "petPlay", { userId, act: what });
      return null;
    },

    /**
     * The dance bar: start a dance you know (a free one, or one in your bag), or stop with 0. It goes on until
     * you stop it, step, sit down or leave; everyone in the room sees it (`info.dance`).
     */
    dance: async (c, index: unknown): Promise<void> => {
      const userId = requireUser(c.conn.state);
      const p = c.state.players[userId];
      if (!p) return;
      const now = Date.now();
      if (!c.vars.dances.take(String(userId), now))
        throw new UserError("Slow down a little.", { code: "rate_limited" });
      touch(c, p, now);
      if (index === 0) {
        if (stopDance(p)) sendInfo(c, p, info(p, true));
        return;
      }
      const d = Number.isInteger(index) ? danceAt(index as number) : undefined;
      if (!d) throw new UserError("That's not a dance.", { code: "not_found" });
      const standing = () => {
        if (p.state !== "idle")
          throw new UserError("Get up first: you dance on your feet.", { code: "busy" });
      };
      standing();
      if (!isFree(d) && !(await main(c.client()).town.knowsDance(userId, danceId(d.index))))
        throw new UserError(`Learn ${d.name} at Thread & Token first.`, { code: "not_owned" });
      // They may have sat down or started a game while `town` answered.
      standing();
      p.dance = d.index;
      p.danceSince = now;
      sendInfo(c, p, info(p, true));
    },

    /** E while facing a free seat: sits you on it (beds lie you down). */
    sit: (c, facing: unknown): StepResult => {
      const p = free(c);
      if (!p) return null;
      const userId = p.id;
      touch(c, p, Date.now());
      if (isFacing(facing)) p.facing = facing;
      const [dx, dy] = DIRS[p.facing];
      const x = p.x + dx;
      const y = p.y + dy;
      const seat = mapOf(p.room).kind(x, y).seat;
      // A card-room chair is for the poker table (`pokerSit`), not for resting in.
      if (seat && mapOf(p.room).kind(x, y).poker) return { notice: "🃏 That chair is at the poker table." };
      // At an outage picnic the blankets are seats too, and sitting on one earns its badge.
      const outage = p.room === "town" && onBlanket(x, y) ? c.vars.outage : null;
      const taken = Object.values(c.state.players).some((o) => o.room === p.room && o.x === x && o.y === y);
      if (!seat && !outage) return null;
      if (taken) return { notice: "Someone's already there." };
      Object.assign(p, { x, y, state: "sit", facing: seat === "chair" ? "up" : "down" });
      if (stopDance(p)) sendInfo(c, p, info(p, true));
      c.vars.dirty.add(p.id);
      // A bench is the day's bench quest, once per bench.
      if (TAVERN && seat === "bench") questEvent(c, userId, "bench", `bench:${p.room}:${x},${y}`);
      if (outage)
        void main(c.client())
          .town.picnicked(userId, outage.since)
          .then((fresh) => {
            if (fresh) c.conn.send("notice", { text: PICNIC_BADGE } satisfies Notice);
          })
          .catch((err) => console.warn(`[picnic] ${userId}: ${String(err)}`));
      return correction(p);
    },

    /** E while facing the fountain in the town square or the tip jar on the Tavern's bar: a coin in (1 coin out of the wallet, `town.toss`). */
    toss: async (c, facing: unknown): Promise<StepResult> => {
      const p = free(c);
      if (p?.room !== "town" && p?.room !== "inn") return null;
      touch(c, p, Date.now());
      if (isFacing(facing)) p.facing = facing;
      const [dx, dy] = DIRS[p.facing];
      if (mapOf(p.room).kind(p.x + dx, p.y + dy).tosses !== true) return null;
      const now = Date.now();
      if (now - (c.vars.tosses.get(p.id) ?? 0) < TOSS_MS) return { notice: "⛲ One coin at a time." };
      c.vars.tosses.set(p.id, now);
      try {
        await main(c.client()).town.toss(p.id);
      } catch (err) {
        if ((err as { code?: string }).code === "too_poor")
          return { notice: "⛲ Not a coin to spare right now." };
        console.warn(`[toss] ${p.id}: ${String(err)}`);
        return { notice: "That didn't work. Try again." };
      }
      return { notice: "⛲ Plink. You toss a coin in and wish for a green CI." };
    },

    /**
     * E facing the fastelavn barrel on Fastelavn Sunday: a whack (`town.whack`). The one that breaks it makes its
     * player kattekonge; the town hears, and everyone who whacked it is told what they found.
     */
    whack: async (c, facing: unknown): Promise<StepResult> => {
      const p = free(c);
      if (p?.room !== "town") return null;
      const now = Date.now();
      touch(c, p, now);
      if (isFacing(facing)) p.facing = facing;
      const [dx, dy] = DIRS[p.facing];
      if (!isBarrel(p.x + dx, p.y + dy, now)) return null;
      if (now - (c.vars.whacks.get(p.id) ?? 0) < WHACK_MS) return null;
      c.vars.whacks.set(p.id, now);
      let r: Whack;
      try {
        r = await main(c.client()).town.whack(p.id);
      } catch (err) {
        console.warn(`[whack] ${p.id}: ${String(err)}`);
        return { notice: "That didn't work. Try again." };
      }
      keepBarrel(c, r.barrel);
      const { king, hits } = r.barrel;
      if (r.loot) {
        await announce(
          c,
          "town",
          `🐱 ${p.name} broke the fastelavn barrel and is kattekonge!`,
          0,
          "🪅",
        ).catch((err) => console.warn(`[whack] announce: ${String(err)}`));
        for (const l of r.loot)
          if (l.userId !== p.id)
            sendToUser(c, l.userId, "notice", { text: lootLine(l), open: "bag" } satisfies Notice);
        const mine = r.loot.find((l) => l.userId === p.id);
        return { notice: `🐱 You broke it: kattekonge! ${mine ? lootLine(mine) : ""}`.trim() };
      }
      if (king) return { notice: `🐱 Already broken. ${king.name} is kattekonge this year.` };
      return { notice: `🪅 Whack! ${HITS - hits} to go.` };
    },

    /** E while facing a coffee machine, or ordered at the Tavern's bar: one more cup, and everyone sees you shake. */
    drink: (c, facing: unknown): StepResult => {
      const p = free(c);
      if (!p) return null;
      const now = Date.now();
      touch(c, p, now);
      if (isFacing(facing)) p.facing = facing;
      const [dx, dy] = DIRS[p.facing];
      const at = mapOf(p.room).kind(p.x + dx, p.y + dy);
      if (!at.pours && !at.orders) return null;
      p.coffeeUntil = drinkCoffee(p.coffeeUntil ?? 0, now);
      sendInfo(c, p, info(p, c.vars.online.has(p.id)));
      if (TAVERN && p.room === "inn") questEvent(c, p.id, "coffee", `coffee:${now}`);
      const cups = Math.round(cupsLeft(p.coffeeUntil, now));
      return { notice: COFFEE_LINES[Math.min(cups, COFFEE_LINES.length) - 1]! };
    },

    /** E at the pølsevogn while it's open: a free rød pølse, and a quicker walk for a while. */
    eat: (c, facing: unknown): StepResult => {
      const p = free(c);
      if (p?.room !== "town") return null;
      const now = Date.now();
      touch(c, p, now);
      if (isFacing(facing)) p.facing = facing;
      if (!facesCart(p.x, p.y, p.facing)) return null;
      if (!cartOpen(now)) return { notice: "🌭 Lukket. The pølsevogn opens 11:00 to 14:00." };
      if (hasPolse(p.polseUntil ?? 0, now)) return { notice: "🌭 You're still full from the last one." };
      p.polseUntil = now + POLSE.ms;
      sendInfo(c, p, info(p, c.vars.online.has(p.id)));
      return { notice: `🌭 One rød pølse, med det hele. You walk quicker for ${POLSE.ms / 60_000} minutes.` };
    },

    /** E on the Tavern's tap, or ordered at its bar: the day's special, free, and a glow or a jitter for 15 minutes. */
    tavern: (c, facing: unknown): StepResult => {
      const p = free(c);
      if (!TAVERN || p?.room !== "inn") return null;
      const now = Date.now();
      touch(c, p, now);
      if (isFacing(facing)) p.facing = facing;
      const [dx, dy] = DIRS[p.facing];
      const at = mapOf(p.room).kind(p.x + dx, p.y + dy);
      if (!at.serves && !at.orders) return null;
      if (hasSpecial(p.specialUntil ?? 0, now)) return { notice: "🍽 You've still got the last one in you." };
      p.specialUntil = serveUntil(now);
      sendInfo(c, p, info(p, c.vars.online.has(p.id)));
      const how = specialBuff(p.specialUntil) === "glow" ? "You glow" : "You buzz";
      return {
        notice: `${specialOn(new Date(now))}. On the house. ${how} for ${SPECIAL.ms / 60_000} minutes.`,
      };
    },

    fishingCast: (c, facing: unknown): CastReply => {
      const p = free(c);
      if (p?.room !== "town" || p.state !== "idle" || !isFacing(facing))
        return { ok: false, message: "Stand by the pond and face the water to fish." };
      const water = fishingWater(mapOf(p.room), p.x, p.y, facing);
      if (!water) return { ok: false, message: "Stand by the pond and face the water to fish." };
      if (iceOver(c.vars.weather))
        return { ok: false, message: "The pond is frozen. Come back when it thaws." };
      const now = Date.now();
      const pending = c.vars.fishing.get(p.id);
      if (pending && now < pending.endsAt) return { ok: true, cast: pending, now };
      if (now - (c.vars.fishingStarts.get(p.id) ?? 0) < CAST_COOLDOWN_MS)
        return { ok: false, message: "Give the pond a moment before casting again." };
      touch(c, p, now);
      p.facing = facing;
      c.vars.dirty.add(p.id);
      const cast = newCast(p.x, p.y, water, now);
      c.vars.fishing.set(p.id, cast);
      c.vars.fishingStarts.set(p.id, now);
      p.angling = { waterX: cast.waterX, waterY: cast.waterY, biteAt: cast.biteAt, endsAt: cast.endsAt };
      p.landing = null;
      sendInfo(c, p, info(p, true));
      return { ok: true, cast, now };
    },

    fishingReel: async (c): Promise<ReelReply> => {
      const p = free(c);
      const cast = p && c.vars.fishing.get(p.id);
      if (!p || !cast) return { ok: false, message: "Cast a line first." };
      // Consume before awaiting the journal write: two tabs cannot claim the same fish.
      c.vars.fishing.delete(p.id);
      if (stopFishing(p)) sendInfo(c, p, info(p, true));
      const now = Date.now();
      if (
        p.room !== "town" ||
        p.state !== "idle" ||
        p.x !== cast.x ||
        p.y !== cast.y ||
        iceOver(c.vars.weather)
      )
        return { ok: false, message: "Your line came loose. Cast again from the bank." };
      touch(c, p, now);
      const phase = fishingPhase(cast, now);
      if (phase !== "bite")
        return {
          ok: false,
          message:
            phase === "waiting" ? "Too soon! Wait for the bobber to dip." : "It got away! Try another cast.",
        };
      const caught = rollCatch(pondTime(now, c.vars.weather.kind));
      const landed = await main(c.client()).town.recordFish(p.id, caught);
      // Held up for the room to see, if they're still on the bank.
      if (p.x === cast.x && p.y === cast.y && p.state === "idle") {
        p.landing = { fish: caught.fish, waterX: cast.waterX, waterY: cast.waterY, at: Date.now() };
        sendInfo(c, p, info(p, true));
      }
      return { ok: true, catch: caught, ...landed };
    },

    fishingCancel: (c): void => {
      const userId = requireUser(c.conn.state);
      c.vars.fishing.delete(userId);
      const p = c.state.players[userId];
      // The rod goes away with the panel; a catch still being held up stays up for its moment.
      if (p?.angling) {
        p.angling = null;
        sendInfo(c, p, info(p, true));
      }
    },

    /** The Tavern's jukebox: put a track on, if nothing plays and you've waited out your minute. */
    jukeboxPlay: (c, track: unknown): string | null => {
      const p = free(c);
      if (!TAVERN || p?.room !== "inn") return "The jukebox is in the Tavern.";
      const now = Date.now();
      touch(c, p, now);
      const r = start(c.vars.jukebox, String(track), p.id, c.vars.jukeStarts.get(p.id), now);
      if (!r.ok) {
        if (r.why === "busy") return "Something is already playing.";
        if (r.why === "cooldown") return "Give someone else a turn. One track a minute.";
        return "That track isn't on the jukebox.";
      }
      c.vars.jukebox = r.jukebox;
      c.vars.jukeStarts.set(p.id, now);
      sendJukebox(c, now);
      return null;
    },

    /** Vote to skip the track: two votes, or the majority of a small room. */
    jukeboxSkip: (c): string | null => {
      const p = free(c);
      if (!TAVERN || p?.room !== "inn") return "The jukebox is in the Tavern.";
      const now = Date.now();
      touch(c, p, now);
      if (!c.vars.jukebox) return "Nothing is playing.";
      c.vars.jukebox = voteSkip(c.vars.jukebox, p.id, inTavern(c));
      jukeboxBeat(c, now);
      return null;
    },

    /** E while facing a chair at the poker table: buys you in (the buy-in from your wallet) and sits you down. */
    pokerSit: async (c, facing: unknown): Promise<StepResult> => {
      const p = free(c);
      if (!TAVERN || p?.room !== "basement") return null;
      const now = Date.now();
      touch(c, p, now);
      if (isFacing(facing)) p.facing = facing;
      const [dx, dy] = DIRS[p.facing];
      const at = chairAt(p.x + dx, p.y + dy);
      if (at < 0) return null;
      if (!c.vars.pokerActs.take(String(p.id), now)) return { notice: "🃏 Easy. One move at a time." };
      return pokerSitDown(c, p, at);
    },

    /**
     * The Games box's "Join" on the poker table: into the net cafe from anywhere and straight into a free chair, the
     * buy-in out of the wallet. If the buy-in fails they are in the net cafe all the same, with the reason as a notice.
     */
    pokerJoin: async (c): Promise<StepResult> => {
      const p = free(c);
      if (!TAVERN || !p) return null;
      const now = Date.now();
      touch(c, p, now);
      if (!c.vars.pokerActs.take(String(p.id), now)) return { notice: "🃏 Easy. One move at a time." };
      const t = c.vars.poker;
      if (seatOf(t, p.id) >= 0) return { notice: "🃏 You're at the table already." };
      const chairs = pokerChairs();
      const at = chairs.findIndex(
        (ch, i) =>
          !t.seats[i] &&
          !Object.values(c.state.players).some((o) => o.room === "basement" && o.x === ch.x && o.y === ch.y),
      );
      if (at < 0) return { notice: "🃏 The poker table is full." };
      if (p.room !== "basement") {
        Object.assign(p, roomEntry("basement"), { state: "idle" });
        c.vars.dirty.add(p.id);
        countVisit(c, p);
      }
      const sat = await pokerSitDown(c, p, at);
      if (sat && "notice" in sat) {
        c.conn.send("notice", { text: sat.notice } satisfies Notice);
        return correction(p);
      }
      return sat;
    },

    /** E on or facing a free spot at the roulette table: takes the spot (moving you onto it, facing the table). */
    rouletteSit: (c, facing: unknown): StepResult => {
      const p = free(c);
      if (!p || p.room !== "basement") return null;
      touch(c, p, Date.now());
      if (isFacing(facing)) p.facing = facing;
      const r = c.vars.roulette;
      if (r.seats.some((s) => s.userId === p.id)) return null;
      let spot = spotAt(p.x, p.y);
      if (spot < 0) {
        const [dx, dy] = DIRS[p.facing];
        spot = spotAt(p.x + dx, p.y + dy);
      }
      if (spot < 0) return null;
      if (r.seats.length >= SPOTS) return { notice: "The table is full. You can watch." };
      if (rouletteTaken(c, p, spot)) return { notice: "Someone's already there." };
      const [x, y] = rouletteSpots()[spot]!;
      if (p.state === "sit" && (p.x !== x || p.y !== y)) return null;
      return rouletteSeat(c, p, spot);
    },

    /**
     * Roulette from anywhere: the table is always the net cafe's, shared with whoever else is playing, so starting
     * one takes you down there and onto the first free spot. If it is full you are in the net cafe all the same,
     * with the reason as a notice, and can watch.
     */
    rouletteJoin: (c): StepResult => {
      const p = free(c);
      if (!p) return null;
      touch(c, p, Date.now());
      const r = c.vars.roulette;
      if (r.seats.some((s) => s.userId === p.id)) return { notice: "You're at the table already." };
      const spots = rouletteSpots();
      const spot = spots.findIndex((_, i) => !rouletteTaken(c, p, i));
      if (p.room !== "basement") {
        Object.assign(p, roomEntry("basement"), { state: "idle" });
        c.vars.dirty.add(p.id);
        countVisit(c, p);
      }
      if (spot < 0 || r.seats.length >= SPOTS) {
        c.conn.send("notice", { text: "The roulette table is full. You can watch." } satisfies Notice);
        return correction(p);
      }
      return rouletteSeat(c, p, spot);
    },

    /** Gives up your spot at the roulette table (stakes still open this round go back to your wallet). */
    rouletteLeave: (c): null => {
      rouletteLeave(c, requireUser(c.conn.state));
      return null;
    },

    /** Sets your whole bet set for this round (an empty list clears it); only while bets are open. The stakes leave your wallet now. */
    rouletteBet: async (c, raw: unknown): Promise<StepResult> => {
      const p = free(c);
      if (!p || p.room !== "basement") return null;
      const r = c.vars.roulette;
      const me = r.players.get(p.id);
      if (!me) return { notice: "Take a spot at the table first." };
      if (!c.vars.rouletteActs.take(String(p.id), Date.now())) return { notice: "Easy. One move at a time." };
      if (r.phase !== "betting" || r.busy || Date.now() >= r.phaseEndsAt)
        return { notice: "Bets are closed." };
      if (r.betting.has(p.id)) return { notice: "One moment." };
      const round = r.round;
      r.betting.add(p.id);
      try {
        const out = await main(c.client()).town.rouletteBet(p.id, round, raw);
        if (r.players.get(p.id) === me && r.round === round) {
          me.bets = out.bets;
          sendRoulette(c);
        } else
          await main(c.client())
            .town.rouletteRefund(p.id, round)
            .catch((err) => console.warn(`[roulette] refund: ${String(err)}`));
        return null;
      } catch (err) {
        const code = (err as { code?: unknown }).code;
        if (code === "bad_bet" || code === "too_poor" || code === "closed")
          return { notice: (err as Error).message };
        console.warn(`[roulette] bet: ${String(err)}`);
        return { notice: "The table couldn't take that. Try again." };
      } finally {
        r.betting.delete(p.id);
      }
    },

    /** Says you are done betting; when every seated player is, the wheel spins early. */
    rouletteReady: (c, ready: unknown): StepResult => {
      const p = free(c);
      if (!p || p.room !== "basement") return null;
      const r = c.vars.roulette;
      const me = r.players.get(p.id);
      if (!me) return { notice: "Take a spot at the table first." };
      if (!c.vars.rouletteActs.take(String(p.id), Date.now())) return { notice: "Easy. One move at a time." };
      if (r.phase !== "betting" || r.busy || Date.now() >= r.phaseEndsAt)
        return { notice: "Bets are closed." };
      me.ready = ready === true;
      sendRoulette(c);
      return null;
    },

    /** The Tavern's poker table: take a bet or a fold (`type`, and `to` for a raise: the total bet on this street). */
    pokerAct: (c, type: unknown, to: unknown): string | null => {
      const p = free(c);
      if (!TAVERN || p?.room !== "basement")
        return "The poker table is in the net cafe, downstairs at the Tavern.";
      const now = Date.now();
      touch(c, p, now);
      if (!c.vars.pokerActs.take(String(p.id), now)) return "Easy. One move at a time.";
      const t = c.vars.poker;
      const at = seatOf(t, p.id);
      if (at < 0 || t.seats[at]!.leaving) return "You're not at the poker table.";
      const action = parseAction(type, to);
      if (!action) return "That's not a move.";
      try {
        act(t, at, action, now);
      } catch (err) {
        if (err instanceof PokerError) return err.message;
        throw err;
      }
      pokerSync(c, now);
      return null;
    },

    /** Stands up from the poker table: a hand in play is folded, and your stack goes back to your wallet. */
    pokerLeave: (c): string | null => {
      const p = free(c);
      if (!TAVERN || p?.room !== "basement")
        return "The poker table is in the net cafe, downstairs at the Tavern.";
      touch(c, p, Date.now());
      pokerStandUp(c, p.id);
      return null;
    },

    /**
     * G: the drop you're on (standing on it or a rug, sitting on a seat), else a piece nobody can be on
     * that you face. Off an office floor, only its owner takes anything. `town` puts it in your bag.
     */
    take: async (c): Promise<null | { notice: string; drop?: Drop }> => {
      const userId = requireUser(c.conn.state);
      const p = c.state.players[userId];
      if (!p || (p.state !== "idle" && p.state !== "sit")) return null;
      touch(c, p, Date.now());
      const map = mapOf(p.room);
      const [dx, dy] = DIRS[p.facing];
      const [fx, fy] = [p.x + dx, p.y + dy];
      const here = dropsIn(p.room);
      const on = here.find((d) => dropCovers(d, p.x, p.y) && (p.state === "sit" || map.walkable(p.x, p.y)));
      // Facing it: what blocks, or any piece of furniture, even a seat or a rug that you could stand on.
      const d =
        on ??
        here.find(
          (d) =>
            dropCovers(d, fx, fy) &&
            ((!map.walkable(fx, fy) && !map.kind(fx, fy).seat) || pieceOfDrop(d) !== undefined),
        );
      if (!d) return null;
      return takeDrop(c, p, userId, d);
    },

    /**
     * Undo of a placement: puts the furniture piece `id` back (same rules as `take`, but by id, so it needs
     * no facing). It is gone, someone else's, or not furniture: a notice, and nothing changes.
     */
    putBack: async (c, id: unknown): Promise<null | { notice: string; drop?: Drop }> => {
      const userId = requireUser(c.conn.state);
      const p = c.state.players[userId];
      if (!p || (p.state !== "idle" && p.state !== "sit")) return { notice: "Not now." };
      if (!Number.isInteger(id)) throw new UserError("Pick a piece.", { code: "bad_request" });
      touch(c, p, Date.now());
      const d = dropsIn(p.room).find((o) => o.id === id);
      if (!d || !pieceOfDrop(d)) return { notice: "That's gone." };
      return takeDrop(c, p, userId, d);
    },

    /**
     * Everything of yours in this room away: your office's pieces to your bag, or your company's building's
     * to the storeroom. Each piece on its own (one that `town` can't write down stays on the floor).
     */
    putAway: async (c): Promise<{ notice: string; count: number }> => {
      const userId = requireUser(c.conn.state);
      const p = c.state.players[userId];
      if (!p || (p.state !== "idle" && p.state !== "sit")) return { notice: "Not now.", count: 0 };
      touch(c, p, Date.now());
      const office = ownerOfOffice(p.room) === userId;
      const building =
        p.companyId !== null && (p.room === `hq:${p.companyId}` || p.room === commonRoom(p.companyId));
      if (!office && !building)
        return { notice: "Put things away in your own office or your company's building.", count: 0 };
      const mine = dropsIn(p.room).filter(
        (d) => pieceOfDrop(d) && (office ? d.co === undefined : d.co === p.companyId),
      );
      let count = 0;
      let failed = 0;
      for (const d of mine) {
        // Someone else may have taken or moved it while the last one was written down.
        if (!dropsIn(p.room).some((o) => o.id === d.id)) continue;
        lift(c, d);
        const took = await main(c.client())
          .town.pickUp(d.id, userId, d.room)
          .catch((err) => {
            console.warn(`[putAway] ${d.id}: ${String(err)}`);
            return null;
          });
        if (took === null) {
          lay(c, d);
          failed++;
        } else if (took) count++;
      }
      return { notice: putAwayNotice(count, failed, office), count };
    },

    /**
     * Moves a piece of furniture you may take (your office's, or your company's) to the tile (x, y), in one
     * step: it is on the floor the whole time, and if the spot is no good or `town` can't write it down, it
     * stays where it was. `x`, `y` is the piece's top-left tile. `rot` (0 to 3 quarter turns clockwise) turns it,
     * in place or as it moves, and a piece turned sideways lies down its column; left out, it is as turned as it was.
     */
    move: async (
      c,
      id: unknown,
      x: unknown,
      y: unknown,
      rot?: unknown,
    ): Promise<{ notice: string; drop?: Drop }> => {
      const userId = requireUser(c.conn.state);
      const p = c.state.players[userId];
      if (!p || (p.state !== "idle" && p.state !== "sit")) return { notice: "Not now." };
      if (![id, x, y].every((n) => Number.isInteger(n)))
        throw new UserError("Pick a tile.", { code: "bad_request" });
      if (rot !== undefined && !(Number.isInteger(rot) && (rot as number) >= 0 && (rot as number) < 4))
        throw new UserError("Turn it a quarter, half or three quarters.", { code: "bad_request" });
      touch(c, p, Date.now());
      const d = dropsIn(p.room).find((o) => o.id === id);
      const piece = d && pieceOfDrop(d);
      if (!d || !piece) return { notice: "That's gone." };
      if (d.co !== undefined ? d.co !== p.companyId : ownerOfOffice(p.room) !== userId)
        return { notice: "Only its owner moves that." };
      const people = Object.values(c.state.players).filter((o) => o.room === p.room);
      if (people.some((o) => o.state === "sit" && dropCovers(d, o.x, o.y)))
        return { notice: "Someone is on it." };
      if (rot && !canTurn(piece.ch)) return { notice: "That one hangs as it is." };
      const was = rotOf(d.rot);
      const turned = rotOf(rot ?? was);
      if (!furnitureFits(p.room, d, piece, x as number, y as number, people, turned))
        return { notice: "It doesn't fit there." };
      const { rot: _, ...rest } = d;
      const moved: Drop = { ...rest, x: x as number, y: y as number, ...(turned && { rot: turned }) };
      setDrops(p.room, [...dropsIn(p.room).filter((o) => o.id !== d.id), moved]);
      const wrote = await main(c.client())
        .town.moved(moved)
        .catch((err) => {
          console.warn(`[move] ${d.id}: ${String(err)}`);
          return false;
        });
      if (!wrote) {
        setDrops(p.room, [...dropsIn(p.room).filter((o) => o.id !== d.id), d]);
        sendToRoom(c, p.room, "drop", d);
        return { notice: "That didn't work. Try again." };
      }
      sendToRoom(c, p.room, "drop", moved);
      const still = moved.x === d.x && moved.y === d.y;
      return {
        notice: `${turned !== was && (still || sideways(turned) !== sideways(was)) ? "Turned" : "Moved"} the ${dropName(moved)}.`,
        drop: moved,
      };
    },

    say: async (c, rawText: unknown): Promise<void> => {
      const userId = requireUser(c.conn.state);
      const p = c.state.players[userId];
      const text = parseChatText(rawText);
      if (!p || !text) return;
      if (!c.vars.chat.take(String(userId), Date.now()))
        throw new UserError("Slow down a little.", { code: "rate_limited" });
      touch(c, p, Date.now());
      const line = await announce(c, p.room, text, userId, p.name);
      // People mentioned elsewhere hear about it; those in the room already see the line.
      const named = new Set(mentionsIn(text));
      if (named.size === 0) return;
      for (const conn of c.conns.values()) {
        const id = joinedUser(c, conn);
        if (id === null || id === userId) continue;
        const other = c.state.players[id];
        if (other && other.room !== line.room && named.has(other.name)) conn.send("mention", line);
      }
    },

    /**
     * From a player card or the rooms list: into their office, if they have one. Every office is open to everyone.
     * It bypasses their building's door on purpose: its exit leads into your own building.
     */
    visit: (c, targetId: unknown): StepResult => {
      const p = free(c);
      const owner = typeof targetId === "number" ? c.state.players[targetId] : undefined;
      if (!p) return null;
      if (!owner || !hasOffice(owner))
        return {
          notice: owner?.id === p.id ? "You don't have an office yet." : "They don't have an office yet.",
        };
      touch(c, p, Date.now());
      const arrived = enter(c, p, `office:${owner.id}`);
      countVisit(c, p);
      return arrived;
    },

    /** The raid panel's "Go to the dungeon": in through its gate, from anywhere. */
    enterDungeon: (c): StepResult => {
      const p = free(c);
      if (!p) return null;
      touch(c, p, Date.now());
      return enter(c, p, "dungeon");
    },

    /**
     * The rooms list: straight into a room, without walking there. Only where you could walk in yourself: your own
     * company's house and common room, and an office whose owner still has one.
     */
    goTo: (c, rawRoom: unknown): StepResult => {
      const p = free(c);
      const room = parseRoom(rawRoom);
      if (!p || !room || room === p.room) return null;
      const to = room === "town" ? townSpawn() : roomEntry(room);
      if (!canReturn(c.state, p, to)) return { notice: "You can't get in there." };
      touch(c, p, Date.now());
      Object.assign(p, to, { state: "idle" });
      c.vars.dirty.add(p.id);
      countVisit(c, p);
      return correction(p);
    },

    /** After a game: back to where you were before it. */
    back: (c): StepResult => {
      const p = free(c);
      if (!p?.back) return null;
      // Somewhere they can't be any more: they stay where the game left them.
      if (canReturn(c.state, p, p.back)) Object.assign(p, p.back);
      p.state = "idle";
      p.back = null;
      c.vars.dirty.add(p.id);
      return correction(p);
    },

    // MARK: Games (from `arcade` and `match`)

    /**
     * A match starts: its players gather in the town square. At a table, they're moved
     * there and held until it ends. In an arena (long games), their desk becomes their
     * rest spot: resting players sit down there, and online ones keep walking around.
     */
    gather: (c, id: number, game: GameId, players: number[], hold: boolean): void => {
      requireInternal(c.conn.state);
      c.state.games ??= {};
      const games = c.state.games;
      const kind = hold ? "table" : "arena";
      const { w, h } = spotSize(kind, players.length);
      const host = c.state.players[players[0]!];
      const from: [number, number] = host?.room === "town" ? [host.x, host.y] : TOWN_SPAWN;
      const map = mapOf("town");
      const others = Object.values(games).map((g) => g.spot);
      const at = findSpot(map, from, w, h, others) ?? findSpot(map, TOWN_SPAWN, w, h, others);
      if (!at) return;
      const spot: Spot = { ...at, w, h, kind };
      const seats = seatsFor(spot, players.length);
      games[id] = {
        id,
        game,
        spot,
        players,
        seats,
        status: {},
        board: null,
        watchers: 0,
        headline: null,
        endsAt: null,
      };
      for (const [i, userId] of players.entries()) {
        const p = c.state.players[userId];
        if (!p) continue;
        const seat = seats[i]!;
        if (hold) {
          // Remember where they were, like resting does, so Back takes them there after.
          // Resting players keep the spot they had before resting, or at least their bed.
          if (p.state === "idle" || p.state === "sit") p.back = spotOf(p, p.state);
          else p.back ??= restedSpot(p);
          Object.assign(p, { room: "town", x: seat.x, y: seat.y, facing: seat.facing, state: "playing" });
          if (stopDance(p)) sendInfo(c, p, info(p, c.vars.online.has(p.id)));
        } else {
          p.arena = seat;
          if (p.state === "away" || p.state === "working") rest(c.state, p, "working");
        }
        c.vars.dirty.add(p.id);
      }
      sendToScreens(c, "game", games[id]);
    },

    /** A match ended: the table goes, the players are free, the town hears who won. */
    release: async (c, id: number, winners: number[], line: string): Promise<void> => {
      requireInternal(c.conn.state);
      const g = c.state.games?.[id];
      if (!g) return;
      delete c.state.games![id];
      const now = Date.now();
      for (const userId of g.players) {
        const p = c.state.players[userId];
        if (!p) continue;
        p.arena = null;
        if (p.state === "playing") p.state = "idle";
        // Offline, or resting at the arena: back to their own bed or desk, keeping where they were.
        if (!c.vars.online.has(p.id) || p.state === "away" || p.state === "working") {
          const before = p.back;
          rest(c.state, p, restState(p, now));
          if (before) p.back = before;
        }
        c.vars.dirty.add(p.id);
      }
      sendToScreens(c, "gameOver", { id, winners });
      if (line) await announce(c, "town", line);
    },

    /** Something happened in a game, said out loud: a bubble over the player (or the table). */
    callout: (c, id: number, player: number | null, text: string): void => {
      requireInternal(c.conn.state);
      if (c.state.games?.[id]) sendToRoom(c, "town", "callout", { id, userId: player, text });
    },

    /** The live status over each player's head, the scoreboard, and how many are watching. */
    gameStatus: (c, id: number, update: GameStatus): void => {
      requireInternal(c.conn.state);
      const g = c.state.games?.[id];
      if (!g) return;
      Object.assign(g, update);
      sendToScreens(c, "game", g);
    },

    /** From `town`, for the admin page: what the plinth shows, what was read, the pin, and the next read. */
    statue: (c): StatueAdmin => {
      requireInternal(c.conn.state);
      const s = c.state.statue ?? NO_STATUE;
      return { ...s, shown: shownStatue(s) };
    },

    /** From `town`, for the admin page: puts `leader` on the plinth over the ranking's, or (null) takes it off. */
    pinStatue: (c, leader: Leader | null): void => {
      requireInternal(c.conn.state);
      setStatue(c, withPin(c.state.statue ?? NO_STATUE, leader, Date.now()));
    },

    /** From `town`. Returns drops a building that lost or gained a door had no place for, to give back. */
    setPlayer: async (c, core: PlayerCore): Promise<number[]> => {
      requireInternal(c.conn.state);
      const old = c.state.players[core.id];
      const before = old?.companyId;
      const hadDoor = doorKey(old);
      const online = c.vars.online.has(core.id);
      // Before `upsert` writes over it: every sync pushes, and most change nothing anyone sees.
      const shown = old && JSON.stringify(info(old, online));
      const p = upsert(c.state, core, Date.now());
      const from = p.room;
      if (before !== undefined && before !== p.companyId) {
        // Changed company: out of the old house (and out of any office with no company at all),
        // and resting players move to the new one.
        if (!online) rest(c.state, p, p.state === "working" ? "working" : "away");
        else if (
          (memberRoomOf(p.room) !== null && memberRoomOf(p.room) !== p.companyId) ||
          (p.companyId === null && ownerOfOffice(p.room) !== null)
        )
          Object.assign(p, townSpawn());
        c.vars.dirty.add(p.id);
      }
      const next = info(p, online);
      if (JSON.stringify(next) !== shown) sendInfo(c, p, next, from);
      // A new name, level or look shows through the house's walls too.
      if (companyOfRoom(p.room) !== null) c.vars.housesStale = true;
      // A door came, went or was renamed: in the old building and the new one.
      const lifted: number[] = [];
      // A level that grew their office: the room grows right and down, so everyone inside stays valid.
      if (buildOffice(c.state, p.id)) lifted.push(...(await rebuildOffice(c, p.id)));
      if (doorKey(p) !== hadDoor)
        for (const id of new Set([before, p.companyId]))
          if (id != null) lifted.push(...(await rebuildHq(c, id)));
      return lifted;
    },

    /**
     * From `town`, when an admin deletes an account: out of the world, and their tabs closed. Their drops
     * go, and so does what's on their office floor: returns those ids, for `town` to give back.
     */
    removePlayer: async (c, userId: number): Promise<number[]> => {
      requireInternal(c.conn.state);
      const drops = [...DROPS.values()]
        .flat()
        .filter((d) => (d.by === userId && d.co === undefined) || d.room === `office:${userId}`);
      for (const d of drops) lift(c, d);
      const ids = drops.map((d) => d.id);
      // Their office goes too; anyone inside stays until they leave.
      delete c.state.offices?.[userId];
      clearOffice(userId);
      const p = c.state.players[userId];
      if (!p) return ids;
      sendToRoom(c, p.room, "moves", { room: p.room, join: [], m: [], leave: [userId] } satisfies Moves);
      delete c.state.players[userId];
      c.vars.housesStale = true;
      for (const vars of [
        c.vars.online,
        c.vars.announced,
        c.vars.steps,
        c.vars.jumps,
        c.vars.petPlays,
        c.vars.tosses,
        c.vars.fishing,
        c.vars.fishingStarts,
        c.vars.whacks,
      ])
        vars.delete(userId);
      for (const set of [c.vars.dirty, c.vars.hidden]) set.delete(userId);
      for (const conn of c.conns.values()) {
        const s = conn.state as ConnState;
        if (s.kind === "user" && s.userId === userId) conn.disconnect("deleted").catch(() => {});
      }
      if (p.companyId !== null) ids.push(...(await rebuildHq(c, p.companyId)));
      return ids;
    },

    /** From `town`. Returns drops the rebuilt town has no place for, to give back. */
    setCompany: (c, company: CompanyInfo): number[] => {
      requireInternal(c.conn.state);
      const before = c.state.companies[company.id];
      // Every member's sync sends it: most often only its tokens today moved, or nothing did.
      if (before && JSON.stringify(before) === JSON.stringify(company)) return [];
      c.state.companies[company.id] = company;
      c.broadcast("companies", Object.values(c.state.companies));
      // The town's map is its plots: only a new company or a moved one rebuilds it.
      if (before?.plot === company.plot) return [];
      buildTown(c.state, c.vars.dirty);
      return liftMisplaced(c, "town");
    },

    /** A company closed. Returns the drops on its building's floor, and any its plot had, to give back. */
    removeCompany: async (c, id: number): Promise<number[]> => {
      requireInternal(c.conn.state);
      delete c.state.companies[id];
      const drops = [...dropsIn(`hq:${id}`), ...dropsIn(commonRoom(id))];
      for (const d of drops) lift(c, d);
      buildTown(c.state, c.vars.dirty);
      const ids = [...drops.map((d) => d.id), ...liftMisplaced(c, "town")];
      await rebuildHq(c, id);
      c.broadcast("companies", Object.values(c.state.companies));
      return ids;
    },

    /** From `town`: an office's wallpaper or floor changed. Whoever is inside sees it. */
    setOfficeInfo: async (c, userId: number, office: Office): Promise<void> => {
      requireInternal(c.conn.state);
      const was = officeOf(c.state, userId);
      if (JSON.stringify(was) === JSON.stringify(office)) return;
      c.state.offices ??= {};
      c.state.offices[userId] = office;
      if (buildOffice(c.state, userId)) await rebuildOffice(c, userId);
    },

    /** From `town`, for the offices list: every office, as it is now. */
    openOffices: (c) => {
      requireInternal(c.conn.state);
      return Object.values(c.state.players)
        .filter((p) => hasOffice(p))
        .map((p) => ({
          id: p.id,
          name: p.name,
          level: p.level,
          company: c.state.companies[p.companyId!]?.name ?? "",
          tier: officeTier(p.level, officeOf(c.state, p.id).size),
          inside: Object.values(c.state.players).filter(
            (o) => o.room === `office:${p.id}` && c.vars.online.has(o.id),
          ).length,
        }));
    },

    /** From `town`: the keynote schedule, changed on the admin page. */
    setKeynotes: (c, list: Keynote[]): void => {
      requireInternal(c.conn.state);
      c.vars.keynotesPushed++;
      keepKeynotes(c, list);
    },

    /** From `town`: a line for one player's open tabs (a company application, a trade, an answer). */
    notify: (c, userId: number, notice: Notice): void => {
      requireInternal(c.conn.state);
      sendToUser(c, userId, "notice", notice);
    },

    /** From `town`: a line for everyone in the game (a toast), and in the town square's chat. */
    announceTown: async (c, text: string, open?: Notice["open"], remark?: string): Promise<void> => {
      requireInternal(c.conn.state);
      const notice: Notice = open ? { text, open } : { text };
      for (const conn of c.conns.values()) if (joinedUser(c, conn) !== null) conn.send("notice", notice);
      await announce(c, "town", text);
      if (TAVERN && remark) barkeepRemark(c, remark);
    },

    /** From `town`: what this week's kills dropped, for everyone (the dungeon flies it to their desk). */
    announceLoot: (c, news: LootNews[]): void => {
      requireInternal(c.conn.state);
      for (const conn of c.conns.values()) if (joinedUser(c, conn) !== null) conn.send("loot", news);
    },

    /**
     * From `town`: an item on the floor of the room its dropper is in. A hat or a pet goes on their tile,
     * or the nearest free one; furniture on the tile they face, or the nearest free floor tile to it
     * where it's in nobody's way (`noFurniture`) and walls nobody in.
     */
    placeDrop: (
      c,
      { id, item, by, co, onto }: { id: number; item: string; by: number; co?: number; onto?: TileAt },
    ): Drop | { notice: string } => {
      requireInternal(c.conn.state);
      const p = c.state.players[by];
      const full = { notice: "There's no room on the floor here." };
      if (p && shopOfRoom(p.room))
        return { notice: "The shopkeeper shakes her head: not on the shop floor." };
      // Company furniture goes only in its own building, or its common room upstairs.
      if (co !== undefined && p?.room !== `hq:${co}` && p?.room !== commonRoom(co))
        return { notice: "Go into your building to put it out." };
      const here = p ? dropsIn(p.room) : [];
      const cap =
        ownerOfOffice(p?.room ?? "town") === null && co === undefined ? DROPS_PER_ROOM : OFFICE_PIECES;
      if (!p || here.length >= cap) return full;
      // Touched grass is earned, not loot: only onto your own office's floor, where nobody else takes it.
      // A company's piece isn't tradeable, so `canDropIn` would refuse it: it was checked against its building above.
      if (co === undefined && !canDropIn(item, p.room, by))
        return { notice: "That one only goes down in your own office." };
      const map = mapOf(p.room);
      const piece = pieceOfDrop({ item });
      const w = piece?.w ?? 1;
      const people = Object.values(c.state.players).filter((o) => o.room === p.room);
      // One drop per tile; furniture lands on nobody, and not in anyone's way.
      const taken = new Set<string>();
      for (const d of here) for (const [tx, ty] of dropTiles(d)) taken.add(`${tx},${ty}`);
      // Nor in front of a poster, where it would hide it and keep anyone from taking it down.
      if (piece && !piece.wall)
        for (const d of here)
          if (pieceOfDrop(d)?.wall) for (const [tx, ty] of dropTiles(d)) taken.add(`${tx},${ty + 1}`);
      if (piece) {
        for (const o of people) taken.add(`${o.x},${o.y}`);
        for (const t of noFurniture(p.room, map)) taken.add(t);
      }
      const games = p.room === "town" ? Object.values(c.state.games ?? {}).map((g) => g.spot) : [];
      // Furniture: from the tile they face, so they choose where it goes. `findSpot` centres a TV on it:
      // facing right, that's one further, or it'd be over them.
      const [ax, ay] = piece ? DIRS[p.facing] : [0, 0];
      const from: [number, number] = [p.x + ax + (ax > 0 ? Math.floor(w / 2) : 0), p.y + ay];
      // Nor where it would leave anyone in the room no way out: the next spot over, then.
      // ponytail: a route per person per spot tried; fine for a room, flood from the exit if it isn't.
      const exit = map.find("x")[0];
      const wallsIn = (at: { x: number; y: number }) => {
        const next = withPieces([{ ch: piece!.ch, ...at }], map);
        return people.some((o) => !route(next, [o.x, o.y], exit!));
      };
      // A poster goes on the wall slot nearest them; it's wall already, so it blocks no one.
      // Furniture put down on a tile they picked (the ghost): that tile or none, by the same rules as `move`.
      if (
        onto &&
        piece &&
        !furnitureFits(p.room, { id, item, room: p.room, ...onto, by, at: 0 }, piece, onto.x, onto.y, people)
      )
        return { notice: "It doesn't fit there." };
      let spot =
        onto && piece
          ? { x: onto.x, y: onto.y }
          : piece?.wall
            ? wallSpot(map, p.x, w, piece.home)
            : findSpot(map, from, w, 1, games, taken);
      // In an office the door, the desk and every seat stay reachable too (`cutsOff`).
      const blocks = (at: { x: number; y: number }) =>
        wallsIn(at) || (ownerOfOffice(p.room) !== null && cutsOff(map, { ch: piece!.ch, ...at }));
      while (!onto && spot && piece && !piece.wall && exit && blocks(spot)) {
        taken.add(`${spot.x},${spot.y}`);
        spot = findSpot(map, from, w, 1, games, taken);
      }
      if (!spot)
        return piece?.wall
          ? { notice: "No bare wall left to hang it: it needs floor to stand on in front of it." }
          : full;
      const drop: Drop = {
        id,
        item,
        room: p.room,
        ...spot,
        by,
        at: Date.now(),
        ...(co !== undefined && { co }),
      };
      lay(c, drop);
      return drop;
    },

    /** From `town`: the room a player stands in right now (null: not in the world), for what is sold where. */
    roomOfPlayer: (c, userId: number): string | null => {
      requireInternal(c.conn.state);
      return c.state.players[userId]?.room ?? null;
    },

    /** From `town`: drops already on a floor (an office's desk and chair, at level 10). */
    placeDrops: (c, drops: Drop[]): void => {
      requireInternal(c.conn.state);
      for (const d of drops) lay(c, d);
    },

    /** From `town`'s sweeper: drops gone back to their droppers. */
    removeDrops: (c, ids: number[]): void => {
      requireInternal(c.conn.state);
      const gone = new Set(ids);
      for (const d of [...DROPS.values()].flat()) if (gone.has(d.id)) lift(c, d);
    },

    /** From `player` after an ingest: offline players work at their desk while agents run. */
    activity: (c, userId: number, lastAt: number, liveAgents: number, burn = 0, hourTokens = 0): void => {
      requireInternal(c.conn.state);
      c.vars.cop.burns.set(userId, { id: userId, tokens: hourTokens, at: Date.now() });
      const p = c.state.players[userId];
      if (!p) return;
      p.lastAgentAt = Math.max(p.lastAgentAt, lastAt);
      // Of what everyone sees (`info`), only the agent count can change here.
      const changed = p.liveAgents !== liveAgents;
      p.liveAgents = liveAgents;
      p.burn = burn;
      const online = c.vars.online.has(userId);
      const from = p.room;
      if (!online) {
        const want = restState(p, Date.now());
        if (p.state !== want) {
          rest(c.state, p, want);
          c.vars.dirty.add(p.id);
        }
      }
      if (changed) sendInfo(c, p, info(p, online), from);
    },
  },
});

// MARK: Helpers (plain functions over state, so the tick and the actions share them)

/** Whether someone has an office: in a company, from `OFFICE_LEVEL`. */
const hasOffice = (p: PlayerCore) => p.companyId !== null && p.level >= OFFICE_LEVEL;

type Vars = {
  online: Map<number, number>;
  users: Map<string, number | null>;
  visited: { day: string; keys: Set<string> };
  dirty: Set<number>;
  announced: Map<number, RoomId>;
  hidden: Set<number>;
  occupancy: string;
  houses: string;
  housesStale: boolean;
  outage: Outage | null;
  launches: Launch[];
  plots: Plot[];
  graves: Stone[];
  keynotes: Keynote[];
  keynotesPushed: number;
  barrel: Barrel | null;
  watched: Set<string>;
  weather: Weather;
  grid: GridState;
  gridAt: number;
  greenSent: Set<number>;
  raiders: string;
  raidersAt: number;
  tavern: TavernClock;
  remarkAt: number;
  jukebox: Jukebox;
  jukeKey: string;
  poker: Table;
  pokerSent: number;
  pokerHole: Map<number, string>;
  pokerBusy: Set<number>;
  pokerFlushing: boolean;
  pokerActs: RateLimiter;
  roulette: RouletteMem;
  rouletteActs: RateLimiter;
};

/** Ticks in a minute, and in the five between flushes: the regulars' plaques (`TavernClock`). */
const MINUTE_TICKS = 600;
const FLUSH_TICKS = 5 * MINUTE_TICKS;

/** Once a minute, whoever is awake in the Tavern earns a minute; every five, `town` hears of them in one call. */
function tavernBeat(
  c: { state: WorldState; vars: Vars; client: () => Parameters<typeof main>[0] },
  n: number,
  now: number,
): void {
  const clock = c.vars.tavern;
  if (n % MINUTE_TICKS === 0) {
    const present = [...c.vars.online.keys()].filter((id) => {
      const p = c.state.players[id];
      return p && counts(p);
    });
    clock.tick(present, now);
  }
  if (n % FLUSH_TICKS !== 0) return;
  const rows = clock.take();
  if (rows.length === 0) return;
  main(c.client())
    .town.tavernMinutes(dayKey(now), rows)
    .catch((err) => {
      clock.restore(rows);
      console.warn(`[tavern] minutes: ${String(err)}`);
    });
}

function upsert(s: WorldState, core: PlayerCore, now: number): WorldPlayer {
  const existing = s.players[core.id];
  if (existing) return Object.assign(existing, core);
  const p: WorldPlayer = {
    ...core,
    ...townSpawn(),
    state: "idle",
    lastInputAt: now,
    lastAgentAt: 0,
    liveAgents: 0,
  };
  s.players[core.id] = p;
  rest(s, p, "away");
  p.back = null; // Nowhere to go back to: a new player wakes up at home.
  return p;
}

function plots(s: WorldState): Map<number, { id: number; name: string }> {
  const out = new Map<number, { id: number; name: string }>();
  for (const co of Object.values(s.companies)) out.set(co.plot, co);
  return out;
}

/**
 * Rebuilds the town for its companies. Anyone now standing inside a new house, or past the edge of a
 * town that shrank, goes back to the square.
 */
function buildTown(s: WorldState, dirty?: Set<number>): void {
  const town = setTown([...plots(s).keys()]);
  for (const p of Object.values(s.players)) {
    const where = p.state === "away" || p.state === "working" ? p.back : p;
    const tile = where?.room === "town" && !p.arena ? town.kind(where.x, where.y) : null;
    if (!tile || tile.walk || tile.seat) continue;
    Object.assign(where!, townSpawn());
    dirty?.add(p.id);
  }
}

/**
 * The doors in a company's building: its members from `OFFICE_LEVEL`, each at the slot stored for them. A
 * new owner takes the lowest free slot; one who left (or moved company, or lost the level) frees theirs, and
 * nobody else's moves.
 */
function doorsOf(s: WorldState, companyId: number): Door[] {
  const members = Object.values(s.players).filter(
    (p) => p.companyId === companyId && p.level >= OFFICE_LEVEL,
  );
  s.doorSlots ??= {};
  const slots = s.doorSlots;
  const kept = new Map<number, number>();
  for (const [id, v] of Object.entries(slots)) {
    if (v.company !== companyId) continue;
    if (members.some((p) => p.id === Number(id))) kept.set(Number(id), v.slot);
    else delete slots[id];
  }
  const placed = assignSlots(
    members.map((p) => p.id),
    kept,
  );
  for (const [id, slot] of placed) slots[id] = { company: companyId, slot };
  return doorsFor(
    members.map((p) => ({
      userId: p.id,
      name: p.name,
      slot: placed.get(p.id)!,
    })),
  );
}

/** What puts a door in a building: their company and name, from level 10. */
const doorKey = (p?: PlayerCore) =>
  p && p.companyId !== null && p.level >= OFFICE_LEVEL ? `${p.companyId}:${p.name}` : "";

/**
 * Rebuilds a company's building for its doors (a closed company's goes). Like `buildTown`, anyone now
 * inside a wall (a hallway that went) goes back to the entry.
 */
function buildHq(s: WorldState, companyId: number, dirty?: Set<number>): void {
  const room = `hq:${companyId}` as const;
  if (s.companies[companyId]) setHq(companyId, doorsOf(s, companyId));
  else HQS.delete(companyId);
  const map = mapOf(room);
  for (const p of Object.values(s.players)) {
    const where = p.state === "away" || p.state === "working" ? p.back : p;
    const tile = where?.room === room ? map.kind(where.x, where.y) : null;
    if (!tile || tile.walk || tile.seat) continue;
    Object.assign(where!, roomEntry(room));
    dirty?.add(p.id);
  }
}

/** Resting, `p` is at their desk while their agents ran in the last `WORKING_MS`, else in bed. */
const restState = (p: WorldPlayer, now: number): "working" | "away" =>
  now - p.lastAgentAt < WORKING_MS ? "working" : "away";

/** Where `p` is now, for coming back to. */
const spotOf = (p: WorldPlayer, state: "idle" | "sit"): NonNullable<WorldPlayer["back"]> => ({
  room: p.room,
  x: p.x,
  y: p.y,
  facing: p.facing,
  state,
});

/** Where a resting player goes back to by default: where they got up, which from the dorm is the Tavern's door. */
const restedSpot = (p: WorldPlayer): NonNullable<WorldPlayer["back"]> =>
  p.room === "upstairs" ? { ...roomEntry("inn"), state: "idle" } : spotOf(p, "idle");

/** Sends `p` to their bed (`away`) or desk (`working`) at home, remembering where they were. */
function rest(s: WorldState, p: WorldPlayer, state: "away" | "working"): void {
  if (p.state === "idle" || p.state === "sit") p.back = spotOf(p, p.state);
  stopDance(p);
  // In a battle, they rest at their arena desk, typing away.
  if (p.arena) {
    Object.assign(p, { room: "town", x: p.arena.x, y: p.arena.y, facing: p.arena.facing, state: "working" });
    return;
  }
  const room = homeRoom(p.companyId);
  const taken = new Set(
    Object.values(s.players)
      .filter((o) => o.id !== p.id && o.room === room)
      .map((o) => `${o.x},${o.y}`),
  );
  Object.assign(p, restSpot(room, state, taken), { state });
}

/**
 * Whether `p` may go back to `to`: a tile you can stand or sit on (the map may have changed since), not
 * a house they've left, not an office that's closed to them or gone.
 */
function canReturn(s: WorldState, p: WorldPlayer, to: Place): boolean {
  const tile = mapOf(to.room).kind(to.x, to.y);
  const house = memberRoomOf(to.room);
  const owner = ownerOfOffice(to.room);
  const o = owner === null ? undefined : s.players[owner];
  return (
    (!!tile.walk || !!tile.seat) &&
    (house === null || house === p.companyId) &&
    (owner === null || (!!o && hasOffice(o)))
  );
}

/**
 * Gets up a resting player: back where they were before resting, if they can
 * still be there (`canReturn`), else up where they lie. False if they weren't
 * resting.
 */
function wake(s: WorldState, p: WorldPlayer): boolean {
  if (p.state !== "away" && p.state !== "working") return false;
  const back = p.back;
  p.back = null;
  if (!back || !canReturn(s, p, back)) {
    // From their bed upstairs (no company, no home to wake in), they get up at the Tavern's door.
    Object.assign(p, p.room === "upstairs" ? roomEntry("inn") : {}, { state: "idle" });
    return true;
  }
  // Someone took their seat meanwhile, or it's gone: stand up there instead.
  const taken = Object.values(s.players).some(
    (o) => o.id !== p.id && o.room === back.room && o.x === back.x && o.y === back.y,
  );
  const seat = mapOf(back.room).kind(back.x, back.y).seat;
  Object.assign(p, back, { state: back.state === "sit" && seat && !taken ? "sit" : "idle" });
  return true;
}

/** Puts `p`'s rod away and their catch back: true if either was showing (their `info` changed). */
function stopFishing(p: WorldPlayer): boolean {
  if (!p.angling && !p.landing) return false;
  p.angling = null;
  p.landing = null;
  return true;
}

/** Ends `p`'s dance, if they're doing one; true if they were (their `info` changed). */
function stopDance(p: WorldPlayer): boolean {
  if (!p.dance) return false;
  p.dance = 0;
  p.danceSince = 0;
  return true;
}

/** Input from `p`: wakes them if they were dozing. */
function touch(c: Sender & { vars: Vars }, p: WorldPlayer, now: number): void {
  p.lastInputAt = now;
  if (!p.dozing) return;
  p.dozing = false;
  sendInfo(c, p, info(p, true));
}

/**
 * Idle players doze where they are (a second screen still shows the town); offline ones switch
 * between desk and bed as their agents start and stop. Returns who just dozed off.
 */
function settle(s: WorldState, v: Vars, now: number): WorldPlayer[] {
  const dozed: WorldPlayer[] = [];
  for (const p of Object.values(s.players)) {
    if (p.state === "playing" || isBot(p.id)) continue;
    if (v.online.has(p.id)) {
      // A dance goes on until it's stopped: nobody nods off in the middle of one.
      if (!p.dozing && !p.dance && now - p.lastInputAt > IDLE_MS) {
        p.dozing = true;
        dozed.push(p);
      }
      continue;
    }
    const want = p.arena ? "working" : restState(p, now);
    if (p.state !== want) {
      rest(s, p, want);
      v.dirty.add(p.id);
    }
  }
  return dozed;
}

/**
 * A table or desk of a game in town, the pølsevogn, a launch stand while it's up, the J-dag truck while it's
 * parked, or a tombstone: nobody walks onto it.
 */
const onProp = (s: WorldState, v: Pick<Vars, "launches" | "graves">, x: number, y: number) =>
  isCart(x, y) ||
  isTruck(x, y, Date.now()) ||
  isBarrel(x, y, Date.now()) ||
  isBonfire(x, y, Date.now()) ||
  (isStand(x, y) && activeLaunches(Date.now(), v.launches).length > 0) ||
  stoneAt(v.graves, x, y) !== undefined ||
  Object.values(s.games ?? {}).some((g) => propTiles(g.spot).some(([px, py]) => px === x && py === y));

/** A line in a room's chat: someone's (`say`), or the town's own by default (a game's result). */
async function announce(
  c: Sender & { db: Sql },
  room: RoomId,
  text: string,
  userId = 0,
  name = "🎮",
): Promise<ChatLine> {
  const at = Date.now();
  const [row] = await all<{ id: number }>(
    c.db,
    "INSERT INTO chat (room, user_id, name, text, at) VALUES (?, ?, ?, ?, ?) RETURNING id",
    room,
    userId,
    name,
    text,
    at,
  );
  await c.db.execute("DELETE FROM chat WHERE room = ? AND id <= ?", room, row!.id - CHAT_KEEP);
  const line: ChatLine = { id: row!.id, room, userId, name, text, at };
  sendToRoom(c, room, "chat", line);
  return line;
}

// MARK: Bots (core/src/bots.ts)

/**
 * The Inn became the Tavern: whoever was saved where a bar or table stands now, or where the door can't
 * be reached (the barkeep's cell), goes back to bed or to the door. Seats that aren't any more stand up.
 */
function tidyInn(s: WorldState): void {
  const map = mapOf("inn");
  const door = roomEntry("inn");
  for (const p of Object.values(s.players)) {
    if (isBot(p.id)) continue;
    // Whoever slept in the Tavern's own beds before there was an upstairs goes up to theirs.
    if (p.room === "inn" && p.companyId === null && (p.state === "away" || p.state === "working")) {
      rest(s, p, p.state);
      continue;
    }
    if (p.room !== "inn") continue;
    const there = map.contains(p.x, p.y) && route(map, [p.x, p.y], [door.x, door.y]) !== null;
    if (there && !(p.state === "sit" && !map.kind(p.x, p.y).seat)) continue;
    if (p.state === "away" || p.state === "working") rest(s, p, p.state);
    else Object.assign(p, door, { state: "idle" });
  }
}

/** Puts every bot where it lives on wake (the square, unless it has a `home`), and drops bots no longer in `BOTS`. */
function placeBots(s: WorldState): void {
  for (const p of Object.values(s.players))
    if (isBot(p.id) && !BOTS.some((b) => b.id === p.id)) delete s.players[p.id];
  for (const b of BOTS)
    s.players[b.id] = {
      id: b.id,
      name: b.name,
      look: b.look,
      level: b.level,
      companyId: null,
      todayTokens: 0,
      ...(b.home ?? townSpawn()),
      state: "idle",
      lastInputAt: 0,
      lastAgentAt: 0,
      liveAgents: 0,
    };
}

const runOf = (
  v: { bots: Map<number, BotRun> },
  id: number,
  every: [number, number],
  now: number,
): BotRun => {
  const run = v.bots.get(id) ?? {
    path: [],
    restUntil: now + between(BOT_PAUSE_MS),
    sayAt: now + between(every),
    following: null,
    followUntil: 0,
    coffee: null,
    cups: 0,
  };
  v.bots.set(id, run);
  return run;
};

/**
 * One step for each bot on a walk, following someone, or on its way to coffee; something new to do for
 * each that has stood around long enough. Returns the bots that just had coffee (they shake).
 */
function walkBots(s: WorldState, v: Vars & { bots: Map<number, BotRun> }, now: number): WorldPlayer[] {
  const map = mapOf("town");
  const inTown = [...v.online.keys()].filter((id) => s.players[id]?.room === "town");
  const drank: WorldPlayer[] = [];
  const live = TAVERN ? liveKeynote(v.keynotes, now) : null;
  for (const b of BOTS) {
    const p = s.players[b.id];
    const run = runOf(v, b.id, b.every, now);
    if (p && GOERS.includes(b) && partyStep(s, v, p, run, live !== null)) continue;
    if (b.still || p?.room !== "town" || now < run.restUntil) continue;
    // An outage picnic: off to its seat on a blanket, and it sits there until it's over (`refreshOutage`).
    // A keynote on the Tavern's screen comes first for those going to it: they're on their way to the door.
    const seat =
      v.outage && !(live && GOERS.includes(b)) ? PICNIC_SEATS[BOTS.indexOf(b) % PICNIC_SEATS.length]! : null;
    if (seat && p.x === seat[0] && p.y === seat[1]) {
      if (p.state !== "sit") {
        Object.assign(p, { state: "sit", facing: "down" });
        v.dirty.add(p.id);
      }
      continue;
    }
    if (seat) {
      Object.assign(run, { following: null, coffee: null });
      if (run.path.length === 0) run.path = route(map, [p.x, p.y], seat) ?? [];
    }
    // Following someone: until they leave town or go offline, or it gets boring.
    if (run.following !== null && (now > run.followUntil || !inTown.includes(run.following))) {
      run.following = null;
      run.restUntil = now + between(BOT_PAUSE_MS);
      continue;
    }
    if (run.following === null && run.path.length === 0) {
      // At the coffee machine.
      if (run.coffee) {
        p.facing = run.coffee;
        run.coffee = null;
        for (let i = Math.round(between(BOT_CUPS)); i > 0; i--)
          p.coffeeUntil = drinkCoffee(p.coffeeUntil ?? 0, now);
        run.cups = Math.round(cupsLeft(p.coffeeUntil ?? 0, now));
        run.sayAt = Math.min(run.sayAt, now);
        run.restUntil = now + between(BOT_PAUSE_MS);
        v.dirty.add(p.id);
        drank.push(p);
        continue;
      }
      const roll = Math.random();
      const follow = b.followChance ?? BOT_FOLLOW_CHANCE;
      // Nobody gets two bots at once.
      const free = inTown.filter((id) => ![...v.bots.values()].some((r) => r.following === id));
      if (free.length > 0 && roll < follow) {
        run.following = pick(free);
        run.followUntil = now + between(BOT_FOLLOW_MS);
        run.sayAt = Math.min(run.sayAt, now + between(BOT_GREET_MS));
      } else if (roll < follow + BOT_COFFEE_CHANCE) {
        const trip = toCoffee(map, p.x, p.y);
        run.path = trip?.path ?? [];
        run.coffee = trip?.facing ?? null;
      } else run.path = wander(map, p.x, p.y) ?? [];
    }
    const leader = run.following === null ? null : s.players[run.following]!;
    // Right next to who it follows, it waits for them to move.
    const dir = leader ? chase(map, p.x, p.y, leader.x, leader.y) : run.path.shift();
    if (!dir) continue;
    const target = stepTarget(map, p.x, p.y, dir);
    p.facing = dir;
    // The town changed under it, or a game table went up: give up on this walk.
    if (target.kind === "move" && !onProp(s, v, target.x, target.y))
      Object.assign(p, { x: target.x, y: target.y });
    else Object.assign(run, { path: [], coffee: null });
    if (!leader && run.path.length === 0 && !run.coffee) run.restUntil = now + between(BOT_PAUSE_MS);
    v.dirty.add(p.id);
  }
  return drank;
}

// MARK: The keynote watch party (core/src/keynote.ts)

/** The town's characters who go to a watch party: the ones that wander (not the barkeep, the cop or shopkeepers). */
const GOERS = BOTS.filter((b) => !b.still && !b.home && b.id !== COP.id);

/**
 * A keynote on the Tavern's screen: a bot going to it walks to the Inn's door and in, then stands in the
 * crowd facing the screen until it's over, when it comes back out the door. True when that's all it does
 * this step; false leaves it to the walk (`walkBots`), with its path to the door set.
 */
function partyStep(s: WorldState, v: Vars, p: WorldPlayer, run: BotRun, live: boolean): boolean {
  const door = outsideDoor("inn");
  if (p.room === "inn") {
    if (live) return true;
    Object.assign(p, door, { state: "idle" });
    run.path = [];
    v.dirty.add(p.id);
    return true;
  }
  if (!live || p.room !== "town") return false;
  Object.assign(run, { following: null, coffee: null });
  if (p.state === "sit") {
    p.state = "idle";
    v.dirty.add(p.id);
  }
  const walk =
    run.path.length || (p.x === door.x && p.y === door.y)
      ? run.path
      : route(mapOf("town"), [p.x, p.y], [door.x, door.y]);
  if (walk?.length) {
    run.path = walk;
    return false;
  }
  // At the door (or with no way to it): in, to the first free spot in the crowd.
  const taken = new Set(
    Object.values(s.players)
      .filter((o) => o.room === "inn")
      .map((o) => `${o.x},${o.y}`),
  );
  const [x, y] = CROWD.find(([cx, cy]) => !taken.has(`${cx},${cy}`)) ?? CROWD[0]!;
  Object.assign(p, { room: "inn", x, y, facing: "left", state: "idle" });
  run.path = [];
  v.dirty.add(p.id);
  return true;
}

/** The crowd at a watch party hops for joy now and then, if anyone is in the Tavern to see it. */
function cheerBots(c: Sender & { vars: Vars }, now: number): void {
  if (!liveKeynote(c.vars.keynotes, now) || !someoneIn(c, "inn")) return;
  for (const b of GOERS)
    if (c.state.players[b.id]?.room === "inn" && Math.random() * HOP_ONE_IN < 1)
      sendToRoom(c, "inn", "jump", b.id);
}

/** Asks `town` for the keynote schedule (a failed call keeps what we had: `town` pushes changes anyway). */
async function refreshKeynotes(c: {
  vars: Vars;
  client: () => Parameters<typeof main>[0];
  broadcast(name: string, ...args: unknown[]): void;
}): Promise<void> {
  try {
    const pushed = c.vars.keynotesPushed;
    const list = await main(c.client()).town.keynotes();
    // A push came while we asked: it's newer than this answer.
    if (c.vars.keynotesPushed === pushed) keepKeynotes(c, list);
  } catch (err) {
    console.warn(`[keynotes] ${String(err)}`);
  }
}

// MARK: Fastelavn (core/src/fastelavn.ts)

/** On Fastelavn the barrel is asked of `town` this often (whacks through this world keep it fresher). */
const BARREL_EVERY_MS = 60_000;

/** What a whacker found: "🪅 In the barrel: 🪙 12 and Cat ears." */
const lootLine = (l: { coins: number; items: string[] }): string =>
  `🪅 In the barrel: 🪙 ${l.coins}${l.items.map((i) => ` and ${itemById(i)?.name ?? i}`).join("")}.`;

/** The barrel off the day is nothing; on it, `town`'s (a failed call keeps what we had). */
async function refreshBarrel(
  c: {
    vars: Vars;
    client: () => Parameters<typeof main>[0];
    broadcast(name: string, ...args: unknown[]): void;
  },
  now: number,
): Promise<void> {
  if (!barrelUp(now)) return keepBarrel(c, null);
  try {
    keepBarrel(c, await main(c.client()).town.barrel());
  } catch (err) {
    console.warn(`[barrel] ${String(err)}`);
  }
}

/** Keeps the barrel and tells everyone when it changed. */
function keepBarrel(
  c: { vars: Vars; broadcast(name: string, ...args: unknown[]): void },
  b: Barrel | null,
): void {
  const was = c.vars.barrel;
  if (was === b || (was && b && was.hits === b.hits && was.king?.id === b.king?.id && was.year === b.year))
    return;
  c.vars.barrel = b;
  c.broadcast("barrel", b);
}

/** Keeps the schedule, and tells everyone when it changed: the screen goes up or down on its own clock. */
function keepKeynotes(
  c: { vars: Vars; broadcast(name: string, ...args: unknown[]): void },
  list: Keynote[],
): void {
  if (sameKeynotes(list, c.vars.keynotes)) return;
  c.vars.keynotes = list;
  c.broadcast("keynotes", list);
}

/** While a keynote is on, whoever is awake in the Tavern gets its badge (once: `town` keeps the row). */
function watchBeat(c: Sender & { vars: Vars; client: () => Parameters<typeof main>[0] }, now: number): void {
  const live = liveKeynote(c.vars.keynotes, now);
  if (!live) return void c.vars.watched.clear();
  for (const id of c.vars.online.keys()) {
    const p = c.state.players[id];
    const key = `${live.id}:${id}`;
    if (p?.room !== "inn" || p.dozing || c.vars.watched.has(key)) continue;
    c.vars.watched.add(key);
    main(c.client())
      .town.keynoteWatched(id, live.id)
      .then((fresh) => {
        if (fresh) sendToUser(c, id, "notice", { text: keynoteBadge(live.title) } satisfies Notice);
      })
      .catch((err) => {
        c.vars.watched.delete(key);
        console.warn(`[keynotes] ${id}: ${String(err)}`);
      });
  }
}

/** The barkeep says of a fresh award, if anyone is in the Tavern to hear it and he hasn't just spoken. */
function barkeepRemark(c: Sender & { vars: Vars }, text: string): void {
  const now = Date.now();
  const here = [...c.vars.online.keys()].some((id) => c.state.players[id]?.room === "inn");
  if (!here || !mayRemark(c.vars.remarkAt, now)) return;
  c.vars.remarkAt = now;
  sendToRoom(c, "inn", "bubble", { userId: BARKEEP.id, text });
}

/** Bots due a line say one over their heads (never in the chat), if anyone online is in the room to hear it. */
function talkBots(c: Sender & { vars: Vars & { bots: Map<number, BotRun> } }, now: number): void {
  const heard = new Set([...c.vars.online.keys()].map((id) => c.state.players[id]?.room));
  for (const b of BOTS) {
    const p = c.state.players[b.id];
    const run = runOf(c.vars, b.id, b.every, now);
    if (!p || now < run.sayAt) continue;
    // In the Tavern, the watch party: the next keynote, or the one on (the crowd cheers more often).
    const keynote = TAVERN && p.room === "inn" ? keynoteTalk(c.vars.keynotes, now) : undefined;
    run.sayAt = now + between(keynote?.live && GOERS.includes(b) ? CHEER_EVERY_MS : b.every);
    const leader = run.following === null ? null : c.state.players[run.following];
    const crowd = [...c.vars.online.keys()].filter((id) => c.state.players[id]?.room === p.room).length;
    const text = lineFor(b, now, { leader, cups: run.cups, crowd, weather: c.vars.weather.kind, keynote });
    run.cups = 0;
    if (!heard.has(p.room)) continue;
    run.restUntil = Math.max(run.restUntil, now + BOT_TALK_PAUSE_MS);
    sendToRoom(c, p.room, "bubble", { userId: b.id, text });
  }
}

// MARK: The 429 Cop (core/src/cop.ts)

/** How fast he runs after a speeder, how long before he gives up, and how long he stands writing. */
const COP_STEP_MS = 180;
const COP_CHASE_MS = 60_000;
const COP_WRITE_MS = 8_000;

/** What the cop knows, in memory: a restart forgets it, and `town` still stops a second ticket in a day. */
interface CopVars {
  /** Each player's last hour of tokens, from their last sync. */
  burns: Map<number, Burn>;
  /** The world day each player was last pulled over. */
  ticketed: Map<number, string>;
  chase: { id: number; tokens: number; until: number; stepAt: number } | null;
  /** Writing up the last one (or catching his breath) until then. */
  freeAt: number;
}

/**
 * Every tick: when he's free and someone in town is speeding (`speeder`), he takes over from his usual
 * stroll (`walkBots` leaves him be while `restUntil` is ahead) and runs to them; next to them, he writes
 * the ticket. Nothing is taken.
 */
function copBeat(
  c: Sender & {
    vars: Vars & { bots: Map<number, BotRun>; cop: CopVars };
    client: () => Parameters<typeof main>[0];
  },
  now: number,
): void {
  const cop = c.state.players[COP.id];
  const run = c.vars.bots.get(COP.id);
  const v = c.vars.cop;
  if (cop?.room !== "town" || !run) return;
  const today = dayKey(now);
  const inTown = (id: number) => c.vars.online.has(id) && c.state.players[id]?.room === "town";
  if (!v.chase) {
    if (run.following !== null || run.coffee || now < v.freeAt) return;
    for (const [id, b] of v.burns) if (now - b.at > BURN_FRESH_MS) v.burns.delete(id);
    const hit = speeder(
      v.burns.values(),
      now,
      (id) =>
        !inTown(id) ||
        v.ticketed.get(id) === today ||
        [...c.vars.bots.values()].some((r) => r.following === id),
    );
    if (!hit) return;
    v.chase = { id: hit.id, tokens: hit.tokens, until: now + COP_CHASE_MS, stepAt: now };
    Object.assign(run, {
      path: [],
      restUntil: now + COP_CHASE_MS + COP_WRITE_MS,
      sayAt: now + COP_CHASE_MS * 2,
    });
    sendToRoom(c, "town", "bubble", { userId: cop.id, text: pullOverLine(c.state.players[hit.id]!.name) });
    return;
  }
  const hunt = v.chase;
  const target = c.state.players[hunt.id];
  const done = () => {
    v.chase = null;
    v.freeAt = now + COP_WRITE_MS;
    Object.assign(run, { restUntil: now + COP_WRITE_MS, sayAt: now + between(COP.every) });
  };
  // Got away: out of town, offline, or just too quick.
  if (!target || !inTown(target.id) || now > hunt.until) {
    done();
    return;
  }
  if (now < hunt.stepAt) return;
  hunt.stepAt = now + COP_STEP_MS;
  const map = mapOf("town");
  const dir = chase(map, cop.x, cop.y, target.x, target.y);
  if (dir) {
    const to = stepTarget(map, cop.x, cop.y, dir);
    cop.facing = dir;
    if (to.kind === "move" && !onProp(c.state, c.vars, to.x, to.y)) Object.assign(cop, { x: to.x, y: to.y });
    c.vars.dirty.add(cop.id);
    return;
  }
  // No way there.
  if (Math.abs(target.x - cop.x) + Math.abs(target.y - cop.y) > 1) {
    done();
    return;
  }
  // Caught up: face them and write it.
  cop.facing = target.x < cop.x ? "left" : target.x > cop.x ? "right" : target.y < cop.y ? "up" : "down";
  c.vars.dirty.add(cop.id);
  done();
  v.ticketed.set(target.id, today);
  const ticket = writeTicket(today, hunt.tokens);
  sendToRoom(c, "town", "bubble", { userId: cop.id, text: ticketLine(ticket) });
  main(c.client())
    .town.ticket(target.id, ticket)
    .then((count) => {
      if (count === null) return;
      sendToRoom(c, "town", "bubble", { userId: target.id, text: "🎫" });
      const text = `🎫 Ticket #${count} from Officer 429: ${chargeOf(ticket)}. Nothing taken: it's on your card.`;
      sendToUser(c, target.id, "notice", { text } satisfies Notice);
    })
    .catch((err) => console.warn("[world] ticket", err));
}

/** Someone stepped into another player's office: `town` counts them once a day for the open offices list. */
function countVisit(c: { vars: Vars; client: () => Parameters<typeof main>[0] }, p: WorldPlayer): void {
  const owner = ownerOfOffice(p.room);
  if (owner === null || owner === p.id) return;
  const now = Date.now();
  const day = dayKey(now);
  const seen = c.vars.visited;
  if (seen.day !== day) Object.assign(seen, { day, keys: new Set<string>() });
  const key = `${owner}:${p.id}`;
  if (seen.keys.has(key)) return;
  seen.keys.add(key);
  void main(c.client())
    .town.officeVisit(owner, p.id)
    .catch((err) => console.warn(`[office] visit ${p.id} to ${owner}: ${String(err)}`));
}

/** The caller, unless they're at a game table: there only the game moves them. */
function free(c: { conn: { state: ConnState }; state: WorldState }): WorldPlayer | null {
  const p = c.state.players[requireUser(c.conn.state)];
  return p && p.state !== "playing" ? p : null;
}

/**
 * Tells `town` `userId` did something a quest counts. Best effort, like `notify`.
 * Coffee drunk in the Tavern counts too (`drink`).
 */
function questEvent(
  c: { client(): Parameters<typeof main>[0] },
  userId: number,
  kind: string,
  key: string,
): void {
  void main(c.client())
    .town.questEvent(userId, kind, key)
    .catch((err) => console.warn(`[quests] ${userId}: ${String(err)}`));
}

/** In through `room`'s entry, on their feet. */
function enter(c: { vars: Vars }, p: WorldPlayer, room: RoomId): StepResult {
  Object.assign(p, roomEntry(room), { state: "idle" });
  c.vars.dirty.add(p.id);
  return correction(p);
}

const correction = (p: WorldPlayer): StepResult => ({
  x: p.x,
  y: p.y,
  facing: p.facing,
  state: p.state,
  room: p.room,
});

function occupancy(s: WorldState, online: Map<number, number>): Partial<Record<RoomId, number>> {
  return countBy(compact([...online.keys()].map((id) => s.players[id]?.room)), (room) => room);
}

/**
 * Offline and asleep in the dorm (`DORM`: upstairs at the Tavern), where everyone without a company sleeps: sent as a head count, not
 * one by one, since there can be thousands. Company houses hold 50 at most, so they show everyone.
 */
const counted = (p: WorldPlayer, online: Map<number, number>) =>
  p.room === DORM && p.state === "away" && !online.has(p.id);

const asleepAtInn = (s: WorldState, online: Map<number, number>) =>
  Object.values(s.players).filter((p) => counted(p, online)).length;

/** `SKY_SEASON`, read once: the town's season pinned for every client. */
const SEASON_PIN = pinnedSeason();

async function snapshot(
  s: WorldState,
  online: Map<number, number>,
  weather: Weather,
  self: WorldPlayer,
  chat: Promise<ChatLine[]>,
): Promise<Snapshot> {
  // Now: by the time the chat is read, they may be somewhere else.
  const room = self.room;
  const owner = ownerOfOffice(room);
  const companyId = companyOfRoom(room);
  return {
    room,
    selfId: self.id,
    players: Object.values(s.players)
      .filter((p) => p.room === self.room && !counted(p, online))
      .map((p) => view(p, online.has(p.id))),
    asleep: self.room === DORM ? asleepAtInn(s, online) : 0,
    companies: Object.values(s.companies),
    occupancy: occupancy(s, online),
    chat: await chat,
    houses: room === "town" ? houses(s) : {},
    officeLights: room === "town" ? officeLights(s) : [],
    games: Object.values(s.games ?? {}),
    owner:
      owner === null
        ? null
        : {
            id: owner,
            name: s.players[owner]?.name ?? "Someone",
            tier: officeTier(s.players[owner]?.level ?? 0, officeOf(s, owner).size),
            ...decorOf(s, owner),
          },
    doors: companyId === null ? [] : doorsOf(s, companyId),
    drops: dropsIn(room),
    weather,
    ...(SEASON_PIN === null ? {} : { seasonDay: SEASON_PIN }),
    raiders: room === "dungeon" ? raiders(s, Date.now()) : null,
  };
}

/**
 * Reads OpenRouter's model list, and tells everyone when the launches change (a stand going up or down)
 * or the graveyard does (someone buried, or dug up again).
 */
async function refreshLaunches(
  c: {
    vars: Vars;
    db: TxSql;
    client: () => Parameters<typeof main>[0];
    broadcast(name: string, ...args: unknown[]): void;
  },
  now: number,
): Promise<void> {
  const { launches, pool } = await checkModels(c.vars.launches, now);
  if (!sameLaunches(launches, c.vars.launches)) {
    // The town keeps which launches there were; a read it misses is sent again with the next change.
    void main(c.client())
      .town.launched(launches)
      .catch((err: unknown) => console.warn(`[launches] town: ${String(err)}`));
    c.vars.launches = launches;
    c.broadcast("launches", launches);
  }
  if (!pool) return;
  const changed = tend(c.vars.plots, pool, now);
  if (changed.length === 0) return;
  await savePlots(c.db, changed);
  c.vars.plots = withChanges(c.vars.plots, changed);
  const graves = stonesOf(c.vars.plots);
  if (sameStones(graves, c.vars.graves)) return;
  for (const g of graves)
    if (!c.vars.graves.some((was) => was.id === g.id)) console.log(`[graveyard] ${g.id} is buried`);
  c.vars.graves = graves;
  c.broadcast("graveyard", graves);
}

/** Reads the ranking, and tells everyone when the plinth's leader changes; a failed read keeps it and tries again sooner. */
async function refreshStatue(c: Sender & { broadcast(name: string, ...args: unknown[]): void }, now: number) {
  const leader = await readLeader();
  const next = afterRead(
    c.state.statue ?? NO_STATUE,
    leader,
    now,
    now + (leader ? STATUE_EVERY_MS : STATUE_RETRY_MS),
  );
  setStatue(c, next);
}

/**
 * Puts `next` in state, and when what the plinth shows changed, tells everyone; a new model on it has a bot
 * on the square say so (the unveiling itself is the clients', from `since`).
 */
function setStatue(
  c: Sender & { broadcast(name: string, ...args: unknown[]): void },
  next: StatueState,
): void {
  const was = shownStatue(c.state.statue);
  c.state.statue = next;
  const shown = shownStatue(next);
  if (sameLeader(was.leader, shown.leader) && was.pinned === shown.pinned) return;
  c.broadcast("statue", shown);
  if (!shown.leader || sameLeader(was.leader, shown.leader)) return;
  const crier = BOTS.find((b) => !b.still && b.id !== COP.id && c.state.players[b.id]?.room === "town");
  if (crier) sendToRoom(c, "town", "bubble", { userId: crier.id, text: unveilLine(shown.leader) });
}

/** A plain copy of the stars to send: `state` hands out proxies. */
const starsOf = ({ count, show }: StarsState): Stars => ({ count, show: show && { ...show } });

/**
 * Reads the repo's GitHub stars and tells everyone when the count changes; passing a milestone sets off
 * the fireworks (the `show` in what's sent) and the town says so. A failed read keeps the last count.
 */
async function refreshStars(
  c: Sender & { db: Sql; broadcast(name: string, ...args: unknown[]): void },
  now: number,
): Promise<void> {
  const count = await fetchStars();
  const prev = c.state.stars ?? NO_STARS;
  const next = readStars(prev, count, now);
  if (next === prev) return;
  c.state.stars = next;
  const show = next.show?.at === prev.show?.at ? null : next.show;
  if (next.count !== prev.count || show) c.broadcast("stars", starsOf(next));
  if (show)
    await announce(c, "town", milestoneLine(show.milestone), 0, "⭐").catch((err) =>
      console.warn(`[stars] announce: ${String(err)}`),
    );
}

/**
 * Reads the status pages (or `PICNIC_OUTAGE`), and tells everyone when the picnic starts, changes or
 * ends. When it ends, whoever sat on a blanket (bots too) stands up.
 */
async function refreshOutage(
  c: Sender & { vars: Vars; broadcast(name: string, ...args: unknown[]): void },
  now: number,
): Promise<void> {
  const prev = c.vars.outage;
  const pinned = forced(now);
  const next =
    pinned === undefined ? await checkOutage(prev, now) : pinned && { ...pinned, since: prev?.since ?? now };
  if (sameOutage(next, c.vars.outage)) return;
  c.vars.outage = next;
  c.broadcast("outage", next);
  if (next) return;
  for (const p of Object.values(c.state.players))
    if (p.room === "town" && p.state === "sit" && onBlanket(p.x, p.y)) {
      p.state = "idle";
      c.vars.dirty.add(p.id);
    }
}

/**
 * Everyone with agents running in the last `WORKING_MS`, busiest first. Their burn fades out as their
 * last sync gets old, so someone who stopped slows down before they leave their desk.
 */
function raiders(s: WorldState, now: number): Raiders {
  const all = sortBy(
    Object.values(s.players)
      .filter((p) => now - p.lastAgentAt < WORKING_MS)
      .map((p) => ({
        id: p.id,
        name: p.name,
        look: p.look,
        desk: p.desk ?? 0,
        agents: Math.max(1, p.liveAgents),
        burn: Math.round((p.burn ?? 0) * Math.max(0, 1 - (now - p.lastAgentAt) / WORKING_MS)),
      })),
    { by: "burn", order: "desc" },
    "id",
  );
  return { top: all.slice(0, RAIDERS_SHOWN), more: Math.max(0, all.length - RAIDERS_SHOWN) };
}

type WeatherHost = { vars: Vars; broadcast(name: string, ...args: unknown[]): void };

/** Sets the weather and tells everyone, if it changed. */
function setWeather(c: WeatherHost, next: Weather): void {
  if (sameWeather(next, c.vars.weather)) return;
  c.vars.weather = next;
  c.broadcast("weather", next);
}

/** Asks for the weather (keeping the pollen it has); a failed fetch keeps the last one. */
async function refreshWeather(c: WeatherHost): Promise<void> {
  const pinned = pinnedWeather();
  const next = pinned ?? (await fetchWeather());
  if (next) setWeather(c, pinned ?? { ...next, pollen: c.vars.weather.pollen });
}

/** Asks for the pollen, its own fetch once an hour; a failed one keeps the last count. A pinned sky has its own. */
async function refreshPollen(c: WeatherHost): Promise<void> {
  if (pinnedWeather()) return;
  const pollen = await fetchPollen();
  if (pollen !== null) setWeather(c, { ...c.vars.weather, pollen });
}

/**
 * Reads the grid, tells everyone if it changed, and hands `town` the green hours it hasn't had yet
 * (they pay: `town/grid.ts`). A failed read keeps the last grid; a failed hand-over is tried again next read.
 */
async function refreshGrid(
  c: {
    vars: Vars;
    client: () => Parameters<typeof main>[0];
    broadcast(name: string, ...args: unknown[]): void;
  },
  now: number,
): Promise<void> {
  const next = await checkGrid(c.vars.grid, now);
  const changed = JSON.stringify(next.grid) !== JSON.stringify(c.vars.grid.grid);
  c.vars.grid = next;
  if (changed) c.broadcast("grid", next.grid);
  const unsent = next.grid.green.filter((h) => !c.vars.greenSent.has(h));
  if (unsent.length === 0) return;
  try {
    await main(c.client()).town.greenHours(unsent);
    for (const h of unsent) c.vars.greenSent.add(h);
    for (const h of c.vars.greenSent) if (!next.grid.green.includes(h)) c.vars.greenSent.delete(h);
  } catch (err) {
    console.warn(`[grid] green hours: ${String(err)}`);
  }
}

/** What's on a room's floor. `DROPS` is the world's only copy: `town` has them all for a restart (`seed`). */
const dropsIn = (room: RoomId): Drop[] => [...(DROPS.get(room) ?? [])];

/**
 * Onto the floor: in its room's map (`mapOf`: dropped seats seat, the coffee machine pours, the rest
 * blocks), and the room sees it.
 */
function lay(c: Sender, d: Drop): void {
  setDrops(d.room, [...dropsIn(d.room).filter((o) => o.id !== d.id), d]);
  sendToRoom(c, d.room, "drop", d);
}

/** Off the floor: out of the map, anyone sitting on it stands up there, and the room sees it go. */
function lift(c: Sender & { vars: Vars }, d: Drop): void {
  setDrops(
    d.room,
    dropsIn(d.room).filter((o) => o.id !== d.id),
  );
  for (const p of Object.values(c.state.players))
    if (p.room === d.room && p.state === "sit" && dropCovers(d, p.x, p.y)) {
      p.state = "idle";
      c.vars.dirty.add(p.id);
    }
  sendToRoom(c, d.room, "pickup", { id: d.id });
}

/** A tile a piece's left end stands on. */
type TileAt = { x: number; y: number };

/**
 * Takes the drop `d` off `p`'s room: the owner's rule (an office floor is its owner's, a company's furniture its
 * members'), then off the floor before asking `town`, so nobody takes it twice meanwhile.
 */
async function takeDrop(
  c: Sender & { vars: Vars; client: () => Parameters<typeof main>[0] },
  p: WorldState["players"][number],
  userId: number,
  d: Drop,
): Promise<null | { notice: string; drop?: Drop }> {
  const owner = ownerOfOffice(p.room);
  if (owner !== null && owner !== userId)
    return { notice: `That's ${c.state.players[owner]?.name ?? "someone"}'s floor.` };
  // A company's furniture: its people move it, into the storeroom.
  if (d.co !== undefined && d.co !== p.companyId)
    return { notice: `That belongs to ${c.state.companies[d.co]?.name ?? "the company"}.` };
  lift(c, d);
  const took = await main(c.client())
    .town.pickUp(d.id, userId, d.room)
    .catch((err) => {
      console.warn(`[take] ${d.id}: ${String(err)}`);
      return null;
    });
  if (took === null) {
    lay(c, d);
    return { notice: "That didn't work. Try again." };
  }
  // False: the sweeper sent it home first, so it was gone already.
  if (!took) return null;
  return {
    notice: d.co === undefined ? `🎒 Took the ${dropName(d)}.` : `📦 The ${dropName(d)} is in the storeroom.`,
    drop: d,
  };
}

/**
 * After `room`'s map is rebuilt: drops it has no place for any more (on what's a wall or a door now, or
 * furniture where `noFurniture` says) come off the floor. Returns their ids, for `town` to give back.
 */
function liftMisplaced(c: Sender & { vars: Vars }, room: RoomId): number[] {
  const base = baseMap(room);
  const reserved = noFurniture(room, base);
  const out = dropsIn(room).filter((d) => {
    const piece = pieceOfDrop(d);
    if (piece?.wall) return !canHang(base, d.x, d.y, piece.w ?? 1, piece.home);
    for (const [tx, ty] of dropTiles(d))
      if (!base.walkable(tx, ty) || (piece && reserved.has(`${tx},${ty}`))) return true;
    return false;
  });
  for (const d of out) lift(c, d);
  return out.map((d) => d.id);
}

/** Their wallpaper and floor, when they have any. */
const decorOf = (s: WorldState, userId: number) => {
  const { wall, floor } = officeOf(s, userId);
  return { ...(wall && { wall }), ...(floor && { floor }) };
};

/**
 * Sets an owner's office map from their level and decor (nothing under `OFFICE_LEVEL`). True if the map
 * changed, so its room needs a rebuild: `mapOf` and the client's ground go by the map object.
 */
function buildOffice(s: WorldState, userId: number): boolean {
  const before = OFFICE_MAPS.get(userId);
  const p = s.players[userId];
  if (p && p.level >= OFFICE_LEVEL)
    setOffice(userId, officeTier(p.level, officeOf(s, userId).size), decorOf(s, userId));
  else clearOffice(userId);
  return OFFICE_MAPS.get(userId) !== before;
}

/** An office grew or changed its look: drops it has no place for go back, and everyone inside sees it. */
async function rebuildOffice(c: Sender & { vars: Vars; db: Sql }, userId: number): Promise<number[]> {
  const lifted = liftMisplaced(c, `office:${userId}`);
  await resend(c, `office:${userId}`);
  return lifted;
}

/** Someone's office; plain while `town` has no row for it yet. */
const officeOf = (s: WorldState, userId: number): Office => s.offices?.[userId] ?? {};

/** Everyone inside each company house, for drawing them through its walls from town. */
function houses(s: WorldState): Houses {
  const out: Houses = {};
  for (const p of Object.values(s.players)) {
    const companyId = companyOfRoom(p.room);
    if (companyId === null) continue;
    const list = out[companyId] ?? [];
    list.push({ id: p.id, name: p.name, level: p.level, look: p.look, state: p.state });
    out[companyId] = list;
  }
  return out;
}

/** Only an aggregate is shown outside: office occupants and their identities stay private. */
function officeLights(s: WorldState): number[] {
  return [
    ...new Set(
      Object.values(s.players)
        .filter((p) => p.state === "working" && p.companyId !== null)
        .map((p) => p.companyId!),
    ),
  ].sort((a, b) => a - b);
}

async function chatOf(sql: Sql, room: RoomId) {
  const rows = await all<ChatLine>(
    sql,
    "SELECT id, room, user_id AS userId, name, text, at FROM chat WHERE room = ? ORDER BY id DESC LIMIT ?",
    room,
    CHAT_HISTORY,
  );
  return rows.reverse();
}

type Conn = { id: string; state: unknown; send(name: string, ...args: unknown[]): void };

interface Sender {
  conns: Map<string, Conn>;
  state: WorldState;
  vars: { users: Map<string, number | null> };
}

/** The player behind `conn` once it has joined, else null (`users`). */
function joinedUser(c: Sender, conn: Conn): number | null {
  const id = conn.id;
  let userId = c.vars.users.get(id);
  if (userId === undefined) {
    const s = conn.state as ConnState;
    userId = s.kind === "user" && s.joined ? s.userId : null;
    c.vars.users.set(id, userId);
  }
  return userId;
}

/** The room of the player behind `conn`, if it has joined. */
const roomOf = (c: Sender, conn: Conn): RoomId | undefined => {
  const userId = joinedUser(c, conn);
  return userId === null ? undefined : c.state.players[userId]?.room;
};

function sendToRoom(c: Sender, room: RoomId, event: string, payload: unknown): void {
  for (const conn of c.conns.values()) if (roomOf(c, conn) === room) conn.send(event, payload);
}

/**
 * A match's public face (a `WorldGame`: headline, board, status, watchers, never its state) goes to the
 * town square, where it is played, and to the basement, whose big screen shows it live. Callouts stay
 * town-only: their avatars aren't down there.
 */
function sendToScreens(c: Sender, event: "game" | "gameOver", payload: unknown): void {
  sendToRoom(c, "town", event, payload);
  if (TAVERN) sendToRoom(c, "basement", event, payload);
}

/**
 * `p`'s `info`, to their own tabs and whoever can see them: in their room, the room they were just in
 * (`from`), or the one last told they're there (`announced`; `flush` moves them over next). The game
 * reads it only for someone it shows (`applyInfo`) and for itself. Sent to every connection, each sync
 * of each player (tokens today, agents) went to every tab, and a burst of joins cost joins × tabs.
 */
function sendInfo(
  c: Sender & { vars: { announced: Map<number, RoomId> } },
  p: WorldPlayer,
  payload: PlayerInfo,
  from = p.room,
): void {
  const was = c.vars.announced.get(p.id);
  for (const conn of c.conns.values()) {
    const userId = joinedUser(c, conn);
    if (userId === null) continue;
    const room = c.state.players[userId]?.room;
    if (userId === p.id || room === p.room || room === from || room === was) conn.send("info", payload);
  }
}

/** To every tab `userId` has open. */
function sendToUser(c: Sender, userId: number, event: string, payload: unknown): void {
  for (const conn of c.conns.values()) if (joinedUser(c, conn) === userId) conn.send(event, payload);
}

/** A player who changed room (a door, or sent to bed) gets the new room whole. */
async function sendSnapshot(c: Sender & { vars: Vars; db: Sql }, p: WorldPlayer): Promise<void> {
  sendToUser(
    c,
    p.id,
    "snapshot",
    await snapshot(c.state, c.vars.online, c.vars.weather, p, chatOf(c.db, p.room)),
  );
}

/**
 * Everyone online in `room` gets it whole again: what's in it changed. One snapshot (and one read of
 * the chat) for all of them; only who they are differs.
 */
async function resend(c: Sender & { vars: Vars; db: Sql }, room: RoomId): Promise<void> {
  const someone = Object.values(c.state.players).find((p) => p.room === room && c.vars.online.has(p.id));
  if (!someone) return;
  const snap = await snapshot(c.state, c.vars.online, c.vars.weather, someone, chatOf(c.db, room));
  // Whoever left meanwhile gets their new room from `flush`.
  for (const conn of c.conns.values())
    if (roomOf(c, conn) === room)
      conn.send("snapshot", { ...snap, selfId: joinedUser(c, conn)! } satisfies Snapshot);
}

/**
 * A company's doors changed: rebuild its building, and everyone inside sees it. Returns drops it has no
 * place for any more, for `town` to give back.
 */
async function rebuildHq(c: Sender & { vars: Vars; db: Sql }, companyId: number): Promise<number[]> {
  buildHq(c.state, companyId, c.vars.dirty);
  const lifted = liftMisplaced(c, `hq:${companyId}`);
  await resend(c, `hq:${companyId}`);
  return lifted;
}

/** One tick: batched moves per room, and head counts when they change. */
function flush(c: Sender & { vars: Vars; db: Sql; broadcast(name: string, ...args: unknown[]): void }): void {
  const { dirty, announced, online, hidden } = c.vars;
  if (dirty.size > 0) {
    const rooms = new Map<RoomId, Moves>();
    const at = (room: RoomId) => {
      const m = rooms.get(room) ?? { room, join: [], m: [], leave: [] };
      rooms.set(room, m);
      return m;
    };
    let recount = false;
    for (const id of dirty) {
      const p = c.state.players[id];
      if (!p) continue;
      rouletteCheckSeat(c, p);
      const was = announced.get(id);
      // Unannounced since the world woke: they may have just left a house.
      if (
        was === undefined ||
        companyOfRoom(p.room) !== null ||
        companyOfRoom(was) !== null ||
        ownerOfOffice(p.room) !== null ||
        (was !== undefined && ownerOfOffice(was) !== null)
      )
        c.vars.housesStale = true;
      // Counted asleep at the Inn, they're a number to the room: they leave it when they fall asleep
      // there and join it when they wake up or sit down to work.
      const hide = counted(p, online);
      if (was === p.room && hidden.has(id) === hide) {
        if (!hide) at(p.room).m.push(pos(p));
        continue;
      }
      if (was && !hidden.has(id)) at(was).leave.push(id);
      if (hide) hidden.add(id);
      else {
        hidden.delete(id);
        at(p.room).join.push(view(p, online.has(id)));
      }
      // Unannounced since the world woke, they may have been asleep (and counted) where they were.
      recount ||= was === undefined || was === DORM || p.room === DORM;
      announced.set(id, p.room);
      // Nothing awaits it: an uncaught rejection here (the database closing) would end the process.
      if (online.has(id) && was !== p.room)
        sendSnapshot(c, p)
          .then(() => {
            if (p.room === "basement") {
              sendPoker(c, Date.now(), id);
              sendRoulette(c, id);
            }
            if (was === "basement" && p.room !== "basement") sendToUser(c, id, "roulette", emptyRoulette());
            if (p.room !== "inn") return;
            sendJukebox(c, Date.now(), id);
          })
          .catch((err) => console.warn(`[world] snapshot for ${id}: ${String(err)}`));
    }
    dirty.clear();
    if (recount) at(DORM).asleep = asleepAtInn(c.state, online);
    // One pass over the connections for every room's moves.
    for (const conn of c.conns.values()) {
      const m = rooms.get(roomOf(c, conn)!);
      if (m) conn.send("moves", m);
    }
  }
  // Who's inside each house, when someone in one moved or changed (a rename or level-up too, from
  // `setPlayer`), for whoever is in town to see. Joining town, the snapshot has it anyway.
  // ponytail: a pass over all players then. Track changes per house if the world gets big.
  if (c.vars.housesStale && someoneIn(c, "town")) {
    c.vars.housesStale = false;
    const inside = houses(c.state);
    const lights = officeLights(c.state);
    const json = JSON.stringify([inside, lights]);
    if (json !== c.vars.houses) {
      c.vars.houses = json;
      sendToRoom(c, "town", "houses", inside);
      sendToRoom(c, "town", "officeLights", lights);
    }
  }
  // The dungeon's raiders, once a second, when someone there would see a change.
  const now = Date.now();
  if (now - c.vars.raidersAt < RAIDERS_EVERY_MS) return;
  c.vars.raidersAt = now;
  if (!someoneIn(c, "dungeon")) return;
  const list = raiders(c.state, now);
  const json = JSON.stringify(list);
  if (json === c.vars.raiders) return;
  c.vars.raiders = json;
  sendToRoom(c, "dungeon", "raiders", list);
}

/** Everyone online in the Tavern: the jukebox's audience and electorate. */
const inTavern = (c: { state: WorldState; vars: Vars }): number[] =>
  [...c.vars.online.keys()].filter((id) => c.state.players[id]?.room === "inn");

/** What the room last heard, to tell when it changed: the track, its votes and what skipping needs. */
const jukeKey = (j: Jukebox, present: readonly number[]): string =>
  j ? `${j.startedAt}:${votesOf(j, present)}:${skipNeeded(present.length)}` : "";

/** The jukebox as the room hears it, to `userId` (just arrived) or everyone in the net cafe. */
function sendJukebox(c: Sender & { vars: Vars }, now: number, userId?: number): void {
  const j = c.vars.jukebox;
  const present = inTavern(c);
  const payload = j ? wire(j, c.state.players[j.by]?.name ?? "Someone", present, now) : null;
  if (userId !== undefined) {
    sendToUser(c, userId, "jukebox", payload);
    return;
  }
  sendToRoom(c, "inn", "jukebox", payload);
  c.vars.jukeKey = jukeKey(j, present);
}

/** Each tick: a track that ended or was skipped (a voter may have walked out) stops; changed votes show. */
function jukeboxBeat(c: Sender & { vars: Vars }, now: number): void {
  if (!c.vars.jukebox && !c.vars.jukeKey) return;
  const present = inTavern(c);
  c.vars.jukebox = settleJukebox(c.vars.jukebox, present, now);
  if (jukeKey(c.vars.jukebox, present) !== c.vars.jukeKey) sendJukebox(c, now);
}

// MARK: The net cafe's roulette table

interface RouletteMem {
  seats: RouletteSeat[];
  last: RouletteSpin | null;
  history: number[];
  nextId: number;
  phase: RoulettePhase;
  round: number;
  phaseEndsAt: number;
  /** Seated players' bets and readiness (kept through the spin and result so everyone sees them). */
  players: Map<number, { userId: number; bets: Bet[]; ready: boolean }>;
  /** The roll is being fetched from the town: bets are closed. */
  busy: boolean;
  /** Not before: after a failed roll, when to try again. */
  retryAt: number;
  /** Players with a bet call in flight. */
  betting: Set<number>;
  /** The pocket that landed, added to the history when the result starts. */
  pending: number | null;
  /** Stakes to hand back (a player left during betting), sent to the town by the beat. */
  refunds: { userId: number; round: number }[];
}

const newRoulette = (): RouletteMem => ({
  seats: [],
  last: null,
  history: [],
  nextId: 1,
  phase: "idle",
  round: 0,
  phaseEndsAt: 0,
  players: new Map(),
  busy: false,
  retryAt: 0,
  betting: new Set(),
  pending: null,
  refunds: [],
});

/** What someone outside the net cafe is told: an idle, empty table. */
const emptyRoulette = (): RouletteState => ({
  seats: [],
  last: null,
  history: [],
  phase: "idle",
  round: 0,
  phaseEndsAt: 0,
  now: Date.now(),
  players: [],
});

const rouletteWire = (r: RouletteMem): RouletteState => ({
  seats: r.seats,
  last: r.last,
  history: r.history,
  phase: r.phase,
  round: r.round,
  phaseEndsAt: r.phaseEndsAt,
  now: Date.now(),
  players: r.seats.flatMap((s) => {
    const pl = r.players.get(s.userId);
    return pl ? [pl] : [];
  }),
});

/** The table as the room sees it, to `userId` (just arrived) or everyone in the net cafe. */
function sendRoulette(c: Sender & { vars: Vars }, userId?: number): void {
  const state = rouletteWire(c.vars.roulette);
  if (userId !== undefined) sendToUser(c, userId, "roulette", state);
  else sendToRoom(c, "basement", "roulette", state);
}

/** Frees `userId`'s spot, if they hold one. Stakes still open (betting, not yet rolled) go back. */
function rouletteLeave(c: Sender & { vars: Vars }, userId: number): void {
  const r = c.vars.roulette;
  const at = r.seats.findIndex((s) => s.userId === userId);
  if (at < 0) return;
  r.seats.splice(at, 1);
  r.players.delete(userId);
  // The town decides: its refund finds nothing if the round already rolled (then they are simply paid).
  if (r.phase === "betting") r.refunds.push({ userId, round: r.round });
  sendRoulette(c);
}

/** Each tick: moves the table to its next phase (see `nextPhase`). */
function rouletteBeat(c: PokerCtx, now: number): void {
  const r = c.vars.roulette;
  for (const f of r.refunds.splice(0))
    main(c.client())
      .town.rouletteRefund(f.userId, f.round)
      .catch((err) => console.warn(`[roulette] refund: ${String(err)}`));
  if (r.busy || now < r.retryAt) return;
  const seated = [...r.players.values()];
  const next = nextPhase({
    phase: r.phase,
    now,
    endsAt: r.phaseEndsAt,
    seated: seated.length,
    betting: seated.filter((p) => p.bets.length > 0).length,
    allReady: seated.every((p) => p.ready),
  });
  if (!next) return;
  if (next === "spinning") {
    r.busy = true;
    const round = r.round;
    main(c.client())
      .town.rouletteResolve(round)
      .then(({ pocket, results }) => {
        r.last = {
          id: r.nextId++,
          round,
          pocket,
          color: colorOf(pocket),
          results: results as RouletteOutcome[],
          at: Date.now(),
        };
        r.pending = pocket;
        r.phase = "spinning";
        r.phaseEndsAt = Date.now() + SPIN_MS;
        r.busy = false;
        sendRoulette(c);
      })
      .catch((err) => {
        console.warn(`[roulette] resolve: ${String(err)}`);
        r.busy = false;
        r.retryAt = Date.now() + 2000;
      });
    return;
  }
  if (next === "result" && r.pending !== null) {
    r.history = [r.pending, ...r.history].slice(0, 12);
    r.pending = null;
  }
  r.phase = next;
  if (next === "betting") {
    r.round++;
    for (const p of r.players.values()) Object.assign(p, { bets: [], ready: false });
  }
  r.phaseEndsAt = next === "betting" ? now + BETTING_MS : next === "result" ? now + RESULT_MS : 0;
  sendRoulette(c);
}

/** A seat is held only while its player stands on the spot, in the net cafe: leaving the room clears their table. */
function rouletteCheckSeat(c: Sender & { vars: Vars }, p: WorldPlayer): void {
  const seat = c.vars.roulette.seats.find((s) => s.userId === p.id);
  if (!seat) return;
  const on = p.room === "basement" && spotAt(p.x, p.y) === seat.spot;
  if (on) return;
  rouletteLeave(c, p.id);
  if (p.room !== "basement") sendToUser(c, p.id, "roulette", emptyRoulette());
}

// MARK: The Tavern's poker table

type PokerCtx = Sender & {
  vars: Vars;
  client: () => Parameters<typeof main>[0];
};

/** Whether `userId` has a seat at the table and hasn't stood up (a leaver waits for their hand to end). */
function pokerSeated(c: { vars: Vars }, userId: number): boolean {
  const t = c.vars.poker;
  const at = seatOf(t, userId);
  return at >= 0 && !t.seats[at]!.leaving;
}

const pokerName = (c: { state: WorldState }, id: number): string => c.state.players[id]?.name ?? "Someone";

const parseAction = (type: unknown, to: unknown): Action | null => {
  if (type === "fold" || type === "check" || type === "call") return { type };
  if (type === "raise" && typeof to === "number" && Number.isInteger(to)) return { type, to };
  return null;
};

/** The reason a buy-in failed, in words to show: the town's own for the limit and for being short, else a shrug. */
function pokerWhy(err: unknown): string {
  const { code, message } = err as { code?: string; message?: string };
  return ["loss_limit", "too_poor", "seated"].includes(code ?? "") && message
    ? `🃏 ${message}`
    : "🃏 That didn't work. Try again.";
}

/**
 * `p` sits at chair `at`: the seat is held while the town takes the buy-in, then dealt in from the
 * next hand. If the town says no, or they left meanwhile, nothing moves.
 */
/** Whether roulette spot `spot` has a seat on it, or someone (other than `p`) standing on it. */
function rouletteTaken(c: Sender & { vars: Vars }, p: WorldPlayer, spot: number): boolean {
  const [x, y] = rouletteSpots()[spot]!;
  return (
    c.vars.roulette.seats.some((s) => s.spot === spot) ||
    Object.values(c.state.players).some(
      (o) => o.id !== p.id && o.room === "basement" && o.x === x && o.y === y,
    )
  );
}

/** Puts `p` on roulette spot `spot`, facing the table, and tells the room. */
function rouletteSeat(c: Sender & { vars: Vars }, p: WorldPlayer, spot: number): StepResult {
  const [x, y] = rouletteSpots()[spot]!;
  const r = c.vars.roulette;
  // Above the table they look down at it, below it up.
  const table = rouletteTable();
  Object.assign(p, { x, y, facing: table && y < table.y ? "down" : "up" });
  if (stopDance(p)) sendInfo(c, p, info(p, true));
  c.vars.dirty.add(p.id);
  r.seats.push({ spot, userId: p.id, name: p.name });
  r.seats.sort((a, b) => a.spot - b.spot);
  r.players.set(p.id, { userId: p.id, bets: [], ready: false });
  sendRoulette(c);
  return correction(p);
}

async function pokerSitDown(c: PokerCtx, p: WorldPlayer, at: number): Promise<StepResult> {
  const t = c.vars.poker;
  const chair = pokerChairs()[at]!;
  if (seatOf(t, p.id) >= 0 || c.vars.pokerBusy.has(p.id))
    return { notice: "🃏 You're at the table already." };
  if (t.owed.some((o) => o.userId === p.id))
    return { notice: "🃏 Your last stack is still being counted out. One moment." };
  const taken = Object.values(c.state.players).some(
    (o) => o.room === p.room && o.x === chair.x && o.y === chair.y,
  );
  if (t.seats[at] || taken) return { notice: "Someone's already there." };
  sitDown(t, at, p.id);
  c.vars.pokerBusy.add(p.id);
  try {
    await main(c.client()).town.pokerSit(p.id);
  } catch (err) {
    release(t, at);
    return { notice: pokerWhy(err) };
  } finally {
    c.vars.pokerBusy.delete(p.id);
  }
  ready(t, at, Date.now());
  // They walked out (or closed the tab) while the town counted: the stack goes straight back.
  if (p.room !== "basement" || !c.vars.online.has(p.id)) {
    leave(t, at, Date.now());
    pokerSync(c, Date.now());
    return null;
  }
  Object.assign(p, { x: chair.x, y: chair.y, state: "sit", facing: chair.facing });
  if (stopDance(p)) sendInfo(c, p, info(p, true));
  c.vars.dirty.add(p.id);
  pokerSync(c, Date.now());
  return correction(p);
}

/** Stands `userId` up, if they sit at the table. */
function pokerStandUp(c: PokerCtx, userId: number): void {
  const t = c.vars.poker;
  const at = seatOf(t, userId);
  if (at < 0) return;
  leave(t, at, Date.now());
  pokerSync(c, Date.now());
}

/** The table as the room sees it, to `userId` (just arrived) or everyone in the net cafe. */
function sendPoker(c: Sender & { vars: Vars }, now: number, userId?: number): void {
  const state = pokerWire(c.vars.poker, now, (id) => pokerName(c, id));
  if (userId !== undefined) {
    sendToUser(c, userId, "poker", state);
    sendToUser(c, userId, "pokerHole", holeOf(c.vars.poker, userId));
    return;
  }
  sendToRoom(c, "basement", "poker", state);
  c.vars.pokerSent = c.vars.poker.v;
}

/** Everyone's own two cards, to them alone, when they change (a new deal, a fold-out clears them). */
function sendHoles(c: Sender & { vars: Vars }): void {
  const t = c.vars.poker;
  const { pokerHole: sent } = c.vars;
  const now = new Map(t.seats.flatMap((s) => (s ? [[s.userId, JSON.stringify(s.hole)] as const] : [])));
  for (const [id, json] of now)
    if (sent.get(id) !== json) {
      sent.set(id, json);
      sendToUser(c, id, "pokerHole", JSON.parse(json));
    }
  for (const id of [...sent.keys()])
    if (!now.has(id)) {
      sent.delete(id);
      sendToUser(c, id, "pokerHole", []);
    }
}

/** After a change to the table: tell the room and the players, and the town about any coins that moved. */
function pokerSync(c: PokerCtx, now: number): void {
  const t = c.vars.poker;
  if (t.v !== c.vars.pokerSent) sendPoker(c, now);
  sendHoles(c);
  pokerFlush(c);
}

/**
 * Tells the town the stacks after a hand and pays the seats that left (their stacks go back to their wallets).
 * Only between hands, when the stacks are all in the seats; a call that fails is tried again next tick.
 */
function pokerFlush(c: PokerCtx): void {
  const t = c.vars.poker;
  if (c.vars.pokerFlushing || t.street !== null || (!t.dirty && t.owed.length === 0)) return;
  const sent = [...t.owed];
  const v = t.v;
  const stacks = t.seats.flatMap((s) => (s?.ready ? [{ userId: s.userId, stack: s.stack }] : []));
  c.vars.pokerFlushing = true;
  main(c.client())
    .town.pokerSettle({ stacks, out: sent })
    .then(() => settled(t, sent, v))
    .catch((err) => console.warn(`[poker] settle: ${String(err)}`))
    .finally(() => {
      c.vars.pokerFlushing = false;
    });
}

/** Each tick: anyone who left the net cafe or went offline stands up, the clock runs, changes go out. */
function pokerBeat(c: PokerCtx, now: number): void {
  const t = c.vars.poker;
  if (t.seats.every((s) => s === null) && t.owed.length === 0 && t.v === c.vars.pokerSent) return;
  for (const [at, s] of t.seats.entries()) {
    const p = c.state.players[s?.userId ?? -1];
    if (s && !s.leaving && s.ready && (!p || p.room !== "basement" || !c.vars.online.has(p.id)))
      leave(t, at, now);
  }
  tick(t, now);
  pokerSync(c, now);
}

/** Whether anyone online is in `room`. */
const someoneIn = (c: { state: WorldState; vars: Vars }, room: RoomId) =>
  [...c.vars.online.keys()].some((id) => c.state.players[id]?.room === room);
