import { compact } from "@tokenmaxxing/core/format.ts";
import { GAMES } from "@tokenmaxxing/core/games/index.ts";
import { PLAZA } from "@tokenmaxxing/core/maps.ts";
import type { WorldGame } from "@tokenmaxxing/core/world.ts";
import * as THREE from "three";
import { banner } from "../../game/games.ts";
import { lane, live as raceLive } from "../../game/race.ts";
import { serverNow, world } from "../../game/world.ts";
import { openMatch } from "../../net.ts";
import { hud } from "../../store.ts";
import { disposeObject } from "../engine/dispose.ts";
import { canvasTexture } from "../kit/kit.ts";
import { type LiveScreen, liveScreen } from "../kit/livescreen.ts";
import type { Sign } from "../rooms/rooms.ts";
import { arenaGlow, propTilesOf, rankOf, type ScoreLine, scoreLines, startLineSpan } from "./gamefx.ts";
import { type ArenaDesk, arenaDesk, type GameTable, gameTable, seatStool } from "./tables3d.ts";

/**
 * The games in town, drawn: a table (or a row of arena desks) wherever the world says a game is, stools under the
 * players, the watcher count over it, the banner and the table's own callouts, the arena's live scoreboard, the sprint
 * race's start line, and the open tables' "Join" over their hosts. Each game's props are built when it appears and
 * freed when it is gone; everything here moves, so it is `live`.
 */

interface Shown {
  game: WorldGame;
  group: THREE.Group;
  table: GameTable | null;
  desks: { desk: ArenaDesk; player: number }[];
  board: LiveScreen<ScoreLine[]> | null;
  boardKey: string;
  line: THREE.Mesh | null;
  watchers: number;
}

const openArcade = () => hud.set({ panel: { kind: "arcade" } });

const CHEQUER = (() => {
  let tex: THREE.CanvasTexture | null = null;
  return (): THREE.CanvasTexture => {
    if (tex) return tex;
    tex = canvasTexture(
      4,
      32,
      (g) => {
        for (let y = 0; y < 32; y++)
          for (let x = 0; x < 4; x++) {
            g.fillStyle = (x + y) % 2 === 0 ? "#fbf7ef" : "#2b2433";
            g.fillRect(x, y, 1, 1);
          }
      },
      false,
    );
    tex.userData.shared = true;
    return tex;
  };
})();

function paintScore(g: CanvasRenderingContext2D, w: number, h: number, lines: ScoreLine[]): void {
  g.fillStyle = "rgba(20, 24, 34, 0.96)";
  g.fillRect(0, 0, w, h);
  const lh = h / Math.max(1, lines.length);
  g.textBaseline = "middle";
  lines.forEach((l, i) => {
    const y = i * lh;
    g.fillStyle = l.leader ? "rgba(255, 211, 92, 0.4)" : "rgba(143, 227, 255, 0.24)";
    g.fillRect(4, y + 2, (w - 8) * l.share, lh - 4);
    g.font = `700 ${lh * 0.5}px 'Trebuchet MS', Arial, sans-serif`;
    g.fillStyle = "#ffffff";
    g.textAlign = "left";
    g.fillText(`${l.leader ? "👑" : `${i + 1}.`} ${l.name}`, 10, y + lh / 2 + 1, w * 0.6);
    g.textAlign = "right";
    g.fillText(l.label, w - 10, y + lh / 2 + 1, w * 0.35);
  });
}

export class GamesLayer {
  readonly group = new THREE.Group();
  private readonly shown = new Map<number, Shown>();

  constructor(private readonly toWorld: (tx: number, ty: number) => [number, number]) {
    this.group.userData.live = true;
    this.group.userData.nobatch = true;
    this.group.name = "games-live";
  }

