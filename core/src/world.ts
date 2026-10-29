/**
 * The world's rules and wire types, shared by the `world` actor and the game
 * client. Everything here is pure so it can be tested without Rivet.
 */

import { isRecord, isTruthy, typedKeys } from "hanzio";
import { caseAt } from "./case.ts";
import { costumeAt } from "./costumes.ts";
import { editionAt } from "./editions.ts";
import type { Angling, Landing } from "./fishing.ts";
import type { Seat, Spot } from "./games/gather.ts";
import type { BoardRow, GameId } from "./games/types.ts";
import { LOOT_COUNT, LOOT_FIRST } from "./loot.ts";
import { blockOf, doorOf, type GameMap, LEGEND, MAPS, type MapId, plotId, TOWN_SPAWN } from "./maps.ts";
import {
  canHang,
  type Door,
  doorAt,
  HQS,
  OFFICE_MAPS,
  type OfficeTier,
  PASSAGE_W,
  PASSAGE_X,
  type Piece,
  pieceOf,
  type Rot,
  rotOf,
  tilesOf,
  withPieces,
} from "./office.ts";
import { cleanPetName, MAX_PET_LOOKS, petLooks } from "./pets.ts";
import { itemById } from "./shop.ts";
import { SHOP_DOOR_CHAR, SHOP_IDS, SHOP_ROOM, type ShopId, shopOfRoom } from "./shoprooms.ts";
import type { Weather } from "./sky.ts";
import { TAVERN } from "./tavern.ts";
import { WARDROBE_OPTIONS } from "./wardrobe.ts";

export const TILE = 16;
/** Client animation time per step; the server only enforces the running pace. */
export const WALK_STEP_MS = 220;
export const RUN_STEP_MS = 130;
/** A hop on Space: how long it's in the air, and the fastest the server passes them on. */
export const JUMP_MS = 360;
/** How often the world sends batched moves. */
export const TICK_MS = 100;
/** Connected but no input this long → dozing where they stand (only going offline sends them to bed). */
export const IDLE_MS = 3 * 60_000;
/** Offline and agents active this recently → working at a desk. */
export const WORKING_MS = 10 * 60_000;
export const CHAT_MAX_LENGTH = 280;
/** A bio on the player card: one line. */
export const BIO_MAX_LENGTH = 120;
export const CHAT_HISTORY = 50;
export const COMPANY_CAP = 50;

export type Facing = "up" | "down" | "left" | "right";
/** `playing`: at a game table in town, until the match ends (see core/src/games/gather.ts). */
export type PlayerState = "idle" | "sit" | "away" | "working" | "playing";
export type RoomId =
  | "town"
  | "inn"
  | "upstairs"
  | "basement"
  | "dungeon"
  | "shop-furniture"
  | "shop-clothes"
  | "shop-barber"
  | "shop-pets"
  | "shop-natmarked"
  | "shop-market"
  | `hq:${number}`
  | `common:${number}`
  | `office:${number}`;

const FIXED_ROOMS: readonly string[] = [
  "town",
  "inn",
  "upstairs",
  "basement",
  "dungeon",
  "shop-furniture",
  "shop-clothes",
  "shop-barber",
  "shop-pets",
  "shop-natmarked",
  "shop-market",
];

/** A room id from the wire, or null: one of the fixed rooms, or a company's house or common room, or an office. */
export function parseRoom(raw: unknown): RoomId | null {
  if (typeof raw !== "string") return null;
  return FIXED_ROOMS.includes(raw) || /^(hq|common|office):[1-9]\d{0,9}$/.test(raw) ? (raw as RoomId) : null;
}

export const DIRS: Record<Facing, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};
export const isFacing = (v: unknown): v is Facing => typeof v === "string" && v in DIRS;

export const companyOfRoom = (room: RoomId): number | null =>
  room.startsWith("hq:") ? Number(room.slice(3)) : null;
/** The company whose common room (upstairs from its house, `MAPS.common`) this is. */
export const commonOfRoom = (room: RoomId): number | null =>
  room.startsWith("common:") ? Number(room.slice(7)) : null;
/** The company a room belongs to, house or common room: who may be in it, and whose furniture goes in it. */
export const memberRoomOf = (room: RoomId): number | null => companyOfRoom(room) ?? commonOfRoom(room);
export const ownerOfOffice = (room: RoomId): number | null =>
  room.startsWith("office:") ? Number(room.slice(7)) : null;

