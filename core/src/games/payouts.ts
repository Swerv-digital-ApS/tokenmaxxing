/** How pots and side bets are paid out. Pure integer math: every coin in comes back out. */
import { sortBy, sumBy, typedSwitch } from "hanzio";

export type Split = "all" | "top3" | "half";

export const SPLITS: Record<Split, string> = {
  all: "Winner takes all",
  top3: "Top 3 (60/30/10)",
  half: "Top half",
};

/** The limits on betting, checked on the server. */
export const MAX_STAKE = 500;
export const MAX_SIDE_BET = 200;

/** The split that applies: top 3 needs at least 4 players, and 2-player games are winner takes all. */
export const effectiveSplit = (split: Split, players: number): Split =>
  players <= 2 || (split === "top3" && players < 4) ? "all" : split;

/** Each finishing position's share of the pot, best first. */
function weights(split: Split, players: number): number[] {
  const w = new Array<number>(players).fill(0);
  typedSwitch(split, {
    all: () => {
      w[0] = 1;
    },
    top3: () => {
      [w[0], w[1], w[2]] = [60, 30, 10];
    },
    half: () => {
      for (let i = 0; i < Math.floor(players / 2); i++) w[i] = 1;
    },
  });
  return w;
}

/**
 * Divides `amount` by weight with integer coins; the leftover coins go one by one
 * down `order` (best placed first, then lowest user id).
 */
function divide(amount: number, parts: { id: number; weight: number }[]): Map<number, number> {
  const total = sumBy(parts, "weight");
  const out = new Map<number, number>();
  if (total <= 0 || amount <= 0) return out;
  let given = 0;
  for (const p of parts) {
    const share = Math.floor((amount * p.weight) / total);
    out.set(p.id, share);
    given += share;
  }
  const order = parts.filter((p) => p.weight > 0);
  for (let i = 0; given < amount; i++, given++) {
    const id = order[i % order.length]!.id;
    out.set(id, (out.get(id) ?? 0) + 1);
  }
  for (const [id, n] of out) if (n === 0) out.delete(id);
  return out;
}

/**
 * The pot, divided by finishing place. Players who tie share the positions they
 * occupy: two players tied first under "top 3" split 60 + 30 evenly.
 */
export function potShares(places: number[][], pot: number, split: Split): Map<number, number> {
  const players = sumBy(places, (g) => g.length);
  const w = weights(effectiveSplit(split, players), players);
  const parts: { id: number; weight: number }[] = [];
  let pos = 0;
  for (const group of places) {
    const groupWeight = sumBy(w.slice(pos, pos + group.length), (x) => x);
    // Even within the group, in id order so remainders are predictable.
    for (const id of sortBy(group)) parts.push({ id, weight: groupWeight / group.length });
    pos += group.length;
  }
  // Scale fractional weights to integers so `divide` stays exact.
  const scale = places.reduce((n, g) => n * g.length, 1);
  return divide(
    pot,
    parts.map((p) => ({ id: p.id, weight: Math.round(p.weight * scale) })),
  );
}

export interface SideBet {
  userId: number;
  /** The player they backed. */
  on: number;
  amount: number;
}

/**
 * Side bets are one shared pool. The backers of the winners (everyone in first
 * place) split the whole pool by how much they bet. If nobody backed a winner,
 * everyone gets their bet back.
 */
export function sideBetShares(
  bets: SideBet[],
  winners: number[],
): { refund: boolean; shares: Map<number, number> } {
  const pool = sumBy(bets, "amount");
  const backers = sortBy(
    bets.filter((b) => winners.includes(b.on)),
    { by: "amount", order: "desc" },
    "userId",
  );
  if (backers.length === 0) return { refund: true, shares: new Map(bets.map((b) => [b.userId, b.amount])) };
  return {
    refund: false,
    shares: divide(
      pool,
      backers.map((b) => ({ id: b.userId, weight: b.amount })),
    ),
  };
}

/** What a coin on `player` pays back if they win (×1.8), or null with no bets on them yet. */
export function odds(bets: SideBet[], player: number): number | null {
  const on = sumBy(
    bets.filter((b) => b.on === player),
    "amount",
  );
  if (on === 0) return null;
  return sumBy(bets, "amount") / on;
}
