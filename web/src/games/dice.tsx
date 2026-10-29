import { secondsUntil } from "@tokenmaxxing/core/format.ts";
import { type DiceView, FACES } from "@tokenmaxxing/core/games/dice.ts";
import { sumBy } from "hanzio";
import { useState } from "react";
import type { GameProps } from "./types.ts";

const CLAIMABLE = [2, 3, 4, 5, 6];

export function Dice({ view, info, you, now, move, name }: GameProps<DiceView>) {
  const last = view.claims.at(-1);
  const onTable = sumBy(Object.values(view.counts), (n) => n);
  const myTurn = you === view.turn && !view.reveal && !info.outcome;
  const seconds = secondsUntil(view.deadline, now);
  const r = view.reveal;

  return (
    <div className="dice">
      <ul className="dice-players">
        {view.players.map((p) => (
          <li key={p} className={`${p === view.turn && !r ? "turn" : ""}${p === you ? " me" : ""}`}>
            <strong>{name(p)}</strong>
            <span>{view.out.includes(p) ? "💀 out" : `🎲 ${view.counts[p]}`}</span>
            {r ? (
              <span className="dice-row">
                {(r.dice[p] ?? []).map((d, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: dice have no identity
                  <span key={i} className={d === r.claim.face || d === 1 ? "hit" : "miss"}>
                    {FACES[d]}
                  </span>
                ))}
              </span>
            ) : (
              p === view.turn && <small className="muted">{seconds}s</small>
            )}
          </li>
        ))}
      </ul>
      {r ? (
        <p className="dice-verdict">
          {r.caller !== null && `${name(r.caller)}: "Liar!" `}
          {name(r.claim.player)} said {r.claim.count}× {FACES[r.claim.face]}; there were{" "}
          <strong>{r.actual}</strong>. {name(r.loser)} loses a die.
        </p>
      ) : last ? (
        <p className="dice-claim">
          {name(last.player)} says: at least <strong>{last.count}×</strong>{" "}
          <span className="big">{FACES[last.face]}</span>
        </p>
      ) : (
        <p className="muted">{name(view.turn)} opens the bidding. 🦄 are wild.</p>
      )}
      {view.mine && view.mine.length > 0 && (
        <p className="dice-mine">
          Your dice:{" "}
          {view.mine.map((d, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: dice have no identity
            <span key={i} className="big">
              {FACES[d]}
            </span>
          ))}
        </p>
      )}
      {myTurn && <Bid last={last} max={onTable} move={move} />}
      {!myTurn && !r && !info.outcome && (
        <p className="muted small">
          Waiting for {name(view.turn)} ({seconds}s)…
        </p>
      )}
      {view.claims.length > 1 && (
        <ol className="dice-claims muted small">
          {view.claims.slice(0, -1).map((c, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: claims are only ever appended
            <li key={i}>
              {name(c.player)}: {c.count}× {FACES[c.face]}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Bid({
  last,
  max,
  move,
}: {
  last: DiceView["claims"][number] | undefined;
  max: number;
  move: (m: unknown) => void;
}) {
  const [count, setCount] = useState(last ? last.count : 1);
  const [face, setFace] = useState(last ? Math.min(6, last.face + 1) : 2);
  const valid = !last || count > last.count || (count === last.count && face > last.face);
  return (
    <div className="dice-bid">
      <span className="counter">
        <button type="button" aria-label="Fewer" onClick={() => setCount(Math.max(1, count - 1))}>
          −
        </button>
        <strong>{count}×</strong>
        <button type="button" aria-label="More" onClick={() => setCount(Math.min(max, count + 1))}>
          ＋
        </button>
      </span>
      <span className="stakes">
        {CLAIMABLE.map((f) => (
          <button
            key={f}
            type="button"
            className="choice"
            aria-pressed={f === face}
            onClick={() => setFace(f)}
          >
            {FACES[f]}
          </button>
        ))}
      </span>
      <button type="button" className="primary" disabled={!valid} onClick={() => move({ count, face })}>
        Claim {count}× {FACES[face]}
      </button>
      {last && (
        <button type="button" className="danger" onClick={() => move({ liar: true })}>
          🫵 Liar!
        </button>
      )}
    </div>
  );
}
