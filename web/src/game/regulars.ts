import { LEFT_PLATES, plaqueOf, plateText, REGULARS_TOP, type Regular } from "@tokenmaxxing/core/regulars.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { barTabSide, nameboard } from "../art/tavern.ts";
import { town } from "../net.ts";
import type { Frame } from "./frame.ts";
import { world } from "./world.ts";

/** In the Tavern, the board is asked for again this often (the server keeps it a minute). */
const REFRESH_MS = 60_000;
const board = { rows: [] as Regular[], last: null as number | null, at: 0, asking: false };

/** This week's board, asked for again at most once a `REFRESH_MS` (both renderers call it each frame in the Tavern). */
export function askRegulars(): void {
  const now = Date.now();
  if (board.asking || now - board.at <= REFRESH_MS) return;
  board.asking = true;
  board.at = now;
  void town
    .regulars()
    .then((r) => {
      board.rows = r.top;
      board.last = r.last?.userId ?? null;
    })
    .catch(() => {})
    .finally(() => {
      board.asking = false;
    });
}

/** The board as last asked: the week's top, and last week's winner (who wears the crown). */
export const regularsBoard = (): { rows: readonly Regular[]; last: number | null } => ({
  rows: board.rows,
  last: board.last,
});

/** In the Tavern: this week's top five as 3-letter names on the two plaques by the hearth. */
export function drawRegulars({ g, items }: Frame): void {
  askRegulars();
  const plaques = [...world.map.find("P")].sort((a, b) => a[0] - b[0]);
  for (const [i, [x, y]] of plaques.entries()) {
    // Rank order, three rows on the left plaque and two on the right; an empty rank is a dash.
    const first = i === 0 ? 1 : LEFT_PLATES + 1;
    const last = i === 0 ? LEFT_PLATES : REGULARS_TOP;
    const names: string[] = [];
    for (let rank = first; rank <= last; rank++) {
      const r = board.rows.find((r) => r.rank === rank && plaqueOf(r.rank) === Math.min(i, 1));
      names.push(r ? plateText(r) : "");
    }
    const face = nameboard(names);
    // Over the plaque's own board (its post starts 7 pixels into the tile), inside its tile's width.
    items.push({
      y: y * TILE + TILE,
      draw: () => g.drawImage(face, x * TILE, y * TILE + 8 - face.height),
    });
  }
}

/** The bar tab on the west wall (a run of `J`): the week's top names, last week's winner crowned. */
export function drawBarTab({ g, items }: Frame): void {
  const top = world.map.find("J").find(([x, y]) => world.map.at(x, y - 1) !== "J");
  if (!top) return;
  const rows = board.rows.map((r) => plateText(r));
  const sprite = barTabSide(
    rows,
    board.rows.findIndex((r) => r.userId === board.last),
  );
  const [x, y] = top;
  items.push({
    y: y * TILE + sprite.height - 1,
    draw: () => g.drawImage(sprite, x * TILE, y * TILE),
  });
}
