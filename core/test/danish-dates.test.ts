import { expect, test } from "bun:test";
import { COSTUMES } from "../src/costumes.ts";
import {
  BARREL,
  barrelUp,
  CAT_EARS,
  CROWN,
  cracks,
  fastelavnYear,
  HITS,
  isBarrel,
  lootFor,
} from "../src/fastelavn.ts";
import { fireworksOn, rocketsAt } from "../src/fireworks.ts";
import { minutesFrom } from "../src/holidays.ts";
import { townMap } from "../src/maps.ts";
import { NEW_YEAR_MS, newYearShow } from "../src/newyear.ts";
import { BONFIRE, bonfireAt, isBonfire } from "../src/sankthans.ts";
import { itemById } from "../src/shop.ts";
import { copenhagenToMs } from "../src/sky.ts";

const cph = (at: string) => copenhagenToMs(at)!;
const map = townMap([]);

test("minutes from a holiday's midnight, either side of it", () => {
  expect(minutesFrom("sanktHans", cph("2027-06-23T21:00"))).toBe(21 * 60);
  expect(minutesFrom("sanktHans", cph("2027-06-24T00:30"))).toBe(24 * 60 + 30);
  expect(minutesFrom("sanktHans", cph("2027-06-22T23:00"))).toBe(-60);
});

test("the fastelavn barrel hangs all Fastelavn Sunday, on the lawn, with walkable grass either side", () => {
  expect(barrelUp(cph("2027-02-06T23:59"))).toBe(false);
  expect(barrelUp(cph("2027-02-07T00:00"))).toBe(true);
  expect(barrelUp(cph("2027-02-07T23:59"))).toBe(true);
  expect(barrelUp(cph("2027-02-08T00:00"))).toBe(false);
  expect(barrelUp(cph("2026-02-15T12:00"))).toBe(true);
  expect(fastelavnYear(cph("2027-02-07T12:00"))).toBe(2027);
  for (const dx of [-1, 0, 1]) expect(map.at(BARREL.x + dx, BARREL.y)).toBe(".");
  expect(isBarrel(BARREL.x, BARREL.y, cph("2027-02-07T12:00"))).toBe(true);
  expect(isBarrel(BARREL.x, BARREL.y, cph("2027-02-08T12:00"))).toBe(false);
  expect([0, HITS / 4, HITS / 2, HITS - 1, HITS].map(cracks)).toEqual([0, 1, 2, 3, 3]);
});

test("the loot is fixed by the year and the player: some coins, now and then cat ears", () => {
  const all = Array.from({ length: 200 }, (_, id) => lootFor(2027, id + 1));
  for (const l of all) {
    expect(l.coins).toBeGreaterThanOrEqual(5);
    expect(l.coins).toBeLessThanOrEqual(15);
    expect([null, CAT_EARS]).toContain(l.item);
  }
  const ears = all.filter((l) => l.item).length;
  expect(ears).toBeGreaterThan(20);
  expect(ears).toBeLessThan(80);
  expect(lootFor(2027, 7)).toEqual(lootFor(2027, 7));
  expect(itemById(CAT_EARS)?.name).toBe("Cat ears");
  // The crown is the kattekonge's: never sold, never traded.
  expect(itemById(CROWN)).toMatchObject({ name: "Kattekonge crown", tradeable: false, price: 0 });
  expect(COSTUMES.find((c) => c.id === CROWN)?.earned).toBeTruthy();
});

test("the Sankt Hans bonfire: a pile from the morning, lit from 21:00 to 01:00, in front of the Tavern", () => {
  expect(bonfireAt(cph("2027-06-23T07:59"))).toBeNull();
  expect(bonfireAt(cph("2027-06-23T08:00"))).toBe("pile");
  expect(bonfireAt(cph("2027-06-23T20:59"))).toBe("pile");
  expect(bonfireAt(cph("2027-06-23T21:00"))).toBe("lit");
  expect(bonfireAt(cph("2027-06-24T00:59"))).toBe("lit");
  expect(bonfireAt(cph("2027-06-24T01:00"))).toBeNull();
  expect(bonfireAt(cph("2027-07-23T22:00"))).toBeNull();
  for (let i = 0; i < BONFIRE.w; i++) {
    expect(map.at(BONFIRE.x + i, BONFIRE.y)).toBe(".");
    expect(isBonfire(BONFIRE.x + i, BONFIRE.y, cph("2027-06-23T22:00"))).toBe(true);
  }
  expect(isBonfire(BONFIRE.x + BONFIRE.w, BONFIRE.y, cph("2027-06-23T22:00"))).toBe(false);
});

test("fireworks at midnight on New Year's Eve, for ten minutes", () => {
  const midnight = cph("2027-01-01T00:00");
  const show = newYearShow(cph("2026-12-31T23:59"));
  expect(show.at).toBe(midnight);
  expect(newYearShow(cph("2027-01-01T03:00")).at).toBe(midnight);
  expect(fireworksOn(show, midnight - 1)).toBe(false);
  expect(rocketsAt(show, midnight + 5_000).length).toBeGreaterThan(0);
  expect(fireworksOn(show, midnight + NEW_YEAR_MS + 60_000)).toBe(false);
});
