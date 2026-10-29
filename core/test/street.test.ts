import { expect, test } from "bun:test";
import { BLOCK_H } from "../src/maps.ts";
import {
  CART,
  cartOpen,
  clockMinutes,
  deliveredAt,
  facesCart,
  PAPER,
  POLSE,
  paperboyAt,
  paperRides,
  paperSpot,
  parseClock,
  SNAIL,
  snailAt,
  stepPace,
} from "../src/street.ts";
import { RUN_STEP_MS, takeStep } from "../src/world.ts";

/** Copenhagen wall time on 21 October 2026 (summer time, UTC+2) as epoch ms. */
const cph = (h: number, m = 0) => Date.UTC(2026, 9, 21, h - 2, m);

test("the clock is Copenhagen's, summer and winter", () => {
  expect(clockMinutes(cph(7, 30))).toBe(7 * 60 + 30);
  // After the clocks go back (25 October): UTC+1.
  expect(clockMinutes(Date.UTC(2026, 11, 1, 11, 0))).toBe(12 * 60);
  expect(parseClock("12:30")).toBe(750);
  expect(parseClock("07:00:30")).toBe(420.5);
  for (const bad of ["24:00", "7", "12:60", "noon", ""]) expect(parseClock(bad)).toBeNull();
});

test("the pølsevogn is open 11 to 14, and a rød pølse is free and short", () => {
  expect(POLSE.ms).toBe(10 * 60_000);
  expect(cartOpen(cph(10, 59))).toBe(false);
  expect(cartOpen(cph(11))).toBe(true);
  expect(cartOpen(cph(13, 59))).toBe(true);
  expect(cartOpen(cph(14))).toBe(false);
  const [x, y] = CART[0]!;
  expect(facesCart(x - 1, y, "right")).toBe(true);
  expect(facesCart(x, y + 1, "up")).toBe(true);
  expect(facesCart(x - 1, y, "left")).toBe(false);
});

test("a pølse lets you step faster, and only while it lasts", () => {
  const now = 1_000_000;
  expect(stepPace(now + 1, now)).toBe(POLSE.pace);
  expect(stepPace(now, now)).toBe(1);
  // Running on a pølse, with steps bunched a little by the network: too fast without one, fine with one.
  const gap = RUN_STEP_MS * POLSE.pace * 0.9;
  const run = (pace: number) => {
    let budget = 1;
    let at = 0;
    for (let i = 1; i <= 40; i++) {
      const next = takeStep(budget, at, i * gap, pace);
      if (next === null) return false;
      budget = next;
      at = i * gap;
    }
    return true;
  };
  expect(run(1)).toBe(false);
  expect(run(POLSE.pace)).toBe(true);
});

test("the snail waits until 07:00, crosses by 17:00, and sits at the flag after", () => {
  expect(snailAt(cph(6))).toMatchObject({ x: SNAIL.from, phase: "queued" });
  expect(snailAt(cph(7))).toMatchObject({ x: SNAIL.from, phase: "deploying" });
  expect(snailAt(cph(12)).x).toBeCloseTo((SNAIL.from + SNAIL.to) / 2);
  expect(snailAt(cph(17))).toMatchObject({ x: SNAIL.to, phase: "deployed" });
  expect(snailAt(cph(23, 59))).toMatchObject({ x: SNAIL.to, phase: "deployed" });
  // Everyone sees it in the same place: it's only the time.
  expect(snailAt(cph(9, 41))).toEqual(snailAt(cph(9, 41)));
});

test("the paperboy rides each row with a door, one after the other, and drops a paper as he passes", () => {
  // Two doors in the top row of blocks, one in the row below.
  const doors: [number, number][] = [
    [5, -3],
    [25, -3],
    [13, 14],
  ];
  const rides = paperRides(doors, -1, 39);
  expect(rides.map((r) => r.y)).toEqual([0, 2 * BLOCK_H]);
  expect(rides[0]!.at).toBe(PAPER.at);
  const ride = 40 / PAPER.tilesPerSecond / 60;
  expect(rides[1]!.at).toBeCloseTo(PAPER.at + ride);
  expect(paperboyAt(rides, PAPER.at - 1)).toBeNull();
  expect(paperboyAt(rides, PAPER.at)).toEqual({ x: -1, y: 0 });
  expect(paperboyAt(rides, PAPER.at + 2 * ride + 0.001)).toBeNull();
  // The near door's paper lands before the far one's, and the next row's after both.
  const [a, b, c] = doors.map((d) => deliveredAt(rides, d)!);
  expect(a).toBeLessThan(b!);
  expect(b).toBeLessThan(c!);
  // As he passes the paper's spot.
  const boy = paperboyAt(rides, a!)!;
  expect(boy.x).toBeCloseTo(paperSpot(doors[0]!)[0]);
  expect(deliveredAt(rides, [5, 40])).toBeNull();
});
