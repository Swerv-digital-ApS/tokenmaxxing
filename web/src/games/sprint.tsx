import { secondsUntil } from "@tokenmaxxing/core/format.ts";
import { potShares } from "@tokenmaxxing/core/games/payouts.ts";
import { GRACE_MS, MAX_EXTRA, type SprintView, score, TRACK_WPM } from "@tokenmaxxing/core/games/sprint.ts";
import type { Look } from "@tokenmaxxing/core/world.ts";
import { type KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { characterFrame } from "../art/characters.ts";
import { Pixels } from "../hud/ui.tsx";
import { hud } from "../store.ts";
import type { GameProps } from "./types.ts";

/** Each line of words is this tall (games.css), and three show at once. */
const LINE = 34;
/** Words drawn past the one being typed: plenty for three lines. */
const AHEAD = 40;

/** One key on `typed`, Monkeytype's way: space moves on, backspace stays in the word. */
function edit(words: string[], typed: string, e: KeyboardEvent): string | null {
  const parts = typed.split(" ");
  const i = parts.length - 1;
  const word = parts[i]!;
  if (e.key === " ") return word === "" || i + 1 >= words.length ? typed : `${typed} `;
  if (e.key === "Backspace")
    return [...parts.slice(0, -1), e.altKey || e.ctrlKey ? "" : word.slice(0, -1)].join(" ");
  if (/^[a-z]$/i.test(e.key) && !e.metaKey && !e.ctrlKey)
    return word.length < words[i]!.length + MAX_EXTRA ? typed + e.key.toLowerCase() : typed;
  return null;
}

export function Sprint({ view, info, you, now, move, name, look }: GameProps<SprintView>) {
  const playing = you !== null && view.mine !== null && !view.forfeited.includes(you);
  const [typed, setTyped] = useState(view.mine ?? "");
  const [focused, setFocused] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const live = now >= view.startsAt && now < view.endsAt && !view.over;
  const over = view.over || info.outcome !== null;

  // Sends the text whenever it differs from what the server has: a move dropped on the way goes again.
  const latest = useRef({ typed, mine: view.mine, move });
  latest.current = { typed, mine: view.mine, move };
  const sent = useRef({ text: view.mine ?? "", at: 0 });
  useEffect(() => {
    if (!playing || over) return;
    const id = setInterval(() => {
      const { typed, mine, move } = latest.current;
      const t = Date.now() - hud.get().clockSkew;
      if (t < view.startsAt || t > view.endsAt + GRACE_MS || typed === mine) return;
      if (typed === sent.current.text && Date.now() - sent.current.at < 600) return;
      sent.current = { text: typed, at: Date.now() };
      move({ typed });
    }, 100);
    return () => clearInterval(id);
  }, [playing, over, view.startsAt, view.endsAt]);

  // Ready to type from the countdown on.
  useEffect(() => {
    if (playing && !over) setTimeout(() => input.current?.focus(), 0);
  }, [playing, over]);

  const onKey = (e: KeyboardEvent) => {
    // Tab and Escape leave; everything else is ours.
    if (e.key === "Tab" || e.key === "Escape") return;
    const t = Date.now() - hud.get().clockSkew;
    if (!playing || t < view.startsAt || t >= view.endsAt) return void e.preventDefault();
    const next = edit(view.words, typed, e);
    if (next === null) return;
    e.preventDefault();
    setTyped(next);
  };

  const parts = typed.split(" ");
  const current = playing ? parts.length - 1 : -1;
  const ms = Math.max(0, Math.min(now, view.endsAt) - view.startsAt);
  const mine = playing ? score(view.words, typed, 0, ms) : null;

  return (
    <div className="sprint">
      <div className="sprint-stats">
        {now < view.startsAt ? (
          <span className="sprint-go">Get ready… {secondsUntil(view.startsAt, now)}</span>
        ) : (
          <span className="sprint-time">
            {over || now >= view.endsAt ? "Time's up" : secondsUntil(view.endsAt, now)}
          </span>
        )}
        {mine && now >= view.startsAt && (
          <span>
            <strong>{Math.round(mine.wpm)}</strong> <span className="muted">wpm</span>
          </span>
        )}
        <span className="muted small">{view.seconds}s · lowercase · no punctuation</span>
      </div>
      <Words
        words={view.words}
        parts={playing ? parts : []}
        current={current}
        dim={!live && !over}
        onClick={() => input.current?.focus()}
      >
        {playing && !over && (
          <input
            ref={input}
            className="sprint-input"
            aria-label="Type the words"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value=""
            onChange={() => {}}
            onKeyDown={onKey}
            onPaste={(e) => e.preventDefault()}
            onDrop={(e) => e.preventDefault()}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
        )}
        {playing && !over && !focused && <span className="sprint-hint">Click here to type</span>}
      </Words>
      {over ? (
        <Results view={view} info={info} you={you} name={name} />
      ) : (
        <Lanes view={view} you={you} mine={mine} name={name} look={look} />
      )}
    </div>
  );
}

/** The words, three lines at a time, scrolling as you go. */
function Words({
  words,
  parts,
  current,
  dim,
  onClick,
  children,
}: {
  words: string[];
  parts: string[];
  current: number;
  dim: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const at = useRef<HTMLSpanElement>(null);
  const [top, setTop] = useState(0);
  // The word being typed stays on the second line once past the first.
  useLayoutEffect(() => {
    setTop(Math.max(0, (at.current?.offsetTop ?? 0) - LINE));
  });
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: the input inside takes the keys
    <div className={`sprint-words${dim ? " dim" : ""}`} onClick={onClick}>
      <div className="sprint-lines" style={{ transform: `translateY(-${top}px)` }}>
        {words.slice(0, Math.max(current, 0) + AHEAD).map((w, i) => {
          const typed = parts[i];
          const done = i < current;
          return (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: the words never change
              key={i}
              ref={i === Math.max(current, 0) ? at : undefined}
              className={`sprint-word${i === current ? " now" : ""}${done && typed !== w ? " wrong" : ""}`}
            >
              {Array.from({ length: Math.max(w.length, typed?.length ?? 0) }, (_, j) => {
                const cls =
                  typed === undefined || j >= typed.length
                    ? ""
                    : j >= w.length
                      ? "extra"
                      : typed[j] === w[j]
                        ? "ok"
                        : "bad";
                return (
                  // biome-ignore lint/suspicious/noArrayIndexKey: letters have no identity
                  <span key={j} className={cls}>
                    {i === current && j === typed!.length && <span className="sprint-caret" />}
                    {j < w.length ? w[j] : typed![j]}
                  </span>
                );
              })}
              {i === current && typed!.length >= w.length && <span className="sprint-caret" />}
            </span>
          );
        })}
      </div>
      {children}
    </div>
  );
}

/** Everyone on a track: the flag is TRACK_WPM by the end. */
function Lanes({
  view,
  you,
  mine,
  name,
  look,
}: {
  view: SprintView;
  you: number | null;
  mine: ReturnType<typeof score> | null;
  name: (id: number) => string;
  look: (id: number) => Look;
}) {
  const track = (TRACK_WPM * 5 * view.seconds) / 60;
  return (
    <ul className="sprint-lanes">
      {Object.entries(view.scores).map(([id, sc]) => {
        const p = Number(id);
        // Your own lane moves as you type, not when the server answers.
        const s = p === you && mine ? mine : sc;
        return (
          <li key={p} className={p === you ? "me" : undefined}>
            <span className="sprint-who">
              {name(p)}
              {view.forfeited.includes(p) && " 🏳️"}
            </span>
            <span className="sprint-track">
              <span className="sprint-car" style={{ left: `${Math.min(100, (s.correct / track) * 100)}%` }}>
                {/* Running right, a step for every key. */}
                <Pixels
                  sprite={characterFrame(look(p), "right", s.typed % 2 === 1 ? "walkA" : "walkB")}
                  width={48}
                  height={48}
                />
              </span>
            </span>
            <span className="sprint-wpm">
              {Math.round(s.wpm)} <span className="muted small">wpm</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** WPM, raw, accuracy, place and coins, best first. */
function Results({
  view,
  info,
  you,
  name,
}: {
  view: SprintView;
  info: GameProps<SprintView>["info"];
  you: number | null;
  name: (id: number) => string;
}) {
  const out = info.outcome && "places" in info.outcome ? info.outcome.places : null;
  const shares = out ? potShares(out, info.pot, info.split) : new Map<number, number>();
  const rows = out
    ? out.flatMap((group, i) => group.map((p) => ({ p, place: out.slice(0, i).flat().length + 1 })))
    : Object.keys(view.scores).map((id) => ({ p: Number(id), place: null }));
  return (
    <table className="sprint-results">
      <thead>
        <tr>
          <th />
          <th />
          <th>wpm</th>
          <th>raw</th>
          <th>acc</th>
          <th>🪙</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ p, place }) => {
          const s = view.scores[p]!;
          return (
            <tr key={p} className={p === you ? "me" : undefined}>
              <td>{place ?? "…"}</td>
              <td>
                {name(p)}
                {view.forfeited.includes(p) && " 🏳️"}
              </td>
              <td>
                <strong>{Math.round(s.wpm)}</strong>
              </td>
              <td>{Math.round(s.raw)}</td>
              <td>{s.typed > 0 ? `${Math.round(s.acc)}%` : "–"}</td>
              <td>{shares.get(p) ? `+${shares.get(p)}` : "–"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
