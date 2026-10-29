import type { GameMap } from "@tokenmaxxing/core/maps.ts";
import { COMPANY_FURNITURE, type Rot, sideways, turnAt } from "@tokenmaxxing/core/office.ts";
import { POSTERS } from "@tokenmaxxing/core/posters.ts";

const pieceChars = new Map<string, number>(
  [...COMPANY_FURNITURE, ...POSTERS].map((p): [string, number] => [p.ch, p.w ?? 1]),
);

/**
 * What a company has dropped in its house, read off the map (a piece writes its character on every tile it covers),
 * with `rot` on a piece turned: a quarter turn lies it down its column, from its top tile.
 */
export function placedIn(map: GameMap): { ch: string; x: number; y: number; rot?: Rot }[] {
  const out: { ch: string; x: number; y: number; rot?: Rot }[] = [];
  map.rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      const w = pieceChars.get(row[rx]!);
      if (!w) continue;
      const [x, y] = [rx + map.x0, ry + map.y0];
      const turn = turnAt(map, x, y);
      if (turn && sideways(turn.rot)) {
        // Its tiles run down the column: it is one piece, from its top tile.
        if (turn.x === x && turn.y === y) out.push({ ch: row[rx]!, x, y, rot: turn.rot });
        continue;
      }
      out.push({ ch: row[rx]!, x, y, ...(turn && { rot: turn.rot }) });
      rx += w - 1;
    }
  });
  return out;
}
