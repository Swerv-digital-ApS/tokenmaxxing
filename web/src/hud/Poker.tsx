import {
  BIG_BLIND,
  type Card,
  cardFace,
  describe,
  evaluate,
  type Legal,
  type PokerState,
  SEATS,
  type SeatView,
  SMALL_BLIND,
  TURN_MS,
} from "@tokenmaxxing/core/poker.ts";
import { useState } from "react";
import { world } from "../game/world.ts";
import { conn } from "../net.ts";
import { useHud } from "../store.ts";
import { useTicker } from "./ui.tsx";

/** One card, face up (`cardFace`), or face down with no card. */
export function PokerCard({ card, small }: { card?: Card; small?: boolean }) {
  const cls = `pk-card${small ? " small" : ""}`;
  if (card === undefined) return <span className={`${cls} back`} role="img" aria-label="Card face down" />;
  const { rank, suit, red } = cardFace(card);
  return (
    <span className={`${cls}${red ? " red" : ""}`} role="img" aria-label={`${rank} of ${suit}`}>
      <b>{rank}</b>
      {suit}
    </span>
  );
}

/** What the table says happened, in a line: "Ada wins 45 with Pair of Aces". */
export function resultLine(poker: PokerState): string | null {
  const r = poker.result;
  if (!r) return null;
  const name = (id: number) => poker.names[id] ?? "Someone";
  return Object.entries(r.won)
    .map(([id, n]) => {
      const hand = r.shown.find((s) => s.userId === Number(id))?.name;
      return `${name(Number(id))} wins 🪙 ${n}${hand ? ` with ${hand}` : ""}`;
    })
    .join(" · ");
}

export const STREETS = { preflop: "Pre-flop", flop: "Flop", turn: "Turn", river: "River" } as const;

/**
 * One chair round the felt, at place `pos` (0 is the bottom, where you sit, then on round the way the deal
 * goes): name, stack, last move or what they won, their cards, the bet in front of them, the dealer's button and
 * the clock when it's their turn. An empty chair is a dashed outline.
 */
function SeatSpot({
  seat,
  poker,
  at,
  pos,
  me,
  clock,
}: {
  seat: SeatView | null;
  poker: PokerState;
  at: number;
  pos: number;
  me: boolean;
  clock: number;
}) {
  if (!seat)
    return (
      <div className={`pk-seat pk-at-${pos} empty`}>
        <div className="pk-plate">Open seat</div>
      </div>
    );
  const turn = poker.toAct === at;
  const ended = poker.street === null ? poker.result : null;
  const won = ended?.won[seat.userId] ?? 0;
  const shown = ended?.shown.find((h) => h.userId === seat.userId);
  const cls = [
    "pk-seat",
    `pk-at-${pos}`,
    turn && "turn",
    seat.folded && "folded",
    me && "mine",
    won > 0 && "won",
  ]
    .filter(Boolean)
    .join(" ");
  const line = won > 0 ? `+${won}${shown ? ` · ${shown.name}` : ""}` : seat.allIn ? "all in" : seat.last;
  return (
    <div className={cls}>
      <div className="pk-plate">
        <span className="pk-name">{me ? "You" : (poker.names[seat.userId] ?? "?")}</span>
        <span className="pk-stack">
          🪙 {seat.stack}
          {!me && (shown || (seat.cards && !seat.folded)) && (
            <span className="pk-minis">
              {shown ? (
                shown.hole.map((c) => <PokerCard key={c} card={c} small />)
              ) : (
                <>
                  <PokerCard small />
                  <PokerCard small />
                </>
              )}
            </span>
          )}
        </span>
        <span className="pk-last">
          {line ?? (seat.ready ? " " : "buying in…")}
          {seat.leaving ? " · leaving" : ""}
        </span>
        {turn && <span className="pk-clock" style={{ width: `${clock * 100}%` }} />}
        {poker.button === at && (poker.street !== null || ended) && (
          <span className="pk-dealer" title="Dealer">
            D
          </span>
        )}
      </div>
      {seat.bet > 0 && <span className="pk-bet">🪙 {seat.bet}</span>}
    </div>
  );
}

