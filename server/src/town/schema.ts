import type { Sql } from "../actors/shared.ts";
import { migrateAwards } from "./awards.ts";
import { migrateCard } from "./card.ts";
import { migrateCases } from "./cases.ts";
import { migrateMerch } from "./companies.ts";
import { migrateDesks } from "./desks.ts";
import { migrateFastelavn } from "./fastelavn.ts";
import { migrateFishing } from "./fishing.ts";
import { migrateGrid } from "./grid.ts";
import { migrateJulekalender } from "./julekalender.ts";
import { migrateKeynotes } from "./keynotes.ts";
import { migrateLaunchBonus } from "./launch-bonus.ts";
import { migrateMarket } from "./market.ts";
import { migrateMerchant } from "./merchant.ts";
import { migrateOffices } from "./offices.ts";
import { migratePoker } from "./poker.ts";
import { migrateQuests } from "./quests.ts";
import { migrateRequests } from "./requests.ts";
import { migrateRoulette } from "./roulette.ts";
import { migrateTournament } from "./tournament.ts";
import { migrateTrophyAwards } from "./trophy-awards.ts";

/** Every table `town` keeps. Also run by tests against an in-memory database. */
export async function migrate(sql: Sql): Promise<void> {
  await sql.execute(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    company_id INTEGER,
    joined_at INTEGER,
    look TEXT NOT NULL,
    created_at INTEGER NOT NULL)`);
  await sql.execute("CREATE INDEX IF NOT EXISTS users_company ON users (company_id, joined_at)");
  // AUTOINCREMENT: a closed company's id is never handed out again, so a new company
  // can't inherit its house chat (`hq:<id>`) or its logo.
  await sql.execute(`CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    owner_id INTEGER NOT NULL,
    plot INTEGER NOT NULL UNIQUE,
    website TEXT,
    branding TEXT,
    brand TEXT,
    created_at INTEGER NOT NULL)`);
  await sql.execute(`CREATE TABLE IF NOT EXISTS usage_daily (
    user_id INTEGER NOT NULL, day TEXT NOT NULL, model TEXT NOT NULL,
    input INTEGER NOT NULL, output INTEGER NOT NULL,
    cache_creation INTEGER NOT NULL, cache_read INTEGER NOT NULL, turns INTEGER NOT NULL,
    PRIMARY KEY (user_id, day, model)) WITHOUT ROWID`);
  const usageColumns = (await sql.execute("PRAGMA table_info(usage_daily)")) as { name: string }[];
  if (!usageColumns.some((c) => c.name === "reported_cost_cents")) {
    await sql.execute("ALTER TABLE usage_daily ADD COLUMN reported_cost_cents REAL NOT NULL DEFAULT 0");
  }
  await sql.execute("CREATE INDEX IF NOT EXISTS usage_day ON usage_daily (day)");
  await sql.execute(`CREATE TABLE IF NOT EXISTS activity_daily (
    user_id INTEGER NOT NULL, day TEXT NOT NULL,
    prompts INTEGER NOT NULL, prs INTEGER NOT NULL,
    agent_buckets INTEGER NOT NULL, active_buckets INTEGER NOT NULL, peak_agents INTEGER NOT NULL,
    PRIMARY KEY (user_id, day)) WITHOUT ROWID`);
  await sql.execute("CREATE INDEX IF NOT EXISTS activity_day ON activity_daily (day)");
  // One pending application per person: applying elsewhere replaces it.
  await sql.execute(`CREATE TABLE IF NOT EXISTS applications (
    user_id INTEGER PRIMARY KEY, company_id INTEGER NOT NULL, at INTEGER NOT NULL)`);
  await sql.execute("CREATE INDEX IF NOT EXISTS applications_company ON applications (company_id, at)");
  // Coins spent in the shop, per kind: a rebuy adds its price. What you hold is in `items`.
  await sql.execute(`CREATE TABLE IF NOT EXISTS purchases (
    user_id INTEGER NOT NULL, item TEXT NOT NULL, price INTEGER NOT NULL, at INTEGER NOT NULL,
    PRIMARY KEY (user_id, item)) WITHOUT ROWID`);
  // Decided before it's made: `items` can empty out again later, and the backfill mustn't run twice.
  const fresh =
    (await sql.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'items'")).length === 0;
  // One row per copy anyone holds. `owner_id` is NULL while it's on the floor: `dropped_by` and
  // `dropped_at` say whose and since when, `room`, `x` and `y` where (once `world` has put it down).
  await sql.execute(`CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id INTEGER, item TEXT NOT NULL, at INTEGER NOT NULL,
    dropped_by INTEGER, dropped_at INTEGER, room TEXT, x INTEGER, y INTEGER)`);
  await sql.execute("CREATE INDEX IF NOT EXISTS items_owner ON items (owner_id, item)");
  // A company's own furniture (`COMPANY_FURNITURE`): `owner_id` stays NULL, so it's never in a bag. On its
  // building's floor it has `room`, `x` and `y`; without, it's in the company's storeroom.
  const itemColumns = (await sql.execute("PRAGMA table_info(items)")) as { name: string }[];
  if (!itemColumns.some((c) => c.name === "company_id"))
    await sql.execute("ALTER TABLE items ADD COLUMN company_id INTEGER");
  // A piece on a floor turned (`Drop.rot`): 1 to 3 quarter turns, else NULL. Off the floor it's NULL again.
  // `flip` was the first take on it (mirrored left to right): a flipped piece is now one turned half way round.
  if (!itemColumns.some((c) => c.name === "flip"))
    await sql.execute("ALTER TABLE items ADD COLUMN flip INTEGER");
  if (!itemColumns.some((c) => c.name === "rot")) {
    await sql.execute("ALTER TABLE items ADD COLUMN rot INTEGER");
    await sql.execute("UPDATE items SET rot = 2, flip = NULL WHERE flip = 1");
  }
  await sql.execute(
    "CREATE INDEX IF NOT EXISTS items_company ON items (company_id) WHERE company_id IS NOT NULL",
  );
  // Into the bag, once, when `items` is new: a purchase row was the item.
  if (fresh) {
    await sql.execute("INSERT INTO items (owner_id, item, at) SELECT user_id, item, at FROM purchases");
    const [{ n }] = (await sql.execute("SELECT COUNT(*) AS n FROM items")) as [{ n: number }];
    if (n > 0) console.log(`[town] ${n} items into the bag`);
  }
  // Level rewards handed out, so each comes once.
  await sql.execute(`CREATE TABLE IF NOT EXISTS rewards (
    user_id INTEGER NOT NULL, item TEXT NOT NULL, PRIMARY KEY (user_id, item))`);
  // Coins that move between players: stakes and side bets held, then paid out or refunded, and
  // trades (kind `trade`). Negative amounts leave a wallet. Every `ref` sums to 0 or less, never
  // more, except `admin`: coins an admin gave or took (kind `admin`).
  await sql.execute(`CREATE TABLE IF NOT EXISTS ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL, amount INTEGER NOT NULL, kind TEXT NOT NULL, ref TEXT NOT NULL,
    at INTEGER NOT NULL)`);
  await sql.execute("CREATE INDEX IF NOT EXISTS ledger_user ON ledger (user_id)");
  await sql.execute("CREATE INDEX IF NOT EXISTS ledger_ref ON ledger (ref)");
  // One open offer per sender: a new one replaces it. `give` and `want` are `Side` JSON.
  await sql.execute(`CREATE TABLE IF NOT EXISTS trades (
    from_id INTEGER PRIMARY KEY, to_id INTEGER NOT NULL,
    give TEXT NOT NULL, want TEXT NOT NULL, at INTEGER NOT NULL)`);
  await sql.execute("CREATE INDEX IF NOT EXISTS trades_to ON trades (to_id, at)");
  await companyLedger(sql);
  // Whether each office is open. A row is also "the desk and chair are given" (`starterDrops`).
  await sql.execute(`CREATE TABLE IF NOT EXISTS offices (
    user_id INTEGER PRIMARY KEY, open INTEGER NOT NULL DEFAULT 1)`);
  await migrateOffices(sql);
  await migrateDesks(sql);
  await migrateMerch(sql);
  // One row per player per finished game (void games aren't recorded), for stats and the Games board.
  await sql.execute(`CREATE TABLE IF NOT EXISTS match_players (
    match_id INTEGER NOT NULL, user_id INTEGER NOT NULL, game TEXT NOT NULL, place INTEGER NOT NULL,
    stake INTEGER NOT NULL, won INTEGER NOT NULL, pot INTEGER NOT NULL, day TEXT NOT NULL, at INTEGER NOT NULL,
    PRIMARY KEY (match_id, user_id))`);
  await sql.execute("CREATE INDEX IF NOT EXISTS match_players_day ON match_players (day)");
  await sql.execute("CREATE INDEX IF NOT EXISTS match_players_user ON match_players (user_id)");
  // Tokens past the per-minute cap (`player.ts`), per day: they count for nothing, and the admin
  // page flags who sends them.
  await sql.execute(`CREATE TABLE IF NOT EXISTS capped_daily (
    user_id INTEGER NOT NULL, day TEXT NOT NULL, tokens INTEGER NOT NULL,
    PRIMARY KEY (user_id, day)) WITHOUT ROWID`);
  // What was done from the admin page, and when.
  await sql.execute(`CREATE TABLE IF NOT EXISTS admin_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL,
    action TEXT NOT NULL, target TEXT NOT NULL, detail TEXT)`);
  // Accounts an admin deleted. `users` ids come after these, so a new account never takes over a
  // deleted one's `player` actor, or its rows in `ledger` and `match_players` (which stay, since
  // other players' games add up with them).
  await sql.execute(`CREATE TABLE IF NOT EXISTS deleted_users (
    id INTEGER PRIMARY KEY, name TEXT NOT NULL, at INTEGER NOT NULL)`);
  // Sign-ups whose `player` didn't come up in time: the account went, but its actor may have been made
  // anyway, so the next sign-up taking its id would fail on it. Ids come after these too.
  await sql.execute("CREATE TABLE IF NOT EXISTS lost_signups (id INTEGER PRIMARY KEY, at INTEGER NOT NULL)");
  await migrateMerchant(sql);
  await migrateMarket(sql);
  await migrateAwards(sql);
  await migrateTrophyAwards(sql);
  await migrateLaunchBonus(sql);
  await migrateQuests(sql);
  await migrateCard(sql);
  await migrateGrid(sql);
  await migrateCases(sql);
  await migrateRoulette(sql);
  await migrateTournament(sql);
  await migratePoker(sql);
  await migrateRequests(sql);
  await migrateKeynotes(sql);
  await migrateJulekalender(sql);
  await migrateFastelavn(sql);
  await migrateFishing(sql);
  // The raid's settings, once. `start`: the first raid's Monday, the one after the town first had the
  // raid (`raidStart`). Kept rather than worked out, so a restart or deploy doesn't move the launch.
  await sql.execute("CREATE TABLE IF NOT EXISTS raid_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  // Raid loot handed out (`grantLoot`): one row per item per raider per kill, so each drop comes once,
  // with its odds when it dropped. Kept when an account goes, like the ledger: ids are never reused.
  await sql.execute(`CREATE TABLE IF NOT EXISTS loot (
    week TEXT NOT NULL, rung INTEGER NOT NULL, user_id INTEGER NOT NULL, item TEXT NOT NULL,
    odds REAL NOT NULL, at INTEGER NOT NULL,
    PRIMARY KEY (week, rung, user_id, item)) WITHOUT ROWID`);
}

/**
 * Coins in and out of each company's wallet: `match` (ref: the world day) is a member's token coins
 * matched 1:1, on top of their own; `merch` is what an outsider paid for its merch, `furniture` what it
 * spent (ref: the item), `admin` an admin's change. `user_id` is who earned, bought or paid.
 * Wallets start at 0: nothing from before the table existed is matched.
 */
async function companyLedger(sql: Sql): Promise<void> {
  await sql.execute(`CREATE TABLE IF NOT EXISTS company_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL, user_id INTEGER NOT NULL, amount INTEGER NOT NULL,
    kind TEXT NOT NULL, ref TEXT NOT NULL, at INTEGER NOT NULL)`);
  await sql.execute("CREATE INDEX IF NOT EXISTS company_ledger_company ON company_ledger (company_id, at)");
  await sql.execute("CREATE INDEX IF NOT EXISTS company_ledger_user ON company_ledger (user_id, kind, ref)");
}
