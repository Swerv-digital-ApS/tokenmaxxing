import { describe, expect, test } from "bun:test";
import {
  checkBets,
  colorOf,
  MAX_SPIN,
  nextPhase,
  PAYS,
  settle,
  spinPocket,
  WHEEL,
  wins,
} from "../src/roulette.ts";

describe("roulette", () => {
  test("the wheel has every pocket once; 18 red, 18 black, one zero", () => {
    expect([...(WHEEL as readonly number[])].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 37 }, (_, i) => i),
    );
    expect(WHEEL.filter((n) => colorOf(n) === "red")).toHaveLength(18);
    expect(WHEEL.filter((n) => colorOf(n) === "black")).toHaveLength(18);
    expect(colorOf(0)).toBe("green");
  });

  test("zero loses every outside bet and only wins its own number", () => {
    for (const on of [
      "red",
      "black",
      "even",
      "odd",
      "low",
      "high",
      "d1",
      "d2",
      "d3",
      "c1",
      "c2",
      "c3",
    ] as const)
      expect(wins(on, 0)).toBe(false);
    expect(wins("n:0", 0)).toBe(true);
    expect(wins("n:7", 0)).toBe(false);
  });

  test("every bet covers the numbers it should", () => {
    const cover = (on: Parameters<typeof wins>[0]) =>
      Array.from({ length: 37 }, (_, i) => i).filter((n) => wins(on, n));
    expect(cover("low")).toHaveLength(18);
    expect(cover("high")).toHaveLength(18);
    expect(cover("even")).toHaveLength(18);
    expect(cover("odd")).toHaveLength(18);
    for (const d of ["d1", "d2", "d3", "c1", "c2", "c3"] as const) expect(cover(d)).toHaveLength(12);
    expect(cover("c1").slice(0, 3)).toEqual([1, 4, 7]);
    expect(cover("d2").slice(0, 2)).toEqual([13, 14]);
  });

  test("the house edge is 1/37 on every bet", () => {
    for (const on of ["n:17", "red", "even", "low", "d1", "c3"] as const) {
      let paid = 0;
      for (let p = 0; p < 37; p++) paid += settle([{ on, stake: 100 }], p).payout;
      expect(paid / 37 / 100).toBeCloseTo(36 / 37, 10);
    }
    expect(PAYS.n).toBe(35);
  });

  test("settle returns the stake with a win and nothing with a loss", () => {
    const s = settle(
      [
        { on: "n:17", stake: 10 },
        { on: "red", stake: 20 },
        { on: "black", stake: 5 },
      ],
      17,
    );
    expect(s.color).toBe("black");
    expect(s.results.map((r) => r.payout)).toEqual([360, 0, 10]);
    expect(s.staked).toBe(35);
    expect(s.payout).toBe(370);
  });

  test("checkBets merges, bounds and refuses", () => {
    expect(
      checkBets([
        { on: "red", stake: 5 },
        { on: "red", stake: 7 },
      ]),
    ).toEqual({ bets: [{ on: "red", stake: 12 }] });
    expect("refused" in checkBets([])).toBe(true);
    expect("refused" in checkBets([{ on: "n:37", stake: 5 }])).toBe(true);
    expect("refused" in checkBets([{ on: "n:07", stake: 5 }])).toBe(true);
    expect("refused" in checkBets([{ on: "red", stake: 0 }])).toBe(true);
    expect("refused" in checkBets([{ on: "red", stake: 1.5 }])).toBe(true);
    expect("refused" in checkBets([{ on: "red", stake: MAX_SPIN + 1 }])).toBe(true);
    expect("refused" in checkBets("red")).toBe(true);
  });

  test("spinPocket stays in 0..36", () => {
    expect(spinPocket(() => 0)).toBe(0);
    expect(spinPocket(() => 0.999999999)).toBe(36);
  });
});

describe("nextPhase", () => {
  const v = { phase: "idle", now: 0, endsAt: 0, seated: 0, betting: 0, allReady: true } as const;
  test("idle starts only with someone seated", () => {
    expect(nextPhase(v)).toBeNull();
    expect(nextPhase({ ...v, seated: 1 })).toBe("betting");
  });
  test("betting: spins at the end or when all are ready, but only with bets", () => {
    const b = { ...v, phase: "betting", seated: 2, endsAt: 100, allReady: false } as const;
    expect(nextPhase({ ...b, now: 50, betting: 1 })).toBeNull();
    expect(nextPhase({ ...b, now: 100, betting: 1 })).toBe("spinning");
    expect(nextPhase({ ...b, now: 100, betting: 0 })).toBe("betting");
    expect(nextPhase({ ...b, now: 50, betting: 1, allReady: true })).toBe("spinning");
    expect(nextPhase({ ...b, now: 50, betting: 0, allReady: true })).toBeNull();
    expect(nextPhase({ ...b, seated: 0 })).toBe("idle");
  });
  test("spinning -> result -> betting or idle", () => {
    expect(nextPhase({ ...v, phase: "spinning", endsAt: 10, now: 9, seated: 1 })).toBeNull();
    expect(nextPhase({ ...v, phase: "spinning", endsAt: 10, now: 10, seated: 1 })).toBe("result");
    expect(nextPhase({ ...v, phase: "result", endsAt: 10, now: 10, seated: 1 })).toBe("betting");
    expect(nextPhase({ ...v, phase: "result", endsAt: 10, now: 10 })).toBe("idle");
  });
});
