/**
 * The Tavern's poker table: Texas Hold'em for 2 to 6 seats, played with the in-game coins. This file is the
 * rules and nothing else (cards, hands, betting, side pots, the clock); the world actor keeps one `Table` in
 * memory and the town moves the coins (`server/src/town/poker.ts`). Every chip is in a stack, a bet or the pot,
 * so a hand never makes or loses one.
 */

// MARK: Rules

/** A seat's buy-in, in coins. The table has no other stake: sitting down always costs this. */
export const BUY_IN = 50;
export const SMALL_BLIND = 1;
export const BIG_BLIND = 2;
/** How the table's sessions are kept among the games played (`match_players.game`): one a seat, sit down to stand up. */
export const POKER_GAME = "poker";
export const SEATS = 6;
/** How long a player has to act. */
export const TURN_MS = 25_000;
/** After a showdown, and after the second player sits down at an empty table. */
export const NEXT_HAND_MS = 5_000;
export const FIRST_HAND_MS = 3_000;
/** Timeouts in a row that stand a player up. */
export const MAX_TIMEOUTS = 2;
/** The most a player can lose here in a UTC day, buy-ins counted. */
export const DAILY_LOSS_CAP = 150;

// MARK: Cards

/** 0 to 51: `rank + 13 * suit`. Rank 0 is a deuce, 12 an ace; suits are clubs, diamonds, hearts, spades. */
export type Card = number;

export const rankOf = (c: Card): number => c % 13;
export const suitOf = (c: Card): number => Math.floor(c / 13);
const RANKS = "23456789TJQKA";
const SUITS = "♣♦♥♠";
/** `A♠`, `T♥`: for logs and tests. */
export const cardName = (c: Card): string => `${RANKS[rankOf(c)]}${SUITS[suitOf(c)]}`;
/** A card to draw: "10", "♠", and whether the suit is red. */
export const cardFace = (c: Card): { rank: string; suit: string; red: boolean } => ({
  rank: rankOf(c) === 8 ? "10" : RANKS[rankOf(c)]!,
  suit: SUITS[suitOf(c)]!,
  red: suitOf(c) === 1 || suitOf(c) === 2,
});
export const isCard = (v: unknown): v is Card =>
  Number.isInteger(v) && (v as number) >= 0 && (v as number) < 52;

export const freshDeck = (): Card[] => Array.from({ length: 52 }, (_, i) => i);

/** A random integer in `[0, n)` from the platform's secure generator, without modulo bias. */
export function randomInt(n: number): number {
  const range = 0x1_0000_0000;
  const limit = range - (range % n);
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0]! < limit) return buf[0]! % n;
  }
}

/** Fisher-Yates, in place. `rnd(n)` is an integer in `[0, n)`. */
export function shuffle<T>(cards: T[], rnd: (n: number) => number = randomInt): T[] {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [cards[i], cards[j]] = [cards[j]!, cards[i]!];
  }
  return cards;
}

// MARK: Hands

const BASE = 13 ** 5;

/** The high rank of the best straight in a set of ranks (a bitmask), the wheel (A to 5) being a five-high one; -1 for none. */
function straightHigh(mask: number): number {
  // An ace also counts below the deuce.
  const m = (mask << 1) | (mask >> 12);
  for (let high = 12; high >= 3; high--) {
    const run = 0b11111 << (high - 3);
    if ((m & run) === run) return high;
  }
  return -1;
}

/** The ranks in `counts` that appear exactly `n` times (or at least, with `atLeast`), highest first. */
const ranksWith = (counts: number[], n: number, atLeast = false): number[] =>
  counts.flatMap((k, r) => ((atLeast ? k >= n : k === n) ? [r] : [])).reverse();

/**
 * How good the best five of these 5 to 7 cards are, as one number: bigger wins, equal ties. The category
 * (high card up to a straight flush) is the top digit and the ranks that decide it follow, most important
 * first, as base 13 digits, so kickers count.
 */