/** Every office is its owner's size and decor (its furniture is its drops); a building nobody has built is the bare floor. */
export function baseMap(room: RoomId): GameMap {
  const owner = ownerOfOffice(room);
  if (owner !== null) return OFFICE_MAPS.get(owner) ?? MAPS.office;
  const company = companyOfRoom(room);
  if (company !== null) return HQS.get(company) ?? MAPS.hq;
  return commonOfRoom(room) !== null ? MAPS.common : MAPS[room as MapId];
}

/**
 * A room's map, with the furniture dropped in it written over the floor (other drops aren't in it). Kept
 * until its furniture or its own map change, so a dropped hat or pet leaves it as it is.
 */
export function mapOf(room: RoomId): GameMap {
  const base = baseMap(room);
  const hit = dropped.get(room);
  if (hit?.base === base) return hit.map;
  const pieces = piecesIn(DROPS.get(room) ?? []);
  const map = pieces.length ? withPieces(pieces, base) : base;
  dropped.set(room, { base, map, key: JSON.stringify(pieces) });
  return map;
}

/** The furniture among `drops`, as pieces of a map. */
export const piecesIn = (drops: readonly Drop[]) =>
  drops.flatMap((d) => {
    const piece = pieceOfDrop(d);
    return piece ? [{ ch: piece.ch, x: d.x, y: d.y, ...(d.rot && { rot: d.rot }) }] : [];
  });

// MARK: Drops

/** An item on a room's floor: `id` is its `items` row, `by` who dropped it. */
export interface Drop {
  id: number;
  item: string;
  room: RoomId;
  x: number;
  y: number;
  by: number;
  at: number;
  /** The company it belongs to: bought from its wallet, it stays in its building (`COMPANY_FURNITURE`). */
  co?: number;
  /** How far a piece of furniture is turned, in quarter turns (F, `canTurn`); left out for 0. */
  rot?: Rot;
}

/** What's on each room's floor. ponytail: one process holds every room's, like the town. */
export const DROPS = new Map<RoomId, readonly Drop[]>();
const dropped = new Map<RoomId, { base: GameMap; map: GameMap; key: string }>();

export function setDrops(room: RoomId, drops: readonly Drop[]): void {
  DROPS.set(room, drops);
  if (dropped.get(room)?.key !== JSON.stringify(piecesIn(drops))) dropped.delete(room);
}

/** A dropped piece of furniture (`furn.<ch>`); wearables and pets lie on the floor as themselves. */
export const pieceOfDrop = (d: Pick<Drop, "item">): Piece | undefined =>
  d.item.startsWith("furn.") ? pieceOf(d.item.slice(5)) : undefined;

/** What it is: "Sofa", "Duck". */
export const dropName = (d: Pick<Drop, "item">): string => itemById(d.item)?.name ?? "Something";

/**
 * The piece of furniture G takes and M moves for someone: one of theirs (their office's, their company's),
 * the one they are on, else the one they face, whether it blocks, seats or is a rug.
 */
export function ownPieceAt(
  room: RoomId,
  at: { x: number; y: number; facing: Facing },
  drops: readonly Drop[],
  userId: number,
  companyId: number | null,
): Drop | undefined {
  const owner = ownerOfOffice(room);
  const mine = (d: Drop) =>
    pieceOfDrop(d) !== undefined && (d.co !== undefined ? d.co === companyId : owner === userId);
  const [dx, dy] = DIRS[at.facing];
  return (
    drops.find((d) => mine(d) && dropCovers(d, at.x, at.y)) ??
    drops.find((d) => mine(d) && dropCovers(d, at.x + dx, at.y + dy))
  );
}

/** The tiles a drop covers: a TV is two, along its row, or down its column when turned sideways. */
export const dropTiles = (d: Drop): [number, number][] => tilesOf(d.x, d.y, pieceOfDrop(d)?.w ?? 1, d.rot);

/** Whether a drop lies on (x, y). */
export const dropCovers = (d: Drop, x: number, y: number): boolean =>
  dropTiles(d).some(([tx, ty]) => tx === x && ty === y);

// MARK: Looks

