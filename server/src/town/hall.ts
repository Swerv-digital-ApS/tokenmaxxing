import { BADGES, frameOf, grandFrame } from "@tokenmaxxing/core/badges.ts";
import { MILESTONES } from "@tokenmaxxing/core/milestones.ts";
import { opensAt, type RaidWeek, raidWeekAt } from "@tokenmaxxing/core/raid.ts";
import type { Look } from "@tokenmaxxing/core/world.ts";
import { all, type Sql, scalar } from "../actors/shared.ts";
import { backfillDone } from "./awards.ts";
import { lookOf, type UserRow } from "./users.ts";

export interface HallPerson {
  userId: number;
  name: string;
  look: Look;
}

/** The wall: the rarest honours, this week's firsts and winners. Everyone shows by name. */
export interface HallOfFame {
  /** The raid week's Monday: the week the firsts and winners are from. */
  week: string;
  /** False until every earned tier is recorded (`backfillDone`): the lists would be wrong before. */
  ready: boolean;
  /** Gold and diamond tiers held by the fewest, `of` players in the town. */
  rarest: {
    badge: string;
    tier: number;
    holders: number;
    of: number;
    who: (HallPerson & { at: number | null })[];
  }[];
  /** New this week: the first in the town to a tier or milestone level. */
  firsts: (HallPerson & { text: string; at: number })[];
  /** Raid: the most damage this week. Game: the most coins won (net of stakes) in each game. */
  winners: (HallPerson & { kind: "raid" | "game"; game?: string; value: number })[];
}

const RAREST = 5;
const WHO = 3;
const FIRSTS = 8;

/** Whether `tier` of badge `id` has a gold frame or better. */
const topTier = (id: string, tier: number): boolean => {
  const def = BADGES.find((b) => b.id === id);
  if (!def) return false;
  return grandFrame(frameOf(tier, def.tiers.length));
};

/** What `firsts` says of a (badge, tier) row. */
function firstText(badge: string, tier: number): string | null {
  if (badge === "level") {
    const m = MILESTONES.find((x) => x.level === tier);
    return m ? `First to reach level ${tier}: ${m.title}` : null;
  }
  const def = BADGES.find((b) => b.id === badge);
  const t = def?.tiers[tier - 1];
  return def && t ? `First to earn ${def.name} ${frameOf(tier, def.tiers.length)}: ${t.label}` : null;
}

type UserLook = UserRow & { at?: number | null };
const person = (u: UserLook): HallPerson => ({ userId: u.id, name: u.name, look: lookOf(u) });

/** `weeks`: the raids (`raidHistory`), for who hit hardest. */
export async function hallOfFame(sql: Sql, now: number, weeks: RaidWeek[]): Promise<HallOfFame> {
  const week = raidWeekAt(now);
  const ready = await backfillDone(sql);
  const hall: HallOfFame = { week, ready, rarest: [], firsts: [], winners: [] };
  if (!ready) return hall;

  const counts = await all<{ badge: string; tier: number; holders: number }>(
    sql,
    `SELECT a.badge, a.tier, COUNT(*) AS holders FROM badge_awards a
     JOIN users u ON u.id = a.user_id WHERE a.badge != 'level' GROUP BY a.badge, a.tier`,
  );
  const of = await scalar(sql, "SELECT COUNT(*) AS n FROM users");
  const rarest = counts
    .filter((c) => topTier(c.badge, c.tier))
    .sort((a, b) => a.holders - b.holders || b.tier - a.tier || a.badge.localeCompare(b.badge))
    .slice(0, RAREST);
  for (const r of rarest) {
    const who = await all<UserRow & { at: number; backfill: number }>(
      sql,
      `SELECT u.id, u.name, u.company_id AS companyId, u.look, a.at, a.backfill
       FROM badge_awards a JOIN users u ON u.id = a.user_id
       WHERE a.badge = ? AND a.tier = ? ORDER BY a.backfill, a.at, u.id LIMIT ?`,
      r.badge,
      r.tier,
      WHO,
    );
    hall.rarest.push({
      ...r,
      of,
      who: who.map((u) => ({ ...person(u), at: u.backfill ? null : u.at })),
    });
  }

  // The first anywhere to a tier, this week and really earned: no one (backfill included) before them.
  const firsts = await all<UserRow & { badge: string; tier: number; at: number }>(
    sql,
    `SELECT u.id, u.name, u.company_id AS companyId, u.look, a.badge, a.tier, a.at
     FROM badge_awards a JOIN users u ON u.id = a.user_id
     WHERE a.backfill = 0 AND a.at >= ?
       AND NOT EXISTS (SELECT 1 FROM badge_awards b WHERE b.badge = a.badge AND b.tier = a.tier
                       AND (b.at < a.at OR (b.at = a.at AND b.user_id < a.user_id)))
     ORDER BY a.at DESC LIMIT ?`,
    opensAt(week),
    FIRSTS * 2,
  );
  for (const f of firsts) {
    const text = firstText(f.badge, f.tier);
    if (text && hall.firsts.length < FIRSTS) hall.firsts.push({ ...person(f), text, at: f.at });
  }

  const top = weeks.find((w) => w.week === week)?.raiders[0];
  if (top) {
    const [u] = await all<UserRow>(
      sql,
      "SELECT id, name, company_id AS companyId, look FROM users WHERE id = ?",
      top.userId,
    );
    if (u) hall.winners.push({ ...person(u), kind: "raid", value: top.damage });
  }
  const games = await all<UserRow & { game: string; net: number }>(
    sql,
    `SELECT u.id, u.name, u.company_id AS companyId, u.look, m.game, SUM(m.won - m.stake) AS net
     FROM match_players m JOIN users u ON u.id = m.user_id
     WHERE m.day >= ? GROUP BY m.game, m.user_id`,
    week,
  );
  const best = new Map<string, (typeof games)[number]>();
  for (const g of games) {
    const cur = best.get(g.game);
    if (g.net > 0 && (!cur || g.net > cur.net || (g.net === cur.net && g.id < cur.id))) best.set(g.game, g);
  }
  for (const g of [...best.values()].sort((a, b) => a.game.localeCompare(b.game)))
    hall.winners.push({ ...person(g), kind: "game", game: g.game, value: g.net });
  return hall;
}
