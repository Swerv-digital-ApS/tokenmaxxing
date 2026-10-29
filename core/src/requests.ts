/**
 * The Tavern's request pile: a board where anyone writes down something they'd like in the game, and
 * everyone can add a 👍. People who build the game read it, sort it by votes and mark what they take on.
 * Free and cosmetic; the rules are here, `server/src/town/requests.ts` keeps them.
 */

export const REQUEST_MIN = 8;
export const REQUEST_MAX = 280;
/** Open requests one player can have on the pile at once. */
export const OPEN_CAP = 5;
/** Between one player's requests. */
export const POST_GAP_MS = 60_000;
/** How many of the pile one read returns: all that are live, then the latest finished ones. */
export const LIVE_CAP = 100;
export const DONE_SHOWN = 10;

export const REQUEST_STATUSES = ["open", "planned", "done", "declined"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const STATUS_LABEL: Record<RequestStatus, string> = {
  open: "Open",
  planned: "Planned",
  done: "Done",
  declined: "Not now",
};

export const isStatus = (v: unknown): v is RequestStatus =>
  typeof v === "string" && (REQUEST_STATUSES as readonly string[]).includes(v);

/** One request as the board shows it. */
export interface RequestEntry {
  id: number;
  userId: number;
  name: string;
  text: string;
  status: RequestStatus;
  votes: number;
  /** I gave it a 👍. */
  voted: boolean;
  createdAt: number;
}

/** Planned first, then open by votes (newest among equals), then what's done or turned down. */
const RANK: Record<RequestStatus, number> = {
  planned: 0,
  open: 1,
  done: 2,
  declined: 3,
};
export const byPile = (a: RequestEntry, b: RequestEntry): number =>
  RANK[a.status] - RANK[b.status] ||
  (a.status === "open" || a.status === "planned" ? b.votes - a.votes : 0) ||
  b.createdAt - a.createdAt;
