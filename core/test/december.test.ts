import { expect, test } from "bun:test";
import {
  DOORS,
  decemberSnow,
  doorDay,
  doorOn,
  giftLabel,
  JULEFROKOST_MENU,
  julefrokostOn,
} from "../src/december.ts";
import { itemById } from "../src/shop.ts";
import { CALM, copenhagenToMs } from "../src/sky.ts";
import { buffAt, SPECIALS, specialOn } from "../src/tavern.ts";

const cph = (at: string) => copenhagenToMs(at)!;

test("24 doors, a gift behind each: coins, or something that exists to wear", () => {
  expect(DOORS).toHaveLength(24);
  for (const g of DOORS) {
    if ("coins" in g) expect(g.coins).toBeGreaterThan(0);
    else {
      // Plain checks: toMatchObject with a matcher writes the matcher into the shop's own item.
      expect(itemById(g.item)?.name).toBe(g.name);
      expect(itemById(g.item)?.slot).toMatch(/hat|glasses/);
    }
  }
  expect(giftLabel(DOORS[23]!)).toBe("Julehue");
  expect(giftLabel({ coins: 12 })).toBe("🪙 12");
});

test("a door a day from 1 to 24 December, on Copenhagen's date", () => {
  expect(doorOn(cph("2026-11-30T23:59"))).toBeNull();
  expect(doorOn(cph("2026-12-01T00:00"))).toBe(1);
  expect(doorOn(cph("2026-12-24T23:59"))).toBe(24);
  expect(doorOn(cph("2026-12-25T00:00"))).toBeNull();
  expect(doorDay(6, cph("2026-12-06T10:00"))).toBe("2026-12-06");
});

test("julefrokost is Friday and Saturday evenings in December, until Christmas", () => {
  expect(julefrokostOn(cph("2026-12-04T17:59"))).toBe(false); // Friday, early
  expect(julefrokostOn(cph("2026-12-04T18:00"))).toBe(true);
  expect(julefrokostOn(cph("2026-12-05T23:59"))).toBe(true); // Saturday
  expect(julefrokostOn(cph("2026-12-06T19:00"))).toBe(false); // Sunday
  expect(julefrokostOn(cph("2026-12-10T19:00"))).toBe(false); // Thursday
  expect(julefrokostOn(cph("2026-12-25T19:00"))).toBe(false); // Christmas Day, a Friday
  expect(julefrokostOn(cph("2026-11-27T19:00"))).toBe(false);
  // The tap serves the evening's dish, with a glow, and the day's special again on Sunday.
  const fri = cph("2026-12-11T20:00");
  expect(JULEFROKOST_MENU).toContain(specialOn(new Date(fri)) as never);
  expect(buffAt(fri)).toBe("glow");
  expect(SPECIALS).toContain(specialOn(new Date(cph("2026-12-13T20:00"))) as never);
});

test("in December it snows whatever the real weather; not before", () => {
  const dec = cph("2026-12-10T12:00");
  for (const kind of ["clear", "cloudy", "fog", "drizzle", "rain", "storm"] as const) {
    const w = decemberSnow({ ...CALM, kind, intensity: 0.2, windMs: 7 }, dec);
    expect(w).toMatchObject({ kind: "snow", intensity: 0.4, windMs: 7 });
  }
  expect(decemberSnow({ ...CALM, kind: "snow", intensity: 0.9 }, dec).intensity).toBe(0.9);
  expect(decemberSnow({ ...CALM, kind: "fog", intensity: 0.5 }, cph("2026-11-30T12:00")).kind).toBe("fog");
  expect(decemberSnow(CALM, cph("2027-01-02T12:00")).kind).toBe("clear");
});
