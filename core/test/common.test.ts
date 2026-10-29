import { afterEach, describe, expect, test } from "bun:test";
import {
  COMMON_ZONES,
  commonRoom,
  commonSeats,
  commonStairs,
  commonWindows,
  houseStairs,
  wallOfWins,
} from "../src/common.ts";
import { LEGEND, MAPS } from "../src/maps.ts";
import { COMPANY_FURNITURE, hqMap } from "../src/office.ts";
import {
  baseMap,
  commonOfRoom,
  companyOfRoom,
  mapOf,
  memberRoomOf,
  portal,
  roomEntry,
  route,
  setDrops,
} from "../src/world.ts";

const plots = new Map([[1000, { id: 7, name: "Arox" }]]);
const map = MAPS.common;

describe("the company common room", () => {
  afterEach(() => setDrops("common:7", []));

  test("24x14, one exit, rectangular, every tile in the legend", () => {
    expect([map.width, map.height]).toEqual([24, 14]);
    expect(map.name).toBe("Common room");
    expect(commonStairs()).toEqual([[11, 13]]);
    for (const row of map.rows) for (const ch of row) expect(LEGEND[ch]).toBeDefined();
  });

  test("room ids: common:<company> is its own room, owned by that company", () => {
    expect(commonRoom(7)).toBe("common:7");
    expect(commonOfRoom("common:7")).toBe(7);
    expect(companyOfRoom("common:7")).toBeNull();
    expect(memberRoomOf("common:7")).toBe(7);
    expect(memberRoomOf("hq:7")).toBe(7);
    expect(memberRoomOf("inn")).toBeNull();
    expect(baseMap("common:7")).toBe(MAPS.common);
  });

  test("stairs both ways: the house's `u` goes up, the common room's exit comes back below it", () => {
    const [ux, uy] = houseStairs()[0]!;
    expect(MAPS.hq.at(ux, uy)).toBe("u");
    expect(hqMap([]).at(ux, uy)).toBe("u");
    expect(MAPS.hq.walkable(ux, uy - 1)).toBe(true);
    const up = portal("hq:7", { ch: "u", x: ux, y: uy }, 7, plots);
    expect(up).toEqual(roomEntry("common:7"));
    expect(up).toMatchObject({ room: "common:7", x: 11, y: 12, facing: "up" });
    const [ex, ey] = commonStairs()[0]!;
    const down = portal("common:7", { ch: "x", x: ex, y: ey }, 7, plots);
    expect(down).toEqual({ room: "hq:7", x: ux, y: uy - 1, facing: "up" });
    expect(mapOf("hq:7").walkable(down && "x" in down ? down.x : -1, uy - 1)).toBe(true);
  });

  test("members only: another company's stairs and a freelancer's are locked", () => {
    const [ux, uy] = houseStairs()[0]!;
    expect(portal("hq:7", { ch: "u", x: ux, y: uy }, 8, plots)).toEqual({
      notice: "🔒 The common room is for members only.",
    });
    expect("notice" in portal("hq:7", { ch: "u", x: ux, y: uy }, null, plots)).toBe(true);
  });

  test("the house's own exit still goes out the door", () => {
    expect(
      portal("hq:7", { ch: "x", x: 11, y: 13 }, 7, new Map([[1000, { id: 7, name: "Arox" }]])),
    ).toMatchObject({
      room: "town",
    });
  });

  test("every seat can be walked up to from the stairs, and seats are proper sit anchors", () => {
    const entry = roomEntry("common:7");
    const seats = commonSeats();
    expect(seats.length).toBeGreaterThanOrEqual(12);
    // A long sofa, armchairs, beanbags and kitchen stools.
    for (const ch of ["s", "μ", "ε", "v"]) expect(seats.some((s) => s.ch === ch)).toBe(true);
    for (const seat of seats) {
      expect(LEGEND[seat.ch]!.seat).toBeDefined();
      expect(map.walkable(seat.x, seat.y)).toBe(false);
      // `route` ends one step short of a blocked tile: a way to its neighbour means someone can face it.
      const next = [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ].some(([dx, dy]) => {
        const nx = seat.x + dx!;
        const ny = seat.y + dy!;
        return map.walkable(nx, ny) && route(map, [entry.x, entry.y], [nx, ny]) !== null;
      });
      expect(next).toBe(true);
      expect(seat.facing).toBe(seat.kind === "chair" ? "up" : "down");
    }
  });

  test("the zones hold what they say, and everything is reachable", () => {
    const at = (z: { x: number; y: number; w: number; h: number }) =>
      Array.from({ length: z.h }, (_, j) =>
        Array.from({ length: z.w }, (_, i) => map.at(z.x + i, z.y + j)).join(""),
      ).join("");
    expect(at(COMMON_ZONES.stage)).toContain("ξξ");
    expect(at(COMMON_ZONES.stage).split("e").length).toBeGreaterThan(8);
    expect(at(COMMON_ZONES.lounge)).toContain("tt");
    expect(at(COMMON_ZONES.lounge)).toContain("ssssss");
    expect(at(COMMON_ZONES.kitchen)).toContain("ψπππααo");
    expect(at(COMMON_ZONES.games)).toContain("θθθ");
    expect(at(COMMON_ZONES.games)).toContain("φφ");
    expect(at(COMMON_ZONES.petCorner)).toContain("Q");
    expect(at(COMMON_ZONES.wall)).toBe("ΘΘΘΘ");
    expect(wallOfWins()).toHaveLength(4);
    expect(commonWindows().length).toBeGreaterThanOrEqual(6);
    // The stage is walkable; the coffee machine and the espresso bar pour.
    expect(LEGEND.e!.walk).toBe(true);
    expect(LEGEND.o!.pours && LEGEND.α!.pours).toBe(true);
    const entry = roomEntry("common:7");
    const standable = (x: number, y: number) =>
      [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ].some(([dx, dy]) => {
        const [nx, ny] = [x + dx!, y + dy!];
        return map.walkable(nx, ny) && route(map, [entry.x, entry.y], [nx, ny]) !== null;
      });
    for (const ch of ["e", "ψ", "π", "α", "o", "θ", "φ", "Q", "t", "ξ", "Θ", "k", "Ψ"])
      expect(map.find(ch).some(([x, y]) => standable(x, y))).toBe(true);
  });

  test("company furniture put out here is drawn into the room; its legend chars exist", () => {
    const sofa = COMPANY_FURNITURE.find((f) => f.art === "beanbag")!;
    setDrops("common:7", [
      { id: 1, item: `furn.${sofa.ch}`, room: "common:7", x: 3, y: 9, by: 1, at: 0, co: 7 },
    ]);
    expect(mapOf("common:7").at(3, 9)).toBe(sofa.ch);
    expect(mapOf("common:7").kind(3, 9).seat).toBe("sofa");
    // The same map object until something changes; the house stays untouched.
    expect(mapOf("common:7")).toBe(mapOf("common:7"));
    expect(mapOf("hq:7").at(3, 9)).not.toBe(sofa.ch);
  });
});
