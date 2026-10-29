import type { Plot } from "@tokenmaxxing/core/graveyard.ts";
import type { ProviderId } from "@tokenmaxxing/core/launch.ts";
import { all, type Sql, type TxSql } from "./actors/shared.ts";

/**
 * The graveyard's plots (`core/src/graveyard.ts`), in `world`'s SQLite: every pool model it has seen in
 * OpenRouter's list, so a model that drops off it is still known, and buried, after any restart. A
 * few hundred rows, written only when the list changes.
 */
export async function migrateGraveyard(sql: Sql): Promise<void> {
  await sql.execute(`CREATE TABLE IF NOT EXISTS graveyard (
    id TEXT PRIMARY KEY, model TEXT NOT NULL, provider TEXT NOT NULL, listed INTEGER NOT NULL,
    price TEXT NOT NULL, gone INTEGER, buried INTEGER) WITHOUT ROWID`);
}

interface Row {
  id: string;
  model: string;
  provider: string;
  listed: number;
  price: string;
  gone: number | null;
  buried: number | null;
}

export async function loadPlots(sql: Sql): Promise<Plot[]> {
  const rows = await all<Row>(sql, "SELECT id, model, provider, listed, price, gone, buried FROM graveyard");
  return rows.map((r) => ({ ...r, provider: r.provider as ProviderId, price: JSON.parse(r.price) }));
}

/** Writes the plots a read changed (`tend`), as one transaction. */
export async function savePlots(sql: TxSql, changed: readonly Plot[]): Promise<void> {
  if (changed.length === 0) return;
  await sql.transaction(
    async (tx) => {
      for (const p of changed)
        await tx.execute(
          `INSERT INTO graveyard (id, model, provider, listed, price, gone, buried) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET model = excluded.model, provider = excluded.provider,
             listed = excluded.listed, price = excluded.price, gone = excluded.gone, buried = excluded.buried`,
          p.id,
          p.model,
          p.provider,
          p.listed,
          JSON.stringify(p.price),
          p.gone,
          p.buried,
        );
    },
    { name: "graveyard" },
  );
}
