import { GAMES } from "@tokenmaxxing/core/games/index.ts";
import type { GameId } from "@tokenmaxxing/core/games/types.ts";
import {
  MIN_PLAYERS,
  roundName,
  SIZES,
  type Size,
  TOURNAMENT_GAMES,
  type TournamentView,
} from "@tokenmaxxing/core/tournament.ts";
import { useEffect, useState } from "react";
import { world } from "../game/world.ts";
import { refreshTournament, town } from "../net.ts";
import { hud, useHud } from "../store.ts";
import { Modal, Pills, useRun } from "./ui.tsx";

const gameLabel = (g: GameId) => `${GAMES[g]?.emoji ?? ""} ${GAMES[g]?.name ?? g}`;

/** The basement's tournament board: open a bracket, sign up, and follow it. Matches are played at the usual tables. */
export function Tournament() {
  const board = useHud((s) => s.tournament);
  // Fresh on open, and while it's open (a bracket moves when matches end, or a countdown runs out).
  useEffect(() => {
    void refreshTournament(true);
    const t = setInterval(() => void refreshTournament(true), 8000);
    return () => clearInterval(t);
  }, []);
  const title = "🏆 Tournament board";
  if (!board) return <Modal title={title}>Reading the board…</Modal>;
  const t = board.current;
  return (
    <Modal title={title} wide={t?.status === "running"}>
      {board.champion && (
        <p className="tourney-champ">
          👑 <b>{board.champion.name}</b> won the {gameLabel(board.champion.game)} tournament. Their name
          stays up until the next one.
        </p>
      )}
      {t ? <Live t={t} /> : <Open />}
      <p className="muted small">
        Head-to-head matches, played at a table in the town square like any other. No coins ride on it: the
        prize is the name on this board and a champion's title in chat.
      </p>
    </Modal>
  );
}

function Open() {
  const [game, setGame] = useState<GameId>(TOURNAMENT_GAMES[0]!);
  const [size, setSize] = useState<Size>(4);
  const { error, busy, run } = useRun();
  const done = run(async () => {
    await town.tournamentOpen(game, size);
    await refreshTournament(true);
  });
  return (
    <>
      <p>No bracket is open. Start one:</p>
      <Pills
        value={game}
        options={TOURNAMENT_GAMES.map((g) => [g, gameLabel(g)] as const)}
        onChange={setGame}
      />
      <Pills
        value={String(size)}
        options={SIZES.map((n) => [String(n), `${n} players`] as const)}
        onChange={(v) => setSize(Number(v) as Size)}
      />
      <p className="muted small">
        It starts when it's full, or five minutes after it opened with at least {MIN_PLAYERS} signed up (the
        rest of the bracket gets byes).
      </p>
      <button type="button" className="primary" disabled={busy} onClick={done}>
        Open a {size}-player bracket
      </button>
      {error && <p className="error">{error}</p>}
    </>
  );
}

function Live({ t }: { t: TournamentView }) {
  const { error, busy, run } = useRun();
  const mine = t.players.some((p) => p.id === world.selfId);
  const join = (j: boolean) =>
    run(async () => {
      await town.tournamentJoin(j);
      await refreshTournament(true);
    });
  return (
    <>
      <h3>
        {gameLabel(t.game)} · {t.status === "open" ? `${t.players.length}/${t.size} signed up` : "under way"}
      </h3>
      {t.status === "open" ? (
        <>
          <ul className="tourney-players">
            {t.players.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="link"
                  onClick={() => hud.set({ panel: { kind: "card", userId: p.id } })}
                >
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
          <p className="muted small">
            {t.startsAt
              ? `Starts at ${new Date(t.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}, or when it's full.`
              : `Starts when it's full, or five minutes in with ${MIN_PLAYERS} signed up.`}
          </p>
          <button type="button" className={mine ? "" : "primary"} disabled={busy} onClick={join(!mine)}>
            {mine ? "Leave the bracket" : "Sign up"}
          </button>
        </>
      ) : (
        t.bracket && <Bracket t={t} />
      )}
      {error && <p className="error">{error}</p>}
    </>
  );
}

function Bracket({ t }: { t: TournamentView }) {
  const rounds = t.bracket!;
  const name = (id: number | null) => (id === null ? "" : (t.players.find((p) => p.id === id)?.name ?? "?"));
  const slot = (id: number | null, winner: number | null, blank: string) => (
    <span className={winner !== null && winner === id ? "won" : id === null ? "empty" : ""}>
      {id === null ? blank : name(id)}
    </span>
  );
  return (
    <>
      <div className="tourney-bracket">
        {rounds.map((round, r) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: rounds are fixed in number and order
          <div key={r} className="tourney-round">
            <b>{roundName(rounds.length, r)}</b>
            {round.map((m, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: pairings are fixed in order
              <div key={i} className="tourney-match">
                {slot(m.a, m.winner, r === 0 ? "bye" : "…")}
                {slot(m.b, m.winner, r === 0 ? "bye" : "…")}
              </div>
            ))}
          </div>
        ))}
      </div>
      <button
        type="button"
        className="primary"
        onClick={() => hud.set({ panel: { kind: "newTable", game: t.game } })}
      >
        Open a {GAMES[t.game]?.name} table
      </button>
      <p className="muted small">
        Sit down with your opponent at a {GAMES[t.game]?.name} table; when the match ends, the winner goes
        through. A tie is played again.
      </p>
    </>
  );
}
