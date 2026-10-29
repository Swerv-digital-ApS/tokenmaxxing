import {
  bossAt,
  firstHp,
  HP_GROWTH,
  HP_SHARE,
  launchWeek,
  MIN_HP,
  OPENS_AT_HOUR,
  opensAt,
  PR_HIT,
  RAID_COINS,
  RAID_REWARDS,
  RAIDER_AT,
  type RaidDay,
  type RaidWeek,
  REWARD_GROWTH,
  type RungBoss,
  raidCoins,
  raidWeekAt,
  raidWeeks,
  WEEKLY_GROWTH,
} from "@tokenmaxxing/core/raid.ts";
import { addDays, dayKey } from "@tokenmaxxing/core/range.ts";
import { sortBy } from "hanzio";
import { all, one, type Sql } from "../actors/shared.ts";
import type { RaidLoot } from "./loot.ts";
import { signupDays, TOKENS } from "./users.ts";

/** One raider on the board. */
interface RaidRow {
  userId: number;
  name: string;
  damage: number;
}

/** A boss that fell this week. */
interface RaidKill {
  rung: number;
  boss: RungBoss;
  /** The world day it fell. */
  day: string;
  /** What each of its raiders got. */
  coins: number;
  /** How many were paid for it. */
  raiders: number;
  /** Whether I was one of them. */
  paid: boolean;
}

/** The raid panel, and the boss in the square. */
export interface Raid {
  /**
   * The raid hasn't launched yet: the first ladder opens at `launchAt`. Until then `week` is the
   * first raid's, `closed` is true, `boss` is rung 1 and `hp` its HP so far (it grows with this
   * week's damage until the launch); there are no kills, raiders, top or companies, and `last` is null.
   */
  prelaunch: boolean;
  /** When the first ladder opens (or opened): the first raid's Monday, 08:00 world time. */
  launchAt: number;
  /** The Monday of the week shown. */
  week: string;
  /** When this week's ladder opened: its Monday, 08:00 world time. */
  opensAt: number;
  /** When it ends: the next Monday, 08:00, when the next ladder opens. */
  endsAt: number;
  /** The week is over (Monday before 08:00): this is how it ended, and the gate opens at `endsAt`. */
  closed: boolean;
  /** The ladder's level: 1, then one more after each week the town cleared it ("II", "III"…). */
  level: number;
  /** All five bosses fell: nothing more to hit until the next ladder opens on `endsAt`. */
  cleared: boolean;
  /** The boss on the current rung, still standing (once `cleared`, the last one, fallen). */
  boss: RungBoss;
  /** The current rung's HP, and how much of it the town has hit (overflow from the last kill included). */
  hp: number;
  damage: number;
  /** The bosses that fell this week, in order. */
  kills: RaidKill[];
  /** Everything the town hit this week, across every rung. */
  totalDamage: number;
  /** Players with `raiderAt` damage this week. */
  raiders: number;
  top: RaidRow[];
  companies: { companyId: number; name: string; damage: number }[];
  /** `weekCoins`: from this week's kills; `coins`: from every raid. */
  me: { damage: number; rank: number | null; weekCoins: number; coins: number } | null;
  /** Last week: how many rungs fell, and the furthest boss that did (rung 1's if none, `defeated` false). */
  last: { boss: RungBoss; cleared: number; defeated: boolean; raiders: number } | null;
  rules: {
    prHit: number;
    raiderAt: number;
    /** What rung 1 pays each raider. */
    coins: number;
    /** What rungs 1 to 5 pay each raider on a level 1 ladder; each level after pays ×`rewardGrowth`. */
    rewards: number[];
    rewardGrowth: number;
    /**
     * Rung 1's HP: the first raid's was `hpShare` of the week before's damage, at least `minHp`; every
     * week after is the same unless the town cleared every boss that week, when it's ×`weeklyGrowth`
     * and a level up. Each rung ×`hpGrowth`.
     */
    hpShare: number;
    minHp: number;
    weeklyGrowth: number;
    hpGrowth: number;
    /** The hour on Monday, world time, a new ladder opens. */
    opensHour: number;
  };
  /** The boss's loot table and this week's drops: added by `town.raid` (`raidLoot`). */
  loot?: RaidLoot;
}

const TOP = 5;

const RULES: Raid["rules"] = {
  prHit: PR_HIT,
  raiderAt: RAIDER_AT,
  coins: RAID_COINS,
  rewards: [...RAID_REWARDS],
  rewardGrowth: REWARD_GROWTH,
  hpShare: HP_SHARE,
  minHp: MIN_HP,
  weeklyGrowth: WEEKLY_GROWTH,
  hpGrowth: HP_GROWTH,
  opensHour: OPENS_AT_HOUR,
};

/**
 * The first raid's Monday. Stored the first time the town asks (on wake, or the first raid query):
 * the Monday after `now` (`launchWeek`), so it launches at that 08:00 and stays put across restarts.
 * `RAID_START_WEEK` (a Monday, checked at boot by `loadConfig`) overrides it, for dev and testing.
 */
export async function raidStart(sql: Sql, now: number, env = process.env.RAID_START_WEEK): Promise<string> {
  if (env) return env;
  const stored = () => one<{ value: string }>(sql, "SELECT value FROM raid_meta WHERE key = 'start'");
  // Every raid poll asks, and it's written once: read first.
  const kept = await stored();
  if (kept) return kept.value;
  await sql.execute(
    "INSERT INTO raid_meta (key, value) VALUES ('start', ?) ON CONFLICT DO NOTHING",
    launchWeek(now),
  );
  return (await stored())!.value;
}

/**
 * Every player's world days that hit a boss: from the week before the first raid (its HP), and
 * only days from each player's sign-up day, like coins, so a first sync's backfill doesn't.
 */
