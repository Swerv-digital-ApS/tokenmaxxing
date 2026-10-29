import type { ShopId } from "@tokenmaxxing/core/shoprooms.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { marketFront } from "./market.ts";
import { natmarkedFront } from "./natmarked.ts";
import { C } from "./palette.ts";
import { bake, cached, hash, once, type Pen } from "./pixels.ts";

/**
 * The four shops' art: the storefront for the town (5×4 tiles), and the tiles inside (the counter, each
 * shop's display and the plain fixtures). Small and flat on purpose, so the Low tier has the shops as
 * well as the 3D game does. Baked once; `objects.ts` places them.
 */

interface Skin {
  wall: string;
  wallDark: string;
  awning: [string, string];
  sign: string;
  text: string;
  name: string;
}

const SKINS: Record<ShopId, Skin> = {
  furniture: {
    wall: "#e8dcc4",
    wallDark: "#cdbf9f",
    awning: ["#3f8f8a", "#f1e6d2"],
    sign: "#2f5f5c",
    text: "MOBELHUSET",
    name: "furniture",
  },
  clothes: {
    wall: "#f1d9e4",
    wallDark: "#d9b8c9",
    awning: ["#9b4f8f", "#f4efe4"],
    sign: "#6b3563",
    text: "THREAD & TOKEN",
    name: "clothes",
  },
  barber: {
    wall: "#e4e9ef",
    wallDark: "#c3ccd6",
    awning: ["#c8483f", "#fbf7ef"],
    sign: "#2f4468",
    text: "BARBER",
    name: "barber",
  },
  natmarked: {
    wall: "#4a3226",
    wallDark: "#33231b",
    awning: ["#d8402f", "#f4efe4"],
    sign: "#14101c",
    text: "NATMARKED",
    name: "natmarked",
  },
  market: {
    wall: "#9c5a45",
    wallDark: "#7e4636",
    awning: ["#2f6b4f", "#f4efe4"],
    sign: "#1f4a38",
    text: "TORVEHALLEN",
    name: "market",
  },
  pets: {
    wall: "#e3efd3",
    wallDark: "#bfd4a6",
    awning: ["#58a04a", "#fbf7ef"],
    sign: "#3a6a30",
    text: "PET SHOP",
    name: "pets",
  },
};

const W = 5 * TILE;
const H = 4 * TILE;

/** A shop window: dark frame, glass with a glint, and a small thing displayed behind it. */
function window_(p: Pen, x: number, y: number, w: number, h: number, shop: ShopId): void {
  p.rect(x - 1, y - 1, w + 2, h + 2, C.ink);
  p.rect(x, y, w, h, "#9fd3ef");
  p.rect(x, y, w, 2, C.white);
  p.rect(x + 2, y + 3, 1, h - 5, C.white);
  const base = y + h - 1;
  if (shop === "furniture") {
    p.rect(x + 2, base - 3, 6, 3, C.fabric);
    p.rect(x + 2, base - 5, 6, 2, C.fabricDark);
    p.rect(x + w - 4, base - 6, 2, 6, C.metal);
    p.rect(x + w - 6, base - 8, 6, 2, C.lamp);
  } else if (shop === "clothes") {
    p.rect(x + 4, base - 7, 4, 7, C.rug);
    p.rect(x + 3, base - 7, 6, 2, C.rugDark);
    p.disc(x + w - 5, base - 7, 2, C.flowerYellow);
    p.rect(x + w - 6, base - 5, 2, 5, C.metal);
  } else if (shop === "barber") {
    p.rect(x + 3, base - 6, 4, 6, "#f4efe4");
    p.rect(x + 3, base - 8, 4, 2, C.metal);
    p.rect(x + w - 6, base - 4, 4, 4, C.fabric);
    p.px(x + w - 5, base - 6, C.flowerRed);
  } else {
    p.disc(x + 5, base - 3, 2, "#c9853a");
    p.px(x + 4, base - 6, "#c9853a");
    p.px(x + 7, base - 6, "#c9853a");
    p.rect(x + w - 7, base - 3, 5, 3, C.woodLight);
  }
}

