import { secondsUntil } from "@tokenmaxxing/core/format.ts";
import { gameOf } from "@tokenmaxxing/core/games/index.ts";
import { MAX_SIDE_BET, MAX_STAKE, odds, potShares, SPLITS } from "@tokenmaxxing/core/games/payouts.ts";
import type { Frame, MatchInfo } from "@tokenmaxxing/core/games/wire.ts";
import { sumBy } from "hanzio";
import { useEffect, useState } from "react";
import { lookOf } from "../game/world.ts";
import { COMPONENTS } from "../games/index.ts";
import { arcade, closeMatch, conn, matchConn } from "../net.ts";
import { hud, useHud } from "../store.ts";
import { Chat } from "./Chat.tsx";
import { AvatarImage, Modal, useRun, useTicker } from "./ui.tsx";

const nameIn = (info: MatchInfo) => (id: number) => info.players.find((p) => p.userId === id)?.name ?? "?";

/** The shared frame around every game: players, pot, timer, forfeit, side bets and the end screen. */
export function MatchPanel({ id }: { id: number }) {
  const frame = useHud((s) => s.frame);
  const skew = useHud((s) => s.clockSkew);
  const { error, run } = useRun();
  useTicker(250, !frame?.info.outcome);
  useEffect(() => () => closeMatch(), []);
  if (!frame || frame.info.id !== id)
    return (
      <Modal title="🎮 Game" beside={<Chat match />}>
        Loading…
      </Modal>
    );
  const { info, you } = frame;
  const def = gameOf(info.game)!;
  const Game = COMPONENTS[info.game];
  const now = Date.now() - skew;
  const move = (m: unknown) => void run(() => matchConn!.move(m))();

  return (
    <Modal title={`${def.emoji} ${def.name}`} wide beside={<Chat match />}>
      <div className="match-head">
        <ul className="match-players">
          {info.players.map((p) => (
            <li key={p.userId} className={p.userId === you ? "me" : undefined}>
              <AvatarImage look={lookOf(p.userId)} scale={3} />
              <span>{p.name}</span>
              {info.bets[p.userId] && (
                <small className="muted">
                  🎲 🪙 {info.bets[p.userId]} · ×{odds(betList(frame), p.userId)?.toFixed(1)}
                </small>
              )}
            </li>
          ))}
        </ul>
        <p className="match-pot">
          🪙 <strong>{info.pot}</strong> pot
          {info.players.length > 2 && <small className="muted"> · {SPLITS[info.split]}</small>}
          {frame.watchers > 0 && <small className="muted"> · 👀 {frame.watchers}</small>}
        </p>
      </div>
      {Game ? (
        <Game
          view={frame.view}
          info={info}
          you={you}
          now={now}
          move={move}
          name={nameIn(info)}
          look={lookOf}
        />
      ) : (
        <p>Unknown game.</p>
      )}
      {info.outcome ? (
        <Result frame={frame} run={run} />
      ) : you !== null ? (
        <button type="button" className="danger" onClick={run(() => matchConn!.forfeit())}>
          Forfeit (your stake stays in the pot)
        </button>
      ) : (
        <SideBet frame={frame} now={now} run={run} />
      )}
      {error && <p className="error">{error}</p>}
    </Modal>
  );
}

/** Every side bet so far, as `odds` wants them (just the pools per player matter). */
const betList = (frame: Frame) =>
  Object.entries(frame.info.bets).map(([on, amount]) => ({ userId: 0, on: Number(on), amount }));

type Run = ReturnType<typeof useRun>["run"];

function SideBet({ frame, now, run }: { frame: Frame; now: number; run: Run }) {
  const lobby = useHud((s) => s.lobby);
  const wallet = useHud((s) => s.wallet);
  const [on, setOn] = useState(frame.info.players[0]!.userId);
  const [amount, setAmount] = useState(10);
  const mine = lobby?.me.bets[frame.info.id];
  const left = secondsUntil(frame.info.betsCloseAt, now);
  if (mine) {
    const who = frame.info.players.find((p) => p.userId === mine.on)?.name;
    return (
      <p className="muted">
        You bet 🪙 {mine.amount} on {who}.
      </p>
    );
  }
  if (left <= 0) return <p className="muted small">👀 Watching · side bets are closed.</p>;
  const cap = Math.min(MAX_SIDE_BET, wallet?.balance ?? 0);
  return (
    <form className="side-bet" onSubmit={run(() => arcade.bet(frame.info.id, on, amount))}>
      <span>🎲 Side bet ({left}s left):</span>
      <select aria-label="Who to back" value={on} onChange={(e) => setOn(Number(e.target.value))}>
        {frame.info.players.map((p) => (
          <option key={p.userId} value={p.userId}>
            {p.name}
          </option>
        ))}
      </select>
      <input
        type="number"
        aria-label="Coins"
        min={1}
        max={cap}
        value={amount}
        onChange={(e) => setAmount(Math.max(1, Math.min(cap, Number(e.target.value))))}
      />
      <button type="submit" className="primary" disabled={cap < 1}>
        Bet 🪙 {amount}
      </button>
    </form>
  );
}

/** Who won what, then double or nothing (1v1) and the way back. */
function Result({ frame, run }: { frame: Frame; run: Run }) {
  const { info, you } = frame;
  const outcome = info.outcome!;
  const name = nameIn(info);
  if ("void" in outcome)
    return (
      <div className="match-result">
        <p>{outcome.void} Everyone got their coins back.</p>
      </div>
    );
  const shares = potShares(outcome.places, info.pot, info.split);
  const medals = ["🥇", "🥈", "🥉"];
  const back = () => {
    void conn.back();
    hud.set({ panel: null });
  };
  return (
    <div className="match-result">
      <ol>
        {outcome.places.map((group, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: places are fixed once the game is over
          <li key={i}>
            {medals[i] ?? `${i + 1}.`} {group.map(name).join(" & ")}
            {group.map((id) => shares.get(id) ?? 0).some((n) => n > 0) && (
              <strong> +🪙 {sumBy(group, (id) => shares.get(id))}</strong>
            )}
          </li>
        ))}
      </ol>
      {you !== null && (
        <div className="row-actions">
          {info.players.length === 2 && (
            <button type="button" className="primary" onClick={run(() => arcade.rematch(info.id))}>
              {info.stake > 0
                ? `🔁 Double or nothing · 🪙 ${Math.min(MAX_STAKE, info.stake * 2)}`
                : "🔁 Rematch"}
            </button>
          )}
          <button type="button" onClick={back}>
            ↩ Back to where I was
          </button>
        </div>
      )}
    </div>
  );
}
