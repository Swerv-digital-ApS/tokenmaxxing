import { describe, expect, test } from "bun:test";
import { LEGEND, MAPS } from "../src/maps.ts";
import {
  act,
  BIG_BLIND,
  type Card,
  cardName,
  describe as describeHand,
  evaluate,
  FIRST_HAND_MS,
  freshDeck,
  holeOf,
  leave,
  legal,
  MAX_TIMEOUTS,
  NEXT_HAND_MS,
  newTable,
  PokerError,
  potOf,
  pots,
  randomInt,
  ready,
  SEATS,
  type Seat,
  SMALL_BLIND,
  seatOf,
  settled,
  shuffle,
  sitDown,
  startHand,
  type Table,
  TURN_MS,
  tick,
  view,
  wire,
} from "../src/poker.ts";
import { CHAIR_CHAR, chairAt, pokerChairs, pokerTable } from "../src/pokertable.ts";
import { DIRS, route } from "../src/world.ts";

/** `As`, `Td`, `2c`: rank then suit, as the cards are written. */
const c = (name: string): Card => {
  const rank = "23456789TJQKA".indexOf(name[0]!);
  const suit = "cdhs".indexOf(name[1]!);
  if (rank < 0 || suit < 0) throw new Error(`bad card ${name}`);
  return rank + 13 * suit;
};
const hand = (s: string): Card[] => s.split(" ").map(c);
const score = (s: string): number => evaluate(hand(s));

