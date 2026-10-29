import { describe, expect, test } from "bun:test";
import { frontier, townMap } from "@tokenmaxxing/core/maps.ts";
import { doorOf } from "../src/game/houses.ts";

describe("doorOf", () => {
  const town = townMap(frontier([]).slice(0, 4));
  const doors: [number, number][] = [];
  for (let y = town.y0; y < town.y0 + town.height; y++)
    for (let x = town.x0; x < town.x0 + town.width; x++) {
      const name = town.kind(x, y).name;
      if (town.kind(x, y).portal && name !== "dungeon gate") doors.push([x, y]);
    }

  test("every tile of a house, a shop and the Inn leads to its own door", () => {
    expect(doors.length).toBeGreaterThan(5);
    for (const [dx, dy] of doors)
      for (let y = dy - 3; y < dy; y++)
        for (let x = dx - 2; x <= dx + 2; x++)
          if (!town.walkable(x, y)) expect(doorOf(town, x, y)).toEqual([dx, dy]);
  });

  test("not from the door itself or open ground", () => {
    const [dx, dy] = doors[0]!;
    expect(doorOf(town, dx, dy)).toBeNull();
    expect(doorOf(town, dx, dy + 1)).toBeNull();
  });
});
