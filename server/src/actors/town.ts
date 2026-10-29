import { CASE_SHOP_ID, caseById } from "@tokenmaxxing/core/cases.ts";
import {
  type CollectionState,
  ownedPins,
  PIN_MAX,
  type PinView,
  resolvePins,
} from "@tokenmaxxing/core/collection.ts";
import type { Ticket } from "@tokenmaxxing/core/cop.ts";
import type { Gift } from "@tokenmaxxing/core/december.ts";
import { editionById } from "@tokenmaxxing/core/editions.ts";
import type { Barrel } from "@tokenmaxxing/core/fastelavn.ts";
import type { FishCatch, FishingEntry, FishingState } from "@tokenmaxxing/core/fishing.ts";
import { clockAt, dateAt, type Keynote } from "@tokenmaxxing/core/keynote.ts";
import type { Launch } from "@tokenmaxxing/core/launch.ts";
import { frontier } from "@tokenmaxxing/core/maps.ts";
import type { Listing as MarketListing, MyMarket } from "@tokenmaxxing/core/market.ts";
import { headlines, type Paper } from "@tokenmaxxing/core/paper.ts";
import type { QuestBoard } from "@tokenmaxxing/core/quests.ts";
import { type RaidWeek, raidWeekAt } from "@tokenmaxxing/core/raid.ts";
import { addDays, dayKey, isRangeKey } from "@tokenmaxxing/core/range.ts";
import type { Regulars } from "@tokenmaxxing/core/regulars.ts";
import type { RequestEntry } from "@tokenmaxxing/core/requests.ts";
import type { Bet, RouletteOutcome } from "@tokenmaxxing/core/roulette.ts";
import {
  emptySide,
  type Item,
  isTradeable,
  itemById,
  itemsIn,
  merchIn,
  parseSide,
  TRADE_COINS_CAP,
  TRADE_ITEMS_CAP,
} from "@tokenmaxxing/core/shop.ts";
import { goToShop, SHOP_ROOM, type ShopId, shopForSlot } from "@tokenmaxxing/core/shoprooms.ts";
import type { StatueAdmin } from "@tokenmaxxing/core/statue.ts";
import { TAVERN } from "@tokenmaxxing/core/tavern.ts";
import type { TournamentBoard } from "@tokenmaxxing/core/tournament.ts";
import type { Trophy } from "@tokenmaxxing/core/trophies.ts";
import {
  BIO_MAX_LENGTH,
  type CompanyInfo,
  type Drop,
  defaultLook,
  dropName,
  type Look,
  parseLook,
} from "@tokenmaxxing/core/world.ts";
import { chunkArray, must } from "hanzio";
import { actor, UserError } from "rivetkit";
import { db } from "rivetkit/db";
import { canBrand } from "../brand.ts";
import { placeAllNotice } from "../furniture-notices.ts";
import { RateLimiter } from "../rate-limit.ts";
import { pushNewRequest } from "../request-push.ts";
import { type ActivityRow, isSortKey, type UsageRow } from "../stats.ts";
import {
  type AdminCompany,
  type AdminLogEntry,
  type AdminOverview,
  type AdminUser,
  companies as adminCompanies,
  adminLog,
  users as adminUsers,
  closeCompany,
  deleteUser,
  logAdmin,
  overview,
  setCompanyWallet,
  statuePin,
  wipeUsage,
} from "../town/admin.ts";
import { type Award, awardStep, collectionOf } from "../town/awards.ts";
import {
  boardsChanged,
  type CompanyProfile,
  companyProfile,
  type Leaderboard,
  leaderboard,
  type Profile,
  profile,
  type Today,
  today,
} from "../town/boards.ts";
import {
  addTavernMinutes,
  bioOf,
  lastWeekWinner,
  minutesThisWeek,
  pinsOf,
  reportBio,
  setBio,
  setPins,
  type TavernRow,
  weeklyRegulars,
  writeActivity,
} from "../town/card.ts";
import { openCase, sellDuplicates, sellItem } from "../town/cases.ts";
import {
  type BagRow,
  bag,
  buy,
  buyMerch,
  checkTrade,
  type Entry,
  floors,
  giveBack,
  grantRewards,
  type HoldKind,
  heldIn,
  hold,
  holds,
  type Kept,
  type Office,
  offices,
  ownedItems,
  type PayKind,
  type Podium,
  pay,
  pickUp,
  placed,
  podiums,
  refund,
  setBalance,
  settleTrade,
  TRADE_TTL,
  type Trade,
  takeOut,
  tossCoin,
  tradesWhere,
  treatPet,
  unclaimed,
  unwear,
  type Wallet,
  wallet,
} from "../town/coins.ts";
import {
  applicationOf,
  apply,
  approve,
  buyPiece,
  companyById,
  companyInfos,
  companyOrGone,
  decline,
  type Listing,
  leave,
  listings,
  type MyCompany,
  matchCoins,
  myCompany,
  ownedCompany,
  setMerchDesign,
  unstore,
  withdraw,
} from "../town/companies.ts";
import { buyDesk, buyDeskFleet, type MyDesk, myDesk, setDesk } from "../town/desks.ts";
import { barrel, type Whack, whack } from "../town/fastelavn.ts";
import { fishingJournal, fishingState, type Landed, recordFish } from "../town/fishing.ts";
import { type GamePlayer, gameBoard, type Placed, recordMatch } from "../town/games.ts";
import { recordGreen } from "../town/grid.ts";
import { type HallOfFame, hallOfFame } from "../town/hall.ts";
import { type Calendar, calendar, openDoor } from "../town/julekalender.ts";
import { comingKeynotes, everyKeynote, markKeynote, removeKeynote, saveKeynote } from "../town/keynotes.ts";
import { recordLaunches } from "../town/launch-bonus.ts";
import { announceLoot, grantLoot, lootBoost, raidLoot } from "../town/loot.ts";
import {
  browse as browseMarket,
  buy as buyListing,
  cancel as cancelListing,
  expire as expireListings,
  list as listItem,
  mine as mineInMarket,
  sawSales,
} from "../town/market.ts";
import { buyEdition, type Cart, type Copy, cart, copiesOf } from "../town/merchant.ts";
import {
  applyDecor,
  buyDecor,
  buyOfficeSize,
  decorNow,
  type OpenOffice,
  officeSizeNow,
  ownedDecor,
  recordVisit,
  visitorCounts,
} from "../town/offices.ts";
import { markPicnic } from "../town/picnic.ts";
import { type PokerSettle, pokerRelease, pokerSettle, pokerSit } from "../town/poker.ts";
import { freezeDays, questBoard, questEvent } from "../town/quests.ts";
import { type Raid, raid, raidHistory, raidStart } from "../town/raid.ts";
import * as requests from "../town/requests.ts";
import { rouletteBet, rouletteRefund, rouletteResolve } from "../town/roulette.ts";
import { migrate } from "../town/schema.ts";
import { paperFacts } from "../town/street.ts";
import { brand, push, pushOffice, pushPlayers } from "../town/sync.ts";
import { giveTicket } from "../town/tickets.ts";
import * as tourney from "../town/tournament.ts";
import { trophyStep } from "../town/trophy-awards.ts";
import { levelOf, lookOf, type PlayerCore, playerCores, userById } from "../town/users.ts";
import { parseBio, parseCompanyName, parseUserName, parseWebsite } from "../validate.ts";
import type { registry } from "./registry.ts";
import {
  all,
  announceTown,
  authenticate,
  type Caller,
  type ConnParams,
  clientIpOf,
  INTERNAL_KEY,
  internal,
  main,
  makeToken,
  notify,
  one,
  requireAdmin,
  requireInternal,
  requireMain,
  requireSyncer,
  requireUser,
  type Sql,
  scalar,
  serial,
  type TxSql,
} from "./shared.ts";

export type { AdminCompany, AdminLogEntry, AdminOverview, AdminUser } from "../town/admin.ts";
export type {
  BoardCompany,
  BoardPlayer,
  CompanyProfile,
  Leaderboard,
  Profile,
  Today,
} from "../town/boards.ts";
export type { BagRow, Office, Trade, Wallet } from "../town/coins.ts";
export type { Listing, MyCompany, WalletLine } from "../town/companies.ts";
export type { GamePlayer } from "../town/games.ts";
export type { Calendar } from "../town/julekalender.ts";
export type { Cart, Copy } from "../town/merchant.ts";
export type { Raid } from "../town/raid.ts";
export type { PlayerCore } from "../town/users.ts";

export interface UsageDay extends UsageRow {
  day: string;
}

export interface ActivityDay extends ActivityRow {
  day: string;
  /** Tokens past the per-minute cap, which count for nothing. */
  capped: number;
  // The card's habits (`migrateCard`): optional, so an older player actor's report still lands.
  /** Distinct sessions that day. */
  sessions?: number;
  /** Σ over 5-minute buckets of the subagents running. */
  subBuckets?: number;
  /** Active buckets by world hour: 24 numbers, comma-separated. */
  hours?: string;
  /** JSON `{source: tokens}`. */
  sources?: string;
  /** Tokens by world hour: 24 numbers, comma-separated, for green hours. */
  hourTokens?: string;
}

export interface Me {
  userId: number;
  name: string;
  look: Look;
  company: MyCompany | null;
  /** The company I've asked to join and am waiting to hear from. */
  application: { companyId: number; name: string } | null;
}

/**
 * Per client IP (from `proxy.ts`): an office signing up together fits, a script doesn't. The
 * global bucket is the backstop against many IPs at once.
 */
const SIGNUPS_PER_IP_PER_HOUR = 20;
const SIGNUPS_PER_HOUR = 1000;

/** Each one scrapes a site and asks Claude, so owners can't loop it. */
const BRANDINGS_PER_HOUR = 5;
/** Each one pings the company's owner. */
const APPLICATIONS_PER_HOUR = 10;
/** Each one pings the other person. */
const TRADES_PER_HOUR = 10;
/** Putting something on display and buying it are slow on purpose: a case is for looking at, not for scripts. */
const LISTINGS_PER_HOUR = 20;
const MARKET_BUYS_PER_HOUR = 40;
/** Each one sends a room (an office, a building, the town) to everyone in it again. */
const ROOM_CHANGES_PER_MIN = 30;
/** A new name is a new door sign: the building is rebuilt. */
const RENAMES_PER_HOUR = 10;
/** A bio is shown on every card; edits and reports are limited so it can't be flipped or flooded. */
const BIO_EDITS_PER_HOUR = 5;
const BIO_REPORTS_PER_HOUR = 5;
const REGULARS_TTL = 60_000;
const MIN = 60_000;
const HOUR = 3_600_000;
/** Drops nobody took go back to their droppers after this; the sweeper looks every `SWEEP_MS`. */
const DROP_TTL = HOUR;
const SWEEP_MS = 10 * 60_000;

/** Many rows in few statements (a first sync can report years of days). */
async function insertRows(sql: Sql, insert: string, rows: unknown[][]): Promise<void> {
  for (const chunk of chunkArray(rows, 200)) {
    const row = `(${chunk[0]!.map(() => "?").join(",")})`;
    await sql.execute(`${insert} ${chunk.map(() => row).join(",")}`, ...chunk.flat());
  }
}

type TownConn = Caller & { ip: string | null };

function userName(raw: unknown): string {
  const name = parseUserName(raw);
  if (!name)
    throw new UserError("Use 2–32 characters: a–z, 0–9, dot, dash or underscore.", { code: "invalid_name" });
  return name;
}

function companyName(raw: unknown): string {
  const name = parseCompanyName(raw);
  if (!name) throw new UserError("Use 1–32 characters.", { code: "invalid_name" });
  return name;
}

