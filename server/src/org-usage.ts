import { ORG_OVERLAP_MS, type OrgFeedSource } from "@tokenmaxxing/core/org-feed.ts";
import type { Source, TokenEvent } from "@tokenmaxxing/core/types.ts";
import { one, type Sql } from "./actors/shared.ts";

/** Local sources that already count the same turn a cloud row would repeat. */
const LOCAL: Record<OrgFeedSource, readonly Source[]> = {
  claude_cloud: ["claude_code", "claude_cowork"],
  codex_cloud: ["codex"],
};

const CLOUD_OF: Partial<Record<Source, OrgFeedSource>> = {
  claude_code: "claude_cloud",
  claude_cowork: "claude_cloud",
  codex: "codex_cloud",
};

const sameTurn = `message_type = 'assistant' AND model = ?
  AND input_tokens = ? AND output_tokens = ? AND cache_creation_tokens = ? AND cache_read_tokens = ?
  AND timestamp BETWEEN ? AND ?`;

function turnArgs(e: TokenEvent): unknown[] {
  const from = e.timestamp - ORG_OVERLAP_MS;
  const to = e.timestamp + ORG_OVERLAP_MS;
  return [e.model, e.inputTokens, e.outputTokens, e.cacheCreationTokens, e.cacheReadTokens, from, to];
}

/**
 * When this local row was already stored, if it was. A replay of some other message must not delete
 * a cloud row: the insert would be ignored and the tokens would be gone.
 */
async function storedAt(sql: Sql, e: TokenEvent): Promise<number | null> {
  const row = await one<{ timestamp: number }>(
    sql,
    `SELECT timestamp FROM events
     WHERE source = ? AND message_id = ? AND COALESCE(request_id, '') = ? AND message_type = ? LIMIT 1`,
    e.source,
    e.messageId,
    e.requestId ?? "",
    e.messageType,
  );
  return row?.timestamp ?? null;
}

/**
 * Keep a cloud row only when the player's own logs don't already have that turn, and drop cloud rows
 * a local row has just replaced. The local row wins. Exact model and token counts, within two minutes:
 * a looser match would hide a real second call, a tighter one would count one call twice.
 */
export async function reconcileOrgUsage(
  sql: Sql,
  events: TokenEvent[],
): Promise<{ events: TokenEvent[]; deletedAt: number[]; deletedDays: string[]; overlaps: number }> {
  const kept: TokenEvent[] = [];
  const deletedAt: number[] = [];
  const deletedDays: string[] = [];
  let overlaps = 0;
  for (const e of events) {
    const locals = e.source === "claude_cloud" || e.source === "codex_cloud" ? LOCAL[e.source] : null;
    if (locals) {
      const hit = await sql.execute(
        `SELECT 1 FROM events WHERE source IN (${locals.map(() => "?").join(",")}) AND ${sameTurn} LIMIT 1`,
        ...locals,
        ...turnArgs(e),
      );
      if (hit.length) {
        overlaps++;
        continue;
      }
    }
    kept.push(e);
    const cloud = CLOUD_OF[e.source];
    if (!cloud || e.messageType !== "assistant") continue;
    const already = await storedAt(sql, e);
    if (already !== null && Math.abs(already - e.timestamp) > ORG_OVERLAP_MS) continue;
    const gone = (await sql.execute(
      `DELETE FROM events WHERE source = ? AND ${sameTurn} RETURNING timestamp, day`,
      cloud,
      ...turnArgs(e),
    )) as { timestamp: number; day: string }[];
    for (const row of gone) {
      deletedAt.push(row.timestamp);
      if (!deletedDays.includes(row.day)) deletedDays.push(row.day);
    }
  }
  return { events: kept, deletedAt, deletedDays, overlaps };
}
