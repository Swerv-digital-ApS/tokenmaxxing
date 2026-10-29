import { buffAt, copenhagenDay, SPECIAL, specialOn } from "@tokenmaxxing/core/tavern.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { C } from "../art/palette.ts";
import { bake, cached, hash } from "../art/pixels.ts";
import type { Frame } from "./frame.ts";
import { bubble } from "./labels.ts";
import { self, world } from "./world.ts";

/**
 * The A-frame chalkboard outside the Inn (`K` on the map). Its scribbles change with the day's
 * special; stand by it and the special shows in a bubble over it, E says it in the dialog too.
 */

const CHALK = "#eef2ea";
const CHALK_DIM = "#b7c3ba";
const BOARD = "#2f3d36";
const BOARD_SMUDGE = "#3a4a42";

/** The board for day `day`: wooden frame on splayed legs, a header, an underline, three lines and a doodle. */
const board = cached(
  (day: number) => `${day}`,
  (day: number) =>
    bake(16, 22, (p) => {
      // Legs, splayed: the front pair, and the back pair peeking out behind.
      for (const [x, wood] of [
        [2, C.woodDark],
        [12, C.woodDark],
      ] as const) {
        const out = x < 8 ? -1 : 1;
        p.rect(x, 16, 2, 3, C.ink);
        p.rect(x + out, 19, 2, 3, C.ink);
        p.px(x + (out < 0 ? 1 : 0), 17, wood);
        p.px(x + out + (out < 0 ? 1 : 0), 20, wood);
      }
      p.rect(4, 17, 1, 4, C.ink);
      p.rect(11, 17, 1, 4, C.ink);
      p.rect(3, 21, 10, 1, C.shadow);
      // The frame and its hinge.
      p.rect(5, 0, 6, 2, C.ink);
      p.rect(6, 0, 4, 1, C.metalLight);
      p.rect(1, 1, 14, 16, C.ink);
      p.rect(2, 2, 12, 14, C.wood);
      p.rect(2, 2, 12, 1, C.woodLight);
      p.rect(2, 15, 12, 1, C.woodDark);
      p.rect(3, 3, 10, 11, BOARD);
      for (let i = 0; i < 6; i++)
        p.px(3 + Math.floor(hash(i, day, 9) * 10), 3 + Math.floor(hash(day, i, 9) * 11), BOARD_SMUDGE);
      // "TODAY'S SPECIAL", in chalk too small to read.
      for (let x = 4; x < 12; x++) for (const y of [4, 5]) if (hash(x, y, day) < 0.62) p.px(x, y, CHALK);
      p.rect(4, 6, 7, 1, C.flowerYellow);
      // The special, scrawled: each line a different length, wobbling up and down a pixel.
      for (const [i, y] of [8, 10, 12].entries()) {
        const len = 4 + Math.floor(hash(i, day, 2) * 5);
        for (let x = 4; x < 4 + len; x++)
          if (hash(x, y, day + 1) > 0.15) p.px(x, y - (hash(x, i, day) < 0.3 ? 1 : 0), CHALK_DIM);
      }
      // A doodle in pink chalk: a little heart.
      p.px(10, 11, "#f2a0b8");
      p.px(12, 11, "#f2a0b8");
      p.rect(10, 12, 3, 1, "#f2a0b8");
      p.px(11, 13, "#f2a0b8");
      // The chalk on the tray.
      p.rect(9, 14, 2, 1, CHALK);
    }),
);

/** When you came up to the board, for the bubble to fade in; null while you're not by it. */
let nearSince: number | null = null;

/** The special's line for the dialog (E facing the board): what it is, and what the tap does with it. */
export function chalkboardText(): string {
  const at = new Date();
  const how = buffAt(at.getTime()) === "glow" ? "a glow" : "a buzz";
  return `The Tavern's chalkboard. Today's special: ${specialOn(at)} Free at the tap inside: ${how} for ${SPECIAL.ms / 60_000} minutes.`;
}

/** Today in Copenhagen and its special, read once a minute (the day turns on one). */
let today = { minute: Number.NaN, day: 0, special: "" };
function todayNow() {
  const at = new Date();
  const minute = Math.floor(at.getTime() / 60_000);
  if (minute !== today.minute) today = { minute, day: copenhagenDay(at), special: specialOn(at) };
  return today;
}

/** Queues the boards on the map, and the special over any you're standing by. */
export function drawChalkboards({ g, items, labels, toScreen, now, dpr }: Frame): void {
  const list = world.map.find("K");
  if (!list.length) return;
  const { day, special } = todayNow();
  const sprite = board(day);
  const me = self();
  let near = false;
  for (const [x, y] of list) {
    const left = x * TILE;
    const top = (y + 1) * TILE - sprite.height;
    items.push({ y: y * TILE + TILE - 1, draw: () => g.drawImage(sprite, left, top) });
    if (!me || Math.max(Math.abs(me.x - x), Math.abs(me.y - y)) > 1) continue;
    near = true;
    nearSince ??= now;
    const since = nearSince;
    const [sx, sy] = toScreen(left + TILE / 2, top);
    labels.push(() => bubble(g, sx, sy, special, dpr, now - since));
  }
  if (!near) nearSince = null;
}