/** A small seeded generator (mulberry32), so the random tests are the same every run. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("hand ranking", () => {
  test("the categories run in order", () => {
    const ladder = [
      "2c 5d 7h 9s Jc", // high card
      "2c 2d 7h 9s Jc", // pair
      "2c 2d 7h 7s Jc", // two pair
      "2c 2d 2h 9s Jc", // trips
      "5c 6d 7h 8s 9c", // straight
      "2c 5c 7c 9c Jc", // flush
      "2c 2d 2h 9s 9c", // full house
      "2c 2d 2h 2s Jc", // quads
      "5c 6c 7c 8c 9c", // straight flush
    ].map(score);
    for (let i = 1; i < ladder.length; i++) expect(ladder[i]!).toBeGreaterThan(ladder[i - 1]!);
  });

  test("the wheel is a five-high straight: beats a pair, loses to a six-high straight", () => {
    const wheel = score("Ac 2d 3h 4s 5c");
    expect(wheel).toBeGreaterThan(score("Ac Ad 3h 4s 9c"));
    expect(wheel).toBeLessThan(score("2c 3d 4h 5s 6c"));
    expect(describeHand(wheel)).toBe("Straight, Five high");
    // An ace is not a deuce's neighbour the other way round: K-A-2-3-4 is not a straight.
    expect(evaluate(hand("Kc Ad 2h 3s 4c"))).toBeLessThan(wheel);
  });

  test("the wheel flush is the lowest straight flush; the royal is the highest", () => {
    const wheelFlush = score("Ac 2c 3c 4c 5c");
    expect(wheelFlush).toBeGreaterThan(score("2c 2d 2h 2s Ac"));
    expect(wheelFlush).toBeLessThan(score("2c 3c 4c 5c 6c"));
    const royal = score("Tc Jc Qc Kc Ac");
    expect(royal).toBeGreaterThan(score("9c Tc Jc Qc Kc"));
    expect(describeHand(royal)).toBe("Royal flush");
  });

  test("kickers decide equal pairs, then ties are ties", () => {
    expect(score("Ac Ad Kh 7s 3c")).toBeGreaterThan(score("Ac Ad Qh 7s 3c"));
    expect(score("Ac Ad Kh 7s 3c")).toBeGreaterThan(score("Ac Ad Kh 6s 3c"));
    expect(score("Ac Ad Kh 7s 3c")).toBeGreaterThan(score("Ac Ad Kh 7s 2c"));
    // Same ranks, different suits.
    expect(score("Ac Ad Kh 7s 3c")).toBe(score("Ah As Kd 7c 3d"));
  });

  test("two pair: the higher pair, then the lower, then the kicker", () => {
    expect(score("Kc Kd 5h 5s 2c")).toBeGreaterThan(score("Qc Qd Jh Js Ac"));
    expect(score("Kc Kd 5h 5s 2c")).toBeGreaterThan(score("Kc Kd 4h 4s Ac"));
    expect(score("Kc Kd 5h 5s Ac")).toBeGreaterThan(score("Kc Kd 5h 5s Qc"));
  });

  test("seven cards: the best five count, a third pair is only a kicker", () => {
    // Three pairs: the best two plus the best of the rest.
    expect(evaluate(hand("Ac Ad Kh Ks 2c 2d 3h"))).toBe(score("Ac Ad Kh Ks 3h"));
    // Two trips make a full house.
    expect(evaluate(hand("Ac Ad Ah Ks Kc Kd 3h"))).toBe(score("Ac Ad Ah Ks Kc"));
    // Quads over a pair: the kicker is the best other card.
    expect(evaluate(hand("7c 7d 7h 7s Ac Kd Kh"))).toBe(score("7c 7d 7h 7s Ac"));
    // A flush beats the straight made of the same cards, a straight flush beats both.
    expect(evaluate(hand("2h 5h 9h Jh Kh 3c 4d"))).toBeGreaterThan(evaluate(hand("2c 3d 4h 5s 6c 9d Kd")));
    expect(evaluate(hand("5h 6h 7h 8h 9h 9c 9d"))).toBe(score("5h 6h 7h 8h 9h"));
    // Six to a flush: the top five count.
    expect(evaluate(hand("2h 4h 6h 8h Th Qh 3c"))).toBe(score("4h 6h 8h Th Qh"));
    // A straight with a pair in it, and the longest straight.
    expect(evaluate(hand("4c 5d 6h 7s 8c 8d 9h"))).toBe(score("5c 6d 7h 8s 9c"));
    // The board plays: both players have the same best five.
    const board = hand("Ac Kd Qh Js Tc");
    expect(evaluate([...board, c("2c"), c("3d")])).toBe(evaluate([...board, c("4c"), c("5d")]));
  });

  test("describe names the hand", () => {
    expect(describeHand(score("Kc Kd 5h 5s 2c"))).toBe("Two pair, Kings and Fives");
    expect(describeHand(score("2c 2d 2h 9s 9c"))).toBe("Full house, Twos over Nines");
    expect(describeHand(score("6c 6d Ah 9s 2c"))).toBe("Pair of Sixes");
  });
});

describe("the deck", () => {
  test("a shuffle is a permutation, the same for the same dice, and not the identity", () => {
    const a = shuffle(freshDeck(), (n) => Math.floor(seeded(1)() * n));
    expect([...a].sort((x, y) => x - y)).toEqual(freshDeck());
    const rnd = seeded(7);
    const b = shuffle(freshDeck(), (n) => Math.floor(rnd() * n));
    const rnd2 = seeded(7);
    expect(shuffle(freshDeck(), (n) => Math.floor(rnd2() * n))).toEqual(b);
    expect(b).not.toEqual(freshDeck());
    expect(new Set(b).size).toBe(52);
  });

  test("randomInt stays in range and reaches both ends", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) seen.add(randomInt(6));
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(randomInt(1)).toBe(0);
  });

  test("card names", () => {
    expect(cardName(c("As"))).toBe("A♠");
    expect(cardName(c("Td"))).toBe("T♦");
  });
});

// MARK: Tables

/** A table with players in `seats` (seat → stack) all paid up, and the clock at 0. */
function table(stacks: Record<number, number>, seed = 1): Table {
  const rnd = seeded(seed);
  const t = newTable((n) => Math.floor(rnd() * n));
  for (const [at, stack] of Object.entries(stacks)) {
    sitDown(t, Number(at), 100 + Number(at), stack);
    ready(t, Number(at), 0);
  }
  return t;
}

/** Deals with the cards chosen: `holes` by seat, and the five board cards (burns are filler). */
function rig(t: Table, holes: Record<number, string>, board = "2c 7d 9d Jc 3h"): void {
  for (const [at, cards] of Object.entries(holes)) t.seats[Number(at)]!.hole = hand(cards);
  const [f1, f2, f3, turn, river] = hand(board);
  const used = new Set([...Object.values(holes).flatMap(hand), ...hand(board)]);
  const burns = freshDeck().filter((x) => !used.has(x));
  // Dealt from the end: burn, flop, burn, turn, burn, river.
  t.deck = [river!, burns[2]!, turn!, burns[1]!, f3!, f2!, f1!, burns[0]!];
}

const stacks = (t: Table): number[] => t.seats.map((s) => s?.stack ?? 0);
const total = (t: Table): number =>
  t.seats.reduce((n, s) => n + (s ? s.stack + s.put : 0), 0) + t.owed.reduce((n, o) => n + o.stack, 0);
const play = (t: Table, at: number, type: "fold" | "check" | "call") => act(t, at, { type }, 0);
const raise = (t: Table, at: number, to: number) => act(t, at, { type: "raise", to }, 0);
const deal = (t: Table) => expect(startHand(t, 0)).toBe(true);

