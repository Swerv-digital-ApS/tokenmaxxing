/**
 * The 429 Cop: a town character who pulls over whoever burns tokens fastest and writes them a ticket.
 * Nothing is taken; a ticket is a badge of honour, kept on the player's card. The rules are here; the
 * `world` actor walks him (he's one of `BOTS`) and `town` keeps the tickets.
 */
import type { BotDef } from "./bots.ts";
import { BOT_LEVEL, compact, fill } from "./format.ts";
import { lookWith } from "./world.ts";

/** The cop's id: the web draws his cap, notepad and siren on this one. */
export const COP_ID = -3;

/** "Burning fast" is tokens over the last hour (from `player.tokensBetween`, the same minute-capped sum as the leaderboard). */
export const BURN_WINDOW_MS = 3_600_000;
/**
 * The speed limit: below this an hour, nobody gets pulled over. A busy real day is ~1.5B and heavy users
 * run 60-150M an hour, so only a real sprint gets pulled over.
 */
export const SPEED_LIMIT = 200_000_000;
/** A burn older than this (no sync since) is stale: they've stopped, or closed the app. */
export const BURN_FRESH_MS = 10 * 60_000;
/** He reads his own: tickets start with this, and the web turns his siren on for them. */
export const SIREN = "🚨";

export const COP: BotDef = {
  id: COP_ID,
  name: "Officer 429",
  look: lookWith({ style: 0, skin: 1, hair: 0, outfit: 1 }),
  level: BOT_LEVEL,
  bio: "Rate-limit enforcement, Tokenmaxxing PD. Pulls over whoever burns fastest and writes them a ticket. Takes nothing. Fond of coffee.",
  lines: [
    "Nothing to see here. Keep it under the limit.",
    "I'm not mad. I'm just rate limited.",
    "Routine patrol. Please retry later.",
    "429 means slow down. It doesn't mean stop. Mostly.",
    "I once pulled over a for-loop. It kept coming back.",
    "Retry-After: one donut.",
    "Exponential backoff is a lifestyle.",
    "Speed limit's posted at the fountain. Nobody reads it.",
  ],
  every: [60_000, 180_000],
  // He doesn't tag along for fun: he has a speeder to catch.
  followChance: 0,
  coffeeLines: [
    "Cup {cups}. Strictly for stamina.",
    "{cups} cups. Back on patrol.",
    "Coffee break. The tokens can wait. They can't, actually.",
  ],
};

/** What he says when he starts the chase. `{name}`. */
const PULL_OVER_LINES = [
  "429 Too Many Requests! Pull over, @{name}!",
  "@{name} pull over! 429 Too Many Requests.",
  "@{name} hands off the keyboard. 429!",
  "@{name} do you know how fast you were burning?",
];

/** The chase starts: over his head, with the siren on. */
export const pullOverLine = (name: string, rand = Math.random): string =>
  `${SIREN} ${fill(PULL_OVER_LINES[Math.floor(rand() * PULL_OVER_LINES.length)]!, { name })}`;

/** What a ticket is for. `{rate}` is the speed, rounded down (`240M`). */
export const CHARGES = [
  "Exceeding {rate} tokens/hour in a residential zone",
  "Doing {rate} tokens/hour past the fountain",
  "{rate} tokens/hour in a school zone",
  "Reckless prompting at {rate} tokens/hour",
  "Failure to /compact at {rate} tokens/hour",
  "{rate} tokens/hour, context window wide open",
];

/** One player's burn, as `world` last heard it. */
export interface Burn {
  id: number;
  /** Tokens over the hour up to `at`. */
  tokens: number;
  at: number;
}

/**
 * Who he pulls over: the fastest fresh burn over the limit, leaving out anyone `skip` says (not in
 * town, or ticketed today). Null when nobody's speeding.
 */
export function speeder(
  burns: Iterable<Burn>,
  now: number,
  skip: (id: number) => boolean = () => false,
): Burn | null {
  let top: Burn | null = null;
  for (const b of burns) {
    if (b.tokens < SPEED_LIMIT || now - b.at > BURN_FRESH_MS || skip(b.id)) continue;
    if (!top || b.tokens > top.tokens) top = b;
  }
  return top;
}

/** The speed on a ticket: rounded down to two figures, so `247.6M` is written up as `240M`. */
export function rateOf(tokens: number): number {
  const step = 10 ** Math.max(0, Math.floor(Math.log10(Math.max(1, tokens))) - 1);
  return Math.floor(tokens / step) * step;
}

/** A ticket as it's kept: the world day, the speed (`rateOf`) and which charge. */
export interface Ticket {
  day: string;
  rate: number;
  charge: number;
}

/** The charge in words. A rounded speed reads `240M`, not `240.0M`. */
export const chargeOf = (t: Pick<Ticket, "rate" | "charge">): string =>
  fill(CHARGES[t.charge] ?? CHARGES[0]!, { rate: compact(t.rate).replace(".0", "") });

/** A fresh ticket for `tokens` an hour on `day`; `rand` picks the charge. */
export const writeTicket = (day: string, tokens: number, rand = Math.random): Ticket => ({
  day,
  rate: rateOf(tokens),
  charge: Math.floor(rand() * CHARGES.length),
});

/**
 * Tickets live in `town`'s `rewards` table, one row each, as `ticket:<day>:<rate>:<charge>`: no table of
 * their own, and a deleted account's go with its rewards.
 */
export const ticketKey = (t: Ticket): string => `ticket:${t.day}:${t.rate}:${t.charge}`;

export function parseTicket(key: string): Ticket | null {
  const m = /^ticket:(\d{4}-\d{2}-\d{2}):(\d+):(\d+)$/.exec(key);
  return m ? { day: m[1]!, rate: Number(m[2]), charge: Number(m[3]) } : null;
}

/** In every ticket line: the web draws his notepad while it's over his head. */
export const TICKET_MARK = "📝";

/**
 * What he says, writing it up, next to them: just the charge, so it fits a bubble (3 lines). Starts
 * with `SIREN`, so the web knows to flash it.
 */
export const ticketLine = (t: Ticket): string => `${SIREN}${TICKET_MARK} ${chargeOf(t)}.`;