export function evaluate(cards: readonly Card[]): number {
  const counts = new Array<number>(13).fill(0);
  const bySuit: number[][] = [[], [], [], []];
  let mask = 0;
  for (const c of cards) {
    counts[rankOf(c)]!++;
    bySuit[suitOf(c)]!.push(rankOf(c));
    mask |= 1 << rankOf(c);
  }
  const score = (category: number, ranks: number[]): number =>
    category * BASE + ranks.slice(0, 5).reduce((n, r, i) => n + r * 13 ** (4 - i), 0);
  const flush = bySuit.find((s) => s.length >= 5)?.sort((a, b) => b - a);
  if (flush) {
    const high = straightHigh(flush.reduce((m, r) => m | (1 << r), 0));
    if (high >= 0) return score(8, [high]);
  }
  const quads = ranksWith(counts, 4);
  const trips = ranksWith(counts, 3);
  const pairs = ranksWith(counts, 2);
  const singles = ranksWith(counts, 1, true).filter((r) => !quads.includes(r));
  if (quads.length > 0) {
    const kicker = Math.max(...ranksWith(counts, 1, true).filter((r) => r !== quads[0]));
    return score(7, [quads[0]!, kicker]);
  }
  if (trips.length > 0 && trips.length + pairs.length >= 2) {
    const over = trips[0]!;
    return score(6, [over, Math.max(...[...trips.slice(1), ...pairs])]);
  }
  if (flush) return score(5, flush);
  const high = straightHigh(mask);
  if (high >= 0) return score(4, [high]);
  if (trips.length > 0) return score(3, [trips[0]!, ...singles.filter((r) => r !== trips[0]).slice(0, 2)]);
  if (pairs.length >= 2) {
    const [a, b] = pairs as [number, number];
    return score(2, [a, b, ...singles.filter((r) => r !== a && r !== b).slice(0, 1)]);
  }
  if (pairs.length === 1) return score(1, [pairs[0]!, ...singles.filter((r) => r !== pairs[0]).slice(0, 3)]);
  return score(0, singles);
}

export const categoryOf = (score: number): number => Math.floor(score / BASE);

const RANK_NAMES = [
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Jack",
  "Queen",
  "King",
  "Ace",
];
const plural = (r: number): string => (r === 4 ? "Sixes" : `${RANK_NAMES[r]}s`);

/** A score in words: "Two pair, Kings and Fives". */
export function describe(score: number): string {
  const cat = categoryOf(score);
  const digit = (i: number): number => Math.floor(score / 13 ** (4 - i)) % 13;
  switch (cat) {
    case 0:
      return `High card, ${RANK_NAMES[digit(0)]}`;
    case 1:
      return `Pair of ${plural(digit(0))}`;
    case 2:
      return `Two pair, ${plural(digit(0))} and ${plural(digit(1))}`;
    case 3:
      return `Three ${plural(digit(0))}`;
    case 4:
      return `Straight, ${RANK_NAMES[digit(0)]} high`;
    case 5:
      return `Flush, ${RANK_NAMES[digit(0)]} high`;
    case 6:
      return `Full house, ${plural(digit(0))} over ${plural(digit(1))}`;
    case 7:
      return `Four ${plural(digit(0))}`;
    default:
      return digit(0) === 12 ? "Royal flush" : `Straight flush, ${RANK_NAMES[digit(0)]} high`;
  }
}

// MARK: The table

export type Street = "preflop" | "flop" | "turn" | "river";

export interface Seat {
  userId: number;
  stack: number;
  /** The buy-in has been taken from the wallet: not before, so a seat is held but not dealt in. */
  ready: boolean;
  /** The two cards, private to this player. Empty between hands. */
  hole: Card[];
  inHand: boolean;
  folded: boolean;
  /** Put in on this street, and in the whole hand. */
  bet: number;
  put: number;
  /** Has acted since the last full raise: may call or fold facing a short all-in, not raise. */
  acted: boolean;
  /** Timeouts in a row. */
  timeouts: number;
  /** Folded and standing: gone when the hand ends, stack back to the wallet. */
  leaving: boolean;
  /** Their last action, shown beside the seat: "fold", "check", "call 10", "raise 40", "all-in 120". */
  last: string | null;
}