describe("blinds and the button", () => {
  test("heads-up: the dealer posts the small blind and acts first; the button swaps each hand", () => {
    const t = table({ 0: 200, 3: 200 });
    deal(t);
    expect(t.button).toBe(0);
    expect(stacks(t)).toEqual([200 - SMALL_BLIND, 0, 0, 200 - BIG_BLIND, 0, 0]);
    expect(t.toAct).toBe(0);
    expect(t.seats[0]!.hole).toHaveLength(2);
    // After the flop the big blind (not the dealer) opens.
    play(t, 0, "call");
    play(t, 3, "check");
    expect(t.street).toBe("flop");
    expect(t.toAct).toBe(3);
    // The next hand: the button moves, so the other posts the small blind.
    play(t, 3, "check");
    play(t, 0, "check");
    play(t, 3, "check");
    play(t, 0, "check");
    play(t, 3, "check");
    play(t, 0, "check");
    expect(t.street).toBeNull();
    startHand(t, 0);
    expect(t.button).toBe(3);
    expect(t.toAct).toBe(3);
    expect(t.seats[3]!.bet).toBe(SMALL_BLIND);
    expect(t.seats[0]!.bet).toBe(BIG_BLIND);
  });

  test("three or more: blinds follow the dealer, the seat after the big blind opens, the small blind opens after the flop", () => {
    const t = table({ 0: 200, 2: 200, 4: 200 });
    deal(t);
    expect(t.button).toBe(0);
    expect(t.seats[2]!.bet).toBe(SMALL_BLIND);
    expect(t.seats[4]!.bet).toBe(BIG_BLIND);
    expect(t.toAct).toBe(0);
    play(t, 0, "call");
    play(t, 2, "call");
    // The big blind has the option to raise.
    expect(legal(t, 4)!.canRaise).toBe(true);
    play(t, 4, "check");
    expect(t.street).toBe("flop");
    expect(t.toAct).toBe(2);
    expect(t.board).toHaveLength(3);
  });

  test("the button skips empty and busted seats", () => {
    const t = table({ 1: 200, 5: 200 });
    deal(t);
    expect(t.button).toBe(1);
    fold(t);
    startHand(t, 0);
    expect(t.button).toBe(5);
  });

  test("a hand needs two players with chips", () => {
    const t = table({ 2: 200 });
    expect(startHand(t, 0)).toBe(false);
    expect(t.street).toBeNull();
    sitDown(t, 4, 7, 200);
    // Held but not paid for: not dealt in.
    expect(startHand(t, 0)).toBe(false);
    ready(t, 4, 0);
    expect(t.nextAt).toBe(FIRST_HAND_MS);
    tick(t, FIRST_HAND_MS - 1);
    expect(t.street).toBeNull();
    tick(t, FIRST_HAND_MS);
    expect(t.street).toBe("preflop");
  });
});

/** The player to act folds, until the hand is over. */
function fold(t: Table): void {
  while (t.street !== null) play(t, t.toAct, "fold");
}

