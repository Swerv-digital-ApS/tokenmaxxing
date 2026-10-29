import { afterEach, expect, test } from "bun:test";
import { COMPANY_FURNITURE, canHang } from "@tokenmaxxing/core/office.ts";
import {
  baseMap,
  type Drop,
  dropCovers,
  dropTiles,
  noFurniture,
  setDrops,
} from "@tokenmaxxing/core/world.ts";
import { ghostFits, UNDO_DEPTH, UndoStack } from "../src/game/furniture-logic.ts";

const ROOM = "hq:1";
const base = baseMap(ROOM);
const floor: [number, number][] = [];
for (let y = base.y0; y < base.y0 + base.height; y++)
  for (let x = base.x0; x < base.x0 + base.width; x++)
    if (base.walkable(x, y) && !base.kind(x, y).portal) floor.push([x, y]);
const reserved = noFurniture(ROOM, base);
/** Bare floor a piece may stand on: not in front of a door, not up in the hallways. */
const open = floor.filter(([x, y]) => !reserved.has(`${x},${y}`));
const bonsai = COMPANY_FURNITURE.find((f) => f.name === "Bonsai")!;
const drop = (id: number, x: number, y: number, ch = bonsai.ch): Drop => ({
  id,
  item: `furn.${ch}`,
  room: ROOM,
  x,
  y,
  by: 1,
  at: 0,
});
const fits = (
  drops: Drop[],
  item: string,
  moving: Drop | null,
  t: { x: number; y: number },
  people = [],
  rot: 0 | 1 | 2 | 3 = 0,
) => {
  setDrops(ROOM, drops);
  return ghostFits(ROOM, item, moving, t, people, rot);
};
afterEach(() => setDrops(ROOM, []));

test("a ghost is green on bare floor, red on a wall, a piece, a person or off the map", () => {
  const [x, y] = open[0]!;
  const item = `furn.${bonsai.ch}`;
  expect(fits([], item, null, { x, y })).toBe(true);
  expect(fits([], item, null, { x: 0, y: 0 })).toBe(false);
  expect(fits([], item, null, { x: 999, y: 999 })).toBe(false);
  expect(fits([], item, null, { x, y }, [{ x, y }] as never)).toBe(false);
  expect(fits([drop(1, x, y)], item, null, { x, y })).toBe(false);
  // Not furniture: no ghost to show.
  expect(fits([], "hat.1", null, { x, y })).toBe(false);
});

test("a ghost is red where the server keeps furniture off: in front of a door, up in the hallways", () => {
  const item = `furn.${bonsai.ch}`;
  const kept = floor.filter(([x, y]) => reserved.has(`${x},${y}`));
  expect(kept.length).toBeGreaterThan(0);
  for (const [x, y] of kept) expect(fits([], item, null, { x, y }), `${x},${y}`).toBe(false);
});

test("a piece being moved fits on its own tile, and its own tile is free for it, but nothing else's", () => {
  const [x, y] = open[0]!;
  const [x2, y2] = open.find(([fx, fy]) => fx !== x || fy !== y)!;
  const mine = drop(1, x, y);
  const world = [mine, drop(2, x2, y2)];
  expect(fits(world, mine.item, mine, { x, y })).toBe(true);
  expect(fits(world, mine.item, mine, { x: x2, y: y2 })).toBe(false);
  // A new piece (not moving) cannot go where one stands.
  expect(fits(world, mine.item, null, { x, y })).toBe(false);
});

test("a wide piece needs all its tiles", () => {
  const wide = COMPANY_FURNITURE.find((f) => (f.w ?? 1) > 1 && !f.wall)!;
  const w = wide.w ?? 1;
  const at = open.find(([x, y]) =>
    Array.from({ length: w }, (_, i) => open.some(([ox, oy]) => ox === x + i && oy === y)).every(Boolean),
  )!;
  const item = `furn.${wide.ch}`;
  expect(fits([], item, null, { x: at[0], y: at[1] })).toBe(true);
  // Its second tile taken by a bonsai.
  expect(fits([drop(3, at[0] + 1, at[1])], item, null, { x: at[0], y: at[1] })).toBe(false);
});