export interface Look {
  style: number;
  skin: number;
  hair: number;
  /** Free below `FREE_OUTFITS` (shop.ts), bought above. */
  outfit: number;
  /** Shop extras; 0 is none. */
  glasses: number;
  hat: number;
  pet: number;
  /** Wardrobe extras (wardrobe.ts); 0 is none. */
  held: number;
  back: number;
  /** A worn effect around them (the Night Market case's legendary auras, `case.ts`); absent or 0 is none. */
  aura?: number;
  petwear: number;
  /** Which look of the worn pet: 0 is the original, n is `PET_VARIANTS[pet][n - 1]`. Always 0 without a pet. */
  petVariant: number;
  /** What the pet is called (`cleanPetName`); left out when it has none. */
  petName?: string;
  /** Whose company merch they wear (a company id), 0 for none; `merchWorn` says which (`MERCH` bits). */
  merch: number;
  merchWorn: number;
}
export const LOOK_OPTIONS: Record<Exclude<keyof Look, "merch" | "petName" | "aura">, number> = {
  style: 4,
  skin: 4,
  hair: 6,
  outfit: LOOT_FIRST.outfit + LOOT_COUNT.outfit,
  glasses: LOOT_FIRST.glasses + LOOT_COUNT.glasses,
  hat: LOOT_FIRST.hat + LOOT_COUNT.hat,
  pet: LOOT_FIRST.pet + LOOT_COUNT.pet,
  held: WARDROBE_OPTIONS.held,
  back: WARDROBE_OPTIONS.back,
  petwear: WARDROBE_OPTIONS.petwear,
  petVariant: MAX_PET_LOOKS,
  merchWorn: 16,
};
/** Looks saved before the shop (or before the wardrobe, merch or pet looks) have no extras. */
const EXTRAS = {
  glasses: 0,
  hat: 0,
  pet: 0,
  held: 0,
  back: 0,
  petwear: 0,
  petVariant: 0,
  merch: 0,
  merchWorn: 0,
};
/** A look from its base and whichever extras it has; the rest are none. */
export const lookWith = ({
  style,
  skin,
  hair,
  outfit,
  ...extras
}: Pick<Look, "style" | "skin" | "hair" | "outfit"> & Partial<Look>): Look => ({
  style,
  skin,
  hair,
  outfit,
  ...EXTRAS,
  ...extras,
});
export const STYLE_NAMES = ["Short hair and tee", "Cap and hoodie", "Bun and jacket", "Long hair and skirt"];

export function parseLook(raw: unknown): Look | null {
  if (!isRecord(raw)) return null;
  const r: Record<string, unknown> = { ...EXTRAS, ...raw };
  const out = {} as Look;
  for (const k of typedKeys(LOOK_OPTIONS)) {
    const v = r[k];
    if (!Number.isInteger(v) || (v as number) < 0) return null;
    if (
      (v as number) >= LOOK_OPTIONS[k] &&
      !editionAt(k, v as number) &&
      !costumeAt(k, v as number) &&
      !caseAt(k, v as number)
    )
      return null;
    out[k] = v as number;
  }
  if (out.petVariant >= petLooks(out.pet)) return null;
  // Old looks have no name; a bad one refuses the look, like a bad number.
  if (r.petName !== undefined && r.petName !== "") {
    const name = cleanPetName(r.petName);
    if (!name) return null;
    out.petName = name;
  }
  // Old looks have no aura, and a look without one is saved without the field. Nothing sells one: only the case's indices count.
  if (r.aura !== undefined && r.aura !== 0) {
    if (!Number.isInteger(r.aura) || !caseAt("aura", r.aura as number)) return null;
    out.aura = r.aura as number;
  }
  if (!Number.isSafeInteger(r.merch) || (r.merch as number) < 0) return null;
  out.merch = r.merch as number;
  // A hoodie goes over a tee, so wearing both is wearing the hoodie: one look, whichever way it was saved.
  if (out.merchWorn & 2) out.merchWorn &= ~1;
  // Nothing worn is no merch, so two looks that draw the same are the same.
  if (out.merch === 0 || out.merchWorn === 0) Object.assign(out, { merch: 0, merchWorn: 0 });
  return out;
}

/** A stable starting look, so a new player isn't a clone of everyone else. */
export function defaultLook(seed: number): Look {
  const n = Math.abs(Math.imul(seed + 1, 2654435761));
  return lookWith({
    style: n % LOOK_OPTIONS.style,
    skin: (n >>> 3) % LOOK_OPTIONS.skin,
    hair: (n >>> 6) % LOOK_OPTIONS.hair,
    outfit: (n >>> 9) % 8,
  });
}

// MARK: Wire types

