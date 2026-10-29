import { describe, expect, test } from "bun:test";
import { BARKEEP } from "../src/barkeep.ts";
import { BOTS, type BotDef, BUSY_CROWD, chase, EMPTY_CROWD, lineFor, toCoffee, wander } from "../src/bots.ts";
import { MAX_LEVEL } from "../src/format.ts";
import { MAPS, type MapId, plotId, townMap } from "../src/maps.ts";
import { worldClock } from "../src/range.ts";
import { SHOPKEEPERS } from "../src/shopkeepers.ts";
import { shopOfRoom } from "../src/shoprooms.ts";
import { SPECIALS, specialOn } from "../src/tavern.ts";
import { CHAT_MAX_LENGTH, DIRS, parseLook } from "../src/world.ts";

describe("bots", () => {
  test("every bot is well formed", () => {
    expect(new Set(BOTS.map((b) => b.id)).size).toBe(BOTS.length);
    for (const b of BOTS) {
      expect(b.id).toBeLessThan(0);
      expect(b.level).toBeLessThanOrEqual(MAX_LEVEL);
      expect(parseLook(b.look)).toEqual(b.look);
      expect(b.lines.length).toBeGreaterThan(0);
      for (const line of b.lines) expect(line.length).toBeLessThanOrEqual(CHAT_MAX_LENGTH);
      expect(b.every[0]).toBeGreaterThan(0);
      expect(b.every[1]).toBeGreaterThanOrEqual(b.every[0]);
    }
  });

  test("wanders over walkable tiles only", () => {
    const town = townMap([plotId(2, 0)]);
    let walks = 0;
    for (let i = 0; i < 200; i++) {
      const path = wander(town, 9, 5);
      if (!path) continue;
      walks++;
      let [x, y] = [9, 5];
      for (const dir of path) {
        x += DIRS[dir][0];
        y += DIRS[dir][1];
        expect(town.walkable(x, y)).toBe(true);
      }
    }
    expect(walks).toBeGreaterThan(50);
  });

  test("chases someone and stops next to them", () => {
    const town = townMap([plotId(2, 0)]);
    let [x, y] = [9, 5];
    const [tx, ty] = [9, 12];
    for (let dir = chase(town, x, y, tx, ty); dir; dir = chase(town, x, y, tx, ty)) {
      x += DIRS[dir][0];
      y += DIRS[dir][1];
      expect(town.walkable(x, y)).toBe(true);
    }
    expect(Math.abs(tx - x) + Math.abs(ty - y)).toBe(1);
  });

  test("walks to the coffee machine and faces it", () => {
    const town = MAPS.town;
    const trip = toCoffee(town, 9, 5)!;
    let [x, y] = [9, 5];
    for (const dir of trip.path) {
      x += DIRS[dir][0];
      y += DIRS[dir][1];
    }
    expect(town.at(x + DIRS[trip.facing][0], y + DIRS[trip.facing][1])).toBe("o");
  });

  test("every bot's lines fit in chat once filled in", () => {
    for (const b of BOTS)
      for (const line of [
        ...(b.followLines ?? []),
        ...(b.coffeeLines ?? []),
        ...(b.moments ?? []).flatMap((m) => m.lines),
        ...Object.values(b.weatherLines ?? {}).flat(),
        ...Object.values(b.crowdLines ?? {}).flat(),
        ...(b.specialLines ?? []),
      ])
        expect(
          line
            .replace("{name}", "x".repeat(32))
            .replace("{special}", [...SPECIALS].sort((a, b) => b.length - a.length)[0]!).length,
        ).toBeLessThanOrEqual(CHAT_MAX_LENGTH);
  });

  test("a bot with a home is placed there, and a still one stays", () => {
    const homed = BOTS.filter((b) => b.home);
    expect(homed.map((b) => b.id)).toContain(BARKEEP.id);
    for (const b of homed) {
      const { room, x, y } = b.home!;
      expect(room === "inn" || shopOfRoom(room) !== null).toBe(true);
      expect(MAPS[room as MapId].walkable(x, y)).toBe(true);
    }
    // Only the barkeep and the shopkeepers never walk; the town's characters still start in the square.
    expect(BOTS.filter((b) => b.still).map((b) => b.id)).toEqual([
      BARKEEP.id,
      ...SHOPKEEPERS.map((b) => b.id),
    ]);
    expect(BOTS.filter((b) => !b.home).length).toBeGreaterThanOrEqual(3);
  });

  test("the barkeep has his own id, never follows anyone, and has lines for the room, the weather and the special", () => {
    expect(BARKEEP.id).toBe(-4);
    expect(BARKEEP.followChance).toBe(0);
    expect(BARKEEP.weatherLines?.rain?.length).toBeGreaterThan(0);
    expect(BARKEEP.crowdLines?.empty?.length).toBeGreaterThan(0);
    expect(BARKEEP.crowdLines?.busy?.length).toBeGreaterThan(0);
    expect(BARKEEP.specialLines?.length).toBeGreaterThan(0);
  });
});

