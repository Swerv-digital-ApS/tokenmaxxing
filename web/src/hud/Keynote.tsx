import {
  clockAt,
  hostAccent,
  type Keynote,
  liveKeynote,
  startsIn,
  upcoming,
} from "@tokenmaxxing/core/keynote.ts";
import type { CSSProperties } from "react";
import { useKeynotes } from "../game/keynote.ts";
import { useOutage } from "../game/picnic.ts";
import { serverNow } from "../game/world.ts";
import { hud } from "../store.ts";
import { Modal, useTicker } from "./ui.tsx";

const accentOf = (k: Keynote) => ({ "--accent": hostAccent(k.host) }) as CSSProperties;

/** When it starts, in the player's own time zone: "Tue 14 Oct, 19:00". */
const localDate = (at: number): string =>
  new Date(at).toLocaleString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/** While a keynote is on: a banner over everything with its stream, pointing at the Tavern's watch party. */
export function KeynoteBanner() {
  useTicker(30_000);
  const outage = useOutage();
  const live = liveKeynote(useKeynotes(), serverNow());
  if (!live) return null;
  return (
    <div className={`keynote-banner${outage ? " below" : ""}`} role="status" style={accentOf(live)}>
      <button type="button" className="link" onClick={() => hud.set({ panel: { kind: "keynote" } })}>
        <strong>📽️ {live.title} is on at the Tavern</strong>
      </button>
      <span className="muted small">
        <a href={live.url} target="_blank" rel="noreferrer">
          Watch the stream ↗
        </a>{" "}
        · drop in for the watch party badge
      </span>
    </div>
  );
}

/** The poster, up close: what's on the screen now, and what's coming, each with its stream. */
export function KeynotePanel() {
  useTicker(30_000);
  const now = serverNow();
  const list = upcoming(useKeynotes(), now);
  if (list.length === 0)
    return (
      <Modal title="📽️ Watch party">
        Nothing on the big screen yet. A poster goes up here a week before the next keynote.
      </Modal>
    );
  return (
    <Modal title="📽️ Keynote watch party">
      <ul className="keynotes">
        {list.map((k) => {
          const live = k.startsAt <= now;
          return (
            <li key={k.id} className={live ? "live" : ""} style={accentOf(k)}>
              <p className="keynote-when">
                {live ? "🔴 Live now" : `${localDate(k.startsAt)} · ${startsIn(k.startsAt, now)}`}
              </p>
              <h3>{k.title}</h3>
              <p className="muted small">
                {k.host} · {clockAt(k.startsAt)} to {clockAt(k.endsAt)} in town (Copenhagen)
              </p>
              <a href={k.url} target="_blank" rel="noreferrer">
                {live ? "Watch the stream ↗" : "The stream ↗"}
              </a>
            </li>
          );
        })}
      </ul>
      <p className="muted small">Be in the Tavern while one is on and the 📽️ Watch party badge is yours.</p>
    </Modal>
  );
}
