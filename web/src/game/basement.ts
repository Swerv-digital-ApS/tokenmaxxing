import { GAMES } from "@tokenmaxxing/core/games/index.ts";
import { CABINET_GAMES, isLanParty } from "@tokenmaxxing/core/tavern.ts";
import { roundName, type TournamentView } from "@tokenmaxxing/core/tournament.ts";
import { TILE, type WorldGame } from "@tokenmaxxing/core/world.ts";
import { SCREEN_GLASS, SCREEN_H, TERMINAL_GLASS } from "../art/basement.ts";
import { hash } from "../art/pixels.ts";
import { openMatch, refreshTournament } from "../net.ts";
import { hud } from "../store.ts";
import type { Frame } from "./frame.ts";
import { gameHits } from "./games.ts";
import { drawGlow, flicker } from "./glow.ts";
import { FONT } from "./labels.ts";
import { drawPoker } from "./poker.ts";
import { left } from "./raid.ts";
import { drawRoulette } from "./roulette.ts";
import { skyNow } from "./sky.ts";
import { serverNow, world } from "./world.ts";

/**
 * The basement net cafe (`basement` only): the big screen's live feed of matches, the wall terminals'
 * live values, the cabinets, and the room's lighting. Nothing here reads a match's state: the screen shows
 * only what the world already tells everyone (`WorldGame`: game, headline, players, watchers).
 */

/** Matches the big screen lists. */
export const FEED_ROWS = 3;

/** The matches on the screen: oldest first, so a row stays where it is while others come and go. */
export const feed = (games: Iterable<WorldGame>): WorldGame[] =>
  [...games].sort((a, b) => a.id - b.id).slice(0, FEED_ROWS);

/** Where the screen's glass is, in world pixels: the left of the run of `E` tiles. */
function glass(): { x: number; y: number; w: number; h: number } | null {
  const tiles = world.map.find("E");
  if (!tiles.length) return null;
  const [tx, ty] = tiles[0]!;
  return {
    x: tx * TILE + SCREEN_GLASS.x,
    y: ty * TILE + TILE - SCREEN_H + SCREEN_GLASS.y,
    w: SCREEN_GLASS.w,
    h: SCREEN_GLASS.h,
  };
}

const namesOf = (game: WorldGame): string[] => {
  const info = hud.get().lobby?.matches.find((m) => m.id === game.id);
  return game.players.map(
    (id) => info?.players.find((p) => p.userId === id)?.name ?? world.avatars.get(id)?.info.name ?? "?",
  );
};

/** `text`, cut with an ellipsis until it fits `maxW` in the current font. */
function cut(g: CanvasRenderingContext2D, text: string, maxW: number): string {
  while (text.length > 2 && g.measureText(text).width > maxW) text = `${text.slice(0, -2)}…`;
  return text;
}

