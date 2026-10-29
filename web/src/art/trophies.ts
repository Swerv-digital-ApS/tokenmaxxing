import type { Frame } from "@tokenmaxxing/core/badges.ts";
import { TIER_COLOR } from "@tokenmaxxing/core/rarity.ts";
import { SHELF_SLOTS, TROPHIES } from "@tokenmaxxing/core/trophies.ts";
import { C } from "./palette.ts";
import { bake, cached, once, perObject, recolour } from "./pixels.ts";
import { TROPHY_ART } from "./trophy-art.ts";

/** A trophy is 7×8: the thing itself, mostly on a little plinth (`k`, `K` its top edge). */
export const TROPHY_W = 7;
export const TROPHY_H = 8;

/** One trophy's sprite; an unearned one is its dim outline, so the gaps on the shelf have a shape. */
export const trophySprite = cached(
  (id: string, earned: boolean) => `${id}${+earned}`,
  (id: string, earned: boolean) =>
    bake(TROPHY_W, TROPHY_H, (p) => {
      const art = TROPHY_ART[id];
      if (!art) return;
      const pal = earned ? art.pal : recolour(art.pal, () => "rgba(20, 16, 28, 0.32)");
      p.grid(art.rows, pal);
    }),
);

/** The shelf: 4 tiles wide, six glass-fronted shelves of 7 (`SHELF_SLOTS`). */
const SHELF_W = 64;
const ROWS = SHELF_SLOTS / 7;
export const SHELF_H = 9 * ROWS + 5;
const PER_SHELF = 7;
/** Where trophy `i` stands, in the shelf's pixels. */
const slotOf = (i: number) => ({
  x: 4 + (i % PER_SHELF) * (TROPHY_W + 1),
  y: 2 + Math.floor(i / PER_SHELF) * 9,
});

/** The shelf with these trophies on it (by id, any order); the rest show as outlines. */
export const trophyShelf = cached(
  // Once per set: the shelf's set is replaced when it changes, never edited.
  perObject((earned: ReadonlySet<string>) => [...earned].sort().join()),
  (earned: ReadonlySet<string>) =>
    bake(SHELF_W, SHELF_H, (p) => {
      p.rect(0, 0, SHELF_W, SHELF_H, C.ink);
      p.rect(1, 1, SHELF_W - 2, SHELF_H - 2, C.woodDark);
      p.rect(3, 2, SHELF_W - 6, ROWS * 9, "#5e3d28");
      for (let s = 0; s < ROWS; s++) p.rect(1, 10 + s * 9, SHELF_W - 2, 1, C.woodLight);
      p.rect(1, ROWS * 9 + 2, SHELF_W - 2, 2, C.wood);
      p.rect(1, 1, SHELF_W - 2, 1, C.woodLight);
      TROPHIES.forEach((t, i) => {
        const { x, y } = slotOf(i);
        p.g.drawImage(trophySprite(t.id, earned.has(t.id)), x, y);
      });
      // Glass: a couple of glints across the front.
      p.g.fillStyle = "rgba(255, 255, 255, 0.18)";
      for (const gx of [9, 40])
        for (let i = 0; i < 26; i++) p.g.fillRect(gx + Math.floor(i / 2), ROWS * 9 - i, 2, 1);
    }),
);

/** A badge's frame, 12×12: one grid in each tier's colour (`TIER_COLOR`), the pin slot and the Hall. */
export const FRAME_SIZE = 12;
const FRAME_ROWS = [
  "..oooooooo..",
  ".oaaaaaaaao.",
  "oaawwaaaaaao",
  "oawbbbbbbaao",
  "oabbbbbbbbao",
  "oabbbbbbbbao",
  "oabbbbbbbbao",
  "oabbbbbbbbao",
  "oaabbbbbbaao",
  "oaaaaaaaaaao",
  ".oaaaaaaaao.",
  "..oooooooo..",
];
export const badgeFrame = cached(
  (frame: Frame) => frame,
  (frame: Frame) =>
    bake(FRAME_SIZE, FRAME_SIZE, (p) =>
      p.grid(FRAME_ROWS, { o: C.ink, a: TIER_COLOR[frame], w: C.white, b: "#1b1f2b" }),
    ),
);

/** The Hall of Fame wall, one tile: a dark board with three plaques and a gold star. */
export const hallWall = once(() =>
  bake(16, 16, (p) => {
    p.rect(0, 0, 16, 16, C.ink);
    p.rect(1, 1, 14, 14, C.woodDark);
    p.rect(2, 2, 12, 12, "#3b2a22");
    for (const x of [3, 7, 11]) {
      p.rect(x, 8, 3, 4, TIER_COLOR.bronze);
      p.rect(x, 8, 3, 1, TIER_COLOR.gold);
    }
    p.grid([".w.", "www", ".w."], { w: TIER_COLOR.gold }, 7, 3);
  }),
);
