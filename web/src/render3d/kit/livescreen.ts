/**
 * Live canvas screens: a framed lit panel whose face is repainted from a state object (`set`), whenever the
 * LAN-party mode flips, and (optionally) a few times a second for blinking bits. The net cafe's big
 * screen, wall terminals and tournament board are all built on it; any other screen can be too.
 * Painters here are the 3D twins of `web/src/game/basement.ts` (feed, bracket, terminals).
 */
import { ticks } from "./kit.ts";
import { type Panel, panel } from "./panel.ts";

// ——— LAN party ———
let lan = false;
const lanListeners = new Set<(on: boolean) => void>();

/** Whether the basement is in LAN-party mode (magenta screens, fast neon). */
export const lanParty = (): boolean => lan;

/** Switches LAN-party mode on or off; every screen and light that cares repaints. */
export function setLanParty(on: boolean): void {
  if (on === lan) return;
  lan = on;
  for (const f of lanListeners) f(on);
}

/** The listeners registered since `beginLanScope`, to be released when what they paint is thrown away. */
let lanScope: (() => void)[] | null = null;

/** Calls `fn` whenever LAN-party mode flips; returns the way to stop (a room that is built every visit must). */
export function onLanParty(fn: (on: boolean) => void): () => void {
  lanListeners.add(fn);
  const off = () => {
    lanListeners.delete(fn);
  };
  lanScope?.push(off);
  return off;
}

/** Collects the LAN-party listeners made until `endLanScope`, which returns one function that releases them all. */
export function beginLanScope(): void {
  lanScope = [];
}
export function endLanScope(): () => void {
  const offs = lanScope ?? [];
  lanScope = null;
  return () => {
    for (const off of offs) off();
  };
}

/** Fridays and Saturdays from 18:00 in Aarhus (`core/src/tavern.ts` `isLanParty`). */
export function isLanPartyAt(ms: number = Date.now()): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Copenhagen",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const day = parts.find((p) => p.type === "weekday")?.value;
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  return (day === "Fri" || day === "Sat") && hour >= 18;
}

// ——— The feed ———
/** One live match, as the world tells everyone (`WorldGame` plus the names). */
export interface MatchRow {
  emoji: string;
  name: string;
  headline?: string | null;
  players: string[];
  watchers: number;
  /** Minutes until a timed game ends. */
  endsInMin?: number | null;
}
export interface BracketMatch {
  a: string | null;
  b: string | null;
  winner: "a" | "b" | null;
}
/** The round being played, for the big screen. */
export interface BracketView {
  game: string;
  round: string;
  matches: BracketMatch[];
}
export interface ScreenFeed {
  matches: MatchRow[];
  /** All live matches, if more than `matches` (the "+N more" strip). */
  total?: number;
  /** While a tournament runs, the screen shows its round instead. */
  bracket?: BracketView | null;
}
export const FEED_ROWS = 3;

const FONT = "'Trebuchet MS', 'Segoe UI', Arial, sans-serif";

/** `text`, cut with an ellipsis until it fits `maxW` in the current font. */
export function cut(g: CanvasRenderingContext2D, text: string, maxW: number): string {
  while (text.length > 2 && g.measureText(text).width > maxW) text = `${text.slice(0, -2)}…`;
  return text;
}

const ink = () => (lan ? "#ff7be0" : "#7be0ff");
const rowFill = () => (lan ? "rgba(120, 30, 110, 0.45)" : "rgba(40, 90, 140, 0.4)");

