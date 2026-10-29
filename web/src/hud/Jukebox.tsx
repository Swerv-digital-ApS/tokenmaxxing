import { COOLDOWN_MS, trackMs } from "@tokenmaxxing/core/jukebox.ts";
import { TUNES } from "@tokenmaxxing/core/tunes.ts";
import { useState } from "react";
import { setSettings } from "../game/jukebox.ts";
import { conn } from "../net.ts";
import { useHud } from "../store.ts";
import { Modal } from "./ui.tsx";

/** When I last put a track on, to show the wait (the server decides). ponytail: lost on reload; the server still says no. */
let lastStart = 0;

/** The Tavern's jukebox: pick a track for the room, vote to skip, mute it for yourself. Free. */
export function Jukebox() {
  const playing = useHud((s) => s.jukebox);
  const { muted, volume } = useHud((s) => s.jukeSettings);
  const [problem, setProblem] = useState<string | null>(null);
  // The track I voted to skip; the server counts one vote each, this only greys the button.
  const [voted, setVoted] = useState("");
  const tune = playing && TUNES.find((t) => t.id === playing.track);
  const key = playing ? `${playing.track}:${playing.by}:${playing.ms}` : "";
  const waitS = Math.ceil(Math.max(0, lastStart + COOLDOWN_MS - Date.now()) / 1000);

  const play = async (id: string) => {
    const err = await conn.jukeboxPlay(id);
    if (!err) lastStart = Date.now();
    setProblem(err);
  };
  const skip = async () => {
    setProblem(await conn.jukeboxSkip());
    setVoted(key);
  };

  return (
    <Modal title="🎵 Jukebox">
      <p className="muted small">
        Free for the whole Tavern. One track at a time, and one of yours a minute.
      </p>
      {playing && tune ? (
        <p>
          {tune.emoji} <strong>{tune.name}</strong>
          <span className="muted small"> · on by {playing.byName}</span>{" "}
          <button type="button" disabled={voted === key} onClick={() => void skip()}>
            ⏭ Skip ({playing.votes}/{playing.need})
          </button>
        </p>
      ) : (
        <p className="muted">Nothing playing. Pick one.</p>
      )}
      {problem && <p role="alert">{problem}</p>}
      <ul className="shop">
        {TUNES.map((t) => (
          <li key={t.id} className={playing?.track === t.id ? "wearing" : undefined}>
            <strong>
              {t.emoji} {t.name}
            </strong>
            <span className="muted small">{Math.round(trackMs(t.id) / 1000)}s</span>
            <button type="button" disabled={!!playing} onClick={() => void play(t.id)}>
              {waitS > 0 && !playing ? `Play (${waitS}s)` : "Play"}
            </button>
          </li>
        ))}
      </ul>
      <label>
        <input
          type="checkbox"
          checked={muted}
          onChange={(e) => setSettings({ muted: e.target.checked, volume })}
        />{" "}
        Mute
      </label>{" "}
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        aria-label="Volume"
        onChange={(e) => setSettings({ muted, volume: Number(e.target.value) })}
      />
    </Modal>
  );
}
