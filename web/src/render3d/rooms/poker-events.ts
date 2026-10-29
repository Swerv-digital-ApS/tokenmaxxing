import { BIG_BLIND, type PokerState, SMALL_BLIND } from "@tokenmaxxing/core/poker.ts";
import * as THREE from "three";
import { hud } from "../../store.ts";
import type { PokerModel, PokerScene } from "./poker3d.ts";
import type { LiveFrame } from "./rooms.ts";

const v = new THREE.Vector3();

/** The felt's picture of the table the server sent (`hud.poker`): what the chips and cards on it show. */
export function sceneOf(state: PokerState | null): PokerScene {
  if (!state) return { board: [], pot: 0, seats: [] };
  const bets = state.seats.reduce((n, s) => n + (s?.bet ?? 0), 0);
  // After a showdown the hands that were shown lie face up until the next deal.
  const shown = state.street === null ? state.result?.shown : undefined;
  return {
    board: state.street === null ? (state.result?.board ?? []) : state.board,
    pot: state.pot - bets,
    seats: state.seats.map((s, i) =>
      s
        ? {
            stack: s.stack,
            bet: s.bet,
            dealt: s.cards && !s.folded,
            shown: shown?.find((h) => h.userId === s.userId)?.hole ?? null,
            dealer: state.button === i && (state.street !== null || state.result !== null),
          }
        : null,
    ),
  };
}

/** A line over a seat: who sits there, their stack and what they did last, or the clock when it's their turn. */
function seatText(state: PokerState, i: number, left: number): string {
  const s = state.seats[i]!;
  const tail = state.toAct === i ? `⏱ ${left}s` : (s.last ?? "");
  return `${state.names[s.userId] ?? "?"} · 🪙 ${s.stack}${tail ? ` · ${tail}` : ""}`;
}

/** What the table says about the hand: the pot, the street, or who won with what. */
export function tableText(state: PokerState): string {
  const r = state.result;
  if (state.street === null && r) {
    const wins = Object.entries(r.won).map(([id, n]) => {
      const hand = r.shown.find((s) => s.userId === Number(id))?.name;
      return `${state.names[Number(id)] ?? "?"} wins 🪙 ${n}${hand ? ` · ${hand}` : ""}`;
    });
    return wins.join(" · ");
  }
  return state.street === null
    ? `🃏 Poker · ${SMALL_BLIND}/${BIG_BLIND}`
    : `Pot 🪙 ${state.pot} · ${state.street}`;
}

/**
 * The net cafe's poker table, live: the cards and chips on the felt, a line over each seated player (name, stack,
 * last move, the clock) and one over the table (the pot, or who won). All from the server's `poker` events.
 */
export class PokerEvents {
  private readonly seats: HTMLDivElement[] = [];
  private pot: HTMLDivElement | null = null;
  private readonly text = new Map<HTMLElement, string>();

  constructor(private readonly table: PokerModel | null) {}

  private say(el: HTMLElement, text: string, cls: string): void {
    if (this.text.get(el) === text) return;
    this.text.set(el, text);
    el.textContent = text;
    el.className = `label r3-sign ${cls}`;
  }

  update(f: LiveFrame): void {
    const { table } = this;
    if (!table) return;
    const state = hud.get().poker;
    table.show(sceneOf(state));
    const seated = state?.seats.some((s) => s !== null) ?? false;
    if (!state || !seated) {
      for (const el of [...this.seats, this.pot]) if (el) el.style.display = "none";
      return;
    }
    const left = Math.max(0, Math.ceil((state.turnMs - (Date.now() - state.at)) / 1000));
    for (const [i, s] of state.seats.entries()) {
      const el = this.seats[i] ?? f.overlay.make("r3-sign");
      this.seats[i] = el;
      if (!s) {
        el.style.display = "none";
        continue;
      }
      const turn = state.toAct === i;
      this.say(el, seatText(state, i, left), turn ? "gold" : s.folded ? "dim" : "dark");
      table.seatWorld(i, v);
      v.y += 1.7;
      f.overlay.place(el, v, f.camera, 0, -30, true);
    }
    this.pot = this.pot ?? f.overlay.make("r3-sign");
    this.say(this.pot, tableText(state), state.street === null && state.result ? "gold" : "dark");
    table.centreWorld(v);
    f.overlay.place(this.pot, v, f.camera, 0, 22, true);
  }

  dispose(): void {
    for (const el of [...this.seats, this.pot]) el?.remove();
    this.seats.length = 0;
    this.pot = null;
    this.text.clear();
  }
}