/** Fold, check or call, and the raise: a slider from the least to all-in, nudged in big blinds. Fresh for every change to the table, so a raise starts at its least. */
function Moves({
  legal,
  bet,
  pot,
  act,
}: {
  legal: Legal;
  bet: number;
  pot: number;
  act: (type: string, to?: number) => Promise<void>;
}) {
  const [raiseTo, setRaiseTo] = useState(legal.minTo);
  const to = Math.max(legal.minTo, Math.min(raiseTo, legal.maxTo));
  return (
    <div className="pk-moves">
      <button type="button" className="pk-fold" onClick={() => void act("fold")}>
        Fold
      </button>
      {legal.canCheck ? (
        <button type="button" className="go" onClick={() => void act("check")}>
          Check
        </button>
      ) : (
        <button type="button" className="go" onClick={() => void act("call")}>
          Call 🪙 {legal.toCall}
        </button>
      )}
      {legal.canRaise && (
        <div className="pk-raise">
          <button
            type="button"
            aria-label="Less"
            onClick={() => setRaiseTo(Math.max(legal.minTo, to - BIG_BLIND))}
          >
            −
          </button>
          <input
            type="range"
            aria-label="Raise to"
            min={legal.minTo}
            max={legal.maxTo}
            step={1}
            value={to}
            onChange={(e) => setRaiseTo(Number(e.target.value))}
          />
          <button
            type="button"
            aria-label="More"
            onClick={() => setRaiseTo(Math.min(legal.maxTo, to + BIG_BLIND))}
          >
            +
          </button>
          <button type="button" onClick={() => setRaiseTo(legal.minTo)}>
            Min
          </button>
          <button type="button" onClick={() => setRaiseTo(Math.min(legal.maxTo, Math.max(legal.minTo, pot)))}>
            Pot
          </button>
          <button type="button" onClick={() => setRaiseTo(legal.maxTo)}>
            All in
          </button>
          <button type="button" className="go" onClick={() => void act("raise", to)}>
            {bet === 0 ? "Bet" : "Raise to"} 🪙 {to}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The poker table, docked while you sit at it: the felt with the board and the pot, all six chairs round it
 * (you at the bottom), your two cards and what they make, the clock and the moves. The server decides
 * everything; the buttons only ask (`pokerAct`).
 */
export function Poker() {
  const poker = useHud((s) => s.poker);
  const hole = useHud((s) => s.pokerHole);
  const [problem, setProblem] = useState<string | null>(null);
  const mine = poker?.seats.findIndex((s) => s?.userId === world.selfId) ?? -1;
  const seat = poker && mine >= 0 ? poker.seats[mine]! : null;
  const turn = !!poker && poker.toAct === mine && !seat?.leaving;
  const legal = turn ? poker!.legal : null;
  useTicker(250, !!poker && mine >= 0);
  if (!poker || !seat || seat.leaving) return null;

  const since = Date.now() - poker.at;
  const turnLeft = Math.max(0, poker.turnMs - since);
  const turnS = Math.ceil(turnLeft / 1000);
  const nextS = Math.max(0, Math.ceil((poker.nextMs - since) / 1000));
  const act = async (type: string, to = 0) => setProblem(await conn.pokerAct(type, to));
  const pot = poker.pot;
  const seated = poker.seats.filter((s) => s !== null).length;
  const status = turn
    ? `Your move · ${turnS}s`
    : poker.street === null
      ? seated < 2
        ? "Waiting for players"
        : poker.nextMs > 0
          ? `Next hand in ${nextS}s`
          : "Dealing…"
      : !seat.inHand
        ? "Watching: you're in on the next hand"
        : seat.folded
          ? "You folded"
          : seat.allIn
            ? "You're all in"
            : poker.toAct >= 0
              ? `${poker.names[poker.seats[poker.toAct]?.userId ?? 0] ?? "…"} to act`
              : "…";
  const result = poker.street === null ? resultLine(poker) : null;
  const made =
    hole.length === 2 && poker.board.length >= 3 ? describe(evaluate([...hole, ...poker.board])) : null;

  return (
    <section className="panel poker" aria-label="Poker table">
      <header>
        <strong className="title">
          🃏 Hold'em · {SMALL_BLIND}/{BIG_BLIND}
        </strong>
        <span className={turn ? "pk-status mine" : "pk-status"} role="status">
          {status}
        </span>
        <button type="button" onClick={() => void conn.pokerLeave().then(setProblem)}>
          Leave table
        </button>
      </header>
      <div className="pk-table">
        <div className="pk-felt">
          <div className="pk-cards">
            {[0, 1, 2, 3, 4].map((i) =>
              poker.board[i] === undefined ? (
                <span key={i} className="pk-card empty" />
              ) : (
                <PokerCard key={i} card={poker.board[i]} />
              ),
            )}
          </div>
          {result ? (
            <p className="pk-result">{result}</p>
          ) : (
            <div className="pk-pot">
              Pot 🪙 {pot}
              {poker.street && <span className="muted small"> · {STREETS[poker.street]}</span>}
            </div>
          )}
        </div>
        {/* Seat `mine` at the bottom, the rest on round the way the deal goes. */}
        {Array.from({ length: SEATS }, (_, pos) => {
          const at = (mine + pos) % SEATS;
          return (
            <SeatSpot
              key={at}
              seat={poker.seats[at] ?? null}
              poker={poker}
              at={at}
              pos={pos}
              me={pos === 0}
              clock={turnLeft / TURN_MS}
            />
          );
        })}
      </div>
      <div className="pk-foot">
        {hole.length === 2 && (
          <div className="pk-hand">
            {hole.map((c) => (
              <PokerCard key={c} card={c} />
            ))}
            {made && <span className="pk-made">{made}</span>}
          </div>
        )}
        {legal && <Moves key={poker.v} legal={legal} bet={poker.bet} pot={pot} act={act} />}
      </div>
      {problem && (
        <p className="error small" role="alert">
          {problem}
        </p>
      )}
    </section>
  );
}