describe("a hand to the end", () => {
  test("all but one fold: the pot goes to the last player and no cards are shown", () => {
    const t = table({ 0: 200, 1: 200, 2: 200 });
    deal(t);
    const open = 3 * BIG_BLIND;
    const pot = open + SMALL_BLIND + BIG_BLIND;
    raise(t, 0, open);
    play(t, 1, "fold");
    play(t, 2, "fold");
    expect(t.street).toBeNull();
    expect(stacks(t).slice(0, 3)).toEqual([200 - open + pot, 200 - SMALL_BLIND, 200 - BIG_BLIND]);
    expect(t.result).toMatchObject({ shown: [], won: { 100: pot } });
    expect(t.result!.pots).toEqual([{ amount: pot, eligible: [100], winners: [100] }]);
    expect(t.nextAt).toBe(NEXT_HAND_MS);
    expect(t.dirty).toBe(true);
    expect(holeOf(t, 100)).toEqual([]);
  });

  test("showdown: the better hand wins and shows", () => {
    const t = table({ 0: 200, 1: 200 });
    deal(t);
    rig(t, { 0: "As Ah", 1: "Ks Kh" });
    play(t, 0, "call");
    play(t, 1, "check");
    for (let i = 0; i < 3; i++) {
      play(t, 1, "check");
      play(t, 0, "check");
    }
    expect(stacks(t).slice(0, 2)).toEqual([200 + BIG_BLIND, 200 - BIG_BLIND]);
    expect(t.result!.shown.map((s) => s.userId)).toEqual([100, 101]);
    expect(t.result!.shown[0]).toMatchObject({ hole: hand("As Ah"), name: "Pair of Aces" });
    expect(t.result!.board).toEqual(hand("2c 7d 9d Jc 3h"));
  });

  test("a split pot: ties share it, the odd chip goes to the winner nearest the dealer's left", () => {
    const t = table({ 0: 200, 1: 200, 2: 200 });
    deal(t);
    // Seat 0 is the dealer; seat 1 (the small blind) folds after putting in the small blind, so the pot is 2 * BB + SB = 5: odd.
    rig(t, { 0: "2s 3s", 1: "4s 5s", 2: "6s 8s" }, "Ac Kd Qh Js Tc");
    play(t, 0, "call");
    play(t, 1, "fold");
    play(t, 2, "check");
    for (let i = 0; i < 3; i++) {
      play(t, 2, "check");
      play(t, 0, "check");
    }
    expect(t.result!.pots).toEqual([{ amount: 5, eligible: [100, 102], winners: [102, 100] }]);
    // 5 splits 3 and 2; the odd chip goes to seat 2, the first winner left of the dealer.
    expect(t.seats[2]!.stack).toBe(200 - BIG_BLIND + 3);
    expect(t.seats[0]!.stack).toBe(200 - BIG_BLIND + 2);
    expect(t.seats[1]!.stack).toBe(200 - SMALL_BLIND);
  });

  test("everyone all-in before the flop: the board runs out at once", () => {
    const t = table({ 0: 100, 1: 100 });
    deal(t);
    rig(t, { 0: "As Ah", 1: "Ks Kh" });
    raise(t, 0, 100);
    play(t, 1, "call");
    expect(t.street).toBeNull();
    expect(t.result!.board).toHaveLength(5);
    // The loser is out, and owed nothing: they have no chips.
    expect(t.owed).toEqual([{ userId: 101, stack: 0 }]);
    expect(t.seats[1]).toBeNull();
    expect(t.seats[0]!.stack).toBe(200);
  });

  test("blinds that put a player all-in end the betting: the uncalled part comes back", () => {
    // With a 1 coin small blind, the big blind can no longer be the short stack (it would still leave the dealer a
    // coin to call), so the dealer is: seat 0 is the dealer and small blind with only SB chips, and the big blind
    // posts BB. The dealer is all-in, the big blind has nobody to bet against. No one has a choice to make.
    const t = table({ 0: SMALL_BLIND, 1: 200 });
    deal(t);
    expect(t.street).toBeNull();
    expect(t.result!.board).toHaveLength(5);
    expect(t.result!.pots.map((p) => p.amount)).toEqual([2 * SMALL_BLIND, BIG_BLIND - SMALL_BLIND]);
    // The coin above the short stack's can only be the big blind's.
    expect(t.result!.pots[1]!.winners).toEqual([101]);
    expect(total(t)).toBe(SMALL_BLIND + 200);
  });
});

describe("side pots", () => {
  test("pot levels from three different all-in amounts", () => {
    const list = pots([
      { userId: 1, put: 50, live: true },
      { userId: 2, put: 100, live: true },
      { userId: 3, put: 200, live: true },
      { userId: 4, put: 30, live: false },
    ]);
    expect(list).toEqual([
      { amount: 50 * 3 + 30, eligible: [1, 2, 3] },
      { amount: 50 * 2, eligible: [2, 3] },
      { amount: 100, eligible: [3] },
    ]);
  });

  /** Three players all in for 50, 100 and 200: seat 0 is short, seat 2 covers them. */
  function shove(holes: Record<number, string>): Table {
    const t = table({ 0: 50, 1: 100, 2: 200 });
    deal(t);
    rig(t, holes);
    // Seat 0 is the dealer, seat 1 the small blind, seat 2 the big blind.
    raise(t, 0, 50);
    raise(t, 1, 100);
    raise(t, 2, 200);
    // The short stack is already all-in; seat 1 is all-in for 100 and has no answer to the raise.
    return t;
  }

  test("the best hand wins the main pot, the next best the side pot, the uncalled chips come back", () => {
    const t = shove({ 0: "As Ah", 1: "Ks Kh", 2: "Qs Qh" });
    expect(t.street).toBeNull();
    expect(t.result!.pots).toEqual([
      { amount: 150, eligible: [100, 101, 102], winners: [100] },
      { amount: 100, eligible: [101, 102], winners: [101] },
      { amount: 100, eligible: [102], winners: [102] },
    ]);
    expect([t.seats[0]!.stack, t.seats[1]!.stack, t.seats[2]!.stack]).toEqual([150, 100, 100]);
  });

  test("the middle stack can win the main pot and the side pot", () => {
    const t = shove({ 0: "Qs Qh", 1: "As Ah", 2: "Ks Kh" });
    expect(t.result!.pots.map((p) => p.winners)).toEqual([[101], [101], [102]]);
    expect([t.seats[0] ?? null, t.seats[1]!.stack, t.seats[2]!.stack]).toEqual([null, 250, 100]);
    // The short stack lost everything.
    expect(t.owed).toEqual([{ userId: 100, stack: 0 }]);
  });

  test("the biggest stack wins everything", () => {
    const t = shove({ 0: "Qs Qh", 1: "Ks Kh", 2: "As Ah" });
    expect(t.seats[2]!.stack).toBe(350);
    expect(t.seats[0]).toBeNull();
    expect(t.seats[1]).toBeNull();
  });

  test("a side pot tie splits only between its eligible players", () => {
    // Seats 1 and 2 hold the same hand; seat 0 has the best but is all-in for less.
    const t = shove({ 0: "As Ah", 1: "Ks Kh", 2: "Kd Kc" });
    expect(t.result!.pots.map((p) => p.winners)).toEqual([[100], [101, 102], [102]]);
    expect([t.seats[0]!.stack, t.seats[1]!.stack, t.seats[2]!.stack]).toEqual([150, 50, 150]);
  });
});

