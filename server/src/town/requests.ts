import {
  byPile,
  DONE_SHOWN,
  isStatus,
  LIVE_CAP,
  OPEN_CAP,
  POST_GAP_MS,
  type RequestEntry,
  type RequestStatus,
} from "@tokenmaxxing/core/requests.ts";
import { UserError } from "rivetkit";
import { all, one, type Sql, scalar } from "../actors/shared.ts";
import type { PushedRequest } from "../request-push.ts";
import { parseRequest } from "../validate.ts";

/**
 * The Tavern's request pile (`core/src/requests.ts` has the rules): what players would like in the game,
 * with a 👍 each. Two tables; a request is its author's to take back while it's open, and the admin page
 * marks what the builders take on. Additive.
 */
export async function migrateRequests(sql: Sql): Promise<void> {
  await sql.execute(`CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL, text TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open',
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`);
  await sql.execute(`CREATE TABLE IF NOT EXISTS request_votes (
    request_id INTEGER NOT NULL, user_id INTEGER NOT NULL, PRIMARY KEY (request_id, user_id))`);
}

interface Row {
  id: number;
  user_id: number;
  name: string;
  text: string;
  status: RequestStatus;
  created_at: number;
  votes: number;
  voted: number;
}

const SELECT = `SELECT r.id, r.user_id, u.name, r.text, r.status, r.created_at,
    (SELECT COUNT(*) FROM request_votes v WHERE v.request_id = r.id) AS votes,
    EXISTS (SELECT 1 FROM request_votes v WHERE v.request_id = r.id AND v.user_id = ?) AS voted
  FROM requests r JOIN users u ON u.id = r.user_id`;

const entry = (r: Row): RequestEntry => ({
  id: r.id,
  userId: r.user_id,
  name: r.name,
  text: r.text,
  status: r.status,
  votes: r.votes,
  voted: r.voted === 1,
  createdAt: r.created_at,
});

/** The pile as `userId` sees it: everything live (up to `LIVE_CAP`) and the latest few finished. */
export async function pile(sql: Sql, userId: number): Promise<RequestEntry[]> {
  const live = await all<Row>(
    sql,
    `${SELECT} WHERE r.status IN ('open', 'planned') ORDER BY votes DESC, r.id DESC LIMIT ?`,
    userId,
    LIVE_CAP,
  );
  const done = await all<Row>(
    sql,
    `${SELECT} WHERE r.status IN ('done', 'declined') ORDER BY r.updated_at DESC LIMIT ?`,
    userId,
    DONE_SHOWN,
  );
  return [...live, ...done].map(entry).sort(byPile);
}

/** Puts a request on the pile as `userId`, with their 👍 on it already. Returns it, for the push. */
export async function submit(sql: Sql, userId: number, raw: unknown, now: number): Promise<PushedRequest> {
  const text = parseRequest(raw);
  if (text === null)
    throw new UserError("Write what you'd like, in a line: 8 to 280 characters, no links.", {
      code: "bad_request",
    });
  const open = await scalar(
    sql,
    "SELECT COUNT(*) AS n FROM requests WHERE user_id = ? AND status IN ('open', 'planned')",
    userId,
  );
  if (open >= OPEN_CAP)
    throw new UserError(`You have ${OPEN_CAP} requests on the pile already.`, {
      code: "too_many",
    });
  const last = await scalar(sql, "SELECT MAX(created_at) AS n FROM requests WHERE user_id = ?", userId);
  if (last && now - last < POST_GAP_MS)
    throw new UserError("Give it a minute before the next one.", {
      code: "rate_limited",
    });
  const same = await one<{ id: number }>(
    sql,
    "SELECT id FROM requests WHERE lower(text) = lower(?) AND status IN ('open', 'planned')",
    text,
  );
  if (same)
    throw new UserError("That's on the pile already: give it a 👍.", {
      code: "duplicate",
    });
  await sql.execute(
    "INSERT INTO requests (user_id, text, status, created_at, updated_at) VALUES (?, ?, 'open', ?, ?)",
    userId,
    text,
    now,
    now,
  );
  const id = await scalar(sql, "SELECT last_insert_rowid() AS n");
  await sql.execute("INSERT INTO request_votes (request_id, user_id) VALUES (?, ?)", id, userId);
  const author = await one<{ name: string }>(sql, "SELECT name FROM users WHERE id = ?", userId);
  return { id, userId, name: author?.name ?? "", text, createdAt: now };
}

const live = (sql: Sql, id: unknown) =>
  typeof id === "number"
    ? one<{ id: number; user_id: number; status: RequestStatus }>(
        sql,
        "SELECT id, user_id, status FROM requests WHERE id = ?",
        id,
      )
    : Promise.resolve(undefined);

/** Adds or takes back `userId`'s 👍. Only while it's still on the pile. */
export async function vote(sql: Sql, userId: number, id: unknown, on: boolean): Promise<void> {
  const r = await live(sql, id);
  if (!r || (r.status !== "open" && r.status !== "planned"))
    throw new UserError("That request is no longer on the pile.", {
      code: "not_found",
    });
  if (on)
    await sql.execute(
      "INSERT OR IGNORE INTO request_votes (request_id, user_id) VALUES (?, ?)",
      r.id,
      userId,
    );
  else await sql.execute("DELETE FROM request_votes WHERE request_id = ? AND user_id = ?", r.id, userId);
}

/** Takes back my own request, while it's still open. */
export async function withdraw(sql: Sql, userId: number, id: unknown): Promise<void> {
  const r = await live(sql, id);
  if (!r || r.user_id !== userId || r.status !== "open")
    throw new UserError("You can only take back your own open request.", {
      code: "not_found",
    });
  await sql.execute("DELETE FROM request_votes WHERE request_id = ?", r.id);
  await sql.execute("DELETE FROM requests WHERE id = ?", r.id);
}

const textOf = async (sql: Sql, id: number) =>
  (await one<{ text: string }>(sql, "SELECT text FROM requests WHERE id = ?", id))?.text;

/** The admin page: marks a request. Returns its text, for the log. */
export async function setStatus(sql: Sql, id: unknown, status: unknown, now: number): Promise<string> {
  const r = await live(sql, id);
  if (!r || !isStatus(status)) throw new UserError("Unknown request.", { code: "not_found" });
  await sql.execute("UPDATE requests SET status = ?, updated_at = ? WHERE id = ?", status, now, r.id);
  return (await textOf(sql, r.id)) ?? "";
}

/** The admin page: takes a request down. Returns its text, for the log. */
export async function remove(sql: Sql, id: unknown): Promise<string> {
  const r = await live(sql, id);
  if (!r) throw new UserError("Unknown request.", { code: "not_found" });
  const text = (await textOf(sql, r.id)) ?? "";
  await sql.execute("DELETE FROM request_votes WHERE request_id = ?", r.id);
  await sql.execute("DELETE FROM requests WHERE id = ?", r.id);
  return text;
}

/** Every request, newest first, for the admin page. */
export async function everything(sql: Sql): Promise<RequestEntry[]> {
  return (await all<Row>(sql, `${SELECT} ORDER BY r.id DESC LIMIT 500`, 0)).map(entry);
}

/** Someone's gone: their requests and 👍 go with them. */
export async function forget(sql: Sql, userId: number): Promise<void> {
  await sql.execute(
    "DELETE FROM request_votes WHERE request_id IN (SELECT id FROM requests WHERE user_id = ?)",
    userId,
  );
  await sql.execute("DELETE FROM requests WHERE user_id = ?", userId);
  await sql.execute("DELETE FROM request_votes WHERE user_id = ?", userId);
}
