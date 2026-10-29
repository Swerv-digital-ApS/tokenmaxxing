import { clock, compact } from "@tokenmaxxing/core/format.ts";
import type { TokenmaxxingView } from "@tokenmaxxing/core/games/tokenmaxxing.ts";
import { clamp, sortBy, typedSwitch } from "hanzio";
import { AvatarImage } from "../hud/ui.tsx";
import type { GameProps } from "./types.ts";

const COLORS = ["#ffd35c", "#8fe3ff", "#ff8fb1", "#3ddc84", "#c39bff", "#ffa94d", "#6fb8ff", "#e9ecef"];

/** Tokens in the last minute, from a player's history. */
function lastMinute(points: [number, number][], now: number): number {
  const latest = points.at(-1)?.[1] ?? 0;
  const before = [...points].reverse().find(([t]) => t <= now - 60_000)?.[1] ?? points[0]?.[1] ?? 0;
  return latest - before;
}

export function Tokenmaxxing({ view, you, now, name, look }: GameProps<TokenmaxxingView>) {
  const ranked = sortBy(view.players, { by: (p) => view.tokens[p] ?? 0, order: "desc" });
  const top = Math.max(1, view.tokens[ranked[0]!] ?? 0);
  const color = (p: number) => COLORS[view.players.indexOf(p) % COLORS.length]!;
  const minutes = Math.max(1, (Math.min(now, view.endsAt) - view.startsAt) / 60_000);
  const surge = ranked
    .map((p) => ({ p, n: lastMinute(view.history[p] ?? [], now) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)[0];

  return (
    <div className="tmx">
      <p className="tmx-clock">
        {typedSwitch(view.phase, {
          countdown: () => `🏁 Starts in ${clock(view.startsAt - now)}: fire up your agents`,
          live: () => `⏱ ${clock(view.endsAt - now)} left`,
          grace: () => `⏳ Counting the last tokens… ${clock(view.graceUntil - now)}`,
          over: () => "🏁 Final",
        })}
      </p>
      {view.phase === "live" && surge && (
        <p className="tmx-surge">
          🔥 {name(surge.p)} +{compact(surge.n)} in the last minute
        </p>
      )}
      <ol className="tmx-lines">
        {ranked.map((p, i) => (
          <li key={p} className={p === you ? "me" : undefined}>
            <span className="tmx-rank">{i === 0 && view.tokens[p] ? "👑" : i + 1}</span>
            <AvatarImage look={look(p)} scale={2} />
            <span className="tmx-who">
              <span>
                <strong>{name(p)}</strong>
                {view.flagged.includes(p) && <span title="Some minute went over the cap"> ⚠️</span>}
                {view.forfeited.includes(p) && " 🏳️"}
              </span>
              <span className="lb-bar">
                <span style={{ width: `${((view.tokens[p] ?? 0) / top) * 100}%`, background: color(p) }} />
              </span>
            </span>
            <span className="tmx-num">
              <strong>{compact(view.tokens[p] ?? 0)}</strong>
              <small className="muted">{compact((view.tokens[p] ?? 0) / minutes)}/min</small>
            </span>
          </li>
        ))}
      </ol>
      <Chart view={view} color={color} now={now} />
      {you !== null && view.phase !== "over" && (
        <p className="muted small">
          Your tokens count from the menu bar app: keep it running. It syncs every 10 seconds during a battle.
        </p>
      )}
    </div>
  );
}

const W = 320;
const H = 110;

/** Cumulative tokens per player over the battle, as plain SVG. */
function Chart({ view, color, now }: { view: TokenmaxxingView; color: (p: number) => string; now: number }) {
  const span = view.endsAt - view.startsAt;
  const until = clamp(now, view.startsAt, view.endsAt);
  const top = Math.max(1, ...Object.values(view.tokens));
  const x = (t: number) => ((Math.min(t, view.endsAt) - view.startsAt) / span) * W;
  const y = (n: number) => H - (n / top) * (H - 4);
  return (
    <svg className="tmx-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Tokens over the battle">
      {view.players.map((p) => {
        const points = [...(view.history[p] ?? []), [until, view.tokens[p] ?? 0] as [number, number]];
        return (
          <polyline
            key={p}
            points={points.map(([t, n]) => `${x(t).toFixed(1)},${y(n).toFixed(1)}`).join(" ")}
            fill="none"
            stroke={color(p)}
            strokeWidth={2}
          />
        );
      })}
    </svg>
  );
}
