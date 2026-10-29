import { BARKEEP } from "@tokenmaxxing/core/barkeep.ts";
import { SPECIAL, specialOn } from "@tokenmaxxing/core/tavern.ts";
import { send } from "../game/input.ts";
import { self } from "../game/world.ts";
import { conn } from "../net.ts";
import { hud } from "../store.ts";
import { Modal } from "./ui.tsx";

/**
 * E on the Tavern's bar: Bent takes your order across it. A coffee and the day's special are free, the same
 * as the coffee machine and the tap; the quest board is behind him too.
 */
export function Bar() {
  const order = (what: "drink" | "tavern") => () => {
    const facing = self()?.facing;
    hud.set({ panel: null });
    if (facing) send(conn[what](facing));
  };
  return (
    <Modal title={`🍺 ${BARKEEP.name}`}>
      <p>What'll it be? It's on the house.</p>
      <nav className="menu">
        <button type="button" onClick={order("drink")}>
          ☕ A coffee
        </button>
        <button type="button" onClick={order("tavern")}>
          {specialOn(new Date())} · {SPECIAL.ms / 60_000} min
        </button>
        <button type="button" onClick={() => hud.set({ panel: { kind: "quests" } })}>
          🧾 Any work going? (quests)
        </button>
      </nav>
    </Modal>
  );
}
