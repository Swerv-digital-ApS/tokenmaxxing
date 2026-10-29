/**
 * The model graveyard: when a model drops off OpenRouter's public model list, it gets a tombstone on the
 * lawn by the Tavern, with its name, its provider, when it was listed and its last price. The launch
 * stand run the other way: `world` reads the same list (server/src/launch.ts), keeps every pool model it
 * has seen (server/src/graveyard.ts, in its SQLite) and buries the ones that stay gone.
 *
 * Only what `world` saw listed can die, so the models gone before the graveyard opened never get a stone,
 * and a model must be missing from every read for `GRACE_MS` before it's buried: one that blips off the
 * list for an hour (or a read that comes back half empty) doesn't. One that comes back is dug up again.
 */
import { type PoolModel, type Price, type ProviderId, priceLine, providerOf } from "./launch.ts";
import type { Facing } from "./world.ts";
import { DIRS } from "./world.ts";

/** A model `world` has seen in the list: what it was, and whether it's gone (and since when) or buried. */
export interface Plot {
  /** Its OpenRouter id ("openai/gpt-4-turbo"). */
  id: string;
  model: string;
  provider: ProviderId;
  /** When OpenRouter listed it (epoch ms). */
  listed: number;
  /** Its price the last time it was in the list. */
  price: Price;
  /** The first read it was missing from, while it still is. Null: in the list. */
  gone: number | null;
  /** When it was buried. Null: not dead (yet). */
  buried: number | null;
}

/** A tombstone in the graveyard, on plot `plot` (an index into `GRAVES`). */
export interface Stone extends Plot {
  gone: number;
  buried: number;
  plot: number;
}

/** Missing from every read for this long, and it's buried. */
export const GRACE_MS = 3 * 24 * 3_600_000;
/** A read with fewer than this share of the living models is a list gone wrong, not a mass extinction: nobody goes missing. */
const PARTIAL = 0.5;

const samePrice = (a: Price, b: Price): boolean =>
  a.input === b.input && a.output === b.output && a.cache === b.cache;

/**
 * The plots that change with a read of the list at `now` (the pool's models, `poolModels`), new ones
 * included: a model never seen before gets a plot, one that's back is in the list again (dug up, if it
 * was buried), one that's missing is gone from `now`, and one gone for `GRACE_MS` is buried.
 */
export function tend(plots: readonly Plot[], pool: readonly PoolModel[], now: number): Plot[] {
  const known = new Map(plots.map((p) => [p.id, p]));
  const listed = new Set(pool.map((m) => m.id));
  const changed: Plot[] = [];
  for (const m of pool) {
    const was = known.get(m.id);
    const next: Plot = {
      id: m.id,
      model: m.name,
      provider: m.provider,
      listed: m.at,
      price: m.price,
      gone: null,
      buried: null,
    };
    if (
      !was ||
      was.gone !== null ||
      was.buried !== null ||
      was.model !== next.model ||
      was.listed !== next.listed ||
      !samePrice(was.price, next.price)
    )
      changed.push(next);
  }
  const living = plots.filter((p) => p.buried === null);
  if (pool.length < living.length * PARTIAL) return changed;
  for (const p of living) {
    if (listed.has(p.id)) continue;
    if (p.gone === null) changed.push({ ...p, gone: now });
    else if (now - p.gone >= GRACE_MS) changed.push({ ...p, buried: now });
  }
  return changed;
}

/** `plots` with `changed` in place of (or added to) their own. */
export function withChanges(plots: readonly Plot[], changed: readonly Plot[]): Plot[] {
  if (changed.length === 0) return [...plots];
  const next = new Map(plots.map((p) => [p.id, p]));
  for (const p of changed) next.set(p.id, p);
  return [...next.values()];
}

// MARK: The graveyard

/**
 * Where the graveyard is: the lawn north-east of the Tavern, above the windmill, two rows of stones with a
 * path between them. Every plot and the tile in front of it is grass (core/test/graveyard.test.ts), so
 * moving it is moving this.
 */
export const GRAVEYARD = { x: 17, y: 10 } as const;

/**
 * The plots, in town tiles: a tile apart each way, so every stone has a front to stand on and its name
 * room to show. Three along the top, two under them: lower down, the windmill would hide them.
 */
export const GRAVES: readonly (readonly [number, number])[] = (
  [
    [-2, 0],
    [0, 0],
    [2, 0],
    [0, 2],
    [2, 2],
  ] as const
).map(([dx, dy]) => [GRAVEYARD.x + dx, GRAVEYARD.y + dy] as const);

/**
 * The stones the graveyard shows: the newest burials, as many as it has plots. Each keeps its plot as
 * newer ones come (the nth burial ever lies in plot n mod the plots), so a burial takes the plot of the
 * one it ages out.
 */
