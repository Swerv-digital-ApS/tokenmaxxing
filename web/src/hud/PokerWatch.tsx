import { BIG_BLIND, SEATS, SMALL_BLIND } from "@tokenmaxxing/core/poker.ts";
import { send } from "../game/input.ts";
import { world } from "../game/world.ts";
import { conn } from "../net.ts";
import { hud, useHud } from "../store.ts";
import { PokerCard, resultLine, STREETS } from "./Poker.tsx";
import { Modal } from "./ui.tsx";

/**
 * A read-only view of the net cafe's poker table: who sits where with their stack and bet, the board, the pot
 * and whose turn it is. Only the cards the server shows everyone (the showdown) are ever face up.
 */
export function PokerWatch() {
  const poker = useHud((s) => s.poker);
  if (!poker) return <Modal title="🃏 Poker">The table is quiet.</Modal>;
  const mine = poker.seats.some((s) => s?.userId === world.selfId);
  const free = poker.seats.filter((s) => s === null).length;
  const name = (id: number) => (id === world.selfId ? "You" : (poker.names[id] ?? "Someone"));
  const result = poker.street === null ? resultLine(poker) : null;
  const turn = poker.toAct >= 0 ? poker.seats[poker.toAct] : null;
  return (
    <Modal title={`🃏 Hold'em · ${SMALL_BLIND}/${BIG_BLIND} · watching`} wide="xl">
      <div className="rl-bar">
        <span className="muted small">
          {SEATS - free}/{SEATS} seated
        </span>
        {!mine && free > 0 && (
          <button
            type="button"
            className="primary"
            onClick={() => {
              hud.set({ panel: null });
              send(conn.pokerJoin());
            }}
          >
            Join the table
          </button>
        )}
        <button type="button" className="shop-leave" onClick={() => hud.set({ panel: null })}>
          Close
        </button>
      </div>
      <div className="pk-cards">
        {[0, 1, 2, 3, 4].map((i) =>
          poker.board[i] === undefined ? (
            <span key={i} className="pk-card empty" />
          ) : (
            <PokerCard key={i} card={poker.board[i]} />
          ),
        )}
      </div>
      <p>
        {result ?? (
          <>
            Pot 🪙 {poker.pot}
            {poker.street && <span className="muted small"> · {STREETS[poker.street]}</span>}
          </>
        )}
      </p>
      {turn && <p className="small">{name(turn.userId)} to act</p>}
      <ul className="rl-seats">
        {poker.seats.map((s, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: seats are fixed places.
          <li key={i} className={s ? "" : "muted"}>
            {s ? (
              <>
                <strong>{name(s.userId)}</strong> · 🪙 {s.stack}
                {s.bet > 0 && ` · bet ${s.bet}`}
                {s.allIn ? " · all in" : s.folded ? " · folded" : s.last ? ` · ${s.last}` : ""}
                {poker.button === i && " · D"}
                {s.leaving && " · leaving"}
                {poker.toAct === i && " ◀"}
              </>
            ) : (
              "Open seat"
            )}
          </li>
        ))}
      </ul>
    </Modal>
  );
}
