import { expect, test } from "bun:test";
import { seatsFor } from "@tokenmaxxing/core/games/gather.ts";
import {
  arenaGlow,
  propTilesOf,
  rankOf,
  STOOL_Y,
  scoreLines,
  seatPose,
  startLineSpan,
} from "../src/render3d/town/gamefx.ts";

const table = { x: 7, y: 5, w: 3, h: 3, kind: "table" } as const;
const arena = { x: 7, y: 5, w: 4, h: 3, kind: "arena" } as const;

test("people at a table sit on stools, at an arena desk they type, a racer is neither", () => {
  expect(seatPose({ spot: table }, false)).toBe("sit");
  expect(seatPose({ spot: arena }, false)).toBe("type");
  expect(seatPose({ spot: table }, true)).toBeNull();
  expect(seatPose(undefined, false)).toBeNull();
  expect(STOOL_Y).toBeGreaterThan(0.3);
});

test("the props stand where the core says: one table in the middle, one desk per arena column", () => {
  expect(propTilesOf(table)).toEqual([[8, 6]]);
  expect(propTilesOf(arena)).toEqual([
    [7, 5],
    [8, 5],
    [9, 5],
    [10, 5],
  ]);
  // The players' seats face the table's tile, and sit just south of an arena's desks.
  const seats = seatsFor(table, 2);
  expect(seats).toEqual([
    { x: 7, y: 6, facing: "right" },
    { x: 9, y: 6, facing: "left" },
  ]);
  expect(seatsFor(arena, 3).every((s) => s.y === 6 && s.facing === "up")).toBe(true);
});

test("the arena's leader blazes and the rest flicker faster the higher they rank", () => {
  expect(arenaGlow(0, 12345)).toBe(3);
  expect([arenaGlow(1, 0), arenaGlow(1, 300)].sort()).toEqual([1, 2]);
  // Rank 1 flips every 210 ms.
  expect(arenaGlow(1, 0)).toBe(2);
  expect(arenaGlow(1, 210)).toBe(1);
  expect(arenaGlow(3, 389)).toBe(2);
  expect(arenaGlow(3, 390)).toBe(1);
});

test("a player's rank is their place on the board, last when they aren't on it", () => {
  const board = [
    { player: 4, value: 90, label: "" },
    { player: 2, value: 40, label: "" },
  ];
  expect(rankOf(board, 4)).toBe(0);
  expect(rankOf(board, 2)).toBe(1);
  expect(rankOf(board, 9)).toBe(2);
  expect(rankOf(null, 9)).toBe(0);
});

test("the scoreboard's bars are against the best, with a sliver for nothing, and a label or the count", () => {
  const board = [
    { player: 4, value: 1000, label: "1.0k" },
    { player: 2, value: 250, label: "" },
    { player: 7, value: 0, label: "" },
  ];
  const lines = scoreLines(
    board,
    new Map([
      [4, "anna"],
      [2, "bo"],
    ]),
    (n) => `${n}t`,
  );
  expect(lines.map((l) => l.name)).toEqual(["anna", "bo", "?"]);
  expect(lines.map((l) => l.share)).toEqual([1, 0.25, 0.02]);
  expect(lines.map((l) => l.label)).toEqual(["1.0k", "250t", "0t"]);
  expect(lines.map((l) => l.leader)).toEqual([true, false, false]);
  expect(scoreLines(null, new Map(), String)).toEqual([]);
});

test("the race's start line runs across the lanes from the middle of the square's top edge", () => {
  expect(startLineSpan(4, 16, 3, [])).toBeNull();
  const span = startLineSpan(4, 16, 3, [0.35, -0.1])!;
  expect(span.x).toBeCloseTo(10 + 13 / 16);
  expect(span.y0).toBeCloseTo(3 - 0.1 + 6 / 16);
  expect(span.y1).toBeCloseTo(3 + 0.35 + 1);
});