test("a poster hangs only where the wall has room for it", () => {
  const poster = COMPANY_FURNITURE.find((f) => f.wall)!;
  const w = poster.w ?? 1;
  const spots: [number, number][] = [];
  for (let y = base.y0; y < base.y0 + base.height; y++)
    for (let x = base.x0; x < base.x0 + base.width; x++)
      if (canHang(base, x, y, w, false)) spots.push([x, y]);
  expect(spots.length).toBeGreaterThan(0);
  const [x, y] = spots[0]!;
  const item = `furn.${poster.ch}`;
  expect(fits([], item, null, { x, y })).toBe(true);
  expect(fits([drop(4, x, y, poster.ch)], item, null, { x, y })).toBe(false);
  // Floor is not wall.
  expect(fits([], item, null, { x: open[0]![0], y: open[0]![1] })).toBe(false);
});

test("the undo stack keeps the last ten steps, newest first out", () => {
  const s = new UndoStack();
  expect(s.pop()).toBeUndefined();
  for (let i = 0; i < UNDO_DEPTH + 3; i++) s.push({ kind: "move", room: "hq:1", id: i, x: 0, y: 0, rot: 0 });
  expect(s.size).toBe(UNDO_DEPTH);
  expect(s.peek()).toMatchObject({ id: UNDO_DEPTH + 2 });
  expect(s.pop()).toMatchObject({ id: UNDO_DEPTH + 2 });
  const ids: number[] = [];
  for (let step = s.pop(); step; step = s.pop()) ids.push(step.id);
  expect(ids).toEqual([11, 10, 9, 8, 7, 6, 5, 4, 3]);
});

test("a piece put down again is a new row: the steps naming the old one follow it", () => {
  const s = new UndoStack();
  s.push({ kind: "place", room: "hq:1", id: 5, item: "furn.ρ" });
  s.push({ kind: "move", room: "hq:1", id: 6, x: 1, y: 1, rot: 0 });
  s.push({ kind: "move", room: "hq:1", id: 5, x: 2, y: 2, rot: 0 });
  s.remap(5, 9);
  expect(s.pop()).toMatchObject({ id: 9, x: 2 });
  expect(s.pop()).toMatchObject({ id: 6 });
  expect(s.pop()).toMatchObject({ id: 9, kind: "place" });
  s.push({ kind: "move", room: "hq:1", id: 1, x: 0, y: 0, rot: 0 });
  s.clear();
  expect(s.peek()).toBeUndefined();
});

test("a piece turned a quarter lies down its column: the tiles it needs, covers and blocks", () => {
  const sofa = COMPANY_FURNITURE.find((f) => f.w === 3 && !f.wall)!;
  const item = `furn.${sofa.ch}`;
  const isOpen = (x: number, y: number) => open.some(([ox, oy]) => ox === x && oy === y);
  // Somewhere in the house there is a square of bare floor, so it fits there lying either way.
  const [x, y] = open.find(([ox, oy]) =>
    [0, 1, 2].every((i) => [0, 1, 2].every((j) => isOpen(ox + i, oy + j))),
  )!;
  for (const rot of [0, 1, 2, 3] as const) expect(fits([], item, null, { x, y }, [], rot)).toBe(true);
  // Its tiles: along the row, or down the column.
  const d = { ...drop(1, x, y, sofa.ch), rot: 1 as const };
  expect(dropTiles(d)).toEqual([
    [x, y],
    [x, y + 1],
    [x, y + 2],
  ]);
  expect(dropTiles({ ...d, rot: 2 })).toEqual([
    [x, y],
    [x + 1, y],
    [x + 2, y],
  ]);
  expect([dropCovers(d, x, y + 2), dropCovers(d, x + 2, y)]).toEqual([true, false]);
  // Something on the third tile down: no room lying down, still room along the row.
  expect(fits([drop(2, x, y + 2)], item, null, { x, y }, [], 1)).toBe(false);
  expect(fits([drop(2, x, y + 2)], item, null, { x, y }, [], 0)).toBe(true);
  // Someone standing under it is in the way down the column too.
  expect(fits([], item, null, { x, y }, [{ x, y: y + 1 }] as never, 3)).toBe(false);
  // Its own tiles are free for it when it is the one being turned.
  expect(fits([d], item, d, { x, y }, [], 1)).toBe(true);
  // A piece lying down its column takes its tiles from the others.
  expect(fits([d], `furn.${bonsai.ch}`, null, { x, y: y + 1 })).toBe(false);
  expect(fits([d], `furn.${bonsai.ch}`, null, { x: x + 1, y: y + 1 })).toBe(true);
});
