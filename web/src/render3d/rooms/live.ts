import { GAMES } from "@tokenmaxxing/core/games/index.ts";
import { LEFT_PLATES, plaqueOf, plateText, REGULARS_TOP, tabLine } from "@tokenmaxxing/core/regulars.ts";
import { isLanParty, specialOn } from "@tokenmaxxing/core/tavern.ts";
import { roundName } from "@tokenmaxxing/core/tournament.ts";
import { TUNES } from "@tokenmaxxing/core/tunes.ts";
import type { WorldGame } from "@tokenmaxxing/core/world.ts";
import { clockFaces } from "../../game/clocks.ts";
import { left } from "../../game/raid.ts";
import { askRegulars, regularsBoard } from "../../game/regulars.ts";
import { skyNow } from "../../game/sky.ts";
import { world } from "../../game/world.ts";
import { refreshTournament, town } from "../../net.ts";
import { hud } from "../../store.ts";
import { setLanParty } from "../kit/livescreen.ts";
import type { BasementScene, BoardPairing, MatchRow, ScreenFeed } from "./basement3d.ts";
import {
  type ClocksModel,
  type ClocksShown,
  setBarTab,
  setOfficeBoard,
  setPlaque,
  setSpecial,
  type TavernRoom,
} from "./tavern3d.ts";

/**
 * The real game's data on the rooms' boards: the Tavern's bar tab, plaques, easel and jukebox, and the
 * basement's livestream screen, tournament board and wall terminals. Each returns a function to call every
 * frame; it repaints a board only when what it shows has changed (a repaint is a canvas upload).
 */

/** A board that repaints when its value changes. */
function watch<T>(paint: (v: T) => void): (v: T) => void {
  let last: string | null = null;
  return (v) => {
    const key = JSON.stringify(v);
    if (key === last) return;
    last = key;
    paint(v);
  };
}

const OFFICES_EVERY_MS = 30_000;
let openOffices: string[] | null = null;
let officesAt = -Infinity;

/** The names of the offices left open, asked for again every half minute (the server keeps its own for a while too). */
function officesOpen(now: number): string[] | null {
  if (now - officesAt > OFFICES_EVERY_MS) {
    officesAt = now;
    town.openOffices().then(
      (rows) => {
        openOffices = rows.map((r) => r.name);
      },
      () => {},
    );
  }
  return openOffices;
}

/** The Tavern: this week's regulars on the bar tab and the plaques, the day's special on the easel, the world clocks, the jukebox on. */
export function liveTavern(inn: TavernRoom): (t: number) => void {
  const tab = inn.by.get("tile:J")?.[0];
  const plaques = [inn.by.get("tile:P")?.[0], inn.by.get("tavern:plaque-2")?.[0]];
  const easel = inn.by.get("tile:K")?.[0];
  const paintBoard = watch<{
    rows: { rank: number; name: string; minutes: number }[];
    last: number | null;
    ids: number[];
  }>(({ rows, last, ids }) => {
    if (tab)
      setBarTab(
        tab,
        rows.map((r) => tabLine(r)),
        ids.indexOf(last ?? -1),
      );
    for (const [i, plaque] of plaques.entries()) {
      if (!plaque) continue;
      const first = i === 0 ? 1 : LEFT_PLATES + 1;
      const lastRank = i === 0 ? LEFT_PLATES : REGULARS_TOP;
      const names: string[] = [];
      for (let rank = first; rank <= lastRank; rank++) {
        const r = rows.find((q) => q.rank === rank && plaqueOf(q.rank) === i);
        names.push(r ? plateText(r) : "");
      }
      setPlaque(plaque, names);
    }
  });
  const paintSpecial = watch<string>((s) => easel && setSpecial(easel, s));
  const officeBoard = inn.by.get("tile:w")?.[0];
  const paintOffices = watch<string[] | null>((names) => officeBoard && setOfficeBoard(officeBoard, names));
  const clocks = inn.by.get("tile:◷")?.[0] as ClocksModel | undefined;
  const paintClocks = watch<ClocksShown>((s) => clocks?.show(s));
  return () => {
    askRegulars();
    const { rows, last } = regularsBoard();
    paintBoard({ rows: [...rows], last, ids: rows.map((r) => r.userId) });
    paintSpecial(specialOn(new Date()));
    paintOffices(officesOpen(Date.now()));
    const { hands, lit } = clockFaces();
    paintClocks({ hands, lit });
    const playing = hud.get().jukebox;
    inn.jukebox.playing = playing !== null;
    if (playing) inn.jukebox.track = TUNES.find((t) => t.id === playing.track)?.name ?? playing.track;
  };
}