describe("raising", () => {
  test("the least you can raise to is the bet plus the last raise, and a raise sets the next minimum", () => {
    const t = table({ 0: 500, 1: 500, 2: 500 });
    deal(t);
    // The big blind is 2: the first raise goes to at least 4.
    expect(legal(t, 0)).toMatchObject({ toCall: 2, minTo: 4, maxTo: 500, canCheck: false, canRaise: true });
    expect(() => raise(t, 0, 3)).toThrow("least you can raise to is 4");
    expect(() => raise(t, 0, 2)).toThrow(PokerError);
    raise(t, 0, 8);
    // That was a raise of 6: the next goes to at least 14.
    expect(legal(t, 1)!.minTo).toBe(14);
    expect(() => raise(t, 1, 13)).toThrow("least you can raise to is 14");
    raise(t, 1, 14);
    expect(legal(t, 2)!.minTo).toBe(20);
    expect(() => raise(t, 2, 501)).toThrow("only have");
    play(t, 2, "call");
    // The dealer is back to act against the 70.
    expect(t.toAct).toBe(0);
    expect(legal(t, 0)).toMatchObject({ toCall: 6, canRaise: true });
  });

  test("a bet on the flop is at least the big blind", () => {
    const t = table({ 0: 500, 1: 500 });
    deal(t);
    play(t, 0, "call");
    play(t, 1, "check");
    expect(legal(t, 1)).toMatchObject({ canCheck: true, minTo: BIG_BLIND });
    expect(() => raise(t, 1, BIG_BLIND - 1)).toThrow();
    raise(t, 1, BIG_BLIND);
    expect(t.seats[1]!.last).toBe(`bet ${BIG_BLIND}`);
    expect(t.seats[0]!.last).toBeNull();
  });

  test("a short all-in is not a full raise: the minimum raise stays, and everyone just calls", () => {
    const t = table({ 0: 500, 1: 500, 2: 500, 3: BIG_BLIND + 1 });
    deal(t);
    // Seat 0 dealer, 1 small blind, 2 big blind, 3 first to act with BB + 1 chips.
    expect(t.toAct).toBe(3);
    raise(t, 3, BIG_BLIND + 1);
    // 1 on top of the 2 is less than a raise of 2: the bet is 3, the minimum raise is still 2.
    expect(t.bet).toBe(BIG_BLIND + 1);
    expect(t.raise).toBe(BIG_BLIND);
    expect(legal(t, 0)!.minTo).toBe(BIG_BLIND + 1 + BIG_BLIND);
    play(t, 0, "call");
    play(t, 1, "call");
    play(t, 2, "call");
    expect(t.street).toBe("flop");
    expect(potOf(t)).toBe(4 * (BIG_BLIND + 1));
  });

  test("a genuinely short all-in leaves earlier callers able to call or fold only", () => {
    const t = table({ 0: 500, 1: 500, 2: 7 });
    deal(t);
    // 0 raises to 6 (a raise of 4), 1 calls, 2 (big blind with 7 chips: 5 behind after the 2 blind) shoves.
    raise(t, 0, 6);
    play(t, 1, "call");
    expect(t.seats[2]!.stack).toBe(7 - BIG_BLIND);
    // 2 can put in 5 more: to 7, which is +1 over the 6: short of a raise of 4.
    raise(t, 2, 7);
    expect(t.bet).toBe(7);
    expect(t.raise).toBe(4);
    expect(legal(t, 0)).toMatchObject({ toCall: 1, canRaise: false });
    expect(() => raise(t, 0, 100)).toThrow("can't raise");
    play(t, 0, "call");
    expect(legal(t, 1)).toMatchObject({ toCall: 1, canRaise: false });
    play(t, 1, "call");
    expect(t.street).toBe("flop");
  });

  test("all-in for less than a call is a call; you can't check into a bet or call a check", () => {
    const t = table({ 0: 500, 1: 500 });
    deal(t);
    expect(() => play(t, 0, "check")).toThrow("can't check");
    play(t, 0, "call");
    expect(() => play(t, 0, "call")).toThrow("not your turn");
    expect(() => play(t, 1, "call")).toThrow("Nothing to call");
    const u = table({ 0: 500, 1: 12 });
    deal(u);
    raise(u, 0, 100);
    play(u, 1, "call");
    expect(u.seats[0]!.stack + (u.seats[1]?.stack ?? 0)).toBe(512 - (u.owed[0]?.stack ?? 0));
    expect(u.result!.pots[0]!.amount).toBe(24);
  });

  test("only the player to act can act", () => {
    const t = table({ 0: 200, 1: 200 });
    deal(t);
    expect(() => play(t, 1, "fold")).toThrow("not your turn");
    expect(legal(t, 1)).toBeNull();
  });
});

