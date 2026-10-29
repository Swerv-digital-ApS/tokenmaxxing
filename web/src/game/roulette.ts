import { colorOf, SPIN_MS } from "@tokenmaxxing/core/roulette.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { hud } from "../store.ts";
import type { Frame } from "./frame.ts";
import { FONT } from "./labels.ts";
import { world } from "./world.ts";

/**
 * The net cafe's roulette table in the 2D room (`basement` only), all from `hud.roulette`: the table lit while
 * someone plays, a chip stack by each player, the last pocket on a disc above the table (then the recent ones as
 * dots) and a "+120"/"-30" over the player when their spin lands. Nothing without a table state.
 */

const BADGE_MS = 8000;
const FLOAT_MS = 2200;
const PLAYER = ["#e9b73d", "#4aa3ff", "#c46bff", "#ff8a4a", "#4ade80", "#f472b6", "#22d3ee", "#a3e635"];
const DISC = { red: "#c0392b", black: "#1d1b26", green: "#1f8f4e" } as const;

/** The spin last seen and when its ball lands on this client (it arrived `SPIN_MS` before). */
let seenId = 0;
let landsAt = 0;

export function drawRoulette(f: Frame): void {
  const state = hud.get().roulette;
  if (world.map.id !== "basement" || !state) return;
  const tiles = world.map.find("♦");
  if (tiles.length === 0) return;
  const xs = tiles.map(([x]) => x);
  const ys = tiles.map(([, y]) => y);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const w = Math.max(...xs) - x0 + 1;
  const h = Math.max(...ys) - y0 + 1;
  const spots = world.map
    .find("♥")
    .map(([x, y]) => ({ x, y }))
    .sort((a, b) => a.x - b.x || a.y - b.y);
  const { g } = f;
  const now = Date.now();
  const last = state.last;
  if (last && last.id !== seenId) {
    // The ball lands `SPIN_MS` after the server rolled; the server's clock ran ahead of ours by `now - at`.
    landsAt = state.at - (state.now - (last.at + SPIN_MS));
    seenId = last.id;
  }
  const since = now - landsAt;
  f.labels.push(() => {
    g.save();
    g.textAlign = "center";
    g.textBaseline = "middle";
    if (state.seats.length > 0) {
      const [sx, sy] = f.toScreen(x0 * TILE, y0 * TILE);
      const [ex, ey] = f.toScreen((x0 + w) * TILE, (y0 + h) * TILE);
      g.fillStyle = `rgba(80, 255, 160, ${0.1 + 0.05 * Math.sin(now / 400)})`;
      g.fillRect(sx, sy, ex - sx, ey - sy);
    }
    for (const seat of state.seats) {
      const spot = spots[seat.spot];
      if (!spot) continue;
      const [sx, sy] = f.toScreen(spot.x * TILE + TILE - 1, spot.y * TILE + TILE - 2);
      const chips = state.players.find((p) => p.userId === seat.userId)?.bets.length ? 3 : 1;
      for (let i = 0; i < chips; i++) {
        g.fillStyle = PLAYER[seat.spot % PLAYER.length]!;
        g.strokeStyle = "#1d1b26";
        g.lineWidth = 1;
        g.beginPath();
        g.ellipse(sx, sy - i * f.scale * 0.9, f.scale * 1.7, f.scale * 0.9, 0, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }
    }
    // The result badge above the table, once the ball lands; the recent pockets as dots after.
    const [bx, by] = f.toScreen((x0 + w / 2) * TILE, (y0 - 0.45) * TILE);
    if (last && since >= 0 && since < BADGE_MS) {
      g.fillStyle = DISC[last.color];
      g.strokeStyle = "#fff3c4";
      g.lineWidth = Math.max(1, f.scale * 0.4);
      g.beginPath();
      g.arc(bx, by, f.scale * 3.4, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = "#fff";
      g.font = `700 ${Math.max(8, f.scale * 3.6)}px ${FONT}`;
      g.fillText(String(last.pocket), bx, by + 0.5);
    } else if (state.phase === "betting" || state.phase === "spinning") {
      const secs = Math.ceil(Math.max(0, state.phaseEndsAt - (state.now + (now - state.at))) / 1000);
      const text = state.phase === "betting" ? `Bets ${secs}s` : "No more bets";
      g.font = `700 ${Math.max(8, f.scale * 3.1)}px ${FONT}`;
      const tw = g.measureText(text).width;
      g.fillStyle = "rgba(10, 8, 28, 0.78)";
      g.fillRect(bx - tw / 2 - 4, by - f.scale * 2.4, tw + 8, f.scale * 4.8);
      g.fillStyle = state.phase === "betting" ? "#ffd35c" : "#fff3c4";
      g.fillText(text, bx, by);
    } else {
      const dots = state.history.slice(0, 6);
      for (const [i, n] of dots.entries()) {
        g.fillStyle = DISC[colorOf(n)];
        g.beginPath();
        g.arc(bx + (i - (dots.length - 1) / 2) * f.scale * 2.6, by, f.scale * 1.0, 0, Math.PI * 2);
        g.fill();
      }
    }
    // Each player's win or loss floating up from their head as the ball lands.
    if (last && since >= 0 && since < FLOAT_MS) {
      const t = since / FLOAT_MS;
      g.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      for (const o of last.results) {
        const seat = state.seats.find((s) => s.userId === o.userId);
        const spot = seat && spots[seat.spot];
        if (!spot) continue;
        const net = o.payout - o.staked;
        const [sx, sy] = f.toScreen(spot.x * TILE + TILE / 2, spot.y * TILE - 4);
        g.fillStyle = net > 0 ? "#7dffa0" : net < 0 ? "#ff8a8a" : "#fff3c4";
        g.strokeStyle = "#0a081c";
        g.lineWidth = 3;
        g.font = `800 ${Math.max(9, f.scale * 4)}px ${FONT}`;
        const text = `${net > 0 ? "+" : ""}${net}`;
        const y = sy - t * f.scale * 8;
        g.strokeText(text, sx, y);
        g.fillText(text, sx, y);
      }
    }
    g.restore();
  });
}