export const town = actor({
  createVars: () => ({
    serial: serial(),
    /** The newest roulette round whose betting has closed: later bets for it are refused. */
    rouletteClosed: 0,
    signups: new RateLimiter(SIGNUPS_PER_HOUR, HOUR),
    signupsPerIp: new RateLimiter(SIGNUPS_PER_IP_PER_HOUR, HOUR),
    brandings: new RateLimiter(BRANDINGS_PER_HOUR, HOUR),
    applications: new RateLimiter(APPLICATIONS_PER_HOUR, HOUR),
    trades: new RateLimiter(TRADES_PER_HOUR, HOUR),
    listings: new RateLimiter(LISTINGS_PER_HOUR, HOUR),
    marketBuys: new RateLimiter(MARKET_BUYS_PER_HOUR, HOUR),
    offices: new RateLimiter(ROOM_CHANGES_PER_MIN, MIN),
    desks: new RateLimiter(ROOM_CHANGES_PER_MIN, MIN),
    drops: new RateLimiter(ROOM_CHANGES_PER_MIN, MIN),
    /** Test servers sell anywhere (`SHOPS_ANYWHERE`); these players are held to the shop rule anyway. */
    strictShops: new Set<number>(),
    /** The open offices, read by everyone for a few seconds. */
    openOffices: null as { at: number; rows: Promise<OpenOfficeRow[]> } | null,
    renames: new RateLimiter(RENAMES_PER_HOUR, HOUR),
    bioEdits: new RateLimiter(BIO_EDITS_PER_HOUR, HOUR),
    bioReports: new RateLimiter(BIO_REPORTS_PER_HOUR, HOUR),
    /** The weekly plaques, a minute at most (the Monday boundary is the decay: no cron). */
    regulars: null as { at: number; day: string; rows: Promise<Pick<Regulars, "top" | "last">> } | null,
    /** `podiums` for a world day, for wallets and cards; a late sync or a wiped account drops it. */
    podiums: null as { day: string; rows: Promise<Podium[]> } | null,
    /** Today's paper (about yesterday): built on the first read of the day, then kept. */
    paper: null as { day: string; paper: Promise<Paper> } | null,
    /** `raidHistory`, shared by everyone polling the raid for a few seconds. */
    raids: null as { at: number; rows: Promise<RaidWeek[]> } | null,
    /** Who synced since their badges were last looked at (`awardStep`), and when each last was. */
    dirty: new Set<number>(),
    swept: new Map<number, number>(),
    /** Who synced since their trophies were last read (`trophyStep`). */
    trophyDirty: new Set<number>(),
    /** `collectionOf` per player for a minute: opened from cards and the log, which poll nothing. */
    collections: new Map<number, { at: number; state: Promise<CollectionState> }>(),
    /** The Hall of Fame, a minute at most, gone with a fresh award. */
    hall: null as { at: number; hall: Promise<HallOfFame> } | null,
  }),
  db: db({ onMigrate: migrate }),
  onCreate: (c) => requireMain(c),
  createConnState: async (c, params: ConnParams): Promise<TownConn> => ({
    ...(await authenticate(params, c.client())),
    ip: clientIpOf(c.request),
  }),
  // The sweeper's alarm. Set once: it outlives restarts, and wakes the town when it's asleep.
  // And the raid's launch, the first time: next Monday 08:00 (`raidStart`).
  onWake: async (c) => {
    if (!(await c.cron.get("sweep")))
      await c.cron.every({ name: "sweep", interval: SWEEP_MS, action: "sweep" });
    await raidStart(c.db, Date.now());
  },
  actions: {
    health: async (c): Promise<void> => {
      requireInternal(c.conn.state);
      await c.db.execute("SELECT 1");
    },
    /** Everyone who has signed up, for the landing page. */
    playerCount: (c): Promise<number> => {
      requireInternal(c.conn.state);
      return scalar(c.db, "SELECT COUNT(*) AS n FROM users");
    },
    signUp: async (c, rawName: unknown): Promise<{ userId: number; name: string; token: string }> => {
      const name = userName(rawName);
      const now = Date.now();
      if (!c.vars.signupsPerIp.take(c.conn.state.ip ?? "inside", now) || !c.vars.signups.take("all", now))
        throw new UserError("Too many sign-ups right now. Try again in a bit.", { code: "rate_limited" });
      const client = c.client<typeof registry>();
      const userId = await c.vars.serial(async () => {
        if (await one(c.db, "SELECT 1 FROM users WHERE name = ?", name))
          throw new UserError("That name is taken.", { code: "name_taken" });
        // After every id there's been: deleted accounts and lost sign-ups too. Each MAX is one index read.
        const [row] = await all<{ id: number }>(
          c.db,
          `INSERT INTO users (id, name, look, created_at) VALUES (
             MAX(COALESCE((SELECT MAX(id) FROM users), 0), COALESCE((SELECT MAX(id) FROM deleted_users), 0),
                 COALESCE((SELECT MAX(id) FROM lost_signups), 0)) + 1,
             ?, '{}', ?) RETURNING id`,
          name,
          Date.now(),
        );
        await c.db.execute(
          "UPDATE users SET look = ? WHERE id = ?",
          JSON.stringify(defaultLook(row!.id)),
          row!.id,
        );
        return row!.id;
      });
      const { token, hash } = makeToken(userId);
      try {
        await client.player.create([String(userId)], {
          input: { userId, tokenHash: hash, internal: INTERNAL_KEY },
        });
      } catch (err) {
        // Nobody holds a token for this account, so it goes; the name is free again. Not its id: a
        // timeout may have made the actor all the same, and every sign-up after would fail on it.
        await c.db.execute("DELETE FROM users WHERE id = ?", userId);
        await c.db.execute("INSERT OR IGNORE INTO lost_signups (id, at) VALUES (?, ?)", userId, Date.now());
        boardsChanged();
        throw err;
      }
      await pushPlayers(c.db, client, [userId]);
      return { userId, name, token };
    },

    me: async (c): Promise<Me> => {
      const userId = requireUser(c.conn.state);
      const u = await userById(c.db, userId);
      return {
        userId,
        name: u.name,
        look: lookOf(u),
        company: u.companyId === null ? null : await myCompany(c.db, u.companyId, userId),
        application: await applicationOf(c.db, userId),
      };
    },

    rename: async (c, rawName: unknown): Promise<void> => {
      const userId = requireUser(c.conn.state);
      if (!c.vars.renames.take(String(userId), Date.now()))
        throw new UserError("That's a lot of new names. Try again in an hour.", { code: "rate_limited" });
      await renameUser(c.db, c.vars.serial, c.client<typeof registry>(), userId, rawName);
    },

    setLook: async (c, rawLook: unknown): Promise<void> => {
      const userId = requireUser(c.conn.state);
      const look = must(parseLook(rawLook), () => new UserError("Unknown look.", { code: "invalid_look" }));
      // Serialized, so a drop or a trade can't take it off between the check and the write.
      await c.vars.serial(async () => {
        const owned = new Set(await ownedItems(c.db, userId));
        if ([...itemsIn(look).map((i) => i.id), ...merchIn(look)].some((id) => !owned.has(id)))
          throw new UserError("You don't have one in your bag.", { code: "not_owned" });
        await c.db.execute("UPDATE users SET look = ? WHERE id = ?", JSON.stringify(look), userId);
      });
      await pushPlayers(c.db, c.client<typeof registry>(), [userId]);
    },

    /** `rawPlot`: the block to build on, one of `frontier()`; the one nearest the square without. */
    createCompany: async (c, rawName: unknown, rawPlot?: unknown): Promise<MyCompany> => {
      const userId = requireUser(c.conn.state);
      const name = companyName(rawName);
      const changed = await c.vars.serial(async () => {
        const taken = await all<{ plot: number }>(c.db, "SELECT plot FROM companies");
        const free = frontier(taken.map((r) => r.plot));
        const plot = (rawPlot ?? free[0]) as number;
        if (!free.includes(plot))
          throw new UserError("Someone just built there. Pick another spot.", { code: "plot_taken" });
        const left = await leave(c.db, userId);
        await withdraw(c.db, userId);
        const now = Date.now();
        const [row] = await all<{ id: number }>(
          c.db,
          "INSERT INTO companies (name, owner_id, plot, created_at) VALUES (?, ?, ?, ?) RETURNING id",
          name,
          userId,
          plot,
          now,
        );
        await c.db.execute(
          "UPDATE users SET company_id = ?, joined_at = ? WHERE id = ?",
          row!.id,
          now,
          userId,
        );
        return { companies: [...left.companies, row!.id], users: [userId] };
      });
      await push(c.db, c.client<typeof registry>(), changed);
      return myCompany(c.db, changed.companies.at(-1)!, userId);
    },

    /** Every company, for choosing one to apply to. */
    listings: (c): Promise<Listing[]> => {
      requireUser(c.conn.state);
      return listings(c.db);
    },

    /** Asks to join a company; its owner accepts or declines. */
    apply: async (c, companyId: unknown): Promise<void> => {
      const userId = requireUser(c.conn.state);
      if (typeof companyId !== "number") throw new UserError("That company is gone.", { code: "not_found" });
      if (!c.vars.applications.take(String(userId), Date.now()))
        throw new UserError("That's a lot of applications. Try again in an hour.", { code: "rate_limited" });
      const company = await c.vars.serial(() => apply(c.db, userId, companyId, Date.now()));
      const me = await userById(c.db, userId);
      await notify(c.client<typeof registry>(), company.ownerId, {
        text: `${me.name} asks to join ${company.name}.`,
        open: "company",
      });
    },

    withdraw: async (c): Promise<void> => {
      await withdraw(c.db, requireUser(c.conn.state));
    },

    approve: async (c, applicantId: unknown): Promise<MyCompany> => {
      const userId = requireUser(c.conn.state);
      const client = c.client<typeof registry>();
      const { company, changed } = await c.vars.serial(async () => {
        const company = await ownedCompany(c.db, userId);
        return { company, changed: await approve(c.db, company, applicantId, Date.now()) };
      });
      await push(c.db, client, changed);
      await notify(client, changed.users[0]!, {
        text: `You're in! Welcome to ${company.name}.`,
        open: "company",
      });
      return myCompany(c.db, company.id, userId);
    },

    decline: async (c, applicantId: unknown): Promise<MyCompany> => {
      const userId = requireUser(c.conn.state);
      const company = await ownedCompany(c.db, userId);
      const declined = await c.vars.serial(() => decline(c.db, company, applicantId));
      await notify(c.client<typeof registry>(), declined, {
        text: `${company.name} said no this time.`,
        open: "company",
      });
      return myCompany(c.db, company.id, userId);
    },

    leaveCompany: async (c): Promise<void> => {
      const userId = requireUser(c.conn.state);
      const changed = await c.vars.serial(() => leave(c.db, userId));
      await push(c.db, c.client<typeof registry>(), changed);
    },

    kick: async (c, memberId: unknown): Promise<void> => {
      const userId = requireUser(c.conn.state);
      const changed = await c.vars.serial(async () => {
        const company = await ownedCompany(c.db, userId);
        const member = typeof memberId === "number" ? await userById(c.db, memberId).catch(() => null) : null;
        if (!member || member.companyId !== company.id || member.id === userId)
          throw new UserError("They're not in your company.", { code: "not_found" });
        return leave(c.db, member.id);
      });
      await push(c.db, c.client<typeof registry>(), changed);
    },

    renameCompany: async (c, rawName: unknown): Promise<void> => {
      const userId = requireUser(c.conn.state);
      const company = await ownedCompany(c.db, userId);
      await renameCompany(c.db, c.client<typeof registry>(), company.id, rawName);
    },

    /**
     * The owner sets the company's website (empty clears it). The sign shows it at
     * once; the house is repainted in the brand's colours when reading the site is done.
     */
    setWebsite: async (c, raw: unknown): Promise<MyCompany> => {
      const userId = requireUser(c.conn.state);
      const company = await ownedCompany(c.db, userId);
      const website = raw === "" ? null : parseWebsite(raw);
      if (website === null && raw !== "")
        throw new UserError("That doesn't look like a website. Try acme.com.", { code: "invalid_website" });
      if (website && website !== company.website && !c.vars.brandings.take(String(company.id), Date.now()))
        throw new UserError("That's a lot of websites. Try again in an hour.", { code: "rate_limited" });
      const client = c.client<typeof registry>();
      if (website !== company.website) {
        await c.db.execute(
          "UPDATE companies SET website = ?, branding = ?, brand = NULL WHERE id = ?",
          website,
          website && canBrand() ? "working" : null,
          company.id,
        );
        await push(c.db, client, { companies: [company.id], users: [] });
        if (website && canBrand()) c.waitUntil(brand(c.db, client, company.id, company.name, website));
      }
      return myCompany(c.db, company.id, userId);
    },

    /** Any member sets the company's merch design (null: back to the brand's colours). */
    setMerch: async (c, raw: unknown): Promise<void> => {
      const userId = requireUser(c.conn.state);
      const companyId = await setMerchDesign(c.db, userId, raw);
      await push(c.db, c.client<typeof registry>(), { companies: [companyId], users: [] });
    },

    wallet: async (c): Promise<Wallet> => {
      const userId = requireUser(c.conn.state);
      const now = Date.now();
      return wallet(c.db, userId, now, await kept(c, now));
    },

    /** This week's ladder (last week's until Monday 08:00): the boss up now, how hurt it is, and who's hitting it. */
    raid: async (c): Promise<Raid> => {
      const userId = requireUser(c.conn.state);
      const now = Date.now();
      const r = await raid(c.db, userId, await raidsOf(c, now), now);
      return { ...r, loot: await raidLoot(c.db, userId, r.week, r.boss, lootBoost()) };
    },

    /** What I hold, per kind, for the bag panel. */
    bag: (c): Promise<BagRow[]> => bag(c.db, requireUser(c.conn.state)),

    buy: async (c, itemId: unknown): Promise<Wallet> => {
      const userId = requireUser(c.conn.state);
      const item = itemById(itemId);
      if (!item) throw new UserError("That's not in the shop.", { code: "not_found" });
      if (item.level !== undefined || item.earned)
        throw new UserError("That one is earned, not bought.", { code: "not_for_sale" });
      if (editionById(item.id))
        throw new UserError("Only the traveling merchant sells that.", { code: "not_for_sale" });
      if (item.case) throw new UserError("That one only comes out of a case.", { code: "not_for_sale" });
      if (item.loot) throw new UserError("That one drops in the raid.", { code: "not_for_sale" });
      if (item.company)
        throw new UserError("That one is for company buildings, from the company wallet.", {
          code: "not_for_sale",
        });
      await inShop(c, userId, shopForSlot(item.slot));
      const k = await kept(c, Date.now());
      if (item.slot === "merch") return c.vars.serial(() => buyMerch(c.db, userId, item, Date.now(), k));
      return c.vars.serial(() => buy(c.db, userId, item, Date.now(), k));
    },

    // MARK: Cases

    /** One opening of `caseId`, in the case shop: the key's coins out, a rolled item into the bag. */
    openCase: async (c, caseId: unknown): Promise<{ item: Item; wallet: Wallet }> => {
      const userId = requireUser(c.conn.state);
      if (!caseById(caseId)) throw new UserError("There's no such case.", { code: "not_found" });
      await inCaseShop(c, userId);
      const k = await kept(c, Date.now());
      return c.vars.serial(() => openCase(c.db, userId, caseId, Date.now(), k));
    },

    /** From `world`: sets `userId`'s bets for `round` (stakes out of the wallet now). Refused once the round is closed. */
    rouletteBet: async (
      c,
      userId: number,
      round: number,
      bets: unknown,
    ): Promise<{ bets: Bet[]; total: number }> => {
      requireInternal(c.conn.state);
      const k = await kept(c, Date.now());
      return c.vars.serial(() => {
        if (round <= c.vars.rouletteClosed) throw new UserError("Bets are closed.", { code: "closed" });
        return rouletteBet(c.db, userId, round, bets, Date.now(), k);
      });
    },

    /** From `world`: betting is over. Rolls the round's pocket, pays everyone, and returns the shared outcome. */
    rouletteResolve: async (c, round: number): Promise<{ pocket: number; results: RouletteOutcome[] }> => {
      requireInternal(c.conn.state);
      return c.vars.serial(() => {
        c.vars.rouletteClosed = Math.max(c.vars.rouletteClosed, round);
        return rouletteResolve(c.db, round, Date.now());
      });
    },

    /** From `world`: a player left during betting, or the world woke fresh (no `userId`): stakes go back. */
    rouletteRefund: async (c, userId?: number, round?: number): Promise<number> => {
      requireInternal(c.conn.state);
      return c.vars.serial(() => {
        if (userId === undefined && round === undefined) c.vars.rouletteClosed = 0; // a fresh world counts rounds from 1
        return rouletteRefund(c.db, Date.now(), userId, round);
      });
    },

    /** One case item to the vendor for coins by rarity. */
    sellItem: async (c, itemId: unknown): Promise<Wallet> => {
      const userId = requireUser(c.conn.state);
      const k = await kept(c, Date.now());
      const out = await c.vars.serial(() => sellItem(c.db, userId, itemId, Date.now(), k));
      if (out.unworn) await pushPlayers(c.db, c.client<typeof registry>(), [userId]);
      return out.wallet;
    },

    /** Every copy past the first of each item of `caseId`, sold. */
    sellDuplicates: async (c, caseId: unknown): Promise<{ wallet: Wallet; sold: number }> => {
      const userId = requireUser(c.conn.state);
      const k = await kept(c, Date.now());
      return c.vars.serial(() => sellDuplicates(c.db, userId, caseId, Date.now(), k));
    },

    // MARK: Company furniture

    /**
     * The owner buys a piece of company furniture from the company wallet. It goes down in front of
     * them if they're in the building; otherwise (or with no room on the floor) into the storeroom.
     */
    buyPiece: async (c, itemId: unknown): Promise<{ notice: string; company: MyCompany }> => {
      const userId = requireUser(c.conn.state);
      const item = itemById(itemId);
      if (!item?.company) throw new UserError("That's not for company buildings.", { code: "not_found" });
      await inShop(c, userId, "furniture");
      return furnish(c, userId, "buy", (company, now) => buyPiece(c.db, company, userId, item, now));
    },

    /** Any member puts a piece from the storeroom down in front of them, in the building. */
    placePiece: async (
      c,
      itemId: unknown,
      onto?: unknown,
    ): Promise<{ notice: string; company: MyCompany; drop?: Drop }> => {
      const userId = requireUser(c.conn.state);
      const at = tileArg(onto);
      return furnish(
        c,
        userId,
        "place",
        (company, now) => unstore(c.db, company.id, itemId, userId, now),
        at,
      );
    },

    /**
     * Any member puts out everything in the storeroom they have floor for, near where they stand. One
     * piece at a time (a full room stops the rest in the storeroom), with one summary line.
     */
    placeAll: async (c): Promise<{ notice: string; company: MyCompany }> => {
      const userId = requireUser(c.conn.state);
      const u = await userById(c.db, userId);
      const company = u.companyId === null ? undefined : await companyById(c.db, u.companyId);
      if (!company) throw new UserError("Join a company first.", { code: "not_member" });
      const notice = await c.vars.serial(async () => {
        const stored = await all<{ id: number; item: string }>(
          c.db,
          "SELECT id, item FROM items WHERE company_id = ? AND room IS NULL ORDER BY id",
          company.id,
        );
        if (stored.length === 0) return "The storeroom is empty.";
        let placedCount = 0;
        let first: string | undefined;
        for (const row of stored) {
          // Only a row still in the storeroom: a colleague may have put it out meanwhile.
          const took = await all(
            c.db,
            "UPDATE items SET dropped_by = ?, dropped_at = ? WHERE id = ? AND company_id = ? AND room IS NULL RETURNING id",
            userId,
            Date.now(),
            row.id,
            company.id,
          );
          if (took.length === 0) continue;
          const put = await main(c.client())
            .world.placeDrop({ id: row.id, item: row.item, by: userId, co: company.id })
            .catch((err) => {
              console.warn(`[placeAll] ${row.id}: ${String(err)}`);
              return { notice: "That didn't work. Try again." };
            });
          if ("notice" in put) first ??= put.notice;
          else {
            await placed(c.db, put);
            placedCount++;
          }
        }
        return placeAllNotice(placedCount, stored.length - placedCount, first);
      });
      return { notice, company: await myCompany(c.db, company.id, userId) };
    },

    /** The morning paper: yesterday in town, the same front page all day. */
    paper: (c): Promise<Paper> => {
      const userId = requireUser(c.conn.state);
      const now = Date.now();
      const day = addDays(dayKey(now), -1);
      // Opening it is the day's paper quest. ponytail: not checked against where they stand.
      void c.vars
        .serial(() => questEvent(c.db, userId, "paper", `paper:${dayKey(now)}`, now))
        .catch((err) => console.warn(`[quests] ${userId}: ${String(err)}`));
      if (c.vars.paper?.day !== day)
        c.vars.paper = { day, paper: paperFacts(c.db, day).then((f) => ({ day, headlines: headlines(f) })) };
      const paper = c.vars.paper.paper;
      // A failed build is tried again on the next read.
      paper.catch(() => {
        if (c.vars.paper?.paper === paper) c.vars.paper = null;
      });
      return paper;
    },

    // MARK: The traveling merchant (`core/src/merchant.ts`)

    /** What's on the cart this week, and how many of each are gone. */
    cart: (c): Promise<Cart> => cart(c.db, Date.now()),

    /** The next numbered copy of one off the cart. */
    buyEdition: async (c, itemId: unknown): Promise<{ wallet: Wallet; n: number }> => {
      const userId = requireUser(c.conn.state);
      const k = await kept(c, Date.now());
      return c.vars.serial(() => buyEdition(c.db, userId, itemId, Date.now(), k));
    },

    /** The numbered copies in my bag. */
    copies: (c): Promise<Copy[]> => copiesOf(c.db, requireUser(c.conn.state)),

    // MARK: Torvehallen, the market hall

    /** Everything on display, by slot. Anyone may look from anywhere; only the hall sells. */
    marketListings: async (c): Promise<MarketListing[]> => {
      requireUser(c.conn.state);
      const now = Date.now();
      await expireListings(c.db, now);
      return browseMarket(c.db, now);
    },

    /** What I have on display, my room left, and the sales I haven't heard of. */
    marketMine: async (c): Promise<MyMarket> => {
      const userId = requireUser(c.conn.state);
      const now = Date.now();
      await expireListings(c.db, now);
      return mineInMarket(c.db, userId, now);
    },

    /** Puts one of my items on a slot at my price: in the hall, and for good (a price is not changed, only taken back). */
    marketList: async (c, want: unknown): Promise<MarketListing> => {
      const userId = requireUser(c.conn.state);
      const w = (typeof want === "object" && want !== null ? want : {}) as Record<string, unknown>;
      await inMarket(c, userId);
      if (!c.vars.listings.take(String(userId), Date.now()))
        throw new UserError("That's a lot of listings. Try again in an hour.", { code: "rate_limited" });
      const { listing, unworn } = await c.vars.serial(() =>
        listItem(c.db, userId, { item: w.item, slot: w.slot, price: w.price, copy: w.copy }, Date.now()),
      );
      if (unworn) await pushPlayers(c.db, c.client<typeof registry>(), [userId]);
      return listing;
    },

    /** Takes one of my listings back, from anywhere. */
    marketCancel: async (c, listingId: unknown): Promise<void> => {
      const userId = requireUser(c.conn.state);
      await c.vars.serial(() => cancelListing(c.db, userId, listingId));
    },

    /** Buys a listing at the price I saw, in the hall. The seller is told, or finds out on their next look. */
    marketBuy: async (c, listingId: unknown, price: unknown): Promise<Wallet> => {
      const userId = requireUser(c.conn.state);
      await inMarket(c, userId);
      const now = Date.now();
      if (!c.vars.marketBuys.take(String(userId), now))
        throw new UserError("That's a lot of buying. Try again in an hour.", { code: "rate_limited" });
      const k = await kept(c, now);
      const {
        wallet: after,
        sale,
        sellerId,
      } = await c.vars.serial(() =>
        buyListing(
          c.db,
          userId,
          listingId,
          price,
          now,
          k,
          process.env.MARKET_ANY_AGE === "1" ? 0 : undefined,
        ),
      );
      await notify(c.client<typeof registry>(), sellerId, {
        text: `${sale.buyer} bought your ${itemById(sale.item)?.name ?? "item"} for 🪙 ${sale.price}.`,
        open: "market",
      });
      return after;
    },

    /** I have been told of my sales up to this one. */
    marketSaw: async (c, upTo: unknown): Promise<void> => sawSales(c.db, requireUser(c.conn.state), upTo),

    // MARK: The julekalender

    /** Today's door and the doors I've opened this December. */
    julekalender: (c): Promise<Calendar> => calendar(c.db, requireUser(c.conn.state), Date.now()),

    /** Opens today's door: its coins or its item, once. */
    openDoor: async (c): Promise<{ door: number; gift: Gift; notice: string; wallet: Wallet }> => {
      const userId = requireUser(c.conn.state);
      const k = await kept(c, Date.now());
      return c.vars.serial(() => openDoor(c.db, userId, Date.now(), k));
    },

    // MARK: Drops

    /**
     * One of mine onto the floor where I am, for anyone to take. A full room says so (the notice is for
     * the Bag), and the item stays mine.
     */
    drop: async (c, itemId: unknown, onto?: unknown): Promise<{ notice: string; drop?: Drop }> => {
      const userId = requireUser(c.conn.state);
      const at = tileArg(onto);
      if (!c.vars.drops.take(String(userId), Date.now()))
        throw new UserError("That's a lot of drops. Try again in a minute.", { code: "rate_limited" });
      const client = c.client<typeof registry>();
      const id = await c.vars.serial(() => takeOut(c.db, userId, itemId, Date.now()));
      // Not under `serial` while `world` places it, so a slow world holds up nobody else. The row is on
      // the floor meanwhile, with a fresh `dropped_at`: the sweeper leaves it, and if it landed and
      // someone took it already, `giveBack` finds nothing to give.
      // ponytail: one that landed but timed out stays on the floor with its row back here: taking it
      // gets nothing (`pickUp` is false). `removeDrops` it here if that ever shows up.
      const put = await main(client)
        .world.placeDrop({ id, item: itemId as string, by: userId, ...(at && { onto: at }) })
        .catch((err) => {
          console.warn(`[drop] ${id}: ${String(err)}`);
          return { notice: "That didn't work. Try again." };
        });
      let off = false;
      const out = await c.vars.serial(async () => {
        if ("notice" in put) {
          await giveBack(c.db, [id]);
          return put;
        }
        await placed(c.db, put);
        off = await unwear(c.db, userId, [put.item]);
        return { notice: `Dropped the ${dropName(put)}.`, drop: put };
      });
      // Off it comes, if it was the last one worn.
      if (off) await pushPlayers(c.db, client, [userId]);
      return out;
    },

    /** From `world.take`: a drop on `room`'s floor into the taker's bag. False if it isn't there any more. */
    pickUp: async (c, dropId: number, userId: number, room: string): Promise<boolean> => {
      requireInternal(c.conn.state);
      return pickUp(c.db, dropId, userId, room);
    },

    /** From `world.move`: where a piece of furniture now stands, and how far it is turned. False if its row is gone or in a bag. */
    moved: async (c, d: Drop): Promise<boolean> => {
      requireInternal(c.conn.state);
      const rows = await all(
        c.db,
        "UPDATE items SET x = ?, y = ?, rot = ? WHERE id = ? AND room = ? AND owner_id IS NULL RETURNING id",
        d.x,
        d.y,
        d.rot || null,
        d.id,
        d.room,
      );
      return rows.length > 0;
    },

    /** Today's quests and the week's, with how far each is. Deals today's the first time. */
    questBoard: (c): Promise<QuestBoard> => {
      const userId = requireUser(c.conn.state);
      return c.vars.serial(() => questBoard(c.db, userId, Date.now()));
    },

    // MARK: The basement's tournament board

    /** The live bracket and the latest champion. Starts a due bracket first. */
    tournament: (c): Promise<TournamentBoard> => {
      requireUser(c.conn.state);
      return c.vars.serial(async () => {
        const { lines, ...board } = await tourney.board(c.db, Date.now());
        await tellTown(c, lines);
        return board;
      });
    },

    /** Opens a bracket (a game, 4 or 8 players) with me signed up. */
    tournamentOpen: (c, game: unknown, size: unknown): Promise<void> => {
      const userId = requireUser(c.conn.state);
      return c.vars.serial(async () =>
        tellTown(c, (await tourney.open(c.db, userId, game, size, Date.now())).lines),
      );
    },

    /** Signs me up for the open bracket, or out of it. */
    tournamentJoin: (c, join: unknown): Promise<void> => {
      const userId = requireUser(c.conn.state);
      return c.vars.serial(async () =>
        tellTown(c, (await tourney.signup(c.db, userId, join !== false, Date.now())).lines),
      );
    },

    /** From `arcade`: a match ended. Counts if it was a waiting match of the running bracket. */
    tournamentResult: (c, game: string, players: number[], winners: number[]): Promise<void> => {
      requireInternal(c.conn.state);
      return c.vars.serial(async () =>
        tellTown(c, (await tourney.matchResult(c.db, game, players, winners, Date.now())).lines),
      );
    },

    // MARK: The Tavern's request pile

    /** The pile: what people would like in the game, with my 👍 marked. */
    requests: (c): Promise<RequestEntry[]> => {
      const userId = requireUser(c.conn.state);
      return requests.pile(c.db, userId);
    },

    /** Puts a request on the pile, and pushes it to the agent webhook. */
    requestAdd: async (c, text: unknown): Promise<void> => {
      const userId = requireUser(c.conn.state);
      const added = await c.vars.serial(() => requests.submit(c.db, userId, text, Date.now()));
      c.waitUntil(pushNewRequest(added));
    },

    /** Gives a request my 👍, or takes it back. */
    requestVote: (c, id: unknown, on: unknown): Promise<void> => {
      const userId = requireUser(c.conn.state);
      return c.vars.serial(() => requests.vote(c.db, userId, id, on !== false));
    },

    /** Takes back my own open request. */
    requestWithdraw: (c, id: unknown): Promise<void> => {
      const userId = requireUser(c.conn.state);
      return c.vars.serial(() => requests.withdraw(c.db, userId, id));
    },

    /** From `world`: `userId` did `kind` in town (once per `key` in a row). True when it counted. */
    questEvent: (c, userId: number, kind: string, key: string): Promise<boolean> => {
      requireInternal(c.conn.state);
      const now = Date.now();
      return c.vars.serial(() => questEvent(c.db, userId, kind, key, now));
    },

    /** From `world`: a whack at the fastelavn barrel, and, if it broke, everyone's loot. */
    whack: async (c, userId: number): Promise<Whack> => {
      requireInternal(c.conn.state);
      return c.vars.serial(() => whack(c.db, userId, Date.now()));
    },

    /** From `world`: this year's barrel, for whoever comes to town on Fastelavn. */
    barrel: (c): Promise<Barrel> => {
      requireInternal(c.conn.state);
      return barrel(c.db, Date.now());
    },

    /** Your catch-and-release journal, shared across devices. */
    fishingJournal: (c): Promise<FishingEntry[]> => fishingJournal(c.db, requireUser(c.conn.state)),

    /** The fishing panel: your journal, the day's lucky casts, the pond's records and your treasures. */
    fishingState: (c): Promise<FishingState> => fishingState(c.db, requireUser(c.conn.state), Date.now()),

    /**
     * From `world`: an on-time reel. A treasure goes in the bag and is told to the town; a new record or a badge
     * shows the next time anyone looks.
     */
    recordFish: async (c, userId: number, caught: FishCatch): Promise<Landed> => {
      requireInternal(c.conn.state);
      const now = Date.now();
      const landed = await c.vars.serial(() => recordFish(c.db, userId, caught, now));
      c.vars.dirty.add(userId);
      c.vars.collections.delete(userId);
      if (landed.treasure) {
        const item = itemById(landed.treasure.item);
        const who = (await one<{ name: string }>(c.db, "SELECT name FROM users WHERE id = ?", userId))?.name;
        if (item && who) await announceTown(c.client(), `🎣 ${who} fished up a ${item.name} from the pond!`);
      }
      return landed;
    },

    /** From `world`: a coin in the fountain (1 coin out, and the day's fountain quest). */
    toss: async (c, userId: number): Promise<void> => {
      requireInternal(c.conn.state);
      const now = Date.now();
      const k = await kept(c, now);
      await c.vars.serial(() => tossCoin(c.db, userId, now, k));
    },

    /** From `world`: a treat for `userId`'s pet (`TREAT_COST` coins, `TREATS_PER_DAY` a day); the treats left today. */
    treat: async (c, userId: number): Promise<number> => {
      requireInternal(c.conn.state);
      const now = Date.now();
      const k = await kept(c, now);
      return c.vars.serial(() => treatPet(c.db, userId, now, k));
    },

    /** From `world.dance`: whether `userId` has learned the dance `item` (`dance.<index>`). */
    knowsDance: (c, userId: number, item: string): Promise<boolean> => {
      requireInternal(c.conn.state);
      return holds(c.db, userId, item);
    },

    /** From `world.sit`: on a blanket at the outage picnic that started at `since`. True the first time. */
    picnicked: (c, userId: number, since: number): Promise<boolean> => {
      requireInternal(c.conn.state);
      return markPicnic(c.db, userId, since);
    },

    /** For `world`: the keynotes still to come or on, soonest first (it asks every few minutes). */
    keynotes: (c): Promise<Keynote[]> => {
      requireInternal(c.conn.state);
      return comingKeynotes(c.db, Date.now());
    },

    /** From `world`: the launches it has read from OpenRouter, so a model used on its launch day pays (once each). */
    launched: (c, launches: Launch[]): Promise<void> => {
      requireInternal(c.conn.state);
      return recordLaunches(c.db, launches);
    },

    /** From `world`: in the Tavern while keynote `keynoteId` is on its screen. True the first time. */
    keynoteWatched: (c, userId: number, keynoteId: number): Promise<boolean> => {
      requireInternal(c.conn.state);
      return markKeynote(c.db, userId, keynoteId);
    },

    /**
     * The alarm, every 10 minutes: drops nobody took in an hour go back to whoever dropped them, and
     * trade offers past their week go. And the raid is worked out, so a kill's loot is handed out even
     * while nobody's watching (`raidsOf`).
     */
    sweep: async (c): Promise<void> => {
      // The alarm calls with no connection; anyone else has one, and has to be inside.
      if (c.conn) requireInternal(c.conn.state);
      // Never in the way of the drops below.
      try {
        await raidsOf(c, Date.now());
      } catch (err) {
        console.warn(`[sweep] raid: ${String(err)}`);
      }
      try {
        await c.db.execute("DELETE FROM trades WHERE at < ?", Date.now() - TRADE_TTL);
      } catch (err) {
        console.warn(`[sweep] trades: ${String(err)}`);
      }
      try {
        await expireListings(c.db, Date.now());
      } catch (err) {
        console.warn(`[sweep] market: ${String(err)}`);
      }
      try {
        const now = Date.now();
        const { awards, backfilled } = await awardStep(
          c.db,
          c.vars.dirty,
          c.vars.swept,
          now,
          await kept(c, now),
        );
        if (backfilled) c.vars.hall = null;
        await told(c, awards);
      } catch (err) {
        console.warn(`[sweep] awards: ${String(err)}`);
      }
      try {
        const now = Date.now();
        // Trophies are the player's own events, kept in their actor: the town records them to pay them.
        await trophyStep(c.db, c.vars.trophyDirty, now, (id) =>
          c
            .client<typeof registry>()
            .player.get([String(id)], internal)
            .trophies(),
        );
      } catch (err) {
        console.warn(`[sweep] trophies: ${String(err)}`);
      }
      const ids = await unclaimed(c.db, Date.now() - DROP_TTL);
      if (ids.length === 0) return;
      // Off the floor first: if `world` is down, nothing changed and the next sweep tries again.
      await main(c.client<typeof registry>()).world.removeDrops(ids);
      await giveBack(c.db, ids);
    },

    // MARK: Trades

    /** Offers `toId` my `give` for their `want`. It replaces my open offer, if I had one. */
    offerTrade: async (c, rawTo: unknown, rawGive: unknown, rawWant: unknown): Promise<void> => {
      const userId = requireUser(c.conn.state);
      const toId = playerId(rawTo);
      if (toId === userId) throw new UserError("Trade with someone else.", { code: "invalid_trade" });
      const me = await userById(c.db, userId);
      const them = await userById(c.db, toId);
      // `parseSide` refuses a reward too; this says why.
      const asked = [rawGive, rawWant].flatMap((s) => (s as { items?: unknown } | null)?.items ?? []);
      if (asked.some((i) => itemById(i)?.tradeable === false))
        throw new UserError("Level rewards stay with you.", { code: "invalid_trade" });
      const give = parseSide(rawGive);
      const want = parseSide(rawWant);
      if (give && want && emptySide(give) && emptySide(want))
        throw new UserError("Offer something, or ask for something.", { code: "invalid_trade" });
      if (!give || !want)
        throw new UserError(`Up to 🪙 ${TRADE_COINS_CAP} and ${TRADE_ITEMS_CAP} shop items a side.`, {
          code: "invalid_trade",
        });
      const now = Date.now();
      const trade = { fromId: userId, from: me.name, toId, to: them.name, give, want, at: now };
      // Their coins are theirs to know: accepting checks them.
      await checkTrade(c.db, { ...trade, want: { ...want, coins: 0 } }, now, await kept(c, now));
      if (!c.vars.trades.take(String(userId), now))
        throw new UserError("That's a lot of offers. Try again in an hour.", { code: "rate_limited" });
      await c.db.execute(
        "INSERT OR REPLACE INTO trades (from_id, to_id, give, want, at) VALUES (?, ?, ?, ?, ?)",
        userId,
        toId,
        JSON.stringify(give),
        JSON.stringify(want),
        now,
      );
      await notify(c.client<typeof registry>(), toId, {
        text: `${me.name} offers you a trade.`,
        open: "trades",
      });
    },

    /** Offers to me and my own, newest first. */
    trades: async (c): Promise<{ incoming: Trade[]; outgoing: Trade | null }> => {
      const userId = requireUser(c.conn.state);
      // Older ones are past it: the sweeper deletes them.
      const since = Date.now() - TRADE_TTL;
      return {
        incoming: await tradesWhere(c.db, "to_id = ? AND at >= ?", userId, since),
        outgoing: (await tradesWhere(c.db, "from_id = ? AND at >= ?", userId, since))[0] ?? null,
      };
    },

    /** `at`: the offer as I saw it, so one swapped meanwhile isn't accepted unseen. */
    acceptTrade: async (c, fromId: unknown, at: unknown): Promise<Wallet> => {
      const userId = requireUser(c.conn.state);
      const now = Date.now();
      const k = await kept(c, now);
      const trade = await c.vars.serial(async () => {
        const trade = await offerTo(c.db, userId, fromId, now);
        if (trade.at !== at)
          throw new UserError("They changed the offer. Have another look.", { code: "not_found" });
        await settleTrade(c.db, trade, now, k);
        return trade;
      });
      const client = c.client<typeof registry>();
      // Looks may have changed.
      await pushPlayers(c.db, client, [trade.fromId, userId]);
      await notify(client, trade.fromId, { text: `${trade.to} accepted your trade.`, open: "bag" });
      return wallet(c.db, userId, now, k);
    },

    declineTrade: async (c, fromId: unknown): Promise<void> => {
      const userId = requireUser(c.conn.state);
      const trade = await offerTo(c.db, userId, fromId, Date.now());
      await c.db.execute("DELETE FROM trades WHERE from_id = ? AND at = ?", trade.fromId, trade.at);
      await notify(c.client<typeof registry>(), trade.fromId, { text: `${trade.to} passed on your trade.` });
    },

    withdrawTrade: async (c): Promise<void> => {
      await c.db.execute("DELETE FROM trades WHERE from_id = ?", requireUser(c.conn.state));
    },

    /** What `userId` could trade away, for the trade panel. */
    tradeables: async (c, targetId: unknown): Promise<{ name: string; owned: string[] }> => {
      requireUser(c.conn.state);
      const u = await userOf(c.db, targetId);
      return { name: u.name, owned: (await ownedItems(c.db, u.id)).filter(isTradeable) };
    },

    /** What wallpapers and floors I may use now, as `<kind>.<id>`. */
    decorOwned: async (c): Promise<string[]> => ownedDecor(c.db, requireUser(c.conn.state)),

    /** What my office wears now, so the panel can say "In use" wherever I stand. */
    decorNow: async (c) => decorNow(c.db, requireUser(c.conn.state)),

    /** Buys a wallpaper or floor (`kind` wall or floor); `setDecor` puts it on. */
    buyDecor: async (c, kind: unknown, id: unknown): Promise<Wallet> => {
      const userId = requireUser(c.conn.state);
      await inShop(c, userId, "furniture");
      const now = Date.now();
      const k = await kept(c, now);
      return c.vars.serial(() => buyDecor(c.db, userId, kind, id, now, k));
    },

    /** My office's size now, 0 to 3 (`officeTier`). */
    officeSize: async (c): Promise<number> => officeSizeNow(c.db, requireUser(c.conn.state)),

    /** Buys the next size for my office. The room grows for whoever is inside. */
    buyOfficeSize: async (c): Promise<Wallet> => {
      const userId = requireUser(c.conn.state);
      await inShop(c, userId, "furniture");
      const now = Date.now();
      const k = await kept(c, now);
      const { wallet } = await c.vars.serial(() => buyOfficeSize(c.db, userId, now, k));
      await pushOffice(c.db, c.client<typeof registry>(), userId);
      return wallet;
    },

    /** Puts a wallpaper or floor I own on my office, for free (`null`: the plain one). */
    setDecor: async (c, kind: unknown, id: unknown): Promise<void> => {
      const userId = requireUser(c.conn.state);
      if (!c.vars.offices.take(String(userId), Date.now()))
        throw new UserError("That's a lot of changes. Try again in a minute.", { code: "rate_limited" });
      if (id !== null && typeof id !== "string") throw new UserError("Which one?", { code: "invalid_decor" });
      const client = c.client<typeof registry>();
      const { drops } = await c.vars.serial(() => applyDecor(c.db, userId, kind, id, Date.now()));
      await placeStarter(client, drops);
      await pushOffice(c.db, client, userId);
    },

    // MARK: Desk setups

    /** Which desk setups I may use, and which I use. */
    deskOwned: async (c): Promise<MyDesk> => myDesk(c.db, requireUser(c.conn.state)),

    /** Buys a desk setup (a `DESKS` id) for my coins; `setDesk` puts it on. */
    buyDesk: async (c, id: unknown): Promise<Wallet> => {
      const userId = requireUser(c.conn.state);
      if (!c.vars.desks.take(String(userId), Date.now()))
        throw new UserError("That's a lot of changes. Try again in a minute.", { code: "rate_limited" });
      await inShop(c, userId, "furniture");
      const now = Date.now();
      const k = await kept(c, now);
      return c.vars.serial(() => buyDesk(c.db, userId, id, now, k));
    },

    /** Switches to a desk setup I own, free. Everyone sees it at once. */
    setDesk: async (c, id: unknown): Promise<void> => {
      const userId = requireUser(c.conn.state);
      if (!c.vars.desks.take(String(userId), Date.now()))
        throw new UserError("That's a lot of changes. Try again in a minute.", { code: "rate_limited" });
      await c.vars.serial(() => setDesk(c.db, userId, id));
      await pushPlayers(c.db, c.client<typeof registry>(), [userId]);
    },

    /** The owner has the company buy its house the next desk tier from the wallet. */
    buyDeskFleet: async (c): Promise<MyCompany> => {
      const userId = requireUser(c.conn.state);
      if (!c.vars.desks.take(String(userId), Date.now()))
        throw new UserError("That's a lot of changes. Try again in a minute.", { code: "rate_limited" });
      const u = await userById(c.db, userId);
      if (u.companyId === null) throw new UserError("Join a company first.", { code: "not_member" });
      const company = await ownedCompany(c.db, userId);
      await inShop(c, userId, "furniture");
      await c.vars.serial(() => buyDeskFleet(c.db, company, userId, Date.now()));
      await push(c.db, c.client<typeof registry>(), { users: [], companies: [company.id] });
      return myCompany(c.db, company.id, userId);
    },

    /** The open offices, busiest first. Everyone reads the same list for 5 seconds. */
    openOffices: (c): Promise<OpenOfficeRow[]> => {
      requireUser(c.conn.state);
      const now = Date.now();
      const kept = c.vars.openOffices;
      if (kept && now - kept.at < OPEN_OFFICES_TTL) return kept.rows;
      const rows = (async () => {
        const [live, visitors] = await Promise.all([
          main(c.client<typeof registry>()).world.openOffices(),
          visitorCounts(c.db, now),
        ]);
        return live
          .map((o) => ({ ...o, visitors: visitors[o.id] ?? 0 }))
          .sort((a, b) => b.visitors - a.visitors || b.inside - a.inside || b.level - a.level || a.id - b.id)
          .slice(0, OPEN_OFFICES_LIMIT);
      })();
      c.vars.openOffices = { at: now, rows };
      rows.catch(() => {
        if (c.vars.openOffices?.rows === rows) c.vars.openOffices = null;
      });
      return rows;
    },

    /** From `world`: `visitorId` stepped into `ownerId`'s office today. */
    officeVisit: async (c, ownerId: number, visitorId: number): Promise<void> => {
      requireInternal(c.conn.state);
      await recordVisit(c.db, ownerId, visitorId, Date.now());
    },

    /** From `player` after an ingest: replaces those days' rollups and hands out level rewards reached. */
    report: async (
      c,
      userId: number,
      days: string[],
      usage: UsageDay[],
      activity: ActivityDay[],
    ): Promise<void> => {
      requireInternal(c.conn.state);
      const drops = await c.vars.serial(() =>
        c.db.transaction(
          async (tx) => {
            // Deleted meanwhile: nothing of theirs is written back.
            await userById(tx, userId);
            const inDays = `day IN (${days.map(() => "?").join(",")})`;
            await tx.execute(`DELETE FROM usage_daily WHERE user_id = ? AND ${inDays}`, userId, ...days);
            await insertRows(
              tx,
              "INSERT INTO usage_daily (user_id, day, model, input, output, cache_creation, cache_read, turns, reported_cost_cents) VALUES",
              usage.map((r) => [
                userId,
                r.day,
                r.model,
                r.input,
                r.output,
                r.cacheCreation,
                r.cacheRead,
                r.turns,
                r.reportedCostCents ?? 0,
              ]),
            );
            await writeActivity(tx, userId, activity);
            await tx.execute(`DELETE FROM capped_daily WHERE user_id = ? AND ${inDays}`, userId, ...days);
            await insertRows(
              tx,
              "INSERT INTO capped_daily VALUES",
              activity.filter((a) => a.capped > 0).map((a) => [userId, a.day, a.capped]),
            );
            // Their company gets as many coins again.
            await matchCoins(tx, userId, days, Date.now());
            // Each synced day's quests are dealt now, so a day nobody opened the town on still pays.
            if (TAVERN) await freezeDays(tx, userId, days, Date.now());
            return grantRewards(tx, userId, await levelOf(tx, userId), Date.now());
          },
          { name: "report-usage" },
        ),
      );
      // A finished day changed: its podium may have too.
      if (days.some((d) => d < dayKey(Date.now()))) c.vars.podiums = null;
      // Their badges are looked at in the next sweep, not here: a sync is busy enough.
      c.vars.dirty.add(userId);
      c.vars.trophyDirty.add(userId);
      c.vars.collections.delete(userId);
      await placeStarter(c.client<typeof registry>(), drops);
      const u = await userById(c.db, userId);
      await push(c.db, c.client<typeof registry>(), {
        users: [userId],
        companies: u.companyId === null ? [] : [u.companyId],
      });
    },

    leaderboard: (c, rawRange: unknown, rawSort: unknown): Promise<Leaderboard> =>
      leaderboard(
        c.db,
        requireUser(c.conn.state),
        isRangeKey(rawRange) ? rawRange : "today",
        isSortKey(rawSort) ? rawSort : "tokens",
        Date.now(),
      ),

    /** A company's card: its numbers, website, logo and people. */
    company: (c, companyId: unknown, rawRange: unknown): Promise<CompanyProfile> => {
      requireUser(c.conn.state);
      if (typeof companyId !== "number") throw new UserError("That company is gone.", { code: "not_found" });
      return companyProfile(c.db, companyId, isRangeKey(rawRange) ? rawRange : "30d", Date.now());
    },

    profile: async (c, targetId: unknown, rawRange: unknown): Promise<Profile> => {
      requireUser(c.conn.state);
      const range = isRangeKey(rawRange) ? rawRange : "30d";
      const id = playerId(targetId);
      const p = await profile(c.db, id, range, Date.now(), await kept(c, Date.now()));
      return { ...p, showcase: await shelfOf(c, id) };
    },

    /** My one line under my name; empty clears it. */
    setBio: async (c, raw: unknown): Promise<string | null> => {
      const userId = requireUser(c.conn.state);
      const bio = parseBio(raw);
      if (bio === null)
        throw new UserError(`One line, up to ${BIO_MAX_LENGTH} characters, and no links.`, {
          code: "invalid_bio",
        });
      if (!c.vars.bioEdits.take(String(userId), Date.now()))
        throw new UserError("That's a lot of edits. Try again in an hour.", { code: "rate_limited" });
      const text = bio === "clear" ? null : bio;
      await setBio(c.db, userId, text);
      return text;
    },

    /** Flags someone's bio for the admin page: once per reporter, a few an hour. */
    reportBio: async (c, targetId: unknown): Promise<void> => {
      const userId = requireUser(c.conn.state);
      const target = playerId(targetId);
      if (!c.vars.bioReports.take(String(userId), Date.now()))
        throw new UserError("That's a lot of reports. Try again in an hour.", { code: "rate_limited" });
      await reportBio(c.db, userId, target, Date.now());
    },

    /**
     * My shelf: up to `PIN_MAX` collection ids, in order, each one I own (`ownedPins`). Returns them as
     * the card shows them.
     */
    setShowcase: async (c, raw: unknown): Promise<PinView[]> => {
      const userId = requireUser(c.conn.state);
      const ids = Array.isArray(raw)
        ? raw.map((p) => (typeof p === "string" ? p : (p as { id?: unknown } | null)?.id))
        : null;
      if (
        !ids ||
        ids.length > PIN_MAX ||
        ids.some((id) => typeof id !== "string") ||
        new Set(ids).size < ids.length
      )
        throw new UserError(`Up to ${PIN_MAX} different things.`, { code: "invalid_pins" });
      const owned = ownedPins(await collectionFor(c, userId));
      const views = (ids as string[]).map((id) => owned.find((o) => o.id === id));
      if (views.some((v) => !v)) throw new UserError("You haven't earned that yet.", { code: "not_owned" });
      await c.vars.serial(() => c.db.transaction((tx) => setPins(tx, userId, ids as string[])));
      return views as PinView[];
    },

    /** This week's top five in the Tavern, and my own minutes. A minute at most for the board. */
    regulars: async (c): Promise<Regulars> => {
      const userId = requireUser(c.conn.state);
      const now = Date.now();
      const day = dayKey(now);
      let hit = c.vars.regulars;
      if (!hit || hit.day !== day || now - hit.at >= REGULARS_TTL) {
        const rows = Promise.all([weeklyRegulars(c.db, day), lastWeekWinner(c.db, day)]).then(
          ([top, last]) => ({ top, last }),
        );
        const entry = { at: now, day, rows };
        c.vars.regulars = hit = entry;
        // A failed one isn't kept.
        rows.catch(() => {
          if (c.vars.regulars === entry) c.vars.regulars = null;
        });
      }
      const minutes = await minutesThisWeek(c.db, userId, day);
      return { ...(await hit.rows), me: minutes === null ? null : { minutes } };
    },

    /**
     * From `world`, every few minutes: who spent how long in the Tavern since the last call (`[userId,
     * minutes, visits]`). Credit is capped per player per day; plaques give no coins.
     */
    /**
     * From `world` after each grid read: the hours (their starts) it found green. Each goes in once
     * (`recordGreen`), so the same hours sent again change nothing.
     */
    greenHours: async (c, hours: unknown): Promise<number> => {
      requireInternal(c.conn.state);
      if (!Array.isArray(hours)) return 0;
      const clean = hours.filter((h): h is number => typeof h === "number").slice(0, 48);
      return c.vars.serial(() => recordGreen(c.db, clean, Date.now()));
    },

    tavernMinutes: async (c, day: unknown, rows: unknown): Promise<void> => {
      requireInternal(c.conn.state);
      if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !Array.isArray(rows)) return;
      const clean = rows.filter(
        (r): r is TavernRow => Array.isArray(r) && r.length === 3 && r.every((n) => typeof n === "number"),
      );
      const credited = await c.vars.serial(() =>
        c.db.transaction((tx) => addTavernMinutes(tx, day, clean), { name: "tavern-minutes" }),
      );
      // Their Tavern badge is looked at in the next sweep.
      for (const id of credited) c.vars.dirty.add(id);
    },

    /**
     * Everything someone has earned, compact (`CollectionState`): the client has the words. Anyone may
     * look, like cards and shelves. A minute at most per player.
     */
    collection: (c, targetId: unknown): Promise<CollectionState> => {
      requireUser(c.conn.state);
      return collectionFor(c, playerId(targetId));
    },

    /** What I could pin to my card: everything I own that's pinnable, as the card shows it. */
    showcaseOptions: async (c): Promise<PinView[]> =>
      ownedPins(await collectionFor(c, requireUser(c.conn.state))),

    /** The Hall of Fame wall: the rarest honours, this week's firsts and winners. A minute at most. */
    hallOfFame: (c): Promise<HallOfFame> => {
      requireUser(c.conn.state);
      const now = Date.now();
      if (c.vars.hall && now - c.vars.hall.at < HALL_TTL) return c.vars.hall.hall;
      const hall = raidsOf(c, now).then((weeks) => hallOfFame(c.db, now, weeks));
      const entry = { at: now, hall };
      c.vars.hall = entry;
      // A failed one isn't kept.
      hall.catch(() => {
        if (c.vars.hall === entry) c.vars.hall = null;
      });
      return hall;
    },

    /** The trophies on someone's office shelf: anyone may look, like their badges. */
    trophies: async (c, targetId: unknown): Promise<Trophy[]> => {
      requireUser(c.conn.state);
      const u = await userOf(c.db, targetId);
      return c
        .client<typeof registry>()
        .player.get([String(u.id)], internal)
        .trophies();
    },

    /** Names starting with `prefix`, for @-mention suggestions. */
    searchNames: async (c, prefix: unknown): Promise<string[]> => {
      requireUser(c.conn.state);
      if (typeof prefix !== "string" || !/^[a-z0-9._-]{1,32}$/i.test(prefix)) return [];
      const from = prefix.toLowerCase();
      const rows = await all<{ name: string }>(
        c.db,
        "SELECT name FROM users WHERE name >= ? AND name < ? ORDER BY name LIMIT 8",
        from,
        `${from}\uffff`,
      );
      return rows.map((r) => r.name);
    },

    /** The HUD's corner: my numbers today and today's top 5. */
    today: (c): Promise<Today> => today(c.db, requireSyncer(c.conn.state), Date.now()),

    // MARK: Coins for games (from `arcade` only)

    /** Takes a stake or a side bet from each entry, or from nobody. */
    hold: async (c, ref: string, kind: HoldKind, entries: Entry[]): Promise<void> => {
      requireInternal(c.conn.state);
      const names = await namesOf(
        c.db,
        entries.map((e) => e.userId),
      );
      const k = await kept(c, Date.now());
      await c.vars.serial(() => hold(c.db, ref, kind, entries, names, Date.now(), k));
    },

    pay: async (c, ref: string, kind: PayKind, entries: Entry[]): Promise<void> => {
      requireInternal(c.conn.state);
      await c.vars.serial(() => pay(c.db, ref, kind, entries, Date.now()));
    },

    /** What a ref still holds, so settling a game can be retried without paying twice. */
    held: async (c, ref: string): Promise<number> => {
      requireInternal(c.conn.state);
      return [...(await heldIn(c.db, ref)).values()].reduce((a, b) => a + b, 0);
    },

    refund: async (c, ref: string, userIds?: number[]): Promise<void> => {
      requireInternal(c.conn.state);
      await c.vars.serial(() => refund(c.db, ref, Date.now(), userIds));
    },

    // MARK: The Tavern's poker table (from `world` only; `town/poker.ts`)

    /** Takes the buy-in from `userId`'s wallet for a seat: a `UserError` says why not (the day's limit, too poor). */
    pokerSit: async (c, userId: number): Promise<void> => {
      requireInternal(c.conn.state);
      const now = Date.now();
      const k = await kept(c, now);
      await c.vars.serial(() => pokerSit(c.db, userId, now, k));
    },

    /** The table's stacks after a hand, and the seats that stood up (their stacks go back to their wallets). */
    pokerSettle: async (c, s: PokerSettle): Promise<void> => {
      requireInternal(c.conn.state);
      await c.vars.serial(() => pokerSettle(c.db, s, Date.now()));
    },

    /** The world woke without its table: everyone still seated gets their stack back. */
    pokerRelease: async (c): Promise<number> => {
      requireInternal(c.conn.state);
      return c.vars.serial(() => pokerRelease(c.db, Date.now()));
    },

    /** A finished game, for stats. */
    recordMatch: async (
      c,
      matchId: number,
      game: string,
      stake: number,
      players: Placed[],
    ): Promise<void> => {
      requireInternal(c.conn.state);
      await recordMatch(c.db, matchId, game, stake, players, Date.now());
    },

    gameBoard: (c, rawRange: unknown): Promise<GamePlayer[]> => {
      requireUser(c.conn.state);
      return gameBoard(c.db, isRangeKey(rawRange) ? rawRange : "today", Date.now());
    },

    /** User ids for names (inviting people to a game by name). */
    ids: async (c, names: string[]): Promise<Record<string, number>> => {
      requireInternal(c.conn.state);
      const rows = await all<{ id: number; name: string }>(
        c.db,
        "SELECT id, name FROM users WHERE name IN (SELECT value FROM json_each(?))",
        JSON.stringify(names.map((n) => String(n).toLowerCase())),
      );
      return Object.fromEntries(rows.map((r) => [r.name, r.id]));
    },

    /** Names for user ids (tables and matches show who's playing). */
    names: async (c, userIds: number[]): Promise<Record<number, string>> => {
      requireInternal(c.conn.state);
      return namesOf(c.db, userIds);
    },

    // MARK: The admin page (`ADMIN_TOKEN`)

    adminOverview: (c): Promise<AdminOverview> => {
      requireAdmin(c.conn.state);
      return overview(c.db, Date.now());
    },

    adminUsers: (c): Promise<AdminUser[]> => {
      requireAdmin(c.conn.state);
      return adminUsers(c.db, Date.now());
    },

    adminCompanies: (c): Promise<AdminCompany[]> => {
      requireAdmin(c.conn.state);
      return adminCompanies(c.db);
    },

    adminLog: (c): Promise<AdminLogEntry[]> => {
      requireAdmin(c.conn.state);
      return adminLog(c.db);
    },

    adminRequests: (c): Promise<RequestEntry[]> => {
      requireAdmin(c.conn.state);
      return requests.everything(c.db);
    },

    /** Marks a request open, planned, done or not now. */
    adminSetRequest: async (c, id: unknown, status: unknown): Promise<void> => {
      requireAdmin(c.conn.state);
      const text = await requests.setStatus(c.db, id, status, Date.now());
      await logAdmin(c.db, "mark request", `#${String(id)}`, `${String(status)}: ${text}`, Date.now());
    },

    /** Takes a request off the pile. */
    adminRemoveRequest: async (c, id: unknown): Promise<void> => {
      requireAdmin(c.conn.state);
      const text = await requests.remove(c.db, id);
      await logAdmin(c.db, "remove request", `#${String(id)}`, text, Date.now());
    },

    /** Every keynote watch party scheduled, newest first. */
    adminKeynotes: (c): Promise<Keynote[]> => {
      requireAdmin(c.conn.state);
      return everyKeynote(c.db);
    },

    /** Schedules a keynote watch party, or changes the one `id` names (null: a new one). The world hears at once. */
    adminSaveKeynote: async (c, id: unknown, input: unknown): Promise<Keynote> => {
      requireAdmin(c.conn.state);
      const now = Date.now();
      const k = await saveKeynote(c.db, id, input, now);
      const action = id === null || id === undefined ? "schedule keynote" : "change keynote";
      await logAdmin(c.db, action, `${k.title} (#${k.id})`, keynoteDetail(k), now);
      await pushKeynotes(c.db, c.client<typeof registry>(), now);
      return k;
    },

    /** Takes a keynote off the schedule (and off the Tavern's screen, if it's on). */
    adminRemoveKeynote: async (c, id: unknown): Promise<void> => {
      requireAdmin(c.conn.state);
      const now = Date.now();
      const k = await removeKeynote(c.db, id);
      await logAdmin(c.db, "remove keynote", `${k.title} (#${k.id})`, keynoteDetail(k), now);
      await pushKeynotes(c.db, c.client<typeof registry>(), now);
    },

    /** Sets someone's balance; returns it. */
    adminSetCoins: async (c, userId: unknown, balance: unknown): Promise<number> => {
      requireAdmin(c.conn.state);
      const coins = coinAmount(balance);
      const user = await userOf(c.db, userId);
      const now = Date.now();
      const k = await kept(c, now);
      const set = await c.vars.serial(() => setBalance(c.db, user.id, coins, now, k));
      await logAdmin(c.db, "set coins", who(user), `${set.before} → ${set.balance}`, now);
      return set.balance;
    },

    /** A company wallet's coins, set; the ledger line is the owner's (`user_id`), kind `admin`. */
    adminSetCompanyCoins: async (c, companyId: unknown, rawCoins: unknown): Promise<number> => {
      requireAdmin(c.conn.state);
      const coins = coinAmount(rawCoins);
      const company = await companyOrGone(c.db, companyId);
      const now = Date.now();
      const set = await c.vars.serial(() => setCompanyWallet(c.db, company.id, coins, company.ownerId, now));
      await logAdmin(
        c.db,
        "set company coins",
        `${company.name} (#${company.id})`,
        `${set.before} → ${set.coins}`,
        now,
      );
      return set.coins;
    },

    /** The statue of the #1 model: what's on the plinth, the last leader read, the pin, and the next read. */
    adminStatue: (c): Promise<StatueAdmin> => {
      requireAdmin(c.conn.state);
      return main(c.client<typeof registry>()).world.statue();
    },

    /** Pins a model on the statue's plinth, over the ranking's, until it's unpinned. */
    adminPinStatue: async (c, model: unknown, org: unknown, ranking: unknown): Promise<void> => {
      requireAdmin(c.conn.state);
      const leader = statuePin(model, org, ranking);
      await main(c.client<typeof registry>()).world.pinStatue(leader);
      await logAdmin(c.db, "pin statue", leader.model, `${leader.org} · ${leader.ranking}`, Date.now());
    },

    /** Gives the plinth back to the ranking. */
    adminUnpinStatue: async (c): Promise<void> => {
      requireAdmin(c.conn.state);
      await main(c.client<typeof registry>()).world.pinStatue(null);
      await logAdmin(c.db, "unpin statue", "statue", null, Date.now());
    },

    /** Test servers only sell anywhere; this holds one player to the shop rule anyway. */
    adminStrictShops: (c, userId: unknown): void => {
      requireAdmin(c.conn.state);
      c.vars.strictShops.add(Number(userId));
    },

    /** Takes someone's bio down (and its reports with it). */
    adminClearBio: async (c, userId: unknown): Promise<void> => {
      requireAdmin(c.conn.state);
      const user = await userOf(c.db, userId);
      const was = await bioOf(c.db, user.id);
      await setBio(c.db, user.id, null);
      await logAdmin(c.db, "clear bio", who(user), was, Date.now());
    },

    adminRenameUser: async (c, userId: unknown, rawName: unknown): Promise<void> => {
      requireAdmin(c.conn.state);
      const user = await userOf(c.db, userId);
      await renameUser(c.db, c.vars.serial, c.client<typeof registry>(), user.id, rawName);
      await logAdmin(c.db, "rename user", who(user), `→ ${userName(rawName)}`, Date.now());
    },

    /** Takes someone out of their company (the owner hands over, the last one out closes it). */
    adminRemoveFromCompany: async (c, userId: unknown): Promise<void> => {
      requireAdmin(c.conn.state);
      const user = await userOf(c.db, userId);
      const changed = await c.vars.serial(() => leave(c.db, user.id));
      await push(c.db, c.client<typeof registry>(), changed);
      await logAdmin(c.db, "remove from company", who(user), `company #${user.companyId}`, Date.now());
    },

    /** Forgets someone's usage, raw events and all: for numbers that were made up. */
    adminWipeUsage: async (c, userId: unknown): Promise<void> => {
      requireAdmin(c.conn.state);
      const user = await userOf(c.db, userId);
      const client = c.client<typeof registry>();
      const days = await client.player.get([String(user.id)], internal).wipe();
      await c.vars.serial(() => wipeUsage(c.db, user.id));
      c.vars.podiums = null;
      await push(c.db, client, {
        users: [user.id],
        companies: user.companyId === null ? [] : [user.companyId],
      });
      await logAdmin(c.db, "wipe usage", who(user), `${days.length} days`, Date.now());
    },

    /** Deletes an account for good: their device token and sessions stop working, and they leave the world. */
    adminDeleteUser: async (c, userId: unknown): Promise<void> => {
      requireAdmin(c.conn.state);
      const user = await userOf(c.db, userId);
      const now = Date.now();
      const changed = await c.vars.serial(() => deleteUser(c.db, user.id, now));
      c.vars.podiums = null;
      c.vars.hall = null;
      c.vars.collections.delete(user.id);
      await logAdmin(c.db, "delete user", who(user), null, now);
      const client = c.client<typeof registry>();
      await push(c.db, client, changed);
      // Out of the world with their drops; what others dropped in their office goes back to them.
      await giveBack(c.db, await main(client).world.removePlayer(user.id));
      await client.player.get([String(user.id)], internal).close();
    },

    adminRenameCompany: async (c, companyId: unknown, rawName: unknown): Promise<void> => {
      requireAdmin(c.conn.state);
      const company = await companyOrGone(c.db, companyId);
      await renameCompany(c.db, c.client<typeof registry>(), company.id, rawName);
      await logAdmin(
        c.db,
        "rename company",
        `${company.name} (#${company.id})`,
        `→ ${companyName(rawName)}`,
        Date.now(),
      );
    },

    adminCloseCompany: async (c, companyId: unknown): Promise<void> => {
      requireAdmin(c.conn.state);
      const client = c.client<typeof registry>();
      const { company, changed } = await c.vars.serial(() => closeCompany(c.db, companyId));
      await logAdmin(
        c.db,
        "close company",
        `${company.name} (#${company.id})`,
        `${changed.users.length} members`,
        Date.now(),
      );
      await push(c.db, client, changed);
      for (const id of changed.users)
        await notify(client, id, { text: "Your company was closed by the town admin.", open: "company" });
    },

    /** From `world`: the 429 Cop wrote `userId` a ticket: how many they hold now, or null if they had one today already. */
    ticket: async (c, userId: number, t: Ticket): Promise<number | null> => {
      requireInternal(c.conn.state);
      return c.vars.serial(() => giveTicket(c.db, userId, t));
    },

    /** For `world` starting up: everyone, every company, every office and everything on a floor. */
    seed: async (
      c,
    ): Promise<{
      players: PlayerCore[];
      companies: CompanyInfo[];
      offices: Record<number, Office>;
      drops: Drop[];
    }> => {
      requireInternal(c.conn.state);
      return {
        players: await playerCores(c.db, "all"),
        companies: await companyInfos(c.db, "all"),
        offices: await offices(c.db),
        drops: await floors(c.db),
      };
    },
  },
});

