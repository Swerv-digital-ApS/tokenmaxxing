/**
 * Torvehallen's live layer: what other players have put on display, standing on the hall's shelves and in its
 * glass cases. The hall itself (`market.ts`) is built once; this reads `hud.market` (the listings on display now)
 * and, for each, puts the item's picture on its slot with a price tag under it. A slot is a display tile of the
 * hall's plan (`core/src/market.ts`), and the plan's tile is the room's tile plus the world-grid inset, so a
 * slot's place is `slotTile(slot)` minus `SHOP_INSET` (the same tiles the static shell is built on).
 *
 * Each listing is one upright card, a single draw call: the item's HUD icon (`render3d/icons.ts`, the same voxel
 * pictures the Bag and the shops show) over a small price tag with a rarity-coloured edge, turned to face the
 * camera. The card shows its tag at once and its picture when the icon queue gets to it. Slots with nothing on
 * them show a faint dashed marker, all in one instanced draw call. Nothing is rebuilt unless a listing came,
 * went or changed (the other agent's poll hands over a new object every few seconds, equal or not).
 */

import { danceAt } from "@tokenmaxxing/core/dances.ts";
import { type Listing, MARKET_SLOTS, slotTile } from "@tokenmaxxing/core/market.ts";
import { RARITY_COLOR, type Rarity, rarityOf } from "@tokenmaxxing/core/rarity.ts";
import { type Item, itemById } from "@tokenmaxxing/core/shop.ts";
import { SHOP_INSET } from "@tokenmaxxing/core/shoprooms.ts";
import type { Look } from "@tokenmaxxing/core/world.ts";
import * as THREE from "three";
import { withItem } from "../../hud/lookOps.ts";
import { hud } from "../../store.ts";
import { disposeObject } from "../engine/dispose.ts";
import type { IconSpec } from "../icons.ts";
import type { LiveFrame } from "../rooms/rooms.ts";

// MARK: Where things stand

/** How high the surface a slot's item stands on is: the back wall's shelf tops and the glass cases' floors. */
export const SHELF_Y = 0.5;
export const CASE_Y = 0.38;

/** The row of the plan the back wall's shelves are on (the plan's first floor row). */
const SHELF_ROW = 2;

export interface Spot {
  /** The middle of the slot's tile, in the room's own units. */
  x: number;
  z: number;
  /** The surface the item stands on. */
  y: number;
  /** On the back wall's shelf (against the wall) and not in a case. */
  shelf: boolean;
}

/** Where slot `slot` is in the hall, or null if there is no such slot. */
export function slotSpot(slot: number): Spot | null {
  const tile = slotTile(slot);
  if (!tile) return null;
  const shelf = tile[1] === SHELF_ROW;
  return {
    x: tile[0] - SHOP_INSET[0] + 0.5,
    z: tile[1] - SHOP_INSET[1] + 0.5,
    y: shelf ? SHELF_Y : CASE_Y,
    shelf,
  };
}

// MARK: The card

/** The card's picture in pixels: a square for the item and a strip for the tag under it. */
const CARD_W = 128;
const ICON_H = 128;
const TAG_H = 40;
const CARD_H = ICON_H + TAG_H;
/** The card's width in world units (a tile is 1; the camera is turned 45 degrees, so neighbours must clear 0.7). */
const CARD_UNITS = 0.64;
/** How far above the surface a card's bottom edge floats. */
const LIFT = 0.02;
/** The tag's creams and browns, and the coin's gold. */
const TAG_PAPER = "#fff6dd";
const TAG_INK = "#3a2a14";
const COIN = "#f5c542";
const COIN_EDGE = "#b98a10";

/** The icon an item gets on a card: the HUD's own pictures, of the item alone (not on the player). */
const BARE_LOOK: Look = {
  style: 0,
  skin: 0,
  hair: 0,
  outfit: 0,
  glasses: 0,
  hat: 0,
  pet: 0,
  held: 0,
  back: 0,
  petwear: 0,
  petVariant: 0,
  merch: 0,
  merchWorn: 0,
};

/** The 3D picture of a thing on display, or null for the few with none (a dance is its emoji). */
export function iconOf(item: Item): IconSpec | null {
  switch (item.slot) {
    case "dance":
    case "merch":
      return null;
    case "pet":
      return { kind: "pet", pet: item.index, variant: 0 };
    case "petwear":
      return { kind: "pet", pet: 1, wear: item.index };
    case "furniture":
      return { kind: "piece", ch: item.id.slice(5) };
    default:
      return {
        kind: "avatar",
        look: withItem(item, BARE_LOOK, true),
        focus: item.slot === "hat" || item.slot === "glasses" ? "head" : "body",
        facing: item.slot === "back" ? "back" : "front",
      };
  }
}

/** A soft glow in the rarity's colour behind the item: nothing for common, a little more for each step up. */
const GLOW: Record<Rarity, number> = { common: 0, uncommon: 0.12, rare: 0.2, epic: 0.28, legendary: 0.38 };