/**
 * A shop's front for the town: a striped awning and a sign board over the windows and the door, which sits
 * in the middle of its bottom edge (the door tile). Drawn from the front's top-left tile.
 */
export const storefront = cached(
  (shop: ShopId) => shop,
  (shop: ShopId) =>
    bake(W, H, (p) => {
      if (shop === "natmarked") {
        p.g.drawImage(natmarkedFront(), 0, 0);
        return;
      }
      if (shop === "market") {
        p.g.drawImage(marketFront(), 0, 0);
        return;
      }
      const s = SKINS[shop];
      p.rect(1, H - 2, W - 2, 2, C.shadow);
      // Walls, with a plinth and a roofline.
      p.rect(0, 6, W, H - 6, C.ink);
      p.rect(1, 7, W - 2, H - 8, s.wall);
      for (let x = 1; x < W - 1; x += 8) p.rect(x, 7, 1, H - 8, s.wallDark);
      p.rect(0, 0, W, 7, C.ink);
      p.rect(1, 1, W - 2, 5, C.stoneDark);
      p.rect(1, 1, W - 2, 1, C.stoneLight);
      p.rect(1, H - 4, W - 2, 3, C.stone);
      // The sign board, with the shop's name in the 3x5 font.
      p.rect(8, 9, W - 16, 11, C.ink);
      p.rect(9, 10, W - 18, 9, s.sign);
      const textW = s.text.length * 4 - 1;
      p.text(s.text, Math.round((W - textW) / 2), 12, C.white);
      // The awning: stripes with a scalloped edge.
      for (let x = 2; x < W - 2; x += 4) {
        const stripe = s.awning[(x / 4) % 2 === 0 ? 0 : 1];
        p.rect(x, 21, 4, 4, stripe);
        p.rect(x + 1, 25, 2, 1, stripe);
      }
      p.rect(2, 20, W - 4, 1, C.ink);
      // Two windows, and the door in the middle.
      window_(p, 6, 29, 22, 20, shop);
      window_(p, W - 28, 29, 22, 20, shop);
      const mid = W / 2;
      p.rect(mid - 8, H - 21, 16, 21, C.ink);
      p.rect(mid - 7, H - 20, 14, 20, C.woodDark);
      p.rect(mid - 6, H - 19, 5, 9, "#9fd3ef");
      p.rect(mid + 1, H - 19, 5, 9, "#9fd3ef");
      p.rect(mid - 6, H - 19, 5, 1, C.white);
      p.rect(mid + 1, H - 19, 5, 1, C.white);
      p.px(mid + 4, H - 8, C.flowerYellow);
      p.rect(mid - 9, H - 1, 18, 1, C.stoneDark);
      // A planter by the door.
      for (const x of [mid - 15, mid + 11]) {
        p.rect(x, H - 9, 5, 5, C.woodDark);
        p.rect(x, H - 11, 5, 3, C.leaf);
        p.px(x + 1, H - 12, C.flowerRed);
        p.px(x + 3, H - 12, C.flowerYellow);
      }
    }),
);

/** The shop counter, one tile of a run: pale top over a wooden front; every third tile has a till and a bell. */
export const shopCounter = cached(
  (till: boolean) => `${till}`,
  (till: boolean) =>
    bake(TILE, TILE, (p) => {
      p.rect(0, 5, TILE, 11, C.ink);
      p.rect(0, 6, TILE, 4, "#ece6d8");
      p.rect(0, 6, TILE, 1, C.white);
      p.rect(0, 9, TILE, 1, "#c9c1ae");
      p.rect(1, 10, 14, 5, C.wood);
      p.rect(1, 10, 14, 1, C.woodLight);
      p.rect(5, 11, 1, 3, C.woodDark);
      p.rect(10, 11, 1, 3, C.woodDark);
      p.rect(1, 15, 14, 1, C.woodDark);
      if (!till) return;
      // A little till with a lit screen, and a brass bell.
      p.rect(2, 1, 7, 6, C.ink);
      p.rect(3, 2, 5, 3, C.metal);
      p.rect(4, 3, 3, 1, C.screen);
      p.rect(3, 5, 5, 1, C.metalLight);
      p.rect(11, 4, 3, 2, "#c98e22");
      p.rect(12, 3, 1, 1, "#fff4b8");
    }),
);