type Client = Parameters<typeof push>[1];

/** How the admin log describes a keynote: its host and when it runs. */
const keynoteDetail = (k: Keynote) => `${k.host}, ${dateAt(k.startsAt)} to ${clockAt(k.endsAt)}`;

/**
 * Tells `world` the schedule now: the screen goes up or down at once. A failed call is only a delay,
 * since `world` asks for the list every few minutes anyway.
 */
async function pushKeynotes(sql: Sql, client: Client, now: number): Promise<void> {
  const list = await comingKeynotes(sql, now);
  await main(client)
    .world.setKeynotes(list)
    .catch((err: unknown) => console.warn(`[keynotes] push: ${String(err)}`));
}

/** How the admin log names someone. */
const who = (u: { id: number; name: string }) => `${u.name} (#${u.id})`;

/** A user id as a caller sent it: `not_found` unless it's a number. */
function playerId(raw: unknown): number {
  if (typeof raw !== "number") throw new UserError("Unknown player.", { code: "not_found" });
  return raw;
}

/** The user with id `raw`, as a caller sent it, or `not_found`. */
const userOf = (sql: Sql, raw: unknown) => userById(sql, playerId(raw));

/** Coins an admin sets: a whole number up to 10M. */
function coinAmount(raw: unknown): number {
  if (!Number.isSafeInteger(raw) || (raw as number) < 0 || (raw as number) > 10_000_000)
    throw new UserError("Use a whole number from 0 to 10,000,000.", { code: "invalid_amount" });
  return raw as number;
}

