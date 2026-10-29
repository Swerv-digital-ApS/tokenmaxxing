/**
 * The weekly raid: a ladder of bosses in the town square that the whole town fights together. Every
 * token anyone syncs that week hits the boss on the current rung, and every PR they open is a special
 * attack. When a boss falls the next, harder one appears at once and the overflow carries over; when the
 * fifth falls the ladder is cleared and the town waits for next Monday. Like
 * coins, nothing is stored: a week's damage, the ladder, its kills and who gets paid are worked out
 * from the daily rollups, so a late sync still lands its hits. Pure functions, shared by server and client.
 */
import { groupBy, sumBy } from "hanzio";
import { addDays, dayKey } from "./range.ts";

interface Boss {
  id: string;
  name: string;
  emoji: string;
  /** What it says over the square, one picked per poll. */
  taunts: readonly string[];
}

/** The ladder's order, easiest first. A week has just these, once each; clearing them all earns a harder ladder, "II", "III"… */
export const BOSSES: readonly Boss[] = [
  {
    id: "rate-limit",
    name: "The Rate Limit",
    emoji: "⏳",
    taunts: ["You've hit your limit.", "Try again in 4h 59m.", "429. 429. 429.", "Upgrade to continue."],
  },
  {
    id: "context-window",
    name: "The Context Window",
    emoji: "🪟",
    taunts: [
      "I forgot what you said.",
      "Compacting conversation…",
      "Too long; didn't read.",
      "Start a new chat?",
    ],
  },
  {
    id: "merge-conflict",
    name: "Merge Conflict",
    emoji: "🔀",
    taunts: ["<<<<<<< HEAD", "Both modified.", "Rebase me. I dare you.", "=======  >>>>>>>"],
  },
  {
    id: "hallucination",
    name: "The Hallucination",
    emoji: "🌀",
    taunts: [
      "That function exists. Trust me.",
      "Tests pass. Probably.",
      "I made up that API.",
      "Citation needed.",
    ],
  },
  {
    id: "invoice",
    name: "The Invoice",
    emoji: "🧾",
    taunts: ["Net 30.", "Usage this month: ∞.", "Please remit payment.", "Overage charges apply."],
  },
];

/**
 * The first raid's rung 1 HP: this share of the week before's total damage. Clearing n rungs takes
 * `rung1 × 2 × (1.5ⁿ − 1)`, so 4 rungs cost 8.125 × rung 1 = 81% of that week: a week like it clears
 * four bosses and stands at the fifth.
 */
export const HP_SHARE = 0.1;
/**
 * Every week after the first, rung 1 has this many times the HP of the week before's, but only if
 * the town cleared the whole ladder (`BOSSES.length` rungs) that week; otherwise it stays the same.
 */
export const WEEKLY_GROWTH = 1.1;
/** Each rung has this many times the HP of the one before. */
export const HP_GROWTH = 1.5;
/** The least HP the first raid's rung 1 comes with. */
export const MIN_HP = 2e9;
/** A PR opened is a special attack. */
export const PR_HIT = 25e6;
/** Damage that week, up to the day of a kill, to count as one of its raiders and be paid for it. */
export const RAIDER_AT = 10e6;
/** What each raider gets when the boss on rungs 1 to 5 falls, on a level 1 ladder. */
export const RAID_REWARDS: readonly number[] = [40, 100, 200, 300, 400];
/**
 * What the same kills paid in weeks before `RAID_REWARDS_FROM`: those weeks keep it, as a wallet is worked
 * out again from every kill and a raised payout would otherwise pay them all again.
 */
export const OLD_RAID_REWARDS: readonly number[] = [10, 25, 50, 75, 100];
/**
 * The first raid week (its Monday) on `RAID_REWARDS`, this week's included.
 * ponytail: set to the deploy week when shipping, like `LOOT_ODDS_FROM`.
 */
export const RAID_REWARDS_FROM = "2026-10-26";
/** What rung 1 pays. */
export const RAID_COINS = RAID_REWARDS[0]!;
/** Every level of the ladder pays this many times what the one before did. */
export const REWARD_GROWTH = 1.1;
/** The week's gate opens at this hour on Monday, world time. */
export const OPENS_AT_HOUR = 8;

/** A boss on a rung of the ladder: "Merge Conflict II" is rung 3 of the level 2 ladder. */
export interface RungBoss extends Boss {
  rung: number;
  /** The ladder's level: 1 the first time, one more for each ladder the town has cleared ("II", "III"…). */
  level: number;
}

const roman = (n: number): string => {
  let out = "";
  for (const [v, s] of [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ] as const)
    for (; n >= v; n -= v) out += s;
  return out;
};

