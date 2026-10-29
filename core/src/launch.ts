/**
 * The launch stand: when a new model ships, a stand pops up at the square's left edge. Walk past
 * its front and the presenter hands you a pamphlet with the news. It runs on days' editions: news that
 * breaks before 16:00 is today's, after it is tomorrow's, and an edition's stand packs up at 18:00 on
 * its day (Copenhagen). The cutoffs are the clock's, so every client agrees without the server keeping any.
 * What's launched comes from OpenRouter's public model list (`OPENROUTER_MODELS`, free, no key): `world`
 * reads it every few minutes (server/src/launch.ts) and tells everyone; when it was listed is when
 * the stand goes up.
 */
import { clockMinutes } from "./street.ts";
import type { Facing } from "./world.ts";
import { DIRS } from "./world.ts";

/** Who can launch: the pool the stand draws from. Add one here to give it a stand. */
export const PROVIDERS = [
  { id: "claude", name: "Claude", accent: "#d97757", openrouter: "anthropic" },
  { id: "codex", name: "Codex", accent: "#10a37f", openrouter: "openai" },
  { id: "google", name: "Google", accent: "#ea4335", openrouter: "google" },
  { id: "grok", name: "Grok", accent: "#2b2433", openrouter: "x-ai" },
  { id: "zai", name: "Z AI", accent: "#6366f1", openrouter: "z-ai" },
  { id: "kimi", name: "Kimi", accent: "#14b8a6", openrouter: "moonshotai" },
  { id: "meta", name: "Meta", accent: "#0866ff", openrouter: "meta-llama" },
  { id: "minimax", name: "Minimax", accent: "#e0447c", openrouter: "minimax" },
] as const;

export type ProviderId = (typeof PROVIDERS)[number]["id"];

export const providerOf = (id: ProviderId) => PROVIDERS.find((p) => p.id === id)!;

/** A provider by its id or its name, however it's capitalised or spaced ("Z AI", "zai", "z-ai"). */
export function findProvider(raw: string) {
  const key = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  return PROVIDERS.find((p) => p.id === key || p.name.toLowerCase().replace(/[^a-z0-9]/g, "") === key);
}

/** Dollars per million tokens: in, out, and cached in. Null where OpenRouter doesn't list one. */
export interface Price {
  input: number | null;
  output: number | null;
  cache: number | null;
}

/** A model that came along with a launch's lead one: its name, OpenRouter id and price. */
export interface AlsoModel {
  model: string;
  id: string;
  price: Price;
}

/** One model launch: who, what, the pitch, and when it went live (epoch ms). */
export interface Launch {
  provider: ProviderId;
  model: string;
  /** Its OpenRouter id ("openai/gpt-6.1-terra"): its page is `modelUrl(id)`. Empty: no page (a forced one). */
  id: string;
  price: Price;
  /** One line, the pitch: it's the pamphlet's body. */
  tagline: string;
  at: number;
  /** Models the same provider put out with it ("GPT-6 Sol Pro"). */
  also?: AlsoModel[];
}

/** A model's page on OpenRouter, or null when there's no id. */
export const modelUrl = (id: string): string | null => (id ? `https://openrouter.ai/${id}` : null);

/** "$1", "$0.05", "$12.5": a price per million tokens, as short as it goes. */
const dollars = (n: number): string => `$${Number(n.toPrecision(3))}`;

/** "In $1 · Out $5 · Cache $0.05 per 1M tokens", or null when there's no price at all. */
export function priceLine(p: Price): string | null {
  const parts = (
    [
      ["In", p.input],
      ["Out", p.output],
      ["Cache", p.cache],
    ] as const
  ).flatMap(([label, n]) => (n === null ? [] : [`${label} ${dollars(n)}`]));
  return parts.length ? `${parts.join(" · ")} per 1M tokens` : null;
}

// MARK: OpenRouter

/** Every model OpenRouter serves, with when it was listed: public, no key needed. */
export const OPENROUTER_MODELS = "https://openrouter.ai/api/v1/models";

/** Only models listed this recently count: anything older has had its stand packed up already. */
const RECENT_MS = 27 * 3_600_000;
/** One provider's models listed this close together are one launch (OpenAI puts out a family at once). */
const SAME_LAUNCH_MS = 3_600_000;
const TAGLINE_MAX = 160;

/** The first sentence of a description, cut down to fit a pamphlet. */
function firstSentence(text: string): string {
  const one =
    text
      .replace(/\s+/g, " ")
      .trim()
      .match(/^.+?[.!?](?=\s|$)/)?.[0] ?? text.trim();
  return one.length <= TAGLINE_MAX ? one : `${one.slice(0, TAGLINE_MAX - 1).trimEnd()}…`;
}

/** OpenRouter's prices (dollars a token, as strings) as dollars per million tokens. */
function priceOf(pricing: unknown): Price {
  const p = (pricing ?? {}) as Record<string, unknown>;
  const per = (v: unknown): number | null => {
    const n = typeof v === "string" || typeof v === "number" ? Number(v) : Number.NaN;
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 1e6 * 1e6) / 1e6 : null;
  };
  return { input: per(p.prompt), output: per(p.completion), cache: per(p.input_cache_read) };
}

