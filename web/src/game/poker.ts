import { type Card, cardFace } from "@tokenmaxxing/core/poker.ts";
import { pokerChairs, pokerTable } from "@tokenmaxxing/core/pokertable.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { hud } from "../store.ts";
import type { Frame } from "./frame.ts";
import { FONT } from "./labels.ts";
import { world } from "./world.ts";

/**
 * The Tavern's poker table in the 2D room (`basement` only): the board and the pot on the felt, a stack under each
 * seated player with their last move, and the dealer's button. The cards are in the labels' pass, in canvas
 * pixels, so the ranks stay crisp. Nothing without a table sent by the server (`hud.poker`).
 */

const CARD_W = 6.5;
const CARD_H = 9;

/** A card face in canvas pixels, centred at (`cx`, `cy`). */
function card(g: CanvasRenderingContext2D, c: Card, cx: number, cy: number, scale: number): void {
  const { rank, suit, red } = cardFace(c);
  const w = CARD_W * scale;
  const h = CARD_H * scale;
  g.fillStyle = "#fbf7ef";
  g.fillRect(cx - w / 2, cy - h / 2, w, h);
  g.strokeStyle = "#2b2433";
  g.lineWidth = Math.max(1, scale * 0.35);
  g.strokeRect(cx - w / 2, cy - h / 2, w, h);
  g.fillStyle = red ? "#c0392b" : "#2b2433";
  g.font = `700 ${Math.max(7, scale * 3.3)}px ${FONT}`;
  g.fillText(rank, cx, cy - h * 0.16);
  g.fillText(suit, cx, cy + h * 0.24);
}

/** A little dark pill with `text` centred at (`sx`, `sy`). */
function pill(
  g: CanvasRenderingContext2D,
  text: string,
  sx: number,
  sy: number,
  scale: number,
  ink = "#fff3c4",
): void {
  g.font = `700 ${Math.max(7, scale * 3.1)}px ${FONT}`;
  const w = g.measureText(text).width;
  g.fillStyle = "rgba(10, 8, 28, 0.78)";
  g.fillRect(sx - w / 2 - 3, sy - scale * 2.1, w + 6, scale * 4.2);
  g.fillStyle = ink;
  g.fillText(text, sx, sy);
}

export function drawPoker(f: Frame): void {
  const state = hud.get().poker;
  const table = world.map.id === "basement" && state ? pokerTable(world.map) : null;
  if (!state || !table) return;
  const { g } = f;
  const chairs = pokerChairs(world.map);
  const cx = (table.x + table.w / 2) * TILE;
  const cy = (table.y + table.h / 2) * TILE;
  f.labels.push(() => {
    g.save();
    g.textAlign = "center";
    g.textBaseline = "middle";
    // Five slots across the felt; the cards dealt so far sit in the first ones.
    for (const [i, c] of state.board.entries()) {
      const [sx, sy] = f.toScreen(cx + (i - 2) * (CARD_W + 1.2), cy - 2);
      card(g, c, sx, sy, f.scale);
    }
    if (state.pot > 0) {
      const [sx, sy] = f.toScreen(cx, cy + 6);
      pill(g, `🪙 ${state.pot}`, sx, sy, f.scale);
    }
    for (const [i, seat] of state.seats.entries()) {
      const chair = chairs[i];
      if (!seat || !chair) continue;
      const mine = seat.userId === world.selfId;
      const [sx, sy] = f.toScreen(chair.x * TILE + TILE / 2, chair.y * TILE + TILE + 2);
      const turn = state.toAct === i;
      pill(
        g,
        `${state.button === i ? "D " : ""}${seat.stack}${seat.last ? ` · ${seat.last}` : ""}`,
        sx,
        sy,
        f.scale,
        turn ? "#ffd35c" : seat.folded ? "#a7adbb" : mine ? "#8fe3ff" : "#fff3c4",
      );
    }
    g.restore();
  });
}
