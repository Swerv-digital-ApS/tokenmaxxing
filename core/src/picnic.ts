/**
 * The Outage Picnic: when Claude's or OpenAI's status page says it's down, every agent stops, so the
 * town throws a picnic on the grass by the square. `world` reads the status pages (server/src/picnic.ts)
 * and tells everyone when it changes; this is what both sides agree on.
 */
import { typedKeys } from "hanzio";

export type Provider = "Claude" | "OpenAI";

/** Atlassian Statuspage summaries: the overall indicator plus each component, a couple of KB each. */
export const STATUS_PAGES: Record<Provider, string> = {
  Claude: "https://status.claude.com/api/v2/summary.json",
  OpenAI: "https://status.openai.com/api/v2/summary.json",
};

/** Who's down, and since when (server time): one outage, one badge each, however long it lasts. */
export interface Outage {
  down: Provider[];
  since: number;
}

/** A component that agents need. Fine-tuning or voice mode going down isn't worth a picnic. */
const CORE_COMPONENT = /\bAPI\b|claude\.ai|Claude Code|Completions|Responses|Codex/i;
const OUT = new Set(["partial_outage", "major_outage"]);

/**
 * Whether a status page summary says it's down: a major or critical indicator, or a partial or major
 * outage of a component agents need. Degraded performance (a "minor" indicator) is not an outage.
 * Null when it isn't a summary at all, so a page that changed format keeps what we had.
 */
export function isDown(summary: unknown): boolean | null {
  const s = summary as { status?: { indicator?: unknown }; components?: unknown } | null;
  const indicator = s?.status?.indicator;
  if (typeof indicator !== "string") return null;
  if (indicator === "major" || indicator === "critical") return true;
  const components = Array.isArray(s?.components)
    ? (s.components as { name?: unknown; status?: unknown }[])
    : [];
  return components.some(
    (c) => OUT.has(String(c?.status)) && typeof c?.name === "string" && CORE_COMPONENT.test(c.name),
  );
}

/**
 * The outage after a round of readings (`undefined`: that page couldn't be read, so it stays as it was).
 * It keeps its `since` while anyone is still down, so a second provider going down is the same picnic.
 */
export function nextOutage(
  prev: Outage | null,
  readings: Partial<Record<Provider, boolean | null>>,
  now: number,
): Outage | null {
  const down = typedKeys(STATUS_PAGES).filter((p) => readings[p] ?? prev?.down.includes(p) ?? false);
  if (down.length === 0) return null;
  return { down, since: prev?.since ?? now };
}

/** Whether two outages look the same to a player (who's down, and which picnic it is). */
export const sameOutage = (a: Outage | null, b: Outage | null): boolean =>
  a === b || (!!a && !!b && a.since === b.since && a.down.join() === b.down.join());

/**
 * `PICNIC_OUTAGE` on the server, `?picnic=` in the page: `claude`, `openai` or `both` force an outage
 * (dev and screenshots), `off` never has one (a kill switch for a flaky feed). Undefined: not forced.
 */
export function forcedOutage(raw: string | null | undefined, now: number): Outage | null | undefined {
  const v = raw?.trim().toLowerCase();
  if (!v) return undefined;
  if (v === "off") return null;
  const down: Provider[] =
    v === "claude" ? ["Claude"] : v === "openai" ? ["OpenAI"] : v === "both" ? ["Claude", "OpenAI"] : [];
  return down.length ? { down, since: now } : undefined;
}

/** What the banner says. */
export const bannerFor = (o: Outage): string =>
  `${o.down.join(" and ")} ${o.down.length > 1 ? "are" : "is"} down. Touch grass.`;

// MARK: The blankets

/** A blanket on the lawn across the road below the square, in town tiles (the square is always at block (0, 0)). */
interface Blanket {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const BLANKETS: readonly Blanket[] = [
  { x: 3, y: 10, w: 3, h: 2 },
  { x: 11, y: 10, w: 3, h: 2 },
];

/** The picnic basket, beside the right-hand blanket. Just grass to walk on, like the blankets. */
export const BASKET: readonly [number, number] = [15, 11];

export const onBlanket = (x: number, y: number): boolean =>
  BLANKETS.some((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);

/** Where bots sit, one each: the middle of each blanket's back row, then a front corner of each. */
export const PICNIC_SEATS: readonly [number, number][] = [
  ...BLANKETS.map((b): [number, number] => [b.x + 1, b.y]),
  ...BLANKETS.map((b, i): [number, number] => [i ? b.x + b.w - 1 : b.x, b.y + 1]),
];

/** The badge's key in `rewards`: one per player per outage. */
export const picnicReward = (since: number): string => `picnic:${since}`;

/** Comes with the badge, once per outage: a patch of grass for your office (`office.ts`), never sold. */
export const TOUCHED_GRASS = "furn.g";