describe("the clock", () => {
  test("a player out of time checks if it's free and otherwise folds", () => {
    const t = table({ 0: 200, 1: 200 });
    deal(t);
    expect(t.deadline).toBe(TURN_MS);
    tick(t, TURN_MS - 1);
    expect(t.toAct).toBe(0);
    // The dealer owes the difference between the blinds to call: folds.
    tick(t, TURN_MS);
    expect(t.street).toBeNull();
    expect(t.seats[0]!.timeouts).toBe(1);
    expect(t.seats[0]!.last).toBe("fold (time)");
    expect(t.result!.won).toEqual({ 101: SMALL_BLIND + BIG_BLIND });
    // The next hand: seat 1 is the dealer and calls; the big blind has a free check, taken for them.
    tick(t, TURN_MS + NEXT_HAND_MS);
    expect(t.street).toBe("preflop");
    play(t, t.toAct, "call");
    expect(legal(t, t.toAct)!.canCheck).toBe(true);
    // It is their second timeout in a row: the check is made for them, and then they are stood up.
    tick(t, 10 * TURN_MS);
    expect(t.street).toBeNull();
    expect(t.owed).toHaveLength(1);
  });

  test("timing out twice in a row stands you up, once the hand is over", () => {
    const t = table({ 0: 200, 1: 200, 2: 200 });
    tick(t, FIRST_HAND_MS);
    expect(t.toAct).toBe(0);
    tick(t, t.deadline);
    expect(t.seats[0]!.timeouts).toBe(1);
    fold(t);
    tick(t, t.nextAt);
    // Seat 1 is the dealer and opens; seat 2 is the small blind, seat 0 the big blind.
    play(t, 1, "call");
    play(t, 2, "call");
    expect(t.toAct).toBe(0);
    tick(t, t.deadline);
    expect(t.seats[0]).toMatchObject({ timeouts: MAX_TIMEOUTS, leaving: true });
    fold(t);
    expect(t.seats[0]).toBeNull();
    expect(t.owed.map((o) => o.userId)).toEqual([100]);
  });

  test("a player who acts resets their timeouts", () => {
    const t = table({ 0: 200, 1: 200 });
    deal(t);
    tick(t, TURN_MS);
    expect(t.seats[0]!.timeouts).toBe(1);
    tick(t, t.nextAt);
    // Seat 1 is the dealer now; seat 0 the big blind and checks of their own accord.
    play(t, 1, "call");
    play(t, 0, "check");
    expect(t.seats[0]!.timeouts).toBe(0);
    expect(t.seats[0]).not.toBeNull();
  });
});