/** The matches the big screen lists, oldest first (as the 2D screen does). */
const FEED_ROWS = 3;
const feedOf = (games: Iterable<WorldGame>): WorldGame[] =>
  [...games].sort((a, b) => a.id - b.id).slice(0, FEED_ROWS);

const nameOf = (id: number): string =>
  hud
    .get()
    .lobby?.matches.flatMap((m) => m.players)
    .find((p) => p.userId === id)?.name ??
  world.avatars.get(id)?.info.name ??
  "?";

function matchRow(game: WorldGame): MatchRow {
  const def = GAMES[game.game]!;
  const endsInMin = game.endsAt ? Math.max(0, Math.ceil((game.endsAt - Date.now()) / 60_000)) : null;
  return {
    emoji: def.emoji,
    name: def.name,
    headline: game.headline,
    players: game.players.map(nameOf),
    watchers: game.watchers,
    endsInMin,
  };
}

/** The basement: the livestream screen (or the running bracket), the tournament board, the terminals, the LAN party. */
export function liveBasement(b: BasementScene): (t: number) => void {
  const showScreen = watch<ScreenFeed>((f) => b.screen.show(f));
  const showBoard = watch<Parameters<typeof b.board.show>[0]>((v) => b.board.show(v));
  const showTop = watch<{ tokens: number }[]>((rows) => b.terminals[0].show(rows));
  const showRaid = watch<number | null>((share) => b.terminals[1].show(share));
  return () => {
    setLanParty(isLanParty(skyNow()));
    void refreshTournament();
    const t = hud.get().tournament;
    const running = t?.current?.status === "running" && t.current.bracket ? t.current : null;
    if (running) {
      const rounds = running.bracket!;
      const r = Math.max(
        0,
        rounds.findIndex((round) => round.some((m) => m.winner === null)),
      );
      const name = (id: number | null) =>
        id === null ? null : (running.players.find((p) => p.id === id)?.name ?? "?");
      const side = (m: { a: number | null; b: number | null; winner: number | null }): "a" | "b" | null =>
        m.winner === null ? null : m.winner === m.a ? "a" : "b";
      showScreen({
        matches: [],
        bracket: {
          game: GAMES[running.game]!.name,
          round: roundName(rounds.length, r),
          matches: rounds[r]!.filter((m) => m.a !== null || m.b !== null)
            .slice(0, FEED_ROWS)
            .map((m) => ({ a: name(m.a), b: name(m.b), winner: side(m) })),
        },
      });
      showBoard({
        rounds: rounds.map((round): BoardPairing[] =>
          round.map((m) => ({ a: name(m.a), b: name(m.b), winner: side(m) })),
        ),
        champion: t?.champion?.name ?? null,
      });
    } else {
      showScreen({ matches: feedOf(world.games.values()).map(matchRow), total: world.games.size });
      showBoard(t?.champion ? { rounds: null, champion: t.champion.name } : { rounds: null });
    }
    showTop(
      hud
        .get()
        .board.filter((r) => r.tokens > 0)
        .slice(0, 3)
        .map((r) => ({ tokens: r.tokens })),
    );
    const raid = hud.get().raid;
    showRaid(raid && !raid.prelaunch && !raid.closed && raid.hp > 0 ? left(raid) / raid.hp : null);
  };
}
