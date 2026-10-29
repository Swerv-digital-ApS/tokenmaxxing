import { PET_COOLDOWN_MS, type PetAct, TREAT_COST, TREATS_PER_DAY } from "@tokenmaxxing/core/pets.ts";
import { type MouseEvent, useState } from "react";
import { errorText } from "../errors.ts";
import { conn, refreshWallet } from "../net.ts";
import { hud, useHud } from "../store.ts";

const ACTS: [PetAct, string, string][] = [
  ["pet", "🤚", "Pet"],
  ["treat", "🍖", `Treat · 🪙${TREAT_COST}`],
  ["trick", "⭐", "Trick"],
];

/** When I last tried each, to grey its button for the wait (the server decides; a reload forgets this, not the rule). */
const lastTry: Partial<Record<PetAct, number>> = {};

/**
 * What you can do with your pet, over the world (not a panel, so it stays in sight and you can still walk): a
 * stroke and a trick are free, a treat costs coins and is capped per day. Everyone in the room sees the
 * pet react. Opened by clicking your pet, P, or the 🐾 in the dance bar.
 */
export function PetMenu() {
  const open = useHud((s) => s.petMenu);
  const pet = useHud((s) => s.me?.look.pet);
  const name = useHud((s) => s.me?.look.petName);
  const [problem, setProblem] = useState<string | null>(null);
  const [, wait] = useState(0);
  if (!open || !pet) return null;

  const play = (act: PetAct) => async (e: MouseEvent<HTMLButtonElement>) => {
    // Let go of focus, or Space (jump) would press the button again.
    e.currentTarget.blur();
    lastTry[act] = Date.now();
    wait((n) => n + 1);
    setTimeout(() => wait((n) => n + 1), PET_COOLDOWN_MS[act] + 50);
    try {
      setProblem(await conn.petPlay(act));
    } catch (err) {
      setProblem(errorText(err));
    }
    if (act === "treat") void refreshWallet().catch(() => {});
  };

  return (
    <section className="panel pet-menu" aria-label="Your pet">
      <header>
        <strong>🐾 {name || "Your pet"}</strong>
        <button
          type="button"
          className="close"
          aria-label="Close"
          onClick={() => hud.set({ petMenu: false })}
        >
          ✕
        </button>
      </header>
      <div className="acts">
        {ACTS.map(([act, icon, label]) => (
          <button
            key={act}
            type="button"
            title={act === "treat" ? `🪙 ${TREAT_COST} each, up to ${TREATS_PER_DAY} a day` : undefined}
            disabled={Date.now() - (lastTry[act] ?? 0) < PET_COOLDOWN_MS[act]}
            onClick={play(act)}
          >
            {icon} {label}
          </button>
        ))}
      </div>
      {problem && (
        <p role="alert" className="muted small">
          {problem}
        </p>
      )}
    </section>
  );
}
