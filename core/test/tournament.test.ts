import { describe, expect, test } from "bun:test";
import {
  champion,
  IDLE_MS,
  isTournamentGame,
  makeBracket,
  report,
  roundName,
  shuffle,
  startDue,
  startsAt,
  TOURNAMENT_GAMES,
  WAIT_MS,
  waiting,
} from "../src/tournament.ts";

const ids = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("tournament rules", () => {
  test("only head-to-head games", () => {
    expect(TOURNAMENT_GAMES).toContain("spr");
    expect(isTournamentGame("tokenmaxxing")).toBe(false);
    expect(isTournamentGame("nope")).toBe(false);
  });

  test("shuffle is deterministic and keeps everyone", () => {
    expect(shuffle(ids(8), 5)).toEqual(shuffle(ids(8), 5));
    expect([...shuffle(ids(8), 5)].sort()).toEqual(ids(8));
  });

  test("start: full, or 5 minutes with at least 4", () => {
    const t = { size: 8 as const, players: ids(4), createdAt: 1000 };
    expect(startDue(t, 1000 + WAIT_MS - 1)).toBe(false);
    expect(startDue(t, 1000 + WAIT_MS)).toBe(true);
    expect(startDue({ ...t, players: ids(3) }, 1000 + 10 * WAIT_MS)).toBe(false);
    expect(startsAt({ ...t, players: ids(3) })).toBeNull();
    expect(startsAt(t)).toBe(1000 + WAIT_MS);
    expect(startDue({ ...t, players: ids(8) }, 1000)).toBe(true);
    expect(IDLE_MS).toBeGreaterThan(WAIT_MS);
  });

  test("eight players: three rounds, played through to a champion", () => {
    let b = makeBracket(ids(8), 1);
    expect(b.map((r) => r.length)).toEqual([4, 2, 1]);
    expect(waiting(b)).toHaveLength(4);
    // The lower id always wins.
    for (let round = 0; round < 3; round++)
      for (const m of waiting(b)) b = report(b, m.b!, m.a!, Math.min(m.a!, m.b!))!;
    expect(champion(b)).toBe(1);
    expect(waiting(b)).toHaveLength(0);
  });

  test("a match counts once, for its own players, with one of them the winner", () => {
    const b = makeBracket(ids(4), 2);
    const m = waiting(b)[0]!;
    expect(report(b, m.a!, 99, m.a!)).toBeNull();
    expect(report(b, m.a!, m.b!, 99)).toBeNull();
    const after = report(b, m.a!, m.b!, m.a!)!;
    expect(report(after, m.a!, m.b!, m.b!)).toBeNull();
    // The input is left alone.
    expect(b[0]!.every((x) => x.winner === null)).toBe(true);
    // Two who haven't met (different halves) have no match.
    const other = waiting(after)[0]!;
    expect(report(after, m.a!, other.a!, m.a!)).toBeNull();
  });

  test("five players: three byes, spread, and the winners go straight on", () => {
    const b = makeBracket(ids(5), 3);
    expect(b[0]!.filter((m) => m.b === null)).toHaveLength(3);
    expect(b[0]!.filter((m) => m.winner !== null)).toHaveLength(3);
    // The one real first-round match, and a semifinal of two byes.
    expect(waiting(b)).toHaveLength(2);
    let t = b;
    for (let n = 0; n < 8 && champion(t) === null; n++) {
      const m = waiting(t)[0]!;
      t = report(t, m.a!, m.b!, m.a!)!;
    }
    expect(champion(t)).not.toBeNull();
  });

  test("round names", () => {
    expect(roundName(3, 0)).toBe("Round 1");
    expect(roundName(3, 1)).toBe("Semifinal");
    expect(roundName(3, 2)).toBe("Final");
    expect(roundName(2, 0)).toBe("Semifinal");
  });
});