/** The big screen's face: up to three live rows, a "+N more" strip, or the empty state. */
export function paintFeed(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  feed: ScreenFeed,
  t: number,
): void {
  g.fillStyle = "#0e1420";
  g.fillRect(0, 0, w, h);
  g.fillStyle = lan ? "#3a1a44" : "#1d2a44";
  g.fillRect(0, 0, w, 2);
  g.textBaseline = "middle";
  g.textAlign = "left";
  const more = (feed.total ?? feed.matches.length) - FEED_ROWS;
  const strip = more > 0 ? h * 0.16 : 0;
  const rowH = (h - strip) / FEED_ROWS;
  const pad = w * 0.02;
  if (feed.matches.length === 0) {
    g.font = `700 ${rowH * 0.42}px ${FONT}`;
    g.fillStyle = ink();
    g.globalAlpha = 0.55 + 0.25 * Math.sin(t * 2);
    g.fillText("▶ No matches live", pad, rowH * 0.8);
    g.globalAlpha = 0.85;
    g.fillStyle = "#9fb4c8";
    g.font = `500 ${rowH * 0.3}px ${FONT}`;
    g.fillText("Start one at a cabinet", pad, rowH * 1.5);
    g.globalAlpha = 1;
    return;
  }
  for (const [i, m] of feed.matches.slice(0, FEED_ROWS).entries()) {
    const y = i * rowH;
    g.fillStyle = rowFill();
    g.fillRect(2, y + 2, w - 4, rowH - 4);
    g.font = `700 ${rowH * 0.36}px ${FONT}`;
    g.fillStyle = ink();
    const watchers = m.watchers > 0 ? `👀 ${m.watchers}` : "";
    const wW = watchers ? g.measureText(watchers).width : 0;
    g.fillText(cut(g, `${m.emoji} ${m.name}`, w - 2 * pad - wW), pad, y + rowH * 0.3);
    if (watchers) {
      g.textAlign = "right";
      g.fillText(watchers, w - pad, y + rowH * 0.3);
      g.textAlign = "left";
    }
    g.font = `500 ${rowH * 0.27}px ${FONT}`;
    g.fillStyle = "#d6e4f0";
    const head =
      m.endsInMin != null ? `${m.headline ?? "Live"} · ends in ${m.endsInMin}m` : (m.headline ?? "Starting…");
    g.fillText(cut(g, `${head} · ${m.players.join(" vs ")}`, w - 2 * pad), pad, y + rowH * 0.72);
  }
  if (more > 0) {
    const y = FEED_ROWS * rowH;
    g.fillStyle = rowFill();
    g.fillRect(2, y + 2, w - 4, strip - 4);
    g.font = `700 ${strip * 0.6}px ${FONT}`;
    g.fillStyle = ink();
    g.textAlign = "center";
    g.fillText(`+${more} more`, w / 2, y + strip / 2);
    g.textAlign = "left";
  }
}

/** The big screen while a bracket runs: the round being played and its matches. */
export function paintBracketScreen(g: CanvasRenderingContext2D, w: number, h: number, b: BracketView): void {
  g.fillStyle = "#0e1420";
  g.fillRect(0, 0, w, h);
  g.fillStyle = lan ? "#3a1a44" : "#1d2a44";
  g.fillRect(0, 0, w, 2);
  g.textBaseline = "middle";
  g.textAlign = "left";
  const rowH = h / (FEED_ROWS + 1);
  const pad = w * 0.02;
  g.font = `700 ${rowH * 0.55}px ${FONT}`;
  g.fillStyle = ink();
  g.fillText(cut(g, `🏆 ${b.game} · ${b.round}`, w - 2 * pad), pad, rowH * 0.5);
  g.font = `500 ${rowH * 0.45}px ${FONT}`;
  for (const [i, m] of b.matches.slice(0, FEED_ROWS).entries()) {
    const y = (i + 1) * rowH;
    g.fillStyle = rowFill();
    g.fillRect(2, y + 2, w - 4, rowH - 4);
    g.fillStyle = "#d6e4f0";
    const side = (n: string | null, won: boolean) => `${n ?? "…"}${won ? " ✓" : ""}`;
    g.fillText(
      cut(
        g,
        `${side(m.a, m.winner === "a")} vs ${m.b === null ? "bye" : side(m.b, m.winner === "b")}`,
        w - 2 * pad,
      ),
      pad,
      y + rowH * 0.5,
    );
  }
}