describe("standing up", () => {
  test("between hands a seat goes at once and its stack is owed", () => {
    const t = table({ 0: 200, 1: 150 });
    leave(t, 1, 0);
    expect(t.seats[1]).toBeNull();
    expect(t.owed).toEqual([{ userId: 101, stack: 150 }]);
    expect(t.dirty).toBe(true);
    const sent = [...t.owed];
    settled(t, sent, t.v);
    expect(t.owed).toEqual([]);
    expect(t.dirty).toBe(false);
  });

  test("mid-hand a leaver folds, their chips stay in the pot and they go when it ends", () => {
    const t = table({ 0: 200, 1: 200, 2: 200 });
    deal(t);
    const open = 3 * BIG_BLIND;
    raise(t, 0, open);
    play(t, 1, "call");
    leave(t, 1, 0);
    expect(t.seats[1]).toMatchObject({ folded: true, leaving: true, stack: 200 - open });
    expect(view(t, 0).seats[1]).toMatchObject({ leaving: true, folded: true });
    play(t, 2, "fold");
    // Seat 0 wins open + open + BB = 14 uncontested (their own 6 back too).
    expect(t.street).toBeNull();
    expect(t.seats[1]).toBeNull();
    expect(t.owed).toEqual([{ userId: 101, stack: 200 - open }]);
    expect(t.seats[0]!.stack).toBe(200 - open + 2 * open + BIG_BLIND);
  });

  test("the player to act leaving passes the turn on; the last two leaving ends the hand", () => {
    const t = table({ 0: 200, 1: 200, 2: 200 });
    deal(t);
    expect(t.toAct).toBe(0);
    leave(t, 0, 0);
    expect(t.toAct).toBe(1);
    leave(t, 1, 0);
    expect(t.street).toBeNull();
    expect(t.result!.won).toEqual({ 102: SMALL_BLIND + BIG_BLIND });
  });

  test("a seat that was never paid for just goes", () => {
    const t = newTable();
    sitDown(t, 2, 9);
    leave(t, 2, 0);
    expect(t.seats[2]).toBeNull();
    expect(t.owed).toEqual([]);
  });

  test("seats are taken once, and a player has one", () => {
    const t = table({ 0: 200 });
    expect(() => sitDown(t, 0, 5)).toThrow("taken");
    expect(() => sitDown(t, 1, 100)).toThrow("already");
    expect(() => sitDown(t, SEATS, 5)).toThrow("taken");
  });
});

describe("what each side may see", () => {
  test("the room's view has no hole cards until the showdown", () => {
    const t = table({ 0: 200, 1: 200 });
    deal(t);
    rig(t, { 0: "As Ah", 1: "Ks Kh" });
    const mid = JSON.stringify(view(t, 0));
    // Only the fact that they hold cards.
    expect(view(t, 0).seats.filter((s) => s?.cards)).toHaveLength(2);
    expect(mid).not.toContain('"hole"');
    expect(view(t, 0).result).toBeNull();
    expect(holeOf(t, 100)).toEqual(hand("As Ah"));
    expect(holeOf(t, 101)).toEqual(hand("Ks Kh"));
    expect(holeOf(t, 999)).toEqual([]);
    // A fold-out reveals nothing.
    play(t, 0, "fold");
    expect(JSON.stringify(view(t, 0))).not.toContain('"hole"');
    expect(view(t, 0).seats.some((s) => s?.cards)).toBe(false);
  });

  test("the wire form names everyone the table mentions", () => {
    const t = table({ 0: 200, 1: 200 });
    deal(t);
    play(t, 0, "fold");
    const state = wire(t, 0, (id) => `p${id}`);
    expect(state.names).toEqual({ 100: "p100", 101: "p101" });
    expect(state.result!.won).toEqual({ 101: SMALL_BLIND + BIG_BLIND });
  });

  test("the pot and the clock", () => {
    const t = table({ 0: 200, 1: 200 });
    deal(t);
    expect(potOf(t)).toBe(SMALL_BLIND + BIG_BLIND);
    expect(view(t, 1_000)).toMatchObject({
      pot: SMALL_BLIND + BIG_BLIND,
      toAct: 0,
      turnMs: TURN_MS - 1_000,
      nextMs: 0,
      street: "preflop",
      legal: {
        toCall: BIG_BLIND - SMALL_BLIND,
        canCheck: false,
        canRaise: true,
        minTo: 2 * BIG_BLIND,
        maxTo: 200,
      },
    });
  });
});