/** Coins that left a seat for the wallet: the town pays them. */
export interface Owed {
  userId: number;
  stack: number;
}

/** What one pot paid, for the table to show. */
export interface PotResult {
  amount: number;
  /** Who could win it, and who did (a split pot has several). */
  eligible: number[];
  winners: number[];
}

/** How a hand ended. Hole cards are here only for those who went to showdown. */
export interface Result {
  hand: number;
  board: Card[];
  pots: PotResult[];
  /** Everyone who went to showdown; empty when all but one folded. */
  shown: { userId: number; hole: Card[]; name: string }[];
  /** What each winner took home, by user. */
  won: Record<number, number>;
}

export interface Table {
  seats: (Seat | null)[];
  /** The dealer's seat; -1 before the first hand. */
  button: number;
  /** Hands dealt so far. */
  hand: number;
  street: Street | null;
  board: Card[];
  deck: Card[];
  /** Whose turn it is (a seat), -1 for none. */
  toAct: number;
  /** The most anyone has put in on this street, and the size of the last full raise (the least a raise adds). */
  bet: number;
  raise: number;
  /** When the player to act is out of time, and when the next hand deals; 0 for neither. */
  deadline: number;
  nextAt: number;
  result: Result | null;
  /** Seats that left and their coins, until the town has paid them. */
  owed: Owed[];
  /** Stacks changed in a way the town has to be told (a hand ended, someone left). */
  dirty: boolean;
  /** Changes on every change to what the room sees. */
  v: number;
  rnd: (n: number) => number;
}

export function newTable(rnd: (n: number) => number = randomInt): Table {
  return {
    seats: new Array<Seat | null>(SEATS).fill(null),
    button: -1,
    hand: 0,
    street: null,
    board: [],
    deck: [],
    toAct: -1,
    bet: 0,
    raise: BIG_BLIND,
    deadline: 0,
    nextAt: 0,
    result: null,
    owed: [],
    dirty: false,
    v: 0,
    rnd,
  };
}

export class PokerError extends Error {}

const bump = (t: Table): void => {
  t.v++;
};

/** Where `userId` sits, or -1. */
export const seatOf = (t: Table, userId: number): number => t.seats.findIndex((s) => s?.userId === userId);

/** Seats that can be dealt in to the next hand. */
const eligible = (t: Table): number[] =>
  t.seats.flatMap((s, i) => (s && s.ready && !s.leaving && s.stack > 0 ? [i] : []));

/** In the hand, not folded. */
const liveSeats = (t: Table): number[] => t.seats.flatMap((s, i) => (s?.inHand && !s.folded ? [i] : []));

/** In the hand, not folded, with chips left to bet. */
const canAct = (s: Seat | null | undefined): s is Seat => !!s && s.inHand && !s.folded && s.stack > 0;

/** The next seat after `from`, going round, that `pred` accepts; -1 for none. */
function after(t: Table, from: number, pred: (s: Seat, i: number) => boolean): number {
  for (let k = 1; k <= SEATS; k++) {
    const i = (from + k) % SEATS;
    const s = t.seats[i];
    if (s && pred(s, i)) return i;
  }
  return -1;
}

/** The pot: everything put in this hand. */
export const potOf = (t: Table): number => t.seats.reduce((n, s) => n + (s?.put ?? 0), 0);

/** Takes a seat for `userId`, held (not `ready`) until `ready` is set once the town has taken the buy-in. */
export function sitDown(t: Table, at: number, userId: number, stack = BUY_IN): void {
  if (at < 0 || at >= SEATS || t.seats[at]) throw new PokerError("That seat is taken.");
  if (seatOf(t, userId) >= 0) throw new PokerError("You're at the table already.");
  t.seats[at] = {
    userId,
    stack,
    ready: false,
    hole: [],
    inHand: false,
    folded: false,
    bet: 0,
    put: 0,
    acted: false,
    timeouts: 0,
    leaving: false,
    last: null,
  };
  bump(t);
}

