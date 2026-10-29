/**
 * The statue of the #1 model: a plinth on the square (`♛` on the map, `STATUE_TILE`) holds whichever model
 * leads LMArena's Text Arena, with a plaque saying what it is, who made it (in their colour from `PROVIDERS`)
 * and what it leads. `world` reads the ranking a few times a day (server/src/statue.ts), keeps the last
 * leader it read in its own state so a broken feed never leaves the plinth empty, and tells everyone (the
 * `statue` event). The admin page can pin another one over it. When the leader changes, a bot on the square
 * says so and the new statue is unveiled: a drape lifts off it for `UNVEIL_MS`, on the clock, so nobody keeps
 * any state for it.
 *
 * Why LMArena's Hugging Face dataset: it's LMArena's own published leaderboard (CC BY 4.0), refreshed every
 * few days, and the datasets server hands it out as JSON with no key. lmarena.ai itself sits behind
 * Cloudflare, Artificial Analysis wants an API key, OpenRouter's rankings are an HTML page ranking tokens
 * spent (popularity, not quality), and SWE-bench's JSON (4 MB) ranks agent-and-model systems, not models.
 */
import { fill } from "./format.ts";
import { findProvider, PROVIDERS, type ProviderId, providerOf } from "./launch.ts";

/** The plinth's tile on the map (one, on the square: move it in `CORE` in maps.ts). */
export const STATUE_TILE = "♛";

/** The model on the plinth, as its ranking has it. */
export interface Leader {
  model: string;
  /** Who made it, as the ranking names them ("google", "deepseek"), or as the admin typed it. */
  org: string;
  /** What it leads ("LMArena Text Arena"). */
  ranking: string;
  /** Its score there, when the ranking gives one. */
  score: number | null;
  /** The day the ranking was published (`YYYY-MM-DD`), when it says. */
  asOf: string | null;
}

/** What the plinth shows: a leader (null: none read yet, so it's under its drape) and since when. */
export interface Statue {
  leader: Leader | null;
  /** When this leader took the plinth (epoch ms): the unveiling plays from then. */
  since: number;
  /** Put there from the admin page, not read off the ranking. */
  pinned: boolean;
}

/** What `world` keeps (in its state, so it outlives a restart): the last leader read, the admin's pin, and the next read. */
export interface StatueState {
  read: { leader: Leader; since: number } | null;
  pin: { leader: Leader; since: number } | null;
  /** When to read the ranking next (epoch ms). */
  nextAt: number;
}

export const NO_STATUE: StatueState = { read: null, pin: null, nextAt: 0 };

/** What the admin page sees: all of it, and what the plinth shows for it. */
export type StatueAdmin = StatueState & { shown: Statue };

/** What the plinth shows for `s`: the admin's pin over the last leader read. A plain copy (`world`'s state hands out proxies). */
export function shownStatue(s: StatueState | undefined): Statue {
  const on = s?.pin ?? s?.read ?? null;
  return { leader: on ? { ...on.leader } : null, since: on?.since ?? 0, pinned: !!s?.pin };
}

export const sameLeader = (a: Leader | null, b: Leader | null): boolean =>
  a === b || (!!a && !!b && a.model === b.model && a.org === b.org && a.ranking === b.ranking);

/** `s` after a read of the ranking at `now`: a new leader takes the plinth from now, the same one keeps its `since`, and no answer (null) keeps what was there. */
export function afterRead(s: StatueState, leader: Leader | null, now: number, nextAt: number): StatueState {
  if (!leader) return { ...s, nextAt };
  const since = s.read && sameLeader(s.read.leader, leader) ? s.read.since : now;
  return { ...s, read: { leader, since }, nextAt };
}

/** `s` with the admin's pick on the plinth from `now` (or, null, taken off again). */
export function withPin(s: StatueState, leader: Leader | null, now: number): StatueState {
  if (!leader) return { ...s, pin: null };
  const since = s.pin && sameLeader(s.pin.leader, leader) ? s.pin.since : now;
  return { ...s, pin: { leader, since } };
}

// MARK: LMArena

/** What the ranking is called on the plaque. */
export const RANKING = "LMArena Text Arena";
/** Where a player can see it for themselves. */
export const RANKING_URL = "https://lmarena.ai/leaderboard/text";
/**
 * LMArena's Text Arena, latest edition, as JSON: the first 100 rows are the `overall` category, best first.
 * Public, no key (Hugging Face's datasets server, over the `lmarena-ai/leaderboard-dataset` dataset).
 */
export const LMARENA_ROWS =
  "https://datasets-server.huggingface.co/rows?dataset=lmarena-ai%2Fleaderboard-dataset&config=text&split=latest&offset=0&length=100";

const NAME_MAX = 48;

