import { describe, expect, test } from "bun:test";
import { BOTS } from "../src/bots.ts";
import {
  BURN_FRESH_MS,
  CHARGES,
  COP,
  chargeOf,
  parseTicket,
  pullOverLine,
  rateOf,
  SIREN,
  SPEED_LIMIT,
  speeder,
  TICKET_MARK,
  ticketKey,
  ticketLine,
  writeTicket,
} from "../src/cop.ts";

describe("the 429 cop", () => {
  const now = 10_000_000;

  test("walks the town with the other bots", () => {
    expect(BOTS).toContain(COP);
  });

  test("pulls over the fastest fresh burn over the limit", () => {
    const burns = [
      { id: 1, tokens: SPEED_LIMIT * 2, at: now },
      { id: 2, tokens: SPEED_LIMIT * 3, at: now - 60_000 },
      { id: 3, tokens: SPEED_LIMIT - 1, at: now },
      // The fastest, but stopped syncing a while ago.
      { id: 4, tokens: SPEED_LIMIT * 9, at: now - BURN_FRESH_MS - 1 },
    ];
    expect(speeder(burns, now)?.id).toBe(2);
    // Off limits (out of town, ticketed today): the next one.
    expect(speeder(burns, now, (id) => id === 2)?.id).toBe(1);
    expect(speeder(burns, now, (id) => id !== 3)).toBeNull();
    expect(speeder([], now)).toBeNull();
  });

  test("the limit is 200M tokens an hour", () => {
    expect(SPEED_LIMIT).toBe(200_000_000);
    // A heavy but ordinary hour (150M) isn't speeding.
    expect(speeder([{ id: 1, tokens: 150_000_000, at: now }], now)).toBeNull();
    expect(speeder([{ id: 1, tokens: 200_000_000, at: now }], now)?.id).toBe(1);
  });

  test("writes the speed down to two figures", () => {
    expect(rateOf(247_600_000)).toBe(240_000_000);
    expect(rateOf(47_600_000)).toBe(47_000_000);
    expect(rateOf(203_456_789)).toBe(200_000_000);
    expect(rateOf(200_000_000)).toBe(200_000_000);
    expect(rateOf(0)).toBe(0);
  });

  test("a ticket keeps as a rewards row and comes back the same", () => {
    const t = writeTicket("2026-10-21", 87_654_321, () => 0);
    expect(t).toEqual({ day: "2026-10-21", rate: 87_000_000, charge: 0 });
    expect(ticketKey(t)).toBe("ticket:2026-10-21:87000000:0");
    expect(parseTicket(ticketKey(t))).toEqual(t);
    expect(parseTicket("hat.4")).toBeNull();
    expect(parseTicket("ticket:2026-10-21:x:0")).toBeNull();
  });

  test("every charge says the speed, and the lines fit a bubble", () => {
    for (let charge = 0; charge < CHARGES.length; charge++) {
      const t = { day: "2026-10-21", rate: 2_000_000_000, charge };
      expect(chargeOf(t)).toContain("2B tokens/hour");
      // Three lines of a bubble, at the longest speed.
      expect(ticketLine({ ...t, rate: 999_000_000 }).length).toBeLessThanOrEqual(56);
    }
    expect(chargeOf({ rate: 240_000_000, charge: 0 })).toBe(
      "Exceeding 240M tokens/hour in a residential zone",
    );
    // An unknown charge (from an older list) still reads.
    expect(chargeOf({ rate: 240_000_000, charge: 99 })).toBe(chargeOf({ rate: 240_000_000, charge: 0 }));
  });

  test("his lines start with the siren, so the web flashes it", () => {
    expect(pullOverLine("anna", () => 0)).toBe(`${SIREN} 429 Too Many Requests! Pull over, @anna!`);
    expect(pullOverLine("anna", () => 0.99)).toBe(`${SIREN} @anna do you know how fast you were burning?`);
    expect(ticketLine(writeTicket("2026-10-21", 2.6e8, () => 0))).toBe(
      `${SIREN}${TICKET_MARK} Exceeding 260M tokens/hour in a residential zone.`,
    );
  });
});