/** For the player themselves, and for the admin page. Run under `serial`, since names are unique. */
async function renameUser(
  sql: Sql,
  run: ReturnType<typeof serial>,
  client: Client,
  userId: number,
  rawName: unknown,
): Promise<void> {
  const name = userName(rawName);
  await run(async () => {
    const taken = await one<{ id: number }>(sql, "SELECT id FROM users WHERE name = ?", name);
    if (taken && taken.id !== userId) throw new UserError("That name is taken.", { code: "name_taken" });
    await sql.execute("UPDATE users SET name = ? WHERE id = ?", name, userId);
  });
  await pushPlayers(sql, client, [userId]);
}

async function renameCompany(sql: Sql, client: Client, companyId: number, rawName: unknown): Promise<void> {
  const name = companyName(rawName);
  await sql.execute("UPDATE companies SET name = ? WHERE id = ?", name, companyId);
  await push(sql, client, { companies: [companyId], users: [] });
}

/** Every finished day's top 3, worked out once a world day (or after something changed them). */
function podiumsOf(
  c: { db: Sql; vars: { podiums: { day: string; rows: Promise<Podium[]> } | null } },
  now: number,
): Promise<Podium[]> {
  const day = dayKey(now);
  if (c.vars.podiums?.day !== day) {
    const rows = podiums(c.db, now);
    c.vars.podiums = { day, rows };
    // A failed one isn't kept.
    rows.catch(() => {
      if (c.vars.podiums?.rows === rows) c.vars.podiums = null;
    });
  }
  return c.vars.podiums.rows;
}