async function raidDays(sql: Sql, start: string): Promise<RaidDay[]> {
  const firstDay = JSON.stringify(await signupDays(sql));
  const from = addDays(start, -7);
  const tokens = await all<{ userId: number; day: string; tokens: number }>(
    sql,
    `SELECT user_id AS userId, day, SUM(${TOKENS}) AS tokens
     FROM usage_daily JOIN json_each(?) s ON user_id = CAST(s.key AS INTEGER) AND day >= s.value
     WHERE day >= ? GROUP BY user_id, day`,
    firstDay,
    from,
  );
  const prs = await all<{ userId: number; day: string; prs: number }>(
    sql,
    `SELECT user_id AS userId, day, prs
     FROM activity_daily JOIN json_each(?) s ON user_id = CAST(s.key AS INTEGER) AND day >= s.value
     WHERE day >= ? AND prs > 0`,
    firstDay,
    from,
  );
  const days = new Map<string, RaidDay>(tokens.map((t) => [`${t.userId} ${t.day}`, { ...t, prs: 0 }]));
  for (const p of prs) {
    const key = `${p.userId} ${p.day}`;
    days.set(key, { userId: p.userId, day: p.day, tokens: days.get(key)?.tokens ?? 0, prs: p.prs });
  }
  return [...days.values()];
}

/** Every raid so far: none before the launch, so nothing pays before it. */
export async function raidHistory(sql: Sql, now: number): Promise<RaidWeek[]> {
  const start = await raidStart(sql, now);
  return raidWeeks(await raidDays(sql, start), now, start);
}

/** The raid shown at `now` (`raidWeekAt`: last week until Monday 08:00) as `userId` sees it. */
export async function raid(sql: Sql, userId: number | null, weeks: RaidWeek[], now: number): Promise<Raid> {
  const start = await raidStart(sql, now);
  if (now < opensAt(start)) return prelaunch(sql, userId, start);
  const week = raidWeekAt(now);
  const at = weeks.findIndex((w) => w.week === week);
  const w = at >= 0 ? weeks[at]! : null;
  const raiders = w?.raiders ?? [];
  const ids = raiders.map((r) => r.userId);
  const users = await all<{ id: number; name: string; companyId: number | null; company: string | null }>(
    sql,
    `SELECT u.id, u.name, u.company_id AS companyId, c.name AS company
     FROM users u LEFT JOIN companies c ON c.id = u.company_id
     WHERE u.id IN (SELECT value FROM json_each(?))`,
    JSON.stringify(ids),
  );
  const byId = new Map(users.map((u) => [u.id, u]));
  const companies = new Map<number, { companyId: number; name: string; damage: number }>();
  for (const r of raiders) {
    const u = byId.get(r.userId);
    if (u?.companyId == null || !u.company) continue;
    const c = companies.get(u.companyId) ?? { companyId: u.companyId, name: u.company, damage: 0 };
    c.damage += r.damage;
    companies.set(u.companyId, c);
  }
  const mine = userId === null ? -1 : raiders.findIndex((r) => r.userId === userId);
  const last = at > 0 ? weeks[at - 1]! : null;
  const count = (rs: RaidWeek["raiders"]) => rs.filter((r) => r.damage >= RAIDER_AT).length;
  return {
    prelaunch: false,
    launchAt: opensAt(start),
    week,
    opensAt: opensAt(week),
    endsAt: opensAt(addDays(week, 7)),
    // Showing last week while the world is already in the next one: Monday before 08:00.
    closed: dayKey(now) >= addDays(week, 7),
    level: w?.level ?? 1,
    cleared: w?.cleared ?? false,
    boss: w?.current.boss ?? bossAt(1),
    hp: w?.current.hp ?? 0,
    damage: w?.current.damage ?? 0,
    kills: (w?.kills ?? []).map((k) => ({
      rung: k.rung,
      boss: k.boss,
      day: k.day,
      coins: k.coins,
      raiders: k.raiders.length,
      paid: userId !== null && k.raiders.includes(userId),
    })),
    totalDamage: w?.damage ?? 0,
    raiders: count(raiders),
    top: raiders
      .slice(0, TOP)
      .map((r) => ({ userId: r.userId, name: byId.get(r.userId)?.name ?? "?", damage: r.damage })),
    companies: sortBy([...companies.values()], { by: "damage", order: "desc" }).slice(0, 3),
    me:
      userId === null
        ? null
        : {
            damage: mine >= 0 ? raiders[mine]!.damage : 0,
            rank: mine >= 0 ? mine + 1 : null,
            weekCoins: w ? raidCoins([w], userId) : 0,
            coins: raidCoins(weeks, userId),
          },
    last: last && {
      boss: last.kills.at(-1)?.boss ?? bossAt(1),
      cleared: last.kills.length,
      defeated: last.kills.length > 0,
      raiders: count(last.raiders),
    },
    rules: RULES,
  };
}

/** The raid before it launches: rung 1 waiting behind the gate, with its HP so far. */
async function prelaunch(sql: Sql, userId: number | null, start: string): Promise<Raid> {
  const launchAt = opensAt(start);
  const hp = firstHp(await raidDays(sql, start), start);
  return {
    prelaunch: true,
    launchAt,
    week: start,
    opensAt: launchAt,
    endsAt: opensAt(addDays(start, 7)),
    closed: true,
    level: 1,
    cleared: false,
    boss: bossAt(1),
    hp,
    damage: 0,
    kills: [],
    totalDamage: 0,
    raiders: 0,
    top: [],
    companies: [],
    me: userId === null ? null : { damage: 0, rank: null, weekCoins: 0, coins: 0 },
    last: null,
    rules: RULES,
  };
}