/** Who someone is. Sent once per room entry and whenever it changes. */
export interface PlayerInfo {
  id: number;
  name: string;
  look: Look;
  level: number;
  companyId: number | null;
  todayTokens: number;
  /** Agents that ran in the last 10 minutes. */
  liveAgents: number;
  online: boolean;
  /** When their coffee wears off (epoch ms); see `drinkCoffee`. */
  coffeeUntil: number;
  /** When their pølse wears off (epoch ms); see `POLSE` in `street.ts`. */
  polseUntil: number;
  /** When the Tavern's special wears off (epoch ms); see `SPECIAL`. Absent from older servers: 0. */
  specialUntil?: number;
  /** Online but no input for `IDLE_MS`: snoozing in place. */
  dozing: boolean;
  /** The desk setup they chose (a tier in `DESKS`, desks.ts). Absent from older servers: the laptop. */
  desk?: number;
  /** The dance they're doing (`DANCES` in dances.ts), 0 for none, since `danceSince` (epoch ms). Absent from older servers: none. */
  dance?: number;
  danceSince?: number;
  /** Their line in the pond, if they're fishing (`fishing.ts`). Absent from older servers: none. */
  angling?: Angling | null;
  /** Their last catch, held up for `LANDED_MS` from its `at`. Absent from older servers: none. */
  landing?: Landing | null;
}

/**
 * Someone with agents running right now. The dungeon seats them at a war desk wherever they really are
 * (asleep, in town, offline), firing at the boss as fast as they burn tokens.
 */
interface Raider {
  id: number;
  name: string;
  look: Look;
  /** Agents that ran in the last 10 minutes: the first is them, the rest their robot minions. */
  agents: number;
  /** Tokens a minute over the 10 minutes before their last sync, fading out as that sync gets old. */
  burn: number;
  /** The desk setup they chose (a tier in `DESKS`): their war desk wears it. Absent from older servers: the laptop. */
  desk?: number;
}

/** The dungeon's raiders: the busiest `RAIDERS_SHOWN`, and how many more there are. */
export interface Raiders {
  top: Raider[];
  more: number;
}

/** As many raiders as the dungeon has war desks. */
export const RAIDERS_SHOWN = 40;

/** A line from `town` for one player (`notice`), and the panel a click on it opens. */
export interface Notice {
  text: string;
  open?: "company" | "trades" | "bag" | "quests" | "hallOfFame" | "collection" | "tournament" | "market";
}

/** Where someone is: `[id, x, y, facing, state]`. */
export type PlayerPos = [number, number, number, Facing, PlayerState];

export interface PlayerView extends PlayerInfo {
  x: number;
  y: number;
  facing: Facing;
  state: PlayerState;
}

/** A company's house colours (`#rrggbb`) and logo, picked from its website. */
export interface Brand {
  roof: string;
  wall: string;
  /** Door and window frames. */
  trim: string;
  /** Behind the logo. */
  plaque: string;
  /** Same-origin path, e.g. `/logos/3.png?v=k2x9`. */
  logo: string | null;
}

/** The print on a company's merch, drawn by its people: two colours and a small pixel grid. */
export interface MerchDesign {
  /** The shirt, cap and mug (`#rrggbb`). */
  main: string;
  /** The `a` pixels. */
  accent: string;
  /** `MERCH_PRINT_H` rows of `MERCH_PRINT_W` characters: `.` bare, `a` accent, `w` white, `k` dark. */
  rows: string[];
}

export const MERCH_PRINT_W = 8;
export const MERCH_PRINT_H = 6;

const HEX = /^#[0-9a-f]{6}$/i;

/** A merch design from anything the wire hands over, or null if it isn't one. */
export function parseMerchDesign(raw: unknown): MerchDesign | null {
  const r = raw as Partial<MerchDesign> | null;
  if (typeof r !== "object" || r === null) return null;
  const { main, accent, rows } = r;
  if (typeof main !== "string" || !HEX.test(main) || typeof accent !== "string" || !HEX.test(accent))
    return null;
  if (!Array.isArray(rows) || rows.length !== MERCH_PRINT_H) return null;
  const grid = new RegExp(`^[.awk]{${MERCH_PRINT_W}}$`);
  if (!rows.every((row) => typeof row === "string" && grid.test(row))) return null;
  return { main: main.toLowerCase(), accent: accent.toLowerCase(), rows: [...rows] };
}

export interface CompanyInfo {
  id: number;
  name: string;
  plot: number;
  members: number;
  todayTokens: number;
  tokens30d: number;
  /** Bare host, e.g. `acme.com`. */
  website: string | null;
  brand: Brand | null;
  /** What its people drew for its merch; absent or null is its colours and initials. */
  merch?: MerchDesign | null;
  /** The house-wide desk tier the wallet bought (`DESKS`). Absent from older servers: the laptop. */
  deskFleet?: number;
}

export interface ChatLine {
  id: number;
  room: RoomId;
  userId: number;
  name: string;
  text: string;
  at: number;
}