/**
 * Podiums and raids for checking wallets, from what the town keeps. Before `serial`, never under it:
 * `raidsOf` hands out loot on that chain, and would wait for itself.
 */
async function kept(
  c: Parameters<typeof raidsOf>[0] & Parameters<typeof podiumsOf>[0],
  now: number,
): Promise<Kept> {
  const [top, raids] = await Promise.all([podiumsOf(c, now), raidsOf(c, now)]);
  return { top, raids };
}

const RAID_TTL = 15_000;
const HALL_TTL = 60_000;
const COLLECTION_TTL = 60_000;
const COLLECTION_MAX = 64;
/** Collections made while the player's trophies couldn't be read: shown, but not kept or pruned by. */
const withoutTrophies = new WeakSet<CollectionState>();

/** `collectionOf` for a player, kept a minute (and until they sync or earn something). */
function collectionFor(
  c: Parameters<typeof kept>[0] & {
    vars: { collections: Map<number, { at: number; state: Promise<CollectionState> }> };
  },
  userId: number,
): Promise<CollectionState> {
  const now = Date.now();
  const hit = c.vars.collections.get(userId);
  if (hit && now - hit.at < COLLECTION_TTL) return hit.state;
  if (c.vars.collections.size >= COLLECTION_MAX) c.vars.collections.clear();
  const state = (async () => {
    const u = await userById(c.db, userId);
    // Trophies are the player's own events, kept in their actor; a sleeping or busy one just shows
    // none yet.
    const trophies = await c
      .client()
      .player.get([String(u.id)], internal)
      .trophies()
      .catch(() => null);
    const state = await collectionOf(c.db, userId, now, await kept(c, now), trophies ?? []);
    if (!trophies) withoutTrophies.add(state);
    return state;
  })();
  const entry = { at: now, state };
  c.vars.collections.set(userId, entry);
  const forget = () => {
    if (c.vars.collections.get(userId) === entry) c.vars.collections.delete(userId);
  };
  // A failed one isn't kept, nor one without trophies: the next look asks again.
  state.then((s) => withoutTrophies.has(s) && forget(), forget);
  return state;
}

