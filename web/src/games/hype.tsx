import { secondsUntil } from "@tokenmaxxing/core/format.ts";
import { COUNTDOWN_MS, type HypeView, msToReach, multiplier } from "@tokenmaxxing/core/games/hype.ts";
import { sha256 } from "@tokenmaxxing/core/games/sha256.ts";
import { sortBy } from "hanzio";
import { useEffect, useState } from "react";
import { hud } from "../store.ts";
import type { GameProps } from "./types.ts";

const x = (n: number) => `×${(n / 100).toFixed(2)}`;

/** The server's clock every animation frame while `on`, so the line climbs smoothly; else `now`. */
function useFrameNow(on: boolean, now: number): number {
  const [frame, setFrame] = useState(now);
  useEffect(() => {
    if (!on) return;
    let id = requestAnimationFrame(function tick() {
      setFrame(Date.now() - hud.get().clockSkew);
      id = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(id);
  }, [on]);
  return on ? frame : now;
}

/** Hashing is cheap, but not every frame. */
const checked = new Map<string, boolean>();
const verified = (seed: string, hash: string) => {
  if (!checked.has(seed)) checked.set(seed, sha256(seed) === hash);
  return checked.get(seed)!;
};

export function Hype({ view, you, now, move, name }: GameProps<HypeView>) {
  // The last crash stays up for a moment before the next countdown.
  const next = view.rounds.length - 1;
  const i = next > 0 && now < view.rounds[next]!.startsAt - COUNTDOWN_MS ? next - 1 : next;
  const round = view.rounds[i]!;
  const mine = you === null ? undefined : round.cashed[you];

  return (
    <div className="hype">
      <p className="muted">
        Round {i + 1}/3
        {round.endedAt === null &&
          now < round.startsAt &&
          ` · starts in ${secondsUntil(round.startsAt, now)}…`}
      </p>
      <Live
        round={round}
        now={now}
        canCash={you !== null && mine === undefined && !view.forfeited.includes(you)}
        name={name}
        cashOut={() => move({ cashOut: true })}
      />
      {mine !== undefined && round.endedAt === null && <p>🪂 You cashed out at {x(mine)}. Watch the rest…</p>}
      <table className="hype-scores">
        <thead>
          <tr>
            <th />
            {view.rounds.map((r, j) => (
              <th key={r.hash}>R{j + 1}</th>
            ))}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {sortBy(view.players, { by: (p) => view.totals[p] ?? 0, order: "desc" }).map((p) => (
            <tr key={p} className={p === you ? "me" : undefined}>
              <td>
                {name(p)}
                {view.forfeited.includes(p) && " 🏳️"}
              </td>
              {view.rounds.map((r) => (
                <td key={r.hash}>
                  {r.cashed[p] !== undefined ? `🪂 ${x(r.cashed[p]!)}` : r.endedAt !== null ? "💥" : "…"}
                </td>
              ))}
              <td>
                <strong>{x(view.totals[p] ?? 0)}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <details className="hype-fair">
        <summary className="muted small">🔒 Provably fair</summary>
        <ul className="small">
          {view.rounds.map((r, j) => (
            <li key={r.hash}>
              R{j + 1} hash <code>{r.hash.slice(0, 16)}…</code>
              {r.seed !== null && (
                <>
                  {" "}
                  · seed <code>{r.seed}</code> {verified(r.seed, r.hash) ? "✓" : "✗ doesn't match!"}
                </>
              )}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

/** The only part redrawn every frame while a round runs: the curve, the multiplier and Cash out. */
function Live({
  round,
  now: tickNow,
  canCash,
  name,
  cashOut,
}: {
  round: HypeView["rounds"][number];
  now: number;
  canCash: boolean;
  name: (id: number) => string;
  cashOut: () => void;
}) {
  const on = round.endedAt === null && tickNow >= round.startsAt - 100;
  const now = useFrameNow(on, tickNow);
  const running = round.endedAt === null && now >= round.startsAt;
  const m = running ? multiplier(now - round.startsAt) : null;
  return (
    <>
      <Curve
        startsAt={round.startsAt}
        until={round.endedAt ?? now}
        crashed={round.crash}
        cashed={round.cashed}
        name={name}
      />
      <p className="hype-m">
        {m !== null ? (
          <span>📈 ×{m.toFixed(2)}</span>
        ) : round.crash !== null && round.endedAt !== null ? (
          multiplier(round.endedAt - round.startsAt) * 100 < round.crash - 1 ? (
            <span className="muted">Everyone got out · it would have crashed at {x(round.crash)}</span>
          ) : (
            <span className="crashed">💥 {x(round.crash)}</span>
          )
        ) : (
          <span className="muted">×1.00</span>
        )}
      </p>
      {running && canCash && (
        <button type="button" className="primary hype-cash" onClick={cashOut}>
          🪂 Cash out at ×{m!.toFixed(2)}
        </button>
      )}
    </>
  );
}

const W = 300;
const H = 120;

/** The valuation so far: a line from ×1 climbing on a scale that grows with it. */
function Curve({
  startsAt,
  until,
  crashed,
  cashed,
  name,
}: {
  startsAt: number;
  until: number;
  crashed: number | null;
  cashed: Record<number, number>;
  name: (id: number) => string;
}) {
  const t = Math.max(0, until - startsAt);
  const top = Math.max(2, multiplier(t) * 1.15);
  const span = Math.max(10_000, t * 1.1);
  const px = (ms: number) => (ms / span) * W;
  const py = (mult: number) => H - ((mult - 1) / (top - 1)) * (H - 6);
  const points = Array.from({ length: 41 }, (_, k) => {
    const ms = (t * k) / 40;
    return `${px(ms).toFixed(1)},${py(multiplier(ms)).toFixed(1)}`;
  }).join(" ");
  return (
    <svg
      className={`hype-curve${crashed !== null ? " crashed" : ""}`}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="The valuation"
    >
      <polyline points={points} fill="none" strokeWidth={3} />
      {Object.entries(cashed).map(([p, at]) => (
        <text key={p} x={px(msToReach(at / 100))} y={py(at / 100) - 6} fontSize={10}>
          🪂 {name(Number(p))}
        </text>
      ))}
    </svg>
  );
}