  /** Brings the props up to date with `world.games` (the world replaces a game's object whenever it changes). */
  update(t: number, toward?: THREE.Vector3): void {
    const live = new Set<number>();
    for (const game of world.games.values()) {
      live.add(game.id);
      let s = this.shown.get(game.id);
      if (!s) {
        s = this.make(game);
        this.shown.set(game.id, s);
      } else if (s.game !== game) this.refresh(s, game);
      if (game.spot.kind === "arena") {
        this.glow(s, t * 1000);
        // The scoreboard turns to face wherever the camera is.
        if (s.board && toward) s.board.rotation.y = Math.atan2(toward.x, toward.z);
      }
    }
    for (const [id, s] of this.shown)
      if (!live.has(id)) {
        s.group.removeFromParent();
        disposeObject(s.group);
        this.shown.delete(id);
      }
    this.group.visible = this.shown.size > 0;
  }

  private make(game: WorldGame): Shown {
    const group = new THREE.Group();
    const s: Shown = {
      game,
      group,
      table: null,
      desks: [],
      board: null,
      boardKey: "",
      line: null,
      watchers: -1,
    };
    this.group.add(group);
    this.build(s, game);
    return s;
  }

  private refresh(s: Shown, game: WorldGame): void {
    const was = s.game;
    s.game = game;
    // The props change only when the seats do (a player joined or left); a headline or a count changes the labels.
    if (
      was.players.join() !== game.players.join() ||
      was.spot.kind !== game.spot.kind ||
      was.game !== game.game
    ) {
      for (const c of [...s.group.children]) {
        c.removeFromParent();
        disposeObject(c);
      }
      s.table = null;
      s.desks = [];
      s.board = null;
      s.boardKey = "";
      s.line = null;
      s.watchers = -1;
      this.build(s, game);
    } else this.fill(s, game);
  }

  private build(s: Shown, game: WorldGame): void {
    const { spot } = game;
    if (spot.kind === "table") {
      const [tx, ty] = propTilesOf(spot)[0]!;
      const [x, z] = this.toWorld(tx, ty);
      const table = gameTable(game.game as never, false)();
      table.position.set(x, 0, z);
      s.group.add(table);
      s.table = table;
      for (const seat of game.seats) {
        const [sx, sz] = this.toWorld(seat.x, seat.y);
        const stool = seatStool();
        stool.position.set(sx, 0, sz);
        s.group.add(stool);
      }
    } else {
      game.seats.forEach((seat, i) => {
        const [x, z] = this.toWorld(seat.x, seat.y - 1);
        const desk = arenaDesk();
        desk.position.set(x, 0, z);
        // The desk faces the player behind it (south), the way 2D draws them.
        s.group.add(desk);
        s.desks.push({ desk, player: game.players[i]! });
        const [sx, sz] = this.toWorld(seat.x, seat.y);
        const stool = seatStool();
        stool.position.set(sx, 0, sz);
        s.group.add(stool);
      });
    }
    this.fill(s, game);
  }

  private nameOf(id: number): string {
    return (
      hud
        .get()
        .lobby?.matches.flatMap((m) => m.players)
        .find((p) => p.userId === id)?.name ??
      world.avatars.get(id)?.info.name ??
      "?"
    );
  }