/** On a wall (the top wall's face, or the west wall): a framed sample board in the shop's colours. */
function sample(p: Pen, shop: ShopId, x: number, y: number): void {
  p.rect(0, 0, TILE, TILE, C.wall);
  p.rect(0, 0, TILE, 2, C.wallTopLight);
  p.rect(2, 3, 12, 10, C.ink);
  const colors: Record<ShopId, string[]> = {
    furniture: ["#d9b36a", "#7f9a8e", "#c97b6b", "#8c5c36"],
    clothes: ["#4f8fe0", "#e25d5d", "#58b36a", "#f0b53c"],
    barber: ["#3b2a22", "#c9853a", "#e8cf7a", "#b2463d"],
    pets: ["#c9853a", "#f4efe4", "#6b4226", "#8d5a3c"],
    natmarked: ["#d8402f", "#e9b73d", "#243a73", "#f4efe4"],
    market: ["#2f6b4f", "#e9b73d", "#9c5a45", "#f4efe4"],
  };
  const c = colors[shop];
  p.rect(3, 4, 5, 4, c[Math.floor(hash(x, y, 3) * 4)]!);
  p.rect(8, 4, 5, 4, c[Math.floor(hash(x, y, 4) * 4)]!);
  p.rect(3, 8, 5, 4, c[Math.floor(hash(x, y, 5) * 4)]!);
  p.rect(8, 8, 5, 4, c[Math.floor(hash(x, y, 6) * 4)]!);
  p.rect(0, 14, TILE, 2, C.woodDark);
}

const SHIRTS = ["#e25d5d", "#4f8fe0", "#58b36a", "#f0b53c", "#9b6fd6", "#f28bb2"];

/**
 * A shop's display on one tile. Against a wall it is a sample board; on the floor a shelf of wares
 * (furniture), a clothes rail, a styling mirror (barber) or a pen with a pet in it (pets).
 */
