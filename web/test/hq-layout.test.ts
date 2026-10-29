import { expect, test } from "bun:test";
import { MAPS } from "@tokenmaxxing/core/maps.ts";
import { doorsFor, hqMap, PASSAGE_W, PASSAGE_X, withSlots } from "@tokenmaxxing/core/office.ts";
import { hallwayTiles, houseOffset, housePassage, houseTile } from "../src/render3d/rooms/hq-layout.ts";

const doors = (n: number) =>
  doorsFor(
    withSlots(Array.from({ length: n }, (_, i) => ({ userId: i + 1, name: `u${i}`, open: i % 2 === 0 }))),
  );

test("the house's picture follows the map's origin: room tile (0, 0) is map tile (1, 2) whatever the hallways", () => {
  for (const map of [MAPS.hq, hqMap(doors(3)), hqMap(doors(25))]) {
    const [ox, oz] = houseOffset(map);
    // The skin's offset is in tiles from the map's top-left: room (0, 0) lands on map (1, 2).
    expect([ox + map.x0, oz + map.y0]).toEqual([1, 2]);
    expect(houseTile(1, 2)).toEqual([0, 0]);
    // The floor's last row of tiles is the room's last row.
    expect(houseTile(1, map.y0 + map.height - 2)[1]).toBe(MAPS.hq.height - 3 - 1);
  }
  expect(houseOffset(MAPS.hq)).toEqual([1, 2]);
  expect(houseOffset(hqMap(doors(3)))).toEqual([1, 6]);
});

test("the hallways are built from the live map: a tile is floor in 3D exactly when the map lets you walk on it", () => {
  for (const n of [0, 1, 7, 25]) {
    const map = hqMap(doors(n));
    const tiles = hallwayTiles(map);
    const byKey = new Map(tiles.map((t) => [`${t.x},${t.y}`, t]));
    for (let y = map.y0; y < 2; y++)
      for (let x = map.x0; x < map.x0 + map.width; x++) {
        const t = byKey.get(`${x},${y}`);
        expect(t !== undefined, `${x},${y}`).toBe(true);
        expect(t!.kind === "floor", `${x},${y}`).toBe(map.walkable(x, y));
        expect(t!.kind === "door", `${x},${y}`).toBe(map.at(x, y) === "R");
        expect([t!.rx, t!.rz]).toEqual([x - 1, y - 2]);
      }
    expect(tiles.filter((t) => t.kind === "door")).toHaveLength(n);
    if (n === 0) expect(housePassage(map)).toBeNull();
    else {
      expect(housePassage(map)).toEqual([PASSAGE_X - 1, -1]);
      // Two tiles wide at its foot, through the floor's two wall rows.
      for (const y of [0, 1])
        expect(tiles.filter((t) => t.kind === "floor" && t.y === y)).toHaveLength(PASSAGE_W);
    }
  }
});
