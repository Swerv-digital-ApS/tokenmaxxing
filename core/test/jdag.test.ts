import { expect, test } from "bun:test";
import { daysFrom } from "../src/holidays.ts";
import { isTruck, JULEBRYG, julebrygOn, TRUCK, truckAt } from "../src/jdag.ts";
import { townMap } from "../src/maps.ts";
import { copenhagenToMs } from "../src/sky.ts";
import { paperRides } from "../src/street.ts";
import { buffAt, SPECIALS, serveUntil, specialBuff, specialOn } from "../src/tavern.ts";

const cph = (at: string) => copenhagenToMs(at)!;

test("J-dag is the first Friday of November, counted in days either side", () => {
  expect(daysFrom("jDag", cph("2026-11-06T12:00"))).toBe(0);
  expect(daysFrom("jDag", cph("2026-11-08T12:00"))).toBe(2);
  expect(daysFrom("jDag", cph("2026-10-31T12:00"))).toBe(-6);
  expect(daysFrom("jDag", cph("2027-11-05T21:00"))).toBe(0);
});

test("the truck drives in at 20:59, parks till 03:00, and drives off", () => {
  expect(truckAt(cph("2026-11-06T20:58"))).toBeNull();
  expect(truckAt(cph("2026-11-06T20:59"))).toEqual({ x: TRUCK.from, y: TRUCK.y, parked: false });
  const halfway = truckAt(cph("2026-11-06T20:59") + 30_000)!;
  expect(halfway.parked).toBe(false);
  expect(halfway.x).toBeCloseTo((TRUCK.from + TRUCK.park) / 2);
  expect(truckAt(cph("2026-11-06T21:00"))).toEqual({ x: TRUCK.park, y: TRUCK.y, parked: true });
  expect(truckAt(cph("2026-11-07T02:59"))?.parked).toBe(true);
  expect(truckAt(cph("2026-11-07T03:00"))).toEqual({ x: TRUCK.park, y: TRUCK.y, parked: false });
  expect(truckAt(cph("2026-11-07T03:01"))).toBeNull();
  // Not on any other Friday night.
  expect(truckAt(cph("2026-11-13T22:00"))).toBeNull();
  expect(truckAt(cph("2027-11-05T22:00"))?.parked).toBe(true);
});

test("parked, it stands on the road under the square, gone before the paperboy rides it", () => {
  const night = cph("2026-11-06T22:00");
  const map = townMap([]);
  for (let x = TRUCK.park; x < TRUCK.park + TRUCK.w; x++) {
    expect(isTruck(x, TRUCK.y, night)).toBe(true);
    expect(map.at(x, TRUCK.y)).toBe(",");
  }
  expect(isTruck(TRUCK.park - 1, TRUCK.y, night)).toBe(false);
  expect(isTruck(TRUCK.park + TRUCK.w, TRUCK.y, night)).toBe(false);
  expect(isTruck(TRUCK.park, TRUCK.y, cph("2026-11-06T20:59"))).toBe(false);
  // The paper round starts at 07:00, long after it has gone.
  expect(paperRides(map.find("I"), 0, 20)[0]!.at).toBeGreaterThan((TRUCK.leaves + TRUCK.drive) % (24 * 60));
});

test("the Tavern pours Nissebryg from 20:59 on J-dag till Sunday is out, with a glow", () => {
  expect(julebrygOn(cph("2026-11-06T20:58"))).toBe(false);
  expect(julebrygOn(cph("2026-11-06T20:59"))).toBe(true);
  expect(julebrygOn(cph("2026-11-08T23:59"))).toBe(true);
  expect(julebrygOn(cph("2026-11-09T00:00"))).toBe(false);
  const fri = cph("2026-11-06T21:30");
  expect(specialOn(new Date(fri))).toBe(JULEBRYG.line);
  expect(buffAt(fri)).toBe("glow");
  expect(specialBuff(serveUntil(fri))).toBe("glow");
  expect(SPECIALS).toContain(specialOn(new Date(cph("2026-11-06T20:00"))) as never);
  expect(JULEBRYG.line).not.toMatch(/tuborg|carlsberg/i);
});
