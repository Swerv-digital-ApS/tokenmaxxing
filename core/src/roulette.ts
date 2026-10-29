/**
 * Roulette against the house: European wheel (one zero), no other players. Pure rules over plain
 * values, so the server settles a spin and the client draws it from the same code.
 */

/** The pockets in wheel order, as they sit round the wheel. */
export const WHEEL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22,
  18, 29, 7, 28, 12, 35, 3, 26,
] as const;

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export type Color = "red" | "black" | "green";
export const colorOf = (n: number): Color => (n === 0 ? "green" : RED.has(n) ? "red" : "black");

/**
 * What a chip sits on: `n:17` (one number), `red`/`black`, `even`/`odd`, `low` (1-18)/`high` (19-36),
 * `d1`/`d2`/`d3` (dozens), `c1`/`c2`/`c3` (columns, c1 holding 1, 4, 7...).
 */
export type BetOn =
  `n:${number}` | "red" | "black" | "even" | "odd" | "low" | "high" | "d1" | "d2" | "d3" | "c1" | "c2" | "c3";

export interface Bet {
  on: BetOn;
  /** Whole coins. */
  stake: number;
}

export const MIN_STAKE = 1;
export const MAX_BETS = 12;
/** The most one spin may put down, all bets together. */
export const MAX_SPIN = 1000;

/** Pays `x` to 1 on top of the stake. */
export const PAYS: Record<string, number> = {
  n: 35,
  red: 1,
  black: 1,
  even: 1,
  odd: 1,
  low: 1,
  high: 1,
  d1: 2,
  d2: 2,
  d3: 2,
  c1: 2,
  c2: 2,
  c3: 2,
};

const kindOf = (on: string): string => (on.startsWith("n:") ? "n" : on);

/** Whether `on` is a bet that exists. */
export function isBetOn(on: unknown): on is BetOn {
  if (typeof on !== "string") return false;
  if (on.startsWith("n:")) {
    const n = Number(on.slice(2));
    return /^n:(0|[1-9]\d?)$/.test(on) && n >= 0 && n <= 36;
  }
  return on in PAYS;
}

/** Whether `pocket` wins a chip on `on`. Zero beats every outside bet. */
export function wins(on: BetOn, pocket: number): boolean {
  if (on.startsWith("n:")) return Number(on.slice(2)) === pocket;
  if (pocket === 0) return false;
  switch (on) {
    case "red":
    case "black":
      return colorOf(pocket) === on;
    case "even":
      return pocket % 2 === 0;
    case "odd":
      return pocket % 2 === 1;
    case "low":
      return pocket <= 18;
    case "high":
      return pocket >= 19;
    case "d1":
    case "d2":
    case "d3":
      return Math.ceil(pocket / 12) === Number(on[1]);
    case "c1":
    case "c2":
    case "c3":
      return ((pocket - 1) % 3) + 1 === Number(on[1]);
    default:
      return false;
  }
}

/** The bets as the server will take them, or why not. Same stake on the same spot is merged. */
export function checkBets(raw: unknown): { bets: Bet[] } | { refused: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { refused: "Place a bet first." };
  if (raw.length > MAX_BETS) return { refused: `At most ${MAX_BETS} bets a spin.` };
  const merged = new Map<BetOn, number>();
  for (const b of raw) {
    const on = (b as { on?: unknown } | null)?.on;
    const stake = (b as { stake?: unknown } | null)?.stake;
    if (!isBetOn(on)) return { refused: "That bet isn't on the table." };
    if (typeof stake !== "number" || !Number.isInteger(stake) || stake < MIN_STAKE)
      return { refused: `A chip is at least ${MIN_STAKE} coin.` };
    merged.set(on, (merged.get(on) ?? 0) + stake);
  }
  const bets = [...merged].map(([on, stake]) => ({ on, stake }));
  const total = bets.reduce((a, b) => a + b.stake, 0);
  if (total > MAX_SPIN) return { refused: `The table takes at most ${MAX_SPIN} coins a spin.` };
  return { bets };
}