/** Paints a feed or, while a tournament runs, its bracket. */
export const paintScreen = (
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  feed: ScreenFeed,
  t: number,
): void => (feed.bracket ? paintBracketScreen(g, w, h, feed.bracket) : paintFeed(g, w, h, feed, t));

// ——— Terminals ———
export interface BoardRow {
  tokens: number;
}
/** The leaderboard terminal: today's top three as gold, silver and bronze bars, no numbers. */
export function paintLeaderboard(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  rows: BoardRow[],
  t: number,
): void {
  g.fillStyle = "#0e1f17";
  g.fillRect(0, 0, w, h);
  scanLines(g, w, h);
  const top = rows.filter((r) => r.tokens > 0).slice(0, 3);
  const best = top[0]?.tokens ?? 1;
  const bh = h * 0.16;
  for (const [i, r] of top.entries()) {
    g.fillStyle = ["#ffd75a", "#cfd6df", "#d49a62"][i]!;
    g.fillRect(w * 0.08, h * 0.16 + i * bh * 1.6, Math.max(2, (r.tokens / best) * w * 0.84), bh);
  }
  if (top.length === 0) idleDot(g, w, h, t);
}

/** The raid terminal: the boss's HP bar, green to red as it falls. `share` is 0-1, or null with no raid. */
export function paintRaid(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  share: number | null,
  t: number,
): void {
  g.fillStyle = "#0e1f17";
  g.fillRect(0, 0, w, h);
  scanLines(g, w, h);
  g.fillStyle = "#12301f";
  g.fillRect(w * 0.08, h * 0.32, w * 0.84, h * 0.36);
  if (share === null) {
    idleDot(g, w, h, t);
    return;
  }
  g.fillStyle = share > 0.5 ? "#3ddc84" : share > 0.2 ? "#f5d14a" : "#e8584f";
  g.fillRect(w * 0.08, h * 0.32, Math.max(2, share * w * 0.84), h * 0.36);
}

function scanLines(g: CanvasRenderingContext2D, w: number, h: number): void {
  g.fillStyle = "#12301f";
  for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1);
}

/** A single dot scanning along the middle: nothing to show. */
function idleDot(g: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  g.fillStyle = "#2f7a4f";
  const n = 8;
  g.fillRect(w * 0.08 + (Math.floor(t * 2) % n) * ((w * 0.84) / n), h * 0.46, (w * 0.84) / n, h * 0.08);
}

// ——— The helper ———
export interface LiveScreen<S> extends Panel {
  state: S;
  /** Replace the state and repaint. */
  set: (state: S) => void;
  /** Repaint with the current state. */
  repaint: () => void;
}

/**
 * A lit, framed screen `w`×`h` world units that paints `paint(g, cw, ch, state, time)` from `state`.
 * `fps` > 0 repaints that often (blinking cursors, scanning dots); it repaints on `set` and when the
 * LAN-party mode flips either way. Its bottom edge is `lift` above the model's origin.
 */
export function liveScreen<S>(
  w: number,
  h: number,
  state: S,
  paint: (g: CanvasRenderingContext2D, cw: number, ch: number, state: S, time: number) => void,
  opts: { px?: number; frame?: string; lift?: number; fps?: number; lit?: boolean; smooth?: boolean } = {},
): LiveScreen<S> {
  const { fps = 0, lit = true, smooth = true } = opts;
  const p = panel(w, h, () => {}, { px: 48, ...opts, lit, smooth }) as LiveScreen<S>;
  let time = 0;
  p.state = state;
  p.repaint = () => p.redraw((g, cw, ch) => paint(g, cw, ch, p.state, time));
  p.set = (s) => {
    p.state = s;
    p.repaint();
  };
  p.repaint();
  p.userData.onDispose = onLanParty(() => p.repaint());
  if (fps > 0) {
    let last = -1;
    ticks.push((t) => {
      time = t;
      const f = Math.floor(t * fps);
      if (f === last) return;
      last = f;
      p.repaint();
    });
  }
  return p;
}
