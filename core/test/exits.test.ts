import { describe, expect, test } from "bun:test";
import { type GameMap, layoutOf, MAPS } from "../src/maps.ts";
import {
  DOORS_PER_HALLWAY,
  doorsFor,
  HALL_H,
  hqMap,
  officeMap,
  PASSAGE_W,
  PASSAGE_X,
  withSlots,
} from "../src/office.ts";
import { route, townSpawn } from "../src/world.ts";

/** Every room but the town, in the sizes the game builds them: the fixed rooms, a house with three hallways, every Office size. */
const rooms = (): GameMap[] => [
  ...Object.values(MAPS).filter((m) => m.id !== "town"),
  hqMap(doorsFor(withSlots(Array.from({ length: 14 }, (_, i) => ({ userId: i + 1, name: `u${i}` }))))),
  officeMap(1),
  officeMap(2),
];

/** Where you arrive (`roomEntry`): just inside the exit `x`, which every room has. */
const entry = (map: GameMap): [number, number] => {
  const [x, y] = map.find("x")[0]!;
  return [x, y - 1];
};

describe("exits", () => {
  for (const map of rooms()) {
    const doors = layoutOf(map).doors;
    test(`${map.id} (${map.width}×${map.height}): has a way out, and every exit is reached from the entry`, () => {
      expect(doors.length).toBeGreaterThan(0);
      expect(map.find("x").length).toBeGreaterThan(0);
      const from = entry(map);
      expect(map.walkable(...from)).toBe(true);
      for (const d of doors) {
        const way = route(map, from, [d.x, d.y]);
        expect(way, `${map.id}: ${d.ch} at ${d.x},${d.y}`).not.toBeNull();
      }
    });

    test(`${map.id}: every exit has a threshold, a walkable tile beside it for the mat and the marker`, () => {
      for (const d of doors) {
        const beside = [
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0],
        ].some(([dx, dy]) => map.walkable(d.x + dx!, d.y + dy!));
        expect(beside, `${map.id}: ${d.ch} at ${d.x},${d.y}`).toBe(true);
      }
    });
  }

  test("every stairs and door has a free approach: no plant or furniture on, or hard against, its way in", () => {
    const around = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ] as const;
    for (const map of rooms()) {
      for (const d of layoutOf(map).doors) {
        // Each side of a portal is a wall, or a floor tile you can stand on: never a prop that closes it off.
        for (const [dx, dy] of around) {
          const ch = map.at(d.x + dx, d.y + dy);
          const kind = map.kind(d.x + dx, d.y + dy);
          expect(
            ch === "W" || kind.walk === true || kind.portal === true,
            `${map.id}: ${d.ch} at ${d.x},${d.y} has "${ch}" (${kind.name}) beside it`,
          ).toBe(true);
        }
        // The foot of a flight (the side opposite a wall) is a floor tile, reached from the entry.
        const foot = around.filter(
          ([dx, dy]) => map.walkable(d.x + dx, d.y + dy) && map.at(d.x - dx, d.y - dy) === "W",
        );
        expect(foot.length, `${map.id}: ${d.ch} at ${d.x},${d.y} has no way in straight on`).toBeGreaterThan(
          0,
        );
        for (const [dx, dy] of foot) {
          const front: [number, number] = [d.x + dx, d.y + dy];
          expect(route(map, entry(map), front), `${map.id}: ${d.ch} front ${front}`).not.toBeNull();
        }
      }
    }
  });

  test("the town's doors and gates are reached from the spawn, from a walkable tile beside them", () => {
    const town = MAPS.town;
    const spawn: [number, number] = [townSpawn().x, townSpawn().y];
    for (const d of layoutOf(town).doors) {
      const beside = [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ].some(([dx, dy]) => town.walkable(d.x + dx!, d.y + dy!));
      expect(beside, `town: ${d.ch} at ${d.x},${d.y}`).toBe(true);
      expect(route(town, spawn, [d.x, d.y]), `town: ${d.ch} at ${d.x},${d.y}`).not.toBeNull();
    }
  });

  test("every office door of a full house is reachable from the ground floor, from a walkable tile in front of it", () => {
    for (const n of [1, DOORS_PER_HALLWAY, DOORS_PER_HALLWAY + 1, 3 * DOORS_PER_HALLWAY + 2]) {
      const doors = doorsFor(
        withSlots(Array.from({ length: n }, (_, i) => ({ userId: i + 1, name: `u${i}` }))),
      );
      const map = hqMap(doors);
      expect(map.find("R")).toHaveLength(n);
      for (const d of doors) {
        expect(map.at(d.x, d.y)).toBe("R");
        // Reached from the ground floor's entry, through the passage, standing in the corridor in front of it.
        expect(map.walkable(d.x, d.y + 1), `door ${d.x},${d.y}: corridor in front`).toBe(true);
        const way = route(map, entry(map), [d.x, d.y]);
        expect(way, `door ${d.x},${d.y}`).not.toBeNull();
      }
    }
  });

  test("a hallway is a wall top, a wall face and a two-deep corridor; doors are three tiles apart with wall between", () => {
    const doors = doorsFor(
      withSlots(Array.from({ length: 8 }, (_, i) => ({ userId: i + 1, name: `u${i}` }))),
    );
    const map = hqMap(doors);
    expect(map.y0).toBe(-2 * HALL_H);
    for (const h of [0, 1]) {
      const top = map.y0 + (1 - h) * HALL_H; // hallway 0 is the one next to the floor
      const first = h * DOORS_PER_HALLWAY;
      for (const d of doors.slice(first, first + DOORS_PER_HALLWAY)) expect(d.y).toBe(top + 1);
      const xs = doors.filter((d) => d.y === top + 1).map((d) => d.x);
      for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBe(3);
      // The two corridor rows are open from wall to wall; the doors stand in the face row; the top row is wall.
      for (let x = 1; x < map.width - 1; x++) {
        expect(map.walkable(x, top + 2)).toBe(true);
        expect(map.walkable(x, top + 3)).toBe(true);
        if (x < PASSAGE_X || x >= PASSAGE_X + PASSAGE_W) expect(map.at(x, top)).toBe("W");
      }
    }
    // The passage is as wide as the landing it opens on, through every wall row, and doors flank it.
    for (let y = map.y0 + 2; y < 2; y++)
      for (let i = 0; i < PASSAGE_W; i++)
        expect(map.walkable(PASSAGE_X + i, y), `${PASSAGE_X + i},${y}`).toBe(true);
    for (const y of [0, 1]) {
      expect(map.walkable(PASSAGE_X - 1, y)).toBe(false);
      expect(map.walkable(PASSAGE_X + PASSAGE_W, y)).toBe(false);
    }
    expect(doors.some((d) => d.x === PASSAGE_X - 1 || d.x === PASSAGE_X + PASSAGE_W)).toBe(true);
    // Packing is deterministic and by id: the same owners in any order give the same doors.
    const owners = doors.map(({ x: _x, y: _y, ...o }) => o);
    expect(doorsFor(withSlots([...owners].reverse()))).toEqual(doors);
  });
});