export interface Settled {
  pocket: number;
  color: Color;
  /** Per bet, in the order given: whether it won and what came back (stake included; 0 if lost). */
  results: { on: BetOn; stake: number; won: boolean; payout: number }[];
  staked: number;
  /** All that comes back to the player. */
  payout: number;
}

/** Settles `bets` on a landed `pocket`. */
export function settle(bets: readonly Bet[], pocket: number): Settled {
  const results = bets.map(({ on, stake }) => {
    const won = wins(on, pocket);
    return { on, stake, won, payout: won ? stake * (PAYS[kindOf(on)]! + 1) : 0 };
  });
  return {
    pocket,
    color: colorOf(pocket),
    results,
    staked: results.reduce((a, r) => a + r.stake, 0),
    payout: results.reduce((a, r) => a + r.payout, 0),
  };
}

/** A pocket from a uniform `rand` in [0, 1). */
export const spinPocket = (rand: () => number): number => Math.min(36, Math.floor(rand() * 37));

// MARK: The table in the net cafe (what everyone in the room sees)

/** Who stands where at the table: `spot` is the index of the `♥` tile, left to right. */
export interface RouletteSeat {
  spot: number;
  userId: number;
  name: string;
}

/** One player's outcome of a round. */
export interface RouletteOutcome {
  userId: number;
  name: string;
  staked: number;
  /** All that came back (stake included; 0 if everything lost). */
  payout: number;
}

/** One landed spin, public: the shared pocket and what everyone staked and won. */
export interface RouletteSpin {
  /** Counts up per spin, so a client plays each one once. */
  id: number;
  /** The round it settled. */
  round: number;
  pocket: number;
  color: Color;
  /** Everyone who had bets down that round. */
  results: RouletteOutcome[];
  /** When the server rolled it, ms. The wheel takes `SPIN_MS` to land; everyone plays the same animation. */
  at: number;
}

export type RoulettePhase = "idle" | "betting" | "spinning" | "result";

/** A seated player's bets this round: public, everyone sees them. */
export interface RoulettePlayer {
  userId: number;
  bets: Bet[];
  ready: boolean;
}

/** What the world sends everyone in the net cafe (the `roulette` event). */
export interface RouletteState {
  seats: RouletteSeat[];
  /** The last landed spin; during `spinning` it is the one landing now (hide its pocket until the wheel stops). */
  last: RouletteSpin | null;
  /** The last 12 pockets, newest first (the spinning one is added when the result starts). */
  history: number[];
  phase: RoulettePhase;
  round: number;
  /** When the phase ends, server ms (compare with `now`, not the local clock). */
  phaseEndsAt: number;
  /** Server ms when this was sent. */
  now: number;
  players: RoulettePlayer[];
}

/** How long bets are open, and how long the result stays up before the next round. */
export const BETTING_MS = 20_000;
export const RESULT_MS = 6000;

/** What the table is doing, for `nextPhase`. */
export interface RoundView {
  phase: RoulettePhase;
  now: number;
  endsAt: number;
  seated: number;
  /** Seated players with at least one bet down. */
  betting: number;
  /** Every seated player pressed Ready. */
  allReady: boolean;
}

/**
 * The phase the table moves to now, or null to stay. Moving "betting" -> "betting" is a skipped round
 * (nobody bet); "betting" -> "spinning" is the roll.
 */
export function nextPhase(v: RoundView): RoulettePhase | null {
  switch (v.phase) {
    case "idle":
      return v.seated > 0 ? "betting" : null;
    case "betting":
      if (v.seated === 0) return "idle";
      if (v.now >= v.endsAt || (v.allReady && v.betting > 0)) return v.betting > 0 ? "spinning" : "betting";
      return null;
    case "spinning":
      return v.now >= v.endsAt ? "result" : null;
    case "result":
      return v.now >= v.endsAt ? (v.seated > 0 ? "betting" : "idle") : null;
  }
}

/** How long the wheel and ball take to land after a spin, for the player and every watcher. */
export const SPIN_MS = 4000;
/** The spots at the table: eight players share it (the `♥` tiles above and below it, `maps.ts`). */
export const SPOTS = 8;