/** Someone inside a company house, as seen through its walls from town. */
export interface Peek {
  id: number;
  name: string;
  level: number;
  look: Look;
  /** Asleep (`away`), at a desk (`working`), or up and about. */
  state: PlayerState;
}

/** Who is inside each company house, by company id. */
export type Houses = Record<number, Peek[]>;

/** `@name` in chat: the same handle rules as sign-up names. */
const MENTION_RE = /@([a-z0-9][a-z0-9._-]{1,31})/gi;

/** Lowercased names mentioned in `text`, each once. */
export const mentionsIn = (text: string): string[] => [
  ...new Set([...text.matchAll(MENTION_RE)].map((m) => m[1]!.toLowerCase())),
];

/** Names in an invite field like "@ada bo, @cy": with or without the @. */
export const namesIn = (text: string): string[] => [
  ...new Set(
    text
      .split(/[\s,]+/)
      .map((s) => s.replace(/^@/, "").toLowerCase())
      .filter(isTruthy),
  ),
];

export interface Snapshot {
  room: RoomId;
  selfId: number;
  /** Everyone in the room except those counted in `asleep`. */
  players: PlayerView[];
  /** Offline players asleep here, as a head count: only the Inn has any (see `world.ts`). */
  asleep: number;
  companies: CompanyInfo[];
  occupancy: Partial<Record<RoomId, number>>;
  chat: ChatLine[];
  /** Only in town: who is inside each house. */
  houses: Houses;
  /** Company buildings with an active worker in a private office. */
  officeLights?: number[];
  /** Games being played in town, with their tables or arenas. */
  games: WorldGame[];
  /** Only in an office: whose it is (for the banner). */
  owner: { id: number; name: string; tier: OfficeTier; wall?: string; floor?: string } | null;
  /** Only in a building: its office doors, to build the map and draw the names. */
  doors: Door[];
  /** What's on the floor: furniture (in the map too), wearables and pets. */
  drops: Drop[];
  /** The weather over Copenhagen; later changes arrive as the `weather` event. */
  weather: Weather;
  /** Only with `SKY_SEASON` set (dev and screenshots): the day of the year the town's season is pinned to. */
  seasonDay?: number;
  /** Only in the dungeon: who has agents running, wherever they are. */
  raiders: Raiders | null;
}

/** A game on show in town: where its table (or arena) is, who's at it, and how it's going. */
export interface WorldGame {
  id: number;
  game: GameId;
  spot: Spot;
  players: number[];
  /** Where each player sits, in `players` order. */
  seats: Seat[];
  /** The short status over each player's head ("🪂 ×3.1"). */
  status: Record<number, string | null>;
  /** The live scoreboard, for games that have one (Tokenmaxxing). */
  board: BoardRow[] | null;
  watchers: number;
  /** How it's going ("Round 3 · 2–1"). */
  headline: string | null;
  /** When it ends, for a countdown. */
  endsAt: number | null;
}

/** What a match tells the world about itself, after every change. */
export type GameStatus = Pick<WorldGame, "status" | "board" | "watchers" | "headline" | "endsAt">;

/** One tick's changes in a room. */
export interface Moves {
  room: RoomId;
  join: PlayerView[];
  m: PlayerPos[];
  leave: number[];
  /** The room's new `asleep` count, when it changed. */
  asleep?: number;
}

/** What `step` answers when it didn't simply move you. */
export type StepResult =
  null | { notice: string } | { x: number; y: number; facing: Facing; state: PlayerState; room: RoomId };

// MARK: Houses

/** Minimum tokens per member over the last 30 days for each house. */
const TIERS = [
  { name: "Basement", min: 0 },
  { name: "Shack", min: 100e6 },
  { name: "Cottage", min: 1e9 },
  { name: "House", min: 5e9 },
  { name: "Villa", min: 15e9 },
  { name: "Mansion", min: 40e9 },
] as const;
export const HOUSE_TIERS = TIERS.length;

/** Tokens per member over the last 30 days: what a company's house is built from. */
export const perMember = (tokens30d: number, members: number): number => tokens30d / Math.max(1, members);

/**
 * A company's house reflects how hard its people push, not how many there are:
 * a big team of light users lives in a basement, two heavy users in a mansion.
 */
export const houseTier = (tokens30d: number, members: number): number =>
  TIERS.findLastIndex((t) => perMember(tokens30d, members) >= t.min);
export const houseTierName = (tier: number): string => TIERS[tier]?.name ?? TIERS[0].name;
export const nextTierAt = (tier: number): number | null => TIERS[tier + 1]?.min ?? null;