/** The buy-in is paid: deal this seat in from the next hand. */
export function ready(t: Table, at: number, now: number): void {
  const s = t.seats[at];
  if (!s) return;
  s.ready = true;
  plan(t, now);
  bump(t);
}

/** The buy-in couldn't be taken: the seat is free again. */
export function release(t: Table, at: number): void {
  t.seats[at] = null;
  bump(t);
}

/** Schedules the next hand if one can be dealt and none is waiting. */
function plan(t: Table, now: number): void {
  if (t.street === null && t.nextAt === 0 && eligible(t).length >= 2) t.nextAt = now + FIRST_HAND_MS;
}

// MARK: Dealing

function post(s: Seat, amount: number): void {
  const n = Math.min(s.stack, amount);
  s.stack -= n;
  s.bet += n;
  s.put += n;
}

/** Deals a hand if two or more can play. False if not. */
export function startHand(t: Table, now: number): boolean {
  const players = eligible(t);
  t.nextAt = 0;
  if (players.length < 2) return false;
  for (const s of t.seats) {
    if (!s) continue;
    Object.assign(s, { hole: [], inHand: false, folded: false, bet: 0, put: 0, acted: false, last: null });
  }
  t.result = null;
  t.hand++;
  t.board = [];
  t.deck = shuffle(freshDeck(), t.rnd);
  t.button = after(t, t.button, (_, i) => players.includes(i));
  // Each in turn from the dealer's left: one card round, then the second.
  const order = players
    .map((i) => ({ i, k: (i - t.button + SEATS) % SEATS }))
    .sort((a, b) => (a.k || SEATS) - (b.k || SEATS))
    .map((o) => o.i);
  for (const i of order) t.seats[i]!.inHand = true;
  for (let round = 0; round < 2; round++) for (const i of order) t.seats[i]!.hole.push(t.deck.pop()!);
  // Heads-up the dealer posts the small blind and acts first before the flop; otherwise the blinds follow
  // the dealer and the seat after the big blind opens.
  const headsUp = players.length === 2;
  const sb = headsUp ? t.button : order[0]!;
  const bb = after(t, sb, (_, i) => players.includes(i));
  post(t.seats[sb]!, SMALL_BLIND);
  post(t.seats[bb]!, BIG_BLIND);
  t.street = "preflop";
  t.bet = Math.max(t.seats[sb]!.bet, t.seats[bb]!.bet);
  t.raise = BIG_BLIND;
  bump(t);
  next(t, bb, now);
  return true;
}

// MARK: Betting

/** What `i` may do now: the call, the raise range (to a total bet on this street), whether they can check. */
export interface Legal {
  toCall: number;
  canCheck: boolean;
  canRaise: boolean;
  /** The least and most a raise can go to (the total bet on this street); the most is all-in. */
  minTo: number;
  maxTo: number;
}

export function legal(t: Table, i: number): Legal | null {
  const s = t.seats[i];
  if (t.street === null || t.toAct !== i || !canAct(s)) return null;
  const toCall = Math.min(s.stack, t.bet - s.bet);
  const maxTo = s.bet + s.stack;
  return {
    toCall,
    canCheck: s.bet === t.bet,
    canRaise: !s.acted && maxTo > t.bet,
    minTo: Math.min(t.bet + t.raise, maxTo),
    maxTo,
  };
}

export type Action = { type: "fold" } | { type: "check" } | { type: "call" } | { type: "raise"; to: number };

/** Plays `a` for seat `i`: throws `PokerError` with a reason if it's not allowed. */
export function act(t: Table, i: number, a: Action, now: number): void {
  const s = t.seats[i];
  const ok = legal(t, i);
  if (!s || !ok) throw new PokerError("It's not your turn.");
  s.timeouts = 0;
  apply(t, i, a, ok);
  bump(t);
  next(t, i, now);
}