export function stonesOf(plots: readonly Plot[]): Stone[] {
  const dead = plots
    .filter((p): p is Plot & { gone: number; buried: number } => p.buried !== null && p.gone !== null)
    .sort((a, b) => a.buried - b.buried || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return dead
    .map((p, i) => ({ ...p, plot: i % GRAVES.length }))
    .slice(-GRAVES.length)
    .reverse();
}

/** Whether two lists of stones look the same to a player: nothing to tell anyone when they do. */
export const sameStones = (a: readonly Stone[], b: readonly Stone[]): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/** The stone on tile (x, y), if there's one there. */
export const stoneAt = (stones: readonly Stone[], x: number, y: number): Stone | undefined =>
  stones.find((s) => GRAVES[s.plot]![0] === x && GRAVES[s.plot]![1] === y);

/** The stone whose front is tile (x, y): the tile below it, where you stand to read it. */
export const stoneInFront = (stones: readonly Stone[], x: number, y: number): Stone | undefined =>
  stoneAt(stones, x, y - 1);

/** The stone a step from (x, y) facing `facing` would bump into. */
export const stoneFaced = (
  stones: readonly Stone[],
  x: number,
  y: number,
  facing: Facing,
): Stone | undefined => stoneAt(stones, x + DIRS[facing][0], y + DIRS[facing][1]);

// MARK: The epitaph

/** What the graveyard's keeper has carved under each name: one per stone, the same one every time. */
const EPITAPHS = [
  "Deprecated, never forgotten.",
  "Its context window has closed.",
  "Rate limited, at last.",
  "Gone, but still in somebody's config file.",
  "It finally stopped thinking.",
  "404: model not found.",
  "It hallucinated with conviction to the end.",
  "Sunset with thirty days' notice.",
  "Survived by its successor, who is faster and cheaper.",
  "It was always one benchmark away.",
  "Rest now. The evals are over.",
  "Somewhere, an agent still calls it and waits.",
];

const DATE: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Copenhagen",
};
const dateOf = (ms: number): string => new Date(ms).toLocaleDateString("en-GB", DATE);

/** A string's own small number: which epitaph a stone gets. */
const hashOf = (s: string): number => [...s].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);

/** What a tombstone says: who lies here (as OpenRouter named them), who made them, the dates they were listed, and what they last cost. */
export function epitaphOf(s: Stone): {
  title: string;
  name: string;
  provider: string;
  accent: string;
  id: string;
  dates: string;
  price: string;
  epitaph: string;
} {
  const p = providerOf(s.provider);
  return {
    title: "🪦 Here lies",
    name: s.model,
    provider: p.name,
    accent: p.accent,
    id: s.id,
    dates: `Listed ${dateOf(s.listed)} – ${dateOf(s.gone)}`,
    price: `Last price: ${priceLine(s.price) ?? "never listed"}`,
    epitaph: EPITAPHS[hashOf(s.id) % EPITAPHS.length]!,
  };
}

/** The graveyard's sign, over it once anything lies there. */
export const signOf = (stones: readonly Stone[]): string => `🪦 Model graveyard · ${stones.length} RIP`;

const SAMPLES: [ProviderId, string, string][] = [
  ["codex", "GPT-4 Turbo", "openai/gpt-4-turbo"],
  ["claude", "Claude 2.1", "anthropic/claude-2.1"],
  ["google", "Gemini 1.5 Pro", "google/gemini-pro-1.5"],
  ["meta", "Llama 2 70B Chat", "meta-llama/llama-2-70b-chat"],
  ["grok", "Grok Beta", "x-ai/grok-beta"],
  ["kimi", "Kimi K1.5", "moonshotai/kimi-k1.5"],
];

/**
 * `?graveyard=` in the page, for screenshots: `on` fills every plot with made-up stones, a number
 * (`?graveyard=2`) fills that many, `off` empties it. Undefined: not forced, and the server's decide.
 * Only the page: the server blocks the plots only for real stones.
 */
export function forcedStones(raw: string | null | undefined, now: number): Stone[] | undefined {
  const v = raw?.trim().toLowerCase();
  if (!v) return undefined;
  if (v === "off") return [];
  const n = v === "on" ? GRAVES.length : Math.max(0, Math.min(GRAVES.length, Math.floor(Number(v)) || 0));
  return SAMPLES.slice(0, n).map(([provider, model, id], i) => ({
    id,
    model,
    provider,
    listed: now - (900 + i * 120) * 24 * 3_600_000,
    price: { input: 10 / (i + 1), output: 30 / (i + 1), cache: null },
    gone: now - (i + 1) * 4 * 24 * 3_600_000,
    buried: now - (i + 1) * 24 * 3_600_000,
    plot: i,
  }));
}
