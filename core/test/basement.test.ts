import { describe, expect, test } from "bun:test";
import { GAMES, parseOptions, publicStatus } from "../src/games/index.ts";
import { sprint } from "../src/games/sprint.ts";
import { isRefused } from "../src/games/types.ts";
import { LEGEND, MAPS } from "../src/maps.ts";
import { CABINET_GAMES, isLanParty, isTavernRoom } from "../src/tavern.ts";
import { homeRoom, portal, roomEntry } from "../src/world.ts";

const T0 = 1_000_000;
const none = new Map();

describe("the basement", () => {
  const map = MAPS.basement;

  test("22x14, one exit (the stairs up), the entry steps in just above it", () => {
    expect([map.width, map.height]).toEqual([22, 14]);
    expect(map.name).toBe("The Basement");
    expect(map.rows.every((r) => [...r].length === 22)).toBe(true);
    expect(map.find("x")).toEqual([[10, 13]]);
    expect(roomEntry("basement")).toEqual({ room: "basement", x: 10, y: 12, facing: "up" });
    expect(map.walkable(10, 12)).toBe(true);
  });

  test("one cabinet per game, a six-wide screen, two wall terminals", () => {
    expect(map.find("C")).toHaveLength(CABINET_GAMES.length);
    expect(map.find("E")).toHaveLength(6);
    expect(map.find("M")).toHaveLength(2);
    // The tournament board is on the back wall, with floor in front of it to stand on.
    const [[bx, by]] = map.find("i") as [[number, number]];
    expect(map.walkable(bx, by + 1)).toBe(true);
    for (const g of CABINET_GAMES) expect(GAMES[g]).toBeDefined();
  });

  test("every tile character is in the legend, and the Tavern keeps its one door", () => {
    for (const row of map.rows) for (const ch of row) expect(LEGEND[ch]).toBeDefined();
    expect(LEGEND.S).toMatchObject({ portal: true });
    expect(LEGEND.x).toMatchObject({ portal: true });
    expect(MAPS.inn.find("S")).toEqual([[26, 16]]);
    expect(MAPS.inn.find("x")).toHaveLength(1);
  });

  test("the stairs round trip: down from the Tavern, up to just above its stairs", () => {
    const [sx, sy] = MAPS.inn.find("S")[0]!;
    expect(portal("inn", { ch: "S", x: sx, y: sy }, null, none)).toEqual(roomEntry("basement"));
    expect(portal("basement", { ch: "x", x: 10, y: 13 }, null, none)).toEqual({
      room: "inn",
      x: sx,
      y: sy - 1,
      facing: "up",
    });
    // The Tavern's own door still leads outside.
    expect(portal("inn", { ch: "x", x: 13, y: 18 }, null, none)).toMatchObject({ room: "town" });
  });

  test("the basement counts as Tavern time", () => {
    expect(isTavernRoom("inn")).toBe(true);
    expect(isTavernRoom("basement")).toBe(true);
    expect(isTavernRoom("town")).toBe(false);
    expect(isTavernRoom("hq:1")).toBe(false);
  });
});

describe("the LAN party", () => {
  test("Friday and Saturday evenings in Copenhagen, and only then", () => {
    // 2026-10-23 is a Friday (CEST, UTC+2).
    expect(isLanParty(Date.parse("2026-10-23T15:00:00Z"))).toBe(false); // 17:00
    expect(isLanParty(Date.parse("2026-10-23T16:00:00Z"))).toBe(true); // 18:00
    expect(isLanParty(Date.parse("2026-10-24T20:00:00Z"))).toBe(true); // Sat 22:00
    expect(isLanParty(Date.parse("2026-10-24T22:30:00Z"))).toBe(false); // Sun 00:30
    expect(isLanParty(Date.parse("2026-10-22T19:00:00Z"))).toBe(false); // Thursday
  });
});

describe("what the big screen may show", () => {
  test("a match's wire status has the public fields and no view or state, for every game", () => {
    for (const def of Object.values(GAMES)) {
      const state = def!.setup([1, 2], 1234567, parseOptions(def!, {}), T0);
      const wire = publicStatus(def!, state, [1, 2], 3, T0 + 5_000);
      expect(Object.keys(wire).sort()).toEqual(["board", "endsAt", "headline", "status", "watchers"]);
      expect(wire).not.toHaveProperty("view");
      expect(wire).not.toHaveProperty("state");
      expect(wire.watchers).toBe(3);
      expect(Object.keys(wire.status)).toEqual(["1", "2"]);
    }
  });

  test("Sprint: what the world is told never holds anyone's typed text", () => {
    let s = sprint.setup([1, 2], 7, { seconds: 30 }, T0);
    const r = sprint.move(s, 1, { typed: "secretword" }, s.startsAt + 1_000);
    if (isRefused(r)) throw new Error(r.refused);
    s = r;
    s = { ...s, racers: { ...s.racers, 2: { ...s.racers[2]!, typed: "qqqzzz" } } };
    const wire = JSON.stringify(publicStatus(sprint, s, [1, 2], 0, s.startsAt + 1_000));
    expect(wire).not.toContain("secretword");
    expect(wire).not.toContain("qqqzzz");
    // Spectators' own view of the match holds none either.
    const watching = JSON.stringify(sprint.view(s, null, s.startsAt + 1_000));
    expect(watching).not.toContain("secretword");
    expect(watching).not.toContain("qqqzzz");
  });
});

describe("upstairs", () => {
  const map = MAPS.upstairs;

  test("everyone without a company sleeps here; every tile is in the legend", () => {
    expect(homeRoom(null)).toBe("upstairs");
    expect(homeRoom(3)).toBe("hq:3");
    for (const row of map.rows) for (const ch of row) expect(LEGEND[ch]).toBeDefined();
    expect(map.rows.every((r) => [...r].length === map.width)).toBe(true);
    expect(isTavernRoom("upstairs")).toBe(true);
  });

  test("the stairs round trip: up from the Tavern, down to just above its stairs up", () => {
    const [ux, uy] = MAPS.inn.find("u")[0]!;
    expect(LEGEND.u).toMatchObject({ portal: true });
    expect(portal("inn", { ch: "u", x: ux, y: uy }, null, none)).toEqual(roomEntry("upstairs"));
    const [ex, ey] = map.find("x")[0]!;
    expect(portal("upstairs", { ch: "x", x: ex, y: ey }, null, none)).toEqual({
      room: "inn",
      x: ux,
      y: uy - 1,
      facing: "up",
    });
    // The stairs down still lead down, and the board that used to be on the wall is gone.
    expect(portal("inn", { ch: "S", x: 3, y: 13 }, null, none)).toEqual(roomEntry("basement"));
    expect(MAPS.inn.find("w")).toHaveLength(0);
  });
});
