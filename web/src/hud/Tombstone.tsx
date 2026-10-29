import { epitaphOf } from "@tokenmaxxing/core/graveyard.ts";
import type { CSSProperties } from "react";
import { stoneById } from "../game/graveyard.ts";
import { Modal } from "./ui.tsx";

/** What a tombstone in the model graveyard says: who lies there, who made them, when they were listed and their last price. */
export function TombstonePanel({ id }: { id: string }) {
  const stone = stoneById(id);
  if (!stone)
    return <Modal title="🪦 Here lies">The stone has weathered away. Only the newest ones stand.</Modal>;
  const e = epitaphOf(stone);
  return (
    <Modal title={e.title}>
      <article className="tombstone" style={{ "--accent": e.accent } as CSSProperties}>
        <p className="tombstone-provider">{e.provider}</p>
        <h3>{e.name}</h3>
        <p className="tombstone-id">{e.id}</p>
        <p className="tombstone-dates">{e.dates}</p>
        <p className="tombstone-price">{e.price}</p>
        <p className="tombstone-epitaph">“{e.epitaph}”</p>
      </article>
    </Modal>
  );
}
