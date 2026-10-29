import { RARITY_COLOR, rarityOf } from "@tokenmaxxing/core/rarity.ts";
import type { Item } from "@tokenmaxxing/core/shop.ts";
import type { CSSProperties } from "react";

/** How rare it is, in its colour, and its line of flavour if it has one; nothing for furniture. */
export function ItemTag({ item }: { item: Item }) {
  if (item.slot === "furniture") return null;
  const rarity = rarityOf(item);
  return (
    <span className="item-tag">
      <span className="rarity" style={{ color: RARITY_COLOR[rarity] }}>
        {rarity}
      </span>
      {item.blurb && <span className="muted"> {item.blurb}</span>}
    </span>
  );
}

/** A bag square's rarity stripe along the bottom. */
export const rarityRing = (item: Item): CSSProperties | undefined =>
  item.slot === "furniture"
    ? undefined
    : { backgroundImage: `linear-gradient(to top, ${RARITY_COLOR[rarityOf(item)]} 3px, transparent 3px)` };
