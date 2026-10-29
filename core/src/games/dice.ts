/**
 * Due Diligence: Liar's Dice, where the dice are your startup's metrics. Everyone
 * rolls in secret, then claims go round about all the dice on the table until
 * someone calls "Liar!". Whoever was wrong loses a die; the last with dice wins.
 */
import { recordFromKeys, sumBy } from "hanzio";
import { random } from "./random.ts";
import { type Callout, type GameDef, lastStanding, refused } from "./types.ts";

const DICE = 5;
export const TURN_MS = 30_000;
export const REVEAL_MS = 4_000;
/** 🦄 is the 1: wild, and not claimable itself. */
export const FACES = ["", "🦄", "📉", "📊", "📈", "🚀", "💰"] as const;

interface Claim {
  player: number;
  count: number;
  face: number;
}

interface Reveal {
  dice: Record<number, number[]>;
  claim: Claim;
  caller: number | null;
  /** How many dice showed the face (unicorns included). */
  actual: number;
  loser: number;
  until: number;
}

export interface DiceState {
  /** Seating order; turns go round it. */
  players: number[];
  dice: Record<number, number[]>;
  claims: Claim[];
  turn: number;
  deadline: number;
  reveal: Reveal | null;
  /** Players out of dice (or who left), first out first. */
  out: number[];
  seed: number;
  round: number;
  startedAt: number;
}

export interface DiceView {
  players: number[];
  mine: number[] | null;
  counts: Record<number, number>;
  claims: Claim[];
  turn: number;
  deadline: number;
  reveal: Reveal | null;
  out: number[];
}

const alive = (s: DiceState) => s.players.filter((p) => !s.out.includes(p));
const total = (s: DiceState) => sumBy(alive(s), (p) => s.dice[p]?.length);
const matching = (dice: number[], face: number) => dice.filter((d) => d === face || d === 1).length;

function roll(s: DiceState, starter: number, now: number): DiceState {
  const rng = random(s.seed + s.round * 7919);
  const dice = recordFromKeys(s.players, (p) => (s.dice[p] ?? []).map(() => 1 + Math.floor(rng() * 6)));
  return { ...s, dice, claims: [], turn: starter, deadline: now + TURN_MS, round: s.round + 1 };
}

/** The next player with dice after `p`, going round the table. */
function after(s: DiceState, p: number): number {
  const i = s.players.indexOf(p);
  for (let k = 1; k <= s.players.length; k++) {
    const q = s.players[(i + k) % s.players.length]!;
    if (!s.out.includes(q)) return q;
  }
  return p;
}

/** `loser` loses a die; out of dice and they're out. Shows everyone's dice, then a new round. */
function lose(s: DiceState, loser: number, caller: number | null, now: number): DiceState {
  const claim = s.claims.at(-1);
  const actual = claim ? sumBy(Object.values(s.dice), (d) => matching(d, claim.face)) : 0;
  const left = s.dice[loser]!.slice(1);
  const next: DiceState = {
    ...s,
    dice: { ...s.dice, [loser]: left },
    out: left.length === 0 && !s.out.includes(loser) ? [...s.out, loser] : s.out,
    reveal: claim ? { dice: s.dice, claim, caller, actual, loser, until: now + REVEAL_MS } : null,
  };
  // The loser starts the next round, or the one after them if they're out.
  return roll(next, next.out.includes(loser) ? after(next, loser) : loser, now + (claim ? REVEAL_MS : 0));
}

export const dice: GameDef<DiceState, DiceView> = {
  id: "dice",
  name: "Due Diligence",
  emoji: "🎲",
  blurb: "Liar's Dice with your startup's metrics. Bluff, or call it.",
  players: { min: 2, max: 6 },
  tickMs: 250,

  setup(players, seed, _options, now) {
    const s: DiceState = {
      players,
      dice: recordFromKeys(players, () => Array(DICE).fill(0)),
      claims: [],
      turn: players[0]!,
      deadline: 0,
      reveal: null,
      out: [],
      seed,
      round: 0,
      startedAt: now,
    };
    return roll(s, players[0]!, now);
  },

  move(s, player, move, now) {
    if (s.reveal && now < s.reveal.until) return refused("Wait for the next round.");
    if (player !== s.turn) return refused("It's not your turn.");
    const m = move as { liar?: unknown; count?: unknown; face?: unknown } | null;
    const last = s.claims.at(-1);
    if (m?.liar === true) {
      if (!last) return refused("Nobody has claimed anything yet.");
      const actual = sumBy(Object.values(s.dice), (d) => matching(d, last.face));
      return lose(s, actual >= last.count ? player : last.player, player, now);
    }
    const count = Number(m?.count);
    const face = Number(m?.face);
    if (!Number.isInteger(count) || !Number.isInteger(face) || face < 2 || face > 6 || count < 1)
      return refused("Claim a number of 📉 📊 📈 🚀 or 💰 (🦄 are wild).");
    if (count > total(s)) return refused(`There are only ${total(s)} dice on the table.`);
    if (last && !(count > last.count || (count === last.count && face > last.face)))
      return refused("Raise: more dice, or the same number of a higher face.");
    return {
      ...s,
      reveal: null,
      claims: [...s.claims, { player, count, face }],
      turn: after(s, player),
      deadline: now + TURN_MS,
    };
  },

  tick(s, now) {
    if (dice.outcome(s)) return s;
    if (s.reveal && now >= s.reveal.until) return { ...s, reveal: null };
    // Out of time: lose a die, and a new round starts.
    return now >= s.deadline ? lose({ ...s, claims: [] }, s.turn, null, now) : s;
  },

  forfeit(s, player, now) {
    if (s.out.includes(player)) return s;
    const next = { ...s, dice: { ...s.dice, [player]: [] }, out: [...s.out, player] };
    return s.turn === player ? roll(next, after(next, player), now) : next;
  },

  view(s, viewer, now) {
    const revealing = s.reveal && now < s.reveal.until ? s.reveal : null;
    return {
      players: s.players,
      mine: viewer !== null && s.players.includes(viewer) ? s.dice[viewer]! : null,
      counts: recordFromKeys(s.players, (p) => s.dice[p]!.length),
      claims: s.claims,
      turn: s.turn,
      deadline: s.deadline,
      reveal: revealing,
      out: s.out,
    };
  },

  // Everyone leaving at once still ends it: the last one out places best.
  outcome: (s) => lastStanding(alive(s), s.out),

  betsCloseAt: (s) => s.startedAt + 20_000,

  callouts(before, after): Callout[] {
    const out: Callout[] = [];
    const claim = after.claims.at(-1);
    if (claim && after.claims.length > before.claims.length)
      out.push({ player: claim.player, text: `${claim.count}× ${FACES[claim.face]}` });
    if (after.reveal && after.reveal !== before.reveal) {
      const r = after.reveal;
      if (r.caller !== null) out.push({ player: r.caller, text: "Liar! 🫵" });
      out.push({ player: r.loser, text: `−1 🎲 (there were ${r.actual})` });
    } else if (
      after.round > before.round &&
      after.dice[before.turn]!.length === before.dice[before.turn]!.length - 1
    )
      out.push({ player: before.turn, text: "⏰ −1 🎲" });
    for (const p of after.out)
      if (!before.out.includes(p) && after.dice[p]!.length === 0) out.push({ player: p, text: "💀 out" });
    return out;
  },

  headline(s) {
    return `${total(s)} 🎲 on the table · ${alive(s).length} left`;
  },

  status(s, player) {
    if (s.out.includes(player)) return "💀";
    return `🎲${s.dice[player]!.length}${s.turn === player ? " 🤔" : ""}`;
  },
};