  /** Counts, scoreboard and the race's start line: what changes while the game runs. */
  private fill(s: Shown, game: WorldGame): void {
    if (s.table && s.watchers !== game.watchers) {
      s.watchers = game.watchers;
      s.table.setWatchers(game.watchers);
    }
    if (game.spot.kind === "arena") {
      const names = new Map(game.players.map((p) => [p, this.nameOf(p)] as const));
      const lines = scoreLines(game.board, names, compact);
      const key = JSON.stringify(lines);
      if (key === s.boardKey) return;
      s.boardKey = key;
      if (!lines.length) {
        s.board?.removeFromParent();
        s.board = null;
        return;
      }
      const w = Math.max(2.6, game.spot.w * 0.95);
      const h = 0.32 * lines.length + 0.1;
      if (!s.board || s.board.userData.rows !== lines.length || s.board.userData.w !== w) {
        if (s.board) {
          s.board.removeFromParent();
          disposeObject(s.board);
        }
        s.board = liveScreen<ScoreLine[]>(w, h, lines, (g, cw, ch, st) => paintScore(g, cw, ch, st), {
          px: 64,
          frame: "#e9b73d",
          lift: 1.1,
          lit: true,
        });
        s.board.userData.rows = lines.length;
        s.board.userData.w = w;
        const [cx, cz] = this.toWorld(game.spot.x + game.spot.w / 2 - 0.5, game.spot.y);
        s.board.position.set(cx, 0.9, cz - 0.1);
        s.group.add(s.board);
      } else s.board.set(lines);
    }
    // The race's start line, across the lanes.
    if (game.game === "sprint") {
      const racing = raceLive(game);
      if (racing && !s.line) {
        const span = startLineSpan(
          PLAZA.left,
          PLAZA.right,
          PLAZA.top,
          game.players.map((p) => lane(game, p)),
        );
        if (span) {
          const [x, z0] = this.toWorld(span.x - 0.5, span.y0 - 0.5);
          const [, z1] = this.toWorld(span.x - 0.5, span.y1 - 0.5);
          const tex = CHEQUER();
          const mat = new THREE.MeshBasicMaterial({ map: tex });
          const len = Math.abs(z1 - z0);
          const line = new THREE.Mesh(new THREE.PlaneGeometry(0.25, len), mat);
          line.rotation.x = -Math.PI / 2;
          line.position.set(x + 0.125, 0.03, (z0 + z1) / 2);
          tex.wrapT = THREE.RepeatWrapping;
          tex.repeat.set(1, Math.max(1, Math.round(len * 4)));
          line.userData.nopick = true;
          s.group.add(line);
          s.line = line;
        }
      } else if (!racing && s.line) {
        s.line.removeFromParent();
        s.line.geometry.dispose();
        (s.line.material as THREE.Material).dispose();
        s.line = null;
      }
    }
  }

  /** The arena's screens flicker with how each player ranks. */
  private glow(s: Shown, nowMs: number): void {
    const board = s.game.board;
    for (const d of s.desks) d.desk.setGlow(arenaGlow(rankOf(board, d.player), nowMs));
  }

  /** The words over the games: a banner for each (click to watch), the table's callout, the open tables' "Join". */
  signs(): Sign[] {
    const list: Sign[] = [];
    const at = serverNow();
    const now = performance.now();
    for (const s of this.shown.values()) {
      const game = s.game;
      if (!game.seats.length) continue;
      const [cx, cz] = this.toWorld(
        game.spot.x + game.spot.w / 2 - 0.5,
        game.spot.y + (game.spot.kind === "table" ? 1 : 0),
      );
      const head = Math.min(...game.seats.map((q) => q.y));
      const [, hz] = this.toWorld(0, head);
      list.push({
        key: `game:${game.id}`,
        at: [cx, game.spot.kind === "arena" ? 2.3 : 2.5, game.spot.kind === "arena" ? cz - 0.2 : hz],
        kind: "label",
        text: banner(game, at),
        cls: "gold",
        onClick: () => openMatch(game.id),
      });
      const said = world.tableBubbles.get(game.id);
      if (said && now < said.until)
        list.push({
          key: `say:${game.id}`,
          at: [cx, game.spot.kind === "arena" ? 2.3 : 2.5, game.spot.kind === "arena" ? cz - 0.2 : hz],
          kind: "label",
          text: said.text,
          cls: "bubble",
          dy: -26,
        });
    }
    // "🎮 Hype Cycle 2/6 · 🪙 50 · Join" over the host of an open table: people passing by can join.
    const lobby = hud.get().lobby;
    for (const t of lobby?.tables ?? []) {
      if (!t.open) continue;
      const host = world.avatars.get(t.host);
      if (!host || host.state === "playing") continue;
      const [x, z] = this.toWorld(host.x, host.y);
      const join = t.host === hud.get().me?.userId ? "" : " · Join";
      list.push({
        key: `open:${t.id}`,
        at: [x, 2.75, z],
        kind: "label",
        text: `🎮 ${GAMES[t.game]!.name} ${t.seated.length}/${t.seats} · 🪙 ${t.stake}${join}`,
        cls: "cyan",
        dy: -30,
        onClick: openArcade,
      });
    }
    return list;
  }

  dispose(): void {
    for (const s of this.shown.values()) disposeObject(s.group);
    this.shown.clear();
    this.group.removeFromParent();
    disposeObject(this.group);
  }
}