/**
 * Someone's shelf as the card shows it. A pin that isn't theirs any more is left out, and its row goes;
 * if their collection can't be read the shelf is left alone and shown empty this once. Without their
 * trophies, a pinned trophy is left out this once but its row stays.
 */
async function shelfOf(
  c: Parameters<typeof collectionFor>[0] & { vars: { serial: ReturnType<typeof serial> } },
  userId: number,
): Promise<PinView[]> {
  const pins = await pinsOf(c.db, userId);
  if (pins.length === 0) return [];
  const state = await collectionFor(c, userId).catch(() => null);
  if (!state) return [];
  const views = resolvePins(state, pins);
  if (views.length < pins.length && !withoutTrophies.has(state))
    await c.vars.serial(() =>
      c.db.transaction((tx) =>
        setPins(
          tx,
          userId,
          views.map((v) => v.id),
        ),
      ),
    );
  return views;
}

/** Tells the town of each award worth it (gold, diamond, level 30 and up), and drops what they changed. */
async function told(
  c: { vars: { collections: Map<number, unknown>; hall: unknown }; client(): Client },
  awards: Award[],
): Promise<void> {
  for (const a of awards) {
    c.vars.collections.delete(a.userId);
    if (a.announce) await announceTown(c.client(), a.announce, "collection", a.remark);
  }
  if (awards.length > 0) c.vars.hall = null;
}