/** The boss on `rung` (1 is the easiest, `BOSSES.length` the last) of a level `level` ladder. */
export function bossAt(rung: number, level = 1): RungBoss {
  const boss = BOSSES[Math.min(rung, BOSSES.length) - 1]!;
  return { ...boss, name: level > 1 ? `${boss.name} ${roman(level)}` : boss.name, rung, level };
}

/** The first raid's rung 1 HP, from the week before's damage. */
export const hpFor = (lastWeekDamage: number): number =>
  Math.max(MIN_HP, Math.round(lastWeekDamage * HP_SHARE));

/** Whether a week's kills got through every boss (the 5 of `BOSSES`): that's what earns the next level's ladder, 10% tougher. */
export const ladderCleared = (kills: number): boolean => kills >= BOSSES.length;

/** Rung 1's HP the week after one whose rung 1 had `hp` and which had `kills` kills: +10% if it cleared the ladder, else the same. */
export const nextWeekHp = (hp: number, kills: number): number =>
  ladderCleared(kills) ? Math.round(hp * WEEKLY_GROWTH) : hp;

/** The HP of `rung`, from rung 1's. */
export const rungHp = (base: number, rung: number): number => Math.round(base * HP_GROWTH ** (rung - 1));

/**
 * What each raider gets when the boss on `rung` falls on a level `level` ladder: 40, 100, 200, 300, 400,
 * and 10% more each level. `week` is the raid week it falls in: before `RAID_REWARDS_FROM` the old payout.
 * Without one, today's.
 */
export const rewardFor = (rung: number, level = 1, week?: string): number =>
  Math.round(
    (week !== undefined && week < RAID_REWARDS_FROM ? OLD_RAID_REWARDS : RAID_REWARDS)[
      Math.min(rung, RAID_REWARDS.length) - 1
    ]! *
      REWARD_GROWTH ** (level - 1),
  );

/** One player's world day, as the raid sees it. */
export interface RaidDay {
  userId: number;
  day: string;
  tokens: number;
  prs: number;
}

/** What one player's day does to the boss: every token, no cap. */
export const dayDamage = (d: { tokens: number; prs: number }): number => d.tokens + d.prs * PR_HIT;

/**
 * The first raid's week for a town that gets the raid at `now`: next Monday, whatever day it is, so
 * the first ladder opens at its 08:00. Earlier weeks only set its HP, so nobody is paid for bosses
 * that were never there.
 */
export const launchWeek = (now: number): string => addDays(weekOf(dayKey(now)), 7);

const mondays = new Map<string, string>();

/** The Monday (`YYYY-MM-DD`) of the world week that `day` is in. Kept: every poll asks it of every row. */
export function weekOf(day: string): string {
  let monday = mondays.get(day);
  if (monday === undefined) {
    const [y, m, d] = day.split("-").map(Number);
    const weekday = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
    monday = addDays(day, -((weekday + 6) % 7));
    mondays.set(day, monday);
  }
  return monday;
}

/** When world day `day` starts, in ms. The world's clock is one or two hours ahead of UTC. */
export function dayStart(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  const midnight = Date.UTC(y!, m! - 1, d!);
  for (const hours of [-2, -1, 0]) {
    const at = midnight + hours * 3_600_000;
    if (dayKey(at) === day) return at;
  }
  return midnight;
}

/**
 * When `week`'s ladder opens: its Monday at 08:00, world time. The clocks change on Sundays, never
 * on a Monday morning, so it's always 8 hours after that Monday's midnight.
 */
export const opensAt = (week: string): number => dayStart(week) + OPENS_AT_HOUR * 3_600_000;

/**
 * The week the raid shows at `now`. Usage is stored per world day, so a week's damage is whole days
 * from Monday's midnight, but the town gets the night off: until Monday 08:00 it's still last
 * week, as it ended (its kills paid, its last boss standing), and the new ladder appears at 08:00
 * with Monday's early tokens already in it. Everything else (the history, wallets) follows this
 * too, so nobody is paid for a kill before the gate opens and shows it.
 */
export function raidWeekAt(now: number): string {
  const week = weekOf(dayKey(now));
  return now < opensAt(week) ? addDays(week, -7) : week;
}

/** A boss that fell, and the raiders paid for it. */
interface Kill {
  rung: number;
  boss: RungBoss;
  /** The world day it fell. */
  day: string;
  /** What each raider got. */
  coins: number;
  /** Everyone with `RAIDER_AT` damage that week up to and including `day`. */
  raiders: number[];
}