/** One of the pool's models in OpenRouter's list: who made it, its name and id, its price and pitch, when it was listed. */
export interface PoolModel {
  provider: ProviderId;
  name: string;
  id: string;
  price: Price;
  description: string;
  at: number;
}

/**
 * Every model of the pool's providers in an OpenRouter model list, oldest listed first. Variants
 * (`:batch`, `:free`) and aliases (`~openai/...-latest`) aren't models of their own. Null when it isn't
 * a model list at all, so a feed that changed shape keeps what we had. The stand reads it for what's
 * new (`launchesFrom`), the graveyard for what's gone (`graveyard.ts`).
 */
export function poolModels(body: unknown): PoolModel[] | null {
  const data = (body as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return null;
  const models: PoolModel[] = [];
  for (const m of data as {
    id?: unknown;
    name?: unknown;
    created?: unknown;
    description?: unknown;
    pricing?: unknown;
  }[]) {
    if (typeof m?.id !== "string" || typeof m.created !== "number" || typeof m.name !== "string") continue;
    if (m.id.startsWith("~") || m.id.includes(":")) continue;
    const prefix = m.id.split("/")[0];
    const provider = PROVIDERS.find((p) => p.openrouter === prefix);
    if (!provider) continue;
    // "OpenAI: GPT-6.1 Terra" is the model "GPT-6.1 Terra".
    const name = m.name.replace(/^[^:]*:\s*/, "").trim();
    if (!name) continue;
    models.push({
      provider: provider.id,
      name,
      id: m.id,
      price: priceOf(m.pricing),
      description: String(m.description ?? ""),
      at: m.created * 1000,
    });
  }
  return models.sort((a, b) => a.at - b.at);
}

/**
 * The launches among the pool's models (`poolModels`) at `now`: the ones listed in the last day or so,
 * newest last, one per provider per hour (the shortest name leads, the rest are `also`).
 */
export function launchesOf(pool: readonly PoolModel[], now: number): Launch[] {
  const models = pool.filter((m) => m.at <= now && m.at >= now - RECENT_MS);
  const groups: PoolModel[][] = [];
  for (const m of models) {
    const group = groups.findLast((g) => g[0]!.provider === m.provider);
    if (group && m.at - group[0]!.at <= SAME_LAUNCH_MS) group.push(m);
    else groups.push([m]);
  }
  return groups.map((g) => {
    const lead = g.reduce((a, b) => (b.name.length < a.name.length ? b : a));
    const also = g.filter((m) => m !== lead).map((m) => ({ model: m.name, id: m.id, price: m.price }));
    return {
      provider: lead.provider,
      model: lead.name,
      id: lead.id,
      price: lead.price,
      tagline: firstSentence(lead.description) || "Just landed.",
      at: g[0]!.at,
      ...(also.length ? { also } : {}),
    };
  });
}

/** The launches in an OpenRouter model list at `now` (`launchesOf`), or null when it isn't a model list. */
export function launchesFrom(body: unknown, now: number): Launch[] | null {
  const pool = poolModels(body);
  return pool && launchesOf(pool, now);
}

/** Whether two lists of launches look the same to a player: nothing to tell anyone when they do. */
export const sameLaunches = (a: readonly Launch[], b: readonly Launch[]): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

// MARK: The stand

/** News that breaks from this time on goes into the next day's edition (minutes since midnight). */
export const SOFT_CUT = 16 * 60;
/** An edition's stand packs up at this time on its day, hard (minutes since midnight). */
export const STAND_CLOSES = 18 * 60;

/** The stand's tiles: two by two at the plaza's left edge, mirroring the pølsevogn on the right. */
export const STAND = { x: 1, y: 3, w: 2, h: 2 } as const;

export const isStand = (x: number, y: number): boolean =>
  x >= STAND.x && x < STAND.x + STAND.w && y >= STAND.y && y < STAND.y + STAND.h;

/** The row of tiles in front of the stand, one wider each side: walk onto it and you're handed a pamphlet. */
export const isStandFront = (x: number, y: number): boolean =>
  y === STAND.y + STAND.h && x >= STAND.x - 1 && x <= STAND.x + STAND.w;

/** Whether a step from (x, y) facing `facing` is looking at the stand. */
export const facesStand = (x: number, y: number, facing: Facing): boolean =>
  isStand(x + DIRS[facing][0], y + DIRS[facing][1]);

/**
 * The first time on the world's clock strictly after `at` that reads `minutes` past midnight. On the two
 * days a year the clocks change the day is 23 or 25 hours long, so it checks where it landed and corrects.
 */
function nextClock(at: number, minutes: number): number {
  const ahead = (minutes - clockMinutes(at) + 1440) % 1440 || 1440;
  const end = Math.round((at + ahead * 60_000) / 1000) * 1000;
  const off = ((((clockMinutes(end) - minutes) % 1440) + 1440 + 720) % 1440) - 720;
  return end - off * 60_000;
}

/**
 * When the stand for a launch at `at` packs up: 18:00 on its edition's day. News before 16:00 is today's
 * (up to 18:00 today); news from 16:00 on is tomorrow's, so it stays until 18:00 tomorrow, even when it
 * broke at 17:00 with today's stand still up for another hour.
 */
export function standCloses(at: number): number {
  const first = nextClock(at, STAND_CLOSES);
  return clockMinutes(at) < SOFT_CUT || clockMinutes(at) >= STAND_CLOSES
    ? first
    : nextClock(first, STAND_CLOSES);
}

/**
 * Every launch whose stand is up at `now`, newest first. Between 16:00 and 18:00 that can be two editions:
 * today's news with its last hour left, and tomorrow's, which has just begun.
 */
export function activeLaunches(now: number, list: readonly Launch[]): Launch[] {
  return list.filter((l) => l.at <= now && now < standCloses(l.at)).sort((a, b) => b.at - a.at);
}

/** The model with who made it, unless its name says so already ("Claude Haiku 5.5", "Codex GPT-6.1 Terra"). */
export function nameOf(l: { provider: ProviderId; model: string }): string {
  const by = providerOf(l.provider).name;
  return l.model.toLowerCase().startsWith(by.toLowerCase()) ? l.model : `${by} ${l.model}`;
}

/** The providers among these launches, newest launch's first. */
const providersIn = (ls: readonly Launch[]): ProviderId[] => [...new Set(ls.map((l) => l.provider))];

/** How many models these launches put out, the ones that came along with them included. */
const modelsIn = (ls: readonly Launch[]): number => ls.reduce((n, l) => n + 1 + (l.also?.length ?? 0), 0);

/**
 * What the stand looks like with these launches up (newest first, at least one): its provider's colours,
 * or a rainbow (`accent` null) when more than one provider has something out. `key` is which pamphlet
 * that is: you're handed a new one when something new turns up.
 */
export function standOf(ls: readonly Launch[]): { accent: string | null; sign: string; key: string } {
  const providers = providersIn(ls);
  const key = ls
    .map((l) => `${l.provider}:${l.at}`)
    .sort()
    .join("|");
  if (providers.length > 1)
    return { accent: null, sign: `🌈 NEW: ${providers.map((p) => providerOf(p).name).join(" · ")}`, key };
  const more = modelsIn(ls) - 1;
  return {
    accent: providerOf(providers[0]!).accent,
    sign: `🚀 NEW: ${nameOf(ls[0]!)}${more > 0 ? ` +${more}` : ""}`,
    key,
  };
}

/** One model on the pamphlet: its name, its price, and its page. */
export interface PamphletModel {
  name: string;
  price: string | null;
  url: string | null;
}

/** One launch on the pamphlet: the lead model's name and pitch, then every model it put out. */
export interface PamphletEntry {
  provider: ProviderId;
  accent: string;
  headline: string;
  body: string;
  models: PamphletModel[];
}

/**
 * What the pamphlet says about these launches (newest first): one provider's news, or, with several
 * providers, a launch-day newsletter with all of them.
 */
export function pamphletOf(ls: readonly Launch[]): {
  title: string;
  kicker: string;
  rainbow: boolean;
  entries: PamphletEntry[];
  foot: string;
} {
  const providers = providersIn(ls);
  const rainbow = providers.length > 1;
  const models = modelsIn(ls);
  return {
    title: rainbow ? "📰 The launch-day newsletter" : "📣 Pamphlet",
    kicker: rainbow
      ? `🌈 ${models} new models from ${providers.length} providers`
      : models > 1
        ? `🚀 ${models} new from ${providerOf(providers[0]!).name}`
        : "🚀 Just shipped",
    rainbow,
    entries: ls.map((l) => ({
      provider: l.provider,
      accent: providerOf(l.provider).accent,
      headline: nameOf(l),
      body: l.tagline,
      models: [{ model: l.model, id: l.id, price: l.price }, ...(l.also ?? [])].map((m) => ({
        name: m.model,
        price: priceLine(m.price),
        url: modelUrl(m.id),
      })),
    })),
    foot: "Hot off the press. The stand packs up at 18:00.",
  };
}

const SAMPLE = "Faster, smarter, and very new.";
const SAMPLE_PRICE: Price = { input: 1, output: 5, cache: 0.1 };

/**
 * `?launch=` in the page, for screenshots: `on` is a made-up launch, `grok` is that provider's,
 * `grok:Grok 5` names the model, and a comma lists several (`claude,grok:Grok 5`, the first newest);
 * `off` hides it. Undefined: not forced, and the server's list decides. Only the page: the server
 * blocks the stand's tiles only for real launches.
 */
export function forcedLaunches(raw: string | null | undefined, now: number): Launch[] | undefined {
  const v = raw?.trim();
  if (!v) return undefined;
  if (v.toLowerCase() === "off") return [];
  return v.split(",").map((item, i) => {
    const [name = "", ...rest] = item.split(":");
    const provider = findProvider(name)?.id ?? PROVIDERS[0].id;
    const model = rest.join(":").trim() || "Model 1";
    return { provider, model, id: "", price: SAMPLE_PRICE, tagline: SAMPLE, at: now - i * 60_000 };
  });
}
