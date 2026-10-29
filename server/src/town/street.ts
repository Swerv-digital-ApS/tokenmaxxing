/** What `town` does for street life (`core/src/street.ts`): the morning paper's facts. */
import { gameOf } from "@tokenmaxxing/core/games/index.ts";
import { random } from "@tokenmaxxing/core/games/random.ts";
import type { PaperFacts } from "@tokenmaxxing/core/paper.ts";
import { itemById } from "@tokenmaxxing/core/shop.ts";
import { sortBy, sumBy } from "hanzio";
import { all, type Sql } from "../actors/shared.ts";
import { lookOf, TOKENS, USER_COLS, type UserRow } from "./users.ts";

/** Everything the paper can write about world day `day`, from usage, activity, looks and games. */
export async function paperFacts(sql: Sql, day: string): Promise<PaperFacts> {
  const users = await all<UserRow & { tokens: number }>(
    sql,
    `SELECT ${USER_COLS}, COALESCE(t.tokens, 0) AS tokens FROM users
     LEFT JOIN (SELECT user_id, SUM(${TOKENS}) AS tokens FROM usage_daily WHERE day = ? GROUP BY user_id) t
       ON t.user_id = users.id`,
    day,
  );
  const names = new Map(
    (await all<{ id: number; name: string }>(sql, "SELECT id, name FROM companies")).map((c) => [
      c.id,
      c.name,
    ]),
  );
  const active = users.filter((u) => u.tokens > 0).sort((a, b) => b.tokens - a.tokens);
  // By company as people are in them now: good enough for a paper.
  const byCompany = new Map<number, { tokens: number; members: number }>();
  for (const u of active)
    if (u.companyId !== null) {
      const c = byCompany.get(u.companyId) ?? { tokens: 0, members: 0 };
      byCompany.set(u.companyId, { tokens: c.tokens + u.tokens, members: c.members + 1 });
    }
  const [topCo] = sortBy([...byCompany], { by: ([, c]) => c.tokens, order: "desc" });
  const activity = await all<{ name: string; prs: number; prompts: number }>(
    sql,
    `SELECT users.name, a.prs, a.prompts FROM activity_daily a JOIN users ON users.id = a.user_id
     WHERE a.day = ? ORDER BY a.prs DESC`,
    day,
  );
  const [model] = await all<{ name: string; tokens: number }>(
    sql,
    `SELECT model AS name, SUM(${TOKENS}) AS tokens FROM usage_daily WHERE day = ? AND model != 'unknown'
     GROUP BY model ORDER BY tokens DESC LIMIT 1`,
    day,
  );
  const [game] = await all<{ name: string; game: string; won: number }>(
    sql,
    `SELECT users.name, m.game, m.won FROM match_players m JOIN users ON users.id = m.user_id
     WHERE m.day = ? ORDER BY m.won DESC LIMIT 1`,
    day,
  );
  // One pet owner a day, the same one all day: the day's own seed picks them.
  const owners = users.filter((u) => lookOf(u).pet > 0).sort((a, b) => a.id - b.id);
  const owner = owners[Math.floor(random(Number(day.replaceAll("-", "")))() * owners.length)];
  const shipper = activity[0];
  return {
    day,
    tokens: sumBy(active, "tokens"),
    people: active.length,
    burner: active[0] ? { name: active[0].name, tokens: active[0].tokens } : null,
    company: topCo ? { name: names.get(topCo[0]) ?? "A company", ...topCo[1] } : null,
    prs: sumBy(activity, "prs"),
    shipper: shipper && shipper.prs > 0 ? { name: shipper.name, prs: shipper.prs } : null,
    prompts: sumBy(activity, "prompts"),
    model: model ?? null,
    pet: owner
      ? {
          owner: owner.name,
          pet: itemById(`pet.${lookOf(owner).pet}`)?.name ?? "pet",
          place:
            owner.companyId !== null && names.has(owner.companyId) ? names.get(owner.companyId)! : "the Inn",
        }
      : null,
    game: game ? { name: game.name, game: gameOf(game.game)?.name ?? game.game, won: game.won } : null,
  };
}
