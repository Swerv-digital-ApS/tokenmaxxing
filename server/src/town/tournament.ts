import { GAMES } from "@tokenmaxxing/core/games/index.ts";
import type { GameId } from "@tokenmaxxing/core/games/types.ts";
import {
  type Bracket,
  type Champion,
  champion,
  IDLE_MS,
  isSize,
  isTournamentGame,
  makeBracket,
  report,
  type Size,
  startDue,
  startsAt,
  type TournamentBoard,
  waiting,
} from "@tokenmaxxing/core/tournament.ts";
import { UserError } from "rivetkit";
import { all, one, type Sql } from "../actors/shared.ts";

/**
 * The basement's tournament board (`core/tournament.ts` has the rules). One table, one live bracket at a
 * time; finished ones stay as rows, the latest champion is the name on the board. Additive.
 *
 * ponytail: nothing ticks. An open board that is due starts the next time anyone asks for the board (the
 * panel polls while it's open) or signs up; an idle one is called off the same way.
 */
export async function migrateTournament(sql: Sql): Promise<void> {
  await sql.execute(`CREATE TABLE IF NOT EXISTS tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game TEXT NOT NULL, size INTEGER NOT NULL, host INTEGER NOT NULL,
    status TEXT NOT NULL, players TEXT NOT NULL, bracket TEXT,
    winner INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`);
}

interface Row {
  id: number;
  game: GameId;
  size: Size;
  host: number;
  status: "open" | "running" | "done" | "cancelled";
  players: string;
  bracket: string | null;
  winner: number | null;
  created_at: number;
  updated_at: number;
}

/** What a call changed, as lines for the town. */
export interface Result {
  lines: string[];
}

const live = (sql: Sql): Promise<Row | undefined> =>
  one<Row>(sql, "SELECT * FROM tournaments WHERE status IN ('open', 'running') ORDER BY id DESC LIMIT 1");

const idsOf = (r: Row): number[] => JSON.parse(r.players) as number[];

async function names(sql: Sql, ids: number[]): Promise<Record<number, string>> {
  const rows = await all<{ id: number; name: string }>(
    sql,
    "SELECT id, name FROM users WHERE id IN (SELECT value FROM json_each(?))",
    JSON.stringify(ids),
  );
  return Object.fromEntries(rows.map((r) => [r.id, r.name]));
}

const gameName = (g: GameId): string => GAMES[g]?.name ?? g;

/** Starts a due open board, or calls off an idle one. Returns the row as it is now. */
async function tick(sql: Sql, now: number, lines: string[]): Promise<Row | undefined> {
  const row = await live(sql);
  if (!row) return undefined;
  if (now - row.updated_at > IDLE_MS) {
    await sql.execute(
      "UPDATE tournaments SET status = 'cancelled', updated_at = ? WHERE id = ?",
      now,
      row.id,
    );
    lines.push(`The ${gameName(row.game)} tournament was called off: nobody played for a while.`);
    return undefined;
  }
  const players = idsOf(row);
  if (row.status !== "open" || !startDue({ size: row.size, players, createdAt: row.created_at }, now))
    return row;
  const bracket = makeBracket(players, row.id * 2654435761 + now);
  await sql.execute(
    "UPDATE tournaments SET status = 'running', bracket = ?, updated_at = ? WHERE id = ?",
    JSON.stringify(bracket),
    now,
    row.id,
  );
  const who = await names(sql, players);
  const name = (id: number | null) => (id === null ? "?" : (who[id] ?? "?"));
  const first = waiting(bracket)
    .map((m) => `${name(m.a)} vs ${name(m.b)}`)
    .join(", ");
  lines.push(
    `The ${gameName(row.game)} tournament is on in the basement! ${first}. Play it at a table in the square.`,
  );
  return { ...row, status: "running", bracket: JSON.stringify(bracket), updated_at: now };
}

