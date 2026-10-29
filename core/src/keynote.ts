/**
 * The keynote watch party: while a big AI launch event is live (OpenAI DevDay, Google I/O, an Anthropic
 * event), the Tavern pulls down a projector screen over the stage with the event and a link to its stream,
 * the town's characters come in to cheer, and whoever drops in gets a badge. Before it, a poster on the
 * same wall and the barkeep say what's coming and when.
 * Nothing can tell for free that a livestream is on, so an admin schedules them (`/admin`, the `keynotes`
 * table in `town`). `world` holds the list and sends it; live or not is the clock's, so every client agrees
 * without the server ticking anything.
 */
import { findProvider, PROVIDERS } from "./launch.ts";
import { pad2, worldWall } from "./range.ts";
import { copenhagenDay } from "./tavern.ts";
import { DIRS, type Facing } from "./world.ts";

/** One scheduled event: who hosts it, when it runs (epoch ms) and where to watch it. */
export interface Keynote {
  id: number;
  title: string;
  /** Who's presenting ("OpenAI", "Google", "Anthropic"): free text, coloured when it's a known provider. */
  host: string;
  startsAt: number;
  endsAt: number;
  /** The livestream: always an https link. */
  url: string;
}

export type KeynoteInput = Omit<Keynote, "id">;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** The poster goes up, and the barkeep starts talking about it, this long before. */
export const ANNOUNCE_MS = 7 * DAY;
/** No keynote runs longer than this: a typo in the end date shouldn't keep the screen down for a week. */
export const MAX_RUN_MS = 12 * HOUR;
/** How far ahead one can be scheduled. */
export const MAX_AHEAD_MS = 365 * DAY;
export const TITLE_MAX = 80;
export const HOST_MAX = 32;
export const URL_MAX = 300;

/** The scheduled keynotes `world` keeps and sends: at most this many, soonest first. */
export const KEYNOTES_SENT = 20;

/** The ones still to come or running at `now`, soonest first: what `world` keeps and sends. */
export const upcoming = (list: readonly Keynote[], now: number): Keynote[] =>
  list
    .filter((k) => k.endsAt > now)
    .sort((a, b) => a.startsAt - b.startsAt || a.id - b.id)
    .slice(0, KEYNOTES_SENT);

/** The keynote on at `now` (the one that started first, if two overlap), or null. */
export const liveKeynote = (list: readonly Keynote[], now: number): Keynote | null =>
  upcoming(list, now).find((k) => k.startsAt <= now) ?? null;

/** The next one to start within `ANNOUNCE_MS` of `now`, for the poster and the barkeep, or null. */
export const nextKeynote = (list: readonly Keynote[], now: number): Keynote | null =>
  upcoming(list, now).find((k) => k.startsAt > now && k.startsAt - now <= ANNOUNCE_MS) ?? null;

/** What the Tavern's west wall shows at `now`: the screen while one is live, else a poster for the next. */
export function screenOf(
  list: readonly Keynote[],
  now: number,
): { live: true; keynote: Keynote } | { live: false; keynote: Keynote } | null {
  const live = liveKeynote(list, now);
  if (live) return { live: true, keynote: live };
  const next = nextKeynote(list, now);
  return next ? { live: false, keynote: next } : null;
}

/** What the Tavern's characters know of it at `now`, for their lines (`lineFor`): the one on, or the next one. */
export function keynoteTalk(
  list: readonly Keynote[],
  now: number,
): { title: string; when: string; live: boolean } | undefined {
  const s = screenOf(list, now);
  return s ? { title: s.keynote.title, when: whenText(s.keynote.startsAt, now), live: s.live } : undefined;
}