/**
 * Every raid so far, worked out at most every few seconds however many people are watching. A new
 * week's gate opening (the launch too) throws the old one away, so 08:00 never shows a ladder without it.
 * Each time, the loot its kills dropped is handed out (`grantLoot`, once per drop), before anyone sees the kill.
 */
function raidsOf(
  c: {
    db: TxSql;
    vars: { raids: { at: number; rows: Promise<RaidWeek[]> } | null; serial: ReturnType<typeof serial> };
    client(): Client;
  },
  now: number,
): Promise<RaidWeek[]> {
  const kept = c.vars.raids;
  if (kept && now - kept.at < RAID_TTL && raidWeekAt(kept.at) === raidWeekAt(now)) return kept.rows;
  const rows = raidHistory(c.db, now).then(async (weeks) => {
    const fresh = await c.vars
      .serial(() => grantLoot(c.db, weeks, now))
      .catch((err) => {
        // The raid still shows; the next one tries again.
        console.warn(`[loot] ${String(err)}`);
        return [];
      });
    if (fresh.length > 0) void announceLoot(c.db, c.client(), fresh, now);
    return weeks;
  });
  c.vars.raids = { at: now, rows };
  rows.catch(() => {
    if (c.vars.raids?.rows === rows) c.vars.raids = null;
  });
  return rows;
}

