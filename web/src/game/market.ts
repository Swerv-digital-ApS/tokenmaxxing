/**
 * Torvehallen in the 2D game: what is on display. Each listing is its item standing in its case or on its
 * shelf, with a price tag on the front (gold for mine); a free slot is left as the room draws it. What you
 * are facing says what it is. The listings come from `net.ts` `refreshMarket`, every few seconds in the hall.
 */
import { casePieceOf } from "@tokenmaxxing/core/case-furniture.ts";
import { homePieceOf } from "@tokenmaxxing/core/home.ts";
import { MAPS } from "@tokenmaxxing/core/maps.ts";
import { type Listing, slotAt, slotTile } from "@tokenmaxxing/core/market.ts";
import { withPieces } from "@tokenmaxxing/core/office.ts";
import { posterOf } from "@tokenmaxxing/core/posters.ts";
import { itemById } from "@tokenmaxxing/core/shop.ts";
import { DIRS, TILE } from "@tokenmaxxing/core/world.ts";
import { itemFrame } from "../art/characters.ts";
import { posterSprite } from "../art/furniture-posters.ts";
import { caseGlass, casePart, priceTag, SLOT_LOOK } from "../art/market.ts";
import { objectAt } from "../art/objects.ts";
import { petFrame } from "../art/pets.ts";
import { hud } from "../store.ts";
import { type Frame, inView } from "./frame.ts";
import { pill } from "./labels.ts";
import { self, world } from "./world.ts";

/** The listings are read again every 5 s while in the hall; older than this and the shelves are left bare. */
const STALE_MS = 30_000;

const sprites = new Map<string, HTMLCanvasElement | null>();

/** An item's picture for a shelf: a pet as it sits, a piece as the world draws it, else the item's own sprite. */
function spriteOf(id: string): HTMLCanvasElement | null {
  if (sprites.has(id)) return sprites.get(id) ?? null;
  const item = itemById(id);
  let sprite: HTMLCanvasElement | null | undefined = null;
  if (!item || item.slot === "dance") sprite = null;
  else if (item.slot === "pet") sprite = petFrame(item.index, false, false);
  else if (item.slot === "furniture") {
    const ch = item.id.slice(5);
    const poster = posterOf(ch);
    // A frame or sign hangs on the office's top wall, the rest stands on its floor.
    const row = (homePieceOf(ch) ?? casePieceOf(ch))?.wall ? 0 : 1;
    sprite = poster
      ? posterSprite(poster.art)
      : objectAt(withPieces([{ ch, x: 1, y: row }], MAPS.office), 1, row)?.canvas;
  } else sprite = itemFrame(item);
  sprites.set(id, sprite ?? null);
  return sprite ?? null;
}

/** What a listing says about itself in a line, for the one you face. */
export function listingLine(l: Listing): string {
  const name = itemById(l.item)?.name ?? l.item;
  const number = l.edition ? ` #${l.edition.n}` : "";
  return `${name}${number} · 🪙 ${l.price.toLocaleString()} · ${l.seller}`;
}

export function drawMarket(f: Frame): void {
  const { g, items, labels, toScreen, dpr } = f;
  if (world.room !== "shop-market") return;
  const market = hud.get().market;
  const now = Date.now();
  const listings = market && now - market.at < STALE_MS ? market.listings : [];
  const map = world.map;
  for (const l of listings) {
    const tile = slotTile(l.slot);
    if (!tile || l.expiresAt <= now) continue;
    const [x, y] = tile;
    const px = x * TILE;
    const py = y * TILE;
    if (!inView(f, px, py - TILE, TILE, TILE * 2)) continue;
    const shelf = map.at(x, y - 1) === "W";
    const look = shelf ? SLOT_LOOK.shelf : SLOT_LOOK.case;
    const sprite = spriteOf(l.item);
    const part = casePart(map.at(x - 1, y) === map.at(x, y), map.at(x + 1, y) === map.at(x, y));
    const tag = priceTag(l.price, l.sellerId === world.selfId);
    // Whole fractions of the picture only (1, 1/2, 1/3), so no pixel is drawn twice as wide as its neighbour.
    const k = sprite ? 1 / Math.ceil(Math.max(sprite.width / (TILE - 2), sprite.height / look.fit)) : 1;
    items.push({
      // Just after the case or shelf itself, and before whoever stands in front of it.
      y: py + TILE - 0.9,
      draw: () => {
        if (sprite) {
          const w = Math.round(sprite.width * k);
          const h = Math.round(sprite.height * k);
          g.drawImage(sprite, px + Math.floor((TILE - w) / 2), py + look.floor - h, w, h);
        }
        if (!shelf) g.drawImage(caseGlass(part), px, py);
        g.drawImage(tag, px + Math.floor((TILE - tag.width) / 2), py + look.tag);
      },
    });
  }

  // What I am facing: the listing's line, or that the spot is free.
  const me = self();
  if (!me) return;
  const [dx, dy] = DIRS[me.facing];
  const slot = slotAt(me.x + dx, me.y + dy);
  if (slot === null) return;
  const l = listings.find((x) => x.slot === slot && x.expiresAt > now);
  const [sx, sy] = toScreen((me.x + dx + 0.5) * TILE, (me.y + dy) * TILE - 5);
  labels.push(() => {
    if (l) pill(g, sx, sy, `${listingLine(l)} · E`, dpr, "rgba(27, 31, 42, 0.88)", "#f4f1ea");
    else pill(g, sx, sy, "Free spot · E to put something here", dpr, "rgba(27, 31, 42, 0.7)", "#a7adbb");
  });
}
