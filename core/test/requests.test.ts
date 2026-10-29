import { describe, expect, test } from "bun:test";
import { MAPS } from "../src/maps.ts";
import { byPile, isStatus, type RequestEntry } from "../src/requests.ts";

const entry = (
  id: number,
  status: RequestEntry["status"],
  votes: number,
  createdAt: number,
): RequestEntry => ({
  id,
  userId: 1,
  name: "a",
  text: "more hats please",
  status,
  votes,
  voted: false,
  createdAt,
});

describe("the request pile", () => {
  test("planned first, then open by votes with the newest among equals, then done and turned down", () => {
    const pile = [
      entry(1, "done", 9, 5),
      entry(2, "open", 1, 1),
      entry(3, "declined", 0, 9),
      entry(4, "open", 3, 2),
      entry(5, "planned", 0, 3),
      entry(6, "open", 3, 8),
    ].sort(byPile);
    expect(pile.map((e) => e.id)).toEqual([5, 6, 4, 2, 1, 3]);
  });

  test("only the four statuses are statuses", () => {
    expect(["open", "planned", "done", "declined"].every(isStatus)).toBe(true);
    expect(isStatus("closed")).toBe(false);
    expect(isStatus(3)).toBe(false);
  });

  test("the board is on the Tavern's wall with floor in front of it to stand on", () => {
    const map = MAPS.inn;
    const tiles = map.find("?");
    expect(tiles).toHaveLength(1);
    const [[x, y]] = tiles as [[number, number]];
    expect(map.walkable(x, y + 1)).toBe(true);
  });
});
