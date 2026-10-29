import { type Item, itemById } from "@tokenmaxxing/core/shop.ts";
import { pieceOfDrop } from "@tokenmaxxing/core/world.ts";
import { useEffect, useState } from "react";
import { ghost, startPlace } from "../game/furniture.ts";
import { world } from "../game/world.ts";
import { town } from "../net.ts";
import { hud, useHud } from "../store.ts";
import { merchName } from "./Merch.tsx";
import { ItemImage } from "./Shop.tsx";

/** Slots on the bar, as many as there are number keys. The rest are a click away in the bag. */
const SLOTS = 9;

/**
 * In your own office, holding things to put down: a bar of them along the bottom, as in Minecraft, each with how
 * many you hold. A click (or its number key) picks one up to place: the ghost follows the pointer, a click puts it
 * down. The bar follows the bag: a piece put down, bought or traded shows at once.
 */
export function Hotbar() {
  const mine = useHud((s) => s.room === `office:${world.selfId}`);
  const wallet = useHud((s) => s.wallet);
  const me = useHud((s) => s.me);
  const panel = useHud((s) => s.panel);
  // A dialog comes and goes as placing starts and ends: the slot being placed lights up with it.
  useHud((s) => s.dialog);
  const [rows, setRows] = useState<{ item: Item; count: number }[]>([]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a changed wallet is a piece put down, bought or traded
  useEffect(() => {
    if (!mine) return;
    let live = true;
    void town.bag().then(
      (bag) =>
        live &&
        setRows(
          bag.flatMap((b) => {
            const item = itemById(b.item);
            return item && pieceOfDrop({ item: b.item }) ? [{ item, count: b.count }] : [];
          }),
        ),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [mine, wallet]);
  const shown = rows.slice(0, SLOTS);
  // 1 to 9 pick up the piece in that slot, unless a panel is open or a field is being typed in.
  useEffect(() => {
    if (!mine) return;
    const key = (e: KeyboardEvent) => {
      const n = Number(e.key);
      const target = e.target as HTMLElement | null;
      if (!Number.isInteger(n) || n < 1 || n > shown.length || e.metaKey || e.ctrlKey || e.altKey) return;
      if (hud.get().panel || target?.closest("input, textarea, [contenteditable]")) return;
      e.preventDefault();
      startPlace(shown[n - 1]!.item.id);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [mine, shown]);
  if (!mine || !me || panel || rows.length === 0) return null;
  const placing = ghost.mode?.kind === "place" ? ghost.mode.item : null;

  return (
    <div className="hotbar" role="toolbar" aria-label="Things to put down">
      {shown.map(({ item, count }, i) => (
        <button
          key={item.id}
          type="button"
          className={placing === item.id ? "slot on" : "slot"}
          aria-pressed={placing === item.id}
          aria-label={`${merchName(item)} ×${count}, key ${i + 1}`}
          title={`${merchName(item)} ×${count} (${i + 1})`}
          onClick={() => startPlace(item.id)}
        >
          <ItemImage item={item} look={me.look} bare />
          <span className="key">{i + 1}</span>
          {count > 1 && <span className="n">{count}</span>}
        </button>
      ))}
      {rows.length > SLOTS && (
        <button
          type="button"
          className="slot more"
          title="The rest of what you hold"
          onClick={() => hud.set({ panel: { kind: "bag", tab: "things" } })}
        >
          +{rows.length - SLOTS}
        </button>
      )}
    </div>
  );
}