function apply(t: Table, i: number, a: Action, ok: Legal): void {
  const s = t.seats[i]!;
  switch (a.type) {
    case "fold":
      s.folded = true;
      s.last = "fold";
      return;
    case "check":
      if (!ok.canCheck) throw new PokerError("You can't check: there's a bet to call.");
      s.acted = true;
      s.last = "check";
      return;
    case "call": {
      if (ok.canCheck) throw new PokerError("Nothing to call: check.");
      post(s, ok.toCall);
      s.acted = true;
      s.last = s.stack === 0 ? `all-in ${s.bet}` : `call ${s.bet}`;
      return;
    }
    case "raise": {
      const to = a.to;
      if (!Number.isInteger(to)) throw new PokerError("Pick a whole number of coins.");
      if (!ok.canRaise) throw new PokerError("You can't raise now.");
      if (to > ok.maxTo) throw new PokerError(`You only have ${ok.maxTo}.`);
      if (to <= t.bet) throw new PokerError(`Raise to more than ${t.bet}.`);
      if (to < ok.minTo) throw new PokerError(`The least you can raise to is ${ok.minTo}.`);
      const label = t.bet === 0 ? "bet" : "raise";
      const added = to - t.bet;
      post(s, to - s.bet);
      // A full raise opens the betting again for everyone else; a short all-in doesn't.
      if (added >= t.raise) {
        t.raise = added;
        for (const o of t.seats) if (o && o !== s && canAct(o)) o.acted = false;
      }
      t.bet = to;
      s.acted = true;
      s.last = s.stack === 0 ? `all-in ${to}` : `${label} ${to}`;
      return;
    }
  }
}

/** Whether `s` still has to act on this street. */
const owes = (t: Table, s: Seat): boolean => canAct(s) && (!s.acted || s.bet < t.bet);

/** After seat `from` acted (or folded, or left): the next turn, the next street, or the end of the hand. */
function next(t: Table, from: number, now: number): void {
  if (liveSeats(t).length === 1) return void award(t, now, false);
  const acting = t.seats.flatMap((s, i) => (canAct(s) ? [i] : []));
  // Nobody left to bet against: a lone player with chips who has matched the bet has no one to act on.
  const alone = acting.length === 1 && t.seats[acting[0]!]!.bet >= t.bet;
  if (alone || !acting.some((i) => owes(t, t.seats[i]!))) return void closeStreet(t, now);
  t.toAct = after(t, from, (s) => owes(t, s));
  t.deadline = now + TURN_MS;
}

/** The street's betting is over: bets go to the pot and the next cards are dealt, or the hand is shown down. */
function closeStreet(t: Table, now: number): void {
  for (const s of t.seats) if (s) Object.assign(s, { bet: 0, acted: false });
  t.bet = 0;
  t.raise = BIG_BLIND;
  const street = t.street!;
  if (street === "river") return void award(t, now, true);
  t.deck.pop(); // the burn card
  const cards = street === "preflop" ? 3 : 1;
  for (let k = 0; k < cards; k++) t.board.push(t.deck.pop()!);
  t.street = street === "preflop" ? "flop" : street === "flop" ? "turn" : "river";
  for (const s of t.seats) if (s) s.last = s.folded ? s.last : null;
  const acting = t.seats.flatMap((s, i) => (canAct(s) ? [i] : []));
  // Everyone but one is all-in: no more bets to make, the board runs out.
  if (acting.length < 2) return void closeStreet(t, now);
  t.toAct = after(t, t.button, (s) => canAct(s));
  t.deadline = now + TURN_MS;
}

// MARK: Pots

/**
 * The hand's pots: the main pot, and a side pot for each time someone was all-in for less than the rest.
 * Chips only the players still in can win; a folded player's chips stay in the pot they were paid into.
 */
