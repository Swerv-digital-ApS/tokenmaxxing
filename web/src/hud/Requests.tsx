import {
  OPEN_CAP,
  REQUEST_MAX,
  REQUEST_MIN,
  type RequestEntry,
  STATUS_LABEL,
} from "@tokenmaxxing/core/requests.ts";
import { useCallback, useEffect, useState } from "react";
import { world } from "../game/world.ts";
import { town } from "../net.ts";
import { hud } from "../store.ts";
import { Modal, useRun } from "./ui.tsx";

/** The Tavern's request pile: write what you'd like in the game, 👍 what others wrote. The builders read it here. */
export function Requests() {
  const [pile, setPile] = useState<RequestEntry[] | null>(null);
  const load = useCallback(async () => setPile(await town.requests().catch(() => null)), []);
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 15_000);
    return () => clearInterval(t);
  }, [load]);
  const { error, busy, run } = useRun();
  const [text, setText] = useState("");
  const mine =
    pile?.filter((r) => r.userId === world.selfId && (r.status === "open" || r.status === "planned"))
      .length ?? 0;
  const add = run(async () => {
    await town.requestAdd(text);
    setText("");
    await load();
  });
  const vote = (r: RequestEntry) =>
    run(async () => {
      await town.requestVote(r.id, !r.voted);
      await load();
    });
  const withdraw = (r: RequestEntry) =>
    run(async () => {
      await town.requestWithdraw(r.id);
      await load();
    });
  return (
    <Modal title="📌 Request pile" wide>
      <p className="muted small">
        Something you'd like in the game? Pin it here. People who build it read this board, and the ones with
        the most 👍 get looked at first. In a hurry? Type <code>@feedback</code> and your request in the chat.
      </p>
      <form className="request-new" onSubmit={add}>
        <textarea
          aria-label="Your request"
          rows={2}
          maxLength={REQUEST_MAX}
          placeholder="I'd like…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="submit"
          className="primary"
          disabled={busy || [...text.trim()].length < REQUEST_MIN || mine >= OPEN_CAP}
        >
          Pin it
        </button>
      </form>
      <p className="muted small">
        {mine >= OPEN_CAP
          ? `You have ${OPEN_CAP} on the pile: wait for one to be looked at, or take one back.`
          : `${[...text].length}/${REQUEST_MAX}. You can have ${OPEN_CAP} on the pile at once.`}
      </p>
      {error && <p className="error">{error}</p>}
      {!pile ? (
        <p className="muted">Reading the board…</p>
      ) : pile.length === 0 ? (
        <p className="muted">Nothing pinned yet. Be the first.</p>
      ) : (
        <ul className="requests">
          {pile.map((r) => (
            <li key={r.id} className={`request ${r.status}`}>
              <button
                type="button"
                className={r.voted ? "vote on" : "vote"}
                aria-pressed={r.voted}
                aria-label={`${r.voted ? "Take back your 👍 from" : "Give a 👍 to"} "${r.text}"`}
                disabled={busy || r.status === "done" || r.status === "declined"}
                onClick={vote(r)}
              >
                👍 <strong>{r.votes}</strong>
              </button>
              <div className="request-body">
                <p>{r.text}</p>
                <span className="muted small">
                  <button
                    type="button"
                    className="link"
                    onClick={() => hud.set({ panel: { kind: "card", userId: r.userId } })}
                  >
                    {r.name}
                  </button>
                  {r.status !== "open" && (
                    <span className={`status ${r.status}`}> · {STATUS_LABEL[r.status]}</span>
                  )}
                  {r.userId === world.selfId && r.status === "open" && (
                    <>
                      {" · "}
                      <button type="button" className="link" disabled={busy} onClick={withdraw(r)}>
                        take back
                      </button>
                    </>
                  )}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