/** Whether two lists look the same to a player: nothing to send when they do. */
export const sameKeynotes = (a: readonly Keynote[], b: readonly Keynote[]): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/** A launch stand's colour for a host it knows ("OpenAI", "Anthropic", "xAI"), else the Tavern's red. */
export function hostAccent(host: string): string {
  const key = host.toLowerCase().replace(/[^a-z0-9]/g, "");
  const p = findProvider(host) ?? PROVIDERS.find((q) => q.openrouter.replace(/[^a-z0-9]/g, "") === key);
  return p?.accent ?? "#c4544b";
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "19:00" on the world's clock. */
export function clockAt(at: number): string {
  const w = worldWall(at);
  return `${pad2(w.hour)}:${pad2(w.minute)}`;
}

/** "Tue 14 Oct, 19:00" on the world's clock. */
export function dateAt(at: number): string {
  const w = worldWall(at);
  return `${WEEKDAYS[w.weekday]!.slice(0, 3)} ${w.d} ${MONTHS[w.m - 1]}, ${clockAt(at)}`;
}

/** When it starts, as the barkeep says it: "today at 19:00", "tomorrow at 19:00", "on Tuesday at 19:00", "on 14 Oct at 19:00". */
export function whenText(at: number, now: number): string {
  const days = copenhagenDay(new Date(at)) - copenhagenDay(new Date(now));
  const w = worldWall(at);
  const day =
    days <= 0
      ? "today"
      : days === 1
        ? "tomorrow"
        : days < 7
          ? `on ${WEEKDAYS[w.weekday]}`
          : `on ${w.d} ${MONTHS[w.m - 1]}`;
  return `${day} at ${clockAt(at)}`;
}

/** "in 3 days", "in 5 h", "in 25 min", "any minute": how long till `at`. */
export function startsIn(at: number, now: number): string {
  const min = Math.ceil((at - now) / 60_000);
  if (min <= 1) return "any minute";
  if (min < 60) return `in ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `in ${h} h`;
  return `in ${Math.round(min / (24 * 60))} days`;
}

/** The sign over the screen, or by the poster. */
export const signOf = (s: NonNullable<ReturnType<typeof screenOf>>, now: number): string =>
  s.live ? `🔴 LIVE · ${s.keynote.title}` : `📽️ ${s.keynote.title} · ${whenText(s.keynote.startsAt, now)}`;

// MARK: In the Tavern

/**
 * The screen: the west wall beside the stage (`inn` map tiles x 0, y 10 to 14, all wall). E on it from the
 * stage, or a click on its sign, opens the keynote panel. It isn't on the map, so the 2D and 3D rooms keep
 * the same tiles.
 */
export const SCREEN = { x: 0, y: 10, h: 5 } as const;

export const isScreen = (x: number, y: number): boolean =>
  x === SCREEN.x && y >= SCREEN.y && y < SCREEN.y + SCREEN.h;

/** Whether someone at (x, y) facing `facing` in the Tavern is looking at the screen. */
export const facesScreen = (x: number, y: number, facing: Facing): boolean =>
  isScreen(x + DIRS[facing][0], y + DIRS[facing][1]);

/** Where the town's characters stand to watch, facing the screen (`inn` floor tiles in front of the stage). */
export const CROWD: readonly [number, number][] = [
  [4, 11],
  [4, 13],
  [3, 12],
  [5, 12],
  [3, 10],
  [5, 10],
];

/** The badge's key in `rewards`: one per player per keynote. */
export const keynoteReward = (id: number): string => `keynote:${id}`;

/** Shouted at the screen while it's on, by anyone without lines of their own for it. */
export const CHEERS = [
  "🎉🎉🎉",
  "👏👏👏",
  "Ship it!",
  "One more thing…",
  "Benchmarks! 📈",
  "Demo gods, be kind 🙏",
  "Bigger context window! 🤯",
  "Take my tokens!",
  "A live demo? Brave.",
  "Is it out today?!",
  "Pricing slide, please. PRICING.",
  "Wooo! 🙌",
];

const SAMPLE_STREAM = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

/**
 * `?keynote=` in the page, for screenshots: `live` (or `live:OpenAI DevDay`) is one on now, `soon` (or
 * `soon:Google I/O`) one tomorrow evening, `off` none. Undefined: not forced, and the server's list decides.
 * Only the page: the bots and the badge follow the server's list.
 */
export function forcedKeynotes(raw: string | null | undefined, now: number): Keynote[] | undefined {
  const v = raw?.trim();
  if (!v) return undefined;
  const [mode = "", ...rest] = v.split(":");
  const title = rest.join(":").trim();
  if (mode.toLowerCase() === "off") return [];
  if (mode.toLowerCase() === "live")
    return [
      {
        id: -1,
        title: title || "OpenAI DevDay",
        host: "OpenAI",
        startsAt: now - 20 * 60_000,
        endsAt: now + 100 * 60_000,
        url: SAMPLE_STREAM,
      },
    ];
  if (mode.toLowerCase() === "soon")
    return [
      {
        id: -1,
        title: title || "Google I/O",
        host: "Google",
        startsAt: now + DAY,
        endsAt: now + DAY + 2 * HOUR,
        url: SAMPLE_STREAM,
      },
    ];
  return undefined;
}