/** The big screen's feed and the wall terminals' values, queued for this frame. Nothing elsewhere. */
export function drawBasement(f: Frame): void {
  if (world.map.id !== "basement") return;
  drawPoker(f);
  drawRoulette(f);
  const { g, now } = f;
  const lan = isLanParty(skyNow());
  const ink = lan ? "#ff7be0" : "#7be0ff";
  const area = glass();
  void refreshTournament();
  const board = hud.get().tournament;
  const running = board?.current?.status === "running" && board.current.bracket ? board.current : null;
  if (area && running) screenBracket(f, area, running, ink);
  else if (area) {
    const [sx, sy] = f.toScreen(area.x, area.y);
    const w = area.w * f.scale;
    const more = world.games.size - FEED_ROWS;
    // Over three live: a thin "+N more" strip under the rows, a click on which opens the Arcade lobby.
    const strip = more > 0 ? area.h * 0.16 * f.scale : 0;
    const rowH = (area.h * f.scale - strip) / FEED_ROWS;
    const games = feed(world.games.values());
    const at = serverNow();
    f.labels.push(() => {
      g.save();
      g.textBaseline = "middle";
      g.textAlign = "left";
      const pad = 4 * f.scale;
      if (games.length === 0) {
        g.font = `600 ${Math.max(7, rowH * 0.3)}px ${FONT}`;
        g.fillStyle = ink;
        g.globalAlpha = 0.55 + 0.25 * Math.sin(now / 500);
        g.fillText(cut(g, "▶ No matches live", w - 2 * pad), sx + pad, sy + rowH * 0.7);
        g.fillStyle = "#9fb4c8";
        g.globalAlpha = 0.8;
        g.font = `500 ${Math.max(6, rowH * 0.22)}px ${FONT}`;
        g.fillText(cut(g, "Start one at a cabinet", w - 2 * pad), sx + pad, sy + rowH * 1.25);
        g.restore();
        return;
      }
      for (const [i, game] of games.entries()) {
        const y = sy + i * rowH;
        g.fillStyle = lan ? "rgba(120, 30, 110, 0.35)" : "rgba(40, 90, 140, 0.3)";
        g.fillRect(sx + 1, y + 1, w - 2, rowH - 2);
        const def = GAMES[game.game]!;
        const big = Math.max(7, rowH * 0.3);
        const small = Math.max(6, rowH * 0.22);
        g.font = `700 ${big}px ${FONT}`;
        g.fillStyle = ink;
        const watchers = game.watchers > 0 ? `👀 ${game.watchers}` : "";
        const wW = watchers ? g.measureText(watchers).width : 0;
        g.fillText(cut(g, `${def.emoji} ${def.name}`, w - 2 * pad - wW), sx + pad, y + rowH * 0.3);
        if (watchers) {
          g.textAlign = "right";
          g.fillText(watchers, sx + w - pad, y + rowH * 0.3);
          g.textAlign = "left";
        }
        g.font = `500 ${small}px ${FONT}`;
        g.fillStyle = "#d6e4f0";
        const head = game.endsAt
          ? `${game.headline ?? "Live"} · ends in ${Math.max(0, Math.ceil((game.endsAt - at) / 60_000))}m`
          : (game.headline ?? "Starting…");
        g.fillText(cut(g, `${head} · ${namesOf(game).join(" vs ")}`, w - 2 * pad), sx + pad, y + rowH * 0.72);
        gameHits.push({ x: sx, y, w, h: rowH, open: () => openMatch(game.id) });
      }
      if (more > 0) {
        const y = sy + FEED_ROWS * rowH;
        g.fillStyle = lan ? "rgba(120, 30, 110, 0.35)" : "rgba(40, 90, 140, 0.3)";
        g.fillRect(sx + 1, y + 1, w - 2, strip - 2);
        g.font = `700 ${Math.max(6, strip * 0.6)}px ${FONT}`;
        g.fillStyle = ink;
        g.textAlign = "center";
        g.fillText(`+${more} more`, sx + w / 2, y + strip / 2);
        gameHits.push({ x: sx, y, w, h: strip, open: () => hud.set({ panel: { kind: "arcade" } }) });
      }
      g.restore();
    });
  }
  cabinetLabels(f);
  terminals(f);
  if (board?.champion) championName(f, board.champion.name);
}

