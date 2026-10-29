import { type MouseEvent, useState } from "react";
import { errorText } from "../errors.ts";

/** One click, straight to the chat. Emoji burst around you; lines show as a bubble. */
const EMOJIS = ["🚀", "🔥", "🎉", "😂", "👏", "💸", "🤯", "☕", "🫡", "💯", "👀", "🦄"];

const LINES = [
  "Ship it 🚢",
  "LGTM",
  "Works on my machine",
  "We're default alive",
  "Pivot!",
  "Just one more prompt",
  "Context window full, brb",
  "Hockey stick incoming 📈",
  "Is that a feature or a bug?",
  "Let's circle back",
  "Move fast and cache things",
  "It's not a bug, it's a hallucination",
  "Raising a pre-seed in tokens",
  "Burn rate: yes",
  "Agents are cooking 🧑‍🍳",
  "Touch grass? Later.",
];

export function QuickReplies({
  say,
  onError,
}: {
  say: (text: string) => Promise<unknown>;
  onError: (message: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const send = (text: string) => async (e: MouseEvent<HTMLButtonElement>) => {
    // Let go of focus, or Space (jump) would press the button again.
    e.currentTarget.blur();
    onError(null);
    try {
      await say(text);
    } catch (err) {
      onError(errorText(err));
    }
  };

  return (
    <section className="panel quick" aria-label="Quick replies">
      {open && (
        <ul className="quick-lines">
          {LINES.map((line) => (
            <li key={line}>
              <button
                type="button"
                onClick={(e) => {
                  setOpen(false);
                  void send(line)(e);
                }}
              >
                {line}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="quick-emojis">
        {EMOJIS.map((emoji) => (
          <button key={emoji} type="button" aria-label={`Send ${emoji}`} onClick={send(emoji)}>
            {emoji}
          </button>
        ))}
        <button
          type="button"
          className="quick-toggle"
          aria-expanded={open}
          aria-label="One-liners"
          title="One-liners"
          onClick={(e) => {
            e.currentTarget.blur();
            setOpen(!open);
          }}
        >
          💬
        </button>
      </div>
    </section>
  );
}