// MARK: Coffee

/** How long one cup keeps you shaking. Cups stack, up to `MAX_CUPS` in your system at once. */
export const CUP_MS = 90_000;
export const MAX_CUPS = 6;

/** Another cup: adds `CUP_MS` to whatever is still in your system. */
export const drinkCoffee = (until: number, now: number): number =>
  Math.min(Math.max(until, now) + CUP_MS, now + MAX_CUPS * CUP_MS);

/** Cups still in your system (fractional, wearing off): how hard you shake. */
export const cupsLeft = (until: number, now: number): number => Math.max(0, until - now) / CUP_MS;

// MARK: Movement

/** Steps allowed in a burst: covers network jitter bunching up a few steps. */
export const STEP_BURST = 4;

/**
 * A token bucket that refills at running pace (times `pace`: a pølse makes it quicker). Returns the
 * new budget, or null when the step comes too fast.
 */
export function takeStep(budget: number, lastAt: number, now: number, pace = 1): number | null {
  const refilled = Math.min(STEP_BURST, budget + (now - lastAt) / (RUN_STEP_MS * 0.8 * pace));
  return refilled >= 1 ? refilled - 1 : null;
}

type StepTarget =
  | { kind: "move"; x: number; y: number }
  | { kind: "portal"; ch: string; x: number; y: number }
  | { kind: "blocked" };

/** One step from (x, y). Seats and furniture block; you can always step off a seat. */
export function stepTarget(map: GameMap, x: number, y: number, dir: Facing): StepTarget {
  const [dx, dy] = DIRS[dir];
  const nx = x + dx;
  const ny = y + dy;
  const kind = map.kind(nx, ny);
  if (kind.portal) return { kind: "portal", ch: map.at(nx, ny), x: nx, y: ny };
  return kind.walk ? { kind: "move", x: nx, y: ny } : { kind: "blocked" };
}

export interface Place {
  room: RoomId;
  x: number;
  y: number;
  facing: Facing;
}

export const townSpawn = (): Place => ({ room: "town", x: TOWN_SPAWN[0], y: TOWN_SPAWN[1], facing: "down" });

/** Where everyone without a company sleeps: upstairs at the Tavern, or in the Inn's own beds without one. */
export const DORM: RoomId = TAVERN ? "upstairs" : "inn";

/** Just inside a room's exit (`x`, or another portal char: the Tavern's stairs `S`), facing in. */
export function roomEntry(room: RoomId, ch = "x"): Place {
  const [x, y] = mapOf(room).find(ch)[0]!;
  return { room, x, y: y - 1, facing: "up" };
}

/** Just outside a town door (a company's plot, the Inn, or the dungeon's gate), facing away from it. */
export function outsideDoor(plot: number | "inn" | "dungeon" | ShopId): Place {
  const door =
    plot === "inn"
      ? MAPS.town.find("I")[0]!
      : plot === "dungeon"
        ? MAPS.town.find("G")[0]!
        : typeof plot === "string"
          ? MAPS.town.find(SHOP_DOOR_CHAR[plot])[0]
          : doorOf(plot);
  // A shop whose block a company holds has no door: back to the square.
  if (!door) return townSpawn();
  return { room: "town", x: door[0], y: door[1] + 1, facing: "down" };
}

/**
 * Where the portal at (x, y) takes you, or why it doesn't. `plots` maps a plot to the company holding
 * it; `doors` are your own company building's. An office door takes you to its owner's office (open or
 * closed is the world's to check); leaving an office puts you below its door in your own building, if
 * it has one, else at your building's entry.
 */