/** The champion's name under the tournament board, until the next tournament has one. */
function championName(f: Frame, name: string): void {
  const tile = world.map.find("i")[0];
  if (!tile) return;
  const { g } = f;
  const [sx, sy] = f.toScreen(tile[0] * TILE + TILE / 2, tile[1] * TILE + TILE + 3);
  f.labels.push(() => {
    g.save();
    g.font = `700 ${Math.max(7, f.scale * 3.4)}px ${FONT}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    const text = `👑 ${name}`;
    const w = g.measureText(text).width;
    g.fillStyle = "rgba(10, 8, 28, 0.75)";
    g.fillRect(sx - w / 2 - 2, sy - f.scale * 2.2, w + 4, f.scale * 4.4);
    g.fillStyle = "#ffd75a";
    g.fillText(text, sx, sy);
    g.restore();
  });
}

/** The big screen while a bracket runs: the round being played and its matches (a click opens the board). */
function screenBracket(
  f: Frame,
  area: { x: number; y: number; w: number; h: number },
  t: TournamentView,
  ink: string,
): void {
  const { g } = f;
  const rounds = t.bracket!;
  // The round being played: the first with a match left, or the final once it's done.
  const r = Math.max(
    0,
    rounds.findIndex((round) => round.some((m) => m.winner === null)),
  );
  const [sx, sy] = f.toScreen(area.x, area.y);
  const w = area.w * f.scale;
  const h = area.h * f.scale;
  const rowH = h / (FEED_ROWS + 1);
  const name = (id: number | null) => (id === null ? "…" : (t.players.find((p) => p.id === id)?.name ?? "?"));
  const matches = rounds[r]!.filter((m) => m.a !== null || m.b !== null).slice(0, FEED_ROWS);
  f.labels.push(() => {
    g.save();
    g.textBaseline = "middle";
    g.textAlign = "left";
    const pad = 4 * f.scale;
    g.font = `700 ${Math.max(7, rowH * 0.5)}px ${FONT}`;
    g.fillStyle = ink;
    const def = GAMES[t.game]!;
    g.fillText(
      cut(g, `🏆 ${def.name} · ${roundName(rounds.length, r)}`, w - 2 * pad),
      sx + pad,
      sy + rowH * 0.5,
    );
    g.font = `500 ${Math.max(6, rowH * 0.42)}px ${FONT}`;
    for (const [i, m] of matches.entries()) {
      const y = sy + (i + 1) * rowH;
      g.fillStyle = "rgba(40, 90, 140, 0.3)";
      g.fillRect(sx + 1, y + 1, w - 2, rowH - 2);
      g.fillStyle = "#d6e4f0";
      const side = (id: number | null) => (m.winner !== null && m.winner === id ? `${name(id)} ✓` : name(id));
      g.fillText(
        cut(g, `${side(m.a)} vs ${m.b === null ? "bye" : side(m.b)}`, w - 2 * pad),
        sx + pad,
        y + rowH * 0.5,
      );
    }
    gameHits.push({ x: sx, y: sy, w, h, open: () => hud.set({ panel: { kind: "tournament" } }) });
    g.restore();
  });
}

/** What each cabinet's label says, by game (the cabinets are in `CABINET_GAMES` order). */
const CABINET_NAME: Record<(typeof CABINET_GAMES)[number], string> = {
  spr: "SPR",
  hype: "HYPE",
  dice: "DICE",
  sprint: "SPRINT",
  tokenmaxxing: "TOKEN",
};

/** A small label in its game's colour above each cabinet's marquee. */
function cabinetLabels(f: Frame): void {
  const { g } = f;
  for (const [i, [x, y]] of world.map.find("C").entries()) {
    const game = CABINET_GAMES[i];
    if (!game) continue;
    const [sx, sy] = f.toScreen(x * TILE + TILE / 2, y * TILE - 15);
    f.labels.push(() => {
      g.save();
      g.font = `700 ${Math.max(7, f.scale * 3.4)}px ${FONT}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      const label = CABINET_NAME[game];
      const w = g.measureText(label).width;
      g.fillStyle = "rgba(10, 8, 28, 0.75)";
      g.fillRect(sx - w / 2 - 2, sy - f.scale * 2.2, w + 4, f.scale * 4.4);
      g.fillStyle = `rgb(${CABINET_GLOW[i % CABINET_GLOW.length]})`;
      g.fillText(label, sx, sy);
      g.restore();
    });
  }
}

/** The wall terminals: the left shows today's top three as bars, the right the raid boss's HP. */
function terminals(f: Frame): void {
  const { g, now } = f;
  const tiles = world.map.find("M");
  if (tiles.length < 2) return;
  const [[lx, ly], [rx, ry]] = [tiles[0]!, tiles[tiles.length - 1]!];
  const { x, y, w } = TERMINAL_GLASS;
  const state = hud.get();
  f.items.push({
    y: ly * TILE + TILE,
    draw: () => {
      // Today's top three, each as long as its tokens against the best: the board, with no numbers.
      const top = state.board.filter((r) => r.tokens > 0).slice(0, 3);
      const best = top[0]?.tokens ?? 1;
      for (const [i, r] of top.entries()) {
        g.fillStyle = i === 0 ? "#ffd75a" : i === 1 ? "#cfd6df" : "#d49a62";
        g.fillRect(lx * TILE + x, ly * TILE + y + i * 2, Math.max(1, Math.round((r.tokens / best) * w)), 1);
      }
      if (top.length === 0) {
        g.fillStyle = "#2f7a4f";
        g.fillRect(lx * TILE + x + (Math.floor(now / 500) % w), ly * TILE + y + 2, 1, 1);
      }
      // The raid's boss HP, green to red as it falls.
      const raid = state.raid;
      const share = raid && !raid.prelaunch && !raid.closed && raid.hp > 0 ? left(raid) / raid.hp : null;
      g.fillStyle = "#12301f";
      g.fillRect(rx * TILE + x, ry * TILE + y + 1, w, 3);
      if (share !== null) {
        g.fillStyle = share > 0.5 ? "#3ddc84" : share > 0.2 ? "#f5d14a" : "#e8584f";
        g.fillRect(rx * TILE + x, ry * TILE + y + 1, Math.max(1, Math.round(share * w)), 3);
      } else {
        g.fillStyle = "#2f7a4f";
        g.fillRect(rx * TILE + x + (Math.floor(now / 500) % w), ry * TILE + y + 2, 1, 1);
      }
    },
  });
}

