import { casePieceOf } from "@tokenmaxxing/core/case-furniture.ts";
import { ON_SALE, onSale } from "@tokenmaxxing/core/costumes.ts";
import { danceAt } from "@tokenmaxxing/core/dances.ts";
import { editionById } from "@tokenmaxxing/core/editions.ts";
import { dateLabel, HOLIDAYS } from "@tokenmaxxing/core/holidays.ts";
import { homePieceOf } from "@tokenmaxxing/core/home.ts";
import { MAPS } from "@tokenmaxxing/core/maps.ts";
import { withPieces } from "@tokenmaxxing/core/office.ts";
import { petOutfit } from "@tokenmaxxing/core/pets.ts";
import { posterOf } from "@tokenmaxxing/core/posters.ts";
import { ITEMS, type Item, type MerchKind } from "@tokenmaxxing/core/shop.ts";
import { greeting } from "@tokenmaxxing/core/shopkeepers.ts";
import { SHOP_TABS, SHOPS, type ShopId, shopOfRoom } from "@tokenmaxxing/core/shoprooms.ts";
import type { Look } from "@tokenmaxxing/core/world.ts";
import type { BagRow } from "@tokenmaxxing/server/registry";
import { useEffect, useState } from "react";
import { itemFrame } from "../art/characters.ts";
import { posterSprite } from "../art/furniture-posters.ts";
import { goneCompany } from "../art/merch.ts";
import { objectAt } from "../art/objects.ts";
import { C } from "../art/palette.ts";
import { petFrame } from "../art/pets.ts";
import { errorText } from "../errors.ts";
import { refreshMe, refreshWallet, town } from "../net.ts";
import type { IconSpec } from "../render3d/icons.ts";
import { hud, type ShopPageTab, useHud } from "../store.ts";
import { CompanyOrder } from "./CompanyShop.tsx";
import { coins } from "./format.ts";
import { ItemIcon } from "./ItemIcon.tsx";
import { ItemTag } from "./ItemTag.tsx";
import { lootLine, rarityClass } from "./Loot.tsx";
import { isWorn, withItem, withoutMerchTop } from "./lookOps.ts";
import { DecorGoods, DeskGoods } from "./RoomGoods.tsx";
import { ShopDirectory } from "./ShopDirectory.tsx";
import { AvatarImage, Modal, Pills, Pixels, useRun } from "./ui.tsx";

const TABS = [
  ["outfit", "Clothes"],
  ["glasses", "Face"],
  ["hat", "Hats"],
  ["held", "In hand"],
  ["back", "On back"],
  ["pet", "Pets"],
  ["petwear", "Pet gear"],
  ["dance", "Dances"],
  ["furniture", "Furniture"],
  ["decor", "Wallpaper, floors & space"],
  ["desk", "Monitors"],
] as const;

/**
 * The Shop page: only ever the goods of the shop you stand in (its tabs, its keeper, "Leave"). Out in the
 * street there is no shop to open: the directory shows the way instead.
 */
export function Shop(props: { tab?: ShopPageTab }) {
  const shop = useHud((s) => shopOfRoom(s.room));
  return shop ? <ShopPage shop={shop} {...props} /> : <ShopDirectory />;
}