export function portal(
  room: RoomId,
  door: { ch: string; x: number; y: number },
  companyId: number | null,
  plots: ReadonlyMap<number, { id: number; name: string }>,
  doors: readonly Door[] = [],
): Place | { notice: string } {
  if (door.ch === "R") {
    // `doors` are your own building's: in anyone else's, none of them is here.
    const d = doorAt(doors, door.x, door.y);
    return d ? roomEntry(`office:${d.userId}`) : { notice: "That door isn't yours to open." };
  }
  const owner = ownerOfOffice(room);
  if (owner !== null) {
    if (companyId === null) return roomEntry("inn");
    const d = doors.find((d) => d.userId === owner);
    return d ? { room: `hq:${companyId}`, x: d.x, y: d.y + 1, facing: "down" } : roomEntry(`hq:${companyId}`);
  }
  if (room === "town") {
    if (door.ch === "I") return roomEntry("inn");
    if (door.ch === "G") return roomEntry("dungeon");
    const shop = SHOP_IDS.find((id) => SHOP_DOOR_CHAR[id] === door.ch);
    if (shop) return roomEntry(SHOP_ROOM[shop]);
    const holder = plots.get(plotId(...blockOf(door.x, door.y)));
    if (!holder) return { notice: "Nobody lives here any more." };
    if (holder.id !== companyId) return { notice: `🔒 ${holder.name}'s house. Members only.` };
    return roomEntry(`hq:${holder.id}`);
  }
  if (room === "inn")
    return door.ch === "S"
      ? roomEntry("basement")
      : door.ch === "u"
        ? roomEntry("upstairs")
        : outsideDoor("inn");
  if (room === "basement") return roomEntry("inn", "S");
  if (room === "upstairs") return roomEntry("inn", "u");
  if (room === "dungeon") return outsideDoor("dungeon");
  const leaving = shopOfRoom(room);
  if (leaving) return outsideDoor(leaving);
  // The common room is up the stairs `u` from the house, for its members only: the stairs down lead back.
  const common = commonOfRoom(room);
  if (common !== null) return roomEntry(`hq:${common}`, "u");
  const house = companyOfRoom(room);
  if (door.ch === "u" && house !== null)
    return house === companyId
      ? roomEntry(`common:${house}`)
      : { notice: "🔒 The common room is for members only." };
  const plot = [...plots].find(([, c]) => c.id === house)?.[0];
  return plot === undefined ? townSpawn() : outsideDoor(plot);
}

/** The room a player rests in: their company's house, or upstairs at the Tavern without one. */
export function homeRoom(companyId: number | null): RoomId {
  return companyId !== null ? `hq:${companyId}` : DORM;
}

/**
 * The first free bed (`away`) or desk chair (`working`) in `room`, then the
 * first free floor tile: every other one first, so neighbours' name labels don't
 * overlap, then the rest. `taken` holds `"x,y"` of spots already in use.
 */
export function restSpot(room: RoomId, state: "away" | "working", taken: ReadonlySet<string>): Place {
  const map = mapOf(room);
  const floor = map.find("_").filter(([, y]) => y >= 3);
  // A bed is two tiles deep: every bed gets one sleeper (the tile with no bed above it) before any gets two.
  const bedFirst = (spots: readonly (readonly [number, number])[]) => [
    ...spots.filter(([x, y]) => map.at(x, y - 1) !== "b"),
    ...spots.filter(([x, y]) => map.at(x, y - 1) === "b"),
  ];
  const spots = [
    ...(state === "away" ? bedFirst(map.find("b")) : map.find("c")),
    ...floor.filter(([x]) => x % 2 === 1),
    ...floor.filter(([x]) => x % 2 === 0),
  ];
  const free = spots.find(([x, y]) => !taken.has(`${x},${y}`)) ?? spots[0]!;
  return { room, x: free[0], y: free[1], facing: state === "working" ? "up" : "down" };
}

/** The ways to step, in the order a route tries them: a tie goes to the first. */
const FACINGS = typedKeys(DIRS);
const STEPS = FACINGS.map((f) => DIRS[f]);

/**
 * Shortest walk from `from` to `to` as steps (BFS over walkable tiles). The
 * target itself may be a door or seat: the last step walks into it. Null when
 * there's no way.
 */
export function route(map: GameMap, from: [number, number], to: [number, number]): Facing[] | null {
  const goal = map.index(...to);
  const start = map.index(...from);
  if (start === goal) return [];
  const size = map.width * map.height;
  // Per tile: the step that first reached it (-1 not yet), and the tile it came from.
  const step = new Int8Array(size).fill(-1);
  const prev = new Int32Array(size);
  if (start >= 0 && start < size) step[start] = FACINGS.length;
  const queueX = new Int32Array(size + 1);
  const queueY = new Int32Array(size + 1);
  queueX[0] = from[0];
  queueY[0] = from[1];
  for (let head = 0, tail = 1; head < tail; head++) {
    const x = queueX[head]!;
    const y = queueY[head]!;
    const k = map.index(x, y);
    for (let d = 0; d < STEPS.length; d++) {
      const nx = x + STEPS[d]![0];
      const ny = y + STEPS[d]![1];
      if (!map.contains(nx, ny)) continue;
      const nk = map.index(nx, ny);
      if (step[nk] !== -1) continue;
      if (nk !== goal && !map.walkable(nx, ny)) continue;
      step[nk] = d;
      prev[nk] = k;
      if (nk === goal) {
        const out: Facing[] = [];
        for (let at = goal; at !== start && prev[at] !== -1; at = prev[at]!) out.push(FACINGS[step[at]!]!);
        return out.reverse();
      }
      queueX[tail] = nx;
      queueY[tail++] = ny;
    }
  }
  return null;
}

