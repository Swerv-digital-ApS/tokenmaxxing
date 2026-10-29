import type { Progress } from "@tokenmaxxing/core/quests.ts";
import { useEffect, useState } from "react";
import { refreshQuests } from "../net.ts";
import { useHud } from "../store.ts";
import { Modal, Pills } from "./ui.tsx";

/** A bar for `value` of `target`. */
function Bar({ value, target, done }: { value: number; target: number; done: boolean }) {
  return (
    <span className={`quest-bar${done ? " done" : ""}`} aria-hidden>
      <span style={{ width: `${Math.min(100, (value / target) * 100)}%` }} />
    </span>
  );
}

const count = (q: Progress): string =>
  q.target === 1 ? (q.done ? "1/1" : "0/1") : `${q.value.toLocaleString()}/${q.target.toLocaleString()}`;

const TABS = [
  ["today", "Today"],
  ["weekly", "Weekly"],
] as const;

/** Today's three quests and the week's, with how far each is. Coins only; they don't match into the company wallet. */
export function Quests() {
  const board = useHud((s) => s.questBoard);
  // Fresh on open, and with every wallet poll (the counters move as you play).
  const quests = useHud((s) => s.wallet?.quests);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new `quests` is the cue to ask again
  useEffect(() => void refreshQuests(), [quests]);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("today");
  if (!board) return <Modal title="🧾 Quests">Reading the board…</Modal>;
  const w = board.weekly;
  return (
    <Modal title="🧾 Quests">
      <Pills value={tab} options={TABS} onChange={setTab} />
      {tab === "today" ? (
        <>
          <p className="muted small">
            Three a day, picked for how you work. New ones at midnight (Copenhagen).
          </p>
          <ul className="quests">
            {board.daily.map((q) => (
              <li key={q.id} className={q.done ? "done" : ""}>
                <span>
                  {q.done ? "✓" : q.town ? "🚶" : "•"} {q.text}
                </span>
                <span className="coins">🪙 {q.coins}</span>
                <Bar value={q.value} target={q.target} done={q.done} />
                <span className="muted small">{count(q)}</span>
              </li>
            ))}
          </ul>
          <p className="muted small">Paid today: 🪙 {board.paid}</p>
        </>
      ) : (
        <ul className="quests">
          <li className={w.done ? "done" : ""}>
            <span>
              {w.done ? "✓" : "★"} {w.text}
            </span>
            <span className="coins">🪙 {w.coins}</span>
            <Bar value={w.value} target={w.target} done={w.done} />
            <span className="muted small">
              {w.value}/{w.target}
            </span>
          </li>
        </ul>
      )}
    </Modal>
  );
}