export const shopDisplay = cached(
  (shop: ShopId, wall: boolean, x: number, y: number) => `${shop}${wall}${wall ? "" : (x * 7 + y * 3) % 4}`,
  (shop: ShopId, wall: boolean, x: number, y: number) => {
    if (wall) return bake(TILE, TILE, (p) => sample(p, shop, x, y));
    return bake(TILE, 20, (p) => {
      p.rect(1, 18, 14, 2, C.shadow);
      const k = hash(x, y, 9);
      const pick = <T>(list: readonly T[], salt: number): T =>
        list[Math.floor(hash(x, y, salt) * list.length)]!;
      if (shop === "furniture") {
        // A three-shelf unit: a lamp and a framed picture on top, a plant and books in the middle, cushions below.
        p.rect(1, 1, 14, 17, C.ink);
        p.rect(2, 2, 12, 15, C.woodDark);
        p.rect(2, 7, 12, 1, C.ink);
        p.rect(2, 12, 12, 1, C.ink);
        p.rect(2, 7, 12, 1, C.woodLight);
        p.rect(2, 12, 12, 1, C.woodLight);
        // Top: a lamp with a shade, and a picture in a gold frame.
        p.rect(4, 5, 1, 2, C.metal);
        p.rect(3, 3, 3, 2, C.lamp);
        p.rect(8, 3, 5, 4, C.ink);
        p.rect(9, 4, 3, 2, pick([C.leaf, C.fabric, C.flowerRed], 3));
        p.px(10, 4, C.flowerYellow);
        // Middle: a potted plant and a row of books.
        p.rect(3, 10, 3, 2, C.rug);
        p.rect(3, 8, 3, 2, C.leaf);
        p.px(4, 8, C.flowerRed);
        for (const [i, bx] of [7, 9, 11].entries()) {
          p.rect(
            bx,
            8 + (i === 1 ? 1 : 0),
            2,
            4 - (i === 1 ? 1 : 0),
            [C.fabric, C.flowerRed, C.flowerYellow][(i + Math.floor(k * 3)) % 3]!,
          );
        }
        // Bottom: two cushions and a folded blanket.
        p.rect(3, 14, 4, 3, pick([C.fabric, C.rug, C.flowerRed], 5));
        p.rect(3, 14, 4, 1, C.flowerWhite);
        p.rect(8, 14, 4, 3, pick([C.flowerYellow, C.leaf, C.fabricDark], 6));
        p.rect(8, 14, 4, 1, C.flowerWhite);
      } else if (shop === "clothes") {
        // A rail with a hat on top and three different garments: a tee, a dress and a jacket.
        p.rect(3, 0, 10, 2, C.ink);
        p.rect(4, 0, 8, 1, pick(SHIRTS, 12));
        p.rect(1, 3, 14, 1, C.ink);
        p.rect(1, 4, 14, 1, C.metalLight);
        p.rect(1, 3, 1, 16, C.metal);
        p.rect(14, 3, 1, 16, C.metal);
        // Tee.
        const tee = pick(SHIRTS, 11);
        p.rect(2, 5, 5, 1, C.ink);
        p.rect(2, 6, 5, 7, C.ink);
        p.rect(3, 6, 3, 6, tee);
        p.rect(2, 6, 1, 3, tee);
        p.rect(6, 6, 1, 3, tee);
        // Dress: narrow top, wide skirt.
        const dress = pick(SHIRTS, 13);
        p.rect(8, 5, 3, 1, C.ink);
        p.rect(8, 6, 3, 3, dress);
        p.rect(7, 9, 5, 5, C.ink);
        p.rect(8, 9, 3, 4, dress);
        p.rect(7, 13, 5, 1, dress);
        p.rect(8, 8, 3, 1, C.flowerWhite);
        // Jacket with a white collar.
        const jacket = pick(SHIRTS, 14);
        p.rect(12, 5, 2, 1, C.ink);
        p.rect(12, 6, 2, 8, jacket);
        p.px(12, 6, C.flowerWhite);
        p.px(13, 6, C.flowerWhite);
        p.rect(2, 15, 12, 3, C.woodDark);
        p.rect(2, 15, 12, 1, C.woodLight);
        // Shoes on the base shelf.
        p.rect(3, 14, 3, 1, C.ink);
        p.rect(9, 14, 3, 1, C.ink);
      } else if (shop === "barber") {
        // A mirror with a head reflected in it, a tray of scissors and a comb, and a row of bottles.
        p.rect(2, 0, 12, 13, C.ink);
        p.rect(3, 1, 10, 11, C.woodLight);
        p.rect(4, 2, 8, 9, "#b5dff0");
        p.rect(4, 2, 8, 2, C.white);
        p.rect(5, 4, 1, 3, C.white);
        p.disc(8, 7, 2, "#f0c8a0");
        p.rect(6, 5, 5, 2, pick(["#3b2a22", "#c9853a", "#e8cf7a", "#b2463d"], 15));
        p.rect(6, 10, 5, 1, C.fabric);
        p.rect(1, 13, 14, 6, C.ink);
        p.rect(2, 14, 12, 4, C.woodDark);
        p.rect(2, 14, 12, 1, C.woodLight);
        for (const [i, bx] of [3, 5, 7].entries()) {
          p.rect(bx, 11, 2, 3, [C.flowerRed, C.leaf, C.flowerYellow][i]!);
          p.px(bx, 10, C.white);
        }
        // Scissors and a comb.
        p.rect(10, 12, 1, 2, C.metalLight);
        p.rect(12, 12, 1, 2, C.metalLight);
        p.px(11, 14, C.metal);
        p.rect(10, 15, 4, 1, C.flowerWhite);
        p.rect(3, 16, 8, 1, C.ink);
      } else {
        // A pen on straw: a cat, a dog or a rabbit, with a food bowl and a ball.
        p.rect(1, 10, 14, 9, C.ink);
        p.rect(2, 11, 12, 7, "#e6cc98");
        const fur = pick(["#c9853a", "#f4efe4", "#6b4226", "#8d5a3c"], 16);
        const kind = Math.floor(k * 3);
        if (kind === 0) {
          // Cat: pointed ears, whiskers.
          p.rect(5, 7, 6, 6, C.ink);
          p.rect(6, 8, 4, 4, fur);
          p.rect(5, 5, 2, 2, C.ink);
          p.rect(9, 5, 2, 2, C.ink);
          p.px(5, 6, fur);
          p.px(10, 6, fur);
          p.px(7, 9, C.ink);
          p.px(9, 9, C.ink);
          p.px(8, 10, C.flowerRed);
        } else if (kind === 1) {
          // Dog: floppy ears, a nose.
          p.rect(5, 6, 6, 7, C.ink);
          p.rect(6, 7, 4, 5, fur);
          p.rect(4, 7, 2, 4, C.ink);
          p.rect(10, 7, 2, 4, C.ink);
          p.rect(5, 8, 1, 2, C.woodDark);
          p.rect(10, 8, 1, 2, C.woodDark);
          p.px(7, 8, C.ink);
          p.px(9, 8, C.ink);
          p.rect(7, 10, 2, 1, C.ink);
        } else {
          // Rabbit: tall ears.
          p.rect(5, 3, 2, 5, C.ink);
          p.rect(9, 3, 2, 5, C.ink);
          p.px(5, 4, C.flowerWhite);
          p.px(10, 4, C.flowerWhite);
          p.rect(5, 7, 6, 6, C.ink);
          p.rect(6, 8, 4, 4, C.flowerWhite);
          p.px(7, 9, C.ink);
          p.px(9, 9, C.ink);
          p.px(8, 10, C.flowerRed);
        }
        // A bowl and a ball in the corners of the pen.
        p.rect(2, 15, 4, 2, C.ink);
        p.rect(3, 15, 2, 1, C.flowerRed);
        p.disc(12, 15, 1, pick([C.flowerYellow, C.fabric, C.leaf], 17));
        for (const fx of [2, 5, 8, 11, 13]) p.rect(fx, 13, 1, 5, C.woodLight);
        p.rect(1, 13, 14, 1, C.woodLight);
      }
    });
  },
);