/**
 * Whether putting `piece` down in an office would cut something off from its door: a desk, a seat, the
 * pet bed, a shelf or the piece itself that could be reached from the exit before. `map` has what is
 * already down. So the door, the desk and every seat stay reachable (`route` ends one step short).
 */
export function cutsOff(map: GameMap, piece: { ch: string; x: number; y: number; rot?: Rot }): boolean {
  const door = map.find("x")[0];
  if (!door) return false;
  const next = withPieces([piece], map);
  for (let y = map.y0; y < map.y0 + map.height; y++)
    for (let x = map.x0; x < map.x0 + map.width; x++) {
      const ch = map.at(x, y);
      if (ch === "W" || ch === "x" || map.walkable(x, y)) continue;
      if (route(next, door, [x, y]) === null && route(map, door, [x, y]) !== null) return true;
    }
  // The new piece must be reachable too, or nobody could read it or pick it up.
  for (const tile of tilesOf(piece.x, piece.y, pieceOf(piece.ch)?.w ?? 1, piece.rot))
    if (route(next, door, tile) === null) return true;
  return false;
}

// MARK: Where furniture can stand

/**
 * Where furniture can't go in `room`: in front of a door, and in a building, above its floor (the
 * hallways, and the passage up to them, foot included), so it never blocks anyone's office door.
 */
export function noFurniture(room: RoomId, map: GameMap): Set<string> {
  const out = new Set<string>();
  for (const [ch, kind] of Object.entries(LEGEND)) {
    if (!kind.portal) continue;
    for (const [x, y] of map.find(ch))
      for (const [dx, dy] of Object.values(DIRS)) out.add(`${x + dx},${y + dy}`);
  }
  if (companyOfRoom(room) === null) return out;
  for (let i = 0; i < PASSAGE_W; i++) out.add(`${PASSAGE_X + i},2`);
  for (let y = map.y0; y < 2; y++) for (let x = map.x0; x < map.x0 + map.width; x++) out.add(`${x},${y}`);
  return out;
}

/**
 * Whether drop `d` (a `piece`) could stand with its top-left tile on (x, y), turned `rot`, in `room` with the rest of the
 * floor as it is: bare floor or, for a wall piece, bare wall; one piece to a tile; nobody under it, nobody walled in,
 * and in an office every door, desk and seat still reachable. The same rules as `placeDrop`.
 */
export function furnitureFits(
  room: RoomId,
  d: Drop,
  piece: NonNullable<ReturnType<typeof pieceOfDrop>>,
  x: number,
  y: number,
  people: readonly { x: number; y: number }[],
  rot: Rot = 0,
): boolean {
  const base = baseMap(room);
  const w = piece.w ?? 1;
  const others = (DROPS.get(room) ?? []).filter((o) => o.id !== d.id);
  const taken = new Set<string>();
  for (const o of others) for (const [tx, ty] of dropTiles(o)) taken.add(`${tx},${ty}`);
  // A wall piece hangs along its wall whatever it is told.
  const turn = piece.wall ? 0 : rotOf(rot);
  const tiles = tilesOf(x, y, w, turn);
  for (const [tx, ty] of tiles) if (taken.has(`${tx},${ty}`)) return false;
  if (piece.wall) {
    if (!canHang(base, x, y, w, piece.home)) return false;
    for (const [tx, ty] of tiles) if (taken.has(`${tx},${ty + 1}`)) return false;
    return true;
  }
  const map = withPieces(piecesIn(others), base);
  const reserved = noFurniture(room, base);
  for (const [tx, ty] of tiles) {
    if (!map.walkable(tx, ty) || map.kind(tx, ty).portal || reserved.has(`${tx},${ty}`)) return false;
    if (people.some((o) => o.x === tx && o.y === ty)) return false;
    for (const o of others) if (pieceOfDrop(o)?.wall && dropCovers(o, tx, ty - 1)) return false;
  }
  const next = withPieces([{ ch: piece.ch, x, y, rot: turn }], map);
  const exit = map.find("x")[0];
  if (exit && people.some((o) => !route(next, [o.x, o.y], exit))) return false;
  return !(ownerOfOffice(room) !== null && cutsOff(map, { ch: piece.ch, x, y, rot: turn }));
}