export function pots(
  puts: { userId: number; put: number; live: boolean }[],
): { amount: number; eligible: number[] }[] {
  const levels = [...new Set(puts.filter((p) => p.live && p.put > 0).map((p) => p.put))].sort(
    (a, b) => a - b,
  );
  const out: { amount: number; eligible: number[] }[] = [];
  let from = 0;
  for (const level of levels) {
    const amount = puts.reduce((n, p) => n + Math.max(0, Math.min(p.put, level) - from), 0);
    const who = puts.filter((p) => p.live && p.put >= level).map((p) => p.userId);
    if (amount > 0) out.push({ amount, eligible: who });
    from = level;
  }
  // Chips above the highest live commitment (a folded player's bigger bet) join the last pot.
  const rest = puts.reduce((n, p) => n + Math.max(0, p.put - from), 0);
  if (rest > 0 && out.length > 0) out.at(-1)!.amount += rest;
  // Nobody live put anything in (the others all stood up): the chips go to whoever is left.
  else if (rest > 0) out.push({ amount: rest, eligible: puts.filter((p) => p.live).map((p) => p.userId) });
  return out;
}

/**
 * Pays the pots and ends the hand. `show`: it goes to showdown (more than one player left), else the last
 * one standing takes everything and nobody's cards are shown.
 */
function award(t: Table, now: number, show: boolean): void {
  const seats = t.seats.flatMap((s, i) => (s?.inHand ? [i] : []));
  const live = liveSeats(t);
  const scores = new Map<number, number>();
  if (show) for (const i of live) scores.set(i, evaluate([...t.seats[i]!.hole, ...t.board]));
  const list = pots(
    seats.map((i) => ({ userId: t.seats[i]!.userId, put: t.seats[i]!.put, live: live.includes(i) })),
  );
  const byUser = new Map(seats.map((i) => [t.seats[i]!.userId, i]));
  // Odd chips go to the first winner left of the dealer.
  const left = (id: number): number => (byUser.get(id)! - t.button + SEATS) % SEATS || SEATS;
  const won: Record<number, number> = {};
  const results: PotResult[] = [];
  for (const pot of list) {
    const best = show ? Math.max(...pot.eligible.map((id) => scores.get(byUser.get(id)!)!)) : 0;
    const winners = (
      show ? pot.eligible.filter((id) => scores.get(byUser.get(id)!) === best) : pot.eligible
    ).sort((a, b) => left(a) - left(b));
    const share = Math.floor(pot.amount / winners.length);
    let extra = pot.amount - share * winners.length;
    for (const id of winners) {
      const n = share + (extra-- > 0 ? 1 : 0);
      t.seats[byUser.get(id)!]!.stack += n;
      won[id] = (won[id] ?? 0) + n;
    }
    results.push({ amount: pot.amount, eligible: pot.eligible, winners });
  }
  t.result = {
    hand: t.hand,
    board: [...t.board],
    pots: results,
    shown: show
      ? live.map((i) => ({
          userId: t.seats[i]!.userId,
          hole: [...t.seats[i]!.hole],
          name: describe(scores.get(i)!),
        }))
      : [],
    won,
  };
  finish(t, now);
}

/** The hand is over: busted players and those who stood up go, the next hand is planned. */
function finish(t: Table, now: number): void {
  t.street = null;
  t.toAct = -1;
  t.deadline = 0;
  t.bet = 0;
  for (const [i, s] of t.seats.entries()) {
    if (!s) continue;
    Object.assign(s, { hole: [], inHand: false, bet: 0, put: 0, acted: false });
    if (s.stack === 0) s.leaving = true;
    if (s.leaving) {
      t.owed.push({ userId: s.userId, stack: s.stack });
      t.seats[i] = null;
    }
  }
  t.dirty = true;
  t.nextAt = eligible(t).length >= 2 ? now + NEXT_HAND_MS : 0;
  bump(t);
}

// MARK: Leaving and time

/**
 * Stands seat `i` up. Between hands it goes at once and its stack is owed to the wallet; in a hand it folds
 * (its chips stay in the pot) and goes when the hand ends.
 */
export function leave(t: Table, i: number, now: number): void {
  const s = t.seats[i];
  if (!s) return;
  if (!s.ready) return void release(t, i);
  if (t.street !== null && s.inHand) {
    s.leaving = true;
    if (!s.folded) {
      s.folded = true;
      s.last = "fold";
      bump(t);
      if (t.toAct === i || liveSeats(t).length === 1) next(t, i, now);
    }
    bump(t);
    return;
  }
  t.owed.push({ userId: s.userId, stack: s.stack });
  t.seats[i] = null;
  t.dirty = true;
  if (eligible(t).length < 2 && t.street === null) t.nextAt = 0;
  bump(t);
}

