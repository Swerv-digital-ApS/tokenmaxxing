import { SHOPS, type ShopId, shopOfRoom } from "@tokenmaxxing/core/shoprooms.ts";
import { useState } from "react";
import { goToShopDoor } from "../game/input.ts";
import { hud, useHud } from "../store.ts";
import { SHOP_DIRECTORY } from "./shops.ts";
import { Modal } from "./ui.tsx";

/** "Take me there": starts the auto-walk to a shop's door, or says why it can't. */
export function TakeMeThere({
  shop,
  label = "Take me there",
  className = "primary",
  title,
}: {
  shop: ShopId;
  label?: string;
  className?: string;
  title?: string;
}) {
  const [gone, setGone] = useState(false);
  return (
    <>
      <button
        type="button"
        className={className || undefined}
        title={title}
        onClick={() => {
          if (goToShopDoor(shop)) return;
          setGone(true);
        }}
      >
        {label}
      </button>
      {gone && <span className="error small"> {SHOPS[shop].name} has no door in town right now.</span>}
    </>
  );
}

/**
 * "Buy at Møbelhuset" for the panels that no longer sell (My room): the way to the shop's door, or, standing
 * in the shop already, the tab that sells it.
 */
export function BuyAtMobelhuset({ tab }: { tab: "decor" | "desk" | "company" }) {
  const here = useHud((s) => shopOfRoom(s.room) === "furniture");
  return (
    <p className="buy-at">
      {here ? (
        <button type="button" className="primary" onClick={() => hud.set({ panel: { kind: "shop", tab } })}>
          Buy in this shop
        </button>
      ) : (
        <TakeMeThere shop="furniture" label="Buy at Møbelhuset" />
      )}
    </p>
  );
}

/** The shops of the town: what each sells, and a way there. Buying is done inside them. */
export function ShopDirectory() {
  return (
    <Modal title="🧭 Shops">
      <p className="muted small">
        Everything is bought in person. Pick a shop and walk in; the shopkeeper has the goods. Your Bag shows
        what you own and lets you wear it.
      </p>
      <ul className="members">
        {SHOP_DIRECTORY.map((s) => (
          <li key={s.id}>
            <span>
              <strong>{s.name}</strong>{" "}
              <span className="muted small">
                · {s.sign} · {s.keeper}
              </span>
              <br />
              <span className="muted small">{s.sells}</span>
            </span>
            <TakeMeThere shop={s.id} />
          </li>
        ))}
      </ul>
      <p className="muted small">
        <button type="button" className="link" onClick={() => hud.set({ panel: { kind: "bag" } })}>
          🎒 Bag
        </button>
      </p>
    </Modal>
  );
}