/** A new office's desk and chair onto its floor. If `world` misses them, its next start lays them (`seed`). */
async function placeStarter(client: Client, drops: Drop[]): Promise<void> {
  if (drops.length === 0) return;
  await main(client)
    .world.placeDrops(drops)
    .catch((err) => console.warn(`[office] ${String(err)}`));
}

/**
 * Buying happens in the shop that sells it: `shop` is where the player must stand (null: sold nowhere, so
 * refused by the caller's own rules). The world knows the room; a player who isn't in it can't buy at all.
 */
async function inShop(
  c: { client: () => Client; vars: { strictShops: Set<number> } },
  userId: number,
  shop: ShopId | null,
): Promise<void> {
  if (process.env.SHOPS_ANYWHERE === "1" && !c.vars.strictShops.has(userId)) return;
  if (shop === null) throw new UserError("That isn't sold in any shop.", { code: "not_for_sale" });
  const room = await main(c.client()).world.roomOfPlayer(userId);
  if (room !== SHOP_ROOM[shop]) throw new UserError(goToShop(shop), { code: "not_in_shop" });
}

/** Torvehallen's door rule, like `inShop`: putting something on display and buying it happen in the hall. */
async function inMarket(
  c: { client: () => Client; vars: { strictShops: Set<number> } },
  userId: number,
): Promise<void> {
  if (process.env.SHOPS_ANYWHERE === "1" && !c.vars.strictShops.has(userId)) return;
  if ((await main(c.client()).world.roomOfPlayer(userId)) !== SHOP_ROOM.market)
    throw new UserError("Go to Torvehallen to do that.", { code: "not_in_shop" });
}

/**
 * The case shop's door rule, like `inShop`. `CASE_SHOP_ID` has to be a `ShopId` with a `SHOP_ROOM` entry
 * (`shoprooms.ts`); until it is, only `SHOPS_ANYWHERE` lets anyone open a case.
 */
async function inCaseShop(
  c: { client: () => Client; vars: { strictShops: Set<number> } },
  userId: number,
): Promise<void> {
  if (process.env.SHOPS_ANYWHERE === "1" && !c.vars.strictShops.has(userId)) return;
  const room = (SHOP_ROOM as Record<string, string | undefined>)[CASE_SHOP_ID];
  if (!room) throw new UserError("The Night Market isn't open yet.", { code: "not_in_shop" });
  if ((await main(c.client()).world.roomOfPlayer(userId)) !== room)
    throw new UserError("Go to the Night Market to open a case.", { code: "not_in_shop" });
}

/**
 * A piece of company furniture onto the building's floor, from the storeroom (`take` is how the row was
 * picked: bought or unstored). Under `serial` the whole way, `world` included, so two members can't put
 * out the same stored row. Without room (or out of the building) it stays in the storeroom.
 * ponytail: holds the town while `world` places it; it's in process and quick, and furnishing is rare.
 */
async function furnish(
  c: { db: Sql; vars: { serial: ReturnType<typeof serial> }; client: () => Client },
  userId: number,
  action: "buy" | "place",
  take: (company: NonNullable<Awaited<ReturnType<typeof companyById>>>, now: number) => Promise<number>,
  onto?: { x: number; y: number },
): Promise<{ notice: string; company: MyCompany; drop?: Drop }> {
  const u = await userById(c.db, userId);
  const company = u.companyId === null ? undefined : await companyById(c.db, u.companyId);
  if (!company) throw new UserError("Join a company first.", { code: "not_member" });
  let drop: Drop | undefined;
  const notice = await c.vars.serial(async () => {
    const now = Date.now();
    const id = await take(company, now);
    const item = (await one<{ item: string }>(c.db, "SELECT item FROM items WHERE id = ?", id))!.item;
    const put = await main(c.client())
      .world.placeDrop({ id, item, by: userId, co: company.id, ...(onto && { onto }) })
      .catch((err) => {
        console.warn(`[furnish] ${id}: ${String(err)}`);
        return { notice: "That didn't work. Try again." };
      });
    const name = itemById(item)?.name ?? "piece";
    if ("notice" in put)
      return action === "buy" ? `${put.notice} The ${name} is in the storeroom.` : put.notice;
    await placed(c.db, put);
    drop = put;
    return `${action === "buy" ? "Bought" : "Put out"} the ${name}.`;
  });
  return { notice, company: await myCompany(c.db, company.id, userId), ...(drop && { drop }) };
}

/** A tile the client picked, or none; anything else is a bad request. */
function tileArg(raw: unknown): { x: number; y: number } | undefined {
  if (raw === undefined || raw === null) return undefined;
  const t = raw as { x?: unknown; y?: unknown };
  if (!Number.isInteger(t.x) || !Number.isInteger(t.y))
    throw new UserError("Pick a tile.", { code: "bad_request" });
  return { x: t.x as number, y: t.y as number };
}

const OPEN_OFFICES_TTL = 5_000;
const OPEN_OFFICES_LIMIT = 30;

/** An open office in the list, with how many different people came this week. */
export type OpenOfficeRow = OpenOffice & { visitors: number };

/** The open offer `fromId` made me, or `not_found`. */
async function offerTo(sql: Sql, userId: number, fromId: unknown, now: number): Promise<Trade> {
  const [trade] =
    typeof fromId === "number"
      ? await tradesWhere(sql, "from_id = ? AND to_id = ? AND at >= ?", fromId, userId, now - TRADE_TTL)
      : [];
  if (!trade) throw new UserError("That offer is gone.", { code: "not_found" });
  return trade;
}

/** Town-wide lines from the tournament board (a toast that opens it, and the chat). */
async function tellTown(c: { client(): Client }, lines: string[]): Promise<void> {
  for (const line of lines) await announceTown(c.client(), line, "tournament");
}

async function namesOf(sql: Sql, userIds: number[]): Promise<Record<number, string>> {
  const rows = await all<{ id: number; name: string }>(
    sql,
    "SELECT id, name FROM users WHERE id IN (SELECT value FROM json_each(?))",
    JSON.stringify(userIds),
  );
  return Object.fromEntries(rows.map((r) => [r.id, r.name]));
}
