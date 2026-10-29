import type { Frame } from "@tokenmaxxing/core/badges.ts";
import type { PinView } from "@tokenmaxxing/core/collection.ts";
import { SIREN, TICKET_MARK } from "@tokenmaxxing/core/cop.ts";
import type { Edition } from "@tokenmaxxing/core/editions.ts";
import { onBlanket, PICNIC_SEATS } from "@tokenmaxxing/core/picnic.ts";

/**
 * The pure parts of the 3D world's events: what the server's state says about the cop, the merchant, the
 * name tags' chips and so on, with no three.js and no DOM so it can be tested (`web/test/render3d-world.test.ts`).
 */

// MARK: The 429 Cop

/** A chase lasts about this long on screen once his pull-over line has been heard (as the 2D game's `cop.ts`). */
export const CHASE_MS = 60_000;

export interface CopState {
  /** The lights are going. */
  siren: boolean;
  /** The ticket is over his head: he stands and writes it. */
  writing: boolean;
}

/**
 * Reads the cop's lines like the 2D game does: the client is only told what he says, so a pull-over line
 * (`SIREN` first) means a chase, until he writes the ticket (`TICKET_MARK`) or a minute passes.
 */
export class CopWatch {
  private since = 0;
  private readonly out: CopState = { siren: false, writing: false };

  /** `line` is what is in his bubble right now ("" when nothing); `now` any monotonic ms. */
  read(line: string, now: number): CopState {
    const writing = line.startsWith(SIREN) && line.includes(TICKET_MARK);
    if (line.startsWith(SIREN) && !writing) this.since = now;
    if (writing) this.since = 0;
    this.out.writing = writing;
    this.out.siren = writing || (this.since > 0 && now - this.since < CHASE_MS);
    return this.out;
  }
}

// MARK: The merchant

/** The colour of each good on the cart: an edition's rarity (four a week), padded so the cart is never bare. */
const GOOD_COLOR: Record<string, string> = {
  common: "#c9b6ff",
  uncommon: "#a5d977",
  rare: "#8fe3ff",
  epic: "#ff7ab6",
  legendary: "#f5d14a",
};

export function goodsColors(lineup: readonly Edition[]): string[] {
  const out = lineup.map((e) => GOOD_COLOR[String(e.rarity)] ?? "#c9b6ff");
  const fill = ["#c9b6ff", "#f5d14a", "#8fe3ff", "#ff7ab6"];
  for (let i = out.length; i < 4; i++) out.push(fill[i]!);
  return out.slice(0, 4);
}

/** What the cart's sign says. */
export const CART_SIGN_HERE = "🛒 Traveling merchant · editions";
export const CART_SIGN_AWAY = "🛒 Back Thursday";

// MARK: The street

export const polseSign = (open: boolean): string => (open ? "🌭 Gratis pølser" : "🌭 Lukket · 11-14");

export function snailSign(phase: "queued" | "deploying" | "deployed"): string {
  return phase === "queued" ? "queued" : phase === "deploying" ? "deploying..." : "✓ deployed";
}

/** The minute the build finishes, crossed while watching: the burst and the toast fire once. */
export function crossed(last: number | null, now: number, at: number): boolean {
  return last !== null && last < at && now >= at && now - last < 5;
}

// MARK: The picnic

/** Where the picnic's grass patch sprouts for someone who sat on a blanket: the first of its seats. */
export const grassSpot = (x: number, y: number): boolean =>
  onBlanket(x, y) || PICNIC_SEATS.some(([sx, sy]) => sx === x && sy === y);

/** Whether a notice is the picnic badge's (the server sends it the first time you sit on a blanket in an outage). */
export const isGrassNotice = (text: string | undefined): boolean => !!text && text.includes("Touched grass");

// MARK: The tip jar

/** The server's answer to a toss that landed (`toss` in `server/src/actors/world.ts`). */
export const tossLanded = (notice: string | undefined): boolean => !!notice && notice.startsWith("⛲ Plink");

// MARK: Name-tag chips

export interface TagChips {
  badges: { emoji: string; title: string; frame?: Frame }[];
  trophies: { emoji?: string; title: string }[];
}

/** A player's showcase pins as the name tag's chips: badges with their frame, trophies in gold. */
export function chipsOf(pins: readonly PinView[]): TagChips {
  const out: TagChips = { badges: [], trophies: [] };
  for (const p of pins) {
    if (p.kind === "badge")
      out.badges.push({ emoji: p.emoji ?? "🏅", title: p.name, frame: p.frame ?? undefined });
    else if (p.kind === "trophy") out.trophies.push({ emoji: p.emoji ?? undefined, title: p.name });
  }
  return out;
}

export interface ShowcaseOptions {
  /** Asks the server for one player's pins. */
  fetch: (id: number) => Promise<readonly PinView[]>;
  /** Minimum ms between two requests. */
  every?: number;
  /** How long an answer is kept. */
  ttl?: number;
  /** How long a failure is left alone. */
  backoff?: number;
  max?: number;
}

/**
 * Other players' showcases, for their name tags: asked one at a time, a few a second at most, only for
 * people the renderer says are close, kept for a while. Bots have no card, so they are never asked.
 */
export class ShowcaseCache {
  private readonly known = new Map<number, { at: number; chips: TagChips; key: string }>();
  private readonly failed = new Map<number, number>();
  private busy = false;
  private lastAt = -Infinity;
  private readonly o: Required<Omit<ShowcaseOptions, "fetch">> & Pick<ShowcaseOptions, "fetch">;

  constructor(o: ShowcaseOptions) {
    this.o = { every: 800, ttl: 10 * 60_000, backoff: 60_000, max: 200, ...o };
  }

  /** What is known for `id` (null until the answer is in); `key` changes when it does. */
  get(id: number): { chips: TagChips; key: string } | null {
    return this.known.get(id) ?? null;
  }

  /** Called every frame with someone who is close and has no fresh answer: starts a request when it is time. */
  want(id: number, now: number): void {
    if (id <= 0 || this.busy || now - this.lastAt < this.o.every) return;
    const k = this.known.get(id);
    if (k && now - k.at < this.o.ttl) return;
    if (now - (this.failed.get(id) ?? -Infinity) < this.o.backoff) return;
    this.busy = true;
    this.lastAt = now;
    this.o
      .fetch(id)
      .then((pins) => {
        const chips = chipsOf(pins);
        if (this.known.size >= this.o.max) this.known.delete(this.known.keys().next().value!);
        this.known.set(id, { at: now, chips, key: pins.map((p) => `${p.id}:${p.frame ?? ""}`).join() });
      })
      .catch(() => this.failed.set(id, now))
      .finally(() => {
        this.busy = false;
      });
  }
}

// MARK: The jukebox

/** The sign over the jukebox: the track, who put it on and the skip votes, or an invitation. */
export function jukeboxSign(
  now: { byName: string; votes: number; need: number } | null,
  track: string | null,
): string {
  if (!now || !track) return "🎵 Jukebox · pick a track";
  return `${track} · on by ${now.byName} · ⏭ ${now.votes}/${now.need}`;
}

// MARK: The Tavern at night

/** How much the room dims: blue at night, brown at dusk (`lightTavern` in the 2D game's `tavern.ts`). */
export const tavernDim = (dark: number, dusk: number): number => Math.min(0.7, dark * 0.66 + dusk * 0.45);

// MARK: Effects per tier

/** Emoji bursts alive at once, from the tier's particle density (0 to 1): each is ten DOM nodes. */
export const burstCap = (density: number): number =>
  Math.max(2, Math.round(10 * Math.min(1, Math.max(0, density))));