function ShopPage({ shop, tab: first }: { shop: ShopId; tab?: ShopPageTab }) {
  const me = useHud((s) => s.me);
  const [hello] = useState(() => greeting(shop, Math.floor(Math.random() * 8)));
  const tabs = [
    ...TABS.filter(([t]) => (SHOP_TABS[shop] as readonly string[]).includes(t)),
    // Company supplies are for company members: the owner orders, the rest see what is stored.
    ...(shop === "furniture" && me?.company ? ([["company", "🏢 Company"]] as const) : []),
  ];
  const wallet = useHud((s) => s.wallet);
  const opened = useHud((s) => (s.panel?.kind === "shop" ? s.panel.tab : undefined));
  const wanted = first ?? opened;
  const [tab, setTab] = useState<ShopPageTab>(
    tabs.some(([t]) => t === wanted) ? wanted! : (tabs[0]?.[0] ?? "outfit"),
  );
  // Opening the page again on another tab (E on another display) while it is up switches to that tab.
  const known = tabs.some(([t]) => t === wanted);
  useEffect(() => {
    if (known && wanted) setTab(wanted);
  }, [known, wanted]);
  const [bag, setBag] = useState<BagRow[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const { error, run } = useRun();
  useEffect(() => {
    const fail = (e: unknown) => setFailed(errorText(e));
    void refreshWallet().catch(fail);
    void town.bag().then(setBag, fail);
  }, []);
  if (!me || !wallet) return <Modal title={`🛍 ${SHOPS[shop].name}`}>{failed ?? "Loading…"}</Modal>;

  // The first one bought goes on; another is for trading.
  const buy = (item: Item) =>
    run(async () => {
      hud.set({ wallet: await town.buy(item.id) });
      setBag(await town.bag());
      if (!wallet.owned.includes(item.id)) await wearIt(item, me.look, true);
    });

  return (
    <Modal title={`🛍 ${SHOPS[shop].name}`} wide>
      <div className="shop-top">
        <p className="shop-hello">{hello}</p>
        <div className="shop-bar">
          {/* The wallet this tab pays from is the lit one. */}
          <span className={tab === "company" ? "coin-chip" : "coin-chip on"}>
            <strong>{coins(wallet.balance)}</strong> yours
          </span>
          {me.company && (
            <span className={tab === "company" ? "coin-chip on" : "coin-chip"}>
              <strong>{coins(me.company.wallet)}</strong> {me.company.name}
            </span>
          )}
          <button type="button" className="shop-leave" onClick={() => hud.set({ panel: null })}>
            Leave
          </button>
        </div>
        {tabs.length > 1 && <Pills value={tab} options={tabs} onChange={setTab} />}
      </div>
      {tab === "company" ? (
        <CompanyOrder />
      ) : tab === "decor" ? (
        <DecorGoods buy />
      ) : tab === "desk" ? (
        <DeskGoods buy />
      ) : (
        <ul className="shop">
          {ITEMS.filter(
            (i) =>
              i.slot === tab &&
              !editionById(i.id) &&
              !i.earned &&
              !i.company &&
              !i.case &&
              onSale(i, Date.now()),
          ).map((item) => {
            const owned = wallet.owned.includes(item.id);
            const wearing = isWorn(item, me.look);
            const n = bag.find((b) => b.item === item.id)?.count ?? 0;
            return (
              <li
                key={item.id}
                className={`${wearing ? "wearing" : ""}${rarityClass(item)}`.trim() || undefined}
                title={lootLine(item) ?? undefined}
              >
                <ItemImage item={item} look={me.look} />
                <span className="shop-item-name">
                  {item.name}
                  {n > 0 && <span className="muted"> ×{n}</span>}
                </span>
                <ItemTag item={item} />
                {item.loot && (
                  <span className={`small rarity-text-${item.loot.rarity}`}>{lootLine(item)}</span>
                )}
                {item.holiday && (
                  <span className="small">
                    {HOLIDAYS[item.holiday].emoji} {HOLIDAYS[item.holiday].name} only, till{" "}
                    {dateLabel(item.holiday, Date.now(), ON_SALE.after)}
                  </span>
                )}
                {(owned || wearing) && <WearButton item={item} look={me.look} run={run} />}
                {item.slot === "dance" ? (
                  owned ? (
                    <span className="muted small">✓ On your dance bar</span>
                  ) : (
                    <button
                      type="button"
                      className="primary"
                      disabled={wallet.balance < item.price}
                      onClick={buy(item)}
                    >
                      🪙 {item.price}
                    </button>
                  )
                ) : item.loot ? (
                  !owned && (
                    <button type="button" disabled>
                      ⚔️ Raid drop
                    </button>
                  )
                ) : item.level !== undefined ? (
                  !owned && (
                    <button type="button" disabled>
                      🔒 Lv {item.level}
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    className="primary"
                    disabled={wallet.balance < item.price}
                    onClick={buy(item)}
                  >
                    🪙 {item.price}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="error">{error}</p>}
    </Modal>
  );
}

export const wear = async (look: Look) => {
  await town.setLook(look);
  await refreshMe();
};

export { isWorn, withItem, withoutMerchTop };

const wearIt = (item: Item, look: Look, on: boolean) =>
  item.slot === "furniture" || item.slot === "dance" ? Promise.resolve() : wear(withItem(item, look, on));

/** Wear it, or take it off; nothing for furniture or a dance. */
export function WearButton({
  item,
  look,
  run,
}: {
  item: Item;
  look: Look;
  run: ReturnType<typeof useRun>["run"];
}) {
  if (item.slot === "furniture" || item.slot === "dance") return null;
  const on = isWorn(item, look);
  return (
    <button type="button" onClick={run(() => wearIt(item, look, !on))}>
      {on ? "Take off" : "Wear"}
    </button>
  );
}

/** The company a merch item belongs to, as its 3D prop wants it (a stand-in in its colours if it left town). */
const merchCompany = (item: Item): IconSpec & { kind: "merch" } => ({
  kind: "merch",
  company: hud.get().companies.find((c) => c.id === item.companyId) ?? goneCompany(item.companyId ?? 0),
  merch: item.id.split(".")[2] as MerchKind,
});

/** The 3D twin of `ItemSprite`'s picture. */
function itemIcon(item: Item, look: Look, bare?: boolean, worn?: boolean): IconSpec {
  if (item.slot === "pet") {
    const mine = worn && look.pet === item.index;
    return {
      kind: "pet",
      pet: item.index,
      variant: mine ? look.petVariant : 0,
      name: mine ? look.petName : "",
    };
  }
  if (item.slot === "furniture") return { kind: "piece", ch: item.id.slice(5) };
  if (item.slot === "petwear") return { kind: "pet", pet: look.pet || 1, wear: item.index };
  if (bare && item.slot === "merch") return merchCompany(item);
  return {
    kind: "avatar",
    look: withItem(item, look, true),
    focus: bare && (item.slot === "hat" || item.slot === "glasses") ? "head" : "body",
    facing: item.slot === "back" ? "back" : "front",
  };
}

/** An item as it looks: on me (or `bare`, on its own), the pet, or the piece. */
export function ItemImage(props: {
  item: Item;
  look: Look;
  bare?: boolean;
  /** A pet in the look I wear it in, if I wear it (the shop sells the original). */
  worn?: boolean;
}) {
  const { item, look, bare, worn } = props;
  // A dance is a move, not a thing: its emoji, big.
  if (item.slot === "dance")
    return (
      <span className="avatar dance-icon" aria-hidden="true">
        {danceAt(item.index)?.emoji}
      </span>
    );
  return (
    <ItemIcon spec={itemIcon(item, look, bare, worn)} size={64} className="avatar">
      <ItemSprite {...props} />
    </ItemIcon>
  );
}

/** The 2D picture: the pet's frame, the piece as placed, the item's own sprite, or me wearing it. */
function ItemSprite({ item, look, bare, worn }: { item: Item; look: Look; bare?: boolean; worn?: boolean }) {
  if (item.slot === "pet") {
    const mine = worn && look.pet === item.index;
    const sprite = petFrame(
      item.index,
      false,
      false,
      mine ? look.petVariant : 0,
      mine ? petOutfit(look) : null,
    );
    return <SpriteImage sprite={sprite} stand />;
  }
  if (item.slot === "furniture") return <PieceSprite ch={item.id.slice(5)} />;
  if (bare) return <SpriteImage sprite={itemFrame(item)} />;
  // Pet gear on my pet (a duck if I have none); a back item from the side, where it shows.
  if (item.slot === "petwear")
    return <SpriteImage sprite={petFrame(look.pet || 1, false, false, 0, null, item.index)} stand />;
  return (
    <AvatarImage
      look={withItem(item, look, true)}
      scale={4}
      facing={item.slot === "back" ? "right" : "down"}
    />
  );
}

const pieces = new Map<string, HTMLCanvasElement>();

/**
 * A piece's sprite as the world draws it, put down once in an empty office. A rug is only floor, so
 * it's a swatch, standing in the box like a piece.
 */
function pieceSprite(ch: string): HTMLCanvasElement {
  let sprite = pieces.get(ch);
  if (sprite) return sprite;
  // A poster is hung on a wall, not put down on a floor: its own picture.
  const poster = posterOf(ch);
  if (poster) {
    sprite = posterSprite(poster.art);
    pieces.set(ch, sprite);
    return sprite;
  }
  // A personal office's frame or sign is hung on the office's top wall.
  const row = (homePieceOf(ch) ?? casePieceOf(ch))?.wall ? 0 : 1;
  sprite = objectAt(withPieces([{ ch, x: 1, y: row }], MAPS.office), 1, row)?.canvas;
  if (!sprite) {
    sprite = document.createElement("canvas");
    sprite.width = sprite.height = 16;
    const g = sprite.getContext("2d")!;
    g.fillStyle = C.rug;
    g.fillRect(0, 0, 16, 14);
  }
  pieces.set(ch, sprite);
  return sprite;
}

/** A piece as the world draws it, in a two-tile box (three for the widest). */
export function PieceImage({ ch, scale = 2 }: { ch: string; scale?: number }) {
  return (
    <ItemIcon spec={{ kind: "piece", ch }} size={32 * scale} className="avatar">
      <PieceSprite ch={ch} scale={scale} />
    </ItemIcon>
  );
}

function PieceSprite({ ch, scale = 2 }: { ch: string; scale?: number }) {
  const sprite = pieceSprite(ch);
  const box = Math.max(32, sprite.width);
  return (
    <Pixels sprite={sprite} width={box * scale} height={32 * scale} scale={scale} stand className="avatar" />
  );
}

/** A sprite at 4× in a 16×16 box: in the middle, or standing on the bottom (a pet). */
const SpriteImage = ({ sprite, stand }: { sprite: HTMLCanvasElement | null; stand?: boolean }) => (
  <Pixels sprite={sprite} width={64} height={64} scale={4} stand={stand} className="avatar" />
);