/** Time passes: the player on the clock who has run out of it checks or folds, and the next hand is dealt when due. */
export function tick(t: Table, now: number): void {
  if (t.street !== null && t.toAct >= 0 && now >= t.deadline) {
    const i = t.toAct;
    const s = t.seats[i]!;
    const ok = legal(t, i)!;
    const timeouts = s.timeouts + 1;
    apply(t, i, ok.canCheck ? { type: "check" } : { type: "fold" }, ok);
    s.timeouts = timeouts;
    s.last = `${s.last} (time)`;
    bump(t);
    next(t, i, now);
    if (timeouts >= MAX_TIMEOUTS && t.seats[i] === s) leave(t, i, now);
  } else if (t.street === null && t.nextAt > 0 && now >= t.nextAt) {
    startHand(t, now);
  }
}

/** The town paid these (and wrote down the stacks as of `v`): forget them. */
export function settled(t: Table, owed: readonly Owed[], v: number): void {
  t.owed = t.owed.filter((o) => !owed.includes(o));
  if (t.v === v) t.dirty = false;
}

// MARK: What each side sees

export interface SeatView {
  userId: number;
  stack: number;
  bet: number;
  folded: boolean;
  allIn: boolean;
  inHand: boolean;
  /** Holds cards (two), whose are no one's business but theirs. */
  cards: boolean;
  last: string | null;
  leaving: boolean;
  ready: boolean;
}

/** The table as the whole room sees it: never anyone's hole cards before the showdown (`result.shown`). */
export interface TableView {
  v: number;
  seats: (SeatView | null)[];
  button: number;
  street: Street | null;
  board: Card[];
  pot: number;
  /** The bet to match on this street, and the least a raise adds. */
  bet: number;
  raise: number;
  toAct: number;
  /** What the player to act may do (the calls and raises are public: the bets are on the table). */
  legal: Legal | null;
  /** Ms left on the clock of the player to act, and until the next hand: counted down on the client. */
  turnMs: number;
  nextMs: number;
  result: Result | null;
}

export function view(t: Table, now: number): TableView {
  return {
    v: t.v,
    seats: t.seats.map((s) =>
      s
        ? {
            userId: s.userId,
            stack: s.stack,
            bet: s.bet,
            folded: s.folded,
            allIn: s.inHand && !s.folded && s.stack === 0,
            inHand: s.inHand,
            cards: s.hole.length > 0,
            last: s.last,
            leaving: s.leaving,
            ready: s.ready,
          }
        : null,
    ),
    button: t.button,
    street: t.street,
    board: [...t.board],
    pot: potOf(t),
    bet: t.bet,
    raise: t.raise,
    toAct: t.toAct,
    legal: t.toAct >= 0 ? legal(t, t.toAct) : null,
    turnMs: t.toAct >= 0 ? Math.max(0, t.deadline - now) : 0,
    nextMs: t.street === null && t.nextAt > 0 ? Math.max(0, t.nextAt - now) : 0,
    result: t.result,
  };
}

/** `userId`'s own two cards: only ever sent to them. */
export const holeOf = (t: Table, userId: number): Card[] => t.seats[seatOf(t, userId)]?.hole ?? [];

/** What the room is sent: the table, and the names of everyone it mentions (seated, or in the last result). */
export interface PokerState extends TableView {
  names: Record<number, string>;
}

export function wire(t: Table, now: number, nameOf: (userId: number) => string): PokerState {
  const state = view(t, now);
  const ids = new Set<number>([
    ...state.seats.flatMap((s) => (s ? [s.userId] : [])),
    ...(state.result
      ? [...Object.keys(state.result.won).map(Number), ...state.result.shown.map((s) => s.userId)]
      : []),
  ]);
  return { ...state, names: Object.fromEntries([...ids].map((id) => [id, nameOf(id)])) };
}