describe("what bots say", () => {
  const bot: BotDef = {
    ...BOTS[0]!,
    lines: ["any"],
    followLines: ["@{name} {tokens}", "@{name} hi"],
    coffeeLines: ["{cups} cups"],
    moments: [{ days: [5], from: 17, lines: ["friday night"] }],
  };
  // Friday 2 October 2026, 17:30 in Copenhagen (CEST), and the Thursday before at noon.
  const friday = Date.parse("2026-10-02T15:30:00Z");
  const thursday = Date.parse("2026-10-01T10:00:00Z");
  const low = () => 0;

  test("the world clock is Copenhagen's", () => {
    expect(worldClock(friday)).toEqual({ day: 5, hour: 17 });
    expect(worldClock(Date.parse("2026-10-04T22:30:00Z"))).toEqual({ day: 1, hour: 0 });
  });

  test("coffee first, then whoever it follows, then the time of day", () => {
    const leader = { name: "anna", todayTokens: 4.2e9 };
    expect(lineFor(bot, friday, { leader, cups: 3 }, low)).toBe("3 cups");
    expect(lineFor(bot, friday, { leader }, low)).toBe("@anna 4.2B");
    expect(lineFor(bot, friday, {}, low)).toBe("friday night");
    expect(lineFor(bot, thursday, {}, low)).toBe("any");
    expect(lineFor(bot, friday, {}, () => 0.99)).toBe("any");
  });

  test("no token lines for someone with no tokens today", () => {
    expect(lineFor(bot, thursday, { leader: { name: "bo", todayTokens: 0 } }, low)).toBe("@bo hi");
  });

  test("the room, the weather and the special get a word in a third of the time", () => {
    const keep: BotDef = {
      ...BARKEEP,
      lines: ["any"],
      moments: [],
      weatherLines: { rain: ["rain"] },
      crowdLines: { empty: ["empty"], busy: ["busy"] },
      specialLines: ["special: {special}"],
    };
    const day = Date.parse("2026-10-22T10:00:00Z");
    // Under a third: the situational lines; over it: anything else.
    expect(lineFor(keep, day, { crowd: 2 }, low)).toBe(`special: ${specialOn(new Date(day))}`);
    expect(lineFor(keep, day, { crowd: 0 }, low)).toBe("empty");
    // Alone with the one who hears him still counts as empty (nobody speaks to a room with nobody in it).
    expect(lineFor(keep, day, { crowd: EMPTY_CROWD }, low)).toBe("empty");
    expect(lineFor(keep, day, { crowd: BUSY_CROWD }, low)).toBe("busy");
    expect(lineFor(keep, day, { crowd: 2, weather: "rain" }, low)).toBe("rain");
    expect(lineFor(keep, day, { crowd: 2, weather: "rain" }, () => 0.9)).toBe("any");
    // Weather he has no line for just leaves the special.
    expect(lineFor(keep, day, { weather: "snow" }, low)).toBe(`special: ${specialOn(new Date(day))}`);
  });

  test("a bot without room lines is unaffected by the room and the weather", () => {
    expect(lineFor(bot, friday, { crowd: 0, weather: "rain" }, low)).toBe("friday night");
  });
});
