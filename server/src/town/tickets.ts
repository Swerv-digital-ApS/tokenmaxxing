import { parseTicket, type Ticket, ticketKey } from "@tokenmaxxing/core/cop.ts";
import { compact } from "hanzio";
import { all, type Sql } from "../actors/shared.ts";

/**
 * The 429 Cop's tickets (`core/src/cop.ts`), as rows in `rewards`: one statement, so a second ticket
 * the same world day never lands, even if `world` asks twice. How many they hold now, or null if
 * this one wasn't written.
 */
export async function giveTicket(sql: Sql, userId: number, t: Ticket): Promise<number | null> {
  const rows = await sql.execute(
    `INSERT INTO rewards (user_id, item) SELECT ?, ?
     WHERE EXISTS (SELECT 1 FROM users WHERE id = ?)
       AND NOT EXISTS (SELECT 1 FROM rewards WHERE user_id = ? AND item LIKE ?)
     RETURNING item`,
    userId,
    ticketKey(t),
    userId,
    userId,
    `ticket:${t.day}:%`,
  );
  return rows.length > 0 ? (await ticketsOf(sql, userId)).length : null;
}

/** Someone's tickets, newest first: for their card. */
export async function ticketsOf(sql: Sql, userId: number): Promise<Ticket[]> {
  const rows = await all<{ item: string }>(
    sql,
    "SELECT item FROM rewards WHERE user_id = ? AND item LIKE 'ticket:%'",
    userId,
  );
  return compact(rows.map((r) => parseTicket(r.item))).sort((a, b) => b.day.localeCompare(a.day));
}