/** A name off the feed: one line, trimmed, cut to fit a plaque; "" when it isn't a string. */
function clean(v: unknown, max = NAME_MAX): string {
  if (typeof v !== "string") return "";
  const s = v.replace(/[\p{Cc}\s]+/gu, " ").trim();
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

const finite = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * The #1 model in a page of LMArena's rows: the `overall` row ranked 1, the higher score if two share it.
 * Null when there's no such row (an error, a page that changed shape, a ranking without a #1), so a feed
 * gone wrong keeps the statue that's up.
 */
export function leaderFrom(body: unknown): Leader | null {
  const rows = (body as { rows?: unknown } | null)?.rows;
  if (!Array.isArray(rows)) return null;
  let best: Leader | null = null;
  for (const r of rows) {
    const row = (r as { row?: Record<string, unknown> } | null)?.row;
    if (row?.category !== "overall" || finite(row.rank) !== 1) continue;
    const model = clean(row.model_name);
    const org = clean(row.organization, 32);
    if (!model || !org) continue;
    const score = finite(row.rating);
    if (best && (best.score ?? -Infinity) >= (score ?? -Infinity)) continue;
    const day = row.leaderboard_publish_date;
    const asOf = typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
    best = { model, org, ranking: RANKING, score, asOf };
  }
  return best;
}

// MARK: The plaque

/** LMArena's names for the pool's providers where neither their id, name nor OpenRouter prefix matches. */
const ORGS: Record<string, ProviderId> = { anthropic: "claude", openai: "codex", moonshot: "kimi" };

const keyOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** The pool's provider (`PROVIDERS`) behind an organisation's name, or null for one outside it. */
export function providerFor(org: string): ProviderId | null {
  const key = keyOf(org);
  return ORGS[key] ?? findProvider(org)?.id ?? PROVIDERS.find((p) => keyOf(p.openrouter) === key)?.id ?? null;
}

/** The plaque's colour for makers outside the pool: bronze. */
export const BRONZE = "#9a6a3a";

/** Who made it, for the plaque ("Google"; "Deepseek" for one outside the pool), and their colour. */
export function makerOf(l: Leader): { name: string; accent: string } {
  const p = providerFor(l.org);
  if (p) return { name: providerOf(p).name, accent: providerOf(p).accent };
  const name = /[A-Z]/.test(l.org) ? l.org : l.org.replace(/\b\w/g, (c) => c.toUpperCase());
  return { name, accent: BRONZE };
}

/** "22 Oct 2026" for `2026-10-22`. */
const dayName = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

/** What the plinth says: its sign over it, its colour, and the plaque you read with E. */
export function plaqueOf(s: Statue): { sign: string; accent: string; text: string } {
  const l = s.leader;
  if (!l)
    return {
      sign: "🗿 Unveiling soon",
      accent: BRONZE,
      text: "A plinth under a velvet drape. A brass plate reads: THE #1 MODEL. Unveiling soon.",
    };
  const by = makerOf(l);
  const of = [
    l.score === null ? "" : `score ${Math.round(l.score)}`,
    l.asOf ? `as of ${dayName(l.asOf)}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  return {
    sign: `🏆 #1 ${l.model}`,
    accent: by.accent,
    text: `The statue of the #1 model: ${l.model}, by ${by.name}. It leads ${l.ranking}${of ? ` (${of})` : ""}.${s.pinned ? " Put up by the town." : ""}`,
  };
}

// MARK: The unveiling

/** How long the drape takes to come off a new statue. */
export const UNVEIL_MS = 6_000;

/**
 * How far the unveiling is at `now`: 0 to 1 while the drape comes off, null once it's off. A `since` a little
 * ahead of `now` is a client clock running behind the server's: the unveiling is about to start, so it's 0.
 */
export function unveiling(s: Statue, now: number): number | null {
  if (!s.leader) return null;
  const k = (now - s.since) / UNVEIL_MS;
  return k > -1 && k < 1 ? Math.max(0, k) : null;
}

/** What a bot on the square says when a new model takes the plinth. */
const UNVEIL_LINES = [
  "🗿 New statue on the square! {model} is #1 on {ranking} now.",
  "🗿 They've swapped the statue. {model} by {by} leads {ranking}.",
  "🗿 Hats off: {model} took the plinth. #1 on {ranking}.",
];

export function unveilLine(l: Leader, rand = Math.random): string {
  const line = UNVEIL_LINES[Math.floor(rand() * UNVEIL_LINES.length)] ?? UNVEIL_LINES[0]!;
  return fill(line, { model: l.model, by: makerOf(l).name, ranking: l.ranking });
}

/**
 * `?statue=` in the page, for screenshots: `grok` puts that provider's made-up model up, `grok:Grok 5`
 * names it, `none` shows the draped plinth. It's unveiled as the page loads. Undefined: the server's decides.
 */
export function forcedStatue(raw: string | null | undefined, now: number): Statue | undefined {
  const v = raw?.trim();
  if (!v) return undefined;
  if (v.toLowerCase() === "none") return { leader: null, since: 0, pinned: false };
  const [name = "", ...rest] = v.split(":");
  const provider = providerOf(findProvider(name)?.id ?? PROVIDERS[0].id);
  const model = rest.join(":").trim() || `${provider.name} Model 1`;
  return {
    leader: { model, org: provider.name, ranking: RANKING, score: 1500, asOf: null },
    since: now,
    pinned: false,
  };
}