/** The live bracket (starting or calling it off first, if it's due) and the latest champion. */
export async function board(sql: Sql, now: number): Promise<TournamentBoard & Result> {
  const lines: string[] = [];
  const row = await tick(sql, now, lines);
  const done = await one<Row>(
    sql,
    "SELECT * FROM tournaments WHERE status = 'done' AND winner IS NOT NULL ORDER BY id DESC LIMIT 1",
  );
  const ids = new Set<number>();
  if (row) for (const id of idsOf(row)) ids.add(id);
  if (done?.winner) ids.add(done.winner);
  const who = await names(sql, [...ids]);
  const champ: Champion | null = done?.winner
    ? { userId: done.winner, name: who[done.winner] ?? "?", game: done.game, at: done.updated_at }
    : null;
  if (!row) return { current: null, champion: champ, lines };
  const players = idsOf(row);
  return {
    current: {
      id: row.id,
      game: row.game,
      size: row.size,
      status: row.status as "open" | "running",
      host: row.host,
      players: players.map((id) => ({ id, name: who[id] ?? "?" })),
      bracket: row.bracket ? (JSON.parse(row.bracket) as Bracket) : null,
      startsAt:
        row.status === "open" ? startsAt({ size: row.size, players, createdAt: row.created_at }) : null,
    },
    champion: champ,
    lines,
  };
}

/** Opens a bracket for `game`, with the host signed up. One at a time in the whole town. */
export async function open(
  sql: Sql,
  userId: number,
  game: unknown,
  size: unknown,
  now: number,
): Promise<Result> {
  if (!isTournamentGame(game)) throw new UserError("That game can't have a bracket.", { code: "bad_game" });
  if (!isSize(size)) throw new UserError("A bracket is 4 or 8 players.", { code: "bad_size" });
  const lines: string[] = [];
  if (await tick(sql, now, lines)) throw new UserError("There's a tournament on already.", { code: "busy" });
  await sql.execute(
    `INSERT INTO tournaments (game, size, host, status, players, created_at, updated_at)
     VALUES (?, ?, ?, 'open', ?, ?, ?)`,
    game,
    size,
    userId,
    JSON.stringify([userId]),
    now,
    now,
  );
  lines.push(`A ${gameName(game)} tournament (${size} players) is open at the basement's board.`);
  return { lines };
}

/** Signs `userId` up (or out) of the open bracket; filling it starts it. */
export async function signup(sql: Sql, userId: number, join: boolean, now: number): Promise<Result> {
  const lines: string[] = [];
  const row = await tick(sql, now, lines);
  if (row?.status !== "open") throw new UserError("No bracket is taking names.", { code: "closed" });
  const players = idsOf(row);
  const has = players.includes(userId);
  if (join && has) throw new UserError("You're signed up already.", { code: "joined" });
  if (!join && !has) throw new UserError("You aren't signed up.", { code: "not_joined" });
  const next = join ? [...players, userId] : players.filter((p) => p !== userId);
  if (next.length === 0) {
    await sql.execute(
      "UPDATE tournaments SET status = 'cancelled', updated_at = ? WHERE id = ?",
      now,
      row.id,
    );
    return { lines };
  }
  await sql.execute("UPDATE tournaments SET players = ? WHERE id = ?", JSON.stringify(next), row.id);
  // Filling it starts it; the open time is what the wait counts from, so signing up doesn't reset it.
  await tick(sql, now, lines);
  return { lines };
}

/**
 * A match ended (the arcade tells us): two players, one winner. If it's a waiting match of the running
 * bracket for that game, it counts. Anything else (other games, strangers, ties, void) is not ours.
 *
 * Wired from the arcade's `settle`, so no confirm buttons: the match actors' result is the truth.
 */
export async function matchResult(
  sql: Sql,
  game: string,
  players: number[],
  winners: number[],
  now: number,
): Promise<Result> {
  const lines: string[] = [];
  const row = await tick(sql, now, lines);
  if (!row || row.status !== "running" || row.game !== game || players.length !== 2 || winners.length !== 1)
    return { lines };
  const [a, b] = players as [number, number];
  const next = report(JSON.parse(row.bracket!) as Bracket, a, b, winners[0]!);
  if (!next) return { lines };
  const champ = champion(next);
  const who = await names(sql, idsOf(row));
  const name = (id: number | null) => (id === null ? "?" : (who[id] ?? "?"));
  const loser = winners[0] === a ? b : a;
  if (champ !== null) {
    await sql.execute(
      "UPDATE tournaments SET status = 'done', bracket = ?, winner = ?, updated_at = ? WHERE id = ?",
      JSON.stringify(next),
      champ,
      now,
      row.id,
    );
    lines.push(
      `${name(champ)} won the ${gameName(row.game)} tournament, beating ${name(loser)} in the final! Their name is on the basement board.`,
    );
  } else {
    await sql.execute(
      "UPDATE tournaments SET bracket = ?, updated_at = ? WHERE id = ?",
      JSON.stringify(next),
      now,
      row.id,
    );
    lines.push(`${name(winners[0]!)} beat ${name(loser)} and goes through.`);
  }
  return { lines };
}