/** A round-cornered rectangle path. */
function pill(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** One listing's card, drawn: the glow and shadow, the item's picture (or a stand-in), and the price tag. */
export function paintCard(
  g: CanvasRenderingContext2D,
  listing: Pick<Listing, "price" | "edition">,
  rarity: Rarity,
  picture: CanvasImageSource | string | null,
): void {
  g.clearRect(0, 0, CARD_W, CARD_H);
  const color = RARITY_COLOR[rarity];
  // The glow, and the soft shadow the item stands in.
  if (GLOW[rarity] > 0) {
    const r = g.createRadialGradient(CARD_W / 2, ICON_H * 0.55, 4, CARD_W / 2, ICON_H * 0.55, ICON_H * 0.5);
    r.addColorStop(
      0,
      `${color}${Math.round(GLOW[rarity] * 255)
        .toString(16)
        .padStart(2, "0")}`,
    );
    r.addColorStop(1, `${color}00`);
    g.fillStyle = r;
    g.fillRect(0, 0, CARD_W, ICON_H);
  }
  g.fillStyle = "rgba(40, 24, 8, 0.2)";
  g.beginPath();
  g.ellipse(CARD_W / 2, ICON_H - 8, CARD_W * 0.3, 7, 0, 0, Math.PI * 2);
  g.fill();
  // The item: its icon, or its emoji, or (while the icon waits) a faint gift box.
  g.textAlign = "center";
  g.textBaseline = "middle";
  if (typeof picture === "string") {
    g.font = `${ICON_H * 0.55}px system-ui, sans-serif`;
    g.fillText(picture, CARD_W / 2, ICON_H * 0.5);
  } else if (picture) g.drawImage(picture, 0, 0, CARD_W, ICON_H);
  else {
    g.fillStyle = `${color}55`;
    pill(g, CARD_W * 0.3, ICON_H * 0.3, CARD_W * 0.4, ICON_H * 0.4, 8);
    g.fill();
  }
  // The tag: cream paper with the rarity's colour round it, a coin and the price, and the copy's number.
  const y = ICON_H + 2;
  const h = TAG_H - 4;
  pill(g, 3, y, CARD_W - 6, h, 8);
  g.fillStyle = TAG_PAPER;
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = color;
  g.stroke();
  const mid = y + h / 2 + 1;
  g.beginPath();
  g.arc(22, mid, 9, 0, Math.PI * 2);
  g.fillStyle = COIN;
  g.fill();
  g.lineWidth = 2;
  g.strokeStyle = COIN_EDGE;
  g.stroke();
  g.beginPath();
  g.arc(22, mid, 4, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = TAG_INK;
  g.textAlign = "left";
  g.font = "900 22px system-ui, sans-serif";
  const ed = listing.edition;
  g.fillText(listing.price.toLocaleString("en-US"), 36, mid + 1, ed ? 48 : 84);
  if (ed) {
    g.textAlign = "right";
    g.font = "800 13px system-ui, sans-serif";
    g.fillStyle = "#7a5a1e";
    g.fillText(`#${ed.n}/${ed.supply}`, CARD_W - 10, mid + 1, 40);
  }
}

// MARK: The free-slot marker

/** A dashed square with a plus in it, lying on the surface: drawn once for every free slot. */
function markerTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.strokeStyle = "#7a5a36";
  g.lineWidth = 3;
  g.setLineDash([7, 6]);
  pill(g, 6, 6, 52, 52, 10);
  g.stroke();
  g.setLineDash([]);
  g.lineWidth = 4;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(32, 22);
  g.lineTo(32, 42);
  g.moveTo(22, 32);
  g.lineTo(42, 32);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// MARK: The layer

const DIR = new THREE.Vector3();

let cardGeometry: THREE.PlaneGeometry | null = null;
/** A unit card with its origin at the bottom middle, shared by every card (so freeing a room leaves it). */
function cardPlane(): THREE.PlaneGeometry {
  if (!cardGeometry) {
    cardGeometry = new THREE.PlaneGeometry(1, 1);
    cardGeometry.translate(0, 0.5, 0);
    cardGeometry.userData.shared = true;
  }
  return cardGeometry;
}

interface Shown {
  key: string;
  mesh: THREE.Mesh;
  texture: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
  /** Gives up on the icon still being drawn. */
  cancel: () => void;
}

/** What makes two listings the same card. */
const keyOf = (l: Listing): string => `${l.id}:${l.slot}:${l.item}:${l.price}:${l.edition?.n ?? 0}`;

/** The part of the icons module the layer uses. */
type Icons = Pick<typeof import("../icons.ts"), "iconsAvailable" | "requestIcon">;
let icons: Promise<Icons> | null = null;
/** The icons module, fetched once and only when a listing needs a picture. */
const loadIcons = (): Promise<Icons> => (icons ??= import("../icons.ts"));

export class MarketSlots {
  readonly group = new THREE.Group();
  private readonly shown = new Map<number, Shown>();
  private readonly marks: THREE.InstancedMesh;
  private readonly markTexture = markerTexture();
  private last: unknown = undefined;
  private fingerprint = "";
  private yaw = Number.NaN;
  private gone = false;

  /** `icons` is where the pictures come from (the HUD's icon queue; tests give it their own). */
  constructor(private readonly icons: () => Promise<Icons> = loadIcons) {
    this.group.name = "market-slots";
    // Never merged into the room's batches: it changes as the market does.
    this.group.userData.live = true;
    this.group.userData.nobatch = true;
    const mark = new THREE.MeshBasicMaterial({
      map: this.markTexture,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    const flat = new THREE.PlaneGeometry(0.5, 0.5);
    flat.rotateX(-Math.PI / 2);
    this.marks = new THREE.InstancedMesh(flat, mark, MARKET_SLOTS);
    this.marks.count = 0;
    this.marks.frustumCulled = false;
    this.group.add(this.marks);
  }

  /** Once a frame: turns the cards to the camera, and brings them up to date when the market changed. */
  update(f: LiveFrame): void {
    if (this.gone) return;
    const market = hud.get().market;
    if (market !== this.last) {
      this.last = market;
      this.sync(market?.listings ?? null);
    }
    const dir = f.camera.getWorldDirection(DIR);
    const yaw = Math.atan2(-dir.x, -dir.z);
    if (Math.abs(yaw - this.yaw) < 1e-3) return;
    this.yaw = yaw;
    for (const s of this.shown.values()) s.mesh.rotation.y = yaw;
  }

  /** Puts the cards and markers of `listings` on the slots; only what differs is built or freed. */
  private sync(listings: readonly Listing[] | null): void {
    // Nothing known yet (before the first answer): leave the hall as it is rather than call every slot free.
    if (!listings) return;
    const fingerprint = listings.map(keyOf).sort().join("|");
    if (fingerprint === this.fingerprint) return;
    this.fingerprint = fingerprint;
    const by = new Map(listings.map((l) => [l.slot, l]));
    for (const [slot, s] of this.shown) {
      const l = by.get(slot);
      if (l && keyOf(l) === s.key) continue;
      this.drop(slot, s);
    }
    for (const l of listings) if (!this.shown.has(l.slot)) this.show(l);
    this.mark(by);
  }

  private show(l: Listing): void {
    const spot = slotSpot(l.slot);
    if (!spot) return;
    const item = itemById(l.item);
    const rarity = item ? rarityOf(item) : "common";
    const canvas = document.createElement("canvas");
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    const g = canvas.getContext("2d")!;
    const emoji = item?.slot === "dance" ? (danceAt(item.index)?.emoji ?? null) : null;
    paintCard(g, l, rarity, emoji);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const mesh = new THREE.Mesh(
      cardPlane(),
      new THREE.MeshBasicMaterial({ map: texture, alphaTest: 0.4, side: THREE.DoubleSide }),
    );
    mesh.scale.set(CARD_UNITS, (CARD_UNITS * CARD_H) / CARD_W, 1);
    mesh.position.set(spot.x, spot.y + LIFT, spot.z);
    mesh.rotation.y = Number.isNaN(this.yaw) ? Math.PI / 4 : this.yaw;
    mesh.name = `market-slot-${l.slot}`;
    mesh.userData.live = true;
    this.group.add(mesh);
    const shown: Shown = { key: keyOf(l), mesh, texture, canvas, cancel: () => {} };
    this.shown.set(l.slot, shown);
    const spec = item && !emoji ? iconOf(item) : null;
    if (spec) this.fetch(shown, l, rarity, spec);
  }

  /** Asks for the item's picture and repaints the card with it when it comes; a refusal keeps the stand-in. */
  private fetch(s: Shown, l: Listing, rarity: Rarity, spec: IconSpec): void {
    let live = true;
    s.cancel = () => {
      live = false;
    };
    void this.icons().then(
      (m) => {
        if (!live || !m.iconsAvailable()) return;
        const r = m.requestIcon(spec, 64);
        s.cancel = () => {
          live = false;
          r.cancel();
        };
        void r.promise.then(
          (picture) => {
            if (!live || this.gone) return;
            paintCard(s.canvas.getContext("2d")!, l, rarity, picture);
            s.texture.needsUpdate = true;
          },
          () => {},
        );
      },
      () => {},
    );
  }

  private drop(slot: number, s: Shown): void {
    s.cancel();
    s.mesh.removeFromParent();
    disposeObject(s.mesh);
    this.shown.delete(slot);
  }

  /** The faint marker on every slot with nothing on it. */
  private mark(taken: ReadonlyMap<number, Listing>): void {
    const at = new THREE.Matrix4();
    let n = 0;
    for (let slot = 0; slot < MARKET_SLOTS; slot++) {
      const spot = taken.has(slot) ? null : slotSpot(slot);
      if (!spot) continue;
      this.marks.setMatrixAt(n++, at.makeTranslation(spot.x, spot.y + 0.005, spot.z));
    }
    this.marks.count = n;
    this.marks.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.gone = true;
    for (const s of this.shown.values()) s.cancel();
    this.shown.clear();
    this.group.removeFromParent();
    disposeObject(this.group);
    this.marks.dispose();
  }
}