describe("chips are conserved", () => {
  test("many random hands, with players coming and going: every chip is accounted for", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const dice = seeded(seed * 7919);
      const pick = (n: number) => Math.floor(dice() * n);
      const t = newTable((n) => Math.floor(dice() * n));
      let bank = 0; // chips ever put on the table
      let paid = 0; // chips the town has been told to pay out
      let now = 0;
      let user = 1;
      const sit = () => {
        const free = t.seats.flatMap((s, i) => (s ? [] : [i]));
        if (free.length === 0) return;
        const stack = 20 + pick(300);
        sitDown(t, free[pick(free.length)]!, user++, stack);
        ready(t, seatOf(t, user - 1), now);
        bank += stack;
      };
      for (let i = 0; i < 2 + pick(5); i++) sit();
      for (let step = 0; step < 600; step++) {
        const before = total(t) + paid;
        expect(before).toBe(bank);
        const roll = dice();
        if (t.street === null) {
          now = Math.max(now + 1, t.nextAt);
          if (roll < 0.15) sit();
          else if (roll < 0.25) {
            const at = t.seats.findIndex((s) => s);
            if (at >= 0) leave(t, at, now);
          } else tick(t, now);
        } else if (roll < 0.04) {
          const at = t.seats.findIndex((s) => s);
          leave(t, at, now);
        } else if (roll < 0.1) {
          now += TURN_MS;
          tick(t, now);
        } else {
          const at = t.toAct;
          const l = legal(t, at)!;
          const r = dice();
          if (r < 0.15) act(t, at, { type: "fold" }, now);
          else if (r < 0.55) act(t, at, l.canCheck ? { type: "check" } : { type: "call" }, now);
          else if (l.canRaise) {
            const to = r < 0.9 ? l.minTo + pick(Math.max(1, l.maxTo - l.minTo + 1)) : l.maxTo;
            act(t, at, { type: "raise", to: Math.min(to, l.maxTo) }, now);
          } else act(t, at, l.canCheck ? { type: "check" } : { type: "call" }, now);
        }
        // The town settles what it is owed.
        const sent = [...t.owed];
        paid += sent.reduce((n, o) => n + o.stack, 0);
        settled(t, sent, t.v);
        expect(total(t) + paid).toBe(bank);
        // Nobody has chips below zero; bets never exceed what a hand allows.
        for (const s of t.seats) if (s) expect(s.stack).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("types", () => {
  test("seat fields used by the server exist", () => {
    const s: Seat = table({ 0: 100 }).seats[0]!;
    expect(s.userId).toBe(100);
  });
});

describe("the poker table in the net cafe", () => {
  const map = MAPS.basement;
  const table = pokerTable(map)!;
  const chairs = pokerChairs(map);

  test("the map has one table and a chair for every seat, each a seat of its own on the map", () => {
    expect(table).not.toBeNull();
    expect(table.w * table.h).toBe(map.find("♠").length);
    expect(chairs).toHaveLength(SEATS);
    expect(map.find(CHAIR_CHAR)).toHaveLength(SEATS);
    expect(new Set(chairs.map((ch) => `${ch.x},${ch.y}`)).size).toBe(SEATS);
    for (const ch of chairs) expect(map.kind(ch.x, ch.y)).toMatchObject({ seat: "chair", poker: true });
    // The table itself is furniture to walk round.
    expect(LEGEND["♠"]!.walk).toBeUndefined();
    expect(chairAt(chairs[2]!.x, chairs[2]!.y, map)).toBe(2);
    expect(chairAt(0, 0, map)).toBe(-1);
  });

  test("every chair touches the table and faces it", () => {
    for (const ch of chairs) {
      const [dx, dy] = DIRS[ch.facing];
      expect(map.at(ch.x + dx, ch.y + dy)).toBe("♠");
    }
  });

  test("a player can walk up to every chair from the stairs", () => {
    const [ex, ey] = map.find("x")[0]!;
    const from: [number, number] = [ex, ey - 1];
    for (const ch of chairs) {
      // Standing on a floor tile beside the chair, facing it.
      const stand = (Object.values(DIRS) as [number, number][]).find(
        ([dx, dy]) => map.walkable(ch.x + dx, ch.y + dy) && route(map, from, [ch.x + dx, ch.y + dy]) !== null,
      );
      expect(stand, `chair at ${ch.x},${ch.y}`).toBeDefined();
    }
  });

  test("the Tavern no longer has the table", () => {
    expect(MAPS.inn.find("♠")).toHaveLength(0);
    expect(MAPS.inn.find("♣")).toHaveLength(0);
    expect(pokerTable(MAPS.inn)).toBeNull();
  });

  test("the table is one 4x2 run, with 2 chairs above, 2 below and 1 each side", () => {
    expect(table).toMatchObject({ w: 4, h: 2 });
    const at = (f: string) => chairs.filter((ch) => ch.facing === f).length;
    expect([at("down"), at("up"), at("right"), at("left")]).toEqual([2, 2, 1, 1]);
  });

  test("the seats go clockwise from the top left", () => {
    expect(chairs[0]!.facing).toBe("down");
    expect(chairs.at(-1)!.facing).toBe("right");
    const tops = chairs.filter((ch) => ch.facing === "down");
    expect(tops.map((ch) => ch.x)).toEqual([...tops.map((ch) => ch.x)].sort((a, b) => a - b));
  });
});