const CABINET_GLOW = ["255,90,90", "90,200,255", "255,214,90", "90,255,160", "200,120,255"];
const SCREEN_GLOWS = ["90,210,255", "90,255,160", "255,100,220"];
const DIM = "rgba(16, 14, 40, 0.5)";

/**
 * The room's light, over the scene and under the labels (world space). Rooms get no sun, so a constant
 * dim, then the screens, marquees, rack LEDs and neon glow through it. On Friday and Saturday evenings
 * (Copenhagen) it's a LAN party: the neon pulses faster and the screens go magenta.
 */
export function lightBasement({ g, now }: Frame): void {
  const map = world.map;
  if (map.id !== "basement") return;
  const lan = isLanParty(skyNow());
  g.fillStyle = DIM;
  g.fillRect(map.x0 * TILE, map.y0 * TILE, map.width * TILE, map.height * TILE);

  const area = glass();
  if (area) {
    const k = flicker(now / 3, 7);
    drawGlow(g, area.x + area.w / 2, area.y + area.h / 2, 74 * k, lan ? "255,80,210" : "70,170,255", 0.5);
  }
  // PC screens: a colour per desk, from a hash of the tile, flickering slowly.
  for (const [x, y] of map.find("ζ")) {
    const rgb = lan ? "255,100,220" : SCREEN_GLOWS[Math.floor(hash(x, y, 91) * SCREEN_GLOWS.length)]!;
    drawGlow(g, x * TILE + 8, y * TILE + 3, 15, rgb, 0.3 * flicker(now / 4, x + y));
  }
  for (const [i, [x, y]] of map.find("C").entries())
    drawGlow(
      g,
      x * TILE + 8,
      y * TILE - 8,
      20,
      CABINET_GLOW[i % CABINET_GLOW.length]!,
      0.38 * flicker(now / 2, i),
    );
  // Each marquee tinted in its game's colour.
  for (const [i, [x, y]] of map.find("C").entries()) {
    g.fillStyle = `rgba(${CABINET_GLOW[i % CABINET_GLOW.length]}, 0.5)`;
    g.fillRect(x * TILE + 3, y * TILE - 10, 10, 4);
  }
  // Rack LEDs blink green or amber, each at its own beat.
  for (const [x, y] of map.find("η")) {
    const on = Math.floor(now / (260 + hash(x, y, 3) * 300)) % 2 === 0;
    drawGlow(
      g,
      x * TILE + 8,
      y * TILE + 2,
      10,
      hash(x, y, 4) < 0.3 ? "255,190,60" : "80,255,140",
      on ? 0.42 : 0.12,
    );
  }
  for (const [x, y] of map.find("M")) drawGlow(g, x * TILE + 8, y * TILE + 6, 14, "70,255,150", 0.3);
  // The neon sign pulses (faster at the LAN party).
  const pulse = 0.65 + 0.35 * Math.sin(now / (lan ? 180 : 650));
  for (const [x, y] of map.find("δ")) drawGlow(g, x * TILE + 8, y * TILE + 8, 30, "255,70,190", 0.45 * pulse);
}

/** E on a basement tile: a cabinet starts its game's lobby, a terminal opens its panel, the screen a match. */
export function basementInteract(x: number, y: number): boolean {
  if (world.room !== "basement") return false;
  const ch = world.map.at(x, y);
  if (ch === "C") {
    const i = world.map.find("C").findIndex(([cx, cy]) => cx === x && cy === y);
    const game = CABINET_GAMES[i];
    if (!game) return false;
    // Already at a table or in a match: the lobby, where yours is. Otherwise this game's table.
    const lobby = hud.get().lobby;
    const busy =
      lobby && (lobby.me.table !== null || lobby.matches.some((m) => !m.outcome && m.id === lobby.me.match));
    hud.set({ panel: busy ? { kind: "arcade" } : { kind: "newTable", game } });
    return true;
  }
  if (ch === "i") {
    hud.set({ panel: { kind: "tournament" } });
    return true;
  }
  if (ch === "M") {
    const tiles = world.map.find("M");
    hud.set({ panel: { kind: x === tiles[0]![0] ? "leaderboard" : "raid" } });
    return true;
  }
  if (ch === "E") {
    const first = feed(world.games.values())[0];
    if (!first) return false;
    openMatch(first.id);
    return true;
  }
  return false;
}