export interface RaidWeek {
  week: string;
  /** The ladder's level: 1, then one more after each week that cleared it. */
  level: number;
  /** Rung 1's HP; rung n has `rungHp(hp, n)`. */
  hp: number;
  /** Everything the town hit that week. */
  damage: number;
  /** The bosses that fell, in order. */
  kills: Kill[];
  /** Every boss has fallen: the ladder is done and nothing more happens till next Monday. */
  cleared: boolean;
  /**
   * The rung still standing, and how much of its HP has been hit (the overflow included). Once the
   * ladder is `cleared` it's the last boss, fallen: its whole HP hit, whatever came after.
   */
  current: { boss: RungBoss; hp: number; damage: number };
  /** Damage per player, highest first. */
  raiders: { userId: number; damage: number }[];
}

/** One week's ladder of level `level`, from its days (all in that week). */
function ladder(week: string, level: number, hp: number, days: readonly RaidDay[]): RaidWeek {
  const byDay = groupBy(days, "day");
  const perUser = new Map<number, number>();
  const kills: Kill[] = [];
  let rung = 1;
  let pool = 0;
  let total = 0;
  for (const day of Object.keys(byDay).sort()) {
    for (const d of byDay[day]!) {
      const hit = dayDamage(d);
      perUser.set(d.userId, (perUser.get(d.userId) ?? 0) + hit);
      pool += hit;
      total += hit;
    }
    // A big day can bring down several, all on that day, in order, up to the last boss. What's left
    // after that still counts as damage, but there's nothing more to hit.
    while (rung <= BOSSES.length && pool >= rungHp(hp, rung)) {
      pool -= rungHp(hp, rung);
      kills.push({
        rung,
        boss: bossAt(rung, level),
        day,
        coins: rewardFor(rung, level, week),
        raiders: [...perUser]
          .filter(([, n]) => n >= RAIDER_AT)
          .map(([userId]) => userId)
          .sort((a, b) => a - b),
      });
      rung++;
    }
  }
  const cleared = rung > BOSSES.length;
  const standing = Math.min(rung, BOSSES.length);
  return {
    week,
    level,
    hp,
    damage: total,
    kills,
    cleared,
    current: {
      boss: bossAt(standing, level),
      hp: rungHp(hp, standing),
      damage: cleared ? rungHp(hp, standing) : pool,
    },
    raiders: [...perUser]
      .map(([userId, damage]) => ({ userId, damage }))
      .sort((a, b) => b.damage - a.damage || a.userId - b.userId),
  };
}

const totalDamage = (days: readonly RaidDay[]): number => sumBy(days, dayDamage);

/** The first raid's rung 1 HP so far: from the damage the week before `start` (`hpFor`). */
export const firstHp = (days: readonly RaidDay[], start: string): number => {
  const before = addDays(start, -7);
  return hpFor(totalDamage(days.filter((d) => weekOf(d.day) === before)));
};

/**
 * Every raid from the first, `start` (a Monday), to the week shown at `now` (`raidWeekAt`), oldest
 * first; none before `start` opens. The first raid's HP comes from the damage the week before it
 * (`firstHp`); every week after has the same ladder again, or, if the town cleared the whole ladder
 * that week, the next level's: its bosses "II", "III"… and 10% tougher (`nextWeekHp`).
 */
export function raidWeeks(days: readonly RaidDay[], now: number, start: string): RaidWeek[] {
  const current = raidWeekAt(now);
  const byWeek = groupBy(days, (d) => weekOf(d.day));
  // `firstHp`, from the week's own bucket.
  const first = hpFor(totalDamage(byWeek[addDays(start, -7)] ?? []));
  const out: RaidWeek[] = [];
  let hp = first;
  let level = 1;
  for (let week = start; week <= current; week = addDays(week, 7)) {
    const prev = out[out.length - 1];
    if (prev?.cleared) {
      hp = nextWeekHp(hp, prev.kills.length);
      level++;
    }
    out.push(ladder(week, level, hp, byWeek[week] ?? []));
  }
  return out;
}

/** What `userId` got for the kills in `weeks`. */
export const raidCoins = (weeks: readonly RaidWeek[], userId: number): number =>
  sumBy(weeks, (w) => sumBy(w.kills, (k) => (k.raiders.includes(userId) ? k.coins : 0)));

/**
 * A raider's war desk in the dungeon, of `seats`: the one their id hashes to, or the next free one
 * round the room, so the same person keeps the same desk across reloads while there's room.
 */
export function seatFor(userId: number, taken: ReadonlySet<number>, seats: number): number {
  let h = Math.imul(userId ^ 0x5bd1e995, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  let seat = ((h ^ (h >>> 13)) >>> 0) % seats;
  while (taken.has(seat)) seat = (seat + 1) % seats;
  return seat;
}