/** A fixture only to look at: a wooden crate with a cloth thrown over it. */
export const fixture = once(() =>
  bake(TILE, 14, (p) => {
    p.rect(1, 12, 14, 2, C.shadow);
    p.rect(1, 3, 14, 10, C.ink);
    p.rect(2, 4, 12, 8, C.wood);
    p.rect(2, 4, 12, 1, C.woodLight);
    p.rect(2, 8, 12, 1, C.woodDark);
    p.rect(5, 4, 1, 8, C.woodDark);
    p.rect(10, 4, 1, 8, C.woodDark);
    p.rect(3, 2, 7, 3, C.fabric);
    p.rect(3, 2, 7, 1, C.fabricDark);
  }),
);

/** The Tavern's coat stand by the door: a pole, hooks and a coat with a scarf. */
export const coatStand = once(() =>
  bake(TILE, 24, (p) => {
    p.rect(3, 22, 10, 2, C.shadow);
    p.rect(7, 2, 2, 20, C.ink);
    p.rect(7, 3, 1, 19, C.woodDark);
    p.rect(4, 21, 8, 2, C.ink);
    p.rect(5, 21, 6, 1, C.wood);
    p.rect(4, 4, 8, 1, C.ink);
    p.rect(3, 5, 2, 2, C.ink);
    p.rect(11, 5, 2, 2, C.ink);
    // A coat on one hook, a scarf on the other.
    p.rect(2, 6, 5, 11, C.ink);
    p.rect(3, 7, 3, 9, "#5b3fbf");
    p.rect(3, 7, 1, 9, "#7852ad");
    p.rect(11, 6, 3, 8, C.ink);
    p.rect(12, 7, 1, 6, C.flowerRed);
    p.rect(12, 7, 1, 1, C.flowerYellow);
    p.rect(12, 9, 1, 1, C.flowerYellow);
  }),
);
